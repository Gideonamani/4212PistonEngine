"""Seed the planning catalogue from existing, reviewed teaching assets."""
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parent;ENGINE=ROOT.parent/'EngineSimulation';OUT=ROOT/'data';OUT.mkdir(exist_ok=True)
catalog=json.loads((ENGINE/'FreeCAD/videos/component_catalog.json').read_text())
refs=json.loads((ENGINE/'FreeCAD/v2/reference_register.json').read_text())
parts=[]
for r in catalog:
    parts.append({'definition_id':'gtsio520h:cad:'+r['id'],'cad_stable_id':r['id'],'display_name':r['title'],'function':r['function'],
        'manufacturer_part_number':None,'source_module':'current-cylinder-study','function_source_summary':r['source'],
        'geometry_evidence_status':'mixed; see existing CAD reference register','structured_claim_review':'pending',
        'existing_study_instance':'cylinder-study:'+r['id'],'web_asset':None})
assert len(parts)==60 and len({p['definition_id'] for p in parts})==60
(OUT/'component-registry.json').write_text(json.dumps({'schema_version':'0.1-draft','status':'planning seed; not a completed evidence audit','engine_variant':'GTSIO-520-H','parts':parts},indent=2))
evidence={'schema_version':'0.1-draft','purpose':'Examples based on the existing CAD-stage review; extend into a complete ledger before release automation.',
 'source':{'document_id':'Continental X-30045A','local_reference':'Notes/gtsio520_series.pdf','sha256':refs['manual_sha256'],'revision_applicability_review':'To be recorded explicitly for each future module.'},
 'claims':[
 {'claim_id':'finished-bore-range','component':'gtsio520h:cad:CylinderBarrel','property':'finished_lower_bore','source_range':[5.251,5.253],'source_units':'in','adopted_value':133.4008,'adopted_units':'mm','selection_rule':'Midpoint of source range, multiplied by 25.4','evidence_category':'documented range; derived modelling selection','locations':['A-4-23 / PDF40','B-1 / PDF92']},
 {'claim_id':'four-ring-production','component':'gtsio520h:cad:PistonBody','property':'production_ring_count','source_value':4,'evidence_category':'documented','applicability':'A-3-2 states engines built since 1975; specific piston configuration still requires checking','locations':['A-3-2 / PDF17','A-4-17 / PDF34'],'limitation':'The four ring cross-sections and axial allocation in the current model remain reconstructed.'},
 {'claim_id':'exhaust-inclination-uncertainty','component':'gtsio520h:cad:ExhaustValve','property':'inclination','adopted_value':15,'adopted_units':'deg','evidence_category':'unresolved source annotation; provisional model value','locations':['A-4-23 / PDF40'],'limitation':'Scan upper annotation reads 15 deg 60 min above 14 deg 54 min; do not silently treat the adopted 15 deg as verified.'},
 {'claim_id':'teaching-valve-lift','components':['gtsio520h:cad:IntakeValve','gtsio520h:cad:ExhaustValve'],'property':'animation_maximum_lift','adopted_value':7,'adopted_units':'mm','evidence_category':'illustrative','source_location':None,'limitation':'Chosen for the current teaching animation, not extracted as manufacturer lift data.'}
 ]}
(OUT/'evidence-examples.json').write_text(json.dumps(evidence,indent=2))
(ROOT/'project.json').write_text(json.dumps({'name':'4212PistonEngine','status':'local planning foundation','repository_created':False,'website_implemented':False,
 'preferred_architecture':{'cad':'FreeCAD','presentation':'Blender','web_exchange':'GLB plus catalogue and operation manifest','viewer':'Three.js (proposed)','hosting':'GitHub Pages initially (proposed)'},
 'presentation_preferences':{'background_music':'Soft Quiet Workshop score by default for presentation videos','retain_silent_versions':True,'music_fades':True,'web_music':'User-controlled; start only after user interaction','captions':'Component name and function below the model'},
 'first_milestone':'Interactive cylinder plus a verified CAD-edit propagation exercise','source_ownership':{'dimensions_and_datums':'CAD','functions_and_evidence':'shared catalogue','materials_and_cameras':'Blender','interaction':'web'}},indent=2))
print('SEEDED',len(parts),'stable component mappings and four evidence examples',flush=True)
