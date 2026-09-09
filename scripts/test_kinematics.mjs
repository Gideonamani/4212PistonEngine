import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mechanismPose} from '../web/kinematics.mjs';
const cad=JSON.parse(readFileSync(new URL('../data/motion-profile.json',import.meta.url)));
const r=cad.dimensions.Stroke.value_mm/2000,L=cad.dimensions.RodLength.value_mm/1000;
test('web mechanism agrees with all recorded FreeCAD joint positions',()=>{
  for(const pose of cad.validation.poses){
    const p=mechanismPose(pose.angle_deg,r,L);
    assert.ok(Math.abs(p.piston[0]-pose.piston_pin_mm[0]/1000)<1e-10);
    assert.ok(Math.abs(p.rod[0]-pose.crankpin_mm[0]/1000)<1e-10);
    assert.ok(Math.abs(p.rod[1]-pose.crankpin_mm[2]/1000)<1e-10);
    assert.ok(Math.hypot(p.rod[0]+L*Math.cos(p.rodAngle)-p.piston[0],p.rod[1]+L*Math.sin(p.rodAngle))<1e-10);
  }
});
test('two-revolution loop closes and travels the recorded stroke',()=>{
  assert.ok(Math.abs(mechanismPose(0,r,L).piston[0]-mechanismPose(720,r,L).piston[0])<1e-12);
  assert.ok(Math.abs(mechanismPose(0,r,L).piston[0]-mechanismPose(180,r,L).piston[0]-2*r)<1e-12);
});
