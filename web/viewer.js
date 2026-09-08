import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const $ = id => document.getElementById(id);
const say = text => $('status').textContent = text;
const log = text => $('log').textContent += text + '\n';
const scene = new THREE.Scene();
scene.background = new THREE.Color('#101923');
const camera = new THREE.PerspectiveCamera(40, 1, .001, 100);
const renderer = new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
$('view').appendChild(renderer.domElement);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;
scene.add(new THREE.HemisphereLight(0xe5f5ff, 0x506070, 3));
for (const [x,y,z] of [[2,3,4],[-3,1,-2]]) {
  const light = new THREE.DirectionalLight(0xffffff, 2);light.position.set(x,y,z);scene.add(light);
}
const resize = new ResizeObserver(() => {
  const {width,height} = $('view').getBoundingClientRect();
  renderer.setSize(width,height); camera.aspect=width/height;camera.updateProjectionMatrix();renderer.render(scene,camera);
});resize.observe($('view'));
controls.addEventListener('change',()=>renderer.render(scene,camera));
let root, meshes=[], selected='', catalogue=new Map(), busy=false;
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const originals = new Map();
function fit(object) {
  const box=new THREE.Box3().setFromObject(object), center=box.getCenter(new THREE.Vector3());
  const size=box.getSize(new THREE.Vector3()).length();
  const distance=size/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*Math.max(1,1/camera.aspect);
  camera.position.copy(center).add(new THREE.Vector3(1,.65,1).normalize().multiplyScalar(distance*1.3));
  controls.target.copy(center);controls.update();
}
function restore(){for(const m of meshes){m.visible=true;m.material=originals.get(m);} }
const highlight = new THREE.MeshStandardMaterial({color:0xf1b852,metalness:.5,roughness:.35});
const ghost = new THREE.MeshStandardMaterial({color:0x9cbdcf,transparent:true,opacity:.12,depthWrite:false});
function choose(id){
  restore();selected=id;$('parts').value=id;
  const part=catalogue.get(id);
  $('part-name').textContent=part?.display_name || 'Cylinder study';
  $('part-function').textContent=part?.function || 'Drag to rotate the assembly. Choose a component to inspect it.';
  for(const m of meshes) if(m.userData.partId===id)m.material=highlight;
  $('isolate').disabled=!id;
  renderer.render(scene,camera);
}
$('parts').onchange=()=>choose($('parts').value);
$('isolate').onclick=()=>{
  for(const m of meshes)m.material=m.userData.partId===selected?highlight:ghost;
  const picked=meshes.find(m=>m.userData.partId===selected);if(picked)fit(picked);
};
$('reset').onclick=()=>{choose('');if(root)fit(root);};
let down;
renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointerup',e=>{
  if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;
  const r=renderer.domElement.getBoundingClientRect();
  pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  ray.setFromCamera(pointer,camera);
  const hit=ray.intersectObjects(meshes).find(h=>h.object.material!==ghost);
  if(hit)choose(hit.object.userData.partId);
});
function driveCandidates(link){
  const url=new URL(link);
  if(url.protocol!=='https:'||url.hostname!=='drive.google.com')throw Error('Use a Google Drive HTTPS sharing link.');
  const id=url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || url.searchParams.get('id');
  if(!id||!/^[-\w]+$/.test(id))throw Error('The link does not contain a valid Drive file ID.');
  const params=new URLSearchParams({export:'download',id});
  if(url.searchParams.has('resourcekey'))params.set('resourcekey',url.searchParams.get('resourcekey'));
  return [`https://drive.usercontent.google.com/download?${params}`,`https://drive.google.com/uc?${params}`];
}
async function fetchGLB(url){
  const response=await fetch(url,{mode:'cors',credentials:'omit',referrerPolicy:'no-referrer',signal:AbortSignal.timeout(30000)});
  log(`HTTP ${response.status}; type ${response.headers.get('content-type')}; URL ${response.url}`);
  if(!response.ok)throw Error(`HTTP ${response.status}`);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength<20||new DataView(bytes).getUint32(0,true)!==0x46546c67)throw Error('Response is not a GLB model (possibly a preview, login or confirmation page).');
  return bytes;
}
async function display(bytes){
  const gltf=await new GLTFLoader().parseAsync(bytes,'');
  const next=gltf.scene, nextMeshes=[];
  next.traverse(o=>{if(o.isMesh){let n=o,id;while(n&&!id){id=n.userData.cad_part_id;n=n.parent;}o.userData.partId=id;nextMeshes.push(o);}});
  const ids=new Set(nextMeshes.map(m=>m.userData.partId));
  if(ids.size!==60||ids.has(undefined))throw Error(`Expected 60 CAD component IDs; received ${ids.size}.`);
  if(root){scene.remove(root);root.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
  root=next;meshes=nextMeshes;originals.clear();for(const m of meshes)originals.set(m,m.material);
  scene.add(root);fit(root);
  $('parts').replaceChildren(new Option('Whole assembly',''));
  for(const id of ids)$('parts').add(new Option(catalogue.get(id)?.display_name||id,id));
  $('parts').disabled=false;$('reset').disabled=false;choose('');
  return ids.size;
}
async function load(){
  if(busy)return;busy=true;$('load').disabled=true;$('log').textContent='';
  try{
    say('Testing anonymous model loading from Google Drive…');
    const candidates=driveCandidates($('drive').value.trim());
    for(const url of candidates){
      log('Trying '+url);
      try{const bytes=await fetchGLB(url);const count=await display(bytes);say(`Drive loading passed · ${count} components · ${(bytes.byteLength/1048576).toFixed(1)} MB. Rotate, zoom or select a component.`);return;}
      catch(e){log(e.name+': '+e.message);}
    }
    say('Drive loading did not pass. The shared file could not be read as an interactive model. Open delivery test details for the results.');
  }catch(e){say(e.message);}finally{busy=false;$('load').disabled=false;}
}
$('load').onclick=load;
try{
  const [registry,config]=await Promise.all([fetch('./components.json').then(r=>r.json()),fetch('./config.json').then(r=>r.json())]);
  catalogue=new Map(registry.parts.map(p=>[p.cad_stable_id,p]));
  $('drive').value=config.drive_share_url||'';$('load').disabled=false;
  // Local-only control verifies the exported GLB and viewer before Drive delivery is available.
  const localControl=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('control')==='local';
  if(localControl){const bytes=await fetchGLB('./control.glb');await display(bytes);say('LOCAL CONTROL passed · 60 components. This does not verify Google Drive delivery.');}
  else if(config.drive_share_url)await load();
  else say('Viewer ready. Awaiting the shared Drive model link; Drive delivery has not been tested.');
}catch(e){say('Viewer setup failed: '+e.message);log(e.stack);}
