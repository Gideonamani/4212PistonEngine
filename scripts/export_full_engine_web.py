"""Export the existing V4 six-cylinder Blender scene as a browser GLB.

The source file remains untouched. Blender drivers are force-sampled into a
single 720-degree action so the web viewer can scrub the verified native motion.
"""
from pathlib import Path
import bpy

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "build" / "full-engine-web"
OUT.mkdir(parents=True, exist_ok=True)

scene = bpy.data.scenes["07 | Six cylinders - dissolve to operating internals"]
bpy.context.window.scene = scene
scene.frame_start = 1
# The native controller advances three crank degrees per frame. Frames 1..241
# are one 720-degree four-stroke cycle; the longer source scene continues for
# its classroom dissolve sequence.
scene.frame_end = 241
scene.frame_set(1)

# Keep physical mechanism/case objects and omit the teaching camera, lights,
# captions and the animated exterior-dissolve material behavior.
for obj in bpy.context.view_layer.objects:
    obj.select_set(obj.type in {"MESH", "EMPTY", "CURVE"} and not obj.name.startswith("V4 camera") and not obj.name.startswith("Caption"))

bpy.context.view_layer.objects.active = next((o for o in bpy.context.selected_objects if o.type == "MESH"), None)
# glTF does not evaluate Blender drivers in a browser. Bake their evaluated
# transforms in memory (without saving the source .blend) before export.
bpy.ops.nla.bake(
    frame_start=scene.frame_start,
    frame_end=scene.frame_end,
    step=1,
    only_selected=True,
    visual_keying=True,
    clear_constraints=False,
    clear_parents=False,
    use_current_action=True,
    bake_types={"OBJECT"},
)
output = OUT / "gtsio520-six-cylinder-drive.glb"
bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format="GLB",
    use_selection=True,
    export_animations=True,
    export_force_sampling=True,
    export_frame_range=True,
    export_frame_step=1,
    export_yup=True,
    export_apply=False,
    export_materials="EXPORT",
)
print(output, flush=True)
