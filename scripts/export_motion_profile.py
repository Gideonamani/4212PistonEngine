"""Run with FreeCAD's Python. Reads the master; never saves changes to it."""
from pathlib import Path
import hashlib, json, math
import FreeCAD as App

repo = Path(__file__).resolve().parents[1]
cad = repo.parent / 'EngineSimulation/FreeCAD/v2'
source = cad / 'GTSIO520_Detailed_Cylinder.FCStd'
doc = App.openDocument(str(source))
rows = json.loads((cad / 'parameter_rows.json').read_text())

def frame(placement):
    return {'translation_mm': list(placement.Base), 'quaternion_xyzw': list(placement.Rotation.Q)}

try:
    doc.recompute()
    dimensions = {}
    for name in ['Bore', 'NominalBore', 'Stroke', 'RodLength', 'PinDiameter', 'CrownHeight']:
        row = rows[name]
        dimensions[name] = {'value_mm': getattr(doc.Parameters, name).Value,
                            'cad_cell': f'Parameters.B{row}',
                            'existing_evidence_category': doc.Parameters.get(f'C{row}'),
                            'existing_reference': doc.Parameters.get(f'D{row}'),
                            'review_status': 'Imported CAD annotation; not a new manual verification'}
    groups = {name: frame(doc.getObject(name).Placement) for name in ['Cylinder','Piston','ConnectingRod','Crank']}
    parts = [{'id': b.StablePartID, 'motion_group': b.getParentGeoFeatureGroup().Name,
              'body_frame_in_group': frame(b.Placement)}
             for b in doc.Objects if b.TypeId == 'PartDesign::Body']
    reference_angle = doc.Motion.CrankAngle.Value
    radius = dimensions['Stroke']['value_mm']/2
    length = dimensions['RodLength']['value_mm']
    checks = []
    for degrees in [0,35,90,180,270,360,540,720]:
        doc.Motion.set('B2', f'{degrees} deg')
        doc.recompute()
        theta = math.radians(degrees)
        cx, cz = radius*math.cos(theta), radius*math.sin(theta)
        reach = math.sqrt(length*length-cz*cz)
        piston = App.Vector(cx+reach,0,0)
        crankpin = App.Vector(cx,0,cz)
        rod_tip = doc.ConnectingRod.Placement.multVec(App.Vector(length,0,0))
        actual_crankpin = doc.Crank.Placement.multVec(App.Vector(radius,0,0))
        errors = [(doc.Piston.Placement.Base-piston).Length,
                  (doc.ConnectingRod.Placement.Base-crankpin).Length,
                  (rod_tip-piston).Length, (actual_crankpin-crankpin).Length]
        if max(errors)>1e-6: raise ValueError(f'CAD/motion disagreement at {degrees}: {errors}')
        checks.append({'angle_deg':degrees,'piston_pin_mm':list(piston),'crankpin_mm':list(crankpin),'max_joint_error_mm':max(errors)})
    profile = {'schema_version':'0.1-draft','status':'CAD slider-crank verified; valve motion and web asset bind pose pending',
               'source':{'file':source.name,'sha256':hashlib.sha256(source.read_bytes()).hexdigest()},
               'coordinate_system':{'units':'mm','piston_axis':[1,0,0],'main_shaft_axis':[0,1,0],
                                    'main_shaft_origin_mm':[0,0,0],'positive_crank_rotation_axis':[0,-1,0],
                                    'zero_angle':'Outer dead centre; piston pin farthest from main shaft',
                                    'web_mapping':'Blender metres (x,y,z) to glTF metres (x,z,-y); confirm asset bind pose before applying motion'},
               'dimensions':dimensions,'reference_angle_deg':reference_angle,'group_reference_frames':groups,'parts':parts,
               'cycle':{'degrees':720,'timing_status':'Illustrative teaching profile from existing video; not manufacturer timing',
                        'strokes':[{'name':n,'start_deg':i*180,'end_deg':(i+1)*180} for i,n in enumerate(['Intake','Compression','Power','Exhaust'])],
                        'illustrative_max_valve_lift_mm':7,'valve_axes_status':'Pending extraction and reference review'},
               'validation':{'passed':True,'tolerance_mm':1e-6,'poses':checks}}
    assert len(parts)==60 and len({p['id'] for p in parts})==60
    target=repo/'data/motion-profile.json';target.parent.mkdir(exist_ok=True)
    target.write_text(json.dumps(profile,indent=2)+'\n')
    print(json.dumps({'parts':len(parts),'cad_poses_verified':len(checks),'max_joint_error_mm':max(c['max_joint_error_mm'] for c in checks),'reference_angle_deg':reference_angle}))
finally:
    App.closeDocument(doc.Name)
