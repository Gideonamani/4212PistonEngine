"""Round presentation attributes within a recorded tolerance before gzip packing."""
import json,struct

def compact_glb(path):
 raw=bytearray(path.read_bytes());json_length=struct.unpack_from('<I',raw,12)[0]
 doc=json.loads(raw[20:20+json_length]);binary_start=28+json_length
 attributes={}
 for mesh in doc['meshes']:
  for primitive in mesh['primitives']:
   for group in [primitive['attributes'],*primitive.get('targets',[])]:
    for semantic,index in group.items():
     if semantic in ['POSITION','NORMAL']:attributes[index]=6 if semantic=='POSITION' else 4
 for index,precision in attributes.items():
  accessor=doc['accessors'][index];assert accessor['componentType']==5126 and accessor['type']=='VEC3'
  view=doc['bufferViews'][accessor['bufferView']]
  assert not accessor.get('sparse')
  start=binary_start+view.get('byteOffset',0)+accessor.get('byteOffset',0);stride=view.get('byteStride',12)
  for i in range(accessor['count']):
   offset=start+i*stride;values=struct.unpack_from('<fff',raw,offset)
   struct.pack_into('<fff',raw,offset,*(round(v,precision) for v in values))
  for field in ['min','max']:
   if field in accessor:accessor[field]=[round(v,precision) for v in accessor[field]]
 header=json.dumps(doc,separators=(',',':')).encode();header+=b' '*((-len(header))%4)
 binary=raw[binary_start:]
 result=struct.pack('<III',0x46546c67,2,12+8+len(header)+8+len(binary))+struct.pack('<II',len(header),0x4e4f534a)+header+struct.pack('<II',len(binary),0x004e4942)+binary
 path.write_bytes(result)
 return {'position_coordinate_rounding_m':0.000001,'maximum_coordinate_rounding_error_mm':0.0005,'normal_component_rounding':0.0001,'scope':'Presentation mesh precision; native CAD is unchanged'}
