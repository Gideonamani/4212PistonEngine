import {illustrativeCycle} from './valve-kinematics.mjs';
export function cycleCueState(degrees){
 const cycle=illustrativeCycle(degrees),index=Math.floor(cycle.angle/180),fraction=(cycle.angle%180)/180;
 const descriptions=[
  'Intake: the descending piston draws a fuel–air charge through the open intake valve. Fuel is supplied continuously at the intake port.',
  'Compression: both valves are closed as the rising piston compresses the fuel–air charge.',
  'Power: ignition and combustion raise gas pressure, driving the piston down with both valves closed. Fuel reacts with oxygen; air alone is not burnt.',
  'Exhaust: the rising piston displaces burnt gas through the open exhaust valve.'
 ];
 return {...cycle,description:descriptions[index],colour:[0x43d9e4,0x7baaff,0xff9b42,0xb7b3bd][index],
  intakeVisible:cycle.intakeLift>1e-6,exhaustVisible:cycle.exhaustLift>1e-6,
  reactionGlow:index===2?Math.exp(-fraction*9):0};
}
