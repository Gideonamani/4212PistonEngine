"""Evaluate the two controlled edits after CAD-to-GLB vertex verification."""
from pathlib import Path
import hashlib,json
repo=Path(__file__).resolve().parents[1]
variants=json.loads((repo/'data/propagation-variants.json').read_text())
def load(name):
    folder=repo/'build'/name
    manifest=json.loads((folder/'cad-manifest.json').read_text())
    verification=json.loads((folder/'verification.json').read_text())
    geometry=folder/'geometry.json'
    assert hashlib.sha256(geometry.read_bytes()).hexdigest()==manifest['geometry_sha256']
    assert verification['passed'] and 'maximum_vertex_set_error_m' in verification
    assert verification['source_sha256']==manifest['source_sha256']
    assert hashlib.sha256((folder/'engine.glb').read_bytes()).hexdigest()==verification['asset_sha256']
    data=json.loads(geometry.read_text());parts={p['id']:p for p in data['parts']}
    return data,parts,verification
def volume(part):
    vertices=part['vertices_mm'];total=0
    for ia,ib,ic in part['triangles']:
        a,b,c=vertices[ia],vertices[ib],vertices[ic]
        total+=a[0]*(b[1]*c[2]-b[2]*c[1])+a[1]*(b[2]*c[0]-b[0]*c[2])+a[2]*(b[0]*c[1]-b[1]*c[0])
    return abs(total/6)
base,bparts,bcheck=load('pipeline-baseline')
report={'scope':'Controlled CAD edits through Blender/GLB geometry; browser interaction and motion-profile propagation remain open',
        'baseline_asset_sha256':bcheck['asset_sha256'],'checks':[]}
for variant in variants['variants']:
    data,parts,check=load('pipeline-'+variant['name'])
    assert check['source_sha256']==variant['sha256']
    assert set(parts)==set(bparts)
    assert all((p['label'],p['material_category'],p['group'])==(bparts[k]['label'],bparts[k]['material_category'],bparts[k]['group']) for k,p in parts.items())
    row={'variant':variant['name'],'source_sha256':variant['sha256'],'asset_sha256':check['asset_sha256'],
         'stable_ids_labels_materials_preserved':True,'maximum_vertex_set_error_m':check['maximum_vertex_set_error_m']}
    if variant['name']=='fin-change':
        before,after=volume(bparts['CylinderHead']),volume(parts['CylinderHead'])
        assert after>before+1
        assert data['groups']==base['groups'] and data['dimensions_mm']['RodLength']==base['dimensions_mm']['RodLength']
        row.update({'head_fin_thickness_mm':variant['head_fin_thickness_mm'],'head_mesh_volume_before_mm3':before,'head_mesh_volume_after_mm3':after})
    elif variant['name']=='rod-change':
        shift=data['groups']['Piston']['translation_mm'][0]-base['groups']['Piston']['translation_mm'][0]
        extent=max(p[0] for p in parts['ConnectingRodBody']['vertices_mm'])-max(p[0] for p in bparts['ConnectingRodBody']['vertices_mm'])
        assert abs(shift-2)<1e-6 and abs(extent-2)<1e-6
        assert abs(data['dimensions_mm']['RodLength']-base['dimensions_mm']['RodLength']-2)<1e-6
        row.update({'piston_bind_translation_change_mm':shift,'rod_mesh_extent_change_mm':extent})
    report['checks'].append(row)
assert len(report['checks'])==2
report['passed']=True
(repo/'data/propagation-package-check.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
