"""Verify every exported spring morph displacement against the CAD-derived sweep."""
from pathlib import Path
import argparse,hashlib,json,struct
import numpy as np
parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True)
args=parser.parse_args();folder=args.package.resolve();repo=Path(__file__).resolve().parents[1]
audit_file=repo/'data/spring-motion.json';audit=json.loads(audit_file.read_text())
manifest=json.loads((folder/'blender-manifest.json').read_text())
assert audit['passed'] and audit['audit_complete']
assert hashlib.sha256(audit_file.read_bytes()).hexdigest()==manifest['spring_motion']['audit_sha256']
assert audit['source_sha256']==manifest['source_sha256']
raw=(folder/'engine.glb').read_bytes();sha=hashlib.sha256(raw).hexdigest()
assert sha==manifest['files']['engine.glb']['sha256']
assert struct.unpack_from('<III',raw)==(0x46546c67,2,len(raw))
size,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a
gltf=json.loads(raw[20:20+size]);offset=20+size
length,kind=struct.unpack_from('<II',raw,offset);assert kind==0x004e4942
binary=raw[offset+8:offset+8+length]
def values(view_id,offset,count,width,dtype):
    view=gltf['bufferViews'][view_id];dtype=np.dtype(dtype)
    return np.ndarray((count,width),dtype=dtype,buffer=binary,
        offset=view.get('byteOffset',0)+offset,strides=(view.get('byteStride',width*dtype.itemsize),dtype.itemsize)).copy()
def accessor(index):
    a=gltf['accessors'][index];assert a['componentType']==5126 and a['type']=='VEC3'
    result=values(a['bufferView'],a.get('byteOffset',0),a['count'],3,'<f4') if 'bufferView' in a else np.zeros((a['count'],3))
    if 'sparse' in a:
        s=a['sparse'];i=s['indices'];v=s['values']
        indices=values(i['bufferView'],i.get('byteOffset',0),s['count'],1,{5121:'u1',5123:'<u2',5125:'<u4'}[i['componentType']]).ravel()
        result[indices]=values(v['bufferView'],v.get('byteOffset',0),s['count'],3,'<f4')
    assert np.isfinite(result).all();return result.astype(float)
def rotation(q):
    x,y,z,w=q
    return np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
                     [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
                     [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
world={}
def visit(index,parent):
    node=gltf['nodes'][index]
    if 'matrix' in node:local=np.array(node['matrix']).reshape(4,4).T
    else:
        local=np.eye(4);local[:3,:3]=rotation(node.get('rotation',[0,0,0,1]))@np.diag(node.get('scale',[1,1,1]));local[:3,3]=node.get('translation',[0,0,0])
    world[index]=parent@local
    for child in node.get('children',[]):visit(child,world[index])
for index in gltf['scenes'][gltf.get('scene',0)]['nodes']:visit(index,np.eye(4))
rows=[]
for index,transform in world.items():
    node=gltf['nodes'][index];pid=node.get('extras',{}).get('cad_part_id')
    if pid not in audit['springs']:continue
    p=audit['springs'][pid];mesh=gltf['meshes'][node['mesh']]
    target_index=mesh['extras']['targetNames'].index('ValveLift7mm')
    assert all(w==0 for w in node.get('weights',mesh.get('weights',[])))
    count=0;maximum=0
    body_rotation=rotation(p['body_world_quaternion_xyzw'])
    direction=body_rotation[:,0];mapped_direction=np.array([direction[0],direction[2],-direction[1]])
    for primitive in mesh['primitives']:
        base=accessor(primitive['attributes']['POSITION']);delta=accessor(primitive['targets'][target_index]['POSITION'])
        assert base.shape==delta.shape
        gltf_world=base@transform[:3,:3].T+transform[:3,3]
        cad_world=gltf_world[:,[0,2,1]]*np.array([1000,-1000,1000])
        local=(cad_world-np.array(p['body_world_translation_mm']))@body_rotation
        fraction=np.mod(p['angular_direction']*np.arctan2(local[:,2],local[:,1])/(2*np.pi),1)
        turn=np.rint((local[:,0]-p['start_x_mm'])/p['pitch_mm']-fraction)
        travel=np.clip((turn+fraction)/p['turns'],0,1)
        expected=-p['maximum_lift_mm']/1000*travel[:,None]*mapped_direction
        actual=delta@transform[:3,:3].T
        maximum=max(maximum,float(np.linalg.norm(actual-expected,axis=1).max()));count+=len(base)
    assert maximum<1e-6,(pid,maximum)
    rows.append({'id':pid,'vertices_checked':count,'maximum_displacement_error_m':maximum})
assert {r['id'] for r in rows}==set(audit['springs'])
report={'passed':True,'source_sha256':audit['source_sha256'],'asset_sha256':sha,'springs':rows,
        'scope':'All exported morph displacements compared to CAD-derived screw-sweep deformation; native surface agreement is separately sampled in spring-motion.json'}
(folder/'spring-morph-verification.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
