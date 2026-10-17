"""CAD tessellation topology preparation; never repair an exported mesh."""
def tessellation_shape(shape,part):
    if not part.get('mesh_refine',False):return shape
    refined=shape.removeSplitter()
    if not refined.isValid() or len(refined.Solids)!=1 or refined.Volume<=0:raise ValueError('Invalid refined meshing solid: '+part['id'])
    if abs(refined.Volume-shape.Volume)/shape.Volume>1e-6:raise ValueError('Meshing refinement changes volume: '+part['id'])
    a=shape.optimalBoundingBox(False,False);b=refined.optimalBoundingBox(False,False)
    if max(abs(getattr(a,k)-getattr(b,k)) for k in ('XMin','YMin','ZMin','XMax','YMax','ZMax'))>1e-5:raise ValueError('Meshing refinement changes bounds: '+part['id'])
    if shape.cut(refined).Volume>1e-5 or refined.cut(shape).Volume>1e-5:raise ValueError('Meshing refinement changes the solid boundary: '+part['id'])
    return refined
