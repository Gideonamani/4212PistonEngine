// The captureModel() calls (scripts/capture_model_thumbnail.js) that produced the images in this folder.
// Paste capture_model_thumbnail.js into the DevTools console of the running dev app, then paste this file and run:
//   for (const c of THUMBNAIL_CAPTURES) await captureModel(c.model, c.name, c.view, c.options);
// Squares (720 px) feed the course and lesson card thumbnails; the "explore-" images (1000 x 400) feed the Explore gallery cards.
// Each saved PNG becomes a WebP of the same name here; sources.json and build_thumbnails.py take it from there.
const WIDE = { width: 1000, height: 400 };
// Every part of the intake and exhaust valve trains that sits above the crankcase, for spotlight captures.
const VALVE_TRAIN = ['IntakeValve', 'ExhaustValve', 'IntakeInnerSpring', 'IntakeOuterSpring', 'ExhaustInnerSpring', 'ExhaustOuterSpring', 'IntakeSpringRetainer', 'ExhaustSpringRetainer', 'IntakeRockerArm', 'ExhaustRockerArm', 'IntakePushrod', 'ExhaustPushrod', 'IntakeHydraulicLifterBody', 'ExhaustHydraulicLifterBody'];
const THUMBNAIL_CAPTURES = [
  { model: 'cylinder', name: 'cylinder-operating-cycle', view: { initialAngle: 400, initialCycle: true }, options: { zoom: 0.85, pan: [-20, -5] } },
  { model: 'cylinder', name: 'cylinder-exploded', view: { savedMotionId: 'exploded', motionProgress: 60 }, options: { zoom: 0.64, pan: [-125, 12] } },
  { model: 'cylinder', name: 'cylinder-course', view: { initialAngle: 250, initialCycle: true }, options: { orbit: [-75, -12], zoom: 0.85 } },
  { model: 'gtsio520-h-v5-teaching-engine', name: 'gtsio520-full-engine', view: {}, options: { zoom: 0.8, pan: [-22, 12] } },
  { model: 'wright-1903-engine', name: 'wright-1903-engine', view: { viewPreset: 'engine-overview' }, options: { exposure: 0.5, zoom: 0.5, pan: [30, -20] } },
  { model: 'hydraulic-tappet', name: 'hydraulic-tappet-square', view: { savedMotionId: 'Exploded overview', motionProgress: 100 }, options: { zoom: 0.68, roll: 40 } },
  { model: 'oil-pump', name: 'oil-pump-square', view: { savedMotionId: 'Exploded overview', motionProgress: 100 }, options: { zoom: 0.82, roll: -25 } },
  { model: 'accessory-drives', name: 'accessory-drives-square', view: { savedMotionId: 'Operating mechanism', motionProgress: 0 }, options: { zoom: 0.8, orbit: [-25, -22] } },

  { model: 'cylinder', name: 'explore-cylinder', view: { initialAngle: 560, initialCycle: true }, options: { ...WIDE, zoom: 0.72 } },
  { model: 'gtsio520-h-v5-teaching-engine', name: 'explore-full-engine', view: {}, options: { ...WIDE, zoom: 0.55 } },
  { model: 'wright-1903-engine', name: 'explore-wright-1903-engine', view: { viewPreset: 'engine-overview' }, options: { ...WIDE, exposure: 0.5, zoom: 0.47, pan: [0, -32] } },
  { model: 'hydraulic-tappet', name: 'explore-hydraulic-tappet', view: { savedMotionId: 'Exploded overview', motionProgress: 100 }, options: { ...WIDE, zoom: 0.52, roll: 90 } },
  { model: 'oil-pump', name: 'explore-oil-pump', view: { savedMotionId: 'Exploded overview', motionProgress: 100 }, options: { ...WIDE, zoom: 0.54, roll: 90, pan: [45, -5] } },
  { model: 'accessory-drives', name: 'explore-accessory-drives', view: { savedMotionId: 'Operating mechanism', motionProgress: 0 }, options: { ...WIDE, zoom: 0.7, orbit: [-25, -22], pan: [0, -8] } },
  // Lesson 9 (Valve Operating) and its course.
  { model: 'cylinder', name: 'lesson-valve-operating-square', view: { savedMotionId: 'exploded', motionProgress: 50, focusParts: VALVE_TRAIN, focusMode: 'xray' }, options: { zoom: 0.62, pan: [-95, 10] } },
  { model: 'cylinder', name: 'banner-valve-train', view: { savedMotionId: 'exploded', motionProgress: 50, focusParts: VALVE_TRAIN, focusMode: 'xray' }, options: { width: 1000, height: 500, zoom: 0.55, pan: [-75, 5] } },
  { model: 'cylinder', name: 'course-valve-train-square', view: { savedMotionId: 'exploded', motionProgress: 50, focusParts: VALVE_TRAIN, focusMode: 'xray' }, options: { zoom: 0.78, orbit: [-30, -10], pan: [-50, 10] } },
];
