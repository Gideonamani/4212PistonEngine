"""Development evaluator for a part specification: direct Part booleans, no native feature history.

`generate.py` builds the editable, expression-driven FreeCAD document and is the release path. It is slow (a
document recompute per feature), which makes interference fixes painful to iterate. This evaluator builds the same
parts straight from the specification with plain Part booleans, caches each part by the hash of its features and the
parameters, and writes the same `geometry.json` (millimetres, FreeCAD axes) that `generate.py` writes. It never writes
a native document or STEP file and is never a release artifact; rebuild with `generate.py` before release.

Run with FreeCAD's Python:
    python cad_pipeline/fast_build.py --spec cad-studies/wright-1903/revision-2/part-spec.json --output <dir> [--jobs 4] [--only A B]
"""
import argparse, hashlib, json, sys, time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.append(r'C:/Program Files/FreeCAD 1.1/bin')
from cad_pipeline.spec import evaluate, validate_spec, deflection_for
import FreeCAD as A
import Part
import MeshPart


def _placement(f, params):
    origin = [evaluate(x, params) for x in f.get('origin', [0, 0, 0])]
    return A.Placement(A.Vector(*origin), A.Rotation(A.Vector(0, 0, 1), A.Vector(*f.get('axis', [0, 0, 1]))))


def feature_shape(f, params):
    """The solid of one primitive feature, in place."""
    kind, e = f['primitive'], (lambda key: evaluate(f[key], params))
    if kind == 'box':
        shape = Part.makeBox(e('length'), e('width'), e('height'))
    elif kind == 'cylinder':
        shape = Part.makeCylinder(e('radius'), e('height'))
    elif kind == 'tube':
        shape = Part.makeCylinder(e('radius'), e('height')).cut(Part.makeCylinder(e('inner_radius'), e('height')))
    elif kind == 'cone':
        shape = Part.makeCone(e('radius1'), e('radius2'), e('height'))
    elif kind == 'sphere':
        shape = Part.makeSphere(e('radius'))
    elif kind == 'prism':
        points = [A.Vector(evaluate(p[0], params), evaluate(p[1], params), 0) for p in f['points']]
        shape = Part.Face(Part.makePolygon(points + [points[0]])).extrude(A.Vector(0, 0, e('height')))
    elif kind == 'helix':
        radius, wire_radius = e('radius'), e('wire_radius')
        helix = Part.makeHelix(e('pitch'), e('height'), radius)
        profile = Part.Wire([Part.makeCircle(wire_radius, A.Vector(radius, 0, 0), A.Vector(0, 1, 0))])
        shape = Part.Wire(helix.Edges).makePipeShell([profile], True, True)
    else:
        raise ValueError('Unsupported primitive ' + kind)
    shape.Placement = _placement(f, params)
    return shape


def build_part(part, params):
    current = None
    for f in part['features']:
        shape = feature_shape(f, params)
        current = shape if current is None else (current.fuse(shape) if f['operation'] == 'add' else current.cut(shape))
    return current


def part_record(part, params, deflection=.7):
    shape = build_part(part, params)
    solids = len(shape.Solids)
    valid = bool(shape.isValid())
    mesh = MeshPart.meshFromShape(Shape=shape, LinearDeflection=deflection, AngularDeflection=.35, Relative=False)
    vertices, faces = mesh.Topology
    bb = shape.optimalBoundingBox(False, False)
    return dict(id=part['id'], label=part['label'], group=part.get('group', 'other'), material=part.get('material', 'steel'),
                evidence=part['evidence'], volume_mm3=shape.Volume, solids=solids, valid=valid,
                bounds_mm=[[bb.XMin, bb.YMin, bb.ZMin], [bb.XMax, bb.YMax, bb.ZMax]],
                vertices_mm=[list(v) for v in vertices], triangles=faces, feature_count=len(part['features']))


def part_key(part, params, deflection=.7):
    return hashlib.sha256(json.dumps([part, params, deflection], sort_keys=True).encode()).hexdigest()


def _job(args):
    part, params, cache, deflection = args
    path = Path(cache) / (part['id'] + '.json')
    key = part_key(part, params, deflection)
    if path.exists():
        record = json.loads(path.read_text())
        if record.get('key') == key:
            return record['record'], True
    started = time.time()
    try:
        record = part_record(part, params, deflection)
    except Exception as error:                       # a seat that swallows its host, an invalid boolean: report, do not stop the run
        return dict(id=part['id'], error=str(error), solids=0, valid=False, volume_mm3=0, seconds=round(time.time() - started, 1)), False
    record['seconds'] = round(time.time() - started, 1)
    path.write_text(json.dumps(dict(key=key, record=record), separators=(',', ':')))
    return record, False


def build(spec, output, jobs=4, only=None):
    validate_spec(spec)
    output = Path(output)
    cache = output / 'part-cache'
    cache.mkdir(parents=True, exist_ok=True)
    params = spec['parameters']
    parts = [p for p in spec['parts'] if not only or p['id'] in only]
    work = [(p, params, str(cache), deflection_for(spec, p)) for p in parts]
    started, records, hits = time.time(), [], 0
    with ProcessPoolExecutor(max_workers=jobs) as pool:
        for n, (record, cached) in enumerate(pool.map(_job, work), 1):
            records.append(record)
            hits += cached
            if not cached:
                print(f"built {record['id']:24s} {record['seconds']:6.1f}s  solids={record['solids']} valid={record['valid']}  ({n}/{len(work)})", flush=True)
    bad = [r['id'] for r in records if r['solids'] != 1 or not r['valid'] or r['volume_mm3'] <= 0]
    for r in records:
        if r['id'] in bad:
            print(f"NOT A SINGLE VALID SOLID {r['id']}: solids={r['solids']} valid={r['valid']} volume={r['volume_mm3']:.1f} {r.get('error', '')}", flush=True)
    records = [r for r in records if 'error' not in r]
    data = dict(schema_version=1, units='mm', coordinates='FreeCAD XYZ; divide by 1000 once in Blender', model_id=spec['model_id'],
                scope=spec['scope'], parts=records, development_build=True)
    (output / 'geometry.json').write_text(json.dumps(data, separators=(',', ':')))
    print(f'{len(records)} parts, {hits} from cache, {len(bad)} not a single valid solid: {bad}, {time.time() - started:.0f}s', flush=True)
    return records, bad


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--spec', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--jobs', type=int, default=4)
    parser.add_argument('--only', nargs='+')
    args = parser.parse_args()
    build(json.loads(args.spec.read_text()), args.output, args.jobs, args.only)


if __name__ == '__main__':
    main()
