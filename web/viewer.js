import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';

const $ = id => document.getElementById(id);
const say = text => $('status').textContent = text;
const log = text => $('log').textContent += text + '\n';
const scene = new THREE.Scene();
scene.background = new THREE.Color('#101923');
const camera = new THREE.PerspectiveCamera(40, 1, .001, 100);
const renderer = new THREE.WebGLRenderer({antialias:true,stencil:true});
renderer.localClippingEnabled=true;
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1;
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
let root, meshes=[], selected='', catalogue=new Map(), busy=false, apiKey='';
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const originals = new Map();
const inspection = new Map();
const sections=[];
let isolated=false;
function inspectionMaterial(id){
  let color=0x9cabb8;
  if(/Intake/i.test(id))color=0x379e9b;
  else if(/Exhaust/i.test(id))color=0xbc7353;
  else if(/Seal|Gasket/i.test(id))color=0x364451;
  else if(/Ring|Bolt|Nut|Crank/i.test(id))color=0x596d80;
  else if(/Insulator/i.test(id))color=0xe2dbca;
  else if(/Piston|Pin/i.test(id))color=0xc2ced6;
  return new THREE.MeshStandardMaterial({color,metalness:.25,roughness:.48});
}
function applyAppearance(){
  for(const m of meshes)m.material=m.userData.partId===selected?highlight:isolated?ghost:$('appearance').value==='cad'?originals.get(m):inspection.get(m);
  updateSection();
}
$('appearance').onchange=applyAppearance;
const sectionPlane = new THREE.Plane(), modelBounds = new THREE.Box3();
// Each mesh gets its own stencil pass, so adjoining parts keep separate cut faces.
function buildSections(){
  for(const entry of sections){scene.remove(entry.group);for(const child of entry.group.children){child.material.dispose();if(child===entry.cap)child.geometry.dispose();}}
  sections.length=0;
  root.updateMatrixWorld(true);
  const span=modelBounds.getSize(new THREE.Vector3()).length()*2;
  meshes.forEach((source,index)=>{
    const group=new THREE.Group();
    for(const [side,op] of [[THREE.BackSide,THREE.IncrementWrapStencilOp],[THREE.FrontSide,THREE.DecrementWrapStencilOp]]){
      const material=new THREE.MeshBasicMaterial({side,depthWrite:false,depthTest:false,colorWrite:false,stencilWrite:true,stencilFunc:THREE.AlwaysStencilFunc,stencilFail:op,stencilZFail:op,stencilZPass:op,clippingPlanes:[sectionPlane]});
      const mask=new THREE.Mesh(source.geometry,material);mask.matrixAutoUpdate=false;mask.matrix.copy(source.matrixWorld);mask.renderOrder=index*3;group.add(mask);
    }
    const material=new THREE.MeshStandardMaterial({color:0x9cabb8,roughness:.65,metalness:.1,side:THREE.DoubleSide,stencilWrite:true,stencilRef:0,stencilFunc:THREE.NotEqualStencilFunc,stencilFail:THREE.ReplaceStencilOp,stencilZFail:THREE.ReplaceStencilOp,stencilZPass:THREE.ReplaceStencilOp});
    const cap=new THREE.Mesh(new THREE.PlaneGeometry(span,span),material);cap.renderOrder=index*3+1;cap.onAfterRender=()=>renderer.clearStencil();group.add(cap);scene.add(group);
    source.renderOrder=meshes.length*3+1;
    sections.push({group,cap,source});
  });
}
let sectionFlipped=true;
function updateSection(){
  const axis=$('section-axis').value, fraction=Number($('section-position').value)/100;
  $('section-value').textContent=`${Math.round(fraction*100)}%`;
  $('section-flip').setAttribute('aria-pressed',String(sectionFlipped));
  if(root){
    const position=THREE.MathUtils.lerp(modelBounds.min[axis],modelBounds.max[axis],fraction);
    const normal=new THREE.Vector3();normal[axis]=sectionFlipped?-1:1;
    const point=new THREE.Vector3();point[axis]=position;
    sectionPlane.setFromNormalAndCoplanarPoint(normal,point);
  }
  const enabled=$('section-enabled').checked&&!!root;
  for(const material of new Set([...originals.values()].flat().concat([...inspection.values()],highlight,ghost))){
    const planes=enabled?[sectionPlane]:[];
    if((material.clippingPlanes?.length||0)!==planes.length){material.clippingPlanes=planes;material.needsUpdate=true;}
  }
  for(const {group,cap,source} of sections){
    group.visible=enabled&&source.material!==ghost;
    sectionPlane.coplanarPoint(cap.position);
    cap.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),sectionPlane.normal.clone().negate());
    const material=Array.isArray(source.material)?source.material[0]:source.material;
    cap.material.color.copy(material.color||new THREE.Color(0x9cabb8));
  }
  renderer.render(scene,camera);
}
function resetSection(){
  $('section-enabled').checked=false;$('section-axis').value='z';$('section-position').value='50';sectionFlipped=true;updateSection();
}
$('section-enabled').onchange=updateSection;
$('section-axis').onchange=updateSection;
$('section-position').oninput=updateSection;
$('section-flip').onclick=()=>{sectionFlipped=!sectionFlipped;updateSection();};
function populateParts(){
  const query=$('search').value.trim().toLowerCase();
  const ids=[...new Set(meshes.map(m=>m.userData.partId))];
  const matches=ids.filter(id=>{
    const p=catalogue.get(id);
    return `${p?.display_name||id} ${p?.function||''}`.toLowerCase().includes(query);
  }).sort((a,b)=>(catalogue.get(a)?.display_name||a).localeCompare(catalogue.get(b)?.display_name||b));
  $('parts').replaceChildren(new Option('Whole assembly',''));
  for(const id of matches)$('parts').add(new Option(catalogue.get(id)?.display_name||id,id));
  $('parts').value=selected;
  $('matches').textContent=query?`${matches.length} of ${ids.length} components match`:`${ids.length} components available`;
}
$('search').oninput=()=>{choose('');populateParts();};
function fit(object) {
  const box=new THREE.Box3().setFromObject(object), center=box.getCenter(new THREE.Vector3());
  const size=box.getSize(new THREE.Vector3()).length();
  const distance=size/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*Math.max(1,1/camera.aspect);
  camera.position.copy(center).add(new THREE.Vector3(1,.65,1).normalize().multiplyScalar(distance*1.3));
  controls.target.copy(center);controls.update();
}
const highlight = new THREE.MeshStandardMaterial({color:0xf1b852,metalness:.5,roughness:.35});
const ghost = new THREE.MeshStandardMaterial({color:0x9cbdcf,transparent:true,opacity:.12,depthWrite:false});
function choose(id){
  if(id&&![...$('parts').options].some(o=>o.value===id)){$('search').value='';populateParts();}
  isolated=false;selected=id;$('parts').value=id;
  const part=catalogue.get(id);
  $('part-name').textContent=part?.display_name || 'Cylinder study';
  $('part-function').textContent=part?.function || 'Drag to rotate the assembly. Choose a component to inspect it.';
  $('part-source').textContent=part?`Catalogue reference: ${part.function_source_summary||'Not yet recorded'}. Source attribution is awaiting detailed review.`:'Choose a component to see its catalogue reference.';
  $('part-evidence').textContent=part?`Geometry: ${part.geometry_evidence_status||'Not yet reviewed'}. Claim review: ${part.structured_claim_review||'pending'}.`:'This study combines documented dimensions and reconstructed geometry. The detailed evidence audit is pending.';
  $('isolate').disabled=!id;
  applyAppearance();
}
$('parts').onchange=()=>choose($('parts').value);
$('isolate').onclick=()=>{
  isolated=true;applyAppearance();
  const picked=meshes.find(m=>m.userData.partId===selected);if(picked)fit(picked);
};
$('reset').onclick=()=>{resetSection();$('search').value='';choose('');populateParts();if(root)fit(root);};
let down;
renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointerup',e=>{
  if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;
  const r=renderer.domElement.getBoundingClientRect();
  pointer.set((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1);
  ray.setFromCamera(pointer,camera);
  const hit=ray.intersectObjects(meshes).find(h=>h.object.material!==ghost&&(!$('section-enabled').checked||sectionPlane.distanceToPoint(h.point)>=0));
  if(hit)choose(hit.object.userData.partId);
});
function driveCandidates(link){
  const url=new URL(link);
  if(url.protocol!=='https:'||url.hostname!=='drive.google.com')throw Error('Use a Google Drive HTTPS sharing link.');
  const id=url.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || url.searchParams.get('id');
  if(!id||!/^[-\w]+$/.test(id))throw Error('The link does not contain a valid Drive file ID.');
  if(!apiKey)throw Error('The Drive API browser key has not been configured.');
  const headers={'X-Goog-Api-Key':apiKey};
  if(url.searchParams.has('resourcekey'))headers['X-Goog-Drive-Resource-Keys']=`${id}/${url.searchParams.get('resourcekey')}`;
  return [{url:`https://www.googleapis.com/drive/v3/files/${id}?alt=media`,headers}];
}
async function fetchGLB(url,headers={}){
  const response=await fetch(url,{headers,mode:'cors',credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin',signal:AbortSignal.timeout(120000)});
  log(`HTTP ${response.status}; type ${response.headers.get('content-type')}; URL ${response.url}`);
  if(!response.ok){
    const error=await response.json().catch(()=>null);
    throw Error(`HTTP ${response.status}: ${error?.error?.message||response.statusText}`);
  }
  let bytes;
  if(response.body){
    const reader=response.body.getReader(), chunks=[];
    const total=Number(response.headers.get('content-length'))||0;
    let received=0,lastUpdate=0;
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      chunks.push(value);received+=value.byteLength;
      if(performance.now()-lastUpdate>350){
        say(`Loading model: ${(received/1048576).toFixed(1)}${total?' / '+(total/1048576).toFixed(1):''} MB…`);
        lastUpdate=performance.now();
      }
    }
    const joined=new Uint8Array(received);let offset=0;
    for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
    bytes=joined.buffer;
  }else bytes=await response.arrayBuffer();
  if(bytes.byteLength<20||new DataView(bytes).getUint32(0,true)!==0x46546c67)throw Error('Response is not a GLB model (possibly a preview, login or confirmation page).');
  return bytes;
}
async function display(bytes){
  say('Preparing the 60-component assembly…');
  const gltf=await new GLTFLoader().parseAsync(bytes,'');
  const next=gltf.scene, nextMeshes=[];
  next.traverse(o=>{if(o.isMesh){let n=o,id;while(n&&!id){id=n.userData.cad_part_id;n=n.parent;}o.userData.partId=id;nextMeshes.push(o);}});
  const ids=new Set(nextMeshes.map(m=>m.userData.partId));
  if(ids.size!==60||ids.has(undefined))throw Error(`Expected 60 CAD component IDs; received ${ids.size}.`);
  if(root){scene.remove(root);root.traverse(o=>{if(o.geometry)o.geometry.dispose();});}
  for(const material of inspection.values())material.dispose();inspection.clear();
  for(const material of new Set([...originals.values()].flat()))material.dispose();
  root=next;meshes=nextMeshes;originals.clear();for(const m of meshes){originals.set(m,m.material);inspection.set(m,inspectionMaterial(m.userData.partId));}
  scene.add(root);modelBounds.setFromObject(root);buildSections();resetSection();fit(root);
  $('section-controls').disabled=false;
  $('appearance').disabled=false;
  $('search').value='';selected='';populateParts();
  $('search').disabled=false;$('parts').disabled=false;$('reset').disabled=false;choose('');
  return ids.size;
}
async function load(){
  if(busy)return;busy=true;$('load').disabled=true;$('log').textContent='';
  try{
    say('Loading the cylinder assembly through Google Drive API…');
    const candidates=driveCandidates($('drive').value.trim());
    for(const {url,headers} of candidates){
      log('Trying '+url);
      try{const bytes=await fetchGLB(url,headers);const count=await display(bytes);say(`Drive API loaded · ${count} components · ${(bytes.byteLength/1048576).toFixed(1)} MB. Rotate, zoom or select a component.`);return;}
      catch(e){log(e.name+': '+e.message);}
    }
    say('Could not load the model. Open Loading details for the error, then use Reload model to retry.');
  }catch(e){say(e.message);}finally{busy=false;$('load').disabled=false;}
}
$('load').onclick=load;
try{
  const [registry,config]=await Promise.all([fetch('./components.json').then(r=>r.json()),fetch('./config.json').then(r=>r.json())]);
  catalogue=new Map(registry.parts.map(p=>[p.cad_stable_id,p]));
  apiKey=config.drive_api_key||'';
  $('drive').value=config.drive_share_url||'';$('load').disabled=false;
  // Local-only control verifies the exported GLB and viewer before Drive delivery is available.
  const localControl=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).get('control')==='local';
  if(localControl){const bytes=await fetchGLB('./control.glb');await display(bytes);say('LOCAL CONTROL passed · 60 components. This does not verify Google Drive delivery.');}
  else if(config.drive_share_url)await load();
  else say('Viewer ready. Awaiting the shared Drive model link; Drive delivery has not been tested.');
}catch(e){say('Viewer setup failed: '+e.message);log(e.stack);}
