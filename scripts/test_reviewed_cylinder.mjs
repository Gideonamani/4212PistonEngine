import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {valveMatrices} from '../src/viewer/engineering/valve-transforms.mjs';
import {valveTrainPose} from '../src/viewer/engineering/valve-kinematics.mjs';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
const release=read('releases/cylinder-reviewed-20261001.json'),profile=read('web/motion.json');
const springReference=read('data/spring-motion.json');
const packed=fs.readFileSync(new URL('../'+release.transport_file,import.meta.url)),raw=gunzipSync(packed);
const hash=b=>createHash('sha256').update(b).digest('hex');

test('the published GLB contains every reviewed component and its CAD bind bounds',async()=>{
 assert.equal(hash(raw),release.asset_sha256);assert.equal(hash(packed),release.transport_sha256);
 assert.equal(profile.asset_sha256,release.asset_sha256);
 const gltf=await new GLTFLoader().parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
 gltf.scene.updateMatrixWorld(true);const ids=[];let maximum=0;
 gltf.scene.traverse(mesh=>{
  if(!mesh.isMesh)return;
  const id=mesh.userData.cad_part_id;assert.ok(id);ids.push(id);
  const bounds=new THREE.Box3().makeEmpty(),v=new THREE.Vector3(),positions=mesh.geometry.attributes.position;
  for(let i=0;i<positions.count;i++)bounds.expandByPoint(v.fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld));
  const actual=[...bounds.min.toArray(),...bounds.max.toArray()],expected=release.cad_bind_bounds_gltf_m[id];assert.ok(expected);
  for(let i=0;i<6;i++){const error=Math.abs(actual[i]-expected[i]);maximum=Math.max(maximum,error);assert.ok(error<0.000002,`${id} bound ${i}: ${error} m`);}
  const spring=profile.valves.spring_targets[id];
  if(spring){
   const index=mesh.morphTargetDictionary?.[spring.target];assert.ok(index!==undefined,id+' spring target');assert.equal(mesh.morphTargetInfluences[index],0);
   const native=springReference.springs[id],q=native.body_world_quaternion_xyzw,rotation=new THREE.Quaternion(q[0],q[1],q[2],q[3]);
   const translation=new THREE.Vector3(...native.body_world_translation_mm),target=mesh.geometry.morphAttributes.position[index];
   for(let i=0;i<positions.count;i+=Math.max(1,Math.floor(positions.count/96))){
    const base=new THREE.Vector3().fromBufferAttribute(positions,i),world=base.clone().applyMatrix4(mesh.matrixWorld);
    const local=new THREE.Vector3(world.x,-world.z,world.y).multiplyScalar(1000).sub(translation).applyQuaternion(rotation.clone().invert());
    const fraction=((native.angular_direction*Math.atan2(local.z,local.y)/(2*Math.PI))%1+1)%1;
    const turn=Math.round((local.x-native.start_x_mm)/native.pitch_mm-fraction),travel=Math.min(1,Math.max(0,(turn+fraction)/native.turns));
    const delta=new THREE.Vector3(-native.maximum_lift_mm*travel,0,0).applyQuaternion(rotation).multiplyScalar(.001);
    const expectedDelta=new THREE.Vector3(delta.x,delta.z,-delta.y),deformed=new THREE.Vector3().fromBufferAttribute(target,i);
    if(mesh.geometry.morphTargetsRelative)deformed.add(base);
    const actualDelta=deformed.applyMatrix4(mesh.matrixWorld).sub(world);
    assert.ok(actualDelta.distanceTo(expectedDelta)<.000003,`${id} spring deformation at vertex ${i}`);
   }
  }
 });
 assert.deepEqual(ids.sort(),release.parts);assert.equal(new Set(ids).size,61);
 assert.equal(gltf.animations.length,0,'the shared operation profile owns browser motion');
 console.log('reviewed CAD/GLB maximum bind-bound error (m):',maximum);
});

test('browser lifters and pushrods follow the reviewed valve trains',()=>{
 const point=a=>new THREE.Vector3(a[0],a[2],-a[1]).multiplyScalar(.001);
 for(const angle of [0,45,90,180,270,360,540,585,630,675,720]){
  const {cycle,matrices}=valveMatrices(angle,profile.valves);
  for(const [name,train] of Object.entries(profile.valves.trains)){
   const title=name[0].toUpperCase()+name.slice(1),pose=valveTrainPose(cycle[name+'Lift'],train);
   const lower=point(train.pushrod_lower_mm).applyMatrix4(matrices[title+'HydraulicLifterBody']);
   assert.ok(lower.distanceTo(point(pose.follower))<1e-9);
   const upper=point(train.pushrod_socket_mm).applyMatrix4(matrices[title+'Pushrod']);
   assert.ok(upper.distanceTo(point(pose.socket))<1e-9);
   assert.ok(Math.abs(upper.distanceTo(lower)*1000-train.pushrod_length_mm)<1e-6);
  }
 }
});
