"""Write the tessellation in a geometry.json (millimetres) as a plain GLB (metres), one named node per part.

Development helper for scripts/audit_assembly_interference.py: the audit needs only part geometry, so interference fixes
can be checked without a Blender export. Needs trimesh and numpy (scripts/requirements-audit.txt), not FreeCAD.
"""
import argparse, json
from pathlib import Path
import numpy as np
import trimesh


def convert(geometry, output):
    data = json.loads(Path(geometry).read_text())
    scene = trimesh.Scene()
    for part in data['parts']:
        mesh = trimesh.Trimesh(np.asarray(part['vertices_mm'], dtype=np.float64) / 1000.0, np.asarray(part['triangles'], dtype=np.int64), process=False)
        scene.add_geometry(mesh, node_name=part['id'], geom_name=part['id'])
    Path(output).write_bytes(scene.export(file_type='glb'))
    return len(data['parts'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('geometry')
    parser.add_argument('output')
    args = parser.parse_args()
    print(convert(args.geometry, args.output), 'parts written')
