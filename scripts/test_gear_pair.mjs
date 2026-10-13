import assert from 'node:assert/strict';
import test from 'node:test';
import { drivenAngle, drivenSpeed, gearPath, idlerAngle, IDLER_TEETH, pitchRadius, speedRatio, startPhase, TEETH_CHOICES, turnsOpposite } from '../src/components/gearPair.mjs';

// The gear explorer in lesson 9 teaches three rules: speed goes in proportion to the teeth, each mesh reverses the direction, and an idler
// reverses it back without changing the ratio. Its drawing must also show teeth that really interleave, so a learner never sees them clash.

test('speed follows the tooth counts: fewer teeth turn faster, and the ratio is driver over driven', () => {
  assert.equal(speedRatio(12, 24), 0.5);
  assert.equal(speedRatio(36, 12), 3);
  assert.equal(drivenSpeed(2400, 12, 36), 800);
  assert.equal(drivenSpeed(2400, 24, 24), 2400);
  assert.equal(drivenSpeed(3400, 2, 3), 3400 * 2 / 3, 'a 2 : 3 pair, the shape of the 0.667 : 1 propeller drive');
});

test('each mesh reverses the direction, so one idler brings the driven gear back to the driver\'s direction', () => {
  assert.equal(turnsOpposite(0), true);
  assert.equal(turnsOpposite(1), false);
  assert.equal(turnsOpposite(2), true);
  assert.equal(drivenAngle(360, 12, 24), -180);
  assert.equal(drivenAngle(360, 12, 24, 1), 180);
  assert.equal(drivenAngle(360, 12, 24, 1), -drivenAngle(360, 12, 24, 0), 'an idler changes the sign and nothing else');
  assert.equal(idlerAngle(360, 18), -360);
  assert.equal(idlerAngle(360, 36), -720, 'the 36-tooth driver turns the 18-tooth idler twice');
});

test('the outline has one tooth per tooth count and teeth that fit the pitch circle', () => {
  for (const teeth of TEETH_CHOICES) {
    const path = gearPath(teeth);
    assert.equal(path.match(/L/g).length + 1, teeth * 4, `${teeth} teeth, four points each`);
    assert.ok(pitchRadius(teeth) > 0);
  }
  assert.ok(pitchRadius(36) / pitchRadius(12) - 3 < 1e-9, 'three times the teeth, three times the radius, so the rims move together');
});

// Where a gear shows a tooth or a gap to its neighbour: the fraction of a pitch from the nearest tooth centre to the contact direction,
// 0 on a tooth centre and 0.5 in the middle of a gap. Two gears mesh when one is on a tooth exactly as the other is in a gap.
function offsetAtContact(worldRotation, teeth, contactAngle) {
  const pitch = 360 / teeth;
  const position = (((contactAngle - worldRotation) % pitch) + pitch) % pitch;
  return Math.min(position, pitch - position) / pitch;
}

test('the teeth interleave at every angle: a tooth meets a gap, with and without the idler', () => {
  for (const driver of TEETH_CHOICES) for (const driven of TEETH_CHOICES) for (const idler of [false, true]) {
    for (let angle = 0; angle <= 1080; angle += 7) {
      const driverRotation = angle;
      const idlerRotation = 180 + startPhase(IDLER_TEETH) + idlerAngle(angle, driver);
      const drivenRotation = 180 + startPhase(driven, idler) + drivenAngle(angle, driver, driven, idler ? 1 : 0);
      const left = offsetAtContact(driverRotation, driver, 0);
      const where = `${driver}/${driven}${idler ? ' with idler' : ''} at ${angle}`;
      if (!idler) {
        const right = offsetAtContact(drivenRotation, driven, 180);
        assert.ok(Math.abs(left - (0.5 - right)) < 1e-9, `driver tooth meets driven gap: ${where}`);
      } else {
        assert.ok(Math.abs(left - (0.5 - offsetAtContact(idlerRotation, IDLER_TEETH, 180))) < 1e-9, `driver and idler: ${where}`);
        assert.ok(Math.abs(offsetAtContact(idlerRotation, IDLER_TEETH, 0) - (0.5 - offsetAtContact(drivenRotation, driven, 180))) < 1e-9, `idler and driven: ${where}`);
      }
    }
  }
});
