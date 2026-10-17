"""Build linked FreeCAD primitive/Boolean feature histories, STEP and tessellation.
Run with FreeCAD's Python; no GUI or additional pip dependencies needed.
"""
import argparse, hashlib, json, sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cad_pipeline.spec import validate_spec, evaluate, freecad_expression, deflection_for
from cad_pipeline.meshing import tessellation_shape
import FreeCAD as A
import Part
import Sketcher
import MeshPart
from cad_pipeline.research_gate import check_spec_research

def feature_rotation(f,params):
    """Rotation of a feature: local Z onto its axis by the shortest arc, then `roll` degrees about that axis (orients boxes and prisms)."""
    if 'rotation_quaternion' in f:return A.Rotation(*f['rotation_quaternion'])
    rotation=A.Rotation(A.Vector(0,0,1),A.Vector(*f.get('axis',[0,0,1])));roll=evaluate(f.get('roll',0),params)
    return rotation.multiply(A.Rotation(A.Vector(0,0,1),roll)) if roll else rotation

def place(obj,f,params):
    origin=f.get('origin',[0,0,0]);axis=f.get('axis',[0,0,1])
    obj.Placement=A.Placement(A.Vector(*[evaluate(x,params) for x in origin]),feature_rotation(f,params))
    for j,c in enumerate('xyz'):obj.setExpression('Placement.Base.'+c,freecad_expression(origin[j]))

def derived_prism(doc,group,prefix,f,params):
    """A prism whose outline comes from a derivation (involute teeth, a seat offset), not a hand-drawn sketch: a direct extruded solid."""
    points=[A.Vector(evaluate(p[0],params),evaluate(p[1],params),0) for p in f['points']]
    if f.get('linked_profile'):
        wire=doc.addObject('Part::Polygon',prefix+'_Profile');group.addObject(wire)
        wire.Nodes=points;wire.Close=True
        vectors=['vector('+freecad_expression(p[0])+';'+freecad_expression(p[1])+';0)' for p in f['points']]
        wire.setExpression('Nodes','list('+ ';'.join(vectors)+')')
        place(wire,f,params)
        o=doc.addObject('Part::Extrusion',prefix);group.addObject(o);o.Base=wire;o.DirMode='Custom'
        o.Dir=feature_rotation(f,params).multVec(A.Vector(0,0,1));o.Solid=True
        o.LengthFwd=evaluate(f['height'],params);o.setExpression('LengthFwd',freecad_expression(f['height']))
        wire.Visibility=False;o.Label=f.get('label',prefix);doc.recompute();return o
    solid=Part.Face(Part.makePolygon(points+[points[0]])).extrude(A.Vector(0,0,evaluate(f['height'],params)))
    origin=f.get('origin',[0,0,0]);axis=f.get('axis',[0,0,1])
    solid.Placement=A.Placement(A.Vector(*[evaluate(x,params) for x in origin]),feature_rotation(f,params))
    o=doc.addObject('Part::Feature',prefix);group.addObject(o);o.Shape=solid;o.Label=f.get('label',prefix);doc.recompute();return o

def derived_revolve(doc,group,prefix,f,params):
    """A solid of revolution about the feature's local Z axis from a (radius, axial position) profile: a direct solid, like a derived prism."""
    points=[A.Vector(evaluate(p[0],params),0,evaluate(p[1],params)) for p in f['points']]
    solid=Part.Face(Part.makePolygon(points+[points[0]])).revolve(A.Vector(0,0,0),A.Vector(0,0,1),evaluate(f.get('angle',360),params))
    origin=f.get('origin',[0,0,0]);axis=f.get('axis',[0,0,1])
    solid.Placement=A.Placement(A.Vector(*[evaluate(x,params) for x in origin]),feature_rotation(f,params))
    o=doc.addObject('Part::Feature',prefix);group.addObject(o);o.Shape=solid;o.Label=f.get('label',prefix);doc.recompute();return o

def rich_feature(doc,group,prefix,f,params):
    if f['primitive']=='polar_pattern':
        child=f['pattern_feature']
        builder=rich_feature if child['primitive'] in ('prism','loft','revolve','helix','polar_pattern') else basic_feature
        master=builder(doc,group,prefix+'_Master',child,params);master.Visibility=False
        if f.get('tool_clip'):
            clip=basic_feature(doc,group,prefix+'_Clip',f['tool_clip'],params)
            limited=doc.addObject('Part::Common',prefix+'_LimitedMaster');group.addObject(limited)
            limited.Base=master;limited.Tool=clip;limited.Refine=True
            master.Visibility=False;clip.Visibility=False;doc.recompute();master=limited;master.Visibility=False
        copies=[]
        step=f.get('step_degrees',360/f['count'])
        for index in range(f['count']):
            copy=doc.addObject('Part::Compound',prefix+'_Copy'+str(index+1));group.addObject(copy)
            copy.Links=[master];copy.Placement=A.Placement(A.Vector(),A.Rotation(A.Vector(0,0,1),step*index))
            copy.Visibility=False;copies.append(copy)
        o=doc.addObject('Part::Compound',prefix);group.addObject(o);o.Links=copies
        place(o,f,params);o.Label=f.get('label',prefix);doc.recompute();return o
    if f['primitive']=='loft':
        if 'profile_spline_runs' in f:
            from cad_pipeline.sampled_loft import unit_sections,make_solid
            sections=unit_sections(f,params)
            master=doc.addObject('Part::Feature',prefix+'_UnitMaster');group.addObject(master)
            master.Shape=make_solid(sections,f['profile_spline_runs'],f.get('profile_parameterization','chord_length'),f.get('profile_curve_mode','interpolate'),f.get('profile_curve_degree',5));master.Visibility=False
            master.addProperty('App::PropertyString','ConstructionMethod','Reconstruction')
            master.ConstructionMethod='Derived sampled-profile '+f.get('profile_curve_mode','interpolate')+'; a geometric approximation requiring its recorded deviation and mesh checks. Uniform scale remains live; section/topology edits require regeneration.'
            scaled=doc.addObject('App::Link',prefix+'_Scale');group.addObject(scaled);scaled.setLink(master)
            scaled.Scale=evaluate(f['scale_parameter'],params);scaled.setExpression('Scale',freecad_expression(f['scale_parameter']))
            scaled.Visibility=False
            # Part.export filters bare App::Link tips; the linked Compound is
            # a native Part feature and survives the STEP export path.
            o=doc.addObject('Part::Compound',prefix);group.addObject(o);o.Links=[scaled]
            place(o,f,params);o.Label=f.get('label',prefix);doc.recompute();return o
        sections=[]
        for index,points in enumerate(f['sections']):
            wire=doc.addObject('Part::Polygon',prefix+'_Section'+str(index));group.addObject(wire)
            wire.Nodes=[A.Vector(*[evaluate(v,params) for v in point]) for point in points];wire.Close=True
            # Whole-vector-list expressions propagate correctly; indexed Nodes[n].z
            # expressions can be stored without updating the polygon in FreeCAD 1.1.
            vectors=['vector('+ ';'.join(freecad_expression(v) for v in point)+')' for point in points]
            wire.setExpression('Nodes','list('+ ';'.join(vectors)+')')
            wire.Visibility=False;sections.append(wire)
        o=doc.addObject('Part::Loft',prefix);group.addObject(o);o.Sections=sections;o.Solid=True;o.Ruled=True
        place(o,f,params);o.Label=f.get('label',prefix);doc.recompute();return o
    if f['primitive']=='revolve':return derived_revolve(doc,group,prefix,f,params)
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
        spine.LocalCoord='Left-handed' if f.get('left_handed',False) else 'Right-handed'
        for key,prop in [('radius','Radius'),('pitch','Pitch'),('height','Height')]:setattr(spine,prop,evaluate(f[key],params));spine.setExpression(prop,freecad_expression(f[key]))
        place(spine,f,params)
        circle=doc.addObject('Part::Circle',prefix+'_Wire');group.addObject(circle);circle.Radius=evaluate(f['wire_radius'],params);circle.setExpression('Radius',freecad_expression(f['wire_radius']))
        rotation=spine.Placement.Rotation;v=rotation.multVec(A.Vector(1,0,0));origin=f.get('origin',[0,0,0])
        circle.Placement=A.Placement(spine.Placement.Base+v*evaluate(f['radius'],params),rotation.multiply(A.Rotation(A.Vector(0,0,1),A.Vector(0,1,0))))
        for j,c in enumerate('xyz'):circle.setExpression('Placement.Base.'+c,freecad_expression('('+str(origin[j])+')+('+str(f['radius'])+')*'+str(v[j])))
        doc.recompute();o=doc.addObject('Part::Sweep',prefix);group.addObject(o);o.Sections=[circle];o.Spine=(spine,[]);o.Solid=True;o.Frenet=True
        spine.Visibility=False;circle.Visibility=False
    o.Label=f.get('label',prefix);doc.recompute();return o

def feature_runs(features,batch_runs=0):
    """Legacy runs, optionally bounded by an explicit construction group."""
    from cad_pipeline.boolean_runs import feature_runs as runs
    return runs(features,batch_runs)

def single_valid_solid(shape):
    return not shape.isNull() and shape.isValid() and len(shape.Solids)==1 and shape.Volume>0

def remove_part(doc,group):
    # PartDesign Bodies own their BaseFeature and dressups. Removing the Body
    # alone leaves those objects (including an identified old tip) in the document.
    owned=[];seen=set()
    def collect(obj):
        if obj.Name in seen:return
        seen.add(obj.Name)
        for child in getattr(obj,'Group',[]):collect(child)
        owned.append(obj.Name)
    for obj in group.Group:collect(obj)
    for name in owned:doc.removeObject(name)
    doc.removeObject(group.Name)

def identify_part(current,part):
    # Identity strings and display metadata must not re-execute a completed
    # expensive Boolean. Preserve genuine pending dimension changes and custom
    # proxies; a later parameter edit still marks this live history dirty.
    evaluated=(hasattr(current,'Shape') and not current.Shape.isNull()
               and not any(s in ('Touched','Invalid','Error') for s in current.State)
               and getattr(current,'Proxy',None) is None)
    current.Label=part['label'];current.Visibility=True
    for key,val in [('StablePartID',part['id']),('Evidence',part['evidence']),('MaterialCategory',part.get('material','steel')),('ComponentGroup',part.get('group','other'))]:
        current.addProperty('App::PropertyString',key,'Reconstruction');setattr(current,key,val)
    if evaluated:current.purgeTouched()

def build_instance(doc,part,params,master):
    """Place the master's linked local solid; never re-use its assembly transform."""
    if master.TypeId!='Part::Compound' or len(master.Links)!=1:raise ValueError('Instance master has no linked local solid')
    group=doc.addObject('App::DocumentObjectGroup',part['id']);group.Label=part['label']
    current=doc.addObject('Part::Compound',part['id']+'_Placed');group.addObject(current)
    current.Links=[master.Links[0]];place(current,part['placement'],params);doc.recompute()
    identify_part(current,part)
    current.addProperty('App::PropertyString','GeometryMasterID','Reconstruction');current.GeometryMasterID=part['geometry_instance_of']
    if not single_valid_solid(current.Shape):raise ValueError('Invalid native geometry instance: '+part['id'])
    return group,current

def build_part(doc,part,params,batch_runs,force_sequential=False):
    """Native feature history of one part; returns (group, tip). The tip carries the part's identity properties."""
    batch_runs=0 if force_sequential else part.get('boolean_batch_runs',batch_runs)
    group=doc.addObject('App::DocumentObjectGroup',part['id']); group.Label=part['label']
    current=None
    for run in feature_runs(part['features'],batch_runs):
        if part.get('trace_boolean_runs'):print('NATIVE_RUN_BEGIN',part['id'],run[0]+1,run[-1]+1,flush=True)
        objs=[]
        for i in run:
            f=part['features'][i]; kind=f['primitive']; prefix=part['id']+'_F'+str(i+1)
            if kind=='polar_pattern':print('NATIVE_PATTERN_BEGIN',part['id'],f['count'],'copies',flush=True)
            objs.append(rich_feature(doc,group,prefix,f,params) if kind in ('prism','helix','revolve','loft','polar_pattern') else basic_feature(doc,group,prefix,f,params))
            doc.recompute()
        if len(objs)>1:                         # a long run of one operation (a casting's seat cuts): fuse the tools once, apply them in one Boolean
            tool=doc.addObject('Part::MultiFuse',part['id']+'_F'+str(run[0]+1)+'_to_F'+str(run[-1]+1)+'_Tools'); tool.Shapes=objs; tool.Refine=False; group.addObject(tool)
            for o in objs: o.Visibility=False
            doc.recompute(); o=tool
        else: o=objs[0]
        f=part['features'][run[0]]; prefix=part['id']+'_F'+str(run[-1]+1)
        if current is None: current=o
        else:
            if f['primitive']=='polar_pattern':print('NATIVE_PATTERN_BOOLEAN',part['id'],flush=True)
            boolean=doc.addObject('Part::Fuse' if f['operation']=='add' else 'Part::Cut',prefix+'_Result')
            boolean.Base=current; boolean.Tool=o; boolean.Refine=part.get('boolean_refine',True); group.addObject(boolean)
            current.Visibility=False; o.Visibility=False; current=boolean; doc.recompute()
            if f['primitive']=='polar_pattern':print('NATIVE_PATTERN_END',part['id'],flush=True)
        if part.get('trace_boolean_runs'):print('NATIVE_RUN_END',part['id'],run[-1]+1,'null',current.Shape.isNull(),flush=True)
        if len(part['features'])>=50 and (run[-1]+1)%20==0:
            print('  Native features',part['id'],run[-1]+1,'/',len(part['features']),flush=True)
    if part.get('dressups'):
        from cad_pipeline.dressups import circle_edges
        body=doc.addObject('PartDesign::Body',part['id']+'_DressupBody');group.addObject(body)
        body.BaseFeature=current;doc.recompute();current.Visibility=False;current=body.Tip
        for i,f in enumerate(part['dressups'],1):
            indices,selection=circle_edges(current.Shape,f['selectors'],params)
            fillet=doc.addObject('PartDesign::Fillet',part['id']+'_Fillet'+str(i));body.addObject(fillet)
            fillet.Base=(current,['Edge'+str(index) for index in indices]);fillet.Refine=False
            fillet.Radius=evaluate(f['radius'],params);fillet.setExpression('Radius',freecad_expression(f['radius']))
            fillet.Label=f.get('label',fillet.Name)
            fillet.addProperty('App::PropertyString','GeometricSelectionJSON','Reconstruction');fillet.GeometricSelectionJSON=json.dumps(selection)
            current.Visibility=False;doc.recompute();current=fillet
            if not single_valid_solid(current.Shape):raise ValueError('Invalid native fillet: '+part['id'])
        body.Tip=current
    if part.get('placement'):
        frame=part['placement']
        if 'mirror_normal' in frame:
            mirror=doc.addObject('Part::Mirroring',part['id']+'_Mirror');group.addObject(mirror)
            mirror.Source=current;mirror.Normal=A.Vector(*frame['mirror_normal'])
            base=frame.get('mirror_base',[0,0,0]);mirror.Base=A.Vector(*[evaluate(v,params) for v in base])
            for i,c in enumerate('xyz'):mirror.setExpression('Base.'+c,freecad_expression(base[i]))
            current.Visibility=False;doc.recompute();current=mirror
        # One already validated solid, linked through a placed native compound.
        # Evaluate the Boolean construction locally, then place the result once.
        placed=doc.addObject('Part::Compound',part['id']+'_Placed');group.addObject(placed)
        placed.Links=[current];place(placed,part['placement'],params)
        current.Visibility=False;doc.recompute();current=placed
    identify_part(current,part)
    if not single_valid_solid(current.Shape): raise ValueError('Invalid single solid: '+part['id']+'; null='+str(current.Shape.isNull())+'; solids='+str(len(current.Shape.Solids)))
    return group,current

def build(spec, output, only=None, batch_runs=0):
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
    for name,p in params.items():
        if p.get('expression'):controller.setExpression(name,freecad_expression(p['expression']))
    doc.recompute()
    built={}
    for part in spec['parts']:
        if only and part['id'] not in only:continue
        print('Building',part['id'],flush=True)
        if part.get('geometry_instance_of'):
            if part['geometry_instance_of'] not in built:raise ValueError('Selected instance requires its master')
            result=build_instance(doc,part,params,built[part['geometry_instance_of']][2])
        else:result=build_part(doc,part,params,batch_runs)
        built[part['id']]=(part,)+result
        print('Built',part['id'],flush=True)
    # The tips are touched by their new properties: this recompute is the state that gets saved, so it is the state that is validated and meshed.
    doc.recompute()
    for pid,(part,group,current) in list(built.items()):
        if not single_valid_solid(current.Shape):
            if not batch_runs: raise ValueError('Invalid single solid after recompute: '+pid)
            print('Rebuilding',pid,'with one Boolean per feature: the batched result did not survive a recompute',flush=True)
            if part.get('geometry_instance_of'):raise ValueError('Invalid shared native geometry instance: '+pid)
            remove_part(doc,group); group,current=build_part(doc,part,params,0,force_sequential=True);built[pid]=(part,group,current)
            for dependent,_,tip in list(built.values()):
                if dependent.get('geometry_instance_of')==pid:tip.Links=[current.Links[0]]
            doc.recompute()
            if not single_valid_solid(current.Shape): raise ValueError('Invalid single solid after recompute: '+pid)
    for part in spec['parts']:
        if part['id'] not in built:continue
        current=built[part['id']][2]; shape=current.Shape
        tips.append(current); mesh=MeshPart.meshFromShape(Shape=tessellation_shape(shape,part),LinearDeflection=deflection_for(spec,part),AngularDeflection=.35,Relative=False);vertices,faces=mesh.Topology
        bb=shape.optimalBoundingBox(False,False)
        records.append(dict(id=part['id'],label=part['label'],group=part.get('group','other'),material=part.get('material','steel'),evidence=part['evidence'],
                            volume_mm3=shape.Volume,bounds_mm=[[bb.XMin,bb.YMin,bb.ZMin],[bb.XMax,bb.YMax,bb.ZMax]],
                            vertices_mm=[list(v) for v in vertices],triangles=faces,feature_count=1 if part.get('geometry_instance_of') else len(part['features'])+len(part.get('dressups',[]))+bool(part.get('placement'))+bool(part.get('placement',{}).get('mirror_normal')),
                            geometry_master_id=part.get('geometry_instance_of')))
    native=output/(spec['model_id']+'.FCStd'); step=output/(spec['model_id']+'.step')
    doc.saveAs(str(native)); Part.export(tips,str(step))
    data=dict(schema_version=1,units='mm',coordinates='FreeCAD XYZ; divide by 1000 once in Blender',bounds_method='optimal_without_triangulation_or_shape_tolerance',model_id=spec['model_id'],scope=spec['scope'],parts=records)
    if spec.get('presentation'):data['presentation']=spec['presentation']
    with (output/'geometry.json').open('w',encoding='utf-8') as stream:json.dump(data,stream,separators=(',',':'))
    report=dict(schema_version=1,model_id=spec['model_id'],geometric_validation_passed=True,historical_accuracy_verified=False,
                freecad_version=A.Version(),bounds_method=data['bounds_method'],part_count=len(tips),complete_spec=not bool(only),feature_count=sum(x['feature_count'] for x in records),research_review=research,
                native_feature_history='Native Part primitives, constrained sketch extrusions, linked polygon-section ruled lofts, helix sweeps and linked Booleans driven by Parameters expressions; optional derived interpolated-profile solids with native uniform-scale links; optional radius-driven PartDesign fillets in a Body linked through BaseFeature'+('; runs of '+str(batch_runs)+' or more consecutive same-operation features are fused into one tool and applied in a single Boolean' if batch_runs else ''),
                batched_boolean_runs=batch_runs,
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
            o.Placement=A.Placement(A.Vector(*[evaluate(x,params) for x in origin]),feature_rotation(f,params))
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
    p=argparse.ArgumentParser(); p.add_argument('--spec',type=Path,required=True);p.add_argument('--output',type=Path,required=True);p.add_argument('--only',nargs='+',help='Development probe: selected part IDs, never a complete assembly');p.add_argument('--batch-runs',type=int,default=0,help='Apply runs of at least this many consecutive same-operation features in one Boolean (a casting with hundreds of seat cuts); 0 keeps one Boolean per feature, which update_native.py expects')
    a=p.parse_args(); report=build(json.loads(a.spec.read_text()),a.output,a.only,a.batch_runs);print(json.dumps({k:report[k] for k in ('model_id','part_count','feature_count','geometric_validation_passed')},indent=2))
if __name__=='__main__':main()
