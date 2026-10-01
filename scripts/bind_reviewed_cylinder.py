"""Bind both viewer modes to the versioned reviewed cylinder release."""
from pathlib import Path
import json,gzip,hashlib
repo=Path(__file__).resolve().parents[1]
def read(p):return json.loads((repo/p).read_text())
def write(p,d):(repo/p).write_text(json.dumps(d,indent=2)+'\n')
r=read('releases/cylinder-reviewed-20261001.json')
raw=gzip.decompress((repo/r['transport_file']).read_bytes())
assert hashlib.sha256(raw).hexdigest()==r['asset_sha256']
catalogue=read('web/components.json')
assert len(catalogue['parts']) in [60,61]
catalogue['parts']=[p for p in catalogue['parts'] if p['cad_stable_id']!='FuelDischargeNozzle']
catalogue['parts'].append({'definition_id':'gtsio520h:cad:FuelDischargeNozzle','cad_stable_id':'FuelDischargeNozzle',
 'display_name':'Fuel discharge nozzle','function':'Delivers fuel continuously into the intake port outside the intake valve. This reconstructed nozzle is not timed direct injection.',
 'manufacturer_part_number':None,'source_module':'current-cylinder-study','function_source_summary':'X-30045A A-3-4 / physical PDF19',
 'geometry_evidence_status':'Component and injection function sourced; nozzle envelope and mounting station reconstructed',
 'structured_claim_review':'pending','existing_study_instance':'cylinder-study:FuelDischargeNozzle','web_asset':r['transport_file']})
catalogue['model_revision']=r['release_id'];write('web/components.json',catalogue)
profile=read('web/motion.json')
assert profile['valves']['source_sha256']==r['parent_cad_sha256']
profile.update(asset_sha256=r['asset_sha256'],model_revision=r['release_id'],cad_source_sha256=r['cad_sha256'])
profile['groups']['FuelDischargeNozzle']='Cylinder'
assert sorted(profile['groups'])==r['parts']==sorted(p['cad_stable_id'] for p in catalogue['parts'])
profile['scope']=r['scope']
profile['evidence_lineage']={'inherited_valve_and_spring_audit_source_sha256':r['parent_cad_sha256'],
 'current_cad_sha256':r['cad_sha256'],'unchanged_motion_solids':r['cad_checks']['unchanged_motion_solids'],
 'rule':'Inherited source hashes identify the original audits; they are not rewritten to imply a new complete collision audit.'}
write('web/motion.json',profile)
models=read('src/data/models.json');c=next(m for m in models if m['id']=='cylinder')
c['description']='Explore the revised GTSIO-520-H cylinder: 61 components, continuous-flow fuel nozzle, synchronized valve gear and a live section view.'
c['badges']=['61 components','Animated valve gear','Section view']
c['sources']=[{'localUrl':'./cylinder-reviewed-20261001.glb.gz','compressed':True,'transferBytes':r['transport_bytes'],'decodedBytes':r['asset_bytes']}]
c['componentCatalogueUrl']='./components.json?v=20261001-reviewed'
c['motionProfileUrl']='./motion.json?v=20261001-reviewed'
write('src/data/models.json',models)
config=read('web/config.json');config['status']='The reviewed cylinder is served directly from GitHub Pages. Other configured models retain their Drive delivery and local fallbacks.';write('web/config.json',config)
lessons=read('web/m2-cylinder-lessons.json');lessons['description']='Follow the revised GTSIO-520-H cylinder through a four-stroke teaching cycle, using the same 61-component model as Explore.';write('web/m2-cylinder-lessons.json',lessons)
print('Explore and Lesson Steps bound to',r['release_id'])
