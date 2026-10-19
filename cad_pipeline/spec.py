"""Dependency-free spec validation and safe arithmetic for CAD parameters."""
import ast
import math
import operator
import re

OPS = {ast.Add:operator.add, ast.Sub:operator.sub, ast.Mult:operator.mul, ast.Div:operator.truediv}
STATUSES = {'specified','measured','inferred','unknown'}
# Fidelity class of a part or feature (cad_pipeline/fidelity.py derives it; docs/fidelity-classes.md). Optional here: the studies keep derived classes beside their spec.
FIDELITY_RANK = {'cosmetic':0,'visual-structure':1,'engineering':2}

def evaluate(value, parameters):
    if isinstance(value, (int,float)) and not isinstance(value,bool):
        result=float(value)
    elif isinstance(value,str):
        def visit(n):
            if isinstance(n,ast.Constant) and type(n.value) in (int,float): return n.value
            if isinstance(n,ast.Name) and n.id in parameters: return parameters[n.id]['value']
            if isinstance(n,ast.BinOp) and type(n.op) in OPS: return OPS[type(n.op)](visit(n.left),visit(n.right))
            if isinstance(n,ast.UnaryOp) and isinstance(n.op,(ast.UAdd,ast.USub)): return visit(n.operand)*(1 if isinstance(n.op,ast.UAdd) else -1)
            raise ValueError('Only numeric constants, parameter names and + - * / are allowed')
        result=float(visit(ast.parse(value,mode='eval').body))
    else: raise ValueError('Expected number or arithmetic expression')
    if not math.isfinite(result): raise ValueError('Nonfinite geometry')
    return result

def validate_spec(spec):
    if spec.get('schema_version') != 1 or spec.get('units') != 'mm': raise ValueError('Spec version 1 uses mm')
    if not spec.get('model_id') or not spec.get('parts') or not spec.get('scope'): raise ValueError('Model identity, scope and parts required')
    if spec.get('input_mode') not in ('image','text','mesh','mixed'): raise ValueError('Invalid input mode')
    sources=spec.get('sources',{}); params=spec.get('parameters',{})
    if not isinstance(sources,dict) or not isinstance(params,dict):raise ValueError('Sources/parameters must be objects')
    for source in sources.values():
        if not isinstance(source,dict) or not any(source.get(key) for key in ('url','path','text')):raise ValueError('Source needs URL, path or request text')
    for name,p in params.items():
        if not re.fullmatch('[A-Za-z][A-Za-z0-9_]*',name): raise ValueError('Unsafe parameter identifier')
        if p.get('status') not in STATUSES or not p.get('rationale'): raise ValueError('Parameter provenance required: '+name)
        if p['status']=='unknown':
            if p.get('value') is not None: raise ValueError('Unknown parameter must be null')
        else: evaluate(p.get('value'),{})
        if not p.get('unit'): raise ValueError('Parameter unit required')
        refs=p.get('source_ids',[])
        if p['status'] in ('measured','specified') and not refs: raise ValueError('Evidence reference required: '+name)
        if any(ref not in sources for ref in refs): raise ValueError('Unresolved evidence reference')
        if p['status']=='measured' and not p.get('method'): raise ValueError('Measurement method required')
    ids=set();prior_parts={}
    for name,p in params.items():
        if 'expression' in p:
            if p['status']=='unknown' or abs(evaluate(p['expression'],params)-p['value'])>1e-8:
                raise ValueError('Derived parameter expression/value mismatch: '+name)
            # Cyclic dependencies cannot produce a stable native controller.
            def dependencies(item,trail):
                if item in trail:raise ValueError('Cyclic parameter expression: '+item)
                expr=params[item].get('expression')
                if expr:
                    for node in ast.walk(ast.parse(expr,mode='eval')):
                        if isinstance(node,ast.Name):dependencies(node.id,trail+[item])
            dependencies(name,[])
    for part in spec['parts']:
        if not re.fullmatch('[A-Za-z][A-Za-z0-9_]*',part['id']) or part['id'] in ids: raise ValueError('Duplicate/unsafe part ID')
        ids.add(part['id'])
        if part.get('geometry_instance_of'):
            master=prior_parts.get(part['geometry_instance_of'])
            if master is None or master.get('geometry_instance_of'):raise ValueError('Geometry instance needs an earlier master part')
            if not part.get('placement') or not master.get('placement'):raise ValueError('Geometry instances require local construction and explicit placements')
            for key in ('features','dressups','boolean_refine','boolean_batch_runs'):
                if part.get(key)!=master.get(key):raise ValueError('Geometry instance differs from master: '+key)
            for key in ('mirror_normal','mirror_base'):
                if part['placement'].get(key)!=master['placement'].get(key):raise ValueError('Geometry instance mirror differs from master')
        prior_parts[part['id']]=part
        if part.get('placement'):
            frame=part['placement'];origin=frame.get('origin',[0,0,0]);axis=frame.get('axis',[0,0,1])
            if len(origin)!=3 or len(axis)!=3 or not any(axis) or not all(math.isfinite(v) for v in axis):raise ValueError('Invalid part placement')
            for v in origin:evaluate(v,params)
            evaluate(frame.get('roll',0),params)
            if 'rotation_quaternion' in frame:
                q=frame['rotation_quaternion']
                if len(q)!=4 or not all(type(v) in (int,float) and math.isfinite(v) for v in q) or abs(sum(v*v for v in q)-1)>1e-8:raise ValueError('Part rotation quaternion must have unit norm')
                if 'axis' in frame or 'roll' in frame:raise ValueError('Declare either quaternion or axis/roll for a part placement')
            if 'mirror_normal' in frame:
                normal=frame['mirror_normal'];base=frame.get('mirror_base',[0,0,0])
                if len(normal)!=3 or not any(normal) or not all(type(v) in (int,float) and math.isfinite(v) for v in normal) or len(base)!=3:raise ValueError('Invalid native mirror plane')
                for v in base:evaluate(v,params)
        if not part.get('label') or not part.get('group') or not part.get('evidence') or not part.get('features'): raise ValueError('Part identity/group/evidence/features required')
        nested=[]
        for f in part['features']:
            nested+=[f]+[f[key] for key in ('pattern_feature','tool_clip') if isinstance(f.get(key),dict)]
        inner=[item['class'] for item in nested+list(part.get('dressups',[])) if 'class' in item]
        for value in ([part['class']] if 'class' in part else [])+inner:
            if value not in FIDELITY_RANK:raise ValueError('Unknown fidelity class on '+part['id']+': '+str(value))
        if 'class' in part and any(FIDELITY_RANK[v]>FIDELITY_RANK[part['class']] for v in inner):raise ValueError('Part class is lower than the class of one of its features: '+part['id'])
        if 'boolean_refine' in part and type(part['boolean_refine']) is not bool:raise ValueError('Boolean refinement policy must be a boolean')
        if 'mesh_refine' in part and type(part['mesh_refine']) is not bool:raise ValueError('Meshing refinement policy must be a boolean')
        if 'boolean_batch_runs' in part and (type(part['boolean_batch_runs']) is not int or part['boolean_batch_runs']<0):raise ValueError('Boolean batching policy must be a nonnegative integer')
        for f in part.get('dressups',[]):
            if f.get('type')!='fillet' or evaluate(f.get('radius'),params)<=0:raise ValueError('Invalid dressup')
            if not f.get('selectors'):raise ValueError('Fillet needs geometric selectors')
            for selector in f['selectors']:
                if selector.get('curve')!='circle' or len(selector.get('center',[]))!=3:raise ValueError('Fillet selector needs a circular centre')
                for v in selector['center']:evaluate(v,params)
                if evaluate(selector.get('radius'),params)<=0:raise ValueError('Invalid selector radius')
                if not 0<selector.get('arc_fraction',1.)<=1:raise ValueError('Invalid circle arc fraction')
                axis=selector.get('axis',[0,0,1])
                if len(axis)!=3 or not any(axis) or not all(math.isfinite(v) for v in axis):raise ValueError('Invalid selector axis')
        features=list(part['features'])
        for pattern in part['features']:
            if pattern.get('primitive')=='polar_pattern':
                if pattern.get('tool_clip'):
                    if pattern['operation']!='cut' or pattern['tool_clip'].get('primitive') not in ['box','cylinder','tube','cone','sphere']:raise ValueError('Pattern tool clips require a subtractive pattern and basic solid')
                    features.append(pattern['tool_clip'])
                if type(pattern.get('count')) is not int or not 2<=pattern['count']<=360:raise ValueError('Polar pattern count must be an integer2..360')
                step=pattern.get('step_degrees',360/pattern['count'])
                if type(step) not in (int,float) or not math.isfinite(step) or step<=0 or step*(pattern['count']-1)>=360:raise ValueError('Pattern step must be a fixed positive angle without duplicated turns')
                child=pattern.get('pattern_feature',{})
                if child.get('primitive') not in ('box','cylinder','tube','cone','sphere','prism','revolve','loft'):raise ValueError('Unsupported polar pattern tool')
                features.append(child)
        for f in features:
            if 'linked_profile' in f and (f.get('primitive')!='prism' or not f.get('derived') or type(f['linked_profile']) is not bool):
                raise ValueError('Linked profile requires a derived prism and a boolean option')
            if f.get('primitive') not in ('box','cylinder','tube','cone','sphere','prism','helix','revolve','loft','polar_pattern'): raise ValueError('Unsupported primitive')
            if f.get('operation') not in ('add','cut'): raise ValueError('Unsupported operation')
            if f is part['features'][0] and f['operation'] != 'add': raise ValueError('First feature must add material')
            for key in {'box':['length','width','height'],'cylinder':['radius','height'],'tube':['radius','inner_radius','height'],'cone':['radius1','radius2','height'],'sphere':['radius'],'prism':['height'],'helix':['radius','wire_radius','pitch','height'],'revolve':[],'loft':[],'polar_pattern':[]}[f['primitive']]:
                v=evaluate(f[key],params)
                if v<0 or (v==0 and not key.startswith('radius')): raise ValueError('Invalid primitive size')
                if v==0 and f['primitive']!='cone': raise ValueError('Zero radius')
            if f['primitive']=='tube' and not 0<evaluate(f['inner_radius'],params)<evaluate(f['radius'],params):raise ValueError('Tube bore must be smaller than outer radius')
            if f['primitive']=='helix' and not (2*evaluate(f['wire_radius'],params)<evaluate(f['pitch'],params) and evaluate(f['wire_radius'],params)<evaluate(f['radius'],params)):raise ValueError('Helix wire intersects adjacent turns/axis')
            if 'left_handed' in f and (f['primitive']!='helix' or type(f['left_handed']) is not bool):raise ValueError('Helix handedness must be a boolean')
            if f['primitive']=='prism':
                if len(f.get('points',[]))<3:raise ValueError('Prism needs at least three planar points')
                for point in f['points']:
                    if len(point)!=2:raise ValueError('Prism point must be XY')
                    for v in point:evaluate(v,params)
            if f['primitive']=='revolve':
                if len(f.get('points',[]))<3:raise ValueError('Revolve needs at least three profile points')
                for point in f['points']:
                    if len(point)!=2:raise ValueError('Revolve point must be (radius, axial position)')
                    if evaluate(point[0],params)<0:raise ValueError('Revolve radius must not be negative')
                angle=evaluate(f.get('angle',360),params)
                if not 0<angle<=360:raise ValueError('Revolve angle must be in (0, 360]')
            if f['primitive']=='loft':
                if 'bilinear_patches' in f:raise ValueError('Degree-one merged patches failed full-cutter Booleans; experimental probe only')
                sections=f.get('sections',[])
                if len(sections)<2 or len(sections[0])<3:raise ValueError('Loft needs at least two closed polygon sections')
                count=len(sections[0])
                for section in sections:
                    if len(section)!=count:raise ValueError('Loft sections need corresponding vertices')
                    for point in section:
                        if len(point)!=3:raise ValueError('Loft section points must be XYZ')
                        for v in point:evaluate(v,params)
                if 'profile_spline_runs' in f:
                    from cad_pipeline.sampled_loft import unit_sections
                    unit_sections(f,params)
            if len(f.get('origin',[0,0,0]))!=3: raise ValueError('XYZ origin required')
            for v in f.get('origin',[0,0,0]): evaluate(v,params)
            evaluate(f.get('roll',0),params)
            axis=f.get('axis',[0,0,1])
            if len(axis)!=3 or not any(axis) or not all(math.isfinite(v) for v in axis): raise ValueError('Invalid axis')
    return spec

def deflection_for(spec, part, default=.7):
    """Linear tessellation deflection (mm) for a part: spec['tessellation'] may set a default and finer values per group.

    Large tight-fitting cylinders (a piston in its liner) need a finer mesh than the 0.7 mm default, or two touching surfaces
    tessellate into slivers that overlap.
    """
    setting = spec.get('tessellation', {})
    return setting.get('groups', {}).get(part.get('group', 'other'), setting.get('default_mm', default))


def freecad_expression(value):
    if not isinstance(value,str): return str(value)
    return re.sub(r'\b([A-Za-z][A-Za-z0-9_]*)\b',r'Parameters.\1',value)
