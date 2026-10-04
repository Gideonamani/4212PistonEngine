"""Reconcile reviewed basic-feature edits/additions with an existing native build.

Requires identical parameters, part identities and existing primitive order.
Unsupported changes require a full regenerate. No mesh edits are performed.
"""
import argparse,hashlib,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import FreeCAD as A,Part,MeshPart
from cad_pipeline.generate import basic_feature,rich_feature,place
from cad_pipeline.spec import validate_spec,evaluate,freecad_expression
from cad_pipeline.research_gate import check_spec_research

def main():
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);p.add_argument('--spec',type=Path,required=True);a=p.parse_args();folder=a.package
    spec=json.loads(a.spec.read_text());validate_spec(spec);research=check_spec_research(spec,Path(__file__).resolve().parents[1])
    report=json.loads((folder/'cad-validation.json').read_text());native=folder/(report['model_id']+'.FCStd');doc=A.openDocument(str(native));old=json.loads(doc.Parameters.SpecificationJSON)
    if spec['parameters']!=old['parameters'] or {p['id'] for p in spec['parts']}!={p['id'] for p in old['parts']}:raise ValueError('Parameter/part identity changes require regeneration')
    oldparts={p['id']:p for p in old['parts']};tips={o.StablePartID:o for o in doc.Objects if hasattr(o,'StablePartID')};data=json.loads((folder/'geometry.json').read_text());records={p['id']:p for p in data['parts']};changed=[]
    keys={'box':{'length':'Length','width':'Width','height':'Height'},'cylinder':{'radius':'Radius','height':'Height'},'tube':{'radius':'Radius','height':'Height'},'cone':{'radius1':'Radius1','radius2':'Radius2','height':'Height'},'sphere':{'radius':'Radius'}}
    # Changing a property on the parameter controller can dirty its geometric
    # descendants. Do this before feature creation/recomputes, avoiding a second
    # whole-assembly recalculation after all local edits have already computed.
    doc.Parameters.SpecificationJSON=json.dumps(spec)
    for part in spec['parts']:
        previous=oldparts[part['id']];before=previous['features'];after=part['features'];group=doc.getObject(part['id']);current=tips[part['id']]
        if before!=after:print('UPDATING',part['id'],flush=True)
        if len(after)<len(before):raise ValueError('Feature deletion requires regeneration')
        for i,f in enumerate(after):
            prefix=part['id']+'_F'+str(i+1)
            if i<len(before):
                if f==before[i]:continue
                if f['primitive']!=before[i]['primitive'] or f['operation']!=before[i]['operation'] or f['primitive'] not in keys:raise ValueError('Unsupported existing feature edit '+prefix)
                obj=doc.getObject(prefix)
                for key,prop in keys[f['primitive']].items():setattr(obj,prop,evaluate(f[key],spec['parameters']));obj.setExpression(prop,freecad_expression(f[key]))
                place(obj,f,spec['parameters'])
                if f['primitive']=='tube':
                    inner=doc.getObject(prefix+'_Inner');place(inner,f,spec['parameters']);inner.Radius=evaluate(f['inner_radius'],spec['parameters']);inner.setExpression('Radius',freecad_expression(f['inner_radius']));inner.Height=evaluate(f['height'],spec['parameters']);inner.setExpression('Height',freecad_expression(f['height']))
            else:
                obj=rich_feature(doc,group,prefix,f,spec['parameters']) if f['primitive'] in ('prism','helix') else basic_feature(doc,group,prefix,f,spec['parameters'])
                boolean=doc.addObject('Part::Fuse' if f['operation']=='add' else 'Part::Cut',prefix+'_Result');boolean.Base=current;boolean.Tool=obj;boolean.Refine=True;group.addObject(boolean);current.Visibility=False;obj.Visibility=False;current=boolean
            if part['id'] not in changed:changed.append(part['id'])
        if current!=tips[part['id']]:
            original=tips[part['id']]
            for key in ('StablePartID','Evidence','MaterialCategory','ComponentGroup'):original.removeProperty(key);current.addProperty('App::PropertyString',key,'Reconstruction')
            tips[part['id']]=current
        current.StablePartID=part['id'];current.Evidence=part['evidence'];current.MaterialCategory=part['material'];current.ComponentGroup=part['group'];current.Label=part['label'];current.Visibility=True
    doc.recompute()
    for part in spec['parts']:
        obj=tips[part['id']];shape=obj.Shape
        if not shape.isValid() or len(shape.Solids)!=1:raise ValueError('Invalid updated part '+part['id'])
        if part['id'] in changed:
            mesh=MeshPart.meshFromShape(Shape=shape,LinearDeflection=.7,AngularDeflection=.35,Relative=False);v,f=mesh.Topology;b=shape.optimalBoundingBox(False,False)
            records[part['id']]=dict(id=part['id'],label=part['label'],group=part['group'],material=part['material'],evidence=part['evidence'],volume_mm3=shape.Volume,bounds_mm=[[b.XMin,b.YMin,b.ZMin],[b.XMax,b.YMax,b.ZMax]],vertices_mm=[list(x) for x in v],triangles=f,feature_count=len(part['features']))
        records[part['id']]['evidence']=part['evidence']
        b=shape.optimalBoundingBox(False,False)
        records[part['id']]['bounds_mm']=[[b.XMin,b.YMin,b.ZMin],[b.XMax,b.YMax,b.ZMax]];records[part['id']]['volume_mm3']=shape.Volume
    report['complete_spec']=False
    (folder/'cad-validation.json').write_text(json.dumps(report,indent=2)+'\n')
    doc.save();Part.export([tips[p['id']] for p in spec['parts']],str(folder/(spec['model_id']+'.step')))
    data.update(parts=[records[p['id']] for p in spec['parts']],presentation=spec['presentation'],bounds_method='optimal_without_triangulation_or_shape_tolerance')
    with (folder/'geometry.json').open('w',encoding='utf-8') as stream:json.dump(data,stream,separators=(',',':'))
    report.update(complete_spec=True,bounds_method=data['bounds_method'],feature_count=sum(len(p['features']) for p in spec['parts']),research_review=research,spec_sha256=hashlib.sha256(json.dumps(spec,sort_keys=True).encode()).hexdigest(),parts=[{k:v for k,v in r.items() if k not in ('vertices_mm','triangles')} for r in data['parts']])
    report['files']={p.name:dict(bytes=p.stat().st_size,sha256=hashlib.sha256(p.read_bytes()).hexdigest()) for p in (native,folder/(spec['model_id']+'.step'),folder/'geometry.json')}
    (folder/'cad-validation.json').write_text(json.dumps(report,indent=2)+'\n');A.closeDocument(doc.Name);print('UPDATED',changed)
if __name__=='__main__':main()
