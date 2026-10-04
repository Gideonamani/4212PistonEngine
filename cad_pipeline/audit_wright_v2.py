"""Independent saved-geometry checks for the researched static assembly.

Reports bounded checks and unresolved mechanisms separately; never certifies
historical accuracy, engine operation or manufacturing suitability.
"""
import argparse,json,math,sys
from pathlib import Path
import FreeCAD as A
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from cad_pipeline.research_gate import review

def main():
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);a=p.parse_args();folder=a.package
    manifest=json.loads((folder/'cad-validation.json').read_text());doc=A.openDocument(str(folder/(manifest['model_id']+'.FCStd')));doc.recompute()
    objects={o.StablePartID:o for o in doc.Objects if hasattr(o,'StablePartID')};checks=[];notes=[];params=doc.Parameters
    def check(name,passed,**data):
        checks.append(dict(check=name,passed=bool(passed),**data));print('PASS' if passed else 'FAIL',name,flush=True)
    def radii(o,axis):return [f.Surface.Radius for f in o.Shape.Faces if f.Surface.__class__.__name__=='Cylinder' and abs(getattr(f.Surface.Axis,axis))>.999]
    def air(id,point):return not objects[id].Shape.isInside(A.Vector(*point),1e-6,True)
    def overlap(left,right):return objects[left].Shape.common(objects[right].Shape).Volume
    try:
        spec=json.loads(params.SpecificationJSON);root=Path(__file__).resolve().parents[1];inv=json.loads((root/spec['research']['inventory_path']).read_text());coverage=review(inv,objects)
        check('All applicable source callouts have explicit disposition and generated mapping',coverage['passed'],coverage=coverage)
        check('Documented nominal bore/stroke/valve/lift/wall retained',all(abs(getattr(params,n)-v)<1e-8 for n,v in [('bore',101.6),('stroke',101.6),('valve_diameter',50.8),('valve_lift',7.9375),('liner_wall',5.55625)]))
        check('Six/twelve timing tooth-pocket counts',len(spec['parts'][next(i for i,p in enumerate(spec['parts']) if p['id']=='CrankSprocket')]['features'])-2==6 and len(spec['parts'][next(i for i,p in enumerate(spec['parts']) if p['id']=='CamSprocket')]['features'])-2==12)
        for i in range(1,5):
            y=(i-1)*params.pitch;rs=radii(objects[f'Sleeve{i}'],'x')
            check(f'Liner {i} bore and specified wall',any(abs(r-50.8)<1e-6 for r in rs) and any(abs(r-56.35625)<1e-6 for r in rs))
            check(f'Piston {i} clears short liner',overlap(f'Piston{i}',f'Sleeve{i}')<1e-3)
            check(f'Wrist pin {i} clears bronze little-end bore',overlap(f'WristPin{i}',f'LittleEnd{i}')<1e-3)
            check(f'Big end {i} clears crankpin',overlap(f'BigEnd{i}','Crankshaft')<1e-3 and overlap(f'BigCap{i}','Crankshaft')<1e-3)
            for k in range(3):
                ring=objects[f'Ring{i}_{k}'];bb=ring.Shape.BoundBox
                check(f'Piston {i} ring {k+1} stays inside liner and above pin',bb.XMin>=175-1e-6 and bb.XMax<=365+1e-6 and overlap(f'Ring{i}_{k}',f'Piston{i}')<1e-3 and overlap(f'Ring{i}_{k}',f'Sleeve{i}')<1e-3)
            check(f'Cylinder {i} open liner-to-box gas path',all(air(f'Sleeve{i}',[x,y,0]) and air(f'ValveBox{i}',[x,y,0]) for x in (360,366,380,402,410)))
            check(f'Cylinder {i} oil jet connects distributor to liner drilling',air('OilDistributor',[200,y,59]) and air(f'OilJet{i}',[200,y,55]) and air(f'Sleeve{i}',[200,y,55]))
            check(f'Valve box {i} exhaust apertures open',all(air(f'ValveBox{i}',[415+(params.valve_box_radius-2)*math.cos(k*math.pi/4),y+(params.valve_box_radius-2)*math.sin(k*math.pi/4),-50]) for k in range(8)))
            for valve,sign in [('Intake',1),('Exhaust',-1)]:
                head=objects[f'{valve}Head{i}'];cage=objects[f'{valve}Cage{i}']
                check(f'{valve} {i} head is 2 inches',abs(head.Shape.BoundBox.XLength-50.8)<1e-6)
                check(f'{valve} {i} cage has four open windows and four legs',all(air(f'{valve}Cage{i}',[415+27*math.cos(k*math.pi/2),y+27*math.sin(k*math.pi/2),sign*64]) for k in range(4)) and all(not air(f'{valve}Cage{i}',[415+27*math.cos(math.pi/4+k*math.pi/2),y+27*math.sin(math.pi/4+k*math.pi/2),sign*64]) for k in range(4)))
                check(f'{valve} {i} stem clears guide and closed head clears cage',overlap(f'{valve}Stem{i}',f'{valve}Cage{i}')<1e-3 and overlap(f'{valve}Head{i}',f'{valve}Cage{i}')<1e-3)
                opened=head.Shape.copy();opened.translate(A.Vector(0,0,-sign*params.valve_lift));check(f'{valve} {i} documented lift clears cage',opened.common(cage.Shape).Volume<1e-3)
                check(f'{valve} {i} spring clears stem',overlap(f'{valve}Spring{i}',f'{valve}Stem{i}')<1e-3)
            d=objects[f'CamRoller{i}'].Shape.distToShape(objects[f'ExhaustCam{i}'].Shape)[0]
            check(f'Rocker {i} cam roller contacts lobe',d<1e-4 and overlap(f'CamRoller{i}',f'ExhaustCam{i}')<1e-3,distance_mm=d)
            d=objects[f'ValveRoller{i}'].Shape.distToShape(objects[f'ExhaustStem{i}'].Shape)[0]
            check(f'Rocker {i} valve roller contacts stem',d<1e-4 and overlap(f'ValveRoller{i}',f'ExhaustStem{i}')<1e-3,distance_mm=d)
            check(f'Rocker {i} cheeks clear cast pivot support',overlap(f'RockerLeft{i}','Crankcase')<1e-3 and overlap(f'RockerRight{i}','Crankcase')<1e-3)
        mainys=[-48,.5*params.pitch,1.5*params.pitch,2.5*params.pitch,3*params.pitch+48]
        for i,y in enumerate(mainys):
            check(f'Main bearing {i+1} shaft clearance',all(overlap(f'MainBearing{i}_{s}','Crankshaft')<1e-3 for s in ('Upper','Lower')))
        check('Water jacket has free volume between liners',air('Crankcase',[250,params.pitch/2,0]))
        check('Lower water feed and both upper returns open',air('Crankcase',[270,params.pitch/2,-65]) and all(air('Crankcase',[285,y,65]) for y in (0,3*params.pitch)))
        check('All liners clear cast flange counterbores',all(overlap('Crankcase',f'Sleeve{i}')<1e-3 for i in range(1,5)))
        check('Crankshaft clears cast bearing access',overlap('Crankcase','Crankshaft')<1e-3)
        check('Flywheel generator friction-wheel tangency',objects['MagnetoDriveWheel'].Shape.distToShape(objects['Flywheel'].Shape)[0]<1e-4 and overlap('MagnetoDriveWheel','Flywheel')<1e-3)
        check('Ignition equal gears have tangent pitch circles',abs(2*math.hypot(41,37)/2-math.hypot(params.ignition_x-params.cam_x,params.ignition_z-params.cam_z))<1e-8)
        chain=json.loads((root/'cad-studies/wright-1903/revision-2/chain-layout.json').read_text());chords=chain['chord_lengths_mm']
        notes.append(dict(topic='Chain',status='unverified_for_operation',nominal_pitch_mm=25.4,chord_pitch_range_mm=[min(chords),max(chords)],reason='Static arc-length layout; curved-span chord spacing and pocket profiles do not constitute a manufactured chain/sprocket pair.'))
        # Limited, honest exterior correspondence: radius and centers, not a whole scan match.
        fits=json.loads((root/'cad-studies/wright-1903/primitive-fits.json').read_text())['regions'];alignment=[]
        for i,r in enumerate(fits):
            f=r['fit'];center=[(f['center'][0]+46)*10,(f['center'][1]-1.2)*10];cad=[params.valve_x,i*params.pitch]
            alignment.append(dict(cylinder=i+1,mesh_center_mm=center,cad_center_mm=cad,center_deviation_mm=math.dist(center,cad),radius_deviation_mm=abs(f['radius']*10-params.valve_box_radius),mesh_fit_rms_mm=f['rms']*10))
        # Test controlling bore on a disposable reopened copy; original file is never saved.
        old=objects['Piston1'].Shape.BoundBox.YLength;params.bore=111.6
        # Recompute only the tested descendants; rebuilding the detailed casting
        # is unnecessary for this deliberately bounded propagation check.
        doc.recompute([objects[n] for n in ('Sleeve1','Piston1','Ring1_0')])
        check('Reopened bore change propagates liner/piston/rings',objects['Sleeve1'].Shape.isValid() and objects['Piston1'].Shape.isValid() and any(abs(r-55.8)<1e-6 for r in radii(objects['Sleeve1'],'x')) and abs(objects['Piston1'].Shape.BoundBox.YLength-old-10)<.01 and abs(objects['Ring1_0'].Shape.BoundBox.ZLength-111.5)<.01)
        result=dict(passed=all(c['passed'] for c in checks),checks=checks,coverage=coverage,source_alignment=dict(scope='Four exterior housing ROIs at inferred scale; no global fit claim',regions=alignment),
          unresolved=notes+[dict(topic='Oil pump drive and service network',status='deferred_geometry',reason='Narrative worm/cross-shaft and Figure 5 cam-drive conflict; dimensioned drive drawings not acquired. Full pump/return/hose joint continuity is unverified; distributor/liner jet openings are checked separately.'),dict(topic='Dynamic phase, exact cam law and snap mechanism',status='unverified_for_operation',reason='Static geometry and bounded contacts only; no kinematic or combustion certification.'),dict(topic='Manufacturing/identity',status='unverified',reason='Exact drawing dimensions, fits, spring rates and authentic 1903 configuration not established.')],
          scope='Saved static CAD: nominal dimensions, selected interfaces/flow openings, native regeneration and source inventory. Not full-motion, stress, thermal or manufacturing validation.')
        (folder/'engineering-checks.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(dict(passed=result['passed'],checks=len(checks),failures=[c['check'] for c in checks if not c['passed']])))
        if not result['passed']:raise ValueError('Static assembly checks failed; repair source spec before release')
    finally:A.closeDocument(doc.Name)
if __name__=='__main__':main()
