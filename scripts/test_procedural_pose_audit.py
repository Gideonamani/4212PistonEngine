"""Known-answer tests for audit_procedural_poses.py, on three boxes in a GLB with no baked clips.

Boxes A and B touch at rest. A box moved into its neighbour must be reported; one moved to touch it must not; two boxes that move together
(one rigid body) must not be compared; an exploded pose must be reported separately and must not fail the audit; poses sampled from another file are refused.
Needs numpy, trimesh and manifold3d (scripts/requirements-audit.txt).

Run: python3 scripts/test_procedural_pose_audit.py
"""
import sys, tempfile, unittest
from pathlib import Path

import numpy as np
import trimesh

sys.path.insert(0, str(Path(__file__).resolve().parent))
import audit_procedural_poses as poses_audit
import audit_assembly_interference as audit

SIZE = 0.010            # 10 mm boxes, in glTF metres
CENTRES = {'A': 0.0, 'B': 0.010, 'C': 0.040}      # A and B touch face to face; C stands 20 mm clear of B


def column_major(matrix):
    return [float(v) for v in np.asarray(matrix).T.reshape(-1)]


def translation(dx):
    matrix = np.eye(4)
    matrix[0, 3] = dx
    return matrix


def write_boxes(path):
    scene = trimesh.Scene()
    for name, x in CENTRES.items():
        box = trimesh.creation.box(extents=[SIZE] * 3)
        scene.add_geometry(box, node_name=name, geom_name=name, transform=translation(x))
    Path(path).write_bytes(scene.export(file_type='glb'))


def pose_file(glb_path, extra):
    glb = audit.Glb(glb_path)
    world = {glb.part_id(i): glb.world_matrix(i) for i in glb.mesh_nodes()}
    rest = dict(label='rest', kind='rest', moved_parts=0, world={}, all_parts={k: column_major(v) for k, v in world.items()})
    return dict(asset_sha256=glb.sha256, poses=[rest] + extra), world


class ProceduralPoseAudit(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.glb = str(Path(cls.tmp.name) / 'boxes.glb')
        write_boxes(cls.glb)

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def run_poses(self, extra):
        data, world = pose_file(self.glb, extra)
        return poses_audit.audit_poses(self.glb, data, log=lambda *_: None), world

    def pose(self, kind, label, world, moves):
        return dict(label=label, kind=kind, moved_parts=len(moves),
                    world={k: column_major(translation(dx) @ world[k]) for k, dx in moves.items()})

    def test_rest_pose_with_a_touching_pair_is_clean(self):
        report, _ = self.run_poses([])
        self.assertTrue(report['passed'] and report['clean'])
        self.assertEqual(report['rest_neighbouring_pairs'], 1)
        self.assertEqual(report['rest_touching_only'], 1)

    def test_a_part_moved_into_its_neighbour_is_caught(self):
        _, world = pose_file(self.glb, [])
        report, _ = self.run_poses([self.pose('cycle', 'cycle @ 90 deg', world, {'C': -0.025})])
        self.assertFalse(report['passed'])
        pair = report['new_violations'][0]
        self.assertEqual({pair['a'], pair['b']}, {'B', 'C'})
        self.assertAlmostEqual(pair['max_overlap_mm3'], 5 * 10 * 10, places=0)
        self.assertEqual(pair['first_seen'], 'cycle @ 90 deg')

    def test_a_part_moved_to_touch_is_not_an_overlap(self):
        _, world = pose_file(self.glb, [])
        report, _ = self.run_poses([self.pose('cycle', 'cycle @ 10 deg', world, {'C': -0.020})])
        self.assertTrue(report['passed'] and report['clean'])
        self.assertEqual(report['pose_summaries'][1]['pairs_intersected'], 1)

    def test_parts_with_the_same_pose_change_are_one_rigid_body(self):
        _, world = pose_file(self.glb, [])
        report, _ = self.run_poses([self.pose('cycle', 'cycle @ 0 deg', world, {'A': 0.020, 'B': 0.020})])
        # A and B still touch and moved together, so that pair is skipped; B now touches C, which is the only pair intersected.
        self.assertTrue(report['passed'] and report['clean'])
        self.assertEqual(report['pose_summaries'][1]['pairs_intersected'], 1)

    def test_exploded_layout_is_reported_but_does_not_fail(self):
        _, world = pose_file(self.glb, [])
        report, _ = self.run_poses([self.pose('explode', 'explode @ 0.5', world, {'C': -0.025})])
        self.assertTrue(report['passed'])
        self.assertEqual(report['exploded_layout_informational']['overlapping_pairs'], 1)
        listed = report['pose_summaries'][1]['overlaps']
        self.assertEqual([{listed[0]['a'], listed[0]['b']}], [{'B', 'C'}])

    def test_overlap_outside_the_core_view_is_labelled_as_assembled_view_only(self):
        _, world = pose_file(self.glb, [])
        contract = dict(motions=[dict(procedural=dict(type='gtsio-core-cycle'), display=dict(visiblePartIds=['A', 'B'], ghostPartIds=[]))])
        data, _ = pose_file(self.glb, [self.pose('cycle', 'cycle @ 90 deg', world, {'C': -0.025})])
        report = poses_audit.audit_poses(self.glb, data, contract=contract, log=lambda *_: None)
        self.assertEqual(report['cycle_view_split']['core_view_overlapping_pairs'], 0)
        self.assertEqual(report['cycle_view_split']['assembled_view_only_overlapping_pairs'], 1)
        self.assertFalse(report['new_violations'][0]['shown_in_core_view'])
        contract['motions'][0]['display']['visiblePartIds'] = ['A', 'B', 'C']
        report = poses_audit.audit_poses(self.glb, data, contract=contract, log=lambda *_: None)
        self.assertEqual(report['cycle_view_split']['core_view_overlapping_pairs'], 1)

    def test_the_sampled_cycle_is_recorded_as_a_swept_clip(self):
        _, world = pose_file(self.glb, [])
        report, _ = self.run_poses([self.pose('cycle', 'cycle @ 10 deg', world, {'C': -0.020}),
                                    self.pose('cycle', 'cycle @ 20 deg', world, {'A': 0.001, 'B': 0.001}),
                                    self.pose('explode', 'explode @ 1', world, {'C': 0.5})])
        (name, clip), = report['clips'].items()
        self.assertIn('sampled poses', name)
        self.assertEqual((clip['moving_parts'], clip['poses']), (3, 2))      # A, B and C each moved at some sampled cycle pose; the explosion is not a clip

    def test_poses_from_another_file_are_refused(self):
        data, _ = pose_file(self.glb, [])
        data['asset_sha256'] = '0' * 64
        with self.assertRaises(ValueError):
            poses_audit.audit_poses(self.glb, data, log=lambda *_: None)

    def test_a_ledger_entry_that_is_no_longer_observed_fails(self):
        data, _ = pose_file(self.glb, [])
        policy = {'known_defects': [{'a': 'A', 'b': 'B', 'max_mm3': 1.0, 'reason': 'test'}]}
        report = poses_audit.audit_poses(self.glb, data, policy, log=lambda *_: None)
        self.assertFalse(report['passed'])
        self.assertEqual(len(report['stale_ledger_entries']), 1)


if __name__ == '__main__':
    unittest.main()
