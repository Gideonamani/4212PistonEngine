"""Export the existing V4 six-cylinder Blender scene as a browser GLB.

The source file remains untouched. Blender drivers are force-sampled into a
single 720-degree action so the web viewer can scrub the verified native motion.
"""
from pathlib import Path
import json
import re
import bpy

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "build" / "full-engine-web"
OUT.mkdir(parents=True, exist_ok=True)
CONTRACT = json.loads((ROOT / "data" / "engine-contracts" / "gtsio520-h-v5.json").read_text())

scene = bpy.data.scenes[CONTRACT["source"]["scene"]]
bpy.context.window.scene = scene
frames = CONTRACT["operation"]["source_frames"]
scene.frame_start = frames["start"]
# The native controller advances three crank degrees per frame. Frames 1..241
# are one 720-degree four-stroke cycle; the longer source scene continues for
# its classroom dissolve sequence.
scene.frame_end = frames["end"]
scene.frame_set(frames["start"])

# Keep physical mechanism/case objects and omit the teaching camera, lights,
# captions and the animated exterior-dissolve material behavior.
for obj in bpy.context.view_layer.objects:
    obj.select_set(obj.type in {"MESH", "EMPTY", "CURVE"} and not obj.name.startswith("V4 camera") and not obj.name.startswith("Caption"))

bpy.context.view_layer.objects.active = next((o for o in bpy.context.selected_objects if o.type == "MESH"), None)
# Write portable identity metadata into the export without modifying the source
# blend. The current published GLB predates this; its browser adapter retains
# the contract's legacy-selector fallback until a reviewed re-export is promoted.
for obj in bpy.context.selected_objects:
    name = obj.name
    obj["engine_id"] = CONTRACT["id"]
    if name.startswith("C") and len(name) > 3 and name[1].isdigit() and name[2:5] == " | ":
        obj["module_id"] = "cylinder-module"
        obj["instance_id"] = f"cylinder-{name[1]}"
    elif name.startswith("V5 "):
        obj["module_id"] = "crankcase-v5"
    elif name.startswith("RUN | V3 "):
        obj["module_id"] = "primary-drive"
    obj["teaching_ids"] = [component["id"] for component in CONTRACT["teaching_components"]
                           if any(re.search(pattern, name, re.I) for pattern in component.get("selector", {}).get("any_regex", []))]
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
    export_extras=True,
)
print(output, flush=True)
