"""Bake an animated study's motion into an editable Blender file and a GLB, and write the viewer contract. One rig for every engine.

Run with Blender's Python after the CAD package (or, for R10, the presentation stage) exists:

    blender --background --python-exit-code 1 --python cad_pipeline/rig_animated_study.py -- --study langley --package <cad package> --output <folder>
    blender --background --python-exit-code 1 --python cad_pipeline/rig_animated_study.py -- --study wright --package <cad package> --output <folder>
    blender --background --python-exit-code 1 --python cad_pipeline/rig_animated_study.py -- --study gtsio --output <folder> [--bake-gltf]

`rig_langley.py`, `rig_wright.py` and `rig_gtsio_review.py` are thin entry points that call this with their study, so existing commands still work.

Everything that depends on the engine is a `Study` in `animated_studies.py` (the motion and explode modules, which parts share a body, the frame of each part's
object origin, the clip names). This file only samples them: every moving part gets its own animation tracks, so the exported clips can be audited part by part, and
fast curve creation (foreach_set) keeps hundreds of parts across 720 frames practical. The look is `look.py`'s; this file holds no colour table.

The package for Langley and Wright holds geometry.json (and cad-validation.json for a release build; `--development` accepts the fast evaluator's output).
"""
import argparse, gzip, hashlib, json, shutil, sys
from pathlib import Path
import bpy
from mathutils import Matrix, Vector

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
sys.path.insert(0, str(REPO / 'scripts'))
from cad_pipeline import animated_studies
from cad_pipeline.look import apply_smooth_by_angle, blender_material
from normalize_glb_motion_time import normalize_motion_time


def blender_matrix(m):
    """CAD millimetres to Blender metres: only the translation scales."""
    return Matrix([[m[0][0], m[0][1], m[0][2], m[0][3] / 1000], [m[1][0], m[1][1], m[1][2], m[1][3] / 1000],
                   [m[2][0], m[2][1], m[2][2], m[2][3] / 1000], [0, 0, 0, 1]])


def object_base(origin_mm, rotation):
    """The part's object frame in Blender metres: its origin, and the rest rotation of its own frame (radians about +X, a 4x4 basis, or None)."""
    origin = tuple(c / 1000 for c in origin_mm)
    if rotation is None:
        return Matrix.Translation(origin)
    if isinstance(rotation, (int, float)):
        return Matrix.Translation(origin) @ Matrix.Rotation(rotation, 4, 'X')
    base = Matrix(rotation)
    base.translation = origin
    return base


def tracks(frames, pose, base, static='identity'):
    """Per-frame (location, quaternion, scale) lists for pose(frame_index) -> 4x4, or None if the part is not animated.

    `base` is the part's object frame (see `object_base`): the pose is applied to the part's geometry in world space, so the keyed local transform is pose @ base.
    `static` says when a part counts as not animated: 'identity' (its pose is the identity at every frame) or 'constant' (every channel is constant)."""
    loc, quat, scale = [], [], []
    previous, moved = None, False
    identity = Matrix.Identity(4)
    for f in range(frames):
        m = blender_matrix(pose(f))
        if not moved and any(abs(m[i][j] - identity[i][j]) > 1e-9 for i in range(3) for j in range(4)):
            moved = True
        l, q, s = (m @ base).decompose()
        if previous is not None and q.dot(previous) < 0:
            q.negate()                                    # keep the quaternion on one hemisphere so interpolation takes the short way
        previous = q.copy()
        loc.append(tuple(l)); quat.append(tuple(q)); scale.append(tuple(s))
    data = (loc, quat, scale)
    if static == 'identity':
        return data if moved else None
    constant = all(max(abs(channel[f][k] - channel[0][k]) for f in range(frames) for k in range(len(channel[0]))) < 1e-9 for channel in data)
    return None if constant else data


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


def create_objects(study, parts, scene):
    """One object per part from the CAD tessellation: the mesh is stored around the object origin (the part's pivot), in metres."""
    materials, objects, bases = {}, {}, {}
    for p in parts:
        mesh = bpy.data.meshes.new(p['id'])
        origin_mm, rotation = study.frame(p['id'])
        if isinstance(rotation, (list, tuple)):
            raise ValueError('A basis matrix is only supported for objects opened from a saved Blender file: ' + p['id'])
        if rotation is None:
            mesh.from_pydata([[(c - o) / 1000 for c, o in zip(v, origin_mm)] for v in p['vertices_mm']], [], p['triangles'])
        else:                                                 # a part stored in its own frame (a spring that scales along its own axis)
            back = Matrix.Rotation(-rotation, 3, 'X')
            mesh.from_pydata([tuple(back @ Vector([(c - o) / 1000 for c, o in zip(v, origin_mm)])) for v in p['vertices_mm']], [], p['triangles'])
        mesh.update()
        o = bpy.data.objects.new(p['id'], mesh)
        o.location = tuple(c / 1000 for c in origin_mm)
        scene.collection.objects.link(o)
        o.data.materials.append(blender_material(p['material'], part_id=p['id'], vary=False, cache=materials))
        o.rotation_mode = 'QUATERNION'
        if rotation is not None:
            o.rotation_quaternion = Matrix.Rotation(rotation, 3, 'X').to_quaternion()
        o['cad_part_id'], o['evidence'], o['group'], o['label'] = p['id'], p['evidence'], p['group'], p['label']
        objects[p['id']] = o
        bases[p['id']] = object_base(origin_mm, rotation)
    return objects, bases


def open_objects(study, blend, smooth_angle):
    """The objects of a Blender file the presentation stage saved: re-base each mesh around its pivot, a rigid move that the node transform undoes."""
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    objects = {o['cad_part_id']: o for o in bpy.data.objects if o.type == 'MESH' and o.get('cad_part_id')}
    bases = {}
    for pid, obj in objects.items():
        base = object_base(*study.frame(pid))
        obj.data.transform(base.inverted())
        obj.matrix_world = base
        bases[pid] = base
        study.annotate(obj, pid)
        if smooth_angle:
            apply_smooth_by_angle(obj.data, smooth_angle)
    return objects, bases


def bake(study, objects, bases):
    """Bake every clip into its own action, each part's tracks in an action slot, and mute the NLA track that references it (the glTF exporter writes every
    action that a track references). Returns {clip title: action}, {(clip title, object name): slot} and {clip title: animated part count}."""
    actions, slots, counts = {}, {}, {}
    for clip in study.clips():
        print(f'{study.marker}_BAKING', clip.title, flush=True)
        action = bpy.data.actions.new(clip.title)
        strip = action.layers.new('Layer').strips.new(type='KEYFRAME')
        cache, counts[clip.title] = {}, 0
        for pid, obj in objects.items():
            if clip.skip(pid):
                continue
            key = (clip.share(pid), tuple(v for row in bases[pid] for v in row))        # all parts of a rigid body share one motion, if their frames agree
            if key not in cache:
                cache[key] = tracks(clip.frames, lambda f, pid=pid: clip.pose(pid, f), bases[pid], clip.static)
            if cache[key] is None:
                continue
            obj.animation_data_create()
            slot = write_tracks(action, strip, obj, cache[key], clip.frames)
            track = obj.animation_data.nla_tracks.new()
            track.name = clip.title
            nla = track.strips.new(clip.title, 1, action)
            nla.action_slot = slot
            track.mute = True
            slots[(clip.title, obj.name)] = slot
            counts[clip.title] += 1
        actions[clip.title] = action
        print(f'{study.marker}_BAKED', clip.title, counts[clip.title], 'animated parts', flush=True)
    return actions, slots, counts


def pack(raw, packed):
    with raw.open('rb') as source, packed.open('wb') as target:
        with gzip.GzipFile(filename='', mode='wb', fileobj=target, mtime=0) as gz:
            shutil.copyfileobj(source, gz, 1024 * 1024)


def read_package(package, development):
    geometry_file = package / 'geometry.json'
    if not development:
        record = json.loads((package / 'cad-validation.json').read_text())
        if not record.get('geometric_validation_passed') or record.get('complete_spec') is False:
            raise ValueError('CAD package is incomplete or invalid')
        if hashlib.sha256(geometry_file.read_bytes()).hexdigest() != record['files']['geometry.json']['sha256']:
            raise ValueError('CAD geometry hash mismatch')
    return json.loads(geometry_file.read_text())['parts']


def main(study_name=None, argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--study', default=study_name, choices=sorted(animated_studies.STUDIES), required=study_name is None)
    parser.add_argument('--package', type=Path, help='the CAD package folder (Langley, Wright)')
    parser.add_argument('--output', type=Path, help='output folder (R10: the presentation stage folder, default build/gtsio520-animation-review)')
    parser.add_argument('--name', help='base name of the output files')
    parser.add_argument('--development', action='store_true', help='accept a fast_build geometry.json without a CAD validation record')
    parser.add_argument('--limit', type=int, help='bake only the first N parts (development)')
    parser.add_argument('--smooth-angle', type=float, help='shade smooth with sharp edges above this angle (R10 defaults to the look.py angle)')
    parser.add_argument('--bake-gltf', action='store_true', help='R10: bake 721-frame glTF animation tracks instead of leaving the motion to the viewer (procedural)')
    argv = sys.argv[sys.argv.index('--') + 1:] if argv is None and '--' in sys.argv else (argv or [])
    args = parser.parse_args(argv)
    study_class = animated_studies.get(args.study)
    if study_class.source == 'blend' and not args.bake_gltf:
        return write_procedural(study_class, args)
    out = (args.output or REPO / 'build/gtsio520-animation-review').resolve()
    out.mkdir(parents=True, exist_ok=True)

    if study_class.source == 'geometry':
        if not args.package or not args.output:
            parser.error('--package and --output are required')
        parts = read_package(args.package, args.development)
        parts = parts[:args.limit] if args.limit else parts
        study = study_class(parts)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = bpy.context.scene
        scene.unit_settings.system, scene.unit_settings.scale_length = 'METRIC', 1
        objects, bases = create_objects(study, parts, scene)
    else:
        manifest = json.loads((out / 'review-manifest.json').read_text())
        parts = manifest['parts']
        study = study_class(parts)
        objects, bases = open_objects(study, out / 'gtsio520-r10-review.blend', args.smooth_angle or study.smooth_angle)
        scene = bpy.context.scene
    scene.render.fps = study.fps
    clips = study.clips()
    scene.frame_start, scene.frame_end = 1, clips[0].frames
    actions, slots, counts = bake(study, objects, bases)
    for pid, obj in objects.items():
        if study.active_clip:                                              # the operating clip is the active one when the file opens
            slot = slots.get((study.active_clip, obj.name))
            if slot is not None:
                obj.animation_data.action, obj.animation_data.action_slot = actions[study.active_clip], slot
        else:
            obj.matrix_world = bases[pid]
            if obj.animation_data:
                obj.animation_data.action = None
    study.finish(scene)
    names = study.output_names(args.name or study.default_name)
    blend, raw = out / names['blend'], out / names['glb']
    bpy.ops.wm.save_as_mainfile(filepath=str(blend))
    bpy.ops.export_scene.gltf(filepath=str(raw), **study.export_options)
    normalize_motion_time(raw)
    packed = out / (raw.name + '.gz')
    pack(raw, packed)
    asset_hash = hashlib.sha256(raw.read_bytes()).hexdigest()
    contract = study.contract(asset_hash, asset_file=raw.name, asset_bytes=raw.stat().st_size, gzip_bytes=packed.stat().st_size,
                              blender_version=bpy.app.version_string, animated_nodes=counts)
    (out / names['contract']).write_text(json.dumps(contract, indent=2) + '\n', encoding='utf-8')
    if study.verification_file:
        (out / 'blender-verification.json').write_text(json.dumps(dict(passed=True, parts=len(objects), authored_actions=[c.title for c in clips], animated_parts=counts,
                                                                       asset_sha256=asset_hash, development=bool(args.development)), indent=2) + '\n')
    study.write_extras(out)
    print(f'{study.marker}_RIG_EXPORTED', raw.stat().st_size, packed.stat().st_size, flush=True)


def write_procedural(study_class, args):
    """R10 without baking: the viewer computes the motion, so write only the contract and the reference poses beside the static GLB the presentation stage exported."""
    from cad_pipeline import gtsio_contract
    out = (args.output or REPO / 'build/gtsio520-animation-review').resolve()
    result = gtsio_contract.write_procedural_review(out, blender_version=bpy.app.version_string)
    print(f'{study_class.marker}_PROCEDURAL_READY', *result, flush=True)


if __name__ == '__main__':
    main()
