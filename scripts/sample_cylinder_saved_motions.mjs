import fs from 'node:fs';
import {createHash} from 'node:crypto';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
const buffer=fs.readFileSync('cad-studies/cylinder/Cylinder_Saved_Motions.glb');
const {scene,animations}=await new GLTFLoader().parseAsync(buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),'');
const meshes=[];scene.traverse(mesh=>{if(mesh.isMesh)meshes.push(mesh)});
const mixer=new THREE.AnimationMixer(scene),samples={};
for(const name of ['Exploded overview','Reassembly overview']){
 samples[name]={};const clip=animations.find(clip=>clip.name===name);
 if(clip.tracks.some(track=>track.times[0]!==0))throw Error('All motion tracks must start at zero');
 for(const progress of [0,12.5,25,37.5,50,62.5,75,87.5,100]){
  mixer.stopAllAction();const action=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1).play();action.clampWhenFinished=true;action.paused=true;action.time=clip.duration*progress/100;mixer.update(0);scene.updateMatrixWorld(true);
  samples[name][progress]=Object.fromEntries(meshes.map(mesh=>[mesh.userData.cad_part_id,new THREE.Vector3().setFromMatrixPosition(mesh.matrixWorld).toArray()]));
 }
}
fs.writeFileSync('cad-studies/cylinder/native-motion-samples.json',JSON.stringify({source:'Blender-exported named GLB animation clips',glb_sha256:createHash('sha256').update(buffer).digest('hex'),samples},null,2));
console.log('Native motion samples saved:',animations.map(clip=>clip.name));
