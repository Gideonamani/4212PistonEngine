"""Bake the Langley illustrative operating motion and the systems exploded view into an editable Blender file and a GLB.

Run with Blender's Python after the CAD package exists:

    blender --background --python-exit-code 1 --python cad_pipeline/rig_langley.py -- --package <cad package> --output <folder>

The package holds geometry.json (and cad-validation.json for a release build; `--development` accepts the fast evaluator's output).
Every moving part gets its own animation tracks, so the exported clips can be audited part by part. The transforms come from
cad_pipeline/langley_motion.py and langley_explode.py; this script only samples them. Fast curve creation (foreach_set) keeps
hundreds of parts across 720 frames practical.
"""
import argparse, gzip, hashlib, json, shutil, sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / 'scripts'))
from cad_pipeline import langley_contract as contract_builder, langley_explode as explode, langley_motion as motion
from cad_pipeline.langley_bodies import body
from normalize_glb_motion_time import normalize_motion_time

COLORS = {'steel': (.32, .39, .47, 1), 'aluminium': (.64, .69, .74, 1), 'cast_iron': (.21, .24, .27, 1), 'bronze': (.55, .31, .12, 1), 'brass': (.70, .56, .22, 1),
          'porcelain': (.86, .84, .76, 1), 'rubber': (.055, .065, .075, 1)}
OPERATING, EXPLODED = 'Operating mechanism (illustrative)', 'Systems exploded view'
FPS = 24
OPERATING_FRAMES, EXPLODED_FRAMES = 721, 241          # 1 crank degree per frame; two crank turns are one four-stroke cycle


def blender_matrix(m):
    """CAD millimetres to Blender metres: only the translation scales."""
    return Matrix([[m[0][0], m[0][1], m[0][2], m[0][3] / 1000], [m[1][0], m[1][1], m[1][2], m[1][3] / 1000],
                   [m[2][0], m[2][1], m[2][2], m[2][3] / 1000], [0, 0, 0, 1]])


def tracks(frames, pose, origin=(0.0, 0.0, 0.0), rotation=0.0):
    """Per-frame (location, quaternion, scale) lists for pose(frame_index) -> 4x4, or None if the part never moves.

    `origin` (metres) is where the part's object origin sits and `rotation` (radians about +X) the rest rotation of its own frame: the pose is applied to
    the part's geometry in world space, so the keyed local transform is pose @ translation(origin) @ rotation."""
    loc, quat, scale = [], [], []
    previous, moved = None, False
    identity = Matrix.Identity(4)
    shift = Matrix.Translation(origin) @ Matrix.Rotation(rotation, 4, 'X')
    for f in range(frames):
        m = blender_matrix(pose(f))
        if not moved and any(abs(m[i][j] - identity[i][j]) > 1e-9 for i in range(3) for j in range(4)):
            moved = True
        l, q, s = (m @ shift).decompose()
        if previous is not None and q.dot(previous) < 0:
            q.negate()                                    # keep the quaternion on one hemisphere so interpolation takes the short way
        previous = q
        loc.append(tuple(l)); quat.append(tuple(q)); scale.append(tuple(s))
    return (loc, quat, scale) if moved else None


def write_tracks(action, strip, obj, data, frames):
    slot = action.slots.new(id_type='OBJECT', name=obj.name)
    channelbag = strip.channelbag(slot, ensure=True)
    loc, quat, scale = data
    for path, values, width in (('location', loc, 3), ('rotation_quaternion', quat, 4), ('scale', scale, 3)):
        tolerance = 1e-6 if path == 'scale' else 1e-9                  # matrix decomposition leaves float noise on a unit scale
        if all(abs(values[f][k] - values[0][k]) < tolerance for f in range(frames) for k in range(width)):
            continue                                       # this channel never changes for this part: leave it out
        for k in range(width):
            curve = channelbag.fcurves.new(path, index=k)
            curve.keyframe_points.add(frames)
            curve.keyframe_points.foreach_set('co', [c for f in range(frames) for c in (f + 1, values[f][k])])
            for key in curve.keyframe_points:
                key.interpolation = 'LINEAR'
            curve.update()
    return slot


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--package', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--name', default='langley-manly-balzer-1903-animated')
    parser.add_argument('--development', action='store_true', help='accept a fast_build geometry.json without a CAD validation record')
    parser.add_argument('--limit', type=int, help='bake only the first N parts (development)')
    args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:])
    out = args.output.resolve()
    out.mkdir(parents=True, exist_ok=True)
    geometry_file = args.package / 'geometry.json'
    if not args.development:
        record = json.loads((args.package / 'cad-validation.json').read_text())
        if not record.get('geometric_validation_passed') or record.get('complete_spec') is False:
            raise ValueError('CAD package is incomplete or invalid')
        if hashlib.sha256(geometry_file.read_bytes()).hexdigest() != record['files']['geometry.json']['sha256']:
            raise ValueError('CAD geometry hash mismatch')
    data = json.loads(geometry_file.read_text())
    parts = data['parts'][:args.limit] if args.limit else data['parts']

    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.unit_settings.system, scene.unit_settings.scale_length = 'METRIC', 1
    scene.render.fps = FPS
    materials = {}
    for name, color in COLORS.items():
        m = bpy.data.materials.new(name)
        m.diffuse_color = color
        m.use_nodes = True
        b = m.node_tree.nodes.get('Principled BSDF')
        b.inputs['Base Color'].default_value = color
        b.inputs['Metallic'].default_value, b.inputs['Roughness'].default_value = .65, .37
        materials[name] = m
    objects, origins, rests = {}, {}, {}
    for p in parts:
        mesh = bpy.data.meshes.new(p['id'])
        pivot = motion.pivot(p['id']) or (0.0, 0.0, 0.0)     # a part turning about a fixed axis has its origin on it
        rest = motion.rest_rotation(p['id'])                  # a spring that scales along its own axis is stored in its own frame
        origins[p['id']] = tuple(c / 1000 for c in pivot)
        rests[p['id']] = rest
        back = Matrix.Rotation(-rest, 3, 'X')
        mesh.from_pydata([tuple(back @ Vector([(c - o) / 1000 for c, o in zip(v, pivot)])) for v in p['vertices_mm']], [], p['triangles'])
        mesh.update()
        o = bpy.data.objects.new(p['id'], mesh)
        o.location = origins[p['id']]
        scene.collection.objects.link(o)
        o.data.materials.append(materials.get(p['material'].replace(' ', '_'), materials['steel']))
        o.rotation_mode = 'QUATERNION'
        o.rotation_quaternion = Matrix.Rotation(rest, 3, 'X').to_quaternion()
        o['cad_part_id'], o['evidence'], o['group'], o['label'] = p['id'], p['evidence'], p['group'], p['label']
        objects[p['id']] = o
    groups = {p['id']: p['group'] for p in parts}

    clips = [(OPERATING, OPERATING_FRAMES, lambda pid, f: motion.matrix(pid, float(f))),
             (EXPLODED, EXPLODED_FRAMES, lambda pid, f: [[1, 0, 0, explode.offset(pid, groups[pid], f / (EXPLODED_FRAMES - 1))[0]],
                                                         [0, 1, 0, explode.offset(pid, groups[pid], f / (EXPLODED_FRAMES - 1))[1]],
                                                         [0, 0, 1, explode.offset(pid, groups[pid], f / (EXPLODED_FRAMES - 1))[2]], [0, 0, 0, 1]])]
    animated, actions, slots = {}, {}, {}
    for title, frames, pose in clips:
        print('LANGLEY_BAKING', title, flush=True)
        action = bpy.data.actions.new(title)
        layer = action.layers.new('Layer')
        strip = layer.strips.new(type='KEYFRAME')
        cache, count = {}, 0
        for pid, obj in objects.items():
            key = (body(pid), pid if title == EXPLODED else '')            # all parts of a rigid body share one motion
            if key not in cache:
                cache[key] = tracks(frames, lambda f, pid=pid: pose(pid, f), origins[pid], rests[pid])
            if cache[key] is None:
                continue
            obj.animation_data_create()
            slot = write_tracks(action, strip, obj, cache[key], frames)
            # Each clip is a muted NLA track: the glTF exporter writes every action that a track references.
            track = obj.animation_data.nla_tracks.new()
            track.name = title
            nla = track.strips.new(title, 1, action)
            nla.action_slot = slot
            track.mute = True
            slots[(title, obj.name)] = slot
            count += 1
        animated[title] = count
        print('LANGLEY_BAKED', title, count, 'animated parts', flush=True)
        actions[title] = action
    for obj in objects.values():                                           # the operating clip is the active one when the file opens
        slot = slots.get((OPERATING, obj.name))
        if slot is not None:
            obj.animation_data.action, obj.animation_data.action_slot = actions[OPERATING], slot
    scene.frame_start, scene.frame_end = 1, OPERATING_FRAMES
    blend = out / (args.name + '.blend')
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    raw = out / (args.name + '.glb')
    bpy.ops.export_scene.gltf(filepath=str(raw), export_format='GLB', export_extras=True, export_animations=True, export_animation_mode='ACTIONS',
                              export_force_sampling=False, export_anim_slide_to_zero=True)
    normalize_motion_time(raw)
    packed = out / (args.name + '.glb.gz')
    with raw.open('rb') as source, packed.open('wb') as target:
        with gzip.GzipFile(filename='', mode='wb', fileobj=target, mtime=0) as gz:
            shutil.copyfileobj(source, gz, 1024 * 1024)
    asset_hash = hashlib.sha256(raw.read_bytes()).hexdigest()
    motions = [dict(id=OPERATING, label=OPERATING, loop=True, stages=contract_builder.operating_stages()),
               dict(id=EXPLODED, label=EXPLODED, loop=False, stages=explode.STAGES)]
    contract = contract_builder.build(dict(parts=parts), asset_hash, motions=motions)
    (out / (args.name + '-contract.json')).write_text(json.dumps(contract, indent=2) + '\n', encoding='utf-8')
    (out / 'blender-verification.json').write_text(json.dumps(dict(passed=True, parts=len(objects), authored_actions=[t for t, _, _ in clips], animated_parts=animated,
                                                                  asset_sha256=asset_hash, development=bool(args.development)), indent=2) + '\n')
    print('LANGLEY_RIG_EXPORTED', raw.stat().st_size, packed.stat().st_size, flush=True)


if __name__ == '__main__':
    main()
