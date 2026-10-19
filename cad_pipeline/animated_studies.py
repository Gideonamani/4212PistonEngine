"""What differs between the animated studies, for the one Blender rig (`rig_animated_study.py`). No Blender is needed to import this module.

The rig bakes per-part keyframes from a study's motion definition and exports the GLB and the contract. Everything the rig does the same for every engine lives
there; everything that depends on the engine lives here, as a `Study`:

* `frame(pid)`: where a part's object origin sits (CAD mm) and the rest rotation of its own frame (a part turning about a fixed axis has its origin on it);
* `clips()`: the clips to bake, each with the pose of a part at a frame and a key that says which parts share one set of tracks (all parts of a rigid body move alike);
* `contract(...)`: the contract that describes the baked file, built by `study_contract.py` from the engine's config;
* the output names, frame rate and the few places where the engines differ in how the file is made.

Adding an engine is one `Study` subclass and a contract config; the rig is not edited. Standard library only (the motion modules are).
"""
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from cad_pipeline.look import DEFAULT_SMOOTH_ANGLE_DEG

REPO = Path(__file__).resolve().parents[1]
OPERATING = 'Operating mechanism (illustrative)'
EXPLODED = 'Systems exploded view'
OPERATING_FRAMES, EXPLODED_FRAMES = 721, 241          # 1 crank degree per frame; two crank turns are one four-stroke cycle


@dataclass
class Clip:
    title: str
    frames: int
    pose: Callable                       # (part id, frame index) -> 4x4 CAD matrix (translation in mm)
    share: Callable                      # part id -> hashable; parts with an equal key share one set of tracks (computed from the first of them)
    skip: Callable = lambda pid: False   # parts that never take part in this clip
    static: str = 'identity'             # when a part is not animated: 'identity' (its pose is the identity at every frame) or 'constant' (every channel is constant)


def translation(v):
    return [[1, 0, 0, v[0]], [0, 1, 0, v[1]], [0, 0, 1, v[2]], [0, 0, 0, 1]]


class Study:
    """One engine's rig settings; see the module docstring. `parts` are the CAD frame parts (id, label, group, evidence, material, vertices_mm, triangles)."""
    name = ''
    marker = ''                          # prefix of the log lines the rig prints
    default_name = ''                    # base name of the output files
    fps = 24
    source = 'geometry'                  # 'geometry': build the objects from geometry.json; 'blend': open the Blender file that the presentation stage saved
    smooth_angle = None                  # degrees; None keeps the mesh flat-shaded as exported
    active_clip = None                   # title of the clip that is active when the file opens (None: none)
    verification_file = True             # write blender-verification.json
    export_options = dict(export_format='GLB', export_extras=True, export_animations=True, export_animation_mode='ACTIONS',
                          export_force_sampling=False, export_anim_slide_to_zero=True)

    def __init__(self, parts):
        self.parts = parts

    # --- the motion -------------------------------------------------------------------------------------------------------------------------------
    def frame(self, pid):
        """(origin in CAD mm, rotation): the rotation is radians about +X (None for none), or a 4x4 basis matrix."""
        return (0.0, 0.0, 0.0), None

    def clips(self):
        raise NotImplementedError

    # --- the files --------------------------------------------------------------------------------------------------------------------------------
    def output_names(self, name):
        return dict(blend=name + '.blend', glb=name + '.glb', contract=name + '-contract.json')

    def contract(self, asset_sha256, **info):
        raise NotImplementedError

    # --- hooks the rig calls; most studies need none of them --------------------------------------------------------------------------------------
    def annotate(self, obj, pid):
        """Extra custom properties on a Blender object opened from a saved file."""

    def finish(self, scene):
        """Scene settings after baking, before the file is saved."""

    def write_extras(self, out):
        """Files written beside the GLB and the contract."""


class MotionStudy(Study):
    """Wright and Langley: operating mechanism plus a systems exploded view, both from the study's own modules."""
    motion = explode = contract_module = bodies = None
    active_clip = OPERATING
    rest_rotation = False                # the motion module has rest_rotation(): a part stored in its own frame (Langley's springs)

    def frame(self, pid):
        pivot = self.motion.pivot(pid) or (0.0, 0.0, 0.0)
        return pivot, (self.motion.rest_rotation(pid) if self.rest_rotation else None)

    def clips(self):
        groups = {p['id']: p['group'] for p in self.parts}
        steps = EXPLODED_FRAMES - 1
        return [Clip(OPERATING, OPERATING_FRAMES, lambda pid, f: self.motion.matrix(pid, float(f)), lambda pid: (self.body(pid), '')),
                Clip(EXPLODED, EXPLODED_FRAMES, lambda pid, f: translation(self.explode.offset(pid, groups[pid], f / steps)), lambda pid: (self.body(pid), pid))]

    def motions(self):
        return [dict(id=OPERATING, label=OPERATING, loop=True, stages=self.contract_module.operating_stages()),
                dict(id=EXPLODED, label=EXPLODED, loop=False, stages=self.explode.STAGES)]

    def contract(self, asset_sha256, **info):
        return self.contract_module.build(dict(parts=self.parts), asset_sha256, motions=self.motions())


class Langley(MotionStudy):
    name, marker, default_name = 'langley', 'LANGLEY', 'langley-manly-balzer-1903-animated'
    rest_rotation = True

    def __init__(self, parts):
        super().__init__(parts)
        from cad_pipeline import langley_contract, langley_explode, langley_motion
        from cad_pipeline.langley_bodies import body
        self.contract_module, self.explode, self.motion, self.body = langley_contract, langley_explode, langley_motion, body


class Wright(MotionStudy):
    name, marker, default_name = 'wright', 'WRIGHT', 'wright-research-revision-2-animated'

    def __init__(self, parts):
        super().__init__(parts)
        from cad_pipeline import wright_contract, wright_explode, wright_motion
        from cad_pipeline.wright_bodies import body
        self.contract_module, self.explode, self.motion, self.body = wright_contract, wright_explode, wright_motion, body


class Gtsio(Study):
    """GTSIO-520-H R10: three clips (explode, collapse, core cycle) from `gtsio_review_motion`, on the Blender file the presentation stage saved.

    By default nothing is baked: the viewer computes the motion from the contract's `procedural` block, so the rig only writes the contract and the reference
    poses beside the static GLB. `--bake-gltf` opens the saved Blender file and bakes the three clips instead."""
    name, marker, default_name = 'gtsio', 'GTSIO_REVIEW', 'gtsio520-r10'
    fps = 60
    source = 'blend'
    smooth_angle = DEFAULT_SMOOTH_ANGLE_DEG
    verification_file = False
    export_options = dict(export_format='GLB', export_extras=True, export_cameras=False, export_animations=True, export_animation_mode='ACTIONS',
                          export_merge_animation='ACTION', export_force_sampling=False, export_anim_slide_to_zero=True)
    HANDOFF = 'cad-studies/gtsio520-h-static/crankcase-contours/animation-handoff.json'

    def __init__(self, parts, handoff=None, spec=None):
        super().__init__(parts)
        from cad_pipeline.gtsio_review_motion import ReviewMotion
        self.handoff = handoff or json.loads((REPO / self.HANDOFF).read_text())
        self.spec = spec or json.loads((REPO / self.handoff['selected_spec']['path']).read_text())
        self.review = ReviewMotion(self.spec, parts, self.handoff['rigid_body_seeds'])

    def frame(self, pid):
        return self.review.origin_basis(pid)

    def clips(self):
        from cad_pipeline.gtsio_review_motion import COLLAPSE, CYCLE, EXPLODE
        review, frames = self.review, 721
        return [Clip(EXPLODE, frames, lambda pid, f: review.exploded_matrix(pid, f / 720), review.explosion, static='constant'),
                Clip(COLLAPSE, frames, lambda pid, f: review.exploded_matrix(pid, (720 - f) / 720), review.explosion, static='constant'),
                Clip(CYCLE, frames, lambda pid, f: review.matrix(pid, float(f)), review.body, skip=lambda pid: review.body(pid).startswith('fixed:'), static='constant')]

    def output_names(self, name):
        return dict(blend='gtsio520-r10-animated-review.blend', glb='gtsio520-r10-animated-review.glb', contract='review-contract.json')

    def annotate(self, obj, pid):
        obj['review_body'] = self.review.body(pid)
        obj['cycle_visible'] = self.review.cycle_visible(pid)

    def finish(self, scene):
        from cad_pipeline.gtsio_review_motion import SCOPE
        scene['review_scope'] = SCOPE
        scene['draft_authority'] = 'User selected illustrative review drafts first on 17 October 2026'
        scene.frame_set(1)

    def write_extras(self, out):
        from cad_pipeline.gtsio_review_motion import build_reference_poses
        (out / 'reference-poses.json').write_text(json.dumps(build_reference_poses(self.review, self.parts)) + '\n')

    def contract(self, asset_sha256, **info):
        from cad_pipeline.gtsio_contract import build_review_contract
        return build_review_contract(motion=self.review, handoff=self.handoff, spec=self.spec, parts=self.parts, asset_sha256=asset_sha256, **info)


STUDIES = {cls.name: cls for cls in (Langley, Wright, Gtsio)}


def get(name):
    if name not in STUDIES:
        raise ValueError(f'Unknown animated study {name!r}; choose one of {", ".join(sorted(STUDIES))}')
    return STUDIES[name]
