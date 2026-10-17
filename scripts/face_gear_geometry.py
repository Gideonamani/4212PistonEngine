"""Sample an involute shaper's rolling envelope in radial face-gear sections.

Independent mathematical construction; not FCGear source or OEM dimensions.
The pinion axis is +X at Z=its pitch radius, the face axis is +Z. A shaper
angle theta corresponds to face angle theta*Np/Nf. At face-frame X=r,
Y=y_rot/cos(phi)-r*tan(phi), Z=rp+z_rot. Horizontal interval unions give the
sampled cutter footprint. Native loft/pattern and pitch checks must validate
the approximation before any engine installation.
"""
import math
from gear_geometry import profile


def horizontal_intervals(polygon,z):
    hits=[]
    for a,b in zip(polygon,polygon[1:]+polygon[:1]):
        if min(a[1],b[1])<=z<max(a[1],b[1]):
            hits.append(a[0]+(z-a[1])*(b[0]-a[0])/(b[1]-a[1]))
    hits.sort()
    if len(hits)%2:raise ValueError('Odd cutter-section crossing count')
    return list(zip(hits[::2],hits[1::2]))


def envelope_sections(face_teeth=60,pinion_teeth=20,radial_sections=7,poses=49,levels=61):
    if not (face_teeth>=pinion_teeth>=18 and poses%2==1 and poses>=17):
        raise ValueError('Unsupported face method fixture')
    # Normalized module1: slightly wider/deeper shaper than the final pinion.
    outline=profile(pinion_teeth,pinion_teeth/2,1.25,backlash_factor=-.10,flank_points=12)
    tooth=outline[:len(outline)//pinion_teeth-3] # exclude the inter-tooth root arc
    rp=pinion_teeth/2;pitch=2*math.pi/pinion_teeth
    radii=[face_teeth/2-3.2+6.4*i/(radial_sections-1) for i in range(radial_sections)]
    sections=[];worst_gap=0.;lands=[]
    for radius in radii:
        polygons=[]
        for k in range(poses):
            theta=1.5*pitch*(2*k/(poses-1)-1);phi=theta*pinion_teeth/face_teeth
            c,s=math.cos(theta),math.sin(theta)
            polygons.append([((y*c+x*s)/math.cos(phi)-radius*math.tan(phi),rp+y*s-x*c) for x,y in tooth])
        widths=[]
        for k in range(levels):
            z=-1.20+2.40*k/(levels-1)
            intervals=sorted(span for polygon in polygons for span in horizontal_intervals(polygon,z))
            if not intervals:raise ValueError('Missing swept tooth interval')
            low,high=intervals[0]
            for a,b in intervals[1:]:
                worst_gap=max(worst_gap,a-high)
                if a>high+1e-7:raise ValueError('Disconnected sampled shaper footprint')
                high=max(high,b)
            widths.append((z,low,high))
        # Extend the cutter floor below the tooth tip for root clearance.
        left=[[-1.30,widths[0][1]]]+[[z,lo] for z,lo,hi in widths]
        right=[[-1.30,widths[0][2]]]+[[z,hi] for z,lo,hi in widths]
        polygon=[[radius,y,z] for z,y in left]+[[radius,y,z] for z,y in reversed(right)]
        sections.append(polygon)
        # Check retained tooth land at sampled levels in the actual tooth band.
        # This catches a cutter that removes adjacent teeth entirely; it is not
        # a stress, undercut or continuous-surface certification.
        widths_in_stock=[radius*(2*math.pi/face_teeth-(math.atan2(hi,radius)-math.atan2(lo,radius)))
                         for z,lo,hi in widths if z<=1.+1e-9]
        lands.append(dict(radius_module=radius,minimum_tooth_land_module=min(widths_in_stock)))
    if any(r['minimum_tooth_land_module']<=0 for r in lands):raise ValueError('Sampled face teeth meet or point across adjacent cutter slots')
    return sections,dict(face_teeth=face_teeth,pinion_teeth=pinion_teeth,radial_sections=radial_sections,
        shaper_poses=poses,flank_levels=levels,normalized_radial_band=[radii[0],radii[-1]],
        sampled_interval_max_gap=worst_gap,normalized_cutter_floor=-1.30,
        shaper_backlash_factor=-.10,pinion_backlash_factor=.05,sampled_tooth_land=lands,
        status='Sampled envelope prepared; native/STEP, pitch, tooth thickness and export gates pending')


def smooth_profile_controls(module_name,point_count=124):
    """Reviewed fixed spans for the selected61-level60/20 method study.

    Shorter root spans control fit overshoot. The source and engine builders
    share this declaration; other sampling topologies need a new fit review.
    """
    if point_count!=124:raise ValueError('Selected sampled profile topology required')
    left=[2,9,12,14,20,29,37,45,61];right=[point_count-1-i for i in reversed(left)]
    return dict(profile_spline_runs=[list(pair) for edges in [left,right] for pair in zip(edges,edges[1:])],
                scale_parameter=module_name,profile_parameterization='uniform_levels',profile_curve_mode='bezier_fit',profile_curve_degree=5)

def slot_computational_clip(module_name):
    """Trim only tool material above the tooth stock's +1 module surface."""
    scale=lambda value:f'{value}*{module_name}'
    return dict(primitive='box',operation='add',length=scale(20),width=scale(20),height=scale(4.01),origin=[scale(20),scale(-10),scale(-3)],
                label='Computational cutter cap +1.01module; retains +0.01module above the actual tooth stock')


def face_features(module_name='face_module',face_teeth=60,pinion_teeth=20,contact_window=False,lateral_allowance=.03,smooth_profiles=False):
    sections,record=envelope_sections(face_teeth,pinion_teeth)
    lands=[]
    for section in sections:
        half=len(section)//2
        for index,point in enumerate(section):point[1]+=(-lateral_allowance if index<half else lateral_allowance)
        radius=section[0][0]
        widths=[radius*(2*math.pi/face_teeth-(math.atan2(hi[1],radius)-math.atan2(lo[1],radius)))
                for lo,hi in zip(section[:half],reversed(section[half:])) if lo[2]<=1.+1e-9]
        lands.append(dict(radius_module=radius,minimum_tooth_land_module=min(widths)))
    if any(r['minimum_tooth_land_module']<=0 for r in lands):raise ValueError('Clearance allowance removes the retained face tooth land')
    record.update(additional_lateral_allowance_module=lateral_allowance,sampled_tooth_land_after_allowance=lands,
        allowance_rationale='Selected60/20 teaching pair: sampled refinement undersize0.017662module plus margin, rounded to0.03module. Other counts require their own checks.')
    scale=lambda value:f'{value:.15g}*{module_name}'
    tool=dict(primitive='loft',operation='add',sections=[[[scale(v) for v in point] for point in wire] for wire in sections],origin=[0,0,0])
    if smooth_profiles:
        if (face_teeth,pinion_teeth)!=(60,20):raise ValueError('Smooth profile study is limited to the checked60/20 pair')
        tool.update(smooth_profile_controls(module_name,len(sections[0])))
        record.update(topology='Piecewise bounded Bezier flank fits to the original samples; new smooth approximation',native_control='Derived unit loft with live uniform module scale; section/topology changes regenerate')
    radial=face_teeth/2
    features=[dict(primitive='tube',operation='add',radius=scale(radial+6),inner_radius=scale(radial-8),height=scale(3),origin=[0,0,scale(-5)]),
        dict(primitive='tube',operation='add',radius=scale(radial+3),inner_radius=scale(radial-3),height=scale(6),origin=[0,0,scale(-5)]),
        dict(primitive='polar_pattern',operation='cut',count=face_teeth,pattern_feature=tool,origin=[0,0,0],label='Pattern of one sampled rolling-shaper envelope')]
    if smooth_profiles:features[-1]['tool_clip']=slot_computational_clip(module_name)
    if contact_window:
        features[-1].update(count=7,step_degrees=360/face_teeth,roll=-3*360/face_teeth)
        features[-1]['label']='Seven-slot contact window on annular method blank; remainder deliberately unmachined'
    record.update(patterned_slots=7 if contact_window else face_teeth,contact_window_only=contact_window)
    return features,record
