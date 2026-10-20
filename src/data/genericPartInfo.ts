/**
 * The general fallback for the part card of a model that has no learner part details yet (the part store, docs/part-store.md): a name,
 * a function line, a system guessed from the part's id and a stock material line.
 *
 * It holds no per-part values. The hand-written table that used to sit here (28 operating-cylinder entries with alloy specifications and
 * operating temperatures that no source read supported) was retired when the cylinder moved to the part store; what became of each of
 * its values is recorded there, in `engineering.legacyValues`. Every model that still reads this file is one that has not been given
 * definitions yet, and giving it some retires the fallback for that model.
 */

export interface GenericPartInfo {
  id: string;
  label: string;
  system: string;
  systemColor: string;
  function: string;
  /** A stock line, the same for every part: nothing here is a claim about the part. */
  material: string;
}

const SYSTEMS = {
  reciprocating: { name: 'Reciprocating assembly', color: '#f59e0b' },
  cylinder: { name: 'Cylinder assembly', color: '#38bdf8' },
  valvetrain: { name: 'Valve train', color: '#a78bfa' },
  ignition: { name: 'Ignition system', color: '#f472b6' },
  crankcase: { name: 'Crankcase & power output', color: '#34d399' },
  fuel: { name: 'Fuel & induction', color: '#fb923c' },
};

/**
 * Returns the general part information for any component id.
 * The GTSIO-520-H whole engine and the operating cylinder do not use this: their part cards read the learner part details (learnerPartDetails.ts).
 */
export function getGenericPartInfo(id: string, defaultLabel?: string, defaultFunction?: string): GenericPartInfo {
  let system: { name: string; color: string };
  if (/Valve|Rocker|Spring|Pushrod|Lifter|Keeper|Retainer/i.test(id)) system = SYSTEMS.valvetrain;
  else if (/Spark|Terminal|Insulator/i.test(id)) system = SYSTEMS.ignition;
  else if (/Piston|Pin|Rod|Crank|Bearing/i.test(id)) system = SYSTEMS.reciprocating;
  else if (/Cylinder|Head|Barrel/i.test(id)) system = SYSTEMS.cylinder;
  else if (/Fuel|Nozzle|Injector/i.test(id)) system = SYSTEMS.fuel;
  else system = SYSTEMS.crankcase;

  return {
    id,
    label: defaultLabel || id.replace(/([A-Z])/g, ' $1').trim(),
    system: system.name,
    systemColor: system.color,
    function: defaultFunction || 'Performs structural, mechanical, or thermodynamic duties in the engine assembly.',
    material: 'Aircraft-certified alloy specification',
  };
}
