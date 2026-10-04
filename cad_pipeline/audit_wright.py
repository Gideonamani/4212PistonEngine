"""Check actual saved engine datums, key clearances and bore regeneration.
Does not modify the delivered native document.
"""
import argparse,json,math
from pathlib import Path
import FreeCAD as A

def main():
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);a=p.parse_args();folder=a.package
    doc=A.openDocument(str(folder/'wright-1903-reconstruction.FCStd'));doc.recompute();objects={o.StablePartID:o for o in doc.Objects if hasattr(o,'StablePartID')};checks=[]
    def record(name,passed,**data):
        checks.append(dict(check=name,passed=bool(passed),**data))
        if not passed:print('FAILED',name,flush=True)
    try:
        for i in range(1,5):
            sleeve=objects[f'Sleeve{i}'];piston=objects[f'Piston{i}'];pin=objects[f'WristPin{i}'];big=objects[f'BigEnd{i}'];little=objects[f'LittleEnd{i}']
            radii=[f.Surface.Radius for f in sleeve.Shape.Faces if f.Surface.__class__.__name__=='Cylinder' and abs(f.Surface.Axis.x)>.999]
            record(f'Cylinder {i} nominal bore',any(abs(r-50.8)<1e-6 for r in radii),target_diameter_mm=101.6)
            for left,right in [(sleeve,piston),(piston,pin),(big,objects['Crankshaft']),(little,pin),(objects['Crankcase'],sleeve),(sleeve,objects[f'ValveBox{i}']),(objects['IntakeManifold'],objects[f'ValveBox{i}'])]:
                volume=left.Shape.common(right.Shape).Volume
                record(left.StablePartID+' / '+right.StablePartID+' no solid overlap',volume<1e-4,intersection_volume_mm3=volume)
            for k in range(1,4):
                ring=objects[f'Ring{i}_{k}']
                for mate in (piston,sleeve):
                    volume=ring.Shape.common(mate.Shape).Volume
                    record(ring.StablePartID+' / '+mate.StablePartID+' no solid overlap',volume<1e-4,intersection_volume_mm3=volume)
        before=objects['Piston1'].Shape.BoundBox.YLength;doc.Parameters.bore=111.6;doc.recompute()
        sleeve=objects['Sleeve1'];piston=objects['Piston1']
        radii=[f.Surface.Radius for f in sleeve.Shape.Faces if f.Surface.__class__.__name__=='Cylinder' and abs(f.Surface.Axis.x)>.999]
        record('Reopened engine bore regeneration',any(abs(r-55.8)<1e-6 for r in radii) and sleeve.Shape.isValid() and piston.Shape.isValid(),changed_bore_mm=111.6)
        record('Piston follows changed bore',abs(piston.Shape.BoundBox.YLength-before-10)<.01,diameter_change_mm=piston.Shape.BoundBox.YLength-before)
        ring=objects['Ring1_1']
        record('Split ring follows changed bore',ring.Shape.isValid() and abs(ring.Shape.BoundBox.ZLength-111.5)<.01,outer_diameter_mm=ring.Shape.BoundBox.ZLength)
        result=dict(passed=all(c['passed'] for c in checks),checks=checks,
                    scope='Saved geometry: four bores, selected internal/mating clearances and disposable bore change. No complete assembly-motion or historical fidelity certification.',
                    unresolved=['Actual cam/rocker contacts','Generator/flywheel friction drive','Rod socket fastening details','Cooling/induction/oil routing','Casting webs/bearing supports','Threads, timing chain and spring wire'])
        (folder/'engineering-checks.json').write_text(json.dumps(result,indent=2)+'\n');print(json.dumps({'passed':result['passed'],'checks':len(checks)}))
        if not result['passed']:raise ValueError('Selected engine interfaces failed')
    finally:A.closeDocument(doc.Name)

if __name__=='__main__':main()
