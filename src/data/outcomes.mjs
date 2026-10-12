// A lesson's learning outcomes, the "learners should be able to ..." list the instructor wrote for each lesson (docs/lesson-objectives.md).
// In a lesson pack, `outcomes` is a list in which an entry is either a sentence, or a heading with its own sentences (the practicals lesson
// has three such groups). Plain JavaScript so the app, the guide generator and the tests all read them the same way.

/**
 * The outcomes as sections ready to show: consecutive plain sentences form one section without a heading, and each group becomes a
 * section of its own, in order.
 * @param {Array<string | { heading: string, note?: string, items: string[] }> | undefined} outcomes
 * @returns {{ heading?: string, note?: string, items: string[] }[]}
 */
export function outcomeSections(outcomes) {
  const sections = [];
  let loose;
  for (const entry of outcomes ?? []) {
    if (typeof entry === 'string') {
      if (!loose) { loose = { items: [] }; sections.push(loose); }
      loose.items.push(entry);
    } else {
      loose = undefined;
      sections.push({ heading: entry.heading, ...(entry.note ? { note: entry.note } : {}), items: [...entry.items] });
    }
  }
  return sections;
}

/** Every outcome sentence of a lesson, in order. */
export const outcomeTexts = (outcomes) => outcomeSections(outcomes).flatMap((section) => section.items);

/**
 * A short stable key for an outcome sentence, so a learner's ticks stay with the right sentence when the list is edited or reordered. If the
 * sentence is reworded its tick is dropped, which is the right outcome: the learner is being asked something different.
 * (FNV-1a, 32 bit: enough to tell a lesson's outcomes apart, and it needs no libraries.)
 */
export function outcomeKey(text) {
  let hash = 0x811c9dc5;
  for (const char of String(text).trim().replace(/\s+/g, ' ')) {
    hash ^= char.codePointAt(0);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
