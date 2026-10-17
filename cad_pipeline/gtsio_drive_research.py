"""Reviewed source identities and selected scope, before the static drive feature plan."""
import argparse
import hashlib
import json
from pathlib import Path
from cad_pipeline.research_gate import review

ROOT=Path(__file__).resolve().parents[1]
STUDY=ROOT/'cad-studies/gtsio520-h-static/drive-development'
BASE=ROOT/'cad-studies/gtsio520-h-static/valvetrain-development'


def additions():
    mapping={
        'A-4-20:13':['CrankGearScrew'+str(n) for n in range(1,7)],
        'A-4-20:15':['CrankshaftGear'], 'A-4-20:16':['QuillRetainingRing'],
        'A-4-20:17':['QuillPlateScrew1','QuillPlateScrew2'], 'A-4-20:18':['QuillPlate'],
        'A-4-20:19':['ReductionPinion'], 'A-4-20:20':['QuillShaft'],
        'A-4-20:24':['PropellerOilSeal'], 'A-4-20:25':['SealReinforcementRing'], 'A-4-20:26':['SealGarterSpring'],
        'A-4-20:27':['PropellerShaft'], 'A-4-20:28':['PropellerTransferSleeve'],
        'A-4-20:29':['PropellerTransferTube'], 'A-4-20:30':['PropellerRearSleeve'], 'A-4-20:31':['PropellerTransferORing'],
        'A-4-20:32':[f'Propeller{station}Bearing{side}' for station in ('Front','Rear') for side in ('Left','Right')],
        'A-4-20:33':[f'PropellerThrust{station}{side}' for station in ('Front','Aft') for side in ('Left','Right')]
                    +['PropellerThrustPinFront','PropellerThrustPinAft'],
        'A-4-20:38':['ReductionBearingLeft','ReductionBearingRight'], 'A-4-20:40':['CrankGearDowel'],
        'A-4-19:4':['CamGearScrew'+str(n) for n in range(1,5)],
        'A-4-19:5':['CamClusterGear'], 'A-4-19:6':['CamshaftGear'],
        'A-4-18:120':['FrontCaseThroughBolt1','FrontCaseThroughBolt2'],
        'A-4-18:122':['FrontCaseThroughBolt'+str(n) for n in range(3,7)],
        'A-4-18:128':[f'FrontCaseNut{n}{side}' for n in range(1,7) for side in ('Left','Right')],
        'A-4-18:129':[f'FrontCaseLockWasher{n}{side}' for n in range(1,7) for side in ('Left','Right')],
        'A-4-18:130':[f'FrontCaseWasher{n}{side}' for n in range(1,7) for side in ('Left','Right')],
    }
    return mapping


def build_inventory(flange='D'):
    inv=json.loads((BASE/'inventory.json').read_text())
    base_spec=json.loads((BASE/'part-spec.json').read_text())
    mapping=additions()
    for c in inv['components']:
        if c['id'] not in mapping:continue
        c['part_ids']=list(dict.fromkeys(c['part_ids']+mapping[c['id']]))
        c.update(disposition='simplified',decision='Documented construction, estimated detail/packaging; see drive-development/research.md',
                 function=c['name']+': torque transmission, shaft support, axial retention or sealing in the reviewed drive assembly.',
                 interfaces=['Matched shafts/gear faces, journal seats, retention or oil-transfer interfaces; see reviewed drive packaging record'])
    names=['Crankshaft gear','Crankshaft','Camshaft cluster gear','Camshaft','Hydraulic tappet',
           'Governor drive bevel gear','Governor driven bevel gear','Oil pump and tach drive shaftgear',
           'Oil pump driven gear','Scavenge driven gear','Scavenge driver gear','Idler gear assembly',
           'Idler gear support pin','Left magneto drive gear','Right magneto drive gear','Starter',
           'Worm drive shaft','Starter worm gear','Starter worm wheel','Clutch spring','Starter shaftgear',
           'Fuel pump drive gear','Quillshaft gear (printed label)','Prop shaft drive gear','Prop shaft']
    linked={1:['CrankshaftGear'],2:['Crankshaft'],3:['CamshaftGear','CamClusterGear'],4:['Camshaft'],
            5:[p['id'] for p in base_spec['parts'] if p['group']=='hydraulic_lifters'],
            23:['QuillShaft'],24:['ReductionPinion'],25:['PropellerShaft']}
    for n,name in enumerate(names,1):
        ids=linked.get(n,[]);id='A-4-8:'+str(n)
        inv['components'].append(dict(id=id,name=name,locator=f'X-30045A Figure A-4-8, printed A-4-5, PDF25, key {n}',
            source_ids=['manual'],function='Drive-path identity: '+name,
            interfaces=['A-3-2 describes the torque connection; A-4-19/20 separate the physical pieces'],
            disposition='simplified' if ids else 'deferred',part_ids=ids,
            decision='Matched to generated drive/valve-train identities' if ids else 'Accessory branch retained for its subsequent module'))
        inv['expected_callouts'].append(id)
    inv['sources']['hartzell_flange']=dict(url='https://hartzellprop.com/wp-content/uploads/2012/12/SB227-R06-W.pdf',
        title='Hartzell HC-SB-61-227 Figure1 flange table',organization='Hartzell Propeller Inc.',revision='Revision6, 2012-08-27',
        locator='Printed p3 / PDF5',sha256='f1a582852a002e23f46d6410e31b3f9ca0bbf3eb6134fcb273cffb3aec427678',
        variant='GTSIO family D/N interfaces; H serial-number applicability unverified',accessed='2026-10-10')
    inv['configuration']=dict(flange_pattern=flange,selection_status='inferred',serial_number_applicability_verified=False)
    inv['decision']='GTSIO-520-H static core, cylinders, valve train and selected cam/reduction/propeller support. Estimated packaging and '+flange+'-family flange choice explicit; no manufacturing or operating certification.'
    inv['reviewed_locators']+=['A-4-4 PDF23 H photograph','A-4-8 PDF25 complete figure and 25-key legend',
        'A-4-40 PDF48 timing marks','A-4-41/42 PDF49 propeller shaft/seal photographs',
        'B-2/3 PDF93-94 shaft/endplay/backlash rows','B-2 PDF97 longitudinal section','Table6 PDF103 300dpi tube/sleeve crop',
        'H C-3-2/3 PDF152-153','Hartzell HC-SB-61-227 Figure1 printed p3/PDF5']
    inv['conflicts'] += [dict(topic='Printed transfer tube limits descend',decision='Preserve .4965-.4960; sorted endpoints determine midpoint. Checked original 300dpi table crop.'),
        dict(topic='Small sleeve OD .4095 lower endpoint conflicts with matching .4695-.4705 case row',decision='Use matching interface and B-2 press-fit range as compatible anchor; retain printed conflict and distinguish assembled contact from free-part interference.'),
        dict(topic='Propeller flange D/N family variants',decision='Select '+flange+' family as a declared teaching choice. Eight attachments are source-backed; exact H serial applicability and outer contour remain unverified.'),
        dict(topic='A-4-8 key23 says Quillshaft gear',decision='Construction text and A-4-20 key20 identify the separate quill shaft; map that identity, do not invent another wheel.')]
    inv['mechanisms'] += [dict(id='rear_cam_drive',source_ids=['manual'],
        components=['A-4-8:1','A-4-8:3','A-4-19:4','A-4-19:5','A-4-19:6'],
        path='Crankshaft flange/dowel/screws -> rear crank spur gear -> cam spur gear -> unequal flange screws -> camshaft; cluster retained for fuel branch',
        checks=['Shared declared pitch distance/module and solved phase','Half-speed ratio','Tooth-pitch and final assembly clearance','Saved gear/profile and attachment datums']),
        dict(id='front_reduction_drive',source_ids=['manual'],
        components=['A-4-20:'+str(n) for n in (16,17,18,19,20,27,32,33,38)],
        path='Crank internal socket -> reduced-section quill -> splined reduction pinion -> integral propeller spur gear/shaft -> selected flange; bearings/washer stack react radial and axial loads',
        checks=['Two positive spline engagement lengths and captured ends','2/3 ratio versus printed 0.667','Full tooth-pitch clearance','Source diameters/clearances/endplay','Case-supported journal seats','No neighbour overlap']),
        dict(id='propeller_oil_transfer',source_ids=['manual'],
        components=['A-4-20:'+str(n) for n in (24,25,26,28,29,30,31)],
        path='Case supply interface (hidden governor gallery deferred) -> right-angle rear sleeve -> axial tube -> forward stepped sleeve -> propeller outlet',
        checks=['Open connected modeled passage','Tube/sleeve radial clearance','Assembled press seat and separate seal cavities','Stationary sleeve versus rotating shaft clearance'])]
    inv['gaps'] += [dict(topic='OEM gear/spline profiles and clocking',blocks_selected_scope=False,next_evidence='X-30046A, applicable drawings or measured original parts',modelling_consequence='Counts, module, pressure angle, spline form and absolute clocking remain estimates; no operation claim'),
        dict(topic='Cast contours and bearing/thrust details',blocks_selected_scope=False,next_evidence='Dimensioned sections or measured H case/shaft',modelling_consequence='Fitted source-sized seats and checked axial stacks inside estimated case contours'),
        dict(topic='Press elasticity, hidden galleries and exact H flange option',blocks_selected_scope=False,next_evidence='Material/fit analysis, applicable serial-number drawings and source measurements',modelling_consequence='Assembled contact for press seats; hidden supply stops at documented interface; '+flange+' flange selection explicit')]
    planned=set(p['id'] for p in base_spec['parts'])|{id for ids in mapping.values() for id in ids}
    result=review(inv,planned)
    STUDY.mkdir(parents=True,exist_ok=True)
    (STUDY/'inventory.json').write_text(json.dumps(inv,indent=2)+'\n',encoding='utf-8')
    (STUDY/'research-readiness.json').write_text(json.dumps(result,indent=2)+'\n')
    return inv,result


def main():
    p=argparse.ArgumentParser();p.add_argument('--flange',choices=['D','N'],default='D');a=p.parse_args()
    _,result=build_inventory(a.flange);print(json.dumps(result),flush=True)


if __name__=='__main__':main()
