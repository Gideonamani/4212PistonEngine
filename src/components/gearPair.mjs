// The gear model behind the gear explorer in lesson 9 (Accessories and Drives). Pure, so it is tested without a browser.
//
// Two spur gears on parallel shafts mesh like two wheels rolling on each other without slipping: the rims move at the same speed, so the
// gear with fewer teeth turns faster, in proportion to the teeth. Each mesh reverses the direction of rotation, so an idler gear between
// the two turns the driven gear the same way as the driver without changing the speed ratio. The sizes and the shapes are schematic.

/** The tooth counts the explorer offers for the driver and the driven gear. */
export const TEETH_CHOICES = [12, 18, 24, 36];
/** The idler between them, when it is added. */
export const IDLER_TEETH = 18;
/** The distance along the pitch circle from one tooth to the next, in drawing units, the same for every gear so that they mesh. */
export const PITCH = 14;

/** How fast the driven gear turns compared with the driver: driver teeth over driven teeth. An idler does not change it. */
export function speedRatio(driverTeeth, drivenTeeth) {
  return driverTeeth / drivenTeeth;
}

/** The driven gear's speed for a given driver speed (any unit). */
export function drivenSpeed(driverSpeed, driverTeeth, drivenTeeth) {
  return driverSpeed * speedRatio(driverTeeth, drivenTeeth);
}

/** True when the driven gear turns the opposite way to the driver: each mesh reverses the direction, so an even number of idlers (0, 2) does. */
export function turnsOpposite(idlers) {
  return idlers % 2 === 0;
}

/** The driven gear's angle (degrees, clockwise positive) when the driver has turned `driverAngle`. */
export function drivenAngle(driverAngle, driverTeeth, drivenTeeth, idlers = 0) {
  return (turnsOpposite(idlers) ? -1 : 1) * driverAngle * speedRatio(driverTeeth, drivenTeeth);
}

/** The idler's angle: one mesh with the driver, so it turns the opposite way at the driver's tooth count over its own. */
export function idlerAngle(driverAngle, driverTeeth, idlerTeeth = IDLER_TEETH) {
  return -driverAngle * speedRatio(driverTeeth, idlerTeeth);
}

/** The radius of the pitch circle (where two gears roll on each other) for a gear with this many teeth. */
export function pitchRadius(teeth, pitch = PITCH) {
  return (teeth * pitch) / (2 * Math.PI);
}

/**
 * The outline of a gear as an SVG path, centred on (0, 0), with tooth number 0 pointing along +x (to the right) and the angles running
 * clockwise on the screen. A tooth is a trapezoid; the gap between two teeth is centred half a pitch angle from a tooth.
 */
export function gearPath(teeth, depth = 5, pitch = PITCH) {
  const radius = pitchRadius(teeth, pitch);
  const step = (2 * Math.PI) / teeth;
  const point = (angle, r) => `${(r * Math.cos(angle)).toFixed(1)},${(r * Math.sin(angle)).toFixed(1)}`;
  const commands = [];
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const centre = tooth * step;
    commands.push(point(centre - 0.26 * step, radius - depth), point(centre - 0.13 * step, radius + depth), point(centre + 0.13 * step, radius + depth), point(centre + 0.26 * step, radius - depth));
  }
  return `M${commands.join('L')}Z`;
}

/**
 * The angle (degrees) a gear is turned from the position in which its tooth 0 points at its neighbour, so that the teeth of the two gears
 * interleave. The driver sits on the left with tooth 0 pointing at the next gear at angle 0; the next gear faces it at 180 degrees and
 * shows a gap there, so it starts half a pitch round. An idler is turned the same way. The driven gear that follows an idler starts with
 * a tooth where the idler has a gap, so it is not turned. The tooth counts must be even, as every choice in this file is.
 */
export function startPhase(teeth, followsIdler = false) {
  return followsIdler ? 0 : 180 / teeth;
}
