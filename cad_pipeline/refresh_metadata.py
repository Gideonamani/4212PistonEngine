"""Normalize CAD bounds independently of OCC's optional triangulation cache.

No geometry, feature or tolerance is changed. Cached tessellation can alter the
default BRep bounding-box estimator, particularly for swept B-spline springs.
"""
import argparse,hashlib,json
from pathlib import Path
import FreeCAD as A

def main():
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);a=p.parse_args();folder=a.package
    report=json.loads((folder/'cad-validation.json').read_text());native=folder/(report['model_id']+'.FCStd')
    if hashlib.sha256(native.read_bytes()).hexdigest()!=report['files'][native.name]['sha256']:raise ValueError('Native file changed')
    geometry=folder/'geometry.json';data=json.loads(geometry.read_text());doc=A.openDocument(str(native));objects={o.StablePartID:o for o in doc.Objects if hasattr(o,'StablePartID')}
    if set(objects)!={p['id'] for p in data['parts']}:raise ValueError('Part identities differ')
    for part in data['parts']:
        shape=objects[part['id']].Shape;b=shape.optimalBoundingBox(False,False)
        if abs(shape.Volume-part['volume_mm3'])/shape.Volume>1e-6:raise ValueError('Geometry changed: '+part['id'])
        part['bounds_mm']=[[b.XMin,b.YMin,b.ZMin],[b.XMax,b.YMax,b.ZMax]];part['volume_mm3']=shape.Volume
    data['bounds_method']='optimal_without_triangulation_or_shape_tolerance'
    temporary=folder/'geometry-metadata.tmp'
    with temporary.open('w',encoding='utf-8') as stream:json.dump(data,stream,separators=(',',':'))
    temporary.replace(geometry);report['bounds_method']=data['bounds_method'];report['parts']=[{k:v for k,v in p.items() if k not in ('vertices_mm','triangles')} for p in data['parts']]
    report['files'][geometry.name]=dict(bytes=geometry.stat().st_size,sha256=hashlib.sha256(geometry.read_bytes()).hexdigest())
    report['metadata_normalization']='Optimal CAD bounds without triangulation/tolerance expansion; geometry and native file unchanged. See metadata-differences.json for original default-box discrepancy.'
    (folder/'cad-validation.json').write_text(json.dumps(report,indent=2)+'\n');A.closeDocument(doc.Name);print('METADATA_REFRESHED',len(objects),flush=True)
if __name__=='__main__':main()
