"""Export an explicit CAD pose and native mesh inventory without saving the source."""
from pathlib import Path
import argparse,hashlib,json,math
import FreeCAD as App

parser=argparse.ArgumentParser()
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--angle',type=float,default=0)
parser.add_argument('--tolerance',type=float,default=.1)
args=parser.parse_args()
if not math.isfinite(args.angle) or not 0<args.tolerance<=1:parser.error('Invalid pose or mesh tolerance')
source=args.source.resolve();output=args.output.resolve()
output.mkdir(parents=True,exist_ok=True)
if source.parent==output:parser.error('Use an isolated output directory')
if any((output/name).exists() for name in ['geometry.json','cad-manifest.json']):
    parser.error('Use a fresh package directory so a failed export cannot reuse an older manifest')
source_hash=hashlib.sha256(source.read_bytes()).hexdigest()
doc=App.openDocument(str(source))
def frame(placement):
    return {'translation_mm':list(placement.Base),'quaternion_xyzw':list(placement.Rotation.Q)}
try:
    doc.Motion.set('B2',f'{args.angle} deg');doc.recompute()
    bodies=[b for b in doc.Objects if b.TypeId=='PartDesign::Body' and not getattr(b,'ConstructionOnly',False)]
    ids=[b.StablePartID for b in bodies]
    if not ids or len(ids)!=len(set(ids)):raise ValueError('Missing or duplicate stable IDs')
    payload={'schema_version':1,'source_sha256':source_hash,'units':'mm','bind_angle_deg':args.angle,
             'coordinates':'FreeCAD XYZ; Blender uses the same axes, glTF exporter converts to Y-up',
             'groups':{},'parts':[],'dimensions_mm':{}}
    for name in ['Bore','Stroke','RodLength']:
        value=getattr(doc.Parameters,name).Value
        if not math.isfinite(value) or value<=0:raise ValueError(name)
        payload['dimensions_mm'][name]=value
    for body in bodies:
        if body.Shape.isNull() or not body.Shape.isValid() or len(body.Shape.Solids)!=1:raise ValueError(body.Name)
        group=body.getParentGeoFeatureGroup()
        payload['groups'][group.Name]=frame(group.getGlobalPlacement())
        vertices,triangles=body.Shape.tessellate(args.tolerance)
        payload['parts'].append({'id':body.StablePartID,'label':body.Label,'group':group.Name,
            'material_category':body.MaterialCategory,'evidence':body.Evidence,
            'vertices_mm':[list(v) for v in vertices],'triangles':triangles})
        print('Exported',body.StablePartID,len(triangles),'triangles',flush=True)
    geometry=output/'geometry.json'
    geometry.write_text(json.dumps(payload,separators=(',',':')))
    manifest={'schema_version':1,'stage':'CAD geometry export; Blender/browser validation pending',
              'source_file':source.name,'source_sha256':source_hash,'bind_angle_deg':args.angle,
              'tessellation_tolerance_mm':args.tolerance,'parts':len(bodies),
              'triangles':sum(len(p['triangles']) for p in payload['parts']),
              'geometry_file':geometry.name,'geometry_sha256':hashlib.sha256(geometry.read_bytes()).hexdigest(),
              'geometry_bytes':geometry.stat().st_size,'stable_ids':ids}
    (output/'cad-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
finally:App.closeDocument(doc.Name)
assert hashlib.sha256(source.read_bytes()).hexdigest()==source_hash
