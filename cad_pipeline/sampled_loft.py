"""Curves fitted to sampled flanks, with explicit approximation scope.

Interpolation retains its input points; Bezier fitting retains the endpoints
and is separately bounded against all input samples. Neither is the polygon.
"""
from cad_pipeline.bilinear_loft import unit_sections as normalize


def unit_sections(feature,parameters):
    source=dict(feature,bilinear_patches=[0,1,len(feature['sections'][0])-1])
    sections=normalize(source,parameters)
    runs=feature.get('profile_spline_runs',[]);n=len(sections[0]);last=-1
    if not runs:raise ValueError('Sampled loft requires explicit spline runs')
    if feature.get('profile_parameterization','chord_length') not in ['chord_length','uniform_levels']:
        raise ValueError('Unsupported sampled profile parameterization')
    mode=feature.get('profile_curve_mode','interpolate')
    if mode not in ['interpolate','bezier_fit']:raise ValueError('Unsupported sampled curve mode')
    if mode=='bezier_fit':
        degree=feature.get('profile_curve_degree',5)
        if type(degree) is not int or not 3<=degree<=5:raise ValueError('Supported maximum Bezier degree required')
        if feature.get('profile_parameterization')!='uniform_levels':raise ValueError('Bezier fit uses common uniform sample levels')
    for start,finish in runs:
        if not (type(start) is int and type(finish) is int and last<=start<finish<n and finish-start>=2):
            raise ValueError('Ordered, disjoint sampled spline runs required')
        last=finish
    return sections


def profile_curve(points,parameterization='chord_length',mode='interpolate',degree=5):
    import Part
    if mode=='bezier_fit':
        import math
        import numpy as np
        import FreeCAD as A
        if type(degree) is not int or not 3<=degree<=5 or len(points)<2:raise ValueError('Supported Bezier degree and enough samples required')
        degree=min(degree,len(points)-1)
        t=np.linspace(0,1,len(points));matrix=np.array([[math.comb(degree,j)*(1-u)**(degree-j)*u**j for j in range(degree+1)] for u in t])
        values=np.array([list(p) for p in points]);rhs=values-matrix[:,0,None]*values[0]-matrix[:,-1,None]*values[-1]
        poles=np.linalg.lstsq(matrix[:,1:-1],rhs,rcond=None)[0]
        curve=Part.BezierCurve();curve.setPoles([points[0],*[A.Vector(*p) for p in poles],points[-1]])
        return curve
    if mode!='interpolate':raise ValueError('Unsupported sampled profile curve mode')
    curve=Part.BSplineCurve()
    if parameterization=='uniform_levels':curve.interpolate(Points=points,Parameters=[float(i) for i in range(len(points))])
    else:curve.interpolate(points)
    return curve


def make_solid(sections,runs,parameterization='chord_length',mode='interpolate',degree=5):
    import FreeCAD as A
    import Part
    wires=[];starts=dict(runs)
    for row in sections:
        points=[A.Vector(*p) for p in row];edges=[];index=0
        while index<len(points):
            if index in starts:
                finish=starts[index]
                selected=points[index:finish+1]
                curve=profile_curve(selected,parameterization,mode,degree)
                edges.append(curve.toShape());index=finish
            else:
                edges.append(Part.makeLine(points[index],points[(index+1)%len(points)]));index+=1
        wires.append(Part.Wire(edges))
    solid=Part.makeLoft(wires,True,True)
    if not solid.isValid() or len(solid.Solids)!=1 or solid.Volume<=0:
        raise ValueError('Invalid interpolated sampled loft')
    return solid


def direct(feature,parameters):
    from cad_pipeline.spec import evaluate
    shape=make_solid(unit_sections(feature,parameters),feature['profile_spline_runs'],feature.get('profile_parameterization','chord_length'),feature.get('profile_curve_mode','interpolate'),feature.get('profile_curve_degree',5))
    shape.scale(evaluate(feature['scale_parameter'],parameters))
    return shape
