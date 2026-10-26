import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

// Every part a lesson step spotlights (its focusParts) must exist on the step's model. The viewer throws on an unknown id, so a typo would
// leave a student with a broken step; the schema only checks the field's shape. The ids are the ones each adapter looks parts up by: the
// cylinder's catalogue (cad_stable_id), the full engine's teaching components, and an animated study's contract parts.

const registry = JSON.parse(fs.readFileSync('src/data/models.json', 'utf8'));
const read = (url) => JSON.parse(fs.readFileSync(`web/${url.replace(/^\.\//, '').split('?')[0]}`, 'utf8'));

/** The ids a model's spotlight accepts, or undefined for a model that has no spotlight. */
function partIds(model) {
  if (model.adapter === 'operating-cylinder') return new Set(read(model.componentCatalogueUrl).parts.map((part) => part.cad_stable_id));
  if (model.adapter === 'full-engine') return new Set(read(model.contractUrl).teaching_components.map((component) => component.id));
  if (model.adapter === 'animated-study') return new Set(read(model.contractUrl).parts.map((part) => part.id));
  return undefined;
}

const steps = fs.readdirSync('web').filter((name) => name.endsWith('-lessons.json')).flatMap((name) => {
  const pack = JSON.parse(fs.readFileSync(`web/${name}`, 'utf8'));
  return (pack.lessons || []).flatMap((lesson) => (lesson.steps || []).map((step, index) => ({ where: `${name} ${lesson.id} step ${index + 1}`, step })));
});

test('every spotlit part exists on its step\'s model', () => {
  const spotlit = steps.filter(({ step }) => step.focusParts?.length);
  assert.ok(spotlit.length > 0, 'some steps spotlight parts');
  const problems = [];
  for (const { where, step } of spotlit) {
    const model = registry.find((entry) => entry.id === step.modelId);
    if (!model) { problems.push(`${where}: no model ${step.modelId}`); continue; }
    const ids = partIds(model);
    if (!ids) { problems.push(`${where}: ${step.modelId} has no spotlight`); continue; }
    for (const id of step.focusParts) if (!ids.has(id)) problems.push(`${where}: ${id} is not a part of ${step.modelId}`);
  }
  assert.deepEqual(problems, []);
});

test('a step spotlights each part once', () => {
  for (const { where, step } of steps) if (step.focusParts) assert.equal(new Set(step.focusParts).size, step.focusParts.length, where);
});
