"""Frame copied CAD meshes without changing their geometry or placement."""
import bpy
from mathutils import Matrix, Vector


def frame_camera(scene,camera,visible,direction,up=None):
    points=[obj.matrix_world@Vector(v) for obj in visible for v in obj.bound_box]
    if not points:raise ValueError('Cannot frame an empty selection')
    lo=Vector([min(v[i] for v in points) for i in range(3)])
    hi=Vector([max(v[i] for v in points) for i in range(3)])
    center=(lo+hi)/2;direction=Vector(direction).normalized()
    camera.location=center+direction*3
    if up is not None:
        right=Vector(up).normalized().cross(direction)
        if right.length<1e-6:raise ValueError('Camera direction is parallel to up')
        right.normalize()
        camera.rotation_euler=Matrix((right,direction.cross(right).normalized(),direction)).transposed().to_euler()
    else:camera.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
    # Existing tour actions otherwise reapply the previous frame's pose during
    # dependency updates. Key the new pose before updating its world matrix.
    if camera.animation_data and camera.animation_data.action:
        for name in ('location','rotation_euler'):camera.keyframe_insert(name,frame=scene.frame_current)
    bpy.context.view_layer.update()
    inverse=camera.matrix_world.inverted();projected=[inverse@v for v in points]
    minx,maxx=min(p.x for p in projected),max(p.x for p in projected)
    miny,maxy=min(p.y for p in projected),max(p.y for p in projected)
    # An L-shaped assembly is not centred by its world-space bounding box.
    # Centre its projected bounds instead, keeping the recorded orientation.
    camera.location+=camera.rotation_euler.to_matrix()@Vector(((minx+maxx)/2,(miny+maxy)/2,0))
    aspect=scene.render.resolution_x/scene.render.resolution_y
    camera.data.ortho_scale=max((maxx-minx)*1.28,(maxy-miny)*aspect*1.75,.22)
    if camera.animation_data and camera.animation_data.action:camera.keyframe_insert('location',frame=scene.frame_current)
    if camera.data.animation_data and camera.data.animation_data.action:camera.data.keyframe_insert('ortho_scale',frame=scene.frame_current)
    bpy.context.view_layer.update()
    return camera.data.ortho_scale
