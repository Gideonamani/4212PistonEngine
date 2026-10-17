"""Image-reviewed forging profiles and blade seats; sizes not stated remain estimates.

Figure A-4-20 part 41 shows differentiated webs and projecting paired-bore blades.
A-3-1/2, A-10-3 and Table 11 identify the blade/bushing construction and cheeks 2,5,8.
"""
import math
from cad_pipeline import gtsio_layout as k


def hull(rows):
    rows=sorted(rows,key=lambda p:(p[0],p[1]))
    cross=lambda a,b,c:(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    def half(items):
        out=[]
        for p in items:
            while len(out)>=2 and cross(out[-2],out[-1],p)<=0:out.pop()
            out.append(p)
        return out
    return [p[2:] for p in half(rows)[:-1]+half(rows[::-1])[:-1]]


def rounded_profile(centres):
    points=[]
    for (x,y),radius,expression in centres:
        for j in range(48):
            a=2*math.pi*j/48;c,s=math.cos(a),math.sin(a)
            points.append([x+radius*c,y+radius*s,f'{x}+({expression})*{c}',f'{y}+({expression})*{s}'])
    return hull(points)


def tapered_web(points,z,unit):
    """Inclined axial faces, with full-thickness circular lands added separately."""
    ux,uy=unit
    sections=[]
    for side in (0,1):
        section=[]
        for x,y in points:
            inset=f'cheek_taper_delta*({ux}*({x})+{uy}*({y})+main_diameter/2+web_main_margin)/(stroke+main_diameter+2*web_main_margin)'
            section.append([x,y,inset if side==0 else f'cheek_width-({inset})'])
        sections.append(section)
    return dict(primitive='loft',operation='add',sections=sections,origin=[0,0,z],label='Inclined forged web faces with preserved support lands')


def features(par,parameters,layout=k):
    k=layout
    from cad_pipeline.gtsio_core import cylinder,prism
    from cad_pipeline.gtsio_crankshaft_estimates import apply
    apply(par,parameters)
    shaft=[]
    for bay in range(4):shaft.append(cylinder('main_diameter/2','main_width',[0,0,bay*k.BAY_PITCH],label='Main journal '+str(bay+1)))
    for n in range(1,7):
        p=k.pose(n)['pin'];shaft.append(cylinder('crankpin_diameter/2','pin_width',[p[0],p[1],p[2]-k.PIN_WIDTH/2],label='Crankpin '+str(n)))
    for bay in range(3):
        a=k.pose(2*bay+1)['pin'][:2];b=k.pose(2*bay+2)['pin'][:2];z0=k.MAIN_WIDTH+bay*k.BAY_PITCH
        rm=k.MAIN_DIAMETER/2+parameters['web_main_margin']['value'];rp=k.CRANKPIN_DIAMETER/2+parameters['web_pin_margin']['value']
        rw=parameters['middle_web_radius']['value']
        profiles=[rounded_profile([((0,0),rm,'main_diameter/2+web_main_margin'),(a,rp,'crankpin_diameter/2+web_pin_margin')]),
                  rounded_profile([(a,rw,'middle_web_radius'),(b,rw,'middle_web_radius')]),
                  rounded_profile([(b,rp,'crankpin_diameter/2+web_pin_margin'),((0,0),rm,'main_diameter/2+web_main_margin')])]
        for j,points in enumerate(profiles):
            z=z0+j*(k.CHEEK_WIDTH+k.PIN_WIDTH)
            if j==1:shaft.append(prism(points,'cheek_width',[0,0,z],label='Middle load-bearing cheek '+str(bay*3+j+1)))
            else:
                pin=a if j==0 else b;unit=(pin[0]/k.THROW,pin[1]/k.THROW)
                shaft.append(tapered_web(points,z,unit))
                # Retain contact-face stations around pins/journals; taper the web, not the bearing lands.
                shaft.append(cylinder('main_diameter/2+web_main_margin','cheek_width',[0,0,z],label='Full-depth main-journal support land'))
                shaft.append(cylinder('crankpin_diameter/2+web_pin_margin','cheek_width',[pin[0],pin[1],z],label='Full-depth crankpin side-clearance land'))
        # Two projecting, paired-bore blades on each middle cheek (2,5,8).
        theta=math.atan2(a[1],a[0]);c,s=math.cos(theta),math.sin(theta);zm=z0+k.CHEEK_WIDTH+k.PIN_WIDTH
        for side in (-1,1):
            points=[['-blade_half_width',f'{side}*blade_root'],['-blade_half_width',f'{side}*(blade_tip-blade_edge_ligament)'],
                    ['-blade_half_width+blade_edge_ligament',f'{side}*blade_tip'],['blade_half_width-blade_edge_ligament',f'{side}*blade_tip'],
                    ['blade_half_width',f'{side}*(blade_tip-blade_edge_ligament)'],['blade_half_width',f'{side}*blade_root']]
            shaft.append(prism(points,'blade_width',[0,0,f'{zm}+(cheek_width-blade_width)/2'],roll=math.degrees(theta),label=f'Cheek {bay*3+2} thinner centred counterweight blade {side}'))
    # All blade holes follow their host additions. They are seats, not finished bushing IDs.
    for bay in range(3):
        a=k.pose(2*bay+1)['pin'];theta=math.atan2(a[1],a[0]);c,s=math.cos(theta),math.sin(theta)
        zm=k.MAIN_WIDTH+bay*k.BAY_PITCH+k.CHEEK_WIDTH+k.PIN_WIDTH
        for side in (-1,1):
            for xsign in (-1,1):
                o=[f'{c*xsign}*blade_bore_offset-{s*side}*blade_bore_row',f'{s*xsign}*blade_bore_offset+{c*side}*blade_bore_row',zm-1]
                shaft.append(cylinder('blade_bore_radius','cheek_width+2',o,op='cut',label=f'Cheek {bay*3+2} blade bushing seat'))
    shaft.append(cylinder(14.,31.,[0,0,3*k.BAY_PITCH+k.MAIN_WIDTH-31.],op='cut',label='Illustrative quill socket; actual spline deferred'))
    # Visible circular features are represented as conservative blind pockets.
    # Their diameter/depth are estimates; this does not establish hidden oil drilling.
    for n in range(1,7):
        p=k.pose(n)['pin'];lo=p[2]-k.PIN_WIDTH/2-k.CHEEK_WIDTH;hi=p[2]+k.PIN_WIDTH/2+k.CHEEK_WIDTH
        shaft.append(cylinder('pin_end_recess_radius','pin_end_recess_depth+.2',[p[0],p[1],lo-.2],op='cut',label='Estimated blind crankpin-end recess, aft face '+str(n)))
        shaft.append(cylinder('pin_end_recess_radius','pin_end_recess_depth+.2',[p[0],p[1],f'{hi}-pin_end_recess_depth'],op='cut',label='Estimated blind crankpin-end recess, forward face '+str(n)))
    for j in range(6):
        a=j*math.pi/3;shaft.append(cylinder(3.,12.,[24*math.cos(a),24*math.sin(a),-1.],op='cut',label='Rear gear screw seat'))
    return shaft


def root_dressups(layout=k):
    k=layout
    pins=[]
    for n in range(1,7):
        p=k.pose(n)['pin']
        for side in (-1,1):pins.append(dict(curve='circle',center=[p[0],p[1],p[2]+side*k.PIN_WIDTH/2],radius='crankpin_diameter/2'))
    mains=[]
    for bay in range(3):
        for z in [bay*k.BAY_PITCH+k.MAIN_WIDTH,(bay+1)*k.BAY_PITCH]:
            mains.append(dict(curve='circle',center=[0,0,z],radius='main_diameter/2'))
    return [dict(type='fillet',radius='pin_root_radius',selectors=pins,label='Twelve calculated crankpin root blends'),
            dict(type='fillet',radius='main_root_radius',selectors=mains,label='Six calculated main-journal root blends')]
