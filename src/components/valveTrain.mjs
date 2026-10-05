// The cam-lobe model behind the valve-lift interactive in lesson 9. Pure, so it is tested without a browser.
//
// One cam lobe lifts a valve once per four-stroke cycle. The cam turns at half the crankshaft's speed, so one full turn of the cam spans
// the cycle's 720 degrees of crank rotation, and everything here is measured in crank degrees. The lobe is drawn symmetrical about its
// nose: a gentle ramp on each flank eases the follower on and off, then the lift rises smoothly to its peak.

/** The crank angle (degrees from the start of the intake stroke) at which the drawn intake valve is lifted furthest. */
export const PEAK_CRANK = 80;
export const CYCLE_DEGREES = 720;

/**
 * @typedef {Object} LobeProfile
 * @property {number} lift - the most the follower is raised, in relative units
 * @property {number} durationCrank - how many degrees of crank rotation the valve is held off its seat
 * @property {number} rampFraction - the height the ramp reaches, as a fraction of the lift
 * @property {number} rampCrank - how many crank degrees each ramp lasts
 */

/** An angle brought into 0 up to (not including) a full cycle. @param {number} angle @param {number} [period] @returns {number} */
export function wrapDegrees(angle, period = CYCLE_DEGREES) {
  return ((angle % period) + period) % period;
}

/** How far `angle` is from the lobe's peak, in crank degrees, the short way round the cycle (always 0 to 360). */
export function distanceFromPeak(angle, peak = PEAK_CRANK) {
  const difference = wrapDegrees(angle - peak);
  return difference > CYCLE_DEGREES / 2 ? CYCLE_DEGREES - difference : difference;
}

/**
 * How far the valve is lifted at a crank angle: 0 on the base circle, the ramp height just as it opens, the full lift at the peak.
 * @param {LobeProfile} profile
 * @param {number} crank
 * @returns {number}
 */
export function camLift(profile, crank) {
  const half = profile.durationCrank / 2;
  const distance = distanceFromPeak(crank);
  if (distance >= half) return 0;
  const ramp = Math.min(profile.rampCrank, half);
  if (distance >= half - ramp) return profile.lift * profile.rampFraction * ((half - distance) / ramp);
  const body = half - ramp;
  return profile.lift * (profile.rampFraction + (1 - profile.rampFraction) * Math.cos((Math.PI * distance) / (2 * body)) ** 2);
}

/** The crank angles at which the valve leaves its seat and returns to it. @param {LobeProfile} profile */
export function openingWindow(profile) {
  return { opens: wrapDegrees(PEAK_CRANK - profile.durationCrank / 2), closes: wrapDegrees(PEAK_CRANK + profile.durationCrank / 2) };
}
