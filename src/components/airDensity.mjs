// How much air, in the sense of oxygen, a naturally aspirated cylinder can draw in under given outside conditions. Pure, so it is tested
// without a browser. A piston engine is a positive displacement pump: it draws in the same VOLUME of air each cycle at a given speed, so
// the air it burns follows the MASS of dry air in that volume. This is the quantity the lesson calls "air available", as a fraction of the
// standard sea-level day; it is a teaching quantity and not a prediction of any engine's power.
//
// Method: the International Standard Atmosphere (ISA) below 11,000 m gives the standard temperature and pressure at an altitude; a
// temperature offset is added to the standard temperature; humidity is water vapour that takes up part of the pressure, leaving less dry air.

export const SEA_LEVEL = Object.freeze({ pressurePa: 101325, temperatureK: 288.15, densityKgM3: 1.225 });
const LAPSE_K_PER_M = 0.0065;
const GAS_CONSTANT_DRY = 287.058; // J/(kg K)
const FT_TO_M = 0.3048;
const PA_PER_INHG = 3386.389;
/** The altitude, in feet, up to which the formulas below hold (the top of the ISA troposphere). */
export const MAX_ALTITUDE_FT = 36089;

/** Standard pressure and temperature at an altitude. @param {number} altitudeFt */
export function standardAtmosphere(altitudeFt) {
  if (!(altitudeFt >= 0 && altitudeFt <= MAX_ALTITUDE_FT)) throw new RangeError(`altitude must be 0 to ${MAX_ALTITUDE_FT} ft`);
  const temperatureK = SEA_LEVEL.temperatureK - LAPSE_K_PER_M * altitudeFt * FT_TO_M;
  const pressurePa = SEA_LEVEL.pressurePa * (temperatureK / SEA_LEVEL.temperatureK) ** 5.25588;
  return { temperatureK, pressurePa, pressureInHg: pressurePa / PA_PER_INHG };
}

/** The pressure at which water vapour condenses at a temperature (Magnus formula), in pascals. @param {number} celsius */
export function saturationVapourPressurePa(celsius) {
  return 610.94 * Math.exp((17.625 * celsius) / (celsius + 243.04));
}

/**
 * The air an engine can draw in, as a fraction of the standard sea-level day.
 * @param {{ altitudeFt: number, temperatureOffsetC?: number, relativeHumidityPct?: number }} conditions
 * @returns {{ pressureInHg: number, temperatureC: number, airAvailable: number, vapourFraction: number }}
 */
export function airAvailable({ altitudeFt, temperatureOffsetC = 0, relativeHumidityPct = 0 }) {
  const standard = standardAtmosphere(altitudeFt);
  const temperatureK = standard.temperatureK + temperatureOffsetC;
  const temperatureC = temperatureK - 273.15;
  const vapourPa = Math.min(standard.pressurePa, (relativeHumidityPct / 100) * saturationVapourPressurePa(temperatureC));
  const dryDensity = (standard.pressurePa - vapourPa) / (GAS_CONSTANT_DRY * temperatureK);
  return {
    pressureInHg: standard.pressureInHg,
    temperatureC,
    airAvailable: dryDensity / SEA_LEVEL.densityKgM3,
    vapourFraction: vapourPa / standard.pressurePa,
  };
}
