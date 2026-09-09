import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createTransfer} from '../web/transfer.mjs';

test('active transfers survive the original deadline, then time out when idle',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const transfer=createTransfer(120000);
  for(let n=0;n<5;n++){t.mock.timers.tick(90000);transfer.touch();assert.equal(transfer.signal.aborted,false);}
  t.mock.timers.tick(120001);assert.equal(transfer.signal.aborted,true);assert.equal(transfer.reason,'stalled');
});
test('cancel aborts immediately and completion clears the timer',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const cancelled=createTransfer();cancelled.cancel();assert.equal(cancelled.reason,'cancelled');assert.equal(cancelled.signal.aborted,true);
  const completed=createTransfer();completed.finish();t.mock.timers.tick(240000);assert.equal(completed.signal.aborted,false);
});
