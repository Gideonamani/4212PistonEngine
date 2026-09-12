import * as THREE from 'three';
import {cycleCueState} from './cycle-cues.mjs';
import {chamberParticle,portPath,pathParticle,streamFraction,particleRadiusMm} from './cycle-particles.mjs';
const point=a=>new THREE.Vector3(a[0],a[2],-a[1]).multiplyScalar(.001);
export function createCycleVisuals(scene,landmarks,camera){
 const group=new THREE.Group();group.name='Illustrative cycle cues';scene.add(group);
 // Soft circular sprites in world units: zooming cannot enlarge them across the crown.
 const size=32,pixels=new Uint8Array(size*size*4);
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),offset=(y*size+x)*4;
  pixels.set([255,255,255,Math.round(255*Math.max(0,Math.min(1,(1-r)*5)))],offset);
 }
 const texture=new THREE.DataTexture(pixels,size,size,THREE.RGBAFormat);texture.needsUpdate=true;
 texture.magFilter=texture.minFilter=THREE.LinearFilter;
 function particles(count,colour,name){
  const positions=new Float32Array(count*3),geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  // PointsMaterial attenuation omits the perspective field-of-view scale.
  const material=new THREE.PointsMaterial({color:colour,size:particleRadiusMm*2/1000/Math.tan(THREE.MathUtils.degToRad(camera.fov/2)),sizeAttenuation:true,
   map:texture,transparent:true,opacity:.85,alphaTest:.05,depthWrite:false,depthTest:true});
  const mesh=new THREE.Points(geometry,material);mesh.name=name;mesh.frustumCulled=false;mesh.renderOrder=999;
  group.add(mesh);return {mesh,positions,geometry,material,count};
 }
 const cloud=particles(180,0x43d9e4,'Moving chamber charge');
 const streams={intake:particles(72,0x43d9e4,'Intake port stream'),exhaust:particles(72,0xb7b3bd,'Exhaust port stream')};
 group.visible=false;
 return {
  setVisible(value){group.visible=value;},
  update(degrees,pistonPinMm){
   const state=cycleCueState(degrees);
   for(let i=0;i<cloud.count;i++)point(chamberParticle(i,cloud.count,degrees,pistonPinMm,landmarks.chamber)).toArray(cloud.positions,i*3);
   cloud.geometry.attributes.position.needsUpdate=true;cloud.material.color.setHex(state.colour);
   cloud.material.opacity=.7+.25*state.reactionGlow;
   for(const name of ['intake','exhaust']){
    const stream=streams[name],lift=state[name+'Lift'];stream.mesh.visible=state[name+'Visible'];
    if(!stream.mesh.visible)continue;
    const path=portPath(name,lift,pistonPinMm,landmarks);
    for(let i=0;i<stream.count;i++)point(pathParticle(path,streamFraction(i,stream.count,degrees))).toArray(stream.positions,i*3);
    stream.geometry.attributes.position.needsUpdate=true;
    stream.material.opacity=.9*Math.min(1,lift/1.5);
   }
   return state;
  },
  dispose(){scene.remove(group);group.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});texture.dispose();}
 };
}
