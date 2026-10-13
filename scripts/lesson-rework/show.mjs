// Print a lesson readably: node scripts/lesson-rework/show.mjs <pack json> <lesson id> [--notes] [--checks] [--sources]
import fs from 'node:fs';

const [file, lessonId, ...flags] = process.argv.slice(2);
const pack = JSON.parse(fs.readFileSync(file, 'utf8'));
const lesson = pack.lessons.find((item) => item.id === lessonId);
if (!lesson) throw new Error(`no lesson ${lessonId}`);
console.log(`# ${lesson.title}  (seq ${lesson.sequenceNumber}, models ${JSON.stringify(lesson.models)})`);
console.log('purpose:', lesson.purpose);
if (lesson.coreIdea) console.log('coreIdea:', lesson.coreIdea);
console.log('outcomes:');
(lesson.outcomes || []).forEach((outcome, index) => console.log(`  O${index + 1}. ${outcome}`));
console.log('syllabusNote:', lesson.syllabusNote);
console.log('completionCriteria:', lesson.completionCriteria);
console.log('');
lesson.steps.forEach((step, index) => {
  const extra = [step.modelId && `model=${step.modelId}`, step.url && `img=${step.url}`, step.focusParts && `focus=${step.focusParts.join(',')}`, step.action && `action=${JSON.stringify(step.action)}`].filter(Boolean).join(' ');
  console.log(`[${index}] (${step.type}) ${step.title}  ${extra}`);
  console.log(step.prompt);
  if (flags.includes('--notes')) console.log(`  NOTE: ${step.note}\n  REFS: ${(step.sourceRefs || []).join(', ')}  MEDIA: ${step.mediaPlan?.mode}/${step.mediaPlan?.status}`);
  console.log('');
});
if (flags.includes('--checks')) {
  for (const check of pack.checks.filter((item) => item.lessonId === lessonId)) {
    console.log(`CHECK ${check.id} (${check.type}): ${check.question}`);
    if (check.answers) console.log('   answers:', JSON.stringify(check.answers));
    if (check.pairs) console.log('   pairs:', JSON.stringify(check.pairs));
    if (check.items) console.log('   items:', JSON.stringify(check.items));
    if (check.correctNodeId) console.log('   click:', check.modelId, check.correctNodeId);
    if (check.answer !== undefined) console.log('   answer:', check.answer, check.unit || '', 'tol', check.tolerance);
    console.log('   hint:', check.hint, '| rationale:', check.rationale);
  }
}
if (flags.includes('--sources')) {
  for (const source of pack.sources) console.log(`SOURCE ${source.id}: ${source.title} | ${source.url || source.locator || ''} | ${source.applicability?.slice(0, 160)}`);
}
