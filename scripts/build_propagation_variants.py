"""Create disposable, independently changed CAD copies for the M3 propagation test."""
from pathlib import Path
import hashlib,json
import FreeCAD as App

repo=Path(__file__).resolve().parents[1]
source=repo.parent/'EngineSimulation/FreeCAD/v2/GTSIO520_Detailed_Cylinder.FCStd'
source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
folder=repo/'build/propagation-variants';folder.mkdir(parents=True,exist_ok=True)
if any((folder/(name+'.FCStd')).exists() for name in ['fin-change','rod-change']):raise RuntimeError('Variant files already exist; preserve them and choose a new run directory')
doc=App.openDocument(str(source))
report={'source_sha256':source_hash,'purpose':'Disposable propagation exercises, not design changes for release','variants':[]}
try:
    p=doc.Parameters
    original_fin=p.HeadFinThickness.Value;original_rod=p.RodLength.Value
    for name,fin,rod in [('fin-change',original_fin+.25,original_rod),('rod-change',original_fin,original_rod+2)]:
        p.set(p.getCellFromAlias('HeadFinThickness'),f'{fin} mm')
        p.set(p.getCellFromAlias('RodLength'),f'{rod} mm')
        doc.Motion.set('B2','0 deg');print('Recomputing',name,flush=True);doc.recompute()
        bodies=[b for b in doc.Objects if b.TypeId=='PartDesign::Body']
        invalid=[b.Name for b in bodies if b.Shape.isNull() or not b.Shape.isValid() or len(b.Shape.Solids)!=1]
        if invalid:raise RuntimeError(str(invalid))
        target=folder/(name+'.FCStd');doc.saveAs(str(target))
        report['variants'].append({'name':name,'file':'build/propagation-variants/'+target.name,
            'sha256':hashlib.sha256(target.read_bytes()).hexdigest(),'head_fin_thickness_mm':fin,'rod_length_mm':rod,
            'body_count':len(bodies),'head_volume_mm3':doc.CylinderHead.Shape.Volume,
            'rod_volume_mm3':doc.ConnectingRodBody.Shape.Volume,'piston_group_x_mm':doc.Piston.Placement.Base.x})
        (repo/'data/propagation-variants.json').write_text(json.dumps(report,indent=2)+'\n')
        print('Saved',name,flush=True)
finally:App.closeDocument(doc.Name)
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
