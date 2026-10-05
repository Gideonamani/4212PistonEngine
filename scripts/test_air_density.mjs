import assert from 'node:assert/strict';
import test from 'node:test';
import { airAvailable, MAX_ALTITUDE_FT, saturationVapourPressurePa, SEA_LEVEL, standardAtmosphere } from '../src/components/airDensity.mjs';

const near = (actual, expected, tolerance, what) => assert.ok(Math.abs(actual - expected) <= tolerance, `${what}: ${actual} is not within ${tolerance} of ${expected}`);

test('the standard atmosphere matches the published table', () => {
  const sea = standardAtmosphere(0);
  near(sea.temperatureK, 288.15, 1e-9, 'sea level temperature');
  near(sea.pressureInHg, 29.92, 0.01, 'sea level pressure in inHg');
  // ISA table values: 5,000 ft is 24.90 inHg and 5.1 C; 10,000 ft is 20.58 inHg and -4.8 C; 20,000 ft is 13.75 inHg.
  near(standardAtmosphere(5000).pressureInHg, 24.90, 0.02, '5,000 ft pressure');
  near(standardAtmosphere(5000).temperatureK - 273.15, 5.09, 0.05, '5,000 ft temperature');
  near(standardAtmosphere(10000).pressureInHg, 20.58, 0.02, '10,000 ft pressure');
  near(standardAtmosphere(20000).pressureInHg, 13.75, 0.03, '20,000 ft pressure');
});

test('on a dry standard day the air available is the standard density ratio at that altitude', () => {
  assert.equal(airAvailable({ altitudeFt: 0 }).airAvailable.toFixed(4), '1.0000');
  // ISA density ratios: 5,000 ft 0.8617, 10,000 ft 0.7385, 15,000 ft 0.6292.
  near(airAvailable({ altitudeFt: 5000 }).airAvailable, 0.8617, 0.001, '5,000 ft');
  near(airAvailable({ altitudeFt: 10000 }).airAvailable, 0.7385, 0.001, '10,000 ft');
  near(airAvailable({ altitudeFt: 15000 }).airAvailable, 0.6292, 0.001, '15,000 ft');
  // Roughly 3 percent per thousand feet over the first 5,000 ft, as the course rule of thumb says.
  const perThousand = (1 - airAvailable({ altitudeFt: 5000 }).airAvailable) / 5;
  assert.ok(perThousand > 0.025 && perThousand < 0.035, `${perThousand} per 1,000 ft`);
});

test('hot air holds less, and the effect follows Charles\'s law', () => {
  const hot = airAvailable({ altitudeFt: 0, temperatureOffsetC: 20 });
  near(hot.airAvailable, 288.15 / 308.15, 1e-4, 'density falls in proportion to absolute temperature at constant pressure');
  assert.ok(airAvailable({ altitudeFt: 0, temperatureOffsetC: -20 }).airAvailable > 1, 'cold air holds more');
  // EASA Module 16's worked example: 500 cu in at 0 C becomes 500 x 323 / 273 = 591.6 cu in at 50 C, so a fixed volume holds 273/323 of the air.
  near(500 * 323 / 273, 591.6, 0.05, 'the worked example');
});

test('humid air holds less dry air, by a small amount', () => {
  const standardDay = airAvailable({ altitudeFt: 0, relativeHumidityPct: 100 });
  near(standardDay.airAvailable, 0.983, 0.002, 'saturated air at 15 C');
  near(standardDay.vapourFraction, 0.0168, 0.0005, 'water vapour fraction at 15 C');
  const hotHumid = airAvailable({ altitudeFt: 0, temperatureOffsetC: 20, relativeHumidityPct: 80 });
  assert.ok(hotHumid.airAvailable < airAvailable({ altitudeFt: 0, temperatureOffsetC: 20 }).airAvailable, 'humidity takes more away on top of the heat');
  assert.ok(hotHumid.airAvailable < 0.9, 'a hot, humid day at sea level costs 10 percent');
  assert.equal(airAvailable({ altitudeFt: 0, relativeHumidityPct: 0 }).vapourFraction, 0);
  near(saturationVapourPressurePa(15), 1705, 15, 'saturation vapour pressure at 15 C');
});

test('altitude outside the model is refused, and conditions never give negative air', () => {
  assert.throws(() => standardAtmosphere(-1), RangeError);
  assert.throws(() => standardAtmosphere(MAX_ALTITUDE_FT + 1), RangeError);
  for (const altitudeFt of [0, 12000, MAX_ALTITUDE_FT]) for (const humidity of [0, 100]) assert.ok(airAvailable({ altitudeFt, temperatureOffsetC: 30, relativeHumidityPct: humidity }).airAvailable > 0);
  assert.equal(SEA_LEVEL.pressurePa, 101325);
});
