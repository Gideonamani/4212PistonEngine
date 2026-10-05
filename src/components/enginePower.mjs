// The engine-power formulas of the Performance Calculations lesson (FAA-H-8083-32B, PDF pp. 48-57), in the units the handbook uses: inches,
// pounds, pounds per square inch, feet, cubic inches, revolutions per minute and horsepower. Pure, so the arithmetic is tested without a browser.
//
//   horsepower = work in ft-lb per minute / 33,000
//   piston area A = (pi / 4) x bore squared;  displacement of one cylinder = A x stroke
//   N, the power strokes per minute of one cylinder = rpm / 2 for a four-stroke engine
//   indicated horsepower   ihp = P L A N K / 33,000            (the word PLANK)
//   brake mean effective pressure   BMEP = bhp x 33,000 / (L A N K)
//   brake horsepower from a brake test   bhp = 2 pi x force on the scale x arm length x rpm / 33,000
//   friction horsepower fhp = ihp - bhp;  mechanical efficiency = bhp / ihp

export const FT_LB_PER_MIN_PER_HP = 33000;
const INCHES_PER_FOOT = 12;

/** The area of the piston head in square inches. @param {number} boreIn */
export const pistonArea = (boreIn) => (Math.PI / 4) * boreIn ** 2;

/** The volume one cylinder sweeps in one stroke, in cubic inches. */
export const cylinderDisplacement = (boreIn, strokeIn) => pistonArea(boreIn) * strokeIn;

/** The compression ratio from the swept and clearance volumes, in the same units: (swept + clearance) / clearance. */
export const compressionRatio = (sweptVolume, clearanceVolume) => (sweptVolume + clearanceVolume) / clearanceVolume;

/** The power strokes per minute of one cylinder of a four-stroke engine: one for every two turns of the crankshaft. @param {number} rpm */
export const powerStrokesPerMinute = (rpm) => rpm / 2;

/**
 * P L A N K / 33,000, where P is the indicated mean effective pressure (psi), L the stroke (in), A the piston area (sq in), N the power strokes
 * per minute of one cylinder and K the number of cylinders.
 * @param {{ pressurePsi: number, strokeIn: number, boreIn: number, rpm: number, cylinders: number }} engine
 */
export function indicatedHorsepower({ pressurePsi, strokeIn, boreIn, rpm, cylinders }) {
  const lengthFt = strokeIn / INCHES_PER_FOOT;
  return (pressurePsi * lengthFt * pistonArea(boreIn) * powerStrokesPerMinute(rpm) * cylinders) / FT_LB_PER_MIN_PER_HP;
}

/** The mean effective pressure that produces a given brake horsepower, from the same engine data. */
export function brakeMeanEffectivePressure({ bhp, strokeIn, boreIn, rpm, cylinders }) {
  const lengthFt = strokeIn / INCHES_PER_FOOT;
  return (bhp * FT_LB_PER_MIN_PER_HP) / (lengthFt * pistonArea(boreIn) * powerStrokesPerMinute(rpm) * cylinders);
}

/** Brake horsepower measured with a Prony brake: 2 pi x scale reading (lb) x arm (ft) x rpm / 33,000. */
export function pronyBrakeHorsepower({ scaleLb, armFt, rpm }) {
  return (2 * Math.PI * scaleLb * armFt * rpm) / FT_LB_PER_MIN_PER_HP;
}

export const frictionHorsepower = (ihp, bhp) => ihp - bhp;
export const mechanicalEfficiency = (bhp, ihp) => bhp / ihp;
/** Thrust horsepower of an engine and propeller together: the brake horsepower times the propeller's efficiency (0 to 1). */
export const thrustHorsepower = (bhp, propellerEfficiency) => bhp * propellerEfficiency;

/** The crankshaft speed from the propeller speed and a propeller drive ratio such as 0.667 (propeller turns per crankshaft turn). */
export const crankshaftRpm = (propellerRpm, driveRatio) => propellerRpm / driveRatio;

/** The share of the fuel's heat that becomes brake work, from the fuel burned: bhp x 33,000 per minute against pounds of fuel per minute x BTU per pound x 778 ft-lb per BTU. */
export function brakeThermalEfficiency({ bhp, fuelLbPerHour, btuPerLb }) {
  return (bhp * FT_LB_PER_MIN_PER_HP) / ((fuelLbPerHour / 60) * btuPerLb * 778);
}
