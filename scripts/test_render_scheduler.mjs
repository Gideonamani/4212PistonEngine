import test from 'node:test';
import assert from 'node:assert/strict';
import {createRenderScheduler} from '../src/viewer/core/render-scheduler.mjs';

function fixture() {
  let next = 0, state = 0;
  const frames = new Map(), drawn = [];
  const scheduler = createRenderScheduler(() => drawn.push(state), callback => { const id = next++; frames.set(id, callback); return id; }, id => frames.delete(id));
  return {scheduler, frames, drawn, change(value) { state = value; scheduler.request(); }, tick() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); }};
}
test('several updates draw the latest state once on the next frame', () => {
  const f = fixture(); f.change(1); f.change(2); f.change(3);
  assert.equal(f.frames.size, 1); assert.deepEqual(f.drawn, []);
  f.tick(); assert.deepEqual(f.drawn, [3]);
  f.change(4); f.tick(); assert.deepEqual(f.drawn, [3, 4]);
});
test('capture flush draws immediately and cancels the stale queued frame', () => {
  const f = fixture(); f.change(7); f.scheduler.flush();
  assert.deepEqual(f.drawn, [7]); assert.equal(f.frames.size, 0);
  f.tick(); assert.deepEqual(f.drawn, [7]);
});
test('animation can flush its requested final pose without drawing twice', () => {
  const f = fixture(); f.change(99); f.change(100); f.scheduler.flush(); f.tick();
  assert.deepEqual(f.drawn, [100]);
});
test('disposing a viewer cancels pending work and rejects later draws', () => {
  const f = fixture(); f.change(1); f.scheduler.dispose(); f.change(2); f.scheduler.flush(); f.tick();
  assert.deepEqual(f.drawn, []); assert.equal(f.frames.size, 0);
});
