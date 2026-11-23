/**
 * What the cycle overlay needs to know about each multi-cylinder engine, as data. Adding an engine is adding one entry here (or a
 * `cycleOverlay` block to its contract, which wins over this file); nothing in the drawing code names a part or an engine.
 *
 * An entry states only what cannot be read from the model:
 *   engineLabel      the name shown with the overlay
 *   firingOrder      cylinder ids in firing order, and `firingOrderBasis` says where that order comes from
 *   cyl1StartOttoDeg Otto angle (0 intake TDC, 360 firing TDC) of cylinder 1 at the motion's 0 %, from the contract's description of it
 *   cylinders        the cylinder ids; a template's {id} is the whole id, {n} its number and {bank} its letter ('3B' is n 3, bank B)
 *   parts            templates for each cylinder's parts, by role (piston and barrel are required; the rest are optional)
 *   crank            the crankshaft part, used to check the overlay points away from it
 *   ghost            what turns see-through to reveal the cylinders: literal part ids, templates per cylinder, and contract groups
 *   boreAxisHint     a model-space direction toward the heads, for a model whose valves and heads cannot say it (none needs it now)
 *   monosoupape / rotatingBarrels   behaviours that change what the overlay draws
 *
 * Every id an entry produces is checked against the published contract by scripts/test_multi_cylinder_cycle.mjs, so a renamed part or
 * a typo fails a test instead of silently dropping a cylinder.
 *
 * All timing, glow and airflow drawn from these are illustrative teaching visuals, not CFD or manufacturer test-cell data.
 */

const ids = (count) => Array.from({ length: count }, (_, i) => String(i + 1));
const withBanks = (banks, count) => banks.flatMap((bank) => ids(count).map((n) => `${n}${bank}`));

export const ENGINE_DECLARATIONS = {
  'gtsio520-h-r10-mechanism-study': {
    engineLabel: 'GTSIO-520-H · 6-cyl opposed',
    firingOrder: ['1', '4', '5', '2', '3', '6'],
    firingOrderBasis: 'contract: declared order 1-4-5-2-3-6, numbered from the rear',
    cyl1StartOttoDeg: 360,
    cylinders: ids(6),
    parts: {
      piston: 'Piston{id}',
      barrel: 'CylinderBarrel{id}',
      head: 'CylinderHead{id}',
      intakeValve: 'IntakeValve{id}',
      exhaustValve: 'ExhaustValve{id}',
    },
    crank: 'Crankshaft',
    ghost: {
      ids: ['CrankcaseLeft', 'CrankcaseRight'],
      perCylinder: ['CylinderBarrel{id}', 'CylinderHead{id}', 'IntakeRockerCover{id}', 'ExhaustRockerCover{id}'],
    },
  },

  'merlin-iii-operating-study-4': {
    engineLabel: 'Merlin III · V12',
    firingOrder: ['1A', '6B', '4A', '3B', '2A', '5B', '6A', '1B', '3A', '4B', '5A', '2B'],
    firingOrderBasis: 'contract: follows the reviewed sources (the order itself is not written in the contract text)',
    cyl1StartOttoDeg: 360,
    cylinders: withBanks(['A', 'B'], 6),
    parts: {
      piston: 'Piston{bank}_{n}',
      barrel: 'Liner{bank}_{n}',
      intakeValve: 'Valve{bank}_{n}_Inlet_1',
      exhaustValve: 'Valve{bank}_{n}_Exhaust_1',
      spark: 'SparkPlug{bank}_{n}_Inlet',
    },
    crank: 'Crankshaft',
    ghost: {
      ids: ['UpperCrankcase', 'LowerCrankcase', 'BlockA', 'BlockB', 'CamCoverA', 'CamCoverB'],
      perCylinder: ['Liner{bank}_{n}'],
    },
  },

  'gnome-monosoupape-1913': {
    engineLabel: '1913 Gnome Monosoupape · 9-cyl rotary',
    firingOrder: ['1', '3', '5', '7', '9', '2', '4', '6', '8'],
    firingOrderBasis: 'contract: 1-3-5-7-9-2-4-6-8 follows the sources',
    cyl1StartOttoDeg: 360,
    cylinders: ids(9),
    parts: {
      piston: 'Piston{id}',
      barrel: 'Cylinder{id}',
      intakeValve: 'OverheadValve{id}',
      exhaustValve: 'OverheadValve{id}',
      spark: 'SparkPlug{id}',
    },
    crank: 'CrankshaftRear',
    // Group 'case' is the front and rear crankcase halves, their tie bolts and covers.
    ghost: { ids: [], perCylinder: ['Cylinder{id}'], groups: ['case'] },
    monosoupape: true,
    rotatingBarrels: true,
  },

  'langley-manly-balzer-1903': {
    engineLabel: '1903 Langley-Manly-Balzer · 5-cyl radial',
    firingOrder: ['1', '3', '5', '2', '4'],
    firingOrderBasis: 'contract: 1-3-5-2-4 follows the sources',
    cyl1StartOttoDeg: 0,
    cylinders: ids(5),
    parts: {
      piston: 'Piston{id}',
      barrel: 'CylLiner{id}',
      intakeValve: 'InletValve{id}',
      exhaustValve: 'ExhaustValve{id}',
      spark: 'PlugElectrode{id}',
    },
    crank: 'Crankshaft',
    ghost: { ids: [], perCylinder: ['CylLiner{id}'] },
  },

  'wright-1903-reconstruction': {
    engineLabel: '1903 Wright Flyer · 4-cyl inline',
    firingOrder: ['1', '3', '4', '2'],
    firingOrderBasis: 'contract: a teaching choice (illustrative)',
    cyl1StartOttoDeg: 360,
    cylinders: ids(4),
    parts: {
      piston: 'Piston{id}',
      barrel: 'Sleeve{id}',
      head: 'ValveBox{id}',
      intakeValve: 'IntakeHead{id}',
      exhaustValve: 'ExhaustHead{id}',
    },
    crank: 'Crankshaft',
    // The crankcase, its steel top closure ('cover') and the hot plate, air can and manifold ('induction') are the casing that hides the
    // bores from above.
    ghost: { ids: [], perCylinder: ['Sleeve{id}', 'ValveBox{id}'], groups: ['crankcase', 'cover', 'cylinders', 'valve_boxes', 'induction'] },
  },
};
