"""Append direct operations to a hash-bound unchanged source recipe prefix.

For development evaluation only. The caller supplies the digest from the
previous passed source record; final saved/native agreement remains required.
"""
import json
from pathlib import Path
import FreeCAD as A
import Part
import MeshPart
from cad_pipeline.extend_saved_native import rebuild_plan
from cad_pipeline.append_native_history import eligible
from cad_pipeline.fast_build import part_key,feature_shape
from cad_pipeline.spec import deflection_for
from cad_pipeline.meshing import tessellation_shape
from cad_pipeline.saved_native_stock import file_sha


def seed(old,new,identity,source,accepted_sha,output):
    before=next(p for p in old['parts'] if p['id']==identity)
    after=next(p for p in new['parts'] if p['id']==identity)
    plan=rebuild_plan(old,new)
    if not eligible(before,after,plan['changed_parameters'],any(p.get('geometry_instance_of')==identity for p in new['parts'])):
        raise ValueError('Direct prefix dependencies changed: '+identity)
    source=Path(source);output=Path(output)
    expected=identity+'-'+part_key(before,old['parameters'],deflection_for(old,before))
    if source.stem!=expected or file_sha(source)!=accepted_sha:
        raise ValueError('Accepted direct source identity/hash mismatch')
    shape=Part.read(str(source))
    for index,feature in enumerate(after['features'][len(before['features']):],len(before['features'])+1):
        tool=feature_shape(feature,new['parameters'])
        shape=shape.fuse(tool) if feature['operation']=='add' else shape.cut(tool)
        if after.get('boolean_refine',True):shape=shape.removeSplitter()
        if not shape.Solids or not shape.isValid():raise ValueError('Invalid/empty direct prefix operation: '+identity+' feature'+str(index))
    if not shape.isValid() or len(shape.Solids)!=1 or shape.Volume<=0:raise ValueError('Invalid direct prefix result')
    for folder in ['brep-cache','part-cache']:(output/folder).mkdir(parents=True,exist_ok=True)
    key=part_key(after,new['parameters'],deflection_for(new,after));target=output/'brep-cache'/(identity+'-'+key+'.brep')
    shape.exportBrep(str(target))
    mesh=MeshPart.meshFromShape(Shape=tessellation_shape(shape,after),LinearDeflection=deflection_for(new,after),AngularDeflection=.35,Relative=False)
    vertices,faces=mesh.Topology;b=shape.optimalBoundingBox(False,False)
    record=dict(id=identity,label=after['label'],group=after['group'],material=after['material'],evidence=after['evidence'],valid=True,solids=1,volume_mm3=shape.Volume,bounds_mm=[[b.XMin,b.YMin,b.ZMin],[b.XMax,b.YMax,b.ZMax]],vertices_mm=[list(v) for v in vertices],triangles=faces,feature_count=len(after['features']),geometry_master_id=None)
    (output/'part-cache'/(identity+'.json')).write_text(json.dumps(dict(key=key,record=record),separators=(',',':')),encoding='utf-8')
    return dict(id=identity,source_brep_sha256=accepted_sha,result_brep_sha256=file_sha(target),unchanged_prefix_features=len(before['features']),appended_features=len(after['features'])-len(before['features']),scope='Direct development cache only; saved agreement and current neighboring pairs still required')
