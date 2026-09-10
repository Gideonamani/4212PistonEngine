import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {illustrativeCycle,valveTrainPose} from '../web/valve-kinematics.mjs';
const read=name=>JSON.parse(fs.readFileSync(new URL('../data/'+name,import.meta.url)));
const frames=read('pushrod-frames.json');
const reference=read('housing-candidate-contact.json');
const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));

test('runtime rocker and follower solution agrees with 58 native CAD poses',()=>{
  assert.equal(reference.sampled_clearance_gate.passed,true);
  for(const name of ['intake','exhaust']){
    const samples=reference.poses.filter(p=>p.train.toLowerCase()===name);
    assert.equal(samples.length,29);
    const train={...frames.trains[name],contact_samples:samples};
    for(const sample of samples){
      const pose=valveTrainPose(sample.lift_mm,train);
      assert.ok(distance(pose.socket,sample.pushrod_socket_mm)<1e-6);
      assert.ok(distance(pose.follower,sample.follower_ball_mm)<1e-6);
    }
    // Interpolated poses preserve joint closure, without claiming continuous solid clearance.
    for(let i=0;i<=700;i++){
      const pose=valveTrainPose(i/100,train);
      assert.ok(Math.abs(distance(pose.socket,pose.follower)-train.pushrod_length_mm)<1e-9);
    }
    assert.throws(()=>valveTrainPose(7.01,train));
    assert.throws(()=>valveTrainPose(NaN,train));
  }
});

test('source-bound valve contract agrees with its candidate CAD audit',()=>{
  const path=new URL('../data/valve-motion.json',import.meta.url);
  const profile=JSON.parse(fs.readFileSync(path));
  const audit=read('spring-seat-contact.json');
  assert.equal(audit.audit_complete,true);
  assert.equal(audit.sampled_clearance_gate.passed,true);
  assert.equal(profile.source_sha256,audit.source_sha256);
  assert.equal(audit.poses.length,58);
  for(const sample of audit.poses){
    const pose=valveTrainPose(sample.lift_mm,profile.trains[sample.train.toLowerCase()]);
    assert.ok(distance(pose.socket,sample.pushrod_socket_mm)<1e-6);
    assert.ok(distance(pose.follower,sample.follower_ball_mm)<1e-6);
  }
});

test('illustrative cycle closes smoothly and opens only the intended valve',()=>{
  for(const angle of [0,180,360,540,720]){
    const p=illustrativeCycle(angle);
    assert.equal(p.intakeLift,0);assert.equal(p.exhaustLift,0);
  }
  assert.equal(illustrativeCycle(90).intakeLift,7);
  assert.equal(illustrativeCycle(630).exhaustLift,7);
  for(let angle=-720;angle<1440;angle++){
    const p=illustrativeCycle(angle),q=illustrativeCycle(angle+720);
    assert.deepEqual(p,q);
    assert.ok(!(p.intakeLift>0&&p.exhaustLift>0));
  }
  assert.throws(()=>illustrativeCycle(Infinity));
});
