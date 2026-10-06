"""Write the tessellation in a geometry.json (millimetres) as a plain GLB (metres), one named node per part.

Development helper for scripts/audit_assembly_interference.py: the audit needs only part geometry, so interference fixes
can be checked without a Blender export. With `--motion`, the Wright operating clip from cad_pipeline/wright_motion.py is
also written as baked per-part animation (one key per crank degree), so the real clip audit runs on it exactly as it will on
the exported file. Needs trimesh and numpy (scripts/requirements-audit.txt), not FreeCAD.
"""
import argparse, json, struct, sys
from pathlib import Path
import numpy as np
import trimesh

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
CLIP = 'Operating mechanism (illustrative)'
SECONDS = 30.0                      # 720 crank degrees, as the rig bakes it (24 fps, 721 frames)


def matrix_to_trs(m):
    """4x4 (row-major, mm) -> translation (m), unit quaternion (x, y, z, w), scale."""
    m = np.asarray(m, dtype=float)
    scale = np.linalg.norm(m[:3, :3], axis=0)
    r = m[:3, :3] / np.where(scale == 0, 1, scale)
    t = np.trace(r)
    if t > 0:
        s = 2 * np.sqrt(t + 1)
        q = [(r[2, 1] - r[1, 2]) / s, (r[0, 2] - r[2, 0]) / s, (r[1, 0] - r[0, 1]) / s, 0.25 * s]
    else:
        i = int(np.argmax(np.diag(r)))
        j, k = (i + 1) % 3, (i + 2) % 3
        s = 2 * np.sqrt(1 + r[i, i] - r[j, j] - r[k, k])
        q = [0.0] * 4
        q[i] = 0.25 * s
        q[j] = (r[j, i] + r[i, j]) / s
        q[k] = (r[k, i] + r[i, k]) / s
        q[3] = (r[k, j] - r[j, k]) / s
    return m[:3, 3] / 1000.0, np.array(q), scale


def add_motion(path, parts_order):
    """Append the baked operating clip to a GLB written by trimesh (nodes are named after parts)."""
    from cad_pipeline import wright_motion as motion
    raw = Path(path).read_bytes()
    jlen = struct.unpack('<I', raw[12:16])[0]
    doc = json.loads(raw[20:20 + jlen])
    blen = struct.unpack('<I', raw[20 + jlen:24 + jlen])[0]
    blob = bytearray(raw[28 + jlen:28 + jlen + blen])
    for node in doc['nodes']:                                      # an animated node must carry translation/rotation/scale, not a matrix
        if 'matrix' in node:
            matrix = np.array(node.pop('matrix')).reshape(4, 4).T
            node['translation'] = [float(v) for v in matrix[:3, 3]]
    index = {n['name']: i for i, n in enumerate(doc['nodes']) if 'mesh' in n}
    frames = 721
    times = np.arange(frames, dtype=np.float32) * np.float32(SECONDS / (frames - 1))

    def add(array, kind, count, extra=None):
        while len(blob) % 4:
            blob.append(0)
        doc['bufferViews'].append(dict(buffer=0, byteOffset=len(blob), byteLength=array.nbytes))
        blob.extend(array.tobytes())
        doc['accessors'].append(dict(bufferView=len(doc['bufferViews']) - 1, componentType=5126, count=count, type=kind, **(extra or {})))
        return len(doc['accessors']) - 1

    time_accessor = add(times, 'SCALAR', frames, dict(min=[0.0], max=[float(times[-1])]))
    cache, samplers, channels = {}, [], []
    for pid in parts_order:
        key = (motion.body(pid), pid if motion.body(pid).startswith('chain') else '')
        if key not in cache:
            shift = np.eye(4)
            shift[:3, 3] = motion.pivot(pid) or (0.0, 0.0, 0.0)        # the part's node origin sits on its fixed axis
            keyed = [matrix_to_trs(np.array(motion.matrix(pid, float(f))) @ shift) for f in range(frames)]
            quats = np.array([k[1] for k in keyed])
            for f in range(1, frames):                              # keep the quaternion on one hemisphere
                if np.dot(quats[f], quats[f - 1]) < 0:
                    quats[f] = -quats[f]
            trans = np.array([k[0] for k in keyed])
            scale = np.array([k[2] for k in keyed])
            cache[key] = (trans, quats, scale)
        trans, quats, scale = cache[key]
        for name, values, kind in (('translation', trans, 'VEC3'), ('rotation', quats, 'VEC4'), ('scale', scale, 'VEC3')):
            tolerance = 1e-6 if name == 'scale' else 1e-9
            if np.ptp(values, axis=0).max() < tolerance:
                continue
            samplers.append(dict(input=time_accessor, output=add(values.astype(np.float32), kind, frames), interpolation='LINEAR'))
            channels.append(dict(sampler=len(samplers) - 1, target=dict(node=index[pid], path=name)))
    doc['animations'] = [dict(name=CLIP, samplers=samplers, channels=channels)]
    doc['buffers'][0]['byteLength'] = len(blob)
    body = json.dumps(doc, separators=(',', ':')).encode()
    body += b' ' * (-len(body) % 4)
    blob += bytes(-len(blob) % 4)
    Path(path).write_bytes(b'glTF' + struct.pack('<II', 2, 28 + len(body) + len(blob)) + struct.pack('<II', len(body), 0x4E4F534A) + body +
                           struct.pack('<II', len(blob), 0x004E4942) + bytes(blob))


def convert(geometry, output, motion=False):
    data = json.loads(Path(geometry).read_text())
    scene = trimesh.Scene()
    for part in data['parts']:
        origin = np.zeros(3)
        if motion:
            from cad_pipeline import wright_motion
            origin = np.asarray(wright_motion.pivot(part['id']) or (0.0, 0.0, 0.0), dtype=np.float64)
        mesh = trimesh.Trimesh((np.asarray(part['vertices_mm'], dtype=np.float64) - origin) / 1000.0, np.asarray(part['triangles'], dtype=np.int64), process=False)
        placement = np.eye(4)
        placement[:3, 3] = origin / 1000.0
        scene.add_geometry(mesh, node_name=part['id'], geom_name=part['id'], transform=placement)
    Path(output).write_bytes(scene.export(file_type='glb'))
    if motion:
        add_motion(output, [p['id'] for p in data['parts']])
    return len(data['parts'])


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('geometry')
    parser.add_argument('output')
    parser.add_argument('--motion', action='store_true', help='bake the Wright operating clip (cad_pipeline/wright_motion.py) into the GLB')
    args = parser.parse_args()
    print(convert(args.geometry, args.output, args.motion), 'parts written')
