"""Derive a diagnostic cylinder-section snapshot from saved engineering CAD.

Section copies are explicitly presentation-only. They are excluded from the
engineering STEP and GLB and never replace a stable engineering part.
"""
import argparse,hashlib,json,sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import FreeCAD as A,Part,MeshPart

def main():
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);a=p.parse_args();folder=a.package
    report=json.loads((folder/'cad-validation.json').read_text());native=folder/(report['model_id']+'.FCStd');doc=A.openDocument(str(native));spec=json.loads(doc.Parameters.SpecificationJSON)
    if doc.getObject('PresentationSections'):raise ValueError('Sections already exist; regenerate or remove derived group explicitly')
    tips={o.StablePartID:o for o in doc.Objects if hasattr(o,'StablePartID')};group=doc.addObject('App::DocumentObjectGroup','PresentationSections');group.Label='Presentation-only cylinder section'
    slab=Part.makeBox(1100,doc.Parameters.pitch/2,600,A.Vector(-150,0,-300))
    views=spec['presentation']['views'];ids={'Crankcase','Cover','IntakeManifold','Crankshaft','Camshaft','IgnitionShaft','IgnitionCam1','ExhaustCam1','ValveBox1','OilDistributor','OilJet1'}
    for view in views:
        if view['id'] in ('cylinder-detail','valve-detail','rocker-detail','igniter-detail'):ids.update(view.get('parts',[]))
    originals={p['id']:p for p in spec['parts']};records=[]
    for id in sorted(ids):
        if id not in tips:raise ValueError('Unknown section source '+id)
        obj=doc.addObject('Part::Feature','Section_'+id);group.addObject(obj);obj.Shape=tips[id].Shape.common(slab);obj.addProperty('App::PropertyString','SourcePartID','Presentation');obj.SourcePartID=id;obj.addProperty('App::PropertyLink','SourcePart','Presentation');obj.SourcePart=tips[id];obj.addProperty('App::PropertyString','SectionScope','Presentation');obj.SectionScope='Derived presentation snapshot; regenerate sections after any engineering geometry change';obj.Label='SECTION ONLY: '+originals[id]['label'];obj.Visibility=False
        shape=obj.Shape
        if shape.isNull() or shape.Volume<1e-6:continue
        if not shape.isValid():raise ValueError('Invalid diagnostic section '+id)
        mesh=MeshPart.meshFromShape(Shape=shape,LinearDeflection=.7,AngularDeflection=.35,Relative=False);v,f=mesh.Topology
        records.append(dict(id='Section_'+id,source_part_id=id,label=originals[id]['label']+' (section)',material=originals[id]['material'],group='section',evidence='Presentation section derived from saved CAD; manufacturing estimates retained',vertices_mm=[list(x) for x in v],triangles=f))
        print('SECTION',id,flush=True)
    group.Visibility=False;doc.save();A.closeDocument(doc.Name)
    geometry=folder/'geometry.json';data=json.loads(geometry.read_text());data['sections']=[dict(id='cylinder-section',title='Cylinder 1 section: jacket, piston, cages and rocker',direction=[0,-1,0],parts=records,scope='Derived diagnostic slab; presentation only, not an engineering part')]
    with geometry.open('w',encoding='utf-8') as stream:json.dump(data,stream,separators=(',',':'))
    for file in (native,geometry):report['files'][file.name]=dict(bytes=file.stat().st_size,sha256=hashlib.sha256(file.read_bytes()).hexdigest())
    report['presentation_sections']=dict(count=len(records),engineering_part_count=report['part_count'],excluded_from_step=True)
    (folder/'cad-validation.json').write_text(json.dumps(report,indent=2)+'\n');print('SECTIONS_COMPLETE',len(records),flush=True)
if __name__=='__main__':main()
