// Local development check against the actual loaded meshes and rendered stencil masks.
import {cycleCueState} from './cycle-cues.mjs';
export async function verifyCyclePreview({THREE,meshes,sections,profile,setMotion,stopMotion,renderer,scene,camera}){
 const $=id=>document.getElementById(id);let checks=0;
 const check=(value,message)=>{checks++;if(!value)throw Error(message);};
 check(profile?.cycle_landmarks&&profile?.valves?.spring_targets,'Complete cycle profile required');
 const springs=meshes.filter(m=>profile.valves.spring_targets[m.userData.partId]);
 check(springs.length===4,'Expected four spring morphs');
 const cues=scene.getObjectByName('Illustrative cycle cues');
 const particleMeshes=cues.children.filter(m=>m.isPoints);
 check(particleMeshes.length===3,'Expected chamber and two port streams');
 for(const mesh of particleMeshes){
  check(mesh.material.depthTest&&mesh.material.sizeAttenuation,'Particles must respect solid depth and world size');
  check(mesh.material.map?.image.data[3]===0,'Sprite corners must be transparent');
 }
 const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
 const snapshot=()=>meshes.flatMap(m=>[...m.matrix.elements,...(m.morphTargetInfluences||[])]);
 stopMotion();$('cycle-enabled').checked=true;$('cycle-enabled').dispatchEvent(new Event('change'));
 try{
  for(const axis of ['x','y','z'])for(const flip of [false,true]){
   $('section-axis').value=axis;$('section-enabled').checked=true;
   if(($('section-flip').getAttribute('aria-pressed')==='true')!==flip)$('section-flip').click();
   $('section-enabled').dispatchEvent(new Event('change'));
   for(const angle of [0,90,180,270,360,450,540,630,719.99,720]){
    $('motion-angle').value=String(angle);$('motion-angle').dispatchEvent(new Event('input'));
    // Range step rounds fractional input; exact near-boundary poses are also checked below.
    setMotion(angle);scene.updateMatrixWorld(true);
    const cycle=cycleCueState(angle);
    const piston=meshes.find(m=>m.userData.partId==='PistonBody');
    piston.geometry.computeBoundingBox();
    const crown=piston.geometry.boundingBox.clone().applyMatrix4(piston.matrixWorld).max.x;
    for(const particles of particleMeshes){
     if(!particles.visible)continue;
     const positions=particles.geometry.attributes.position;
     for(let i=0;i<positions.count;i++)check(positions.getX(i)-.0009>crown,'Particle sprite crosses actual piston crown');
    }
    check($('motion-play').getAttribute('aria-pressed')==='false','Scrubbing must pause');
    check($('cycle-description').textContent===cycle.description,'Stale cycle description');
    for(const source of springs){
     const entry=sections.find(s=>s.source===source),target=profile.valves.spring_targets[source.userData.partId];
     const expected=cycle[target.train+'Lift']/target.maximum_lift_mm;
     check(Math.abs(source.morphTargetInfluences[source.morphTargetDictionary[target.target]]-expected)<1e-12,'Spring lift mismatch');
     for(const mask of entry.group.children.filter(m=>m!==entry.cap)){
      check(mask.morphTargetInfluences===source.morphTargetInfluences,'Stencil morph detached');
      check(mask.matrixWorld.equals(source.matrixWorld),'Stencil transform stale');
      for(const index of [0,Math.floor(source.geometry.attributes.position.count/2),source.geometry.attributes.position.count-1]){
       const a=source.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(source.matrixWorld);
       const b=mask.getVertexPosition(index,new THREE.Vector3()).applyMatrix4(mask.matrixWorld);
       check(a.distanceTo(b)<1e-10,'Deformed mask vertex differs from spring');
      }
     }
    }
    renderer.render(scene,camera);check(renderer.getContext().getError()===0,'WebGL error');
   }
  }
  setMotion(0);const zero=snapshot();setMotion(720);const end=snapshot();
  check(zero.every((v,i)=>Math.abs(v-end[i])<1e-10),'Mechanism jumps at loop closure');
  setMotion(90);const cloud=scene.getObjectByName('Moving chamber charge');
  const cloudBefore=Array.from(cloud.geometry.attributes.position.array);
  setMotion(91);check(cloudBefore.some((v,i)=>v!==cloud.geometry.attributes.position.array[i]),'Charge particles remain static');
  setMotion(719.99);$('motion-play').click();
  for(let i=0;i<8;i++)await frame();
  $('motion-play').click();
  const paused=snapshot();await frame();await frame();
  check(paused.every((v,i)=>v===snapshot()[i]),'Paused pose continues moving');
  check(Number($('motion-angle').value)<180,'Playback failed to cross cycle boundary');
  return `PASS: ${checks} cycle/particle/spring/section checks; particle crown clearance, round depth-tested sprites, four springs, three cut axes, both cut sides, ten poses, loop closure and play/pause. Desktop preview only.`;
 }finally{stopMotion();$('section-enabled').checked=false;setMotion(90);}
}
