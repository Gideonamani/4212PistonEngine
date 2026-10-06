"""Build linked FreeCAD primitive/Boolean feature histories, STEP and tessellation.
Run with FreeCAD's Python; no GUI or additional pip dependencies needed.
"""
import argparse, hashlib, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cad_pipeline.spec import validate_spec, evaluate, freecad_expression, deflection_for
import FreeCAD as A
import Part
import Sketcher
import MeshPart
from cad_pipeline.research_gate import check_spec_research

def place(obj,f,params):
    origin=f.get('origin',[0,0,0]);axis=f.get('axis',[0,0,1])
    obj.Placement=A.Placement(A.Vector(*[evaluate(x,params) for x in origin]),A.Rotation(A.Vector(0,0,1),A.Vector(*axis)))
    for j,c in enumerate('xyz'):obj.setExpression('Placement.Base.'+c,freecad_expression(origin[j]))

def derived_prism(doc,group,prefix,f,params):
    """A prism whose outline comes from a derivation (involute teeth, a seat offset), not a hand-drawn sketch: a direct extruded solid."""
    points=[A.Vector(evaluate(p[0],params),evaluate(p[1],params),0) for p in f['points']]
    solid=Part.Face(Part.makePolygon(points+[points[0]])).extrude(A.Vector(0,0,evaluate(f['height'],params)))
    origin=f.get('origin',[0,0,0]);axis=f.get('axis',[0,0,1])
    solid.Placement=A.Placement(A.Vector(*[evaluate(x,params) for x in origin]),A.Rotation(A.Vector(0,0,1),A.Vector(*axis)))
    o=doc.addObject('Part::Feature',prefix);group.addObject(o);o.Shape=solid;o.Label=f.get('label',prefix);doc.recompute();return o

def rich_feature(doc,group,prefix,f,params):
    if f['primitive']=='prism' and f.get('derived'):return derived_prism(doc,group,prefix,f,params)
    if f['primitive']=='prism':
        sketch=doc.addObject('Sketcher::SketchObject',prefix+'_Profile');group.addObject(sketch)
        points=f['points'];n=len(points)
        for i in range(n):
            p,q=points[i],points[(i+1)%n]
            sketch.addGeometry(Part.LineSegment(A.Vector(evaluate(p[0],params),evaluate(p[1],params),0),A.Vector(evaluate(q[0],params),evaluate(q[1],params),0)),False)
        for i in range(n):
            sketch.addConstraint(Sketcher.Constraint('Coincident',i,2,(i+1)%n,1))
            for j,kind in enumerate(('DistanceX','DistanceY')):
                value=evaluate(points[i][j],params)
                if abs(value)<1e-10:
                    sketch.addConstraint(Sketcher.Constraint('DistanceX' if j==0 else 'DistanceY',i,1,0.0))
                else:
                    k=sketch.addConstraint(Sketcher.Constraint(kind,i,1,value));sketch.setExpression('Constraints['+str(k)+']',freecad_expression(points[i][j]))
        place(sketch,f,params);doc.recompute()
        o=doc.addObject('Part::Extrusion',prefix);group.addObject(o);o.Base=sketch;o.DirMode='Custom';o.Dir=A.Vector(*f.get('axis',[0,0,1]));o.Solid=True
        o.LengthFwd=evaluate(f['height'],params);o.setExpression('LengthFwd',freecad_expression(f['height']));sketch.Visibility=False
    else:
        spine=doc.addObject('Part::Helix',prefix+'_Spine');group.addObject(spine)
        for key,prop in [('radius','Radius'),('pitch','Pitch'),('height','Height')]:setattr(spine,prop,evaluate(f[key],params));spine.setExpression(prop,freecad_expression(f[key]))
        place(spine,f,params)
        circle=doc.addObject('Part::Circle',prefix+'_Wire');group.addObject(circle);circle.Radius=evaluate(f['wire_radius'],params);circle.setExpression('Radius',freecad_expression(f['wire_radius']))
        rotation=spine.Placement.Rotation;v=rotation.multVec(A.Vector(1,0,0));origin=f.get('origin',[0,0,0])
        circle.Placement=A.Placement(spine.Placement.Base+v*evaluate(f['radius'],params),rotation.multiply(A.Rotation(A.Vector(0,0,1),A.Vector(0,1,0))))
        for j,c in enumerate('xyz'):circle.setExpression('Placement.Base.'+c,freecad_expression('('+str(origin[j])+')+('+str(f['radius'])+')*'+str(v[j])))
        doc.recompute();o=doc.addObject('Part::Sweep',prefix);group.addObject(o);o.Sections=[circle];o.Spine=(spine,[]);o.Solid=True;o.Frenet=True
        spine.Visibility=False;circle.Visibility=False
    o.Label=f.get('label',prefix);doc.recompute();return o

def build(spec, output, only=None):
    validate_spec(spec);research=check_spec_research(spec,Path(__file__).resolve().parents[1]); output=Path(output); output.mkdir(parents=True,exist_ok=True)
    for name in ('cad-validation.json','reopen-validation.json'):(output/name).unlink(missing_ok=True)
    doc=A.newDocument('Reconstruction'); params=spec['parameters']; tips=[]; records=[]
    controller=doc.addObject('App::FeaturePython','Parameters')
    for name,p in params.items():
        if p['value'] is None: continue
        controller.addProperty('App::PropertyFloat',name,'Design parameters',p['rationale']+' ['+p['unit']+']')
        setattr(controller,name,p['value'])
        if p['unit'] in ('count','ratio'):controller.setEditorMode(name,1)
    controller.addProperty('App::PropertyString','ProvenanceJSON','Evidence'); controller.ProvenanceJSON=json.dumps(params)
    controller.addProperty('App::PropertyString','SpecificationJSON','Evidence'); controller.SpecificationJSON=json.dumps(spec)
    for part in spec['parts']:
        if only and part['id'] not in only:continue
        print('Building',part['id'],flush=True)
        group=doc.addObject('App::DocumentObjectGroup',part['id']); group.Label=part['label']
        current=None
        for i,f in enumerate(part['features']):
            kind=f['primitive']; prefix=part['id']+'_F'+str(i+1)
            if kind in ('prism','helix'):
                o=rich_feature(doc,group,prefix,f,params)
            else:
                o=basic_feature(doc,group,prefix,f,params)
            doc.recompute()
            if current is None: current=o
            else:
                boolean=doc.addObject('Part::Fuse' if f['operation']=='add' else 'Part::Cut',prefix+'_Result')
                boolean.Base=current; boolean.Tool=o; boolean.Refine=True; group.addObject(boolean)
                current.Visibility=False; o.Visibility=False; current=boolean; doc.recompute()
        current.Label=part['label']; current.Visibility=True
        for key,val in [('StablePartID',part['id']),('Evidence',part['evidence']),('MaterialCategory',part.get('material','steel')),('ComponentGroup',part.get('group','other'))]:
            current.addProperty('App::PropertyString',key,'Reconstruction'); setattr(current,key,val)
        shape=current.Shape
        if shape.isNull() or not shape.isValid() or len(shape.Solids)!=1 or shape.Volume<=0: raise ValueError('Invalid single solid: '+part['id']+'; solids='+str(len(shape.Solids))+'; valid='+str(shape.isValid()))
        tips.append(current); mesh=MeshPart.meshFromShape(Shape=shape,LinearDeflection=deflection_for(spec,part),AngularDeflection=.35,Relative=False);vertices,faces=mesh.Topology
        bb=shape.optimalBoundingBox(False,False)
        records.append(dict(id=part['id'],label=part['label'],group=part.get('group','other'),material=part.get('material','steel'),evidence=part['evidence'],
                            volume_mm3=shape.Volume,bounds_mm=[[bb.XMin,bb.YMin,bb.ZMin],[bb.XMax,bb.YMax,bb.ZMax]],
                            vertices_mm=[list(v) for v in vertices],triangles=faces,feature_count=len(part['features'])))
        print('Built',part['id'],flush=True)
    doc.recompute(); native=output/(spec['model_id']+'.FCStd'); step=output/(spec['model_id']+'.step')
    doc.saveAs(str(native)); Part.export(tips,str(step))
    data=dict(schema_version=1,units='mm',coordinates='FreeCAD XYZ; divide by 1000 once in Blender',bounds_method='optimal_without_triangulation_or_shape_tolerance',model_id=spec['model_id'],scope=spec['scope'],parts=records)
    if spec.get('presentation'):data['presentation']=spec['presentation']
    with (output/'geometry.json').open('w',encoding='utf-8') as stream:json.dump(data,stream,separators=(',',':'))
    report=dict(schema_version=1,model_id=spec['model_id'],geometric_validation_passed=True,historical_accuracy_verified=False,
                freecad_version=A.Version(),bounds_method=data['bounds_method'],part_count=len(tips),complete_spec=not bool(only),feature_count=sum(x['feature_count'] for x in records),research_review=research,
                native_feature_history='Native Part primitives, constrained sketch extrusions, helix sweeps and linked Booleans driven by Parameters expressions',
                spec_sha256=hashlib.sha256(json.dumps(spec,sort_keys=True).encode()).hexdigest(),
                files={p.name:dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in (native,step,output/'geometry.json')},
                parts=[{k:v for k,v in r.items() if k not in ('vertices_mm','triangles')} for r in records])
    (output/'cad-validation.json').write_text(json.dumps(report,indent=2)+'\n'); A.closeDocument(doc.Name)
    return report

def basic_feature(doc,group,prefix,f,params):
            kind=f['primitive']
            o=doc.addObject({'box':'Part::Box','cylinder':'Part::Cylinder','tube':'Part::Cylinder','cone':'Part::Cone','sphere':'Part::Sphere'}[kind],prefix)
            o.Label=f.get('label',prefix); group.addObject(o)
            keys={'box':{'length':'Length','width':'Width','height':'Height'},'cylinder':{'radius':'Radius','height':'Height'},'tube':{'radius':'Radius','height':'Height'},'cone':{'radius1':'Radius1','radius2':'Radius2','height':'Height'},'sphere':{'radius':'Radius'}}[kind]
            for key,prop in keys.items():
                setattr(o,prop,evaluate(f[key],params)); o.setExpression(prop,freecad_expression(f[key]))
            origin=f.get('origin',[0,0,0]); axis=f.get('axis',[0,0,1])
            o.Placement=A.Placement(A.Vector(*[evaluate(x,params) for x in origin]),A.Rotation(A.Vector(0,0,1),A.Vector(*axis)))
            for j,axisname in enumerate('xyz'): o.setExpression('Placement.Base.'+axisname,freecad_expression(origin[j]))
            doc.recompute()
            if kind=='tube':
                inner=doc.addObject('Part::Cylinder',prefix+'_Inner');group.addObject(inner);inner.Placement=o.Placement
                inner.Radius=evaluate(f['inner_radius'],params);inner.Height=evaluate(f['height'],params)
                inner.setExpression('Radius',freecad_expression(f['inner_radius']));inner.setExpression('Height',freecad_expression(f['height']))
                for j,axisname in enumerate('xyz'):inner.setExpression('Placement.Base.'+axisname,freecad_expression(origin[j]))
                shell=doc.addObject('Part::Cut',prefix+'_Tube');shell.Base=o;shell.Tool=inner;shell.Refine=True;group.addObject(shell)
                o.Visibility=False;inner.Visibility=False;o=shell;doc.recompute()
            return o

def main():
    p=argparse.ArgumentParser(); p.add_argument('--spec',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--only',nargs='+',help='Development probe: selected part IDs, never a complete assembly')
    a=p.parse_args(); report=build(json.loads(a.spec.read_text()),a.output,a.only);print(json.dumps({k:report[k] for k in ('model_id','part_count','feature_count','geometric_validation_passed')},indent=2))
if __name__=='__main__':main()
