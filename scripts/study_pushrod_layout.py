"""Compare reconstructed rocker socket positions using recorded CAD contact poses.

Centreline screening only: this cannot approve solid clearances or engine dimensions.
"""
from pathlib import Path
import hashlib
import json
import math

repo = Path(__file__).resolve().parents[1]
frames_path = repo / 'data/valve-frames.json'
poses_path = repo / 'data/rocker-candidate-contact.json'
frames = json.loads(frames_path.read_text())['trains']
poses = json.loads(poses_path.read_text())['poses']

def add(a, b): return [x + y for x, y in zip(a, b)]
def sub(a, b): return [x - y for x, y in zip(a, b)]
def scale(a, k): return [x * k for x in a]
def dot(a, b): return sum(x * y for x, y in zip(a, b))
def norm(a): return math.sqrt(dot(a, a))
def rotate(v, k, t):
    c, s = math.cos(t), math.sin(t)
    cross = [k[1]*v[2]-k[2]*v[1], k[2]*v[0]-k[0]*v[2], k[0]*v[1]-k[1]*v[0]]
    return add(add(scale(v, c), scale(cross, s)), scale(k, dot(k, v)*(1-c)))

def evaluate(label, offset):
    frame = frames[label.lower()]
    rows = [row for row in poses if row['train'] == label]
    pivot, axis = frame['rocker_pivot_mm'], frame['valve_axis']
    lower = frame['pushrod_lower_mm']
    # Socket remains 20 mm below the shaft; vary only its axial offset.
    socket_vector = add(scale(axis, offset), [0, 0, -20])
    sockets = [add(pivot, rotate(socket_vector, frame['rocker_axis'],
                               math.radians(row['rocker_angle_deg']))) for row in rows]
    length = norm(sub(sockets[0], lower))
    tube_axis = scale(sub(sockets[0], lower), 1/length)
    details = []
    for row, socket in zip(rows, sockets):
        radial2 = (socket[1]-lower[1])**2 + (socket[2]-lower[2])**2
        follower = [socket[0]-math.sqrt(length*length-radial2), lower[1], lower[2]]
        rod_axis = scale(sub(socket, follower), 1/length)
        cosine = dot(rod_axis, tube_axis)
        offsets = []
        # Intersect the moving centreline with both fixed tube-end planes.
        # Norm of its perpendicular displacement is convex along the segment.
        for station in [15, length-15]:
            travel = (station-dot(sub(follower, lower), tube_axis))/cosine
            point = add(follower, scale(rod_axis, travel))
            delta = sub(point, lower)
            offsets.append(norm(sub(delta, scale(tube_axis, dot(delta, tube_axis)))))
        # Oblique cylinder cross-section can exceed the nominal rod radius.
        envelope = max(offsets) + 3.5/cosine
        details.append({'lift_mm': row['lift_mm'], 'follower_ball_mm': follower,
                        'socket_mm': socket, 'tube_end_offsets_mm': offsets,
                        'conservative_tube_radial_margin_mm': 5.6-envelope,
                        'joint_length_error_mm': abs(norm(sub(socket, follower))-length)})
    return {'socket_offset_from_pivot_mm': offset, 'closed_socket_mm': sockets[0],
            'pushrod_length_mm': length, 'fixed_tube_axis': tube_axis,
            'minimum_screening_margin_mm': min(r['conservative_tube_radial_margin_mm'] for r in details),
            'poses': details}

result = {'status': 'Design-space screening; requires native CAD rebuild and solid audit',
          'input_hashes': {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in [frames_path, poses_path]},
          'assumptions': ['7 mm lift and contact rounding remain illustrative/reconstructed',
                          'Lower follower line remains world X; actual cam/lifter layout not yet resolved',
                          'Tube is aligned to the corrected closed pose and remains fixed',
                          'Rod length follows closed joint spacing; never scaled during motion',
                          'Tube bore radius 5.6 mm, rod radius 3.5 mm and 15 mm end offsets are existing reconstructed CAD values',
                          'Ball ends, seals, socket entries and head openings require separate solid checks'],
          'trains': {}}
for label in ['Intake', 'Exhaust']:
    candidates = [evaluate(label, n/4) for n in range(-40, 41)]
    best = max(candidates, key=lambda item: item['minimum_screening_margin_mm'])
    chosen = evaluate(label, 3.5)
    result['trains'][label.lower()] = {'original_offset_rebound_to_closed_pose': evaluate(label, 9),
                                     'best_sampled_offset_mm': best['socket_offset_from_pivot_mm'],
                                     'best_sampled_margin_mm': best['minimum_screening_margin_mm'],
                                     'shared_candidate': chosen}
    print(label, 'shared offset 3.5 mm; minimum screening margin', chosen['minimum_screening_margin_mm'])
(repo / 'data/pushrod-layout-study.json').write_text(json.dumps(result, indent=2)+'\n')
