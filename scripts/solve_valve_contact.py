"""Find first contact of existing CAD envelopes; diagnostic, not a cam design.

Run with FreeCAD's Python. Never writes the dimensional master.
"""
from pathlib import Path
import hashlib
import json
import math
import argparse
import FreeCAD as App

repo = Path(__file__).resolve().parents[1]
source = repo.parent / 'EngineSimulation/FreeCAD/v2/GTSIO520_Detailed_Cylinder.FCStd'
frames = json.loads((repo / 'data/valve-frames.json').read_text())
assert hashlib.sha256(source.read_bytes()).hexdigest() == frames['source_sha256']
parser = argparse.ArgumentParser()
parser.add_argument('--candidate', action='store_true')
parser.add_argument('--layout', action='store_true')
parser.add_argument('--housing', action='store_true')
args = parser.parse_args()
if sum([args.candidate,args.layout,args.housing]) > 1:
    parser.error('Choose one candidate type')
if args.candidate:
    candidate = json.loads((repo / 'data/rocker-candidate.json').read_text())
    assert candidate['source_sha256'] == frames['source_sha256']
    source = repo / candidate['candidate_file']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == candidate['candidate_sha256']
if args.layout:
    candidate = json.loads((repo / 'data/pushrod-candidate.json').read_text())
    frames = json.loads((repo / 'data/pushrod-frames.json').read_text())
    source = repo / candidate['candidate_file']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == candidate['candidate_sha256'] == frames['source_sha256']
if args.housing:
    candidate = json.loads((repo / 'data/housing-candidate.json').read_text())
    frames = json.loads((repo / 'data/pushrod-frames.json').read_text())
    source = repo / candidate['candidate_file']
    assert hashlib.sha256(source.read_bytes()).hexdigest() == candidate['candidate_sha256']
    assert frames['source_sha256'] == candidate['parent_sha256'] == candidate['joint_frame_source_sha256']
doc = App.openDocument(str(source))

def world(name):
    body = doc.getObject(name)
    shape = body.Shape.copy()
    shape.Placement = body.getParentGeoFeatureGroup().getGlobalPlacement().multiply(shape.Placement)
    return shape

def moved(shape, delta):
    result = shape.copy()
    result.Placement = delta.multiply(result.Placement)
    return result

report = {'source_sha256': hashlib.sha256(source.read_bytes()).hexdigest(),
          'joint_frame_source_sha256': frames['source_sha256'],
          'status': 'Diagnostic contact solution for reconstructed envelopes; not approved valve motion',
          'contact_tolerance_mm': 1e-6, 'poses': []}
try:
    doc.recompute()
    bodies = [o for o in doc.Objects if o.TypeId == 'PartDesign::Body' and not getattr(o,'ConstructionOnly',False)]
    sketches = [o for o in doc.Objects if o.TypeId == 'Sketcher::SketchObject']
    ids = [b.StablePartID for b in bodies]
    report['cad_structure'] = {'body_count': len(bodies), 'unique_stable_ids': len(set(ids)),
                               'sketch_count': len(sketches),
                               'unconstrained_sketches': [s.Name for s in sketches if not s.FullyConstrained]}
    if len(set(ids)) != len(ids):
        raise RuntimeError('Duplicate stable component IDs')
    for label in ['Intake', 'Exhaust']:
        f = frames['trains'][label.lower()]
        rocker_body = doc.getObject(label+'RockerArm')
        rod_body = doc.getObject(label+'Pushrod')
        frame_checks = {
            'socket': (rocker_body.getGlobalPlacement().multVec(doc.getObject(label+'PushrodSocket').Placement.Base), f['pushrod_socket_mm']),
            'lower_ball': (rod_body.getGlobalPlacement().multVec(doc.getObject(label+'LowerBall').Placement.Base), f['pushrod_lower_mm']),
            'upper_ball': (rod_body.getGlobalPlacement().multVec(doc.getObject(label+'UpperBall').Placement.Base), f['pushrod_upper_mm'])}
        errors = {name: (actual-App.Vector(*expected)).Length for name,(actual,expected) in frame_checks.items()}
        report.setdefault('joint_frame_errors_mm',{})[label] = errors
        if max(errors.values()) > 1e-6:
            raise RuntimeError(f'{label}: joint frames do not match candidate geometry')
        axis = App.Vector(*f['valve_axis'])
        pivot = App.Vector(*f['rocker_pivot_mm'])
        rockaxis = App.Vector(*f['rocker_axis'])
        valve, rocker, housing = [world(label + suffix) for suffix in ['Valve', 'RockerArm', 'RockerHousing']]
        pushrod, tube = [world(label + suffix) for suffix in ['Pushrod', 'PushrodHousing']]
        lower = App.Vector(*f['pushrod_lower_mm'])
        upper = App.Vector(*f['pushrod_socket_mm'])
        length = f['pushrod_length_mm']
        previous_angle = 0.0
        for step in range(29):
            lift = step / 4
            v = moved(valve, App.Placement(-axis * lift, App.Rotation()))
            def pose(degrees):
                rotation = App.Rotation(rockaxis, -degrees)
                delta = App.Placement(pivot - rotation.multVec(pivot), rotation)
                return moved(rocker, delta), delta
            # First sampled contact interval, followed by one-sided bisection.
            lo = previous_angle
            hi = None
            for half_degree in range(1, 81):
                candidate_angle = previous_angle + half_degree / 2
                if candidate_angle > 40:
                    break
                r, _ = pose(candidate_angle)
                if v.distToShape(r)[0] <= 1e-6:
                    hi = candidate_angle
                    break
                lo = candidate_angle
            if hi is None:
                raise RuntimeError(f'No first contact bracket for {label} lift {lift}')
            for _ in range(26):
                mid = (lo + hi) / 2
                r, _ = pose(mid)
                if v.distToShape(r)[0] > 1e-6:
                    lo = mid
                else:
                    hi = mid
            r, delta = pose(lo)
            previous_angle = lo
            gap, pairs, _ = v.distToShape(r)
            socket = delta.multVec(upper)
            # Existing follower assumption: lower ball travels along world X.
            radial2 = (socket.y - lower.y)**2 + (socket.z - lower.z)**2
            if radial2 >= length**2:
                raise RuntimeError('Pushrod cannot reach follower line')
            follower = App.Vector(socket.x - math.sqrt(length**2 - radial2), lower.y, lower.z)
            rod_rotation = App.Rotation(upper - lower, socket - follower)
            rod_delta = App.Placement(follower - rod_rotation.multVec(lower), rod_rotation)
            rod = moved(pushrod, rod_delta)
            row = {'train': label, 'lift_mm': lift, 'rocker_angle_deg': -lo,
                   'contact_gap_mm': gap, 'intersection_volume_mm3': v.common(r).Volume,
                   'contact_points_mm': [[list(a), list(b)] for a, b in pairs[:1]],
                   'rocker_housing_gap_mm': r.distToShape(housing)[0],
                   'rocker_housing_intersection_mm3': r.common(housing).Volume,
                   'pushrod_socket_mm': list(socket), 'follower_ball_mm': list(follower),
                   'pushrod_housing_gap_mm': rod.distToShape(tube)[0],
                   'pushrod_housing_intersection_mm3': rod.common(tube).Volume,
                   'pushrod_rocker_intersection_mm3': rod.common(r).Volume,
                   'pushrod_length_error_mm': abs((socket - follower).Length - length)}
            report['poses'].append(row)
            print(f'{label} lift={lift:.2f} angle={-lo:.6f} gap={gap:.8f}', flush=True)
        if args.housing and label == 'Intake':
            review = {'source_sha256': report['source_sha256'], 'lift_mm': lift,
                      'scope': 'Reconstructed valve-train clearance candidate, not released', 'parts': []}
            for name, shape in [('Rocker',r),('Valve',v),('Pushrod',rod),('Housing',housing),
                                ('Tube',tube),('Shaft',world(label+'RockerShaft'))]:
                vertices,triangles=shape.tessellate(.08)
                review['parts'].append({'name':name,'vertices_mm':[list(p) for p in vertices],'triangles':triangles})
            review_path=repo/'.local/housing-review.json'
            review_path.parent.mkdir(parents=True,exist_ok=True)
            review_path.write_text(json.dumps(review,separators=(',',':')))
    report['limitations'] = ['First contact of reconstructed solid envelopes, not a validated contact pad',
                             'Follower travel direction is inherited from the illustrative model',
                             'Spring and unlisted neighbouring-part collision checks remain outstanding',
                             '0.25 mm lift samples do not prove continuous clearance',
                             '7 mm maximum lift remains illustrative, not a manufacturer specification']
    collision_fields = ['intersection_volume_mm3', 'rocker_housing_intersection_mm3',
                        'pushrod_housing_intersection_mm3', 'pushrod_rocker_intersection_mm3']
    report['sampled_clearance_gate'] = {
        'intersection_tolerance_mm3': 1e-5,
        'passed': all(row[key] <= 1e-5 for row in report['poses'] for key in collision_fields),
        'maximum_intersections_mm3': {key: max(row[key] for row in report['poses']) for key in collision_fields},
        'scope': 'Only listed pairs and sampled poses; passing does not approve the complete assembly'}
    if not report['sampled_clearance_gate']['passed']:
        report['status'] = 'Rejected for promotion: sampled pushrod/rocker or housing interference; see clearance gate'
    output = repo / ('data/housing-candidate-contact.json' if args.housing else
                     'data/pushrod-candidate-contact.json' if args.layout else
                     'data/rocker-candidate-contact.json' if args.candidate else 'data/valve-contact-solution.json')
    output.write_text(json.dumps(report, indent=2) + '\n')
finally:
    App.closeDocument(doc.Name)
