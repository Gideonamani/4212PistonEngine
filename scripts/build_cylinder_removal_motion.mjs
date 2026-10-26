// Issue #75: the cylinder's removal order from the GTSIO-520 overhaul manual (Form X-30045A, Section VII, printed pages A-7-1 to A-7-5),
// added to web/cylinder-saved-motions.json as a further saved motion. Run: node scripts/build_cylinder_removal_motion.mjs (it replaces the listed motions)
// Directions follow the exploded overview's: +x along the cylinder away from the crank, +y the intake side, -y the exhaust side.
// Distances are presentation distances, as in the overview; only the order comes from the manual.
import fs from 'node:fs';

const file = 'web/cylinder-saved-motions.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const stages = [
  ['assembled', 'Assembled', 'One cylinder of the engine on its crankshaft throw. In the shop the engine is on a stand, its oil drained, and the ignition leads, magnetos, fuel injection, induction system and accessories come off before any cylinder (7-5 to 7-14).'],
  ['nozzle', 'Fuel nozzle out', 'The fuel injection system comes off before the cylinders, its nozzles kept in a clean container (7-7d).'],
  ['covers', 'Rocker covers off', 'With the engine inverted on the stand, the rocker covers and their gaskets come off (7-15a).'],
  ['rockers', 'Rockers and pushrods out', 'Turn the crankshaft until both valves of this cylinder are closed, its tappets on the heels of the cam lobes. Then the rocker shafts, rocker arms and thrust washers come off and the pushrods are withdrawn (7-15b).'],
  ['housings', 'Pushrod housings out', 'Each pushrod housing is pushed against its spring until the cylinder end is clear, then lifted out of the crankcase (7-15c).'],
  ['cylinder', 'Cylinder off at top dead centre', 'With the engine upright and this piston at top dead centre, the base nuts come off and the cylinder is drawn straight outward, the piston caught by hand as it clears (7-15d).'],
  ['valves', 'Valve springs and valves out', 'On a block at the bench, the springs are compressed and the keys removed, then the retainers or rotocap, the springs and the valves (7-15e, f). The manual recommends replacing every exhaust valve and rotocap at major overhaul.'],
  ['piston', 'Piston off', 'The piston pin, piston and rings come off as an assembly, and the rings are taken off without scoring the ring lands (7-15g).'],
  ['tappets', 'Hydraulic tappets out', 'The hydraulic tappets come out; the manual recommends replacing them all at major overhaul (7-15h).'],
  ['rod', 'Rod off the crankpin', 'Only after the crankcase is split and the crankshaft lifted out (7-16, 7-18): the rod cap is unbolted, the bearing inserts removed, and rod, cap, bolt and nut loosely reassembled with their position numbers (7-18b).'],
];
const step = 100 / (stages.length - 1);
const removal = {
  id: 'removal',
  label: 'Removal order (overhaul manual)',
  scope: 'The order is the GTSIO-520 overhaul manual\'s, Section VII (printed pages A-7-1 to A-7-5); the distances parts move are illustrative, and the engine-level steps are not in this one-cylinder model. Teaching sequence only: follow the current manual for the engine in front of you.',
  duration_seconds: 20,
  stages: stages.map(([id, label, note], index) => ({ id, label, progress: Math.round(index * step * 100) / 100, note })),
  parts: {},
};
const stage = Object.fromEntries(stages.map(([id], index) => [id, index]));
const set = (ids, ...moves) => { for (const id of ids) removal.parts[id] = { moves: moves.map(([at, offset_m]) => ({ stage: stage[at], offset_m })) }; };
const both = (name) => [`Intake${name}`, `Exhaust${name}`];
const sided = (name, at, [x, y, z]) => { set([`Intake${name}`], [at, [x, y, z]]); set([`Exhaust${name}`], [at, [x, -y, z]]); };

const CYLINDER = [0.32, 0, 0];
set(['FuelDischargeNozzle'], ['nozzle', [0.12, 0.06, 0.08]]);
sided('RockerCover', 'covers', [0.1, 0.08, 0.1]);
sided('RockerGasket', 'covers', [0.1, 0.08, 0.1]);
sided('RockerShaft', 'rockers', [0.12, 0.14, 0.18]);
sided('RockerArm', 'rockers', [0.12, 0.14, 0.1]);
sided('Pushrod', 'rockers', [0.1, 0.22, 0]);
for (const part of ['PushrodHousing', 'LowerPushrodSeal', 'UpperPushrodSeal']) sided(part, 'housings', [-0.08, 0.2, 0]);
// The cylinder unit: head, barrel, pressed guides and seats, the rocker housings cast with the head, and what is still fitted to it.
set(['CylinderHead', 'CylinderBarrel', ...both('ValveGuide'), ...both('SeatInsert'), ...both('RockerHousing'),
  'UpperSparkPlug', 'UpperSparkInsulator', 'UpperSparkTerminal', 'LowerSparkPlug', 'LowerSparkInsulator', 'LowerSparkTerminal'], ['cylinder', CYLINDER]);
// Valve parts leave with the cylinder, then come out of it along the stem, the valve itself out of the combustion side.
for (const [name, [x, y]] of Object.entries({ ValveKeeper: [0.16, 0.05], SpringRetainer: [0.12, 0.04], OuterSpring: [0.08, 0.03], InnerSpring: [0.05, 0.02], Valve: [-0.04, 0.14] })) {
  set([`Intake${name}`], ['cylinder', CYLINDER], ['valves', [x, y, 0]]);
  set([`Exhaust${name}`], ['cylinder', CYLINDER], ['valves', [x, -y, 0]]);
}
set(['PistonBody', 'PistonRing1', 'PistonRing2', 'PistonRing3', 'PistonRing4', 'FloatingPin', 'PinPlugLeft', 'PinPlugRight'], ['piston', [0.04, 0, 0.22]]);
sided('HydraulicLifterBody', 'tappets', [-0.06, 0.16, 0]);
set(['ConnectingRodCap', 'CapBearingHalf', 'RodBoltMinus1', 'RodNutMinus1', 'RodBolt1', 'RodNut1'], ['rod', [-0.05, -0.15, 0]]);
set(['ConnectingRodBody', 'BigEndBearing', 'SmallEndBush'], ['rod', [0.06, 0, -0.2]]);
set(['CrankThrow']);

const missing = Object.keys(data.parts).filter((id) => !removal.parts[id]);
const extra = Object.keys(removal.parts).filter((id) => !data.parts[id]);
if (missing.length || extra.length) throw new Error(`parts differ: missing ${missing}, extra ${extra}`);
data.motions = [removal];
fs.writeFileSync(file, `${JSON.stringify(data, null, 2)}\n`);
console.log('wrote removal motion:', stages.length, 'stages,', Object.keys(removal.parts).length, 'parts');
