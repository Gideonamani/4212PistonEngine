"""Exhaustive material differences in disjoint angular volumes.

Boolean set identity: (A minus B) intersect W equals (A intersect W) minus
(B intersect W). All sectors cover the complete conservative bounding box.
Sum both differences over every sector under the original total tolerance;
this is a complete solid-volume comparison, not boundary-point sampling.
"""
import math
from hashlib import sha256


def useful(a,b):
    lengths=[max(getattr(a.BoundBox,k+'Max'),getattr(b.BoundBox,k+'Max'))-
             min(getattr(a.BoundBox,k+'Min'),getattr(b.BoundBox,k+'Min')) for k in 'XYZ']
    return min(len(a.Faces),len(b.Faces))>=250 and min(lengths)<.25*max(lengths)


def differences(a,b,count=60,tolerance=1e-5,progress=None):
    import FreeCAD as A
    import Part
    if type(count) is not int or not 4<=count<=360:raise ValueError('Finite angular partition count required')
    low=[min(getattr(s.BoundBox,k+'Min') for s in [a,b])-1 for k in 'XYZ']
    high=[max(getattr(s.BoundBox,k+'Max') for s in [a,b])+1 for k in 'XYZ']
    axis_index=min(range(3),key=lambda i:high[i]-low[i]);radial=[i for i in range(3) if i!=axis_index]
    base=[(u+v)/2 for u,v in zip(low,high)];base[axis_index]=low[axis_index]
    axis=[0,0,0];axis[axis_index]=1
    radius=math.hypot(*[(high[i]-low[i])/2 for i in radial])+1
    point,direction=A.Vector(*base),A.Vector(*axis)
    wedge=Part.makeCylinder(radius,high[axis_index]-low[axis_index],point,direction,360/count)
    def fingerprint(shape):return sha256(shape.exportBrepToString().encode()).hexdigest()
    before=[fingerprint(s) for s in [a,b]]
    totals=[0.,0.];rows=[];valid=True
    def okay(shape):return shape.isNull() or shape.isValid()
    for k in range(count):
        region=wedge.copy();region.rotate(point,direction,360*k/count)
        left,right=a.copy().common(region),b.copy().common(region)
        if not okay(left) or not okay(right):raise ValueError('Invalid original-solid partition crop')
        first=Part.Shape() if not left.Solids else left if not right.Solids else left.cut(right)
        second=Part.Shape() if not right.Solids else right if not left.Solids else right.cut(left)
        good=okay(first) and okay(second)
        values=[0. if s.isNull() else abs(s.Volume) for s in [first,second]]
        totals=[x+y for x,y in zip(totals,values)];valid &= good
        row=dict(sector=k,differences_mm3=values,valid=good);rows.append(row)
        if progress:progress(row)
        if not valid or max(totals)>tolerance:break
    complete=len(rows)==count
    unchanged=before==[fingerprint(s) for s in [a,b]]
    if not unchanged:raise ValueError('Partitioned comparison mutated an original solid')
    return dict(passed=complete and valid and max(totals)<=tolerance,
                original_solid_difference_mm3=totals,original_solid_differences_valid=[valid,valid],
                partition=dict(count=count,completed=len(rows),axis=axis,base_mm=base,radius_mm=radius,originals_unchanged=unchanged,
                               axial_height_mm=high[axis_index]-low[axis_index],covering_bounds_mm=[low,high],
                               total_material_tolerance_mm3=tolerance,rows=rows),
                method='Exhaustive angular partition of actual original solids; both total differences retain the existing material tolerance')
