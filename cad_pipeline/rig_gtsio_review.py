"""Bake the explicitly authorised private illustrative R10 review draft."""
import argparse
import gzip
import hashlib
import json
from pathlib import Path
import sys

import bpy
from mathutils import Matrix

REPO=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(REPO))
from cad_pipeline.gtsio_review_motion import ReviewMotion,EXPLODE,COLLAPSE,CYCLE,STAGES,SCOPE,build_reference_poses,build_review_contract
from cad_pipeline.look import DEFAULT_SMOOTH_ANGLE_DEG,apply_smooth_by_angle
from cad_pipeline.rig_wright import blender_matrix,write_tracks
from scripts.normalize_glb_motion_time import normalize_motion_time

OUT=REPO/'build/gtsio520-animation-review'
FRAMES=721


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--output',type=Path,default=OUT)
    p.add_argument('--smooth-angle',type=float,default=DEFAULT_SMOOTH_ANGLE_DEG)
    p.add_argument('--bake-gltf',action='store_true',help='Opt-in: bake 721-frame glTF animation tracks instead of using Three.js procedural motion')
    a=p.parse_args(sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else [])
    out=a.output.resolve()
    manifest=json.loads((out/'review-manifest.json').read_text())
    handoff=json.loads((REPO/'cad-studies/gtsio520-h-static/crankcase-contours/animation-handoff.json').read_text())
    spec=json.loads((REPO/handoff['selected_spec']['path']).read_text())
    motion=ReviewMotion(spec,manifest['parts'],handoff['rigid_body_seeds'])
    if not a.bake_gltf:
        static_glb=out/'gtsio520-r10-static.glb'
        raw=static_glb.read_bytes()
        packed=(out/'gtsio520-r10-static.glb.gz').read_bytes() if (out/'gtsio520-r10-static.glb.gz').exists() else gzip.compress(raw,mtime=0)
        contract=build_review_contract(
            motion=motion,
            handoff=handoff,
            spec=spec,
            parts=manifest['parts'],
            asset_file=static_glb.name,
            asset_sha256=hashlib.sha256(raw).hexdigest(),
            asset_bytes=len(raw),
            gzip_bytes=len(packed),
            blender_version=manifest.get('blender_version', bpy.app.version_string),
        )
        (out/'review-contract.json').write_text(json.dumps(contract,indent=2)+'\n')
        reference=build_reference_poses(motion,manifest['parts'])
        (out/'reference-poses.json').write_text(json.dumps(reference)+'\n')
        print('GTSIO_PROCEDURAL_REVIEW_READY',len(manifest['parts']),len(raw),len(packed),flush=True)
        return
    bpy.ops.wm.open_mainfile(filepath=str(out/'gtsio520-r10-review.blend'))
    scene=bpy.context.scene
    scene.render.fps=60
    scene.frame_start=1;scene.frame_end=FRAMES
    objects={o['cad_part_id']:o for o in bpy.data.objects if o.type=='MESH' and o.get('cad_part_id')}
    bases={}
    for pid,obj in objects.items():
        origin,basis=motion.origin_basis(pid)
        base=Matrix(basis);base.translation=[c/1000 for c in origin]
        obj.data.transform(base.inverted())
        obj.matrix_world=base
        bases[pid]=base
        obj['review_body']=motion.body(pid)
        obj['cycle_visible']=motion.cycle_visible(pid)
        apply_smooth_by_angle(obj.data,a.smooth_angle)
    clips=[EXPLODE,COLLAPSE,CYCLE]
    actions={};slots={};counts={};reference={}
    for title in clips:
        print('GTSIO_REVIEW_BAKING',title,flush=True)
        action=bpy.data.actions.new(title);layer=action.layers.new('Review');strip=layer.strips.new(type='KEYFRAME')
        counts[title]=0;cache={}
        for pid,obj in objects.items():
            if title==CYCLE and motion.body(pid).startswith('fixed:'):continue
            base=bases[pid]
            key=(motion.body(pid),tuple(v for row in base for v in row)) if title==CYCLE else (motion.explosion(pid),tuple(v for row in base for v in row))
            if key not in cache:
                loc=[];quat=[];scale=[];last=None
                for f in range(FRAMES):
                    matrix=motion.matrix(pid,float(f)) if title==CYCLE else motion.exploded_matrix(pid,(f if title==EXPLODE else 720-f)/720)
                    evaluated=blender_matrix(matrix)@base
                    l,q,s=evaluated.decompose()
                    if last is not None and last.dot(q)<0:q.negate()
                    last=q.copy();loc.append(tuple(l));quat.append(tuple(q));scale.append(tuple(s))
                    if f in [0,137,360,720] and title==CYCLE:
                        reference.setdefault(pid,{})[str(f)]=[list(row) for row in evaluated]
                cache[key]=(loc,quat,scale)
            data=cache[key]
            if all(max(abs(data[i][f][k]-data[i][0][k]) for f in range(FRAMES) for k in range(len(data[i][0])))<1e-9 for i in range(3)):
                continue
            slot=write_tracks(action,strip,obj,data,FRAMES)
            obj.animation_data_create();track=obj.animation_data.nla_tracks.new();track.name=title
            nla=track.strips.new(title,1,action);nla.action_slot=slot;track.mute=True
            slots[(title,pid)]=slot;counts[title]+=1
        actions[title]=action
        print('GTSIO_REVIEW_BAKED',title,counts[title],flush=True)
    for pid,obj in objects.items():
        obj.matrix_world=bases[pid]
        if obj.animation_data:obj.animation_data.action=None
    scene['review_scope']=SCOPE
    scene['draft_authority']='User selected illustrative review drafts first on 17 October 2026'
    scene.frame_set(1)
    bpy.ops.wm.save_as_mainfile(filepath=str(out/'gtsio520-r10-animated-review.blend'))
    asset=out/'gtsio520-r10-animated-review.glb'
    bpy.ops.export_scene.gltf(filepath=str(asset),export_format='GLB',export_extras=True,
        export_cameras=False,export_animations=True,export_animation_mode='ACTIONS',
        export_merge_animation='ACTION',export_force_sampling=False,export_anim_slide_to_zero=True)
    normalize_motion_time(asset)
    raw=asset.read_bytes();packed=gzip.compress(raw,mtime=0);(out/(asset.name+'.gz')).write_bytes(packed)
    contract=build_review_contract(
        motion=motion,
        handoff=handoff,
        spec=spec,
        parts=manifest['parts'],
        asset_file=asset.name,
        asset_sha256=hashlib.sha256(raw).hexdigest(),
        asset_bytes=len(raw),
        gzip_bytes=len(packed),
        blender_version=bpy.app.version_string,
        animated_nodes=counts,
    )
    (out/'review-contract.json').write_text(json.dumps(contract,indent=2)+'\n')
    (out/'reference-poses.json').write_text(json.dumps(reference)+'\n')
    print('GTSIO_ANIMATED_REVIEW_READY',len(objects),len(raw),len(packed),flush=True)


if __name__=='__main__':main()

