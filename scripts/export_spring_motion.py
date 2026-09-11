"""Derive screw-sweep spring deformation and compare sampled points to native coils.

Run with FreeCAD Python. Never saves the candidate. Output is not a stress model.
"""
from pathlib import Path
import hashlib,json,math,statistics
import FreeCAD as App
import Part
repo=Path(__file__).resolve().parents[1]
candidate=json.loads((repo/'data/spring-seat-candidate.json').read_text())
source=repo/candidate['candidate_file']
sha=hashlib.sha256(source.read_bytes()).hexdigest();assert sha==candidate['candidate_sha256']
package=repo/'build/pipeline-spring-seat'
manifest=json.loads((package/'cad-manifest.json').read_text())
raw=(package/'geometry.json').read_bytes()
assert hashlib.sha256(raw).hexdigest()==manifest['geometry_sha256']
data=json.loads(raw);assert data['source_sha256']==sha
doc=App.openDocument(str(source))
report={'source_sha256':sha,'geometry_sha256':manifest['geometry_sha256'], 'audit_complete':False,'passed':False,
        'scope':'Screw-sweep presentation deformation against sampled native coil surface points; not load or fatigue validation',
        'springs':{},'checks':[]}
target=repo/'data/spring-motion.json'
def save():target.write_text(json.dumps(report,indent=2)+'\n')
def progress(local,params,sign):
    fraction=(sign*math.atan2(local.z,local.y)/(2*math.pi))%1
    turn=round((local.x-params['start_x_mm'])/params['pitch_mm']-fraction)
    return min(1,max(0,(turn+fraction)/params['turns']))
try:
    doc.recompute();records=[]
    for label in ['Intake','Exhaust']:
        for which in ['Inner','Outer']:
            name=label+which+'Spring';body=doc.getObject(name)
            coil=doc.getObject(label+which+'Coil');sk=doc.getObject(label+which+'WireSketch');wire=sk.Geometry[0]
            assert sk.Placement.isIdentity()
            part=next(p for p in data['parts'] if p['id']==name)
            group=body.getParentGeoFeatureGroup().getGlobalPlacement();bodyframe=body.getGlobalPlacement();inverse=bodyframe.inverse()
            # Spread reference samples throughout the CAD tessellation, retaining endpoints.
            indices=sorted(set([0,len(part['vertices_mm'])-1]+[round(i*(len(part['vertices_mm'])-1)/95) for i in range(96)]))
            local=[inverse.multVec(group.multVec(App.Vector(*part['vertices_mm'][i]))) for i in indices]
            params={'start_x_mm':wire.Center.x,'mean_radius_mm':wire.Center.y,'wire_radius_mm':wire.Radius,
                    'pitch_mm':coil.Pitch.Value,'turns':coil.Height.Value/coil.Pitch.Value,
                    'body_world_translation_mm':list(bodyframe.Base),'body_world_quaternion_xyzw':list(bodyframe.Rotation.Q),
                    'maximum_lift_mm':7,'left_handed':coil.LeftHanded}
            errors={}
            for sign in [-1,1]:
                residuals=[]
                for point in local:
                    t=progress(point,params,sign)
                    residuals.append(abs(math.hypot(point.x-params['start_x_mm']-coil.Height.Value*t,math.hypot(point.y,point.z)-wire.Center.y)-wire.Radius))
                errors[sign]=statistics.median(residuals)
            sign=min(errors,key=errors.get);params['angular_direction']=sign
            params['median_profile_residual_mm']=errors[sign]
            if errors[sign]>1e-4:raise RuntimeError('Cannot identify native spring sweep '+name+': '+str(errors))
            report['springs'][name]=params
            records.append((name,body,coil,bodyframe,local,params))
            coil.setExpression('Height',None);coil.setExpression('Pitch',None)
    for lift in [0,3.5,7]:
        for name,body,coil,frame,points,p in records:
            coil.Height=p['pitch_mm']*p['turns']-lift;coil.Pitch=coil.Height.Value/p['turns']
        print('Recomputing native reference at lift',lift,flush=True);doc.recompute()
        for name,body,coil,frame,points,p in records:
            shape=body.Shape.copy();shape.Placement=body.getParentGeoFeatureGroup().getGlobalPlacement().multiply(shape.Placement)
            maximum=0
            for point in points:
                deformed=App.Vector(point);deformed.x-=lift*progress(point,p,p['angular_direction'])
                distance=shape.distToShape(Part.Vertex(frame.multVec(deformed)))[0]
                maximum=max(maximum,distance)
            row={'id':name,'lift_mm':lift,'sample_count':len(points),'maximum_surface_distance_mm':maximum}
            report['checks'].append(row);save();print(json.dumps(row),flush=True)
            if maximum>1e-4:raise RuntimeError('Spring deformation disagrees with native solid')
    report['audit_complete']=True;report['passed']=True;save()
finally:App.closeDocument(doc.Name)
assert hashlib.sha256(source.read_bytes()).hexdigest()==sha
