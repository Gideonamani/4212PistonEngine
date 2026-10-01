# Multiple saved assembly motions

Explore > Motion now offers named motions rather than requiring a different model for each animation. The reviewed cylinder has its existing operating cycle plus exploded and reassembly overviews. The hydraulic tappet and IO-520 permold oil pump add compact internal-mechanism studies with Blender-exported clips.

Saved motions support play/pause, a progress slider, stage buttons, Previous/Next and reversing at the current pose. One-shot assembly motions hold their final pose; pressing Play again restarts them. Operating motions loop. Camera orbit, zoom, picking, section view, colour treatment and group isolation remain available while paused. Explosion camera framing covers the complete separated envelope, and section bounds update to cover it.

The cylinder uses an asset-hash-bound translation profile verified against sampled native Blender GLB animations. Its verified operating-cycle solver remains unchanged. New studies use a shared `animated-study` adapter with actual GLB clips, asset verification, component identity checks and the same inspection controls. Helpers never become teaching components. Models share cached asset bytes across Explore and lessons.

Lesson steps can specify `savedMotionId` and `motionProgress` (0–100). These flow through the production data loader into the same viewer and are validated by the content schema. A cylinder assembly-interfaces lesson and two internal-mechanism lessons use paused motion stages. Lesson cameras can orbit; assessment cameras retain their existing restrictions.

Validation covers native CAD solids, named animation availability, exported identities, reverse/end poses, comparison of cylinder browser poses with native Blender samples, the public adapter controls, motion switching/replay, group isolation without pose changes, disposal, and content validation. Source scope is recorded in `cad-studies/README.md` and per-model contracts. Preview images show native Blender scenes, not browser screenshots.

Phone review: open each new Explore study, choose an exploded motion, pause halfway, rotate, isolate a group and enable section view. Reverse should keep the same pose initially, then move toward assembly when played. At 100% playback should stop. In Learn, open the new assembly/internal-mechanism lessons and rotate their saved stage poses.
