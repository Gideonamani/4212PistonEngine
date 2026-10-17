"""Freeze the user-selected static development input and prepare animation scope.

Standard library only. This creates planning/evidence records, never geometry,
keys, an operating claim, or an animation release.
"""
from collections import defaultdict
from datetime import datetime,timezone
from pathlib import Path
from cad_pipeline.crankcase_contour_sources import read,write,binding,sha,STUDY

ROOT=Path('build/gtsio520-case-contours-r10')


def main():
    decision=read(STUDY/'contour-wrap-decision.json')
    if decision['selected_candidate']!=ROOT.as_posix():raise ValueError('Explicit selected wrap candidate required')
    workers=read(ROOT/'wrap-worker-check.json')
    if not workers['passed'] or workers['owned_heavy_workers']:raise ValueError('Confirm owned heavy workers have finished')
    if (datetime.now(timezone.utc)-datetime.fromisoformat(workers['recorded_at'])).total_seconds()>600:raise ValueError('Refresh worker check before freezing')
    handoff=read(STUDY/'session-handoff-status.json')
    for expected in [handoff['preserved_source_native'],*handoff['evidence']]:
        if binding(expected['path'])!=expected:raise ValueError('Preserved source changed: '+expected['path'])
    spec=read(ROOT/'part-spec.json');geo=read(ROOT/'development/geometry.json');direct=read(ROOT/'direct-build.json')
    ids=[p['id'] for p in spec['parts']];meshids=[p['id'] for p in geo['parts']]
    if len(ids)!=1396 or len(set(ids))!=len(ids) or set(ids)!=set(meshids) or len(meshids)!=len(ids):raise ValueError('Complete unique1396-part input required')
    if not direct['passed'] or direct['spec_sha256']!=sha(ROOT/'part-spec.json') or direct['geometry_sha256']!=sha(ROOT/'development/geometry.json'):raise ValueError('Changed direct input')
    if any(not p['valid'] or p['solids']!=1 or p['volume_mm3']<=0 for p in geo['parts']):raise ValueError('Invalid direct part')
    proofs={}
    for name in ['direct-build.json','context-checks.json','case-stock-direct-checks.json','gallery-direct-checks.json']:
        proof=read(ROOT/name)
        if not proof['passed'] or proof.get('spec_sha256',proof.get('spec',{}).get('sha256'))!=sha(ROOT/'part-spec.json'):raise ValueError('Current scoped proof required: '+name)
        proofs[name]=binding(ROOT/name)
    groups=defaultdict(list)
    for p in spec['parts']:groups[p['group']].append(p['id'])
    seeds=[]
    def seed(id,members,law):
        if any(p not in ids for p in members):raise ValueError('Missing seeded body member: '+id)
        seeds.append(dict(id=id,part_ids=members,law=law,status='Planning seed; actual joint/pivot/rest-pose and swept export checks required'))
    seed('crank',['Crankshaft','CrankshaftGear','CrankGearDowel']+[f'CrankGearScrew{n}' for n in range(1,7)],'Crank master; reference angle/axis from frozen source frame')
    seed('cam',['Camshaft','CamshaftGear','CamClusterGear']+[f'CamGearScrew{n}' for n in range(1,5)],'accessory_gears.gtsio_cam_rate(); retain declared indexing and inferred valve law')
    for n in range(1,7):
        seed('rod'+str(n),[prefix+str(n) for prefix in ['ConnectingRod','RodCap','RodBearingUpper','RodBearingLower','SmallEndBush','RodBoltA','RodNutA','RodBoltB','RodNutB']],
            'Shared slider-crank solution using frozen throw, rod length, bank station and phase')
        seed('piston'+str(n),[prefix+str(n) for prefix in ['Piston','PistonPin','PinPlugA','PinPlugB','CompressionRingA','CompressionRingB','OilRing','ScraperRing']],
            'Same slider-crank solution; ring compliance and pin spin are outside the first teaching cycle')
    seed('propeller',['PropellerShaft'],'Shared declared reduction drive; documented nominal ratio and estimated tooth geometry remain distinct')
    assigned=[p for s in seeds for p in s['part_ids']]
    if len(assigned)!=len(set(assigned)):raise ValueError('A physical part cannot belong to two rigid seeds')
    comparison=read(ROOT/'comparison/comparison-evidence.json')
    for view in comparison['views']:
        for key in ['scene','diagnostic_glb','render','comparison']:
            if sha(view[key]['path'])!=view[key]['sha256']:raise ValueError('Changed comparison evidence')
    face=read(ROOT/'development/face-cache-adoption.json')
    from cad_pipeline.part_retirement import digest as spec_hash
    if face['new_spec_sha256']!=spec_hash(spec):raise ValueError('Face adoption belongs to another candidate')
    current={r['id']:r for r in read(ROOT/'development/cache-adoption.json')['adopted']}
    for row in face['adopted']:
        if row['brep_sha256']!=current[row['id']]['brep_sha256']:raise ValueError('Face geometry changed')
        file=ROOT/'development/brep-cache'/(row['id']+'-'+current[row['id']]['new_key']+'.brep')
        if sha(file)!=row['brep_sha256']:raise ValueError('Actual accepted face BREP changed')
    result=dict(recorded_at=datetime.now(timezone.utc).isoformat(),phase='Static contour work wrapped by user; animation planning',planning_only=True,complete_engine_acceptance=False,animation_baked=False,animation_release_allowed=False,
        user_decision=binding(STUDY/'contour-wrap-decision.json'),worker_check=binding(ROOT/'wrap-worker-check.json'),
        preparation_method=binding(Path(__file__)),handoff_notes=binding(STUDY/'animation-handoff.md'),
        motion_skill=binding('.agents/skills/mechanism-animation/SKILL.md'),
        selected_spec=binding(ROOT/'part-spec.json'),selected_geometry=binding(ROOT/'development/geometry.json'),selected_inventory=binding(ROOT/'inventory.json'),
        part_count=len(ids),groups=dict(groups),rigid_body_seeds=seeds,unassigned_operating_body_part_ids=sorted(set(ids)-set(assigned)),
        current_scoped_passes=proofs,source_native=handoff['preserved_source_native'],source_handoff=binding(STUDY/'session-handoff-status.json'),
        comparison=binding(ROOT/'comparison/comparison-evidence.json'),unchanged_face_adoption=binding(ROOT/'development/face-cache-adoption.json'),
        unintegrated_housing_fixture=binding(STUDY/'starter-housing-fixture-checks.json'),
        units=dict(cad='mm',blender='m',conversion='Divide actual CAD coordinates by1000once; keep XYZ and let the exporter perform glTF Y-up'),
        stage_order=[
            dict(id='exploded-collapsed',goal='Teach physical component groups, their interfaces and the assembly arrangement',
                proposal=['Identify/remove connectors before the parts they retain','Remove external accessories, covers and sump through checked routes',
                    'Clear pushrod housings and cylinder retention, then separate cylinder/head packages along their own bank axes',
                    'Remove remaining case clamps and open the independent case halves; retain split bearing ownership explicitly',
                    'Expose crank/rod/piston, cam and front/rear drive subassemblies; collapse follows the exact inverse path'],
                motion_definition='One shared part-to-body/stage transform definition. Stage endpoints and removal routes are not yet authored or accepted.',
                checks=['Actual exported rest pose','Every removal transit and held stage, including fractional samples between keys','Exact reverse collapse','Switch either clip back to the identical assembled pose']),
            dict(id='operating-cycle',goal='Show crank to rods/pistons and cam to lifters/pushrods/rockers/valves/springs, then supported accessory drives',
                definition_sources=[binding('cad_pipeline/gtsio_layout.py'),binding('cad_pipeline/gtsio_valvetrain_pose.py'),binding('cad_pipeline/gtsio_valve_layout.py'),binding('scripts/accessory_gears.py')],
                method='One shared matrix(part_id,theta)/pivot definition for rig, baker and audit. Bake720crank degrees at1degree spacing with fixed-axis node origins and linear interpolation.',
                spring_rule='Driven spring length changes along its own axis; do not translate a fixed-length spring as compression.',
                checks=['Slider-crank stroke and rod-length closure','Cam ratio, indexing and valve-event phases','Fixed axes and pivots','Contact chains and clearances between exported keys','Loop closure and clip switching'])],
        pending_before_animation_acceptance=['Complete current saved/native/direct agreement, real edit/reopening and STEP',
            'Every current saved-native bounding neighbor with hash-bound reuse counts','Current bearing/support stock, pressure walls/closures and independent returns',
            'Current installed moving envelopes and actual full static GLB audit','Full editable Blender master, part identity/unit checks and actual clip/transform audits'],
        contours_deferred=['Curved outer core/deck transitions; R10outside remains slab-like','Actual seam/through-bolt families and local flange piers','Separate mount/filler/breather/eye integration and housing installation','Selected guarded local blends and source-fidelity review'],
        open_motion_claims=['Whole-engine governor/tach direction','Alternator spring hand/preload/torque engagement','Starter clutch engagement and damper dynamics',
            'Hydraulic capacity, complete external oil routing and crankshaft drilling','Estimated gear counts/modules, accessory packaging and inferred cam law remain labelled'],
        policy='Local private preparation only. Preserve R2failure and incomplete R3state. No publishing, Drive upload or student-release replacement. User wrapped contour construction; no further contour work was started.')
    write(STUDY/'animation-handoff.json',result)
    for name in proofs:
        target=STUDY/('r10-'+name)
        if target.exists() and sha(target)!=sha(ROOT/name):raise ValueError('Preserve frozen proof: '+target.as_posix())
        if not target.exists():target.write_bytes((ROOT/name).read_bytes())
    print('ANIMATION_HANDOFF_PREPARED',len(ids),'parts;',len(groups),'groups;',len(seeds),'body seeds; planning only, no baked/accepted animation')


if __name__=='__main__':main()
