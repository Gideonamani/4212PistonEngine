// The energy chain behind the walk-through in lesson 10 (Power Generation): from the chemical energy in fuel to thrust, one conversion at a
// time. Plain data, so a test can check it without a browser. Every figure is from FAA-H-8083-32B (2023); the PDF page is given with each.

/** The nine stages, in order. `converter` says what turns this stage into the next one. */
export const STAGES = [
  { id: 'fuel', name: 'Fuel', form: 'Chemical energy', place: 'In the tank and the fuel system',
    text: 'A pound of petroleum fuel, burned with enough air to consume it completely, gives up about 20,000 BTU: the equivalent of 15,560,000 ft-lb of mechanical work. Until it burns, that energy stays locked in the fuel.',
    converter: 'Burning with air, started by a spark', page: 'PDF p. 55' },
  { id: 'heat', name: 'Heat', form: 'Heat energy', place: 'In the combustion chamber',
    text: 'The charge burns and the chemical energy becomes heat. Only part of that heat becomes work: the rest leaves through the cooling air, the friction of the moving parts and the exhaust.',
    converter: 'The heat raising the temperature and pressure of the gas trapped in the cylinder', page: 'PDF pp. 54 to 55', showsHeatSplit: true },
  { id: 'pressure', name: 'Gas pressure', form: 'Pressure and temperature of the gas', place: 'Above the piston, with both valves closed',
    text: 'The burning gases reach between 3,000 and 4,000 degrees F, and the hot gas pushes on the walls of the closed space, including the piston crown.',
    converter: 'The pressure acting on the piston crown', page: 'PDF p. 48' },
  { id: 'force', name: 'Force on the piston', form: 'Force', place: 'On the piston crown',
    text: 'Pressure times area is force. At maximum power the push on one piston can be greater than 15 tons.',
    converter: 'The piston being forced down the cylinder', page: 'PDF pp. 48 and 51' },
  { id: 'reciprocating', name: 'Reciprocating motion', form: 'Motion in a straight line, back and forth', place: 'Piston, piston pin and connecting rod',
    text: 'The piston moves down and the connecting rod follows it, carrying the push from the piston to the crankshaft.',
    converter: 'The rod pushing on the crankpin, which is off the centre of the crankshaft', page: 'PDF p. 48' },
  { id: 'torque', name: 'Crankshaft torque', form: 'Torque', place: 'The crankpin and the crankshaft',
    text: 'Because the crankpin is off the centre of the shaft, the push turns the crankshaft. Torque is force times the distance from the axis, measured at right angles to the force.',
    converter: 'The crankshaft turning at some speed', page: 'PDF pp. 29 and 52' },
  { id: 'shaft', name: 'Shaft power', form: 'Rotational power: brake horsepower', place: 'The propeller shaft',
    text: 'Torque times speed is power. The power delivered to the propeller shaft for useful work is brake horsepower. Friction and the engine accessories take part of the cylinders\' power first, as much as 10 to 15 percent.',
    converter: 'The propeller blades turning', page: 'PDF pp. 52 to 54' },
  { id: 'propeller', name: 'Propeller', form: 'Thrust power', place: 'The propeller',
    text: 'The propeller turns shaft power into thrust, but never with 100 percent efficiency. With a propeller of 85 percent efficiency, an engine of 1,000 bhp gives 850 thrust horsepower.',
    converter: 'The blades pushing air backwards', page: 'PDF p. 54' },
  { id: 'thrust', name: 'Thrust', form: 'Thrust', place: 'The aircraft',
    text: 'Thrust is the force that propels the aircraft. It is the end of the chain.',
    converter: '', page: 'PDF p. 23' },
];

/** Where the heat of combustion goes, in percent of the total heat produced (FAA-H-8083-32B, PDF p. 55). Each is a range. */
export const HEAT_SPLIT = [
  { id: 'power', label: 'Used for power output', low: 25, high: 30 },
  { id: 'cooling', label: 'Lost in cooling', low: 15, high: 20 },
  { id: 'friction', label: 'Lost to friction', low: 5, high: 10 },
  { id: 'exhaust', label: 'Lost in the exhaust', low: 40, high: 45 },
];

/** True when the ranges can add up to 100 percent, so the figures do not contradict each other. */
export function rangesCanTotal100(parts = HEAT_SPLIT) {
  const low = parts.reduce((sum, part) => sum + part.low, 0);
  const high = parts.reduce((sum, part) => sum + part.high, 0);
  return low <= 100 && high >= 100;
}
