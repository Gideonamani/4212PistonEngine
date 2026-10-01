"""Export the reviewed Blender cylinder at its closed zero-degree browser bind pose."""
from pathlib import Path
import bpy,json,hashlib,gzip,sys
repo=Path(__file__).resolve().parents[1]
revision=repo.parent/'EngineSimulation/FreeCAD/v3'
sys.path.insert(0,str(repo/'scripts'))
from compact_cylinder_glb import compact_glb
scene=bpy.context.scene;scene.frame_set(1)
parts=[o for o in bpy.data.objects if o.type=='MESH' and o.get('cad_part_id')]
assert len(parts)==61
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
 o.hide_set(False);o.hide_render=False;o.select_set(True)
 if o.data.shape_keys:
  o.data.shape_keys.key_blocks[1].name='ValveLift7mm'
  o.data.shape_keys.key_blocks[1].value=0
path=repo/'web/cylinder-reviewed-20261001.glb'
bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
 export_extras=True,export_animations=False,export_morph=True,export_morph_normal=True)
precision=compact_glb(path)
raw=path.read_bytes();packed=gzip.compress(raw,compresslevel=9,mtime=0)
path.with_suffix('.glb.gz').write_bytes(packed)
verification=json.loads((revision/'cad_verification.json').read_text())
geometry=json.loads((revision/'blender_geometry.json').read_text());dimensions=geometry['parameters']
offsets={'Cylinder':0,'Crank':0,'ConnectingRod':dimensions['Stroke']/2,'Piston':dimensions['Stroke']/2+dimensions['RodLength']}
bounds={p['id']:[(min(v[0] for v in p['vertices_mm'])+offsets[p['group']])/1000,min(v[2] for v in p['vertices_mm'])/1000,-max(v[1] for v in p['vertices_mm'])/1000,
 (max(v[0] for v in p['vertices_mm'])+offsets[p['group']])/1000,max(v[2] for v in p['vertices_mm'])/1000,-min(v[1] for v in p['vertices_mm'])/1000] for p in geometry['parts']}
record={'schema_version':1,'release_id':'cylinder-reviewed-20261001','delivery':'GitHub Pages versioned gzip asset',
 'source_cad':'../EngineSimulation/FreeCAD/v3/GTSIO520H_Reviewed_Cylinder.FCStd',
 'cad_sha256':verification['cad_sha256'],'parent_cad_sha256':verification['parent_sha256'],
 'source_blender':'../EngineSimulation/FreeCAD/v3/GTSIO520H_Operating_Cylinder.blend',
 'blender_sha256':hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest(),
 'asset_file':path.relative_to(repo).as_posix(),'asset_sha256':hashlib.sha256(raw).hexdigest(),'asset_bytes':len(raw),
 'transport_file':path.with_suffix('.glb.gz').relative_to(repo).as_posix(),
 'transport_sha256':hashlib.sha256(packed).hexdigest(),'transport_bytes':len(packed),
 'parts':sorted(o['cad_part_id'] for o in parts),'bind_angle_deg':0,
 'scope':'GTSIO-520-H teaching reconstruction; illustrative ideal valve timing and lift; chamber volume not calibrated',
 'cad_checks':verification,'blender_checks':json.loads((revision/'blender_verification.json').read_text()),'presentation_precision':precision,'cad_bind_bounds_gltf_m':bounds}
(repo/'releases/cylinder-reviewed-20261001.json').write_text(json.dumps(record,indent=2)+'\n')
print('REVIEWED_CYLINDER_EXPORTED',len(raw),len(packed),flush=True)
