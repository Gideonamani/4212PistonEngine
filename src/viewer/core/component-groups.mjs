export function inComponentGroup(component, group) {
  return !group || group === 'all' || component.group === group || component.groups?.includes(group) || (group === 'cylinders' && component.group.startsWith('cylinder-'));
}
export function groupComponentIds(components, group) {
  return components.filter(component => inComponentGroup(component, group)).map(component => component.id);
}
