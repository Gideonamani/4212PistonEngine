import { cycleState } from './cycle-model.mjs';

const STROKE_COLOURS = [0x38e0ee, 0x4f8dff, 0xff7b29, 0xb8a99e];

export function cycleCueState(degrees, mode = 'ideal', cycleType = 'otto') {
  const state = cycleState(degrees, mode, cycleType);
  return {
    ...state,
    description: state.explanation,
    colour: STROKE_COLOURS[state.strokeIndex],
    intakeVisible: state.intakeLift > 1e-4,
    exhaustVisible: state.exhaustLift > 1e-4,
    reactionGlow: state.combustionGlow,
  };
}
