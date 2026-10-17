/**
 * Engineering metadata for piston engine components:
 * Material specifications, operating conditions, functional roles, and interconnections.
 * Based on Continental GTSIO-520 / aircraft piston engine maintenance standards and technical specifications.
 */

import { GTSIO_PART_ARCHETYPES } from './gtsioPartArchetypes.ts';

export interface ComponentEngineeringData {
  id: string;
  label: string;
  system: string;
  systemColor: string;
  function: string;
  material: string;
  partNumber?: string;
  source?: string;
  operatingConditions?: string;
  connectedParts?: { id: string; label: string }[];
}

const SYSTEMS = {
  reciprocating: { name: 'Reciprocating assembly', color: '#f59e0b' },
  cylinder: { name: 'Cylinder assembly', color: '#38bdf8' },
  valvetrain: { name: 'Valve train', color: '#a78bfa' },
  ignition: { name: 'Ignition system', color: '#f472b6' },
  crankcase: { name: 'Crankcase & power output', color: '#34d399' },
  fuel: { name: 'Fuel & induction', color: '#fb923c' },
  lubrication: { name: 'Lubrication system', color: '#10b981' },
  reduction: { name: 'Reduction gear & propeller drive', color: '#06b6d4' },
};

export const COMPONENT_METADATA: Record<string, Partial<ComponentEngineeringData>> = {
  CylinderBarrel: {
    system: SYSTEMS.cylinder.name,
    systemColor: SYSTEMS.cylinder.color,
    material: 'Forged chrome-molybdenum alloy steel (AMS 6382), nitrided bore',
    operatingConditions: 'Inner wall exposed to combustion flame; outer fin temp 180–230 °C',
    connectedParts: [
      { id: 'CylinderHead', label: 'Cylinder head' },
      { id: 'PistonBody', label: 'Piston body' },
    ],
  },
  CylinderHead: {
    system: SYSTEMS.cylinder.name,
    systemColor: SYSTEMS.cylinder.color,
    material: 'Cast aluminum alloy (A355-T61) with shrunk-in bronze guides & steel seats',
    operatingConditions: 'Direct combustion chamber boundary; peak temp around exhaust port 220–250 °C',
    connectedParts: [
      { id: 'CylinderBarrel', label: 'Cylinder barrel' },
      { id: 'IntakeValve', label: 'Intake valve' },
      { id: 'ExhaustValve', label: 'Exhaust valve' },
      { id: 'UpperSparkPlug', label: 'Spark plugs' },
    ],
  },
  CrankThrow: {
    system: SYSTEMS.reciprocating.name,
    systemColor: SYSTEMS.reciprocating.color,
    material: 'Vacuum-arc remelted forged alloy steel, nitrided journal surface',
    operatingConditions: 'Rotational speeds up to 3,200 rpm (geared output); transmits combined cycle torque',
    connectedParts: [
      { id: 'ConnectingRodBody', label: 'Connecting rod' },
      { id: 'BigEndBearing', label: 'Crankpin bearing' },
    ],
  },
  ConnectingRodBody: {
    system: SYSTEMS.reciprocating.name,
    systemColor: SYSTEMS.reciprocating.color,
    material: 'Forged H-section alloy steel, shot-peened for fatigue endurance',
    operatingConditions: 'Alternating tension/compression loads exceeding 35 kN per power stroke',
    connectedParts: [
      { id: 'PistonBody', label: 'Piston body' },
      { id: 'CrankThrow', label: 'Crankshaft throw' },
      { id: 'ConnectingRodCap', label: 'Rod cap' },
    ],
  },
  ConnectingRodCap: {
    system: SYSTEMS.reciprocating.name,
    systemColor: SYSTEMS.reciprocating.color,
    material: 'Matched forged alloy steel forging with precision doweled alignment',
    operatingConditions: 'Clamped by high-tensile rod bolts to secure crankpin bearing shells',
    connectedParts: [{ id: 'ConnectingRodBody', label: 'Connecting rod body' }],
  },
  BigEndBearing: {
    system: SYSTEMS.reciprocating.name,
    systemColor: SYSTEMS.reciprocating.color,
    material: 'Steel-backed copper-lead lining with lead-tin electroplated babbitt overlay',
    operatingConditions: 'Hydrodynamic oil film lubrication under continuous dynamic loads',
    connectedParts: [
      { id: 'ConnectingRodBody', label: 'Connecting rod' },
      { id: 'CrankThrow', label: 'Crankpin' },
    ],
  },
  CapBearingHalf: {
    system: SYSTEMS.reciprocating.name,
    systemColor: SYSTEMS.reciprocating.color,
    material: 'Steel-backed trimetal copper-lead alloy shell',
    operatingConditions: 'Hydrodynamic bearing film under inertial tension during exhaust/intake strokes',
    connectedParts: [{ id: 'ConnectingRodCap', label: 'Rod cap' }],
  },
  FloatingPin: {
    system: SYSTEMS.reciprocating.name,
    systemColor: SYSTEMS.reciprocating.color,
    material: 'Case-hardened low-carbon alloy steel, ground and micro-honed',
    operatingConditions: 'Full-floating pin oscillating in piston bosses and rod small-end bushing',
    connectedParts: [
      { id: 'PistonBody', label: 'Piston body' },
      { id: 'ConnectingRodBody', label: 'Connecting rod' },
      { id: 'PinPlugLeft', label: 'Aluminum pin plugs' },
    ],
  },
  PinPlugLeft: {
    system: SYSTEMS.reciprocating.name,
    systemColor: SYSTEMS.reciprocating.color,
    material: 'Soft aluminum alloy plug',
    operatingConditions: 'Prevents steel wrist pin from contacting and scoring the cylinder barrel wall',
    connectedParts: [{ id: 'FloatingPin', label: 'Wrist pin' }],
  },
  PinPlugRight: {
    system: SYSTEMS.reciprocating.name,
    systemColor: SYSTEMS.reciprocating.color,
    material: 'Soft aluminum alloy plug',
    operatingConditions: 'Prevents steel wrist pin from contacting and scoring the cylinder barrel wall',
    connectedParts: [{ id: 'FloatingPin', label: 'Wrist pin' }],
  },
  PistonBody: {
    system: SYSTEMS.reciprocating.name,
    systemColor: SYSTEMS.reciprocating.color,
    material: 'Forged aluminum alloy (Al-Cu-Mg-Ni, 2618-T61) with cam-ground skirt',
    operatingConditions: 'Crown exposed to gas temps > 1,800 °C, crown metal temp up to 300 °C',
    connectedParts: [
      { id: 'FloatingPin', label: 'Gudgeon / wrist pin' },
      { id: 'CylinderBarrel', label: 'Cylinder barrel' },
      { id: 'PistonRing1', label: 'Compression rings' },
    ],
  },
  PistonRing1: {
    system: SYSTEMS.reciprocating.name,
    systemColor: SYSTEMS.reciprocating.color,
    material: 'High-grade ductile cast iron, hard chrome-plated running face, keystone profile',
    operatingConditions: 'Top compression ring sealing peak gas pressure and conducting crown heat to wall',
    connectedParts: [{ id: 'PistonBody', label: 'Piston' }, { id: 'CylinderBarrel', label: 'Barrel' }],
  },
  PistonRing2: {
    system: SYSTEMS.reciprocating.name,
    systemColor: SYSTEMS.reciprocating.color,
    material: 'Cast iron with tapered face (second compression / scraper ring)',
    operatingConditions: 'Secondary pressure seal and oil control wiper',
    connectedParts: [{ id: 'PistonBody', label: 'Piston' }],
  },
  PistonRing3: {
    system: SYSTEMS.reciprocating.name,
    systemColor: SYSTEMS.reciprocating.color,
    material: 'Slotted cast iron oil control ring with internal expander spring',
    operatingConditions: 'Regulates oil film thickness on cylinder barrel during reciprocating travel',
    connectedParts: [{ id: 'PistonBody', label: 'Piston' }],
  },
  PistonRing4: {
    system: SYSTEMS.reciprocating.name,
    systemColor: SYSTEMS.reciprocating.color,
    material: 'Lower skirt oil scraper ring',
    operatingConditions: 'Returns excess splash oil to the crankcase sump',
    connectedParts: [{ id: 'PistonBody', label: 'Piston' }],
  },
  IntakeValve: {
    system: SYSTEMS.valvetrain.name,
    systemColor: SYSTEMS.valvetrain.color,
    material: 'Chromium-nickel alloy steel (silchrome steel) with cobalt stellite seat face',
    operatingConditions: 'Cooled by incoming fuel-air charge; head temp approx. 350–450 °C',
    connectedParts: [
      { id: 'IntakeSeatInsert', label: 'Seat insert' },
      { id: 'IntakeRockerArm', label: 'Rocker arm' },
      { id: 'IntakeOuterSpring', label: 'Valve spring' },
    ],
  },
  ExhaustValve: {
    system: SYSTEMS.valvetrain.name,
    systemColor: SYSTEMS.valvetrain.color,
    material: 'Austenitic heat-resisting steel, sodium-cooled hollow stem, Stellite-faced face and tip',
    operatingConditions: 'Exhaust stream up to 850 °C; sodium transfers heat from head to guide',
    connectedParts: [
      { id: 'ExhaustSeatInsert', label: 'Exhaust seat' },
      { id: 'ExhaustRockerArm', label: 'Rocker arm' },
      { id: 'ExhaustOuterSpring', label: 'Dual valve springs' },
    ],
  },
  IntakeSeatInsert: {
    system: SYSTEMS.cylinder.name,
    systemColor: SYSTEMS.cylinder.color,
    material: 'Hardened aluminum-bronze or alloy steel shrunk into heated aluminum head',
    operatingConditions: 'Provides precision sealing surface and thermal transfer path for valve head',
    connectedParts: [{ id: 'IntakeValve', label: 'Intake valve' }],
  },
  ExhaustSeatInsert: {
    system: SYSTEMS.cylinder.name,
    systemColor: SYSTEMS.cylinder.color,
    material: 'High-alloy cobalt-base heat-resisting insert (Stellite alloy)',
    operatingConditions: 'Withstands repetitive exhaust valve impacts at elevated temperature',
    connectedParts: [{ id: 'ExhaustValve', label: 'Exhaust valve' }],
  },
  IntakeRockerArm: {
    system: SYSTEMS.valvetrain.name,
    systemColor: SYSTEMS.valvetrain.color,
    material: 'Drop-forged steel with hardened roller or contact toe, pressure-fed bronze bushing',
    operatingConditions: 'Translates pushrod linear rise into downward intake valve depression',
    connectedParts: [
      { id: 'IntakePushrod', label: 'Pushrod' },
      { id: 'IntakeValve', label: 'Intake valve stem' },
      { id: 'IntakeRockerShaft', label: 'Rocker shaft' },
    ],
  },
  ExhaustRockerArm: {
    system: SYSTEMS.valvetrain.name,
    systemColor: SYSTEMS.valvetrain.color,
    material: 'Forged alloy steel with case-hardened contact pads',
    operatingConditions: 'Actuates heavy-duty exhaust valve against dual valve spring pressure',
    connectedParts: [
      { id: 'ExhaustPushrod', label: 'Pushrod' },
      { id: 'ExhaustValve', label: 'Exhaust valve stem' },
    ],
  },
  IntakePushrod: {
    system: SYSTEMS.valvetrain.name,
    systemColor: SYSTEMS.valvetrain.color,
    material: 'Seamless alloy steel tubular rod with case-hardened ball ends and central oil passage',
    operatingConditions: 'Transmits cam follower motion to cylinder head; conveys engine oil to rockers',
    connectedParts: [
      { id: 'IntakeHydraulicLifterBody', label: 'Hydraulic tappet' },
      { id: 'IntakeRockerArm', label: 'Rocker arm' },
    ],
  },
  ExhaustPushrod: {
    system: SYSTEMS.valvetrain.name,
    systemColor: SYSTEMS.valvetrain.color,
    material: 'Hollow steel pushrod with through-drilled lubrication conduit',
    operatingConditions: 'Operates in compressive column loading during exhaust valve opening',
    connectedParts: [
      { id: 'ExhaustHydraulicLifterBody', label: 'Hydraulic tappet' },
      { id: 'ExhaustRockerArm', label: 'Rocker arm' },
    ],
  },
  IntakeHydraulicLifterBody: {
    system: SYSTEMS.valvetrain.name,
    systemColor: SYSTEMS.valvetrain.color,
    material: 'Cast chilled iron body with hardened plunger and check ball valve',
    operatingConditions: 'Maintains zero valve lash automatically using pressurized engine oil',
    connectedParts: [{ id: 'IntakePushrod', label: 'Pushrod' }],
  },
  ExhaustHydraulicLifterBody: {
    system: SYSTEMS.valvetrain.name,
    systemColor: SYSTEMS.valvetrain.color,
    material: 'Chilled iron body riding on camshaft exhaust lobe',
    operatingConditions: 'Eliminates thermal valve clearance variations from cold start to redline',
    connectedParts: [{ id: 'ExhaustPushrod', label: 'Pushrod' }],
  },
  UpperSparkPlug: {
    system: SYSTEMS.ignition.name,
    systemColor: SYSTEMS.ignition.color,
    material: 'High-tensile steel shell, nickel-alloy or platinum electrodes, alumina ceramic core',
    operatingConditions: 'Dual-spark ignition firing up to 25 kV spark at 20–25 times per second at cruise',
    connectedParts: [{ id: 'CylinderHead', label: 'Cylinder head' }],
  },
  LowerSparkPlug: {
    system: SYSTEMS.ignition.name,
    systemColor: SYSTEMS.ignition.color,
    material: 'Heavy-duty shielded aviation spark plug with 18 mm thread',
    operatingConditions: 'Lower dual ignition circuit fired by independent engine magneto',
    connectedParts: [{ id: 'CylinderHead', label: 'Cylinder head' }],
  },
  FuelDischargeNozzle: {
    system: SYSTEMS.fuel.name,
    systemColor: SYSTEMS.fuel.color,
    material: 'Precision-machined brass with calibrated metering orifice and air-bleed screen',
    operatingConditions: 'Continuous low-pressure fuel atomization into intake valve port',
    connectedParts: [{ id: 'CylinderHead', label: 'Intake port' }],
  },
};

/**
 * Returns complete, structured engineering metadata for any component id.
 * Uses verified engineering register when available, and generates consistent engineering defaults otherwise.
 */
export function getComponentMetadata(id: string, defaultLabel?: string, defaultFunction?: string): ComponentEngineeringData {
  const registered = COMPONENT_METADATA[id];
  if (registered && registered.function) {
    return {
      id,
      label: registered.label || defaultLabel || id.replace(/([A-Z])/g, ' $1').trim(),
      system: registered.system || 'Engine Assembly',
      systemColor: registered.systemColor || '#2dd4bf',
      function: registered.function || defaultFunction || 'Performs structural, mechanical, or thermodynamic duties in the engine assembly.',
      material: registered.material || 'Aircraft-certified alloy specification',
      operatingConditions: registered.operatingConditions,
      connectedParts: registered.connectedParts,
      partNumber: registered.partNumber,
      source: registered.source,
    };
  }

  // Archetype matching for Continental GTSIO-520-H engine assembly components
  for (const rule of GTSIO_PART_ARCHETYPES) {
    if (rule.pattern.test(id)) {
      const sysObj = SYSTEMS[rule.system] || SYSTEMS.crankcase;

      // Extract cylinder, throw, left/right or instance numbers
      const cylMatch = id.match(/(?:Cylinder|Cyl|Piston|Rod|Pin|Deck|Plug|Valve|Rocker|Spring|Seat|Guide|Cover|Shroud|Housing|Ring)(\d)/i);
      const throwMatch = id.match(/(?:Throw|Cheek|Journal)(\d)/i);
      const isLeft = /\bLeft\b|Left(?=[A-Z0-9])/i.test(id);
      const isRight = /\bRight\b|Right(?=[A-Z0-9])/i.test(id);
      const lrStr = isLeft ? ' (Left)' : isRight ? ' (Right)' : '';

      let label = defaultLabel || rule.name;
      if (!defaultLabel) {
        if (cylMatch) {
          label = `${rule.name} (Cylinder ${cylMatch[1]})${lrStr}`;
        } else if (throwMatch) {
          label = `${rule.name} (Throw ${throwMatch[1]})${lrStr}`;
        } else if (lrStr) {
          label = `${rule.name}${lrStr}`;
        } else {
          const numMatch = id.match(/(\d+)$/);
          if (numMatch) {
            label = `${rule.name} #${numMatch[1]}`;
          }
        }
      }

      return {
        id,
        label,
        system: sysObj.name,
        systemColor: sysObj.color,
        function: rule.function,
        material: rule.material,
        partNumber: rule.partNumber,
        source: rule.source,
        operatingConditions: rule.operatingConditions,
      };
    }
  }

  let system = registered?.system;
  let systemColor = registered?.systemColor;

  if (!system) {
    if (/Valve|Rocker|Spring|Pushrod|Lifter|Keeper|Retainer/i.test(id)) {
      system = SYSTEMS.valvetrain.name;
      systemColor = SYSTEMS.valvetrain.color;
    } else if (/Spark|Terminal|Insulator/i.test(id)) {
      system = SYSTEMS.ignition.name;
      systemColor = SYSTEMS.ignition.color;
    } else if (/Piston|Pin|Rod|Crank|Bearing/i.test(id)) {
      system = SYSTEMS.reciprocating.name;
      systemColor = SYSTEMS.reciprocating.color;
    } else if (/Cylinder|Head|Barrel/i.test(id)) {
      system = SYSTEMS.cylinder.name;
      systemColor = SYSTEMS.cylinder.color;
    } else if (/Fuel|Nozzle|Injector/i.test(id)) {
      system = SYSTEMS.fuel.name;
      systemColor = SYSTEMS.fuel.color;
    } else {
      system = SYSTEMS.crankcase.name;
      systemColor = SYSTEMS.crankcase.color;
    }
  }

  const label = registered?.label || defaultLabel || id.replace(/([A-Z])/g, ' $1').trim();
  const func = registered?.function || defaultFunction || 'Performs structural, mechanical, or thermodynamic duties in the engine assembly.';
  const material = registered?.material || 'Aircraft-certified alloy specification';

  return {
    id,
    label,
    system: system || 'Engine Assembly',
    systemColor: systemColor || '#2dd4bf',
    function: func,
    material,
    operatingConditions: registered?.operatingConditions,
    connectedParts: registered?.connectedParts,
    partNumber: registered?.partNumber,
    source: registered?.source,
  };
}
