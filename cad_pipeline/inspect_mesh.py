"""Blender mesh inventory and orthographic evidence. Never edits the source.
blender --background --python cad_pipeline/inspect_mesh.py -- --source ... --output ...
"""
import argparse, hashlib, json, sys
from pathlib import Path
import bpy
import numpy as np
from mathutils import Vector

def main():
    p = argparse.ArgumentParser()
    p.add_argument('--source', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    a = p.parse_args(sys.argv[sys.argv.index('--') + 1:])
    source = a.source.resolve(); out = a.output.resolve(); out.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    ext = source.suffix.lower()
    if ext in ('.glb', '.gltf'): bpy.ops.import_scene.gltf(filepath=str(source))
    elif ext == '.obj': bpy.ops.wm.obj_import(filepath=str(source))
    elif ext == '.stl': bpy.ops.wm.stl_import(filepath=str(source))
    else: raise ValueError('Supported mesh formats: GLB, glTF, OBJ, STL')
    objects = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    if not objects: raise ValueError('No mesh objects')
    entries = []; clouds = []
    for o in objects:
        pts = np.array([tuple(o.matrix_world @ v.co) for v in o.data.vertices])
        if not len(pts): continue
        clouds.append(pts)
        edge_use = {}
        for f in o.data.polygons:
            for e in f.edge_keys: edge_use[e] = edge_use.get(e, 0) + 1
        _,weld=np.unique(np.round(pts,5),axis=0,return_inverse=True);welded_use={}
        for f in o.data.polygons:
            for e in f.edge_keys:
                a,b=int(weld[e[0]]),int(weld[e[1]])
                if a==b: continue
                key=tuple(sorted((a,b)));welded_use[key]=welded_use.get(key,0)+1
        entries.append(dict(name=o.name, vertices=len(pts), polygons=len(o.data.polygons),
                            bounds=[pts.min(0).tolist(), pts.max(0).tolist()],
                            boundary_edges=sum(v == 1 for v in edge_use.values()),
                            nonmanifold_edges=sum(v > 2 for v in edge_use.values()),
                            weld_decimal_places=5,welded_vertices=int(weld.max()+1),
                            welded_boundary_edges=sum(v==1 for v in welded_use.values()),
                            welded_nonmanifold_edges=sum(v>2 for v in welded_use.values())))
    cloud = np.concatenate(clouds); lo = cloud.min(0); hi = cloud.max(0); center = (lo+hi)/2
    np.savez_compressed(out/'source-points.npz', points=cloud)
    report = dict(source=str(source), sha256=hashlib.sha256(source.read_bytes()).hexdigest(),
                  importer='Blender '+bpy.app.version_string, units='raw imported coordinates; physical scale must be established independently',
                  coordinate_note='Blender XYZ after glTF Y-up conversion; all node transforms applied',
                  bounds=[lo.tolist(), hi.tolist()], extents=(hi-lo).tolist(), objects=entries,
                  warning='Connected scan surfaces are not a semantic component inventory. Hidden geometry is unresolved.')
    (out/'mesh-analysis.json').write_text(json.dumps(report, indent=2)+'\n')
    s=bpy.context.scene; s.render.engine='BLENDER_WORKBENCH'
    s.display.shading.light='STUDIO'; s.display.shading.color_type='MATERIAL'
    s.display.shading.show_shadows=True; s.display.shading.show_cavity=True
    s.display.shading.background_type='WORLD'; s.world=bpy.data.worlds.new('Evidence world'); s.world.color=(.12,.12,.12)
    s.render.resolution_x=1100; s.render.resolution_y=900; s.render.resolution_percentage=100
    camdata=bpy.data.cameras.new('Evidence'); cam=bpy.data.objects.new('Evidence',camdata); s.collection.objects.link(cam); s.camera=cam
    camdata.type='ORTHO'; camdata.ortho_scale=float(max(hi-lo)*1.6)
    for name,direction in [('front',(0,-1,0)),('side',(1,0,0)),('top',(0,0,1)),('perspective',(1,-1,1))]:
        cam.location=Vector(center)+Vector(direction).normalized()*float(max(hi-lo)*3)
        cam.rotation_euler=(Vector(center)-cam.location).to_track_quat('-Z','Y').to_euler()
        s.render.filepath=str(out/(name+'.png')); bpy.ops.render.render(write_still=True)
    print(json.dumps(report, indent=2), flush=True)

if __name__ == '__main__': main()
