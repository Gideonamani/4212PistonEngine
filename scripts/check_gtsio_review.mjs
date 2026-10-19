// Independent file-level checks using the same Three.js loader/sampler as the app.
// Run manually: this private candidate is not a production test dependency.
//
//   node scripts/check_gtsio_review.mjs [review-folder]                         the review build's own GLB (default build/gtsio520-animation-review)
//   node scripts/check_gtsio_review.mjs [review-folder] --asset web/gtsio520-r10-static-opt1.glb.gz //        --expect-sha256 <decoded sha256> --position-tolerance 1.1e-5            an optimised copy of it (meshopt-packed, gzip)
//
// With --asset the file is read in place of the review GLB and its hash is checked against --expect-sha256. The rest-bounds check then allows
// the position rounding the optimiser reports (its limit is 1e-5 of the model size), and the result is written to
// kinematic-export-checks-optimised.json so the review build's own record is not overwritten.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {gunzipSync} from 'node:zlib';
import {createProceduralStudySampler, indexStudyParts} from '../src/viewer/core/animated-study-motion.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const flag=(name)=>{const i=args.indexOf('--'+name);return i>=0?args[i+1]:undefined;};
const out=args[0]&&!args[0].startsWith('--')?path.resolve(args[0]):path.join(repo,'build/gtsio520-animation-review');
const assetOverride=flag('asset'),expectedSha=flag('expect-sha256'),positionTolerance=Number(flag('position-tolerance')??3e-7);
if(assetOverride&&!expectedSha)throw new Error('--asset needs --expect-sha256');
const contract=JSON.parse(fs.readFileSync(path.join(out,'review-contract.json')));
const manifest=JSON.parse(fs.readFileSync(path.join(out,'review-manifest.json')));
const reference=JSON.parse(fs.readFileSync(path.join(out,'reference-poses.json')));
const assetFile=contract.asset_file || (fs.existsSync(path.join(out,'gtsio520-r10-static.glb')) ? 'gtsio520-r10-static.glb' : 'gtsio520-r10-animated-review.glb');
let raw=fs.readFileSync(assetOverride?path.resolve(assetOverride):path.join(out,assetFile));
if(raw[0]===0x1f&&raw[1]===0x8b)raw=gunzipSync(raw);
const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(raw.buffer.slice(raw.byteOffset,raw.byteOffset+raw.byteLength),'');
const root=gltf.scene,mixer=new THREE.AnimationMixer(root);
const {partsById:parts}=indexStudyParts(root);root.updateMatrixWorld(true);
const rest=new Map([...parts].map(([id,o])=>[id,o.matrixWorld.clone()]));
const procedural=createProceduralStudySampler(contract,parts,root);
const reports=[];
function check(name,fn){fn();reports.push({name,passed:true});console.log('PASS',name);}
function sample(index,fraction){
  mixer.stopAllAction();
  const motion=contract.motions[index];
  const clip=gltf.animations.find(c=>c.name===motion.id);
  if(clip){
    const a=mixer.clipAction(clip).reset().setLoop(THREE.LoopOnce,1).play();
    a.paused=true;a.clampWhenFinished=true;a.time=clip.duration*fraction;
    mixer.update(0);root.updateMatrixWorld(true);
  } else {
    procedural.apply(motion,fraction*100);
  }
}
const err=(a,b)=>Math.max(...a.elements.map((v,i)=>Math.abs(v-b.elements[i])));
check('Three motions, all 1396 stable IDs, matching hash and explicit draft scope',()=>{
  assert.equal(parts.size,1396);assert.equal(contract.parts.length,1396);
  assert.equal(createHash('sha256').update(raw).digest('hex'),expectedSha??contract.asset_sha256);
  assert.equal(contract.motions.length,3);
  assert.ok(contract.motions.every(m=>gltf.animations.some(c=>c.name===m.id)||procedural.supports(m)));
  assert.ok(contract.parts.every(p=>parts.has(p.id)));assert.equal(contract.release_allowed,false);
  assert.match(contract.scope,/illustrative.*not an approved maintenance/i);
});
let boundsError=0;
check('Rest mesh coordinates match frozen tessellation in metres and glTF axes',()=>{
  for(const p of manifest.parts){const o=parts.get(p.id),box=new THREE.Box3(),v=new THREE.Vector3(),attr=o.geometry.getAttribute('position');
    for(let i=0;i<attr.count;i++)box.expandByPoint(v.fromBufferAttribute(attr,i).applyMatrix4(o.matrixWorld));
    const lo=p.mesh_bounds_mm[0],hi=p.mesh_bounds_mm[1],expected=[lo[0]/1000,lo[2]/1000,-hi[1]/1000,hi[0]/1000,hi[2]/1000,-lo[1]/1000];
    const actual=[...box.min.toArray(),...box.max.toArray()];boundsError=Math.max(boundsError,...actual.map((x,i)=>Math.abs(x-expected[i])));
  }
  assert.ok(boundsError<positionTolerance,`source-mesh export bounds error ${boundsError} (limit ${positionTolerance})`);
});
let referenceError=0;
check('Evaluated motion agrees with the shared definition at saved crank samples',()=>{
  const C=new THREE.Matrix4().set(1,0,0,0,0,0,1,0,0,-1,0,0,0,0,0,1),Ci=C.clone().invert();
  for(const angle of [0,137,360,720]){sample(2,angle/720);
    for(const [pid,frames] of Object.entries(reference)){
      const expected=new THREE.Matrix4().set(...frames[String(angle)].flat()).premultiply(C).multiply(Ci);
      referenceError=Math.max(referenceError,err(parts.get(pid).matrixWorld,expected));
    }
  }
  assert.ok(referenceError<2e-5,`matrix error ${referenceError}`);
});
let pistonError=0,rodError=0;
check('Between-key slider-crank stroke and both ends of all six rods',()=>{
  const r=.0508,L=.168275,phases=[0,360,480,120,240,600];
  for(let angle=.5;angle<720;angle+=4.5){sample(2,angle/720);
    for(let n=1;n<=6;n++){const sign=n%2?1:-1,a=(angle-phases[n-1]+(sign>0?0:180))*Math.PI/180;
      const a0=(-phases[n-1]+(sign>0?0:180))*Math.PI/180,z=(85+Math.floor((n-1)/2)*182+((n-1)%2)*56)/1000;
      const pin=new THREE.Vector3(r*Math.cos(a),z,-r*Math.sin(a));
      const pin0=new THREE.Vector3(r*Math.cos(a0),z,-r*Math.sin(a0));
      const wx=sign*Math.sqrt(L*L-r*r*Math.sin(a)**2)+r*Math.cos(a),wx0=sign*Math.sqrt(L*L-r*r*Math.sin(a0)**2)+r*Math.cos(a0);
      const delta=parts.get('Piston'+n).matrixWorld.clone().multiply(rest.get('Piston'+n).clone().invert());
      pistonError=Math.max(pistonError,Math.abs(delta.elements[12]-(wx-wx0)));
      const rodDelta=parts.get('ConnectingRod'+n).matrixWorld.clone().multiply(rest.get('ConnectingRod'+n).clone().invert());
      rodError=Math.max(rodError,pin0.clone().applyMatrix4(rodDelta).distanceTo(pin),new THREE.Vector3(wx0,z,0).applyMatrix4(rodDelta).distanceTo(new THREE.Vector3(wx,z,0)));
    }
  }
  assert.ok(pistonError<4e-6,`between-key piston error ${pistonError}`);assert.ok(rodError<5e-6,`between-key rod error ${rodError}`);
});
let reverseError=0;
check('Collapse is the exact inverse at held and between-key layout poses',()=>{
  for(let f=0;f<=1;f+=.03125){sample(0,f);const matrices=new Map([...parts].map(([id,o])=>[id,o.matrixWorld.clone()]));sample(1,1-f);
    for(const [id,o] of parts)reverseError=Math.max(reverseError,err(o.matrixWorld,matrices.get(id)));
  }
  assert.ok(reverseError<2e-6,`inverse layout error ${reverseError}`);
});
let switchError=0;
check('Cycle closure and clip switching restore the identical assembled pose',()=>{
  for(const [clip,fraction] of [[0,0],[1,1],[2,0],[2,1],[0,.8],[2,0],[1,.6],[0,0]]){
    sample(clip,fraction);if((clip===0&&fraction===0)||(clip===1&&fraction===1)||(clip===2&&(fraction===0||fraction===1)))
      for(const [id,o] of parts)switchError=Math.max(switchError,err(o.matrixWorld,rest.get(id)));
  }
  assert.ok(switchError<2e-6,`closure/switch error ${switchError}`);
});
fs.writeFileSync(path.join(out,assetOverride?'kinematic-export-checks-optimised.json':'kinematic-export-checks.json'),JSON.stringify({passed:true,asset_file:assetOverride?path.basename(assetOverride):assetFile,asset_sha256:expectedSha??contract.asset_sha256,position_tolerance_m:positionTolerance,checks:reports,
  max_errors:{cad_mesh_bounds_m:boundsError,shared_matrix:referenceError,between_key_piston_m:pistonError,between_key_rod_m:rodError,reverse_matrix:reverseError,switch_matrix:switchError},
  scope:'Kinematics and file integrity only. No native/STEP, physical removal-path, contact or swept-clearance acceptance.'},null,2)+'\n');

