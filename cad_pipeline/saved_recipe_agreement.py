"""Original-solid agreement with an exact boundary gate for mass outliers.

OCCT's default surface integration can return different masses for equivalent
trimmed cylinders. Keep raw measurements. An outlier needs both original-solid
differences to be valid and below the existing 1e-5 mm3 material tolerance.
Neither an identity conversion nor a mesh replaces the original solids.
"""
import FreeCAD as A

BOUNDS_TOLERANCE_MM=1e-5
RELATIVE_VOLUME_TOLERANCE=1e-6
MATERIAL_TOLERANCE_MM3=1e-5


def compare(shape,direct,id):
    if any(s.isNull() or not s.isValid() or len(s.Solids)!=1 or s.Volume<=0 for s in (shape,direct)):
        raise ValueError('Recipe agreement requires two valid positive-volume single solids: '+id)
    ba=shape.optimalBoundingBox(False,False);bb=direct.optimalBoundingBox(False,False)
    names=('XMin','YMin','ZMin','XMax','YMax','ZMax')
    raw_bounds=max(abs(getattr(ba,k)-getattr(bb,k)) for k in names)
    raw_volume=abs(shape.Volume-direct.Volume)/shape.Volume
    bounds=raw_bounds;boundary=None;valid=None
    outlier=raw_bounds>BOUNDS_TOLERANCE_MM or raw_volume>RELATIVE_VOLUME_TOLERANCE
    if outlier:
        if raw_bounds>BOUNDS_TOLERANCE_MM:
            ba=shape.transformGeometry(A.Matrix()).optimalBoundingBox(False,False)
            bb=direct.transformGeometry(A.Matrix()).optimalBoundingBox(False,False)
            bounds=max(abs(getattr(ba,k)-getattr(bb,k)) for k in names)
        from cad_pipeline.partitioned_material import useful,differences as partitioned
        partition=None
        if useful(shape,direct):
            print('MATERIAL_PARTITIONS_BEGIN',id,flush=True)
            result=partitioned(shape,direct,progress=lambda row:print('MATERIAL_PARTITION',id,row['sector'],row['differences_mm3'],flush=True))
            boundary=result['original_solid_difference_mm3'];valid=result['original_solid_differences_valid'];partition=result['partition']
        else:
            differences=[shape.cut(direct),direct.cut(shape)]
            boundary=[abs(d.Volume) for d in differences]
            valid=[d.isNull() or d.isValid() for d in differences]
    boundary_pass=boundary is not None and all(valid) and all(v<=MATERIAL_TOLERANCE_MM3 for v in boundary)
    passed=bounds<=BOUNDS_TOLERANCE_MM and (not outlier or boundary_pass)
    result=dict(id=id,passed=passed,bounds_error_mm=bounds,
        raw_representation_bounds_error_mm=raw_bounds,relative_volume_error=raw_volume,
        boundary_difference_mm3=boundary,boundary_difference_valid=valid,
        agreement_method='original-solid bidirectional material differences' if outlier else 'bounds and raw volume',
        volume_integration_outlier=raw_volume>RELATIVE_VOLUME_TOLERANCE)
    if outlier and partition is not None:
        result['boundary_partition']=partition
        result['passed'] &= partition['completed']==partition['count']
    return result
