"""Development evaluator for a part specification: direct Part booleans, no native feature history.

`generate.py` builds the editable, expression-driven FreeCAD document and is the release path. It is slow (a
document recompute per feature), which makes interference fixes painful to iterate. This evaluator builds the same
parts straight from the specification with plain Part booleans, caches each part by the hash of its features and the
parameters, and writes the same `geometry.json` (millimetres, FreeCAD axes) that `generate.py` writes. It never writes
a native document or STEP file and is never a release artifact; rebuild with `generate.py` before release.

Run with FreeCAD's Python:
    python cad_pipeline/fast_build.py --spec cad-studies/wright-1903/revision-2/part-spec.json --output <dir> [--jobs 4] [--only A B]
"""
import argparse, faulthandler, hashlib, json, sys, time
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
sys.path.append(r'C:/Program Files/FreeCAD 1.1/bin')
from cad_pipeline.spec import evaluate, validate_spec, deflection_for
from cad_pipeline.meshing import tessellation_shape
import FreeCAD as A
import Part
import MeshPart


def _placement(f, params):
    origin = [evaluate(x, params) for x in f.get('origin', [0, 0, 0])]
    rotation = A.Rotation(*f['rotation_quaternion']) if 'rotation_quaternion' in f else A.Rotation(A.Vector(0, 0, 1), A.Vector(*f.get('axis', [0, 0, 1])))
    roll = evaluate(f.get('roll', 0), params)
    if roll:
        rotation = rotation.multiply(A.Rotation(A.Vector(0, 0, 1), roll))
    return A.Placement(A.Vector(*origin), rotation)


def helix_spine(radius, pitch, height, left_handed=False):
    """Fresh primitive curve using the release constructor, not a saved CAD tip.

    Part.makeHelix and Part::Helix use different surface/curve approximations in
    FreeCAD 1.1.1. Tiny spring sweeps can exceed our mass agreement tolerance.
    Only the centreline uses a transient native primitive; sweep and Booleans
    remain direct. This does not independently validate the helix constructor.
    """
    doc = A.newDocument('DirectHelixPrimitive')
    try:
        spine = doc.addObject('Part::Helix', 'Spine')
        spine.Radius, spine.Pitch, spine.Height = radius, pitch, height
        spine.LocalCoord = 'Left-handed' if left_handed else 'Right-handed'
        doc.recompute()
        return spine.Shape.copy()
    finally:
        A.closeDocument(doc.Name)


def feature_shape(f, params):
    """The solid of one primitive feature, in place."""
    kind, e = f['primitive'], (lambda key: evaluate(f[key], params))
    if kind == 'polar_pattern':
        master=feature_shape(f['pattern_feature'],params)
        if f.get('tool_clip'):master=master.common(feature_shape(f['tool_clip'],params)).removeSplitter()
        copies=[]
        step=f.get('step_degrees',360/f['count'])
        for index in range(f['count']):
            copy=master.copy();copy.rotate(A.Vector(),A.Vector(0,0,1),step*index);copies.append(copy)
        shape=Part.makeCompound(copies)
    elif kind == 'box':
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
    elif kind == 'revolve':
        points = [A.Vector(evaluate(p[0], params), 0, evaluate(p[1], params)) for p in f['points']]
        shape = Part.Face(Part.makePolygon(points + [points[0]])).revolve(A.Vector(0, 0, 0), A.Vector(0, 0, 1), evaluate(f.get('angle', 360), params))
    elif kind == 'loft':
        if 'profile_spline_runs' in f:
            from cad_pipeline.sampled_loft import direct
            shape=direct(f,params)
        else:
            wires=[]
            for section in f['sections']:
                points=[A.Vector(*[evaluate(v,params) for v in point]) for point in section]
                wires.append(Part.Wire(Part.makePolygon(points+[points[0]])))
            shape=Part.makeLoft(wires,True,True)
    elif kind == 'helix':
        radius, wire_radius = e('radius'), e('wire_radius')
        helix = helix_spine(radius, e('pitch'), e('height'), f.get('left_handed',False))
        circle = Part.Shape([Part.makeCircle(wire_radius)])
        circle.Placement = A.Placement(A.Vector(radius, 0, 0), A.Rotation(A.Vector(0, 0, 1), A.Vector(0, 1, 0)))
        profile = Part.Wire(circle.Edges)
        shape = Part.Wire(helix.Edges).makePipeShell([profile], True, True)
    else:
        raise ValueError('Unsupported primitive ' + kind)
    shape.Placement = _placement(f, params)
    return shape


BATCH_RUN = 6        # a run of this many consecutive same-operation features is applied as one multi-tool Boolean (24 sequential spoke-hole cuts take minutes, one multi-tool cut seconds)


def build_part(part, params):
    current = None
    batch_run=part.get('boolean_batch_runs',BATCH_RUN)
    refine=part.get('boolean_refine',True)
    features = part['features']
    from cad_pipeline.boolean_runs import feature_runs
    for indices in feature_runs(features,batch_run):
        i,j=indices[0],indices[-1]
        run = [features[index] for index in indices]
        if part.get('trace_boolean_runs'):print('DIRECT_RUN_BEGIN',part['id'],i+1,j+1,flush=True)
        if current is not None and batch_run and len(run) >= batch_run:
            tools = [feature_shape(f, params) for f in run]
            current = current.fuse(tools) if run[0]['operation'] == 'add' else current.cut(tools)
            if refine:current=current.removeSplitter()
        else:
            for f in run:
                if f['primitive']=='polar_pattern':print('DIRECT_PATTERN_BEGIN',part['id'],f['count'],'copies',flush=True)
                shape = feature_shape(f, params)
                if current is None:current=shape
                else:
                    if f['primitive']=='polar_pattern':print('DIRECT_PATTERN_BOOLEAN',part['id'],len(shape.Faces),'tool faces',flush=True)
                    current=current.fuse(shape) if f['operation']=='add' else current.cut(shape)
                    if refine:current=current.removeSplitter()
                if f['primitive']=='polar_pattern':print('DIRECT_PATTERN_END',part['id'],flush=True)
        if part.get('trace_boolean_runs'):print('DIRECT_RUN_END',part['id'],j+1,'null',current.isNull(),flush=True)
    if part.get('dressups'):
        from cad_pipeline.dressups import apply_direct
        current=apply_direct(current,part['dressups'],params)
    if part.get('placement'):
        frame=part['placement']
        if 'mirror_normal' in frame:
            current=current.mirror(A.Vector(*[evaluate(v,params) for v in frame.get('mirror_base',[0,0,0])]),A.Vector(*frame['mirror_normal']))
        current.Placement=_placement(frame,params).multiply(current.Placement)
    return current


def part_record(part, params, deflection=.7, brep_file=None):
    shape = build_part(part, params)
    solids = len(shape.Solids)
    valid = bool(shape.isValid())
    if brep_file is not None:
        brep_file.parent.mkdir(parents=True,exist_ok=True);shape.exportBrep(str(brep_file))
    mesh = MeshPart.meshFromShape(Shape=tessellation_shape(shape,part), LinearDeflection=deflection, AngularDeflection=.35, Relative=False)
    vertices, faces = mesh.Topology
    bb = shape.optimalBoundingBox(False, False)
    return dict(id=part['id'], label=part['label'], group=part.get('group', 'other'), material=part.get('material', 'steel'),
                evidence=part['evidence'], volume_mm3=shape.Volume, solids=solids, valid=valid,
                bounds_mm=[[bb.XMin, bb.YMin, bb.ZMin], [bb.XMax, bb.YMax, bb.ZMax]],
                vertices_mm=[list(v) for v in vertices], triangles=faces, feature_count=1 if part.get('geometry_instance_of') else len(part['features'])+len(part.get('dressups',[]))+bool(part.get('placement'))+bool(part.get('placement',{}).get('mirror_normal')),geometry_master_id=part.get('geometry_instance_of'))


def part_key(part, params, deflection=.7):
    data=[part,params,deflection]
    if part.get('boolean_refine',True) and len(part['features'])>1:data.append('direct_boolean_refinement_v2')
    if any(f['primitive']=='helix' for f in part['features']):data.append('native_helix_spine_direct_sweep_v1')
    return hashlib.sha256(json.dumps(data,sort_keys=True).encode()).hexdigest()


def _job(args):
    part, params, cache, deflection = args
    path = Path(cache) / (part['id'] + '.json')
    key = part_key(part, params, deflection)
    brep_file=Path(cache).parent/'brep-cache'/(part['id']+'-'+key+'.brep')
    if path.exists():
        record = json.loads(path.read_text())
        if record.get('key') == key and brep_file.exists():
            return record['record'], True
    started = time.time()
    print('DIRECT_PART_BEGIN',part['id'],flush=True)
    faulthandler.dump_traceback_later(120,repeat=True)
    try:
        record = part_record(part, params, deflection,brep_file)
    except Exception as error:                       # a seat that swallows its host, an invalid boolean: report, do not stop the run
        return dict(id=part['id'], error=str(error), solids=0, valid=False, volume_mm3=0, seconds=round(time.time() - started, 1)), False
    finally:faulthandler.cancel_dump_traceback_later()
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
    with (output/'geometry.json').open('w',encoding='utf-8') as stream:
        json.dump(data,stream,separators=(',',':'))
    print(f'{len(records)} parts, {hits} from cache, {len(bad)} not a single valid solid: {bad}, {time.time() - started:.0f}s', flush=True)
    return records, bad


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--spec', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--jobs', type=int, default=4)
    parser.add_argument('--only', nargs='+')
    args = parser.parse_args()
    _,bad=build(json.loads(args.spec.read_text()), args.output, args.jobs, args.only)
    if bad:raise SystemExit(1)


if __name__ == '__main__':
    main()
