import test from 'node:test';
import assert from 'node:assert/strict';
import {cycleCueState} from '../web/cycle-cues.mjs';
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
