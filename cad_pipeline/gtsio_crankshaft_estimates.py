"""Calculated teaching estimates, bounded by known diameters and mating geometry.

Dimensionless ratios below are selected engineering judgement, not measured
manufacturer values. All dependency formulae are retained in the native CAD.
"""
from cad_pipeline import gtsio_layout as k


RULES = [
    ('damper_bushing_wall','0.08*damper_bushing_id','Selected wall/ID ratio 0.08; plausible section range 0.06-0.12, not a parts drawing'),
    ('blade_bore_radius','(damper_bushing_id+2*damper_bushing_wall)/2','Bare host radius from documented bushing ID plus estimated wall; final press-fit not established'),
    ('web_main_margin','0.06*main_diameter/2','Selected radial land margin 6% of main radius (working range 4-8%)'),
    ('web_pin_margin','0.10*crankpin_diameter/2','Selected radial land margin 10% of pin radius (working range 7-13%)'),
    ('middle_web_radius','crankpin_diameter/2+web_pin_margin','Middle-cheek end radius follows pin and support land'),
    ('blade_edge_ligament','0.25*blade_bore_radius*2','Selected minimum outer edge ligament one quarter of host diameter; not strength certification'),
    ('blade_bore_offset','1.05*blade_bore_radius*2','Two-hole pitch selected at 2.1 host diameters; each offset is half the pitch'),
    ('blade_half_width','blade_bore_offset+blade_bore_radius+blade_edge_ligament','Preserve the selected outer edge ligament around both bores'),
    ('blade_bore_row','middle_web_radius+0.60*blade_bore_radius*2','Bore row outside the middle-web waist; selected 0.6 host diameter offset'),
    ('blade_root','middle_web_radius-blade_edge_ligament','Integral blade root overlaps the middle web'),
    ('blade_tip','blade_bore_row+blade_bore_radius+blade_edge_ligament','Tip follows bore row and remaining wall'),
    ('blade_width','0.60*cheek_width','Thinner centred blade, selected 60% of cheek width (working range 50-65%); fork fit pending'),
    ('cheek_taper_delta','0.15*cheek_width','Selected 15% reduction scale, working range 10-20%; slight inclined surfaces'),
    ('main_root_radius','0.75*web_main_margin','Root radius limited to 75% of the radial support margin'),
    ('pin_root_radius','0.60*web_pin_margin','Root radius limited to 60% of support margin and less than the current bearing wall'),
    ('bearing_edge_relief','pin_root_radius-rod_side_clearance/2+0.05','45-degree liner relief derived from root radius and side gap, plus 0.05 mm modelling margin'),
    ('pin_end_recess_radius','0.16*crankpin_diameter','Selected visible recess diameter 32% of pin diameter (working range 25-40%); hidden drilling unverified'),
    ('pin_end_recess_depth','0.25*cheek_width','Selected blind depth one quarter of cheek; preserve a closed web, no invented oil route'),
]


def apply(par, parameters):
    from cad_pipeline.spec import evaluate
    par('damper_bushing_id',.755*k.INCH,'Table 6 PDF103: damper bushing ID .754-.756 in; selected midpoint',True)
    for name,expression,reason in RULES:
        par(name,evaluate(expression,parameters),reason+'; calculated as '+expression)
        parameters[name]['expression']=expression
    r=parameters['pin_root_radius']['value']
    if r>=parameters['bearing_wall']['value'] or r>=parameters['web_pin_margin']['value']:
        raise ValueError('Root estimate exceeds mating support material')


def record(parameters):
    return dict(status='calculated teaching estimates, not manufacturer dimensions',
                anchors={'main_diameter_mm':k.MAIN_DIAMETER,'crankpin_diameter_mm':k.CRANKPIN_DIAMETER,'stroke_mm':k.STROKE,
                         'damper_bushing_id_range_mm':[.754*k.INCH,.756*k.INCH]},
                rules=[dict(parameter=name,expression=expression,value_mm=parameters[name]['value'],rationale=reason)
                       for name,expression,reason in RULES],
                retained_axial_estimates=dict(main_width_mm=k.MAIN_WIDTH,pin_width_mm=k.PIN_WIDTH,cheek_width_mm=k.CHEEK_WIDTH,
                    rationale='Existing scoped datum retained; roughly 0.66 main diameter, 0.525 pin diameter and 0.245 pin diameter respectively; no dimensional calibration claimed'),
                limits=['Ratio ranges express chosen sensitivity intervals, not statistical confidence or manufacturer tolerances',
                        'No stress, fatigue, balance or operating clearance certification',
                        'Blind visible recesses are an explicit topology assumption; hidden drilling remains unverified'])
