import assert from 'node:assert/strict';
import test from 'node:test';
import { camLift, CYCLE_DEGREES, distanceFromPeak, openingWindow, PEAK_CRANK, wrapDegrees } from '../src/components/valveTrain.mjs';

const standard = { lift: 10, durationCrank: 260, rampFraction: 0.14, rampCrank: 36 };

test('angles wrap into one cycle and distances are measured the short way round', () => {
  assert.equal(wrapDegrees(-50), 670);
  assert.equal(wrapDegrees(725), 5);
  assert.equal(wrapDegrees(720), 0);
  assert.equal(distanceFromPeak(PEAK_CRANK), 0);
  assert.equal(distanceFromPeak(PEAK_CRANK + 100), 100);
  assert.equal(distanceFromPeak(PEAK_CRANK - 100), 100);
  assert.equal(distanceFromPeak(PEAK_CRANK + 360), 360, 'the far side of the cycle');
  assert.equal(distanceFromPeak(PEAK_CRANK - 10 + CYCLE_DEGREES), 10, 'wrapping around the end of the cycle');
});

test('the lift is zero off the lobe, full at the peak, and never negative or beyond the lift', () => {
  assert.equal(camLift(standard, PEAK_CRANK), standard.lift);
  assert.equal(camLift(standard, PEAK_CRANK + 130), 0, 'the valve is just back on its seat');
  assert.equal(camLift(standard, PEAK_CRANK + 360), 0);
  for (let angle = 0; angle < CYCLE_DEGREES; angle += 1) {
    const lift = camLift(standard, angle);
    assert.ok(lift >= 0 && lift <= standard.lift + 1e-9, `lift ${lift} at ${angle}`);
  }
});

test('the lobe is symmetrical and has no jump where the ramp meets the body', () => {
  for (const offset of [5, 40, 90, 120, 129]) assert.ok(Math.abs(camLift(standard, PEAK_CRANK + offset) - camLift(standard, PEAK_CRANK - offset)) < 1e-9, `offset ${offset}`);
  const rampTop = standard.lift * standard.rampFraction;
  const half = standard.durationCrank / 2;
  assert.ok(Math.abs(camLift(standard, PEAK_CRANK + half - standard.rampCrank) - rampTop) < 1e-9, 'the ramp reaches its height exactly where the body starts');
  assert.ok(camLift(standard, PEAK_CRANK + half - 1) < rampTop, 'on the ramp, below its top');
  assert.ok(camLift(standard, PEAK_CRANK + half - 1) > 0, 'but already off the seat');
  let last = Number.POSITIVE_INFINITY;
  for (let offset = 0; offset < half; offset += 1) {
    const lift = camLift(standard, PEAK_CRANK + offset);
    assert.ok(lift <= last + 1e-9, `lift falls steadily away from the peak (${offset})`);
    last = lift;
  }
});

test('the valve is off its seat for exactly its duration', () => {
  for (const durationCrank of [220, 260, 300]) {
    const profile = { ...standard, durationCrank };
    let open = 0;
    for (let angle = 0; angle < CYCLE_DEGREES; angle += 0.5) if (camLift(profile, angle) > 0) open += 0.5;
    assert.ok(Math.abs(open - durationCrank) <= 1, `${durationCrank}: open for ${open}`);
  }
});

test('the standard lobe opens and closes where the FAA example chart puts the intake valve', () => {
  // FAA-H-8083-32B Figure 1-37: intake opens 50 degrees before TDC (670) and closes 30 degrees after BDC (210).
  assert.deepEqual(openingWindow(standard), { opens: 670, closes: 210 });
  assert.equal(openingWindow({ ...standard, durationCrank: 220 }).opens, 690);
  assert.equal(openingWindow({ ...standard, durationCrank: 300 }).closes, 230);
});
