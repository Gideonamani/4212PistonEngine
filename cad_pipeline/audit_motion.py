"""Audit an operating motion (Wright revision 2 by default, or any module with `matrix(part_id, theta)`) for part interference at sampled crank angles, without a Blender export.

Each sample bakes every part's transform from the motion module into a posed copy of the model's tessellation (geometry.json) and runs
scripts/audit_assembly_interference.py on it exactly as it audits a rest pose, so a clip that clears at rest but collides while the
engine turns is found. This is the development counterpart of auditing the exported GLB's baked clip; the exported file is still
audited before release.

    python cad_pipeline/audit_motion.py --geometry geometry.json --output report.json [--step 30] [--angles 0 90 ...] [--jobs 4] [--motion cad_pipeline.langley_motion]

Needs numpy, trimesh, manifold3d (scripts/requirements-audit.txt), not FreeCAD.
"""
import argparse, importlib, importlib.util, json, sys, tempfile
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path
import numpy as np
import trimesh

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))


def _audit_module():
    spec = importlib.util.spec_from_file_location('audit_assembly_interference', REPO / 'scripts/audit_assembly_interference.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def write_pose(geometry_path, theta, output, motion_module='cad_pipeline.wright_motion'):
    motion = importlib.import_module(motion_module)
    data = json.loads(Path(geometry_path).read_text())
    scene = trimesh.Scene()
    for part in data['parts']:
        m = np.array(motion.matrix(part['id'], theta), dtype=float)
        vertices = np.asarray(part['vertices_mm'], dtype=float)
        posed = vertices @ m[:3, :3].T + m[:3, 3]
        scene.add_geometry(trimesh.Trimesh(posed / 1000.0, np.asarray(part['triangles'], dtype=np.int64), process=False), node_name=part['id'], geom_name=part['id'])
    Path(output).write_bytes(scene.export(file_type='glb'))


def audit_pose(args):
    geometry_path, theta, motion_module = args
    audit = _audit_module().audit
    with tempfile.TemporaryDirectory() as folder:
        glb = Path(folder) / 'pose.glb'
        write_pose(geometry_path, theta, glb, motion_module)
        report = audit(str(glb), None, {}, rest_only=True, log=lambda *a: None)
    found = [(item['a'], item['b'], item['max_overlap_mm3'], item['max_thickness_mm']) for item in report['new_violations'] + report['known_defects']]
    return theta, found, report['rest_neighbouring_pairs']


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--geometry', required=True)
    parser.add_argument('--output')
    parser.add_argument('--step', type=float, default=30.0)
    parser.add_argument('--angles', type=float, nargs='*')
    parser.add_argument('--jobs', type=int, default=4)
    parser.add_argument('--motion', default='cad_pipeline.wright_motion', help='module with matrix(part_id, theta)')
    args = parser.parse_args()
    angles = args.angles or [k * args.step for k in range(int(720 / args.step))]
    pairs = {}
    with ProcessPoolExecutor(max_workers=args.jobs) as pool:
        for theta, found, neighbours in pool.map(audit_pose, [(args.geometry, t, args.motion) for t in angles]):
            print(f'theta {theta:6.1f}: {neighbours} neighbouring pairs, {len(found)} overlapping', flush=True)
            for a, b, volume, thickness in found:
                entry = pairs.setdefault(tuple(sorted((a, b))), dict(first=theta, thetas=[], max_mm3=0.0, max_mm=0.0))
                entry['thetas'].append(theta)
                entry['max_mm3'], entry['max_mm'] = max(entry['max_mm3'], volume), max(entry['max_mm'], thickness)
    print(f'{len(pairs)} distinct overlapping pairs through the motion')
    for (a, b), e in sorted(pairs.items(), key=lambda kv: -kv[1]['max_mm3'])[:60]:
        print(f"  {a} / {b}: {e['max_mm3']:.1f} mm3, {e['max_mm']:.2f} mm thick, first at {e['first']:.0f} deg, {len(e['thetas'])} samples")
    if args.output:
        Path(args.output).write_text(json.dumps({f'{a} / {b}': e for (a, b), e in pairs.items()}, indent=1))


if __name__ == '__main__':
    main()
