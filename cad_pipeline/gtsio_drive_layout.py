"""Calculated static drive interfaces; gear axes/counts/phases come from their shared declaration."""
import math
import sys
from pathlib import Path
from cad_pipeline.spec import evaluate
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from accessory_gears import solve_gtsio_static_drive

FLANGES={'D':dict(bolt_circle=4.*25.4,bolt_diameter=.5*25.4,dowels=0),
         'N':dict(bolt_circle=4.25*25.4,bolt_diameter=.5625*25.4,dowels=2)}
SPLINE_COUNT=16                       # Explicit visual/construction estimate.


def parameters(flange='D'):
    gears=solve_gtsio_static_drive();p={}
    def add(name,value,note,status='inferred',source='manual',unit='mm',expression=None):
        if expression is not None:value=evaluate(expression,p)
        p[name]=dict(value=value,unit=unit,status=status,source_ids=[source],rationale=note)
        if expression is not None:p[name]['expression']=expression
    add('timing_module',gears['CrankshaftGear']['module_mm'],'Selected module closes the existing 126 mm cam/crank axis distance')
    add('reduction_module',gears['ReductionPinion']['module_mm'],'Selected module and tooth counts leave a supported pinion root around the source journal')
    add('reduction_teeth',gears['ReductionPinion']['teeth'],'Estimated count; ratio closes the rounded source 0.667',unit='count')
    add('propeller_teeth',gears['PropellerShaft']['teeth'],'Estimated count paired with reduction pinion',unit='count')
    add('propeller_axis_y',None,'Derived gear pitch-centre distance; not an OEM coordinate',expression='reduction_module*(reduction_teeth+propeller_teeth)/2')
    add('drive_gear_z',gears['ReductionPinion']['z'],'Estimated axial tooth-face station')
    add('drive_face_width',gears['ReductionPinion']['width'],'Estimated tooth face width')
    add('drive_gear_end',None,'Shared front face of both meshing wheels',expression='drive_gear_z+drive_face_width')
    add('reduction_journal_diameter',2.6245*25.4,'Table6 PDF103 midpoint 2.6240-2.6250 in','specified')
    add('propeller_journal_diameter',2.3738*25.4,'Table6 PDF103 midpoint 2.3733-2.3743 in','specified')
    add('reduction_seat_diameter',2.8165*25.4,'Table6 PDF103 midpoint 2.8160-2.8170 in','specified')
    add('propeller_seat_diameter',2.5630*25.4,'Table6 PDF103 midpoint 2.5625-2.5635 in','specified')
    add('drive_running_clearance',.0025*25.4,'B-2 rows40/41 midpoint .001-.004 in diametral clearance','specified')
    add('reduction_bearing_id',None,'Bearing bore includes source diametral running clearance',expression='reduction_journal_diameter+drive_running_clearance')
    add('propeller_bearing_id',None,'Bearing bore includes source diametral running clearance',expression='propeller_journal_diameter+drive_running_clearance')
    add('reduction_endplay',.0085*25.4,'B-2 row46 midpoint .0055-.0115 in','specified')
    add('propeller_endplay',.0100*25.4,'Selected value inside B-2 row45 .006-.0152 in','specified')
    add('reduction_bearing_width',35.,'Estimated supported bearing length')
    add('reduction_bearing_z',None,'Bearing centred in complete reduction shoulder stack',expression='drive_gear_end+reduction_endplay/2')
    add('reduction_collar_z',None,'Complete reduction endplay includes the full bearing width',expression='drive_gear_end+reduction_bearing_width+reduction_endplay')
    add('propeller_front_bearing_width',30.,'Estimated front bearing axial width')
    add('propeller_front_bearing_z',None,'Estimated front bearing station derived from the gear face',expression='drive_gear_end+59.5')
    add('propeller_rear_bearing_z',None,'Rear support lies wholly behind the rotating tooth envelope',expression='drive_gear_z-28')
    add('propeller_rear_bearing_width',24.,'Estimated rear journal support length')
    add('propeller_thrust_width',1.5,'Estimated each thrust-washer thickness')
    add('propeller_thrust_aft_z',None,'Aft washer immediately precedes the front bearing',expression='propeller_front_bearing_z-propeller_thrust_width')
    add('propeller_thrust_front_z',None,'Front washer immediately follows the front bearing',expression='propeller_front_bearing_z+propeller_front_bearing_width')
    add('propeller_collar_z',None,'Front shoulder includes both washers and the complete endplay',expression='propeller_thrust_front_z+propeller_thrust_width+propeller_endplay')
    add('propeller_slinger_z',None,'Aft rotating oil-slinger shoulder immediately precedes its washer',expression='propeller_thrust_aft_z-2')
    add('propeller_seal_z',None,'Estimated seal station ahead of the thrust support',expression='drive_gear_end+104')
    add('propeller_flange_z',None,'Estimated flange clear of the front case face',expression='drive_gear_end+121.2')
    add('propeller_flange_radius',76.2,'Estimated 6-inch outer flange diameter; not a documented APR502 dimension')
    add('propeller_flange_width',18.,'Estimated flange thickness')
    add('propeller_pilot_radius',31.75,'Estimated centring pilot radius; exact applicable drawing is missing')
    add('propeller_bolt_circle',FLANGES[flange]['bolt_circle'],'Hartzell Figure1 '+flange+' family; H serial applicability remains unverified','specified','hartzell_flange')
    add('propeller_bolt_diameter',FLANGES[flange]['bolt_diameter'],'Hartzell Figure1 '+flange+' family attachment diameter','specified','hartzell_flange')
    add('quill_root_radius',11.2,'Estimated spline-root envelope')
    add('quill_tip_radius',13.,'Estimated spline-tip envelope inside the original crank nose')
    add('quill_core_radius',8.8,'Estimated reduced torque-carrying core; no torsional stiffness claim')
    add('quill_spline_clearance',.08,'Estimated radial assembly clearance for matched straight-sided spline profiles')
    add('quill_rear_z',None,'Estimated rear spline station within the source-described crank socket',expression='drive_gear_z-68')
    add('quill_front_z',None,'Front spline station follows the reduction shaft journal',expression='drive_gear_end+24')
    add('quill_spline_length',22.,'Estimated positive spline engagement length')
    add('quill_plate_z',None,'Retention plate follows the quill front face',expression='quill_front_z+quill_spline_length')
    add('transfer_tube_diameter',.49625*25.4,'Table6 PDF103 printed .4965-.4960, sorted endpoints midpoint','specified')
    add('transfer_receiving_id',.49765*25.4,'Table6 PDF103 midpoint .4973-.4980 in','specified')
    add('transfer_sleeve_hole_diameter',.4685*25.4,'Table6 PDF103 midpoint .468-.469 in shaft hole','specified')
    add('transfer_sleeve_free_od',.4700*25.4,'Matching case row .4695-.4705; preserves conflicting .4095 lower endpoint','specified')
    add('transfer_rear_z',None,'Estimated fixed sleeve station behind the rotating rear shaft face',expression='drive_gear_z-42')
    add('transfer_tube_rear_z',None,'Tube begins ahead of the transverse inlet chamber',expression='drive_gear_z-32')
    add('transfer_front_z',None,'Estimated stepped sleeve location inside the front shaft',expression='drive_gear_end+115')
    add('transfer_tube_front_z',None,'Tube ends before the stepped oil outlet',expression='drive_gear_end+126')
    add('transfer_stem_z',None,'Forward press seat begins at the sleeve step',expression='drive_gear_end+131')
    add('transfer_outlet_z',None,'Oil outlet at the centring pilot front face',expression='propeller_flange_z+propeller_flange_width+7')
    add('drive_case_split',.05,'Existing split-case nominal assembly gap')
    add('drive_case_start',None,'Front stock overlaps the accepted case without reaching cylinder fin packets',expression='drive_gear_z-42')
    add('drive_case_end',None,'Front case clears the external flange transition',expression='drive_gear_end+117')
    add('drive_tooth_case_gap',1.2,'Estimated radial tooth-envelope clearance')
    add('drive_case_bolt_radius',5.,'Estimated through-bolt radius; threads are simplified')
    add('drive_case_bolt_clearance',.0008*25.4,'Selected diametral slip within B-2 row60 -.0005T to .0013L','specified')
    return p


def spline_profile(p,clearance=0.,expressions=False):
    gap=evaluate(clearance,p)
    root=p['quill_root_radius']['value']+gap;tip=p['quill_tip_radius']['value']+gap
    pitch=2*math.pi/SPLINE_COUNT
    points=[]
    for n in range(SPLINE_COUNT):
        for radius,fraction,name in [(root,-.5,'quill_root_radius'),(root,-.38,'quill_root_radius'),
                                    (tip,-.275,'quill_tip_radius'),(tip,.275,'quill_tip_radius'),(root,.38,'quill_root_radius')]:
            a=(n+fraction)*pitch
            points.append([f'({name}+{clearance})*{math.cos(a)}',f'({name}+{clearance})*{math.sin(a)}'] if expressions else [radius*math.cos(a),radius*math.sin(a)])
    return points


def through_bolts(p):
    v=lambda k:p[k]['value']
    return [dict(id=n,y=y,z=z,half_width=w) for n,(y,z,w) in enumerate([
        (v('propeller_axis_y')+44,v('propeller_front_bearing_z')+15,60),
        (v('propeller_axis_y')-44,v('propeller_front_bearing_z')+15,60),
        (-45,v('drive_gear_end')+18,70),(45,v('drive_gear_end')+18,70),
        (-45,v('drive_gear_end')+42,70),(45,v('drive_gear_end')+42,70)],1)]
