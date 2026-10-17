"""Expand the checked core into the source-accounted static engine, module by module."""
import argparse
import copy
import hashlib
import json
from pathlib import Path
from cad_pipeline.gtsio_core import build as core
from cad_pipeline.gtsio_assembly import Assembly
from cad_pipeline.research_gate import review
from cad_pipeline.spec import validate_spec
from cad_pipeline.gtsio_layout import StaticEngineLayout

STUDY=Path('cad-studies/gtsio520-h-static')
CASE_NAMES=[
 'Oil gauge rod','O-ring','Screw','Oil gauge tube','O-ring','Gauge lock ring','Oil filler cap and retainer','Filler cap gasket','Oil filler neck','Filler neck gasket',
 'Hex nut','Lock washer','Plain washer','Cover','Cover gasket','Breather hose clamp','Hose','Hose','Breather tee','Hex nut','Lock washer','Plain washer','Needle bearing housing','Needle bearing','Housing gasket','Hex nut','Lock washer','Idler support pin','Idler support gasket','Hex bolt','Plain washer','O-ring','Hex bolt','Plain washer','Hex bolt','Lock washer','Plain washer','Hex bolt','Plain washer','Hex bolt','Lock washer','Plain washer','Hex nut','Lock washer','Plain washer','Washer','Governor pad cover','Governor cover gasket',
 'Hex nut','Lock washer','Plain washer','Hex bolt','Hex nut','Lock washer','Plain washer','Hex bolt','Plain washer','Nut','Lock washer','Plain washer','Hex bolt','Hex bolt','Plain washer','Front lifting eye','Hex nut','Lock washer','Plain washer','Hex bolt','Plain washer','Plain washer','Flanged nut','Spacer','Hex nut','Plain washer','Hex nut','Lock washer','Plain washer','Hex screw','Lifting eye','Spacer','Hex nut','Lock washer','Plain washer','Hex bolt','Plain washer','Hex nut','Lock washer','Plain washer','Hex screw','Manifold valve and bracket','Hex nut','Lock washer','Plain washer','Hex bolt','Rear lifting eye','Spacer',
 'Hex bolt','Stud','Right lifting eye','Left lifting eye','Flanged nut','Plain washer','Flanged nut','Plain washer','Hex nut','Lock washer','Plain washer','Engine mount bracket','Thread insert','Hex nut','Lock washer','Plain washer','Flanged nut','Plain washer','Engine mount bracket','Thread insert','Timing plug','Timing plug valve','Timing indicator pin','Through bolt','Through bolt','Through bolt','Through bolt','Through bolt','Through bolt','Left crankcase','Right crankcase','Hex nut','Lock washer','Plain washer','Engine mount bracket','Thread insert','Hex nut','Lock washer','Plain washer','Engine mount bracket','Thread insert','Breather tube','Drive screw','Identification plate','Needle bearing','Squirt nozzle','O-ring']


def build(modules=('dampers',)):
    if 'valvetrain' in modules and not {'case','cylinders'}<=set(modules):raise ValueError('Valve train requires case and cylinder modules')
    complete_cylinders='cylinders' in modules
    layout=StaticEngineLayout(complete_cylinders=complete_cylinders);sp,_=core(layout=layout);sp=copy.deepcopy(sp);sp['model_id']='gtsio520-h-static-engine-v1'
    sp['scope']='GTSIO-520-H detailed static engine rebuild; current modelled modules: '+', '.join(modules)+'. Calculated estimates explicit; no operating clip or manufacturing certification.'
    sp['presentation']['footer']='Static engine rebuild | Source anchors + calculated estimates | Animation follows static completion'
    a=Assembly(sp)
    a.parameter('blade_width',8.4,'Retain the checked blade thickness independently of the enlarged cheek packaging')
    a.refresh()
    sp['layout']=dict(main_width_mm=layout.MAIN_WIDTH,cheek_width_mm=layout.CHEEK_WIDTH,pin_width_mm=layout.PIN_WIDTH,bay_pitch_mm=layout.BAY_PITCH,
                     rationale='Axial estimates recalibrated for 24.4 mm damper mass and complete head hardware; original R4 layout archived')
    from cad_pipeline import gtsio_dampers
    if 'dampers' in modules:gtsio_dampers.add(a,layout=layout,**dict(outer_radius=85.,inner_radius=73.) if complete_cylinders else {})
    if 'case' in modules:
        from cad_pipeline import gtsio_crankcase
        gtsio_crankcase.add(a,layout=layout,**dict(deck_pattern=gtsio_crankcase.CYLINDER_DECK_PATTERN,deck_halfspan=80.,stud_end=177.2) if complete_cylinders else {})
    if 'cylinders' in modules:
        from cad_pipeline import gtsio_cylinders
        gtsio_cylinders.add(a,layout=layout)
        sp['model_id']='gtsio520-h-static-engine-v3'
        sp['presentation']['group_titles'].update(cylinders='Six finned steel cylinder barrels',cylinder_heads='Aluminium heads and integral rocker boxes',valves='Inclined valves, seats and guides',valve_springs='Nested valve springs',rockers='Rocker shafts, sleeves and forged levers',rocker_covers='Stamped rocker covers and gaskets',spark_plugs='Twelve spark-plug interfaces')
    if 'valvetrain' in modules:
        from cad_pipeline import gtsio_valvetrain
        gtsio_valvetrain.add(a,layout)
        sp['model_id']='gtsio520-h-static-valvetrain-v1'
        sp['presentation']['group_titles'].update(camshaft='Four-journal nine-lobe camshaft',hydraulic_lifters='Twelve hydraulic lifter assemblies',pushrods='Hollow spherical-ended pushrods',pushrod_housings='Beaded housings, seals and seating springs',rocker_retention='Rocker shaft retainers and hardware')
    inv=copy.deepcopy(json.loads(Path('cad-studies/gtsio520-h-realism/inventory.json').read_text()))
    inv['target']='GTSIO-520-H detailed static engine rebuild'
    inv['decision']=sp['scope']
    inv['reviewed_locators']+=['A-4-18 PDF35-36','A-4-30 PDF43','B-2 PDF93 rows39,50,51,52','Table11 PDF117','Foundation assembly A-12-1/2/3 PDF77-79']
    if 'cylinders' in modules:inv['reviewed_locators']+=['A-3-1 PDF16 cylinders/valve train','A-4-17 PDF34 complete 51-callout figure and legend','A-4-23 PDF40 machining section','A-4-34/36/37 PDF46 springs/rockers/baffle','Table of limits PDF92','Table6 PDF103']
    inv['components'] += [dict(id=f'A-4-18:{i}',name=name,locator=f'X-30045A A-4-18 PDF35-36 callout {i}',source_ids=['manual'],
        function=name+' within the split crankcase/attachment construction.',interfaces=['See foundation-research.md and source figure/key'],
        disposition='deferred',part_ids=[],decision='Unbuilt identity retained in the static-engine backlog.') for i,name in enumerate(CASE_NAMES,1)]
    if 'valvetrain' in modules:
        inv['reviewed_locators']+=['A-3-1/2 PDF16-17','A-4-10 PDF27 complete 16-key section','A-4-19 PDF37 complete 7-key figure','A-4-36 PDF46','A-12-7 PDF80','Table6 PDF103-104']
        for fig,names in [('A-4-19',gtsio_valvetrain.CAM_NAMES),('A-4-10',gtsio_valvetrain.LIFTER_NAMES)]:
            inv['components'] += [dict(id=f'{fig}:{i}',name=name,locator=f'X-30045A {fig} callout {i}',source_ids=['manual'],function=name+' in the valve-train construction',interfaces=['valvetrain-plan.md'],disposition='deferred',part_ids=[],decision='Retained as unbuilt identity until mapped') for i,name in enumerate(names,1)]
    by_id={c['id']:c for c in inv['components']}
    for locator,ids in a.mapping.items():
        if locator not in by_id:
            by_id[locator]=dict(id=locator,name=locator,locator='X-30045A '+locator,source_ids=['manual'],function='Static-engine supporting component',interfaces=['foundation-research.md'],disposition='deferred',part_ids=[],decision='Pending')
            inv['components'].append(by_id[locator])
        c=by_id[locator];c['part_ids']=sorted(set(c['part_ids']+ids));c['disposition']='simplified'
        c['decision']='Source construction represented; selected geometry/contours/positions remain calculated estimates. Native part evidence identifies scope.'
    inv['expected_callouts']=[c['id'] for c in inv['components']]
    inv['mechanisms'] += [dict(id='damper',path='Crank blade race > tangent roller > fork races > crescent mass > retaining plates/rings',
        components=['A-4-20:8','A-4-20:9','A-4-20:10','A-4-20:11','A-4-20:12'],source_ids=['manual'],
        checks=['two race contacts','fork clearance','pin end clearance','closed retaining grooves','all pair intersections'])]
    if 'valvetrain' in modules:
        inv['mechanisms'] += [dict(id='valve-train',path='Cam lobe > flat hydraulic lifter face > socket > constant-length hollow pushrod > spherical rocker cup > curved rocker pad > valve and compressed springs',components=['A-4-19:7']+[f'A-4-10:{i}' for i in range(1,17)]+[f'A-4-17:{i}' for i in [6,7,8,10,11,12,13,14,15,16,17,18,23,24,25,26,27,29,30,51]],source_ids=['manual'],checks=['positive cam curvature','follower face coverage','rod-length closure','curved pad/stem tangency','spring installed gap','shaft retention side clearance','all exact pairs','saved/native/export checks'],status='Inferred harmonic static pose; manufacturer cam law and timing unverified')]
    inv['gaps']=[dict(topic='Remaining static modules',blocks_selected_scope=False,
                     modelling_consequence='Only generated modules count as completed; animation follows full static completion.',
                     next_evidence='Continue reviewed cylinder, reduction, accessory and H-specific subsystem figures.'),
                 dict(topic='Estimated dimensions and hidden routes',blocks_selected_scope=False,
                     modelling_consequence='No manufacturing/dynamics claim; keep unverified routing explicit.',next_evidence='Applicable manufacturing drawings or workshop measurements.')]
    validate_spec(sp);result=review(inv,[p['id'] for p in sp['parts']])
    return sp,inv,result


def main():
    p=argparse.ArgumentParser();p.add_argument('--modules',nargs='+',choices=['dampers','case','cylinders','valvetrain'],default=['dampers']);p.add_argument('--output',type=Path,default=STUDY);args=p.parse_args()
    sp,inv,readiness=build(args.modules);study=args.output;study.mkdir(parents=True,exist_ok=True)
    path=study/'inventory.json';path.write_text(json.dumps(inv,indent=2)+'\n')
    sp['research']=dict(inventory_path=path.as_posix(),inventory_sha256=hashlib.sha256(path.read_bytes()).hexdigest())
    (study/'part-spec.json').write_text(json.dumps(sp,indent=2)+'\n')
    (study/'research-readiness.json').write_text(json.dumps(readiness,indent=2)+'\n')
    print(json.dumps(dict(parts=len(sp['parts']),modules=args.modules,research=readiness),indent=2))


if __name__=='__main__':main()
