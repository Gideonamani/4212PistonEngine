import assert from 'node:assert/strict';
import test from 'node:test';
import {
  brakeMeanEffectivePressure, brakeThermalEfficiency, compressionRatio, crankshaftRpm, cylinderDisplacement, frictionHorsepower, indicatedHorsepower, mechanicalEfficiency,
  pistonArea, powerStrokesPerMinute, pronyBrakeHorsepower, thrustHorsepower,
} from '../src/components/enginePower.mjs';

const near = (actual, expected, tolerance, what) => assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not within ${tolerance} of ${expected}`);

test('piston displacement matches the handbook, the manual and the daily quiz', () => {
  // FAA-H-8083-32B PDF p. 49-50: the 14-cylinder engine with a 5.5 in bore and 5.5 in stroke displaces 130.67 cu in a cylinder and 1,829.4 in all.
  near(cylinderDisplacement(5.5, 5.5), 130.67, 0.01, 'handbook cylinder');
  near(cylinderDisplacement(5.5, 5.5) * 14, 1829.4, 0.1, 'handbook engine');
  near(pistonArea(5.5), 23.7583, 0.001, 'area');
  // GTSIO-520-H: bore 5.250, stroke 4.000, six cylinders, listed as 520 cu in.
  near(cylinderDisplacement(5.25, 4), 86.59, 0.01, 'GTSIO-520-H cylinder');
  near(cylinderDisplacement(5.25, 4) * 6, 519.5, 0.1, 'GTSIO-520-H engine');
  // Daily quiz, day 5, question 4: bore 5 in, stroke 4 in.
  near(cylinderDisplacement(5, 4), 78.54, 0.01, 'daily quiz');
});

test('compression ratio is total volume over clearance volume', () => {
  assert.equal(compressionRatio(80, 10), 9, 'daily quiz day 5 question 19');
  near(compressionRatio(cylinderDisplacement(5, 3.75), 10.5), 8.01, 0.01, 'course deck calculation (a)');
  near(compressionRatio(86.59, 13.32), 7.5, 0.01, 'GTSIO-520-H');
  assert.equal(compressionRatio(140 - 20, 20), 7, 'the handbook: 140 cu in at the bottom and 20 cu in at the top is 7:1');
});

test('PLANK gives the indicated horsepower, with the handbook\'s worked example corrected', () => {
  // The handbook's example (PDF p. 52) prints P as 1.65 psi but its result, 1,069.123 hp, needs 165 psi (12 cylinders, 5.5 in bore, 6 in stroke, 3,000 rpm).
  near(indicatedHorsepower({ pressurePsi: 165, strokeIn: 6, boreIn: 5.5, rpm: 3000, cylinders: 12 }), 1069.1, 0.2, 'handbook example with P = 165');
  near(indicatedHorsepower({ pressurePsi: 1.65, strokeIn: 6, boreIn: 5.5, rpm: 3000, cylinders: 12 }), 10.69, 0.01, 'the printed 1.65 psi would give a hundredth of that');
  // Course deck calculation (b): four cylinders, 2,400 rpm, 5.0 in bore, 4.5 in stroke, 135 psi.
  near(indicatedHorsepower({ pressurePsi: 135, strokeIn: 4.5, boreIn: 5, rpm: 2400, cylinders: 4 }), 144.6, 0.1, 'deck example');
  assert.equal(powerStrokesPerMinute(3000), 1500);
});

test('BMEP follows from the brake horsepower', () => {
  // The handbook's example (PDF p. 54): 1,000 bhp, 6 in stroke, 5.5 in bore, 3,000 rpm, 12 cylinders gives 154.32 psi.
  near(brakeMeanEffectivePressure({ bhp: 1000, strokeIn: 6, boreIn: 5.5, rpm: 3000, cylinders: 12 }), 154.32, 0.02, 'handbook example (it rounds the piston area to 23.76 sq in)');
  // GTSIO-520-H: 375 hp at 2,275 propeller rpm with a 0.667:1 drive.
  const rpm = crankshaftRpm(2275, 0.667);
  near(rpm, 3410.8, 0.1, 'crankshaft rpm');
  near(brakeMeanEffectivePressure({ bhp: 375, strokeIn: 4, boreIn: 5.25, rpm, cylinders: 6 }), 167.6, 0.2, 'GTSIO-520-H BMEP');
  // The two formulas are inverses: the indicated horsepower of the BMEP is the brake horsepower.
  near(indicatedHorsepower({ pressurePsi: 167.6, strokeIn: 4, boreIn: 5.25, rpm, cylinders: 6 }), 375, 0.5, 'round trip');
});

test('a Prony brake gives the brake horsepower', () => {
  // FAA p. 52: 200 lb on the scale at a 3.18 ft arm is a torque of 636 lb-ft; at 3,000 rpm that is 363.3 hp.
  near(200 * 3.18, 636, 1e-9, 'torque');
  near(pronyBrakeHorsepower({ scaleLb: 200, armFt: 3.18, rpm: 3000 }), 363.3, 0.1, 'brake horsepower');
});

test('friction, mechanical efficiency and thrust horsepower', () => {
  assert.equal(frictionHorsepower(200, 170), 30);
  assert.equal(mechanicalEfficiency(170, 200), 0.85, 'daily quiz day 5 question 19: 200 ihp and 30 fhp');
  near(mechanicalEfficiency(260, 310), 0.8387, 0.0005, 'deck recap question 3');
  assert.equal(thrustHorsepower(1000, 0.85), 850, 'handbook p. 54');
});

test('brake thermal efficiency matches the handbook\'s worked example', () => {
  // PDF p. 55-56: 85 bhp for one hour on 50 lb of fuel of 18,800 BTU per pound is 23 percent.
  near(brakeThermalEfficiency({ bhp: 85, fuelLbPerHour: 50, btuPerLb: 18800 }), 0.2302, 0.0005, 'brake thermal efficiency (the handbook rounds it to 0.23; its figure prints 8.5 ihp where its own arithmetic uses 85)');
});
