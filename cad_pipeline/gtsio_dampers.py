"""Six forked counterweights, races and retainers from the reviewed construction."""
import math
from cad_pipeline import gtsio_layout as k
from cad_pipeline.gtsio_assembly import cylinder,tube,box,prism,rotate_z


def add(assembly,layout=k,outer_radius=92.,inner_radius=80.):
    k=layout
    a=assembly
    a.parameter('damper_pin_diameter',.4904*k.INCH,'Table11 PDF117: .4902-.4906 in midpoint',True)
    a.parameter('blade_race_id',.756*k.INCH,'Table11 PDF117: cheek-bushing .756 in',True)
    a.parameter('damper_pin_end_clearance',.012*k.INCH,'B-2 row52 PDF93: .001-.023 in, selected midpoint',True)
    a.parameter('damper_blade_race_clearance',0,'Blade roller/race radial clearance',expression='(blade_race_id-damper_pin_diameter)/2')
    a.parameter('damper_weight_race_clearance',0,'Weight roller/race radial clearance',expression='(damper_bushing_id-damper_pin_diameter)/2')
    a.parameter('damper_loaded_shift',0,'Outward static contact: sum of the two race clearances',expression='damper_blade_race_clearance+damper_weight_race_clearance')
    a.parameter('damper_fork_gap',.4,'Selected total axial gap around the blade')
    a.parameter('damper_fork_slot',0,'Fork slot follows blade plus gap',expression='blade_width+damper_fork_gap')
    a.parameter('damper_width',24.4,'Estimated mass width inside the revised 26 mm cheek bay; 0.8 mm margin on each side')
    a.parameter('damper_bush_outer_face',10.,'Estimated bushing outer-end station; retain plate and clip recess outside it')
    a.parameter('damper_outer_radius',outer_radius,'Estimated crescent contour; static cylinder expansion recalibrates this against the barrel/ring envelope. No damper tuning claim')
    a.parameter('damper_inner_radius',inner_radius,'Estimated crescent inner contour, preserving rod-boss clearance')
    a.parameter('damper_retainer_plate_radius',10.95,'Estimated plate envelope inside the host bore')
    a.parameter('damper_retainer_ring_outer',12.15,'Estimated internal retaining ring outside the bore')
    a.parameter('damper_retainer_ring_inner',10.6,'Estimated ring inner radius, overlaps the plate rim radially')
    a.parameter('damper_ring_gap',1.2,'Estimated split in internal retaining ring')
    for bay in range(3):
        p=k.pose(2*bay+1)['pin'];angle=math.atan2(p[1],p[0]);zm=k.MAIN_WIDTH+bay*k.BAY_PITCH+k.CHEEK_WIDTH+k.PIN_WIDTH+k.CHEEK_WIDTH/2
        for side in (-1,1):
            tag=f'{bay+1}'+('A' if side>0 else 'B')
            # Each local frame's +Y points away from the shaft towards its mass.
            theta=angle+(math.pi if side<0 else 0.)
            place=lambda f:rotate_z(f,theta,(0,0,zm))
            fs=[tube('damper_outer_radius','damper_inner_radius','damper_width',[0,'damper_loaded_shift','-damper_width/2']),
                box(240.,140.,40.,[-120,'damper_loaded_shift-105',-20],op='cut',label='Keep outward crescent sector')]
            # Race bosses and two radial webs attach the crescent to the fork.
            for sign in (-1,1):
                x=sign*a.value('blade_bore_offset');y=a.value('blade_bore_row');r=math.hypot(x,y);ux,uy=x/r,y/r
                end=(ux*(outer_radius+inner_radius)/2,uy*(outer_radius+inner_radius)/2)
                fs.append(cylinder('blade_bore_radius+blade_edge_ligament','damper_width',[x,'blade_bore_row+damper_loaded_shift','-damper_width/2']))
                points=[[x-uy*7,y+ux*7+a.value('damper_loaded_shift')],[x+uy*7,y-ux*7+a.value('damper_loaded_shift')],
                        [end[0]+uy*9,end[1]-ux*9+a.value('damper_loaded_shift')],[end[0]-uy*9,end[1]+ux*9+a.value('damper_loaded_shift')]]
                fs.append(prism(points,'damper_width',[0,0,'-damper_width/2']))
            fs.append(box(240.,180.,'damper_fork_slot',[-120,-115,'-damper_fork_slot/2'],op='cut',label='Fork slot grown around the actual blade'))
            # Slot ends at y=65: bridge remains outside the blade tip.
            for sign in (-1,1):
                fs.append(cylinder('blade_bore_radius','damper_width+2',[f'{sign}*blade_bore_offset','blade_bore_row+damper_loaded_shift','-damper_width/2-1'],op='cut'))
                for endsign in (-1,1):
                    z=11.0 if endsign>0 else -11.8
                    fs.append(tube('damper_retainer_ring_outer+.02','blade_bore_radius-.05',.8,[f'{sign}*blade_bore_offset','blade_bore_row+damper_loaded_shift',z],op='cut',label='Retaining-ring groove'))
            a.add('Counterweight'+tag,'Third-order forked mass '+tag,'dampers',[place(f) for f in fs],['A-4-20:12'],refine=False)
            for sign in (-1,1):
                hole=tag+('L' if sign<0 else 'R');x=f'{sign}*blade_bore_offset'
                a.add('BladeBush'+hole,'Hardened blade race '+hole,'dampers',[place(tube('blade_bore_radius','blade_race_id/2','blade_width',[x,'blade_bore_row','-blade_width/2']))],['A-4-20:11'])
                # Pin is tangent to the outside blade race and inside weight race.
                a.add('DamperPin'+hole,'Damper roller pin '+hole,'dampers',[place(cylinder('damper_pin_diameter/2','2*damper_bush_outer_face-damper_pin_end_clearance',
                    [x,'blade_bore_row+damper_blade_race_clearance','-damper_bush_outer_face+damper_pin_end_clearance/2']))],['A-4-20:10'])
                for endsign in (-1,1):
                    suffix=hole+('Front' if endsign>0 else 'Rear')
                    start='damper_fork_slot/2' if endsign>0 else '-damper_bush_outer_face'
                    a.add('WeightBush'+suffix,'Hardened fork race '+suffix,'dampers',[place(tube('blade_bore_radius','damper_bushing_id/2','damper_bush_outer_face-damper_fork_slot/2',
                        [x,'blade_bore_row+damper_loaded_shift',start]))],['A-4-20:11'])
                    platez=10.0 if endsign>0 else -11.0
                    a.add('DamperPlate'+suffix,'Pin retaining plate '+suffix,'dampers',[place(cylinder('damper_retainer_plate_radius',1.,[x,'blade_bore_row+damper_loaded_shift',platez]))],['A-4-20:9'])
                    ringz=11.0 if endsign>0 else -11.8
                    ring=[tube('damper_retainer_ring_outer','damper_retainer_ring_inner',.8,[x,'blade_bore_row+damper_loaded_shift',ringz]),
                          box('damper_ring_gap',20.,2.,[f'{x}-damper_ring_gap/2','blade_bore_row+damper_loaded_shift',ringz-.5],op='cut')]
                    a.add('DamperRing'+suffix,'Gapped retaining ring '+suffix,'dampers',[place(f) for f in ring],['A-4-20:8'])
