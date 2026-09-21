import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateContentTree, collectComponentIds, findNodeById } from '../web/schema/content-schema.mjs';

const catalogue = JSON.parse(fs.readFileSync(new URL('../web/components.json', import.meta.url), 'utf8'));
const tree = JSON.parse(fs.readFileSync(new URL('../web/component-tree.json', import.meta.url), 'utf8'));

assert.deepEqual(validateContentTree(tree), []);
assert.equal(tree.modelId, 'cylinder');

// Arbitrary-depth: the root is a group of groups, not a flat list.
assert.equal(tree.root.kind, 'group');
assert.ok(tree.root.children.every(group => group.kind === 'group'));

// Every catalogue part is present exactly once, and no ids were invented.
const catalogueIds = catalogue.parts.map(part => part.cad_stable_id).sort();
const treeIds = collectComponentIds(tree.root).sort();
assert.deepEqual(treeIds, catalogueIds);
assert.equal(new Set(treeIds).size, treeIds.length, 'component ids must be unique');

// isolate(nodeId) must resolve for both a leaf and a branch.
const leaf = findNodeById(tree.root, 'CrankThrow');
assert.equal(leaf.kind, 'component');
const branch = findNodeById(tree.root, 'group-intake-valve-train');
assert.equal(branch.kind, 'group');
assert.ok(branch.children.length > 0);

// Component-only fields stay off group nodes; no fabricated evidence/review data.
for (const group of tree.root.children) {
  assert.equal(group.evidenceStatus, undefined);
  for (const component of group.children) {
    assert.equal(component.kind, 'component');
    assert.equal(component.children, undefined);
    assert.match(component.function, /\S/);
  }
}

console.log('cylinder component/group tree is valid');
