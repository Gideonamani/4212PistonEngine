/**
 * Illustrative fluid-flow & torque-path specifications for non-engine mechanical studies:
 *  - Hydraulic tappet (`hydraulic-tappet`)
 *  - Oil pump and relief valve (`oil-pump`)
 *  - Accessories and drives (`accessory-drives`)
 *
 * Pure data and phase-state logic (no Three.js import) so Node unit tests can validate every part ID and motion phase directly against
 * the published contracts in `web/`.
 *
 * A study is described by its `kind` (which drawing it uses: a hydraulic lifter, a gear pump, a gear train) and by `parts`, the part ids
 * that fill that kind's roles. The drawing code names no part, so a second model of the same kind (the GTSIO's lifters, its scavenge pump)
 * is one more entry here with its own ids. A contract may carry its own `mechanismFlow` block, which wins over the entry below.
 */

const clamp01 = (v) => Math.max(0, Math.min(1, Number(v) || 0));

const SPECS = {
  'hydraulic-tappet': {
    kind: 'hydraulic-tappet',
    label: 'Oil flow & hydraulic lock',
    subtitle: 'Gallery supply, check-valve seal & trapped-oil chamber (illustrative)',
    ghostPartIds: ['LifterBody'],
    lightGhostPartIds: ['Plunger'],
    flowMotionPattern: /operating/i,
    parts: {
      body: 'LifterBody',
      plunger: 'Plunger',
      plungerSpring: 'PlungerSpring',
      checkHousing: 'CheckHousing',
      checkPlate: 'CheckPlate',
      socket: 'Socket',
    },
  },
  'oil-pump': {
    kind: 'oil-pump',
    label: 'Oil flow & relief bypass',
    subtitle: 'Outer gear-pocket pumping path & relief-valve bypass (illustrative)',
    ghostPartIds: ['PumpHousing', 'PumpCover', 'ReliefHousing'],
    lightGhostPartIds: [],
    flowMotionPattern: /operating|relief/i,
    parts: {
      housing: 'PumpHousing',
      cover: 'PumpCover',
      driveGear: 'DriveGear',
      drivenGear: 'DrivenGear',
      driveShaft: 'DriveShaft',
      drivenShaft: 'DrivenShaft',
      reliefHousing: 'ReliefHousing',
      reliefPlunger: 'ReliefPlunger',
      reliefSpring: 'ReliefSpring',
    },
  },
  'accessory-drives': {
    kind: 'accessory-drives',
    label: 'Torque flow & cutaway housing',
    subtitle: 'Ghost accessory case & animate power paths from crankshaft gear (illustrative)',
    ghostPartIds: ['AccessoryHousing', 'HousingCover', 'OilHousing', 'OilCover', 'TachPadCover', 'StarterCover'],
    lightGhostPartIds: [],
    flowMotionPattern: /operating|focus|starter/i,
    // The drive train is read from the contract's powerPaths and gearMeshes, so no part ids are listed here.
    parts: {},
  },
};

/**
 * Return the mechanism flow specification for a non-engine mechanical model, or undefined. A contract's own `mechanismFlow` block
 * (same fields as an entry above, with `flowMotionPattern` as a source string) wins over the entry here.
 */
export function mechanismFlowSpec(modelId, contract) {
  const own = contract?.mechanismFlow;
  const base = own?.kind
    ? { ghostPartIds: [], lightGhostPartIds: [], parts: {}, ...own, flowMotionPattern: new RegExp(own.flowMotionPattern || 'operating', 'i') }
    : SPECS[modelId];
  if (!base) return undefined;
  const partIds = new Set((contract?.parts || []).map((p) => p.id));
  return {
    ...base,
    ghostPartIds: partIds.size ? base.ghostPartIds.filter((id) => partIds.has(id)) : [...base.ghostPartIds],
    lightGhostPartIds: partIds.size ? base.lightGhostPartIds.filter((id) => partIds.has(id)) : [...base.lightGhostPartIds],
  };
}

/** Whether a given saved motion on this mechanical model should display live fluid/torque flow cues. */
export function motionSupportsMechanismFlow(spec, motionId) {
  if (!spec || !motionId) return false;
  return spec.flowMotionPattern.test(motionId);
}

/**
 * Hydraulic tappet oil state, keyed by the contract's own stage names so the banner can never disagree with the stage button beside it:
 * a stage runs from its own progress to the next stage's, and the stage shown is the one `animatedStudyAdapter` shows (the last stage at
 * or before the progress). Each figure is a number, a [start, end] ramp across the stage, or { base, peak }: a bell that peaks mid-stage.
 * A stage the table does not know falls back to the first, so a renamed contract stage degrades gracefully; scripts/test_mechanism_flow.mjs
 * fails on it instead.
 */
export const TAPPET_STAGE_FLOW = {
  Unloaded: { note: 'Check valve poised', open: false, lock: 0.25, pressure: 0.25, supply: 0.35, replenish: 0.1, bleed: 0.25 },
  Loading: { note: 'Check plate sealing', open: false, lock: [0.35, 0.9], pressure: [0.35, 0.9], supply: 0.2, replenish: 0, bleed: [0.45, 0.7] },
  'Trapped oil under load': { note: 'SEALED', open: false, lock: { base: 0.9, peak: 0.1 }, pressure: { base: 0.9, peak: 0.1 }, supply: 0.12, replenish: 0, bleed: { base: 0.7, peak: 0.25 } },
  Replenishing: { note: 'Check plate OPEN', open: true, lock: 0.15, pressure: { base: 0.4, peak: -0.15 }, supply: { base: 0.7, peak: 0.3 }, replenish: { base: 0.55, peak: 0.45 }, bleed: 0.3 },
  'Cycle returns': { note: 'Zero-lash reset, ready for the next lobe', open: false, lock: 0.25, pressure: 0.28, supply: 0.3, replenish: 0.08, bleed: 0.25 },
};

const DEFAULT_TAPPET_STAGES = [
  { label: 'Unloaded', progress: 0 }, { label: 'Loading', progress: 25 }, { label: 'Trapped oil under load', progress: 50 },
  { label: 'Replenishing', progress: 75 }, { label: 'Cycle returns', progress: 100 },
];

const valueAt = (figure, t) => {
  if (typeof figure === 'number') return figure;
  if (Array.isArray(figure)) return figure[0] + (figure[1] - figure[0]) * t;
  return figure.base + figure.peak * Math.sin(t * Math.PI);
};

/**
 * @param {number} progress 0..100 through the operating motion.
 * @param {{ label: string, progress: number }[]} [stages]  The operating motion's stages from the contract.
 */
export function tappetFlowState(progress = 0, stages = DEFAULT_TAPPET_STAGES) {
  const p = Math.max(0, Math.min(100, Number(progress) || 0));
  const ordered = [...stages].sort((a, b) => a.progress - b.progress);
  let index = 0;
  ordered.forEach((stage, i) => { if (p >= stage.progress) index = i; });
  const stage = ordered[index];
  const next = ordered[index + 1];
  const t = next && next.progress > stage.progress ? clamp01((p - stage.progress) / (next.progress - stage.progress)) : 0;
  const flow = TAPPET_STAGE_FLOW[stage.label] ?? TAPPET_STAGE_FLOW.Unloaded;
  return {
    stage: stage.label,
    phaseLabel: `${stage.label} · ${flow.note}`,
    checkValveOpen: flow.open,
    trappedLock: valueAt(flow.lock, t),
    chamberPressure: valueAt(flow.pressure, t),
    supplyFlow: valueAt(flow.supply, t),
    replenishFlow: valueAt(flow.replenish, t),
    bleedFlow: valueAt(flow.bleed, t),
  };
}

/**
 * Phase-synchronized illustrative oil state for the gear-type oil pump & relief valve.
 */
export function oilPumpFlowState(motionId = 'Operating mechanism', progress = 0) {
  const p = clamp01((Number(progress) || 0) / 100);
  if (/relief/i.test(motionId)) {
    const open = p > 0.08;
    return {
      phaseLabel: open
        ? `Relief valve lifting · ${Math.round(p * 100)}% open · excess oil returns to the inlet`
        : 'Relief valve seated · full discharge to the oil galleries',
      suctionFlow: 0.75,
      peripheralFlow: 0.85,
      dischargeFlow: Math.max(0.45, 1.0 - p * 0.45),
      bypassFlow: open ? Math.min(1, 0.2 + p * 0.85) : 0,
      reliefOpen: open,
      reliefLift: p,
    };
  }
  return {
    phaseLabel: 'Pumping · Oil carried around outer gear pockets',
    suctionFlow: 0.85,
    peripheralFlow: 1.0,
    dischargeFlow: 0.95,
    bypassFlow: 0.08,
    reliefOpen: false,
    reliefLift: 0,
  };
}

/**
 * Banner for the accessory drives: what `driveTrainPlan` (drive-train-flow.mjs) is showing, in words.
 */
export function accessoryFlowState(plan, progress = 0) {
  const p = clamp01((Number(progress) || 0) / 100);
  if (plan.mode === 'path') {
    return {
      phaseLabel: plan.inbound
        ? `Torque path · ${plan.label} · the starter drives the crankshaft gear; idle once the engine runs`
        : `Torque path · ${plan.label} · driven from the crankshaft gear`,
      torqueFlow: 1.0,
      activePathId: plan.pathId,
      progress01: p,
    };
  }
  return {
    phaseLabel: 'Accessory gear train · torque flows out from the crankshaft gear (starter idle)',
    torqueFlow: 0.8,
    activePathId: '',
    progress01: p,
  };
}
