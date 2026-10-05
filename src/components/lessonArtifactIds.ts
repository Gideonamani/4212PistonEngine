// The native interactives a lesson step can name as `artifact:<id>`. Kept apart from the components so the pack tests can read it
// without loading React. Add an id here, then map it to its component in LessonArtifacts.tsx; a test fails if the two disagree.
export const lessonArtifactIds = [
  'cycle-phase-scrubber', 'two-stroke-port-timing', 'arrangement-comparator', 'ignition-method-comparator',
  'air-cooling-path-explorer', 'turbocharger-energy-path', 'aspiration-altitude-comparator',
  'steam-engine-schematic', 'otto-cycle-overview', 'piston-crank-converter', 'arrangement-inline', 'arrangement-v',
  'swept-volume-diagram', 'engine-data-comparison', 'otto-pv-diagram', 'otto-pv-ideal-vs-practical', 'diesel-otto-pv-compare', 'valve-timing-diagram', 'construction-comparison', 'cylinder-numbering', 'cylinder-firing-order',
  'cam-lift-and-duration',
] as const;
