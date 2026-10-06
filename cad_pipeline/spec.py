"""Dependency-free spec validation and safe arithmetic for CAD parameters."""
import ast
import math
import operator
import re

OPS = {ast.Add:operator.add, ast.Sub:operator.sub, ast.Mult:operator.mul, ast.Div:operator.truediv}
STATUSES = {'specified','measured','inferred','unknown'}

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
    ids=set()
    for part in spec['parts']:
        if not re.fullmatch('[A-Za-z][A-Za-z0-9_]*',part['id']) or part['id'] in ids: raise ValueError('Duplicate/unsafe part ID')
        ids.add(part['id'])
        if not part.get('label') or not part.get('group') or not part.get('evidence') or not part.get('features'): raise ValueError('Part identity/group/evidence/features required')
        for f in part['features']:
            if f.get('primitive') not in ('box','cylinder','tube','cone','sphere','prism','helix'): raise ValueError('Unsupported primitive')
            if f.get('operation') not in ('add','cut'): raise ValueError('Unsupported operation')
            if f is part['features'][0] and f['operation'] != 'add': raise ValueError('First feature must add material')
            for key in {'box':['length','width','height'],'cylinder':['radius','height'],'tube':['radius','inner_radius','height'],'cone':['radius1','radius2','height'],'sphere':['radius'],'prism':['height'],'helix':['radius','wire_radius','pitch','height']}[f['primitive']]:
                v=evaluate(f[key],params)
                if v<0 or (v==0 and not key.startswith('radius')): raise ValueError('Invalid primitive size')
                if v==0 and f['primitive']!='cone': raise ValueError('Zero radius')
            if f['primitive']=='tube' and not 0<evaluate(f['inner_radius'],params)<evaluate(f['radius'],params):raise ValueError('Tube bore must be smaller than outer radius')
            if f['primitive']=='helix' and not (2*evaluate(f['wire_radius'],params)<evaluate(f['pitch'],params) and evaluate(f['wire_radius'],params)<evaluate(f['radius'],params)):raise ValueError('Helix wire intersects adjacent turns/axis')
            if f['primitive']=='prism':
                if len(f.get('points',[]))<3:raise ValueError('Prism needs at least three planar points')
                for point in f['points']:
                    if len(point)!=2:raise ValueError('Prism point must be XY')
                    for v in point:evaluate(v,params)
            if len(f.get('origin',[0,0,0]))!=3: raise ValueError('XYZ origin required')
            for v in f.get('origin',[0,0,0]): evaluate(v,params)
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
