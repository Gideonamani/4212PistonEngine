import { ENGINE_DECLARATIONS } from './engine-declarations.mjs';

const wrap720 = (deg) => ((Number(deg) || 0) % 720 + 720) % 720;

/** `{id}` is a cylinder's whole id, `{n}` its number and `{bank}` its bank letter, so '3B' fills 'Liner{bank}_{n}' as 'LinerB_3'. */
export function fillTemplate(template, cylinderId) {
  const n = /^\d+/.exec(cylinderId)?.[0] ?? cylinderId;
  const bank = /[^\d].*$/.exec(cylinderId)?.[0] ?? '';
  return template.replaceAll('{id}', cylinderId).replaceAll('{n}', n).replaceAll('{bank}', bank);
}

const ROLE_FIELDS = {
  piston: 'pistonId',
  barrel: 'barrelId',
  head: 'headId',
  intakeValve: 'intakeValveId',
  exhaustValve: 'exhaustValveId',
  spark: 'sparkId',
};

/**
 * Turn an engine's declaration into the spec the overlay runs on: each cylinder's part ids filled in from the templates, its firing
 * phase from the firing order (cylinders fire evenly through 720 degrees), and the set of parts to make see-through.
 * `contract` is optional; with it, ids that are not parts of the model are left out of the ghost set.
 */
export function makeSpec(declaration, contract) {
  const {
    engineLabel, cycleType = 'otto', firingOrder, cyl1StartOttoDeg = 360, cylinders: cylinderIds, parts = {}, crank, ghost = {},
    boreAxisHint, monosoupape = false, rotatingBarrels = false,
  } = declaration;
  const interval = 720 / firingOrder.length;
  const phaseById = Object.fromEntries(firingOrder.map((id, idx) => [id, idx * interval]));
  const cylinders = cylinderIds.map((id) => ({
    id,
    label: /^\d+$/.test(id) ? `Cyl ${id}` : id,
    ...Object.fromEntries(Object.entries(ROLE_FIELDS).flatMap(([role, field]) => (parts[role] ? [[field, fillTemplate(parts[role], id)]] : []))),
    firingPhaseDeg: phaseById[id] ?? 0,
  }));

  const partList = contract?.parts || [];
  const partIds = new Set(partList.map((p) => p.id));
  const wanted = new Set(ghost.ids || []);
  for (const cyl of cylinders) for (const template of ghost.perCylinder || []) wanted.add(fillTemplate(template, cyl.id));
  const groups = new Set(ghost.groups || []);
  for (const part of partList) if (groups.has(part.group)) wanted.add(part.id);
  // A motion may name more parts to see through (the engine's own authored cutaway); keep them so the overlay and the motion agree.
  for (const motion of contract?.motions || []) for (const id of motion?.display?.ghostPartIds || []) wanted.add(id);

  return {
    engineLabel,
    cycleType,
    firingOrder,
    firingOrderBasis: declaration.firingOrderBasis,
    cyl1StartOttoDeg,
    monosoupape,
    rotatingBarrels,
    crankId: crank,
    boreAxisHint,
    ghostPartIds: partIds.size ? [...wanted].filter((id) => partIds.has(id)) : [...wanted],
    cylinders,
  };
}

/**
 * Return a multi-cylinder cycle specification for an animated-study model, or undefined if the model is not a multi-cylinder engine
 * (the hydraulic tappet, oil pump and accessory drives are not). A `cycleOverlay` block in the model's contract wins over the
 * declaration in engine-declarations.mjs, so a model can bring its own.
 */
export function multiCylinderSpec(modelId, contract) {
  const overlay = contract?.cycleOverlay;
  if (overlay?.cylinders?.length) return explicitSpec(overlay, contract);
  const declaration = ENGINE_DECLARATIONS[modelId];
  return declaration ? makeSpec(declaration, contract) : undefined;
}

/** A contract's own `cycleOverlay`: the cylinders are written out part by part, so only the phases and the ghost set are worked out. */
function explicitSpec(overlay, contract) {
  const firingOrder = overlay.firingOrder || overlay.cylinders.map((c) => c.id);
  const interval = 720 / firingOrder.length;
  const phaseById = Object.fromEntries(firingOrder.map((id, idx) => [id, idx * interval]));
  const partIds = new Set((contract?.parts || []).map((p) => p.id));
  return {
    engineLabel: overlay.engineLabel,
    cycleType: overlay.cycleType || 'otto',
    firingOrder,
    cyl1StartOttoDeg: overlay.cyl1StartOttoDeg ?? 360,
    monosoupape: Boolean(overlay.monosoupape),
    rotatingBarrels: Boolean(overlay.rotatingBarrels),
    crankId: overlay.crankId,
    boreAxisHint: overlay.boreAxisHint,
    ghostPartIds: (overlay.ghostPartIds || []).filter((id) => !partIds.size || partIds.has(id)),
    cylinders: overlay.cylinders.map((c) => ({ ...c, firingPhaseDeg: phaseById[c.id] ?? 0 })),
  };
}

/**
 * Local 0..720° Otto cycle angle of a specific cylinder given the engine's 0..720° crank angle.
 * Convention matches `otto-cycle.mjs`: 0° Intake TDC, 180° BDC, 360° Firing/Power TDC, 540° Exhaust BDC.
 */
export function cylinderOttoAngle(crankAngleDeg, spec, cylinderId) {
  const cyl = spec.cylinders.find((c) => c.id === cylinderId) ?? spec.cylinders[0];
  return wrap720(crankAngleDeg + spec.cyl1StartOttoDeg - (cyl?.firingPhaseDeg ?? 0));
}

/**
 * Inverse of `cylinderOttoAngle`: return the engine's 0..720° crank angle that places
 * `cylinderId` at `targetOttoDeg`.
 */
export function crankAngleForCylinderOtto(targetOttoDeg, spec, cylinderId) {
  const cyl = spec.cylinders.find((c) => c.id === cylinderId) ?? spec.cylinders[0];
  return wrap720(targetOttoDeg - spec.cyl1StartOttoDeg + (cyl?.firingPhaseDeg ?? 0));
}

/** Stroke classification for a 0..720° Otto angle. */
export function ottoStrokeOf(angleDeg) {
  const a = wrap720(angleDeg);
  if (a < 180) return 'intake';
  if (a < 360) return 'compression';
  if (a < 540) return 'power';
  return 'exhaust';
}

/**
 * Ordered firing-sequence status list for the UI firing-order strip.
 * Each item reports its live local angle, stroke name, and whether it is actively firing (~340°..395°).
 */
export function firingOrderSummary(crankAngleDeg, spec) {
  const byId = new Map(spec.cylinders.map((c) => [c.id, c]));
  return spec.firingOrder.map((id) => {
    const cyl = byId.get(id);
    const angleDeg = cylinderOttoAngle(crankAngleDeg, spec, id);
    const stroke = ottoStrokeOf(angleDeg);
    const firing = angleDeg >= 335 && angleDeg <= 395;
    return {
      id,
      label: cyl?.label ?? id,
      angleDeg,
      stroke,
      firing,
    };
  });
}

/**
 * Map a tapped 3D part ID back to its owning cylinder ID, if any.
 */
export function cylinderForPartId(spec, partId) {
  if (!spec || !partId) return undefined;
  for (const cyl of spec.cylinders) {
    if (
      partId === cyl.pistonId
      || partId === cyl.barrelId
      || partId === cyl.headId
      || partId === cyl.intakeValveId
      || partId === cyl.exhaustValveId
      || partId === cyl.sparkId
    ) {
      return cyl.id;
    }
  }
  return undefined;
}
