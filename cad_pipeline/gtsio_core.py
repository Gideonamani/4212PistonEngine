"""Source-led native feature specification: GTSIO-520-H static rotating core."""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
from cad_pipeline import gtsio_layout as k
from cad_pipeline.spec import validate_spec
from cad_pipeline.research_gate import review

STUDY = Path('cad-studies/gtsio520-h-realism')


def cylinder(r, h, o, axis=(0,0,1), op='add', label=''):
    return dict(primitive='cylinder', operation=op, radius=r, height=h, origin=o, axis=list(axis), label=label)


def tube(r, ri, h, o, axis=(0,0,1), op='add', label=''):
    return dict(cylinder(r,h,o,axis,op,label), primitive='tube', inner_radius=ri)


def box(a,b,c,o,op='add',label=''):
    return dict(primitive='box',operation=op,length=a,width=b,height=c,origin=o,label=label)


def prism(points,h,o=(0,0,0),axis=(0,0,1),op='add',label='',roll=0):
    return dict(primitive='prism',operation=op,points=points,height=h,origin=list(o),axis=list(axis),derived=True,label=label,roll=roll)


def transform(feature, center, roll):
    f=copy.deepcopy(feature); c,s=math.cos(math.radians(roll)),math.sin(math.radians(roll))
    x,y,z=f.get('origin',[0,0,0]); xyz=lambda a: str(a) if isinstance(a,(int,float)) else '('+a+')'
    f['origin']=[f'{center[0]}+{c}*{xyz(x)}-{s}*{xyz(y)}',f'{center[1]}+{s}*{xyz(x)}+{c}*{xyz(y)}',f'{center[2]}+{xyz(z)}']
    ax=f.get('axis',[0,0,1]);f['axis']=[c*ax[0]-s*ax[1],s*ax[0]+c*ax[1],ax[2]]
    if ax==[0,0,1] or tuple(ax)==(0,0,1):f['roll']=f.get('roll',0)+roll
    return f


def build(layout=k):
    k=layout
    inventory=json.loads((STUDY/'inventory.json').read_text())
    sp=dict(schema_version=1,model_id='gtsio520-h-realism-core-v4',units='mm',input_mode='mixed',
            scope='Static GTSIO-520-H rotating-core candidate; critical sizes source-backed, axial spacing and contours estimated. Dampers, locking cotters, main bearings and complete engine systems deferred. No operating clip.',
            sources=inventory['sources'],parameters={},parts=[],tessellation={'default_mm':.10},
            research={'inventory_path':str(STUDY/'inventory.json').replace('\\','/'),'inventory_sha256':hashlib.sha256((STUDY/'inventory.json').read_bytes()).hexdigest()},
            presentation={'header':'CONTINENTAL GTSIO-520-H','footer':'Static core candidate | Estimated spacing and contours | Dampers deferred',
                          'group_titles':{'crankshaft':'Six-throw forging / four main journals','pistons':'Six hollow pistons and floating pins','rings':'Four rings per piston / alternating end gaps','rods':'Six split I-section rods and lined bearings'},
                          'views':[{'id':'structure','title':'Crankshaft, rods and bearing interfaces','hide_groups':['pistons','rings'],'direction':[1,-1,.7]},
                                   {'id':'core-side','title':'Opposed banks / separate crankpins','direction':[1,-.4,.4]}]})
    def par(name,value,rationale,documented=False):
        sp['parameters'][name]=dict(value=value,unit='mm',status='specified' if documented else 'inferred',source_ids=['manual'],rationale=rationale)
    for name,value,rationale in [('nominal_bore',k.BORE,'H C-3-2 PDF152: 5.250 in'),('stroke',k.STROKE,'H C-3-2 PDF152: 4.000 in'),
        ('rod_length',k.ROD_LENGTH,'Table 6 B-12 PDF103: selected midpoint 6.623-6.627 in'),('main_diameter',k.MAIN_DIAMETER,'Table 6: midpoint 2.6240-2.6250 in'),
        ('crankpin_diameter',k.CRANKPIN_DIAMETER,'Table 6: midpoint 2.2490-2.2500 in'),('pin_diameter',k.PIN_DIAMETER,'Table 6: midpoint 1.1243-1.1245 in'),
        ('pin_bore',k.PIN_BORE,'Table 6: piston pin bore midpoint 1.1246-1.1250 in'),('bush_bore',k.BUSH_BORE,'Table 6: midpoint 1.1267-1.1269 in'),
        ('pin_length',k.PIN_LENGTH,'Table 6: assembly including permanent plugs, midpoint 5.2050-5.2200 in'),
        ('piston_top',5.2044*k.INCH,'Table 6: top midpoint 5.2020-5.2068 in'),('piston_land',5.215*k.INCH,'Table 6: below first groove midpoint 5.2140-5.2160 in'),
        ('piston_skirt',5.2399*k.INCH,'Table 6: bottom midpoint 5.2394-5.2404 in'),
        ('rod_side_clearance',.008*k.INCH,'B-2 PDF93: rod on crankpin side clearance .006-.010 in; midpoint .008 in')]:par(name,value,rationale,True)
    estimates={'main_width':(k.MAIN_WIDTH,'Selected axial journal packaging'), 'pin_width':(k.PIN_WIDTH,'Selected axial pin packaging'),
        'cheek_width':(k.CHEEK_WIDTH,'Selected axial forging packaging'),
        'big_radius':(39.,'Estimated forging outer big-end radius'), 'bearing_wall':(2.2,'Estimated steel-backed liner wall'),
        'bearing_clearance':(.055,'Selected visual diametral bearing clearance, not calibrated thermal fit'), 'split_gap':(.05,'Selected split-plane mesh clearance'),
        'small_radius':(22.,'Estimated small-end forging radius'), 'bush_outer':(18.,'Estimated bronze bushing outside radius'),
        'bolt_radius':(4.4,'Illustrative smooth bolt; no thread size claim'), 'bolt_clearance':(.01143,'Radial half of .0009 in midpoint diametral bolt clearance, B-2 PDF93'),
        'nut_radius':(8.5,'Illustrative slotted nut hex radius'), 'inner_radius':(59.,'Estimated hollow skirt internal radius'),
        'crown':(8.,'Estimated crown thickness'), 'crown_top':(34.,'Estimated crown position from wrist axis'), 'skirt_bottom':(-48.,'Estimated skirt position from wrist axis'),
        'groove_root':(62.5,'Inherited provisional ring groove radius'), 'plug_depth':(5.,'Estimated permanent end plug depth'),
        'pin_inner':(9.,'Estimated hollow pin bore radius'), 'fitted_bore':(k.FITTED_BORE,'Inherited source-backed 5.251-5.253 in cylinder bore midpoint; barrel not included'),
        'ring_gap':(.98,'Approximate ring gap envelope'), 'ring_clearance':(.10,'Selected axial side clearance for static model'),
        'boss_radius':(23.,'Estimated integral pin boss radius'), 'boss_inner':(32.,'Estimated inner boss axial location'),
        'boss_length':(30.,'Estimated integral pin boss axial width'), 'relief_radius':(18.,'Estimated cylindrical skirt relief'),
        'ring_inner_clearance':(.10,'Selected radial ring-root clearance')}
    for name,(v,why) in estimates.items():par(name,v,why)
    def add(pid,label,group,fs,material='steel',frame=None,locator='A-4-20 PDF38'):
        sp['parts'].append(dict(id=pid,label=label,group=group,material=material,
            evidence=locator+'; critical dimensions Table 6 PDF103; unsupported contour/section/station dimensions explicitly inferred. '+
                     ('Derived prism/revolve contours regenerate from this specification; linked basic features retain native expressions.'),
            features=[transform(f,*frame) for f in fs] if frame else fs))
    from cad_pipeline.gtsio_crankshaft import features as forging_features
    shaft=forging_features(par,sp['parameters'],layout=k)
    add('Crankshaft','Rebuilt six-throw forging / radiused roots and calculated blade seats','crankshaft',shaft,locator='A-4-20 PDF38 part 41; A-3-1/2 PDF16-17; A-10-3 PDF70; Table 6 PDF103; Table 11 PDF117 cheeks 2,5,8')
    sp['parts'][-1]['boolean_refine']=False
    from cad_pipeline.gtsio_crankshaft import root_dressups
    sp['parts'][-1]['dressups']=root_dressups(layout=k)
    for n in range(1,7):
        state=k.pose(n);rf=(state['pin'],state['rod_roll']);pf=(state['wrist'],state['piston_roll'])
        # Local Y points to the wrist; Z is the pin axis. Separate semicircular cap/rod.
        bore='crankpin_diameter/2+bearing_wall'
        root=[tube('big_radius',bore,'rod_width',[0,0,'-rod_width/2'])]
        upper=root+[box(100.,50.,50.,[-50,-50,-25],op='cut',label='Cap split plane')]
        # I section: tapered flange pair and central web merge with both end eyes.
        outline=[[-13,18],[13,18],[9,'rod_length-10'],[-9,'rod_length-10']]
        for z in ['-rod_width/2','rod_width/2-3']:upper.append(prism(outline,3.,[0,0,z],label='I-section flange'))
        upper.append(prism([[-3,18],[3,18],[3,'rod_length-10'],[-3,'rod_length-10']],'rod_width-6',[0,0,'-rod_width/2+3'],label='I-section web'))
        upper.append(tube('small_radius','bush_outer+.03','rod_width',[0,'rod_length','-rod_width/2'],label='Little-end eye'))
        lower=root+[box(100.,50.,50.,[-50,'split_gap',-25],op='cut',label='Rod split plane')]
        for part,lo,hi in [(upper,0,18),(lower,-18,0)]:
            for side in (-1,1):
                x=side*38
                part.append(box(16.,hi-lo,'rod_width',[x-8,lo,'-rod_width/2'],label='Bolt boss'))
            # Restore both seats after the boss additions.
            part.append(cylinder(bore,50.,[0,0,-25],op='cut',label='Precision insert seat'))
            for x in (-38,38):
                part.append(cylinder('bolt_radius+bolt_clearance',60.,[x,-30,0],axis=(0,1,0),op='cut',label='Rod bolt bore'))
                # Audit-found guest/host interfaces: actual bolt-head and nut envelopes define the seats.
                if part is upper:part.append(cylinder(7.05,25.,[x,18,0],axis=(0,1,0),op='cut',label='Bolt head envelope seat'))
                else:part.append(cylinder('nut_radius+.05',25.,[x,-43,0],axis=(0,1,0),op='cut',label='Nut envelope spotface'))
        # Clearance split cut last, including bosses.
        upper.append(box(110.,50.,50.,[-55,-50,-25],op='cut'))
        upper.append(cylinder('bush_outer+.03',50.,[0,'rod_length',-25],op='cut',label='Restore little-end bushing seat'))
        lower.append(box(110.,50.,50.,[-55,'-split_gap/2',-25],op='cut'))
        add('ConnectingRod'+str(n),'Rod '+str(n)+' / I-section forging','rods',upper,frame=rf)
        add('RodCap'+str(n),'Rod '+str(n)+' / separate cap','rods',lower,frame=rf)
        for title,cut_origin in [('Upper',[-50,-50,-25]),('Lower',[-50,'-split_gap/2',-25])]:
            inner='(crankpin_diameter+bearing_clearance)/2'
            shell=[tube('crankpin_diameter/2+bearing_wall-.025',inner,'rod_width-.4',[0,0,'-(rod_width-.4)/2']),box(100.,50.,50.,cut_origin,op='cut')]
            for end in (-1,1):
                shell.append(dict(primitive='cone',operation='cut',radius1=f'{inner}+bearing_edge_relief' if end<0 else inner,
                                  radius2=inner if end<0 else f'{inner}+bearing_edge_relief',height='bearing_edge_relief',
                                  origin=[0,0,'-(rod_width-.4)/2' if end<0 else '(rod_width-.4)/2-bearing_edge_relief'],
                                  label='Calculated liner edge relief for crankpin root fillet'))
            add('RodBearing'+title+str(n),'Rod '+str(n)+' / '+title.lower()+' lined shell','rods',shell,'babbitt',rf)
        bush=[tube('bush_outer','bush_bore/2','rod_width-.4',[0,'rod_length','-(rod_width-.4)/2']),box(.08,25.,50.,[-.04,'rod_length',-25],op='cut',label='Split bronze sleeve')]
        add('SmallEndBush'+str(n),'Rod '+str(n)+' / split bronze bushing','rods',bush,'bronze',rf)
        for letter,x in [('A',-38),('B',38)]:
            fs=[cylinder('bolt_radius',46.,[x,-28,0],(0,1,0)),cylinder(7.,5.,[x,18,0],(0,1,0)),cylinder(.8,16.,[x-8,-25,0],(1,0,0),op='cut',label='Cotter hole (cotter deferred)')]
            add('RodBolt'+letter+str(n),'Rod '+str(n)+' / bolt '+letter,'rods',fs,frame=rf)
            hexagon=[['nut_radius*'+str(math.cos(j*math.pi/3)),'nut_radius*'+str(math.sin(j*math.pi/3))] for j in range(6)]
            fs=[prism(hexagon,9.,[x,-27,0],(0,1,0)),cylinder('bolt_radius+.08',12.,[x,-28,0],(0,1,0),op='cut')]
            for angle in (0,60,120):fs.append(dict(box(20.,.9,3.,[-10,-.45,0],op='cut'),origin=[x,-27,0],axis=[0,1,0],roll=angle,label='Slotted nut crown'))
            add('RodNut'+letter+str(n),'Rod '+str(n)+' / slotted nut '+letter,'rods',fs,frame=rf)
        # Hollow aluminium piston, tapered manufacturing OD targets; crown and length estimated.
        profile=[[0,'crown_top'],['piston_top/2','crown_top'],['piston_top/2',25.],['piston_land/2',21.],['piston_skirt/2','skirt_bottom'],['inner_radius','skirt_bottom'],['inner_radius','crown_top-crown'],[0,'crown_top-crown']]
        piston=[dict(primitive='revolve',operation='add',points=profile,axis=[0,1,0],origin=[0,0,0],label='Hollow tapered piston')]
        for z in ['boss_inner','-boss_inner-boss_length']:piston.append(cylinder('boss_radius','boss_length',[0,0,z],label='Integral pin boss'))
        # Integral ribs support the crown while leaving the wrist/rod sweep open.
        for x in (-33,29):piston.append(box(4.,18.,112.,[x,9.,-56.],label='Undercrown rib outside little-end eye'))
        piston.append(cylinder('pin_bore/2','pin_length+4',[0,0,'-pin_length/2-2'],op='cut',label='Floating pin bore'))
        for z in (-72.,72.):piston.append(cylinder('relief_radius',155.,[-77.5,-51.,z],(1,0,0),op='cut',label='Cylindrical skirt relief'))
        ring_data=k.RING_DATA
        for name,y,width,gap_sign in ring_data:
            piston.append(tube(72.,'groove_root',width+.10,[0,y-width/2-.05,0],(0,1,0),op='cut',label=name+' groove'))
            ring=[tube('fitted_bore/2-.01','groove_root+ring_inner_clearance',width,[0,y-width/2,0],(0,1,0)),box('ring_gap',width+2,72.,['-ring_gap/2',y-width/2-1,0 if gap_sign==1 else -72.],op='cut',label='Alternating end gap per A-11-3')]
            if name=='OilRing':
                for j in range(12):
                    angle=j*math.pi/6
                    # Slots centered in the ring thickness; two rails remain connected at the ends.
                    # Explicit radial cylinders provide robust native through-openings instead of approximating a thread.
                    ring.append(cylinder(.6,8.,[61*math.cos(angle),y,61*math.sin(angle)],(math.cos(angle),0,math.sin(angle)),op='cut',label='Oil drain aperture'))
                    piston.append(cylinder(.7,12.,[57*math.cos(angle),y,57*math.sin(angle)],(math.cos(angle),0,math.sin(angle)),op='cut',label='Oil groove return hole'))
            add(name+str(n),'Piston '+str(n)+' / '+name,'rings',ring,'cast_iron',pf,'A-4-17 PDF34; A-11-3 PDF75')
        add('Piston'+str(n),'Piston '+str(n)+' / hollow aluminium body','pistons',piston,'aluminium',pf,'A-3-2 PDF17; A-4-17 PDF34')
        add('PistonPin'+str(n),'Piston '+str(n)+' / floating hollow pin','pistons',[tube('pin_diameter/2','pin_inner','pin_length-2*plug_depth',[0,0,'-pin_length/2+plug_depth'])],frame=pf)
        for letter,z in [('A','-pin_length/2'),('B','pin_length/2-plug_depth')]:
            add('PinPlug'+letter+str(n),'Pin '+str(n)+' / permanent aluminium plug '+letter,'pistons',[cylinder('pin_diameter/2','plug_depth',[0,0,z])],'aluminium',pf,'A-3-2 PDF17: forged-in end plugs; contours estimated')
    # Native expressions preserve the source side clearance when the selected axial pin width changes.
    def widths(value):
        if isinstance(value,str):return value.replace('rod_width','(pin_width-rod_side_clearance)')
        if isinstance(value,list):return [widths(v) for v in value]
        if isinstance(value,dict):return {key:widths(v) for key,v in value.items()}
        return value
    sp['parts']=widths(sp['parts'])
    validate_spec(sp)
    result=review(inventory,[p['id'] for p in sp['parts']])
    return sp,result


def main():
    parser=argparse.ArgumentParser();parser.add_argument('--out',type=Path,default=STUDY/'part-spec.json');a=parser.parse_args()
    sp,result=build();a.out.parent.mkdir(parents=True,exist_ok=True);a.out.write_text(json.dumps(sp,indent=2)+'\n')
    from cad_pipeline.gtsio_crankshaft_estimates import record
    (STUDY/'crankshaft-estimates.json').write_text(json.dumps(record(sp['parameters']),indent=2)+'\n')
    result.update(whole_engine_ready=False,operating_motion_ready=False)
    (STUDY/'research-readiness.json').write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(dict(parts=len(sp['parts']),features=sum(len(p['features'])+len(p.get('dressups',[])) for p in sp['parts']),research=result),indent=2))


if __name__=='__main__':main()
