"""Extract valve-train joints from native CAD features; do not modify/save the master."""
from pathlib import Path
import hashlib,json,argparse
import FreeCAD as App

repo=Path(__file__).resolve().parents[1]
source=repo.parent/'EngineSimulation/FreeCAD/v2/GTSIO520_Detailed_Cylinder.FCStd'
parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path)
parser.add_argument('--output',type=Path)
args=parser.parse_args()
if args.source and not args.output: parser.error('--source requires a separate --output')
if args.source: source=args.source.resolve()
output=args.output or repo/'data/valve-frames.json'
doc=App.openDocument(str(source))
def vec(v): return [v.x,v.y,v.z]
def point(body,feature): return body.getGlobalPlacement().multVec(feature.Placement.Base)
try:
    doc.recompute();trains={}
    for name in ['Intake','Exhaust']:
        valve=doc.getObject(name+'Valve');rocker=doc.getObject(name+'RockerArm');pushrod=doc.getObject(name+'Pushrod')
        shaft=doc.getObject(name+'Shaft');sketch=shaft.Profile[0] if isinstance(shaft.Profile,tuple) else shaft.Profile
        frame=sketch.getGlobalPlacement();axis=frame.Rotation.multVec(App.Vector(0,0,1))
        pivot=frame.multVec(sketch.Geometry[0].Center)+axis*(shaft.Length.Value/2)
        lower=point(pushrod,doc.getObject(name+'LowerBall'))
        upper=point(pushrod,doc.getObject(name+'UpperBall'))
        socket=point(rocker,doc.getObject(name+'PushrodSocket'))
        socket_error=(upper-socket).Length
        if socket_error>1e-6: raise ValueError(f'{name} pushrod/socket mismatch: {socket_error}')
        springs={}
        for which in ['Inner','Outer']:
            body=doc.getObject(name+which+'Spring');wire=doc.getObject(name+which+'WireSketch');coil=doc.getObject(name+which+'Coil')
            circle=wire.Geometry[0];start=circle.Center.x-circle.Radius
            springs[which.lower()]={'seat_point_mm':vec(body.getGlobalPlacement().multVec(App.Vector(start,0,0))),
                                   'axial_envelope_mm':coil.Height.Value+2*circle.Radius,
                                   'source_features':[wire.Name,coil.Name], 'evidence':body.Evidence}
        trains[name.lower()]={'valve_id':valve.StablePartID,'closed_valve_origin_mm':vec(valve.getGlobalPlacement().Base),
            'valve_axis':vec(valve.getGlobalPlacement().Rotation.multVec(App.Vector(1,0,0))),
            'opening_direction':'negative valve_axis','valve_evidence':valve.Evidence,
            'rocker_pivot_mm':vec(pivot),'rocker_axis':vec(axis),'pivot_source':sketch.Name+' circle centre + half pad length',
            'rocker_evidence':rocker.Evidence,'pushrod_lower_mm':vec(lower),'pushrod_upper_mm':vec(upper),
            'pushrod_length_mm':(upper-lower).Length,'pushrod_socket_mm':vec(socket),'socket_alignment_error_mm':socket_error,
            'pushrod_evidence':pushrod.Evidence,'springs':springs,
            'existing_video_max_lift_mm':7,'existing_video_effective_rocker_lever_mm':22,
            'motion_status':'Video lift/lever are illustrative; actual rocker/valve contact and cam profile unresolved'}
    report={'schema_version':'0.1-draft','source_file':source.name,'source_sha256':hashlib.sha256(source.read_bytes()).hexdigest(),
            'coordinates':'FreeCAD world millimetres; rotate (x,y,z) to glTF (x,z,-y), divide positions by 1000',
            'status':'Static feature frames extracted; not a validated dynamic contact model','trains':trains,
            'next_checks':['Review valve-stem/rocker contact and lever arm before choosing motion law',
                           'Verify minimum spring length and coil clearance over proposed lift',
                           'Verify rocker, pushrod and housing clearances over motion',
                           'Resolve provisional exhaust inclination and manufacturer valve timing from manual']}
    output.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({k:{'pivot_mm':v['rocker_pivot_mm'],'pushrod_length_mm':v['pushrod_length_mm'],'socket_error_mm':v['socket_alignment_error_mm']} for k,v in trains.items()},indent=2))
finally: App.closeDocument(doc.Name)
