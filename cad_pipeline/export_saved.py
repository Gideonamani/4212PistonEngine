"""Recover an interrupted tessellation/report export from a saved native model.

Writes one part at a time, so geometry JSON does not require a second full
assembly string in memory. Engineering identities remain native CAD identities.
"""
import argparse,hashlib,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import FreeCAD as A,Part,MeshPart
from cad_pipeline.research_gate import check_spec_research

def main():
    p=argparse.ArgumentParser();p.add_argument('--native',type=Path,required=True);a=p.parse_args();native=a.native.resolve();folder=native.parent
    doc=A.openDocument(str(native));spec=json.loads(doc.Parameters.SpecificationJSON)
    research=check_spec_research(spec,Path(__file__).resolve().parents[1]);tips={o.StablePartID:o for o in doc.Objects if hasattr(o,'StablePartID')}
    if set(tips)!={p['id'] for p in spec['parts']}:raise ValueError('Incomplete native model')
    records=[];geometry=folder/'geometry.json';header=dict(schema_version=1,units='mm',coordinates='FreeCAD XYZ; divide by 1000 once in Blender',bounds_method='optimal_without_triangulation_or_shape_tolerance',model_id=spec['model_id'],scope=spec['scope'],presentation=spec.get('presentation',{}))
    temporary=folder/'geometry-recovery.tmp'
    with temporary.open('w',encoding='utf-8') as stream:
        stream.write(json.dumps(header,separators=(',',':'))[:-1]+',"parts":[')
        for i,part in enumerate(spec['parts']):
            shape=tips[part['id']].Shape
            if shape.isNull() or not shape.isValid() or len(shape.Solids)!=1 or shape.Volume<=0:raise ValueError(part['id'])
            mesh=MeshPart.meshFromShape(Shape=shape,LinearDeflection=.7,AngularDeflection=.35,Relative=False);v,f=mesh.Topology;b=shape.optimalBoundingBox(False,False)
            record=dict(id=part['id'],label=part['label'],group=part['group'],material=part['material'],evidence=part['evidence'],volume_mm3=shape.Volume,bounds_mm=[[b.XMin,b.YMin,b.ZMin],[b.XMax,b.YMax,b.ZMax]],feature_count=len(part['features']))
            records.append(record)
            if i:stream.write(',')
            json.dump(dict(record,vertices_mm=[list(x) for x in v],triangles=f),stream,separators=(',',':'));stream.flush()
            if i%25==0:print('EXPORTED',i+1,part['id'],flush=True)
        stream.write(']}')
    temporary.replace(geometry)
    step=folder/(spec['model_id']+'.step')
    if not step.exists():Part.export([tips[p['id']] for p in spec['parts']],str(step))
    report=dict(schema_version=1,model_id=spec['model_id'],geometric_validation_passed=True,historical_accuracy_verified=False,bounds_method=header['bounds_method'],complete_spec=True,freecad_version=A.Version(),part_count=len(tips),feature_count=sum(x['feature_count'] for x in records),research_review=research,
        native_feature_history='Native Part primitives, constrained sketch extrusions, helix sweeps and linked Booleans driven by Parameters expressions',spec_sha256=hashlib.sha256(json.dumps(spec,sort_keys=True).encode()).hexdigest(),
        files={f.name:dict(bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest()) for f in (native,step,geometry)},parts=records)
    (folder/'cad-validation.json').write_text(json.dumps(report,indent=2)+'\n');A.closeDocument(doc.Name);print('EXPORT_COMPLETE',len(tips),flush=True)
if __name__=='__main__':main()
