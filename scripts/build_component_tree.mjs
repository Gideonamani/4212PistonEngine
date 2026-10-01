// Builds web/component-tree.json — the arbitrary-depth Explore ContentNode
// tree for the "cylinder" model — from the existing flat catalogue at
// web/components.json.
//
// Grouping mirrors cylinderAdapter.ts's componentGroup(id) exactly (the six teaching
// groups the M1 component picker already filters by: structure, piston,
// crank, intake, exhaust, ignition). This turns that grouping into explicit
// tree data per docs/explore-mode-content-architecture.md rather than
// inventing a new one, per that doc's open question about how the deeper
// tree relates to the existing six teaching groups.
//
// evidenceStatus/reviewStatus are deliberately left unset: web/components.json
// carries only a uniform placeholder ("mixed; see existing CAD reference
// register" / "pending") for every part today, not a real per-component
// audit, so populating the new per-component enum here would fabricate
// claims rather than migrate them. Run `node scripts/build_component_tree.mjs`
// again once a real per-component evidence/review pass exists.

import fs from 'node:fs';
import { EXPLORE_CONTENT_TREE_SCHEMA, validateContentTree } from '../web/schema/content-schema.mjs';

const catalogueUrl = new URL('../web/components.json', import.meta.url);
const outputUrl = new URL('../web/component-tree.json', import.meta.url);

const catalogue = JSON.parse(fs.readFileSync(catalogueUrl, 'utf8'));

// Mirrors src/viewer/adapters/cylinderAdapter.ts's componentGroup(id).
function partGroup(id) {
  if (id.startsWith('Intake') || id === 'FuelDischargeNozzle') return 'intake';
  if (id.startsWith('Exhaust')) return 'exhaust';
  if (/Spark/.test(id)) return 'ignition';
  if (/^(Piston|FloatingPin|PinPlug)/.test(id)) return 'piston';
  if (/^Cylinder/.test(id)) return 'structure';
  return 'crank';
}

const GROUP_DEFS = [
  { key: 'structure', id: 'group-cylinder-structure', label: 'Cylinder structure' },
  { key: 'piston', id: 'group-piston-assembly', label: 'Piston, rings and pin' },
  { key: 'crank', id: 'group-crank-assembly', label: 'Crankshaft and connecting rod' },
  { key: 'intake', id: 'group-intake-valve-train', label: 'Intake valve train' },
  { key: 'exhaust', id: 'group-exhaust-valve-train', label: 'Exhaust valve train' },
  { key: 'ignition', id: 'group-spark-plugs', label: 'Spark plugs' },
];

const childrenByGroup = new Map(GROUP_DEFS.map(group => [group.key, []]));
for (const part of catalogue.parts) {
  const groupKey = partGroup(part.cad_stable_id);
  childrenByGroup.get(groupKey).push({
    id: part.cad_stable_id,
    label: part.display_name,
    kind: 'component',
    function: part.function,
  });
}

const tree = {
  schema: EXPLORE_CONTENT_TREE_SCHEMA,
  modelId: 'cylinder',
  root: {
    id: 'cylinder-assembly',
    label: 'Cylinder assembly',
    kind: 'group',
    children: GROUP_DEFS.map(group => ({
      id: group.id,
      label: group.label,
      kind: 'group',
      children: childrenByGroup.get(group.key),
    })),
  },
};

const errors = validateContentTree(tree);
if (errors.length) throw new Error(`Generated component tree failed validation:\n${errors.join('\n')}`);

fs.writeFileSync(outputUrl, `${JSON.stringify(tree, null, 2)}\n`);
console.log(`Wrote ${tree.root.children.reduce((sum, group) => sum + group.children.length, 0)} components across ${tree.root.children.length} groups to web/component-tree.json`);
