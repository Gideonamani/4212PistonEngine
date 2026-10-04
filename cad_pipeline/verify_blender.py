"""Reopen the saved inspection tour and reimport GLB to verify IDs and scale."""
import argparse,json,sys
from pathlib import Path
import bpy

def main():
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);a=p.parse_args(sys.argv[sys.argv.index('--')+1:]);folder=a.package.resolve()
    manifest=json.loads((folder/'presentation-manifest.json').read_text());native=next(folder.glob('*.blend'));glb=next(folder.glob('*.glb'))
    bpy.ops.wm.open_mainfile(filepath=str(native));objects={o['id']:o for o in bpy.context.scene.objects if o.type=='MESH' and 'id' in o}
    engineering={id:o for id,o in objects.items() if not o.get('presentation_only')}
    if len(engineering)!=manifest['parts'] or len(objects)-len(engineering)!=manifest.get('presentation_only_parts',0):raise ValueError('Saved native IDs missing')
    frames=[]
    for entry in manifest['tour']:
        bpy.context.scene.frame_set(entry['frame']);visible=sorted(o['id'] for o in objects.values() if not o.hide_render)
        if visible!=sorted(entry['parts']):raise ValueError('Tour isolation mismatch: '+entry['group'])
        titles=[o for o in bpy.context.scene.objects if o.name.startswith('Tour title ') and not o.hide_render]
        if len(titles)!=1 or titles[0].data.body!=entry['title']:raise ValueError('Tour title mismatch: '+entry['group'])
        frames.append(dict(group=entry['group'],frame=entry['frame'],visible_parts=len(visible),title=entry['title']))
    bpy.context.scene.frame_set(1)
    def bounds(objs):
        vertices=[o.matrix_world @ v.co for o in objs for v in o.data.vertices]
        return [[min(v[i] for v in vertices) for i in range(3)],[max(v[i] for v in vertices) for i in range(3)]]
    original=bounds(engineering.values());ids=set(engineering)
    bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(glb));exported=[o for o in bpy.context.scene.objects if o.type=='MESH']
    if {o.get('id') for o in exported}!=ids:raise ValueError('GLB IDs missing/changed')
    converted=bounds(exported);error=max(abs(original[j][i]-converted[j][i]) for j in range(2) for i in range(3))
    if error>1e-6:raise ValueError('GLB axes/scale mismatch')
    result=dict(passed=True,parts=len(exported),blender_reopened=True,glb_id_roundtrip=True,bounds_roundtrip_error_m=error,tour=frames)
    (folder/'blender-validation.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'passed':True,'parts':len(exported),'tour_views':len(frames),'bounds_error_m':error}))

if __name__=='__main__':main()
