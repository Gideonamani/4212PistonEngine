import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {createTransfer} from './transfer.mjs';
import {mechanismPose} from './kinematics.mjs';
import {valveMatrices} from './valve-transforms.mjs';

const $ = id => document.getElementById(id);
const say = text => $('status').textContent = text;
const log = text => $('log').textContent += text + '\n';
const music=$('music');
music.volume=.3;
$('music-toggle').onclick=async()=>{
  if(!music.paused){music.pause();return;}
  $('music-toggle').disabled=true;
  try{if(!music.getAttribute('src'))music.src='./audio/quiet-workshop.mp3';await music.play();}
  catch{$('music-status').textContent='Music could not start. Press Play music to retry.';music.removeAttribute('src');music.load();}
  finally{$('music-toggle').disabled=false;}
};
$('music-volume').oninput=()=>{music.volume=Number($('music-volume').value)/100;};
music.addEventListener('playing',()=>{$('music-status').textContent='Playing Quiet Workshop.';$('music-toggle').textContent='Pause music';$('music-toggle').setAttribute('aria-pressed','true');});
music.addEventListener('pause',()=>{$('music-status').textContent='Music paused.';$('music-toggle').textContent='Play music';$('music-toggle').setAttribute('aria-pressed','false');});
music.addEventListener('waiting',()=>{$('music-status').textContent='Loading music…';});
music.addEventListener('error',()=>{$('music-status').textContent='Music could not load. The model viewer is still available; reload the page to retry music.';});
const explorer=$('explorer');
function syncFullscreen(){
  const active=document.fullscreenElement===explorer||explorer.classList.contains('expanded');
  $('fullscreen').textContent=active?'↙ Normal view':'⛶ Full screen';
  $('fullscreen').setAttribute('aria-pressed',String(active));
  $('fullscreen').title=active?'Return to normal view (Esc)':'Expand viewer';
  document.body.classList.toggle('viewer-expanded',active);
}
$('fullscreen').onclick=async()=>{
  try{
    if(document.fullscreenElement===explorer)await document.exitFullscreen();
    else if(explorer.classList.contains('expanded'))explorer.classList.remove('expanded');
    else if(document.fullscreenEnabled&&explorer.requestFullscreen){
      try{await explorer.requestFullscreen();}catch{explorer.classList.add('expanded');}
    }else explorer.classList.add('expanded');
  }finally{syncFullscreen();}
};
document.addEventListener('fullscreenchange',syncFullscreen);
document.addEventListener('keydown',async e=>{
  if(e.key!=='Escape')return;
  if(document.fullscreenElement===explorer)await document.exitFullscreen().catch(()=>{});
  if(explorer.classList.contains('expanded'))explorer.classList.remove('expanded');
  syncFullscreen();
});
$('toggle-controls').onclick=()=>{
  const hidden=explorer.classList.toggle('controls-hidden');
  $('toggle-controls').textContent=hidden?'Show controls':'Hide controls';
  $('toggle-controls').setAttribute('aria-expanded',String(!hidden));
};
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
  renderer.setSize(width,height,false); camera.aspect=width/height;camera.updateProjectionMatrix();renderer.render(scene,camera);
});resize.observe($('view'));
controls.addEventListener('change',()=>renderer.render(scene,camera));
let root, meshes=[], selected='', catalogue=new Map(), busy=false, apiKey='';
const ray = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const originals = new Map();
const inspection = new Map();
const sections=[];
let motionProfile=null,motionEntries=[],motionAngle=36,playing=false,animationFrame=0,lastFrame=0;
function stopMotion(){playing=false;cancelAnimationFrame(animationFrame);$('motion-play').textContent='Play mechanism';$('motion-play').setAttribute('aria-pressed','false');}
function groupMatrices(degrees){
  const p=mechanismPose(degrees,motionProfile.radius_m,motionProfile.rod_length_m);
  return {Piston:new THREE.Matrix4().makeTranslation(...p.piston),
    ConnectingRod:new THREE.Matrix4().makeRotationZ(p.rodAngle).setPosition(...p.rod),
    Crank:new THREE.Matrix4().makeRotationZ(p.crankAngle),Cylinder:new THREE.Matrix4()};
}
function setMotion(degrees){
  if(!motionProfile)return;
  motionAngle=degrees;
  const transforms=groupMatrices(degrees);
  const valves=motionProfile.valves?valveMatrices(degrees,motionProfile.valves):null;
  for(const {mesh,group,localBind} of motionEntries){
    const world=transforms[group].clone().multiply(localBind);
    const delta=valves?.matrices[mesh.userData.partId];
    if(delta)world.premultiply(delta);
    mesh.matrix.copy(mesh.parent.matrixWorld).invert().multiply(world);
  }
  root.updateMatrixWorld(true);
  for(const {group,source,cap} of sections)for(const child of group.children)if(child!==cap)child.matrix.copy(source.matrixWorld);
  $('motion-angle').value=String(degrees);$('motion-value').textContent=`${degrees.toFixed(0)}°`;
  $('motion-note').textContent=`Piston pin: ${(mechanismPose(degrees,motionProfile.radius_m,motionProfile.rod_length_m).piston[0]*1000).toFixed(1)} mm from crank axis. CAD kinematics; teaching speed.`;
  if(valves)$('motion-note').textContent+=` ${valves.cycle.stroke} · intake lift ${valves.cycle.intakeLift.toFixed(1)} mm · exhaust lift ${valves.cycle.exhaustLift.toFixed(1)} mm.`;
  updateSection();
}
async function setupMotion(bytes){
  stopMotion();motionProfile=null;motionEntries=[];$('motion-controls').disabled=true;
  try{
    const response=await fetch('./motion.json');if(!response.ok)throw Error('Motion profile unavailable');
    const profile=await response.json();
    const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
    if(digest!==profile.asset_sha256)throw Error('This model version needs a verified motion profile');
    if(meshes.some(m=>!['Piston','ConnectingRod','Crank','Cylinder'].includes(profile.groups[m.userData.partId])))throw Error('Motion group is missing');
    if(profile.valves&&profile.bind_angle_deg!==0)throw Error('Valve preview requires the closed zero-degree CAD bind pose');
    motionProfile=profile;root.updateMatrixWorld(true);
    const bind=groupMatrices(profile.bind_angle_deg);
    motionEntries=meshes.map(mesh=>{
      const group=profile.groups[mesh.userData.partId];mesh.matrixAutoUpdate=false;
      return {mesh,group,localBind:bind[group].clone().invert().multiply(mesh.matrixWorld)};
    });
    $('motion-controls').disabled=false;setMotion(profile.bind_angle_deg);
    if(profile.valves)$('motion-scope').textContent='Engineering preview: piston, rod, crank, valves, rockers and pushrods move together. Spring compression and gas cues are not connected yet. Lift and timing are illustrative, not manufacturer specifications.';
  }catch(e){motionProfile=null;$('motion-note').textContent=e.message+'. Static inspection remains available.';log(e.message);}
}
function animateMechanism(time){
  if(!playing)return;
  const elapsed=Math.min((time-lastFrame)/1000,.1);lastFrame=time;
  setMotion((motionAngle+elapsed*Number($('motion-speed').value))%720);
  animationFrame=requestAnimationFrame(animateMechanism);
}
$('motion-play').onclick=()=>{
  if(playing){stopMotion();return;}if(!motionProfile)return;
  playing=true;lastFrame=performance.now();$('motion-play').textContent='Pause mechanism';$('motion-play').setAttribute('aria-pressed','true');animationFrame=requestAnimationFrame(animateMechanism);
};
$('motion-angle').oninput=()=>{stopMotion();setMotion(Number($('motion-angle').value));};
$('motion-reset').onclick=()=>{stopMotion();setMotion(motionProfile.bind_angle_deg);};
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopMotion();});
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
    return (!$('group').value||partGroup(id)===$('group').value)&&`${p?.display_name||id} ${p?.function||''}`.toLowerCase().includes(query);
  }).sort((a,b)=>(catalogue.get(a)?.display_name||a).localeCompare(catalogue.get(b)?.display_name||b));
  $('parts').replaceChildren(new Option('Whole assembly',''));
  for(const id of matches)$('parts').add(new Option(catalogue.get(id)?.display_name||id,id));
  $('parts').value=selected;
  $('matches').textContent=query||$('group').value?`${matches.length} of ${ids.length} components match`:`${ids.length} components available`;
}
function partGroup(id){
  if(id.startsWith('Intake'))return 'intake';
  if(id.startsWith('Exhaust'))return 'exhaust';
  if(/Spark/.test(id))return 'ignition';
  if(/^(Piston|FloatingPin|PinPlug)/.test(id))return 'piston';
  if(/^Cylinder/.test(id))return 'structure';
  return 'crank';
}
$('search').oninput=()=>{choose('');populateParts();};
$('group').onchange=()=>{choose('');populateParts();};
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
  if(id&&![...$('parts').options].some(o=>o.value===id)){$('search').value='';$('group').value='';populateParts();}
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
  stopMotion();
  isolated=true;applyAppearance();
  const picked=meshes.find(m=>m.userData.partId===selected);if(picked)fit(picked);
};
$('reset').onclick=()=>{stopMotion();if(motionProfile)setMotion(motionProfile.bind_angle_deg);resetSection();$('search').value='';$('group').value='';choose('');populateParts();if(root)fit(root);};
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
  const started=performance.now();
  const transfer=createTransfer();activeTransfer=transfer;
  let reader,received=0;
  $('cancel-load').hidden=false;
  try{
  $('load-progress').hidden=false;$('load-progress').removeAttribute('value');
  const response=await fetch(url,{headers,mode:'cors',credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin',signal:transfer.signal});
  transfer.touch();
  log(`HTTP ${response.status}; type ${response.headers.get('content-type')}; URL ${response.url}`);
  if(!response.ok){
    const error=await response.json().catch(()=>null);
    throw Error(`HTTP ${response.status}: ${error?.error?.message||response.statusText}`);
  }
  let bytes;
  if(response.body){
    reader=response.body.getReader();const chunks=[];
    let total=Number(response.headers.get('content-length'))||0;
    // Drive media responses do not always expose Content-Length cross-origin.
    // Ask for the current file size rather than assume the previous export's size.
    if(!total&&url.startsWith('https://www.googleapis.com/drive/v3/files/')){
      try{
        const metadataURL=new URL(url);metadataURL.searchParams.delete('alt');metadataURL.searchParams.set('fields','size');
        const metadata=await fetch(metadataURL,{headers,mode:'cors',credentials:'omit',referrerPolicy:'strict-origin-when-cross-origin',signal:AbortSignal.any([transfer.signal,AbortSignal.timeout(10000)])});
        if(metadata.ok){const info=await metadata.json();total=Number(info.size)||0;}
      }catch{log('File size unavailable; showing received bytes until download completes.');}
    }
    let lastUpdate=0;
    for(;;){
      const {done,value}=await reader.read();if(done)break;
      chunks.push(value);received+=value.byteLength;
      transfer.touch();
      if(total&&received>total){total=0;log('File size changed during loading; percentage unavailable.');}
      if(performance.now()-lastUpdate>350){
        const percent=total?Math.min(99,Math.floor(received/total*100)):null;
        if(percent===null)$('load-progress').removeAttribute('value');else $('load-progress').value=percent;
        say(`Downloading model: ${percent===null?'':percent+'% · '}${(received/1048576).toFixed(1)}${total?' / '+(total/1048576).toFixed(1):''} MB${total?'':' · total size unavailable'}…`);
        lastUpdate=performance.now();
      }
    }
    const joined=new Uint8Array(received);let offset=0;
    for(const chunk of chunks){joined.set(chunk,offset);offset+=chunk.byteLength;}
    bytes=joined.buffer;
  }else bytes=await response.arrayBuffer();
  if(bytes.byteLength<20||new DataView(bytes).getUint32(0,true)!==0x46546c67)throw Error('Response is not a GLB model (possibly a preview, login or confirmation page).');
  if(new DataView(bytes).getUint32(8,true)!==bytes.byteLength){const error=Error('Download ended before the complete GLB arrived.');error.retryable=true;throw error;}
  $('load-progress').value=100;
  log(`Download: ${((performance.now()-started)/1000).toFixed(2)} s; ${bytes.byteLength} bytes (includes size lookup when needed).`);
  return bytes;
  }catch(error){
    log(`Transfer stopped after ${(received/1048576).toFixed(1)} MB and ${((performance.now()-started)/1000).toFixed(1)} s.`);
    if(reader)await reader.cancel().catch(()=>{});
    if(transfer.reason==='cancelled'){const cancelled=Error('Download cancelled. Use Reload model to start again.');cancelled.cancelled=true;throw cancelled;}
    if(transfer.reason==='stalled'){const stalled=Error('No download progress for two minutes.');stalled.retryable=true;throw stalled;}
    error.retryable=error.retryable||error.name==='AbortError'||error.name==='TimeoutError'||error instanceof TypeError;
    throw error;
  }finally{transfer.finish();if(activeTransfer===transfer)activeTransfer=null;$('cancel-load').hidden=true;}
}
let activeTransfer=null;
$('cancel-load').onclick=()=>activeTransfer?.cancel();
async function display(bytes){
  const started=performance.now();
  say('Download 100% complete · Preparing the 60-component assembly…');
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
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
  $('search').value='';$('group').value='';$('group').disabled=false;selected='';populateParts();
  $('search').disabled=false;$('parts').disabled=false;$('reset').disabled=false;choose('');
  await setupMotion(bytes);
  log(`Preparation and first render: ${((performance.now()-started)/1000).toFixed(2)} s; viewport ${renderer.domElement.clientWidth} × ${renderer.domElement.clientHeight}; pixel ratio ${renderer.getPixelRatio()}.`);
  $('load-progress').hidden=true;
  return ids.size;
}
async function load(){
  stopMotion();
  if(busy)return;busy=true;$('load').disabled=true;$('log').textContent='';
  try{
    say('Loading the cylinder assembly through Google Drive API…');
    const candidates=driveCandidates($('drive').value.trim());
    for(const {url,headers} of candidates){
      log('Trying '+url);
      try{let bytes;
        for(let attempt=0;attempt<2;attempt++){
          try{bytes=await fetchGLB(url,headers);break;}
          catch(e){if(e.cancelled){say(e.message);return;}if(!e.retryable||attempt===1)throw e;log('Transient interruption: retrying once from the beginning.');say('Download interrupted · retrying once from the beginning…');}
        }
        const count=await display(bytes);say(`Drive API loaded · ${count} components · ${(bytes.byteLength/1048576).toFixed(1)} MB. Rotate, zoom or select a component.`);return;}
      catch(e){log(e.name+': '+e.message);}
    }
    say('Could not load the model. Open Loading details for the error, then use Reload model to retry.');
  }catch(e){say(e.message);}finally{busy=false;$('load').disabled=false;$('load-progress').hidden=true;}
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
}catch(e){$('load-progress').hidden=true;say('Viewer setup failed: '+e.message);log(e.stack);}
