// The studio every model is lit by: one rig for all the engines, one exposure for each stage. Plain JavaScript so a Node test can pin it.
//
// The rig used to deliver well over what a surface's own colour asks for (a room environment at full strength, a hemisphere light of 0.85 and three
// directional lights adding up to 3.85, through ACES at 0.9), and ACES then rolled everything above the middle off towards white and desaturated
// it. So any part whose colour was not already dark came out pale: the cylinder's barrel, set to 0x9cabb8 in the adapter, drew between #b7bdc3 and
// #d2dbde, the hydraulic tappet and the oil pump (matte pastels in their files) had 97% of their pixels above 0.8 luminance, and on the light
// stage (#d5dfe3) a pale part vanished into its background. Everything also looked flat, because most of the light was ambient and ambient light
// has no direction to model a form with.
//
// What it does now:
//   - Neutral tone mapping (Khronos PBR Neutral), which leaves a colour below 0.8 as the model's file or the adapter set it, so a teal stays teal and
//     a copper stays copper instead of drifting to white; ACES was desaturating them as well.
//   - A third of the room environment and a quarter of the old hemisphere light, a plain white key light and a weak teal fill and warm rim, so most of
//     the light is the key, a part is not tinted where it is lit, and it has a bright side and a shaded side that show its shape.
//   - Less exposure on the light stage: the stage is itself pale (#d5dfe3), so a part has to be darker than the background to stand out of it; the
//     dark stage is the opposite and wants the parts bright. This is the one difference between the themes.
// scripts/test_lighting.mjs holds the relations between these numbers; how it looks is judged on the real models (docs/model-finishes-2026-10-29.md).

/** @typedef {'light' | 'dark' | 'neutral'} LightingTheme  `neutral` is a picture on a transparent background (a card image), laid over either stage. */

/** The room environment's share (scene.environmentIntensity). It is what makes a metal look like metal, so it is not zero. */
export const ENVIRONMENT_INTENSITY = 0.35;

export const HEMISPHERE_LIGHT = Object.freeze({ sky: 0xdff9ff, ground: 0x101c24, intensity: 0.2 });

/** Key, a teal fill from the other side and a warm rim from behind: the key does most of the work and is plain white, so a part is not tinted where it is lit; the other two tint only the shade. */
export const DIRECTIONAL_LIGHTS = Object.freeze([
  Object.freeze({ name: 'key', color: 0xffffff, intensity: 1.4, position: Object.freeze([3, 4, 5]) }),
  Object.freeze({ name: 'fill', color: 0x42eadb, intensity: 0.45, position: Object.freeze([-4, 1, 2]) }),
  Object.freeze({ name: 'rim', color: 0xffa875, intensity: 0.4, position: Object.freeze([2, -2, -4]) }),
]);

/** renderer.toneMappingExposure for each stage. */
export const EXPOSURE = Object.freeze({ dark: 1, light: 0.75, neutral: 0.9 });

/** The exposure for a theme ('light', 'dark' or, for a picture on no stage, 'neutral'); anything else gets the dark one. */
export const exposureFor = (/** @type {string | undefined} */ theme) => (theme === 'light' ? EXPOSURE.light : theme === 'neutral' ? EXPOSURE.neutral : EXPOSURE.dark);
