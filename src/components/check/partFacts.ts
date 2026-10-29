import type { ModelComponent, ModelGroup, PartBox } from '../../viewer/types';
import { buriedIds, partSizes, type PartFact } from './part-quiz.mjs';

/**
 * What a model's own data says about each of its parts, in the form the 3D part quiz reads (part-quiz.mjs): the viewer's component list,
 * with the learner part details where the model has them, its subassembly groups, and the part boxes once the geometry is measured.
 * Nothing here is written for a particular model, so a model with parts has facts the moment it loads.
 */
export function buildPartFacts(items: ModelComponent[], groups: ModelGroup[] = [], boxes: PartBox[] = []): PartFact[] {
  const sizes = partSizes(boxes);
  const buried = buriedIds(boxes);
  // The viewer lists groups with "– " in front of the nested ones; a system is a top-level group.
  const groupsById = new Map(groups.filter((group) => group.id && group.id !== 'all' && !group.depth).map((group) => [group.id, group]));
  return items.map((item) => {
    const details = item.details;
    const group = groupsById.get(item.group);
    const system = details
      ? { id: details.system.id, label: details.system.label, question: details.system.question }
      : group ? { id: group.id, label: group.label.replace(/^–\s*/, ''), question: group.question } : undefined;
    return {
      id: item.id,
      name: details?.title ?? item.label,
      qualifier: details?.context || undefined,
      does: details?.function.text,
      lookFor: details?.lookFor.text,
      detail: item.description,
      system,
      size: sizes.get(item.id),
      buried: boxes.length ? buried.has(item.id) : undefined,
    };
  });
}
