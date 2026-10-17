"""Rejected degree-one patch candidate and a reusable coordinate normalizer.

Each original quadrilateral remains a bilinear knot span. Grouping spans in
one face reduces topology; it does not fit or smooth their original geometry.
The small fixture passed but the complete cutter's coincident Booleans failed.
The production spec rejects bilinear_patches. Only unit_sections' arithmetic
normalizer is reused by the independently checked smooth-profile candidate.
"""
import ast
from cad_pipeline.spec import evaluate


def unit_sections(feature,parameters):
    name=feature.get('scale_parameter')
    if name not in parameters or evaluate(name,parameters)<=0:
        raise ValueError('Bilinear loft needs one positive scale parameter')
    def linear(node):
        if isinstance(node,ast.Constant) and type(node.value) in (int,float):return 0.,float(node.value)
        if isinstance(node,ast.Name) and node.id==name:return 1.,0.
        if isinstance(node,ast.UnaryOp) and isinstance(node.op,(ast.UAdd,ast.USub)):
            a,b=linear(node.operand);sign=-1 if isinstance(node.op,ast.USub) else 1
            return sign*a,sign*b
        if isinstance(node,ast.BinOp):
            a,b=linear(node.left);c,d=linear(node.right)
            if isinstance(node.op,ast.Add):return a+c,b+d
            if isinstance(node.op,ast.Sub):return a-c,b-d
            if isinstance(node.op,ast.Mult) and not (a and c):return a*d+b*c,b*d
            if isinstance(node.op,ast.Div) and not c and d:return a/d,b/d
        raise ValueError('Sampled coordinates require linear arithmetic in one scale')
    result=[]
    for row in feature['sections']:
        section=[]
        for point in row:
            values=[]
            for value in point:
                coefficient,constant=linear(ast.parse(str(value),mode='eval').body)
                if constant!=0:raise ValueError('Sampled coordinates must scale from the origin')
                evaluate(value,parameters)
                values.append(coefficient)
            section.append(values)
        result.append(section)
    breaks=feature.get('bilinear_patches')
    n=len(result[0])
    if (not isinstance(breaks,list) or len(breaks)<3 or
            any(type(i) is not int for i in breaks) or breaks[0]!=0 or
            breaks!=sorted(set(breaks)) or breaks[-1]>=n):
        raise ValueError('Bilinear patch breaks must be ordered unique polygon indices starting at zero')
    return result


def make_solid(sections,breaks):
    import FreeCAD as A
    import Part
    vectors=[[A.Vector(*p) for p in section] for section in sections]
    n=len(vectors[0]);cuts=list(breaks)+[breaks[0]+n]
    faces=[];end_wires=[[],[]]
    for start,finish in zip(cuts,cuts[1:]):
        grid=[[row[j%n] for j in range(start,finish+1)] for row in vectors]
        nu,nv=len(grid),len(grid[0]);surface=Part.BSplineSurface()
        surface.buildFromPolesMultsKnots(grid,[2]+[1]*(nu-2)+[2],[2]+[1]*(nv-2)+[2],list(range(nu)),list(range(nv)),False,False,1,1)
        faces.append(surface.toShape())
        for k,row in enumerate([grid[0],grid[-1]]):
            curve=Part.BSplineCurve();count=len(row)
            curve.buildFromPolesMultsKnots(row,[2]+[1]*(count-2)+[2],list(range(count)),False,1)
            end_wires[k].append(curve.toShape())
    # A planar cap is only valid for coplanar input section vertices. The
    # kernel's Face constructor rejects unsupported nonplanar section ends.
    faces.extend(Part.Face(Part.Wire(edges)) for edges in end_wires)
    shell=Part.makeShell(faces);solid=Part.makeSolid(shell)
    if solid.Volume<0:solid.reverse()
    if not shell.isClosed() or not solid.isValid() or len(solid.Solids)!=1:
        raise ValueError('Invalid degree-one loft boundary')
    return solid


def direct(feature,parameters):
    sections=unit_sections(feature,parameters)
    shape=make_solid(sections,feature['bilinear_patches'])
    shape.scale(evaluate(feature['scale_parameter'],parameters))
    return shape
