"""Check GLB identity, hierarchy and each part's world bounds against CAD mesh data."""
from pathlib import Path
import argparse,hashlib,json,math,struct

parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True)
parser.add_argument('--full-vertices',action='store_true',help='Compare both world-space vertex sets using SciPy')
args=parser.parse_args();folder=args.package.resolve()
if args.full_vertices:
    from scipy.spatial import cKDTree
cad=json.loads((folder/'cad-manifest.json').read_text());blend=json.loads((folder/'blender-manifest.json').read_text())
geometry=folder/cad['geometry_file'];assert hashlib.sha256(geometry.read_bytes()).hexdigest()==cad['geometry_sha256']==blend['cad_geometry_sha256']
data=json.loads(geometry.read_text());raw=(folder/'engine.glb').read_bytes()
assert hashlib.sha256(raw).hexdigest()==blend['files']['engine.glb']['sha256']
assert struct.unpack_from('<III',raw)==(0x46546c67,2,len(raw))
size,kind=struct.unpack_from('<II',raw,12);assert kind==0x4e4f534a
gltf=json.loads(raw[20:20+size]);offset=20+size
bin_size,kind=struct.unpack_from('<II',raw,offset);assert kind==0x004e4942
binary=raw[offset+8:offset+8+bin_size]
identity=[[float(i==j) for j in range(4)] for i in range(4)]
def multiply(a,b):return [[sum(a[i][k]*b[k][j] for k in range(4)) for j in range(4)] for i in range(4)]
def point(m,p):
    x,y,z=p
    return [r[0]*x+r[1]*y+r[2]*z+r[3] for r in m[:3]]
def matrix(t=(0,0,0),q=(0,0,0,1),s=(1,1,1)):
    x,y,z,w=q
    r=[[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],
       [2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],
       [2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]]
    return [[r[i][j]*s[j] for j in range(3)]+[t[i]] for i in range(3)]+[[0,0,0,1]]
world={}
def visit(index,parent):
    node=gltf['nodes'][index]
    local=([[node['matrix'][j*4+i] for j in range(4)] for i in range(4)] if 'matrix' in node else
           matrix(node.get('translation',(0,0,0)),node.get('rotation',(0,0,0,1)),node.get('scale',(1,1,1))))
    world[index]=multiply(parent,local)
    for child in node.get('children',[]):visit(child,world[index])
for node in gltf['scenes'][gltf.get('scene',0)]['nodes']:visit(node,identity)
nodes={}
for index in world:
    node=gltf['nodes'][index];pid=node.get('extras',{}).get('cad_part_id')
    if pid:
        if pid in nodes:raise ValueError('Duplicate GLB part ID '+pid)
        nodes[pid]=index
assert set(nodes)==set(cad['stable_ids'])
def bounds(vertices):return [min(p[i] for p in vertices) for i in range(3)]+[max(p[i] for p in vertices) for i in range(3)]
results=[]
for part in data['parts']:
    frame=data['groups'][part['group']];transform=matrix(frame['translation_mm'],frame['quaternion_xyzw'])
    expected=[]
    for p in part['vertices_mm']:
        x,y,z=point(transform,p);expected.append([x/1000,z/1000,-y/1000])
    index=nodes[part['id']];actual=[]
    for primitive in gltf['meshes'][gltf['nodes'][index]['mesh']]['primitives']:
        accessor=gltf['accessors'][primitive['attributes']['POSITION']]
        assert accessor['componentType']==5126 and accessor['type']=='VEC3' and 'sparse' not in accessor
        view=gltf['bufferViews'][accessor['bufferView']];start=view.get('byteOffset',0)+accessor.get('byteOffset',0)
        stride=view.get('byteStride',12)
        actual.extend(point(world[index],struct.unpack_from('<fff',binary,start+n*stride)) for n in range(accessor['count']))
    if not actual or not all(math.isfinite(v) for p in actual for v in p):raise ValueError(part['id'])
    error=max(abs(a-b) for a,b in zip(bounds(expected),bounds(actual)))
    if error>1e-6:raise ValueError(f'{part["id"]}: world bounds error {error} m')
    item={'id':part['id'],'world_bounds_error_m':error}
    if args.full_vertices:
        vertex_error=max(cKDTree(expected).query(actual)[0].max(),cKDTree(actual).query(expected)[0].max())
        if vertex_error>1e-6:raise ValueError(f'{part["id"]}: world vertex-set error {vertex_error} m')
        item['world_vertex_set_error_m']=float(vertex_error)
    results.append(item)
report={'passed':True,'parts':len(results),'source_sha256':cad['source_sha256'],
        'asset_sha256':blend['files']['engine.glb']['sha256'],'bind_angle_deg':data['bind_angle_deg'],
        'scope':'All part IDs and per-part world bounds, not vertex-by-vertex topology or browser behaviour',
        'maximum_bounds_error_m':max(r['world_bounds_error_m'] for r in results),'results':results}
if args.full_vertices:
    report['scope']='All IDs, world bounds and bidirectional world-space vertex-set distances; not triangle connectivity, normals or browser behaviour'
    report['maximum_vertex_set_error_m']=max(r['world_vertex_set_error_m'] for r in results)
(folder/'verification.json').write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({k:v for k,v in report.items() if k!='results'},indent=2))
