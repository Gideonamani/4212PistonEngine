export function inComponentGroup(component, group) {
  return !group || group === 'all' || component.group === group || component.groups?.includes(group) || (group === 'cylinders' && component.group.startsWith('cylinder-'));
}
export function groupComponentIds(components, group) {
  return components.filter(component => inComponentGroup(component, group)).map(component => component.id);
}

/** The group an operating-cylinder part belongs to: intake, exhaust, ignition, piston, structure or crank (the rest). Also the ids a model-click question may name as a group. */
export function cylinderPartGroup(id) {
  if (id.startsWith('Intake') || id === 'FuelDischargeNozzle') return 'intake';
  if (id.startsWith('Exhaust')) return 'exhaust';
  if (/Spark/.test(id)) return 'ignition';
  if (/^(Piston|FloatingPin|PinPlug)/.test(id)) return 'piston';
  if (/^Cylinder/.test(id)) return 'structure';
  return 'crank';
}
