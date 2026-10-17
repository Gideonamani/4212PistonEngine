"""Reopen the saved presentation master. This is not a native CAD gate."""
import hashlib
import json
import math
from pathlib import Path
import bpy

REPO=Path(__file__).resolve().parents[1]
OUT=REPO/'build/gtsio520-animation-review'


def main():
    contract=json.loads((OUT/'review-contract.json').read_text())
    blend=OUT/'gtsio520-r10-animated-review.blend'
    bpy.ops.wm.open_mainfile(filepath=str(blend))
    objects={o['cad_part_id']:o for o in bpy.data.objects if o.type=='MESH' and o.get('cad_part_id')}
    if set(objects)!={p['id'] for p in contract['parts']}:raise ValueError('Saved part identity mismatch')
    if set(a.name for a in bpy.data.actions)!={m['id'] for m in contract['motions']}:raise ValueError('Saved clip grouping mismatch')
    counts={}
    for action in bpy.data.actions:
        if len(action.slots)!=contract['animated_nodes'][action.name]:raise ValueError('Saved action slots mismatch')
        counts[action.name]=len(action.slots)
    for obj in objects.values():
        if not all(math.isfinite(v) for row in obj.matrix_world for v in row):raise ValueError('Non-finite saved transform')
        if obj.animation_data:
            if obj.animation_data.action is not None:raise ValueError('Master must open at unforced source rest')
            for track in obj.animation_data.nla_tracks:
                if not track.mute:raise ValueError('Saved review reference track must be muted')
                if any(strip.action_slot is None for strip in track.strips):raise ValueError('Missing action-slot binding')
    for key in ['geometry','spec']:
        if hashlib.sha256((REPO/contract[key]['path']).read_bytes()).hexdigest()!=contract[key]['sha256']:raise ValueError('Frozen input changed')
    result=dict(passed=True,scope='Saved editable presentation master only; no whole-engine native CAD/edit/STEP acceptance',
        blender_version=bpy.app.version_string,parts=len(objects),saved_actions=counts,
        master_sha256=hashlib.sha256(blend.read_bytes()).hexdigest(),asset_sha256=contract['asset_sha256'])
    (OUT/'saved-blender-checks.json').write_text(json.dumps(result,indent=2)+'\n')
    print('SAVED_GTSIO_REVIEW_VERIFIED',len(objects),counts,flush=True)


if __name__=='__main__':main()
