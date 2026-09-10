"""Size reconstructed oval cavities from the sampled rocker sweep, preserving wall thickness."""
from pathlib import Path
import hashlib,json,math
import FreeCAD as App

repo=Path(__file__).resolve().parents[1]
parent=json.loads((repo/'data/pushrod-candidate.json').read_text())
frames=json.loads((repo/'data/pushrod-frames.json').read_text())
audit=json.loads((repo/'data/pushrod-candidate-contact.json').read_text())
source=repo/parent['candidate_file']
assert hashlib.sha256(source.read_bytes()).hexdigest()==parent['candidate_sha256']==frames['source_sha256']==audit['source_sha256']
doc=App.openDocument(str(source))
out=repo/'build/housing-clearance/GTSIO520_Housing_Candidate.FCStd'
out.parent.mkdir(parents=True,exist_ok=True)
report={'status':'Experimental; sampled solid audit pending','parent_sha256':parent['candidate_sha256'],
        'joint_frame_source_sha256':frames['source_sha256'],'candidate_file':'build/housing-clearance/'+out.name,
        'method':'Tessellated rocker sweep in housing frame; derive oval half-spacing, add 1 mm and round up to 0.5 mm',
        'tessellation_tolerance_mm':0.05,'reconstructed_clearance_allowance_mm':1,'trains':{}}
try:
    for label in ['Intake','Exhaust']:
        rocker=doc.getObject(label+'RockerArm');housing=doc.getObject(label+'RockerHousing')
        frame=frames['trains'][label.lower()]
        pivot=App.Vector(*frame['rocker_pivot_mm']);axis=App.Vector(*frame['rocker_axis'])
        shape=rocker.Shape.copy()
        shape.Placement=rocker.getParentGeoFeatureGroup().getGlobalPlacement().multiply(shape.Placement)
        vertices,_=shape.tessellate(.05)
        inverse=housing.getGlobalPlacement().inverse()
        required=0.;worst=None
        for row in [r for r in audit['poses'] if r['train']==label]:
            rot=App.Rotation(axis,row['rocker_angle_deg'])
            delta=App.Placement(pivot-rot.multVec(pivot),rot)
            for point in vertices:
                v=inverse.multVec(delta.multVec(point))
                if abs(v.y)>=22:raise RuntimeError('Rocker exceeds fixed transverse cavity radius')
                half=abs(v.z)-math.sqrt(22**2-v.y**2)
                if half>required:required=half;worst={'lift_mm':row['lift_mm'],'point_housing_local_mm':list(v)}
        half=math.ceil((required+1)*2)/2
        report['trains'][label.lower()]={'minimum_sampled_half_spacing_mm':required,'selected_half_spacing_mm':half,'worst_sample':worst}
        print(label,'required half spacing',required,'selected',half,flush=True)
        for prefix in ['HousingOuter','HousingCavity','GasketOuter','GasketInner','CoverOuter','CoverInside']:
            for suffix,sign in [('EndA',-1),('EndB',1)]:
                sketch=doc.getObject(label+prefix+suffix+'Sketch')
                for index,c in enumerate(sketch.Constraints):
                    if c.Type=='DistanceX':sketch.setExpression(f'Constraints[{index}]',f'{sign*half} mm')
            sketch=doc.getObject(label+prefix+'BridgeSketch')
            for index,c in enumerate(sketch.Constraints):
                if c.Type=='DistanceX':
                    sign=-1 if c.First in [0,3] else 1
                    sketch.setExpression(f'Constraints[{index}]',f'{sign*half} mm')
        for suffix in ['RockerHousing','RockerGasket','RockerCover']:
            doc.getObject(label+suffix).Evidence += f' Experimental oval half-spacing {half} mm derived from sampled rocker sweep plus reconstructed 1 mm allowance; original radial wall thickness retained; not a manufacturer dimension.'
    doc.recompute()
    bodies=[b for b in doc.Objects if b.TypeId=='PartDesign::Body']
    invalid=[b.Name for b in bodies if b.Shape.isNull() or not b.Shape.isValid() or len(b.Shape.Solids)!=1]
    if invalid:raise RuntimeError(str(invalid))
    report['valid_single_solid_bodies']=len(bodies)
    report['unconstrained_sketches']=[s.Name for s in doc.Objects if s.TypeId=='Sketcher::SketchObject' and not s.FullyConstrained]
    doc.saveAs(str(out))
    report['candidate_sha256']=hashlib.sha256(out.read_bytes()).hexdigest()
    (repo/'data/housing-candidate.json').write_text(json.dumps(report,indent=2)+'\n')
finally:App.closeDocument(doc.Name)
