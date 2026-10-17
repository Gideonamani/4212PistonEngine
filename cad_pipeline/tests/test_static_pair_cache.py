"""Saved CAD and deliberate collision mutations for conservative pair reuse."""
import copy
import json
import unittest
import uuid
from pathlib import Path
import FreeCAD as A
import Part
from cad_pipeline.static_pair_cache import (POLICY, bootstrap, digest, fingerprint,
    intersect_pairs, provenance_file, seal_cache, validate_cache)


class StaticPairCacheTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(__file__).resolve().parents[2]/'build/method-fixtures'/('pair-cache-'+uuid.uuid4().hex)
        self.root.mkdir(parents=True)
        self.doc = A.newDocument('PairCacheFixture')
        master = self.doc.addObject('Part::Box', 'Master')
        master.Length = master.Width = master.Height = 10
        neighbour = self.doc.addObject('Part::Box', 'Neighbour')
        neighbour.Length = neighbour.Width = neighbour.Height = 10
        neighbour.Placement.Base = A.Vector(10, 0, 0)
        instance = self.doc.addObject('App::Link', 'Instance')
        instance.setLink(master)
        instance.LinkPlacement.Base = A.Vector(0, 20, 0)
        other = self.doc.addObject('Part::Box', 'Other')
        other.Length = other.Width = other.Height = 10
        other.Placement.Base = A.Vector(10, 20, 0)
        far = self.doc.addObject('Part::Box', 'Far')
        far.Length = far.Width = far.Height = 10
        far.Placement.Base = A.Vector(100, 0, 0)
        self.doc.recompute()
        self.native = self.root/'base.FCStd'
        self.doc.saveAs(str(self.native))
        self.spec = self.root/'spec.json'; self.spec.write_text('{}\n')
        self.source = dict(native=provenance_file(self.native), spec=provenance_file(self.spec))
        self.cold = intersect_pairs(self.shapes())
        self.cache = seal_cache(self.cold['fingerprints'], self.cold['outcomes'], self.source)
        self.assertEqual(self.cold['overlaps'], [])
        self.assertEqual(self.cold['pairs'], 2)

    def tearDown(self):
        A.closeDocument(self.doc.Name)

    def shapes(self):
        return {key: self.doc.getObject(key).Shape for key in
                ('Master', 'Neighbour', 'Instance', 'Other', 'Far')}

    def test_saved_reopened_shapes_reuse_and_triangulation_misses_stay_safe(self):
        A.closeDocument(self.doc.Name)
        self.doc = A.openDocument(str(self.native))
        self.doc.recompute()
        warm = intersect_pairs(self.shapes(), self.cache)
        self.assertEqual((warm['pairs_tested'], warm['pairs_reused']), (0, 2))
        self.assertEqual(warm['outcomes'], self.cold['outcomes'])
        for shape in self.shapes().values():
            shape.tessellate(0.1)
        # Meshing can also change OCCT topology flags. Retain those flags:
        # a false miss costs a Boolean; normalizing them could hide a change.
        meshed = intersect_pairs(self.shapes(), self.cache)
        self.assertEqual(meshed['pairs_tested']+meshed['pairs_reused'], 2)
        self.assertEqual(meshed['overlaps'], intersect_pairs(self.shapes())['overlaps'])

    def test_placement_mutation_detects_collision_and_preserves_cached_failure(self):
        self.doc.Neighbour.Placement.Base = A.Vector(9, 0, 0)
        self.doc.recompute()
        warm = intersect_pairs(self.shapes(), self.cache)
        self.assertEqual((warm['pairs_tested'], warm['pairs_reused']), (1, 1))
        self.assertAlmostEqual(warm['overlaps'][0]['overlap_mm3'], 100)
        failed = seal_cache(warm['fingerprints'], warm['outcomes'], self.source)
        repeat = intersect_pairs(self.shapes(), failed)
        self.assertEqual(repeat['overlaps'], warm['overlaps'])
        self.assertEqual(repeat['pairs_tested'], 0)
        self.doc.Neighbour.Placement.Base = A.Vector(10, 0, 0)
        self.doc.recompute()
        repaired = intersect_pairs(self.shapes(), failed)
        self.assertEqual(repaired['pairs_tested'], 1)
        self.assertEqual(repaired['overlaps'], [])

    def test_master_parameter_change_invalidates_linked_instance_pairs(self):
        self.doc.Master.Length = 11
        self.doc.recompute()
        warm = intersect_pairs(self.shapes(), self.cache)
        self.assertEqual((warm['pairs_tested'], warm['pairs_reused']), (2, 0))
        self.assertEqual(len(warm['overlaps']), 2)
        self.assertEqual(warm['overlaps'], intersect_pairs(self.shapes())['overlaps'])

    def test_new_neighbour_is_enumerated_and_removed_parts_leave_no_stale_pairs(self):
        self.doc.Far.Placement.Base = A.Vector(19, 0, 0)
        self.doc.recompute()
        warm = intersect_pairs(self.shapes(), self.cache)
        self.assertEqual((warm['pairs_tested'], warm['pairs_reused']), (1, 2))
        self.assertEqual(warm['overlaps'][0]['b'], 'Far')
        shapes = self.shapes(); del shapes['Far']; del shapes['Neighbour']
        removed = intersect_pairs(shapes, self.cache)
        self.assertEqual((removed['pairs'], removed['pairs_tested'], removed['pairs_reused']), (1, 0, 1))

    def test_same_mass_bounds_different_internal_geometry_cannot_reuse(self):
        box = Part.makeBox(10, 10, 10)
        first = box.cut(Part.makeBox(1, 1, 1, A.Vector(2, 2, 2)))
        second = box.cut(Part.makeBox(1, 1, 1, A.Vector(6, 6, 6)))
        self.assertAlmostEqual(first.Volume, second.Volume)
        self.assertEqual(first.BoundBox.XLength, second.BoundBox.XLength)
        self.assertNotEqual(fingerprint(first), fingerprint(second))

    def test_rotated_pose_invalidates_even_a_symmetric_boundary(self):
        self.doc.Neighbour.Placement.Rotation = A.Rotation(A.Vector(1, 0, 0), 90)
        self.doc.recompute()
        warm = intersect_pairs(self.shapes(), self.cache)
        self.assertGreater(warm['pairs_tested'], 0)
        self.assertEqual(warm['overlaps'], intersect_pairs(self.shapes())['overlaps'])

    def test_partial_checkpoint_reuses_only_completed_pairs(self):
        partial = seal_cache(self.cold['fingerprints'], self.cold['outcomes'][:1], self.source)
        records = []
        resumed = intersect_pairs(self.shapes(), partial,
            checkpoint=lambda fingerprints, outcomes: records.append(list(outcomes)))
        self.assertEqual((resumed['pairs_tested'], resumed['pairs_reused']), (1, 1))
        self.assertEqual(len(records[-1]), 2)

    def test_content_policy_software_and_source_changes_are_rejected(self):
        broken = copy.deepcopy(self.cache); broken['outcomes'][0]['overlap_mm3'] = 1
        with self.assertRaisesRegex(ValueError, 'content changed'): validate_cache(broken)
        for key in ('policy', 'engine'):
            broken = copy.deepcopy(self.cache); broken[key]['method'] = 'different'
            broken['content_sha256'] = digest({k: v for k, v in broken.items() if k != 'content_sha256'})
            with self.assertRaisesRegex(ValueError, 'mismatch'): validate_cache(broken)
        broken = copy.deepcopy(self.cache); broken['source'] = {}
        broken['content_sha256'] = digest({k: v for k, v in broken.items() if k != 'content_sha256'})
        with self.assertRaisesRegex(ValueError, 'lacks native/spec'): validate_cache(broken)
        for path in (self.native, self.spec):
            original = path.read_bytes(); path.write_bytes(original+b'changed')
            with self.assertRaisesRegex(ValueError, 'source changed'): validate_cache(self.cache)
            path.write_bytes(original)

    def test_legacy_bootstrap_requires_exact_sources_coverage_and_pass(self):
        report = dict(passed=True, overlaps=[], agreement_issues=[], parts=5, pairs=2,
                      overlap_tolerance_mm3=POLICY['tolerance_mm3'],
                      native_sha256=self.source['native']['sha256'], spec_sha256=self.source['spec']['sha256'])
        legacy_path = self.root/'legacy-report.json'; legacy_path.write_text(json.dumps(report))
        source = dict(self.source, legacy_audit=provenance_file(legacy_path))
        cache = bootstrap(self.shapes(), report, source)
        self.assertEqual(intersect_pairs(self.shapes(), cache)['pairs_tested'], 0)
        self.assertIsNone(cache['outcomes'][0]['overlap_mm3'])
        for key, value in [('pairs', 1), ('passed', False), ('native_sha256', 'wrong'),
                           ('overlap_tolerance_mm3', 0.01)]:
            bad = dict(report); bad[key] = value
            with self.assertRaises(ValueError): bootstrap(self.shapes(), bad, source)
        legacy_path.write_text('{}')
        with self.assertRaisesRegex(ValueError, 'source changed'): validate_cache(cache)


if __name__ == '__main__':
    unittest.main()
