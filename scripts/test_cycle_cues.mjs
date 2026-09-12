import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleCueState} from '../web/cycle-cues.mjs';
import {chamberParticle,portPath,pathParticle,streamFraction,particleRadiusMm} from '../web/cycle-particles.mjs';
import {mechanismPose} from '../web/kinematics.mjs';
import fs from 'node:fs';
test('cycle cues agree with open valves and remain deterministic across two revolutions',()=>{
 for(let angle=0;angle<=720;angle++){
  const state=cycleCueState(angle);
  assert.deepEqual(state,cycleCueState(angle+720));
  assert.equal(state.intakeVisible,state.intakeLift>1e-6);
  assert.equal(state.exhaustVisible,state.exhaustLift>1e-6);
  assert.ok(!(state.intakeVisible&&state.exhaustVisible));
  if(state.stroke==='Compression'||state.stroke==='Power')assert.ok(!state.intakeVisible&&!state.exhaustVisible);
  if(state.stroke!=='Power')assert.equal(state.reactionGlow,0);
  assert.ok(state.reactionGlow>=0&&state.reactionGlow<=1);
 }
 assert.match(cycleCueState(90).description,/continuously at the intake port/);
 assert.match(cycleCueState(400).description,/Fuel reacts with oxygen/);
 assert.throws(()=>cycleCueState(NaN));
});

test('entire chamber sprites clear the moving piston and stay in the audited display envelope',()=>{
 const {chamber}=JSON.parse(fs.readFileSync(new URL('../data/cycle-cues-profile.json',import.meta.url)));
 for(let angle=0;angle<=720;angle++){
  const pin=mechanismPose(angle,.0508,.168275).piston[0]*1000;
  for(let i=0;i<180;i++){
   const p=chamberParticle(i,180,angle,pin,chamber);
   assert.ok(p[0]-particleRadiusMm>pin+chamber.piston_front_offset_mm);
   assert.ok(p[0]+particleRadiusMm<chamber.front_x_mm);
   assert.ok(Math.hypot(p[1],p[2])+particleRadiusMm<chamber.radius_mm);
   assert.deepEqual(p,chamberParticle(i,180,angle,pin,chamber));
  }
 }
 const pin=219.075;
 assert.deepEqual(chamberParticle(1,180,0,pin,chamber),chamberParticle(1,180,720,pin,chamber));
 assert.notDeepEqual(chamberParticle(1,180,90,pin,chamber),chamberParticle(1,180,91,pin,chamber));
});

test('stream trajectories pass port landmarks, reverse for exhaust, and remain above the crown',()=>{
 const landmarks=JSON.parse(fs.readFileSync(new URL('../data/cycle-cues-profile.json',import.meta.url)));
 const frames=JSON.parse(fs.readFileSync(new URL('../data/pushrod-frames.json',import.meta.url)));
 for(const name of ['intake','exhaust']){
  const frame=frames.trains[name];
  landmarks.ports[name].valve={origin_mm:frame.closed_valve_origin_mm,axis:frame.valve_axis,head_radius_mm:name==='intake'?30.5:24};
  for(let angle=name==='intake'?1:541;angle<(name==='intake'?180:720);angle++){
   const pin=mechanismPose(angle,.0508,.168275).piston[0]*1000;
   const path=portPath(name,cycleCueState(angle)[name+'Lift'],pin,landmarks);
   assert.ok(path.some(p=>p.every((v,i)=>v===landmarks.ports[name].outer_endpoint_mm[i])));
   assert.ok(path.some(p=>p.every((v,i)=>v===landmarks.ports[name].inner_origin_mm[i])));
   assert.deepEqual(pathParticle(path,0),path[0]);
   assert.ok(pathParticle(path,1).every((v,i)=>Math.abs(v-path.at(-1)[i])<1e-10));
   for(let i=0;i<72;i++)assert.ok(pathParticle(path,streamFraction(i,72,angle))[0]-particleRadiusMm>pin+landmarks.chamber.piston_front_offset_mm);
   assert.ok(name==='intake'?Math.abs(path[0][1])>Math.abs(path.at(-1)[1]):Math.abs(path[0][1])<Math.abs(path.at(-1)[1]));
  }
 }
 assert.equal(streamFraction(7,72,0),streamFraction(7,72,720));
});
