"""Rebuild native dependent features for an isolated pushrod-layout candidate."""
from pathlib import Path
import hashlib, json, math
import FreeCAD as App

repo = Path(__file__).resolve().parents[1]
parent = json.loads((repo/'data/rocker-candidate.json').read_text())
source = repo/parent['candidate_file']
assert hashlib.sha256(source.read_bytes()).hexdigest() == parent['candidate_sha256']
study = json.loads((repo/'data/pushrod-layout-study.json').read_text())
for filename, expected in study['input_hashes'].items():
    assert hashlib.sha256((repo/'data'/filename).read_bytes()).hexdigest() == expected
contact = json.loads((repo/'data/rocker-candidate-contact.json').read_text())
assert contact['source_sha256'] == parent['candidate_sha256']
doc = App.openDocument(str(source))
out = repo/'build/pushrod-layout/GTSIO520_Pushrod_Candidate.FCStd'
out.parent.mkdir(parents=True, exist_ok=True)
report = {'status': 'Experimental, solid motion audit pending', 'parent_sha256': parent['candidate_sha256'],
          'candidate_file': 'build/pushrod-layout/'+out.name, 'changes': []}
try:
    for label in ['Intake','Exhaust']:
        design = study['trains'][label.lower()]['shared_candidate']
        poses = [r for r in contact['poses'] if r['train'] == label]
        rocker = doc.getObject(label+'RockerArm')
        original = App.Placement(rocker.Placement)
        pivot = App.Vector(130,0,-18)
        closed_rotation = App.Rotation(App.Vector(0,1,0), poses[0]['rocker_angle_deg'])
        local_delta = App.Placement(pivot-closed_rotation.multVec(pivot), closed_rotation)
        arm = doc.getObject(label+'ArmSketch')
        for index, constraint in enumerate(arm.Constraints):
            if constraint.Type == 'DistanceX' and constraint.First in [2,3]:
                value = {2:137.5,3:128.5}[constraint.First]
                arm.setExpression(f'Constraints[{index}]',f'{value} mm')
        doc.getObject(label+'PushrodSocket').Placement.Base = App.Vector(133.5,0,-38)
        rocker.Placement = original.multiply(local_delta)
        lower = App.Vector(*design['poses'][0]['follower_ball_mm'])
        upper = rocker.getGlobalPlacement().multVec(App.Vector(133.5,0,-38))
        length = (upper-lower).Length
        assert abs(length-design['pushrod_length_mm']) < 1e-6
        direction = (upper-lower)/length
        rod = doc.getObject(label+'Pushrod')
        rod.Placement = App.Placement(lower,App.Rotation(App.Vector(1,0,0),direction))
        doc.getObject(label+'HollowPushrod').setExpression('Length',f'{length} mm')
        doc.getObject(label+'UpperBall').Placement.Base.x = length
        doc.getObject(label+'PushrodOilPassage').setExpression('Length',f'{length+12} mm')
        tube = doc.getObject(label+'PushrodHousing')
        tube.Placement = rod.Placement
        doc.getObject(label+'HousingTube').setExpression('Length',f'{length-30} mm')
        # Native circular sketches lie normal to the rod's local X axis.
        doc.getObject(label+'UpperHousingBeadSketch').setExpression('Placement.Base.x',f'{length-20} mm')
        for suffix, station in [('Lower',15),('Upper',length-17)]:
            seal = doc.getObject(label+suffix+'PushrodSeal')
            seal.Placement = rod.Placement
            doc.getObject(label+suffix+'SealSketch').setExpression('Placement.Base.x',f'{station} mm')
        # Refresh every existing passage from the same fixed tube datum.
        for target in [doc.CylinderHead,doc.getObject(label+'RockerHousing'),
                       doc.getObject(label+'RockerCover'),doc.getObject(label+'RockerGasket')]:
            sketch = doc.getObject(label+target.Name+'PushrodOpeningSketch')
            inv = target.getGlobalPlacement().inverse()
            sketch.Placement = App.Placement(inv.multVec(lower),
                App.Rotation(App.Vector(0,0,1),inv.Rotation.multVec(direction)))
            doc.getObject(label+target.Name+'PushrodOpening').setExpression('Length',f'{length+5} mm')
        relief = doc.getObject(label+'SocketEntryRelief')
        inv = rocker.getGlobalPlacement().inverse()
        relief.Profile[0].Placement = App.Placement(inv.multVec(lower),
            App.Rotation(App.Vector(0,0,1),inv.Rotation.multVec(direction)))
        relief.setExpression('Length',f'{length} mm')
        doc.recompute()
        # Re-identify the contact edge after upstream web edits.
        rounding = doc.getObject(label+'ContactRounding')
        edges = []
        for index, edge in enumerate(relief.Shape.Edges,1):
            if (len(edge.Vertexes)==2 and abs(edge.Length-12)<1e-6 and
                all(abs(v.Point.x-119.5)<1e-6 and abs(v.Point.z-4)<1e-6 for v in edge.Vertexes)):
                edges.append('Edge'+str(index))
        assert len(edges)==1, (label,edges)
        rounding.Base = (relief,edges)
        doc.recompute()
        # Provide angular entry around the ball seat, centred on the two end poses.
        incoming = []
        for row in [design['poses'][0],design['poses'][-1]]:
            angle = next(p['rocker_angle_deg'] for p in poses if p['lift_mm']==row['lift_mm'])
            rot = original.Rotation.multiply(App.Rotation(App.Vector(0,1,0),angle))
            v = rot.inverted().multVec(App.Vector(*row['follower_ball_mm'])-App.Vector(*row['socket_mm']))
            incoming.append(v/v.Length)
        centre = incoming[0]+incoming[1];centre.normalize()
        cone = rocker.newObject('PartDesign::SubtractiveCone',label+'SocketAngularEntry')
        cone.Radius1=3.6;cone.Radius2=3.6+25*math.tan(math.radians(18));cone.Height=25
        cone.Placement = App.Placement(App.Vector(133.5,0,-38),App.Rotation(App.Vector(0,0,1),centre))
        cone.Refine=True
        note=' Experimental layout: socket offset 3.5 mm from shaft along valve axis; closed pose and dependent tube/openings regenerated; dimensions reconstructed, not manufacturer specifications.'
        for body in [rocker,rod,tube]: body.Evidence += note
        doc.recompute()
        report['changes'].append({'train':label,'closed_rocker_rotation_deg':poses[0]['rocker_angle_deg'],
            'pushrod_length_mm':length,'socket_offset_mm':3.5,'entry_half_angle_deg':18,
            'entry_axis_local':list(centre)})
        print(label,'dependent features rebuilt',flush=True)
    bodies=[b for b in doc.Objects if b.TypeId=='PartDesign::Body']
    invalid=[b.Name for b in bodies if b.Shape.isNull() or not b.Shape.isValid() or len(b.Shape.Solids)!=1]
    if invalid: raise RuntimeError('Invalid candidate solids: '+str(invalid))
    report['valid_single_solid_bodies']=len(bodies)
    doc.saveAs(str(out))
    report['candidate_sha256']=hashlib.sha256(out.read_bytes()).hexdigest()
    (repo/'data/pushrod-candidate.json').write_text(json.dumps(report,indent=2)+'\n')
finally:
    App.closeDocument(doc.Name)
