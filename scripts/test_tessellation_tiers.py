"""Tessellation tiers in the part spec: named tiers resolve to the same millimetres the released models were built with.

Standard library only, so CI can run it. The Langley spec moved from one number per group to named tiers; this pins the old numbers so that the move cannot change
any geometry (a different deflection would change the tessellation, and with it the asset hash and the interference audit). R10 and Wright are not rewritten: their
single `default_mm` and their per-group numbers still resolve as before.

Run: python3 scripts/test_tessellation_tiers.py
"""
import copy
import json
import sys
import unittest
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(REPO))
from cad_pipeline.spec import deflection_for, validate_spec

# What the Langley spec held before it had tiers (cad_pipeline/langley_v1.py at 7dad69f): one deflection per group, 0.4 mm for the rest.
LANGLEY_BEFORE = dict(default_mm=0.4, groups={'piston': 0.02, 'liner': 0.02, 'crank': 0.03, 'bearing': 0.03, 'cylinder': 0.2, 'shell': 0.04, 'jacket': 0.04, 'rod': 0.1,
                                              'valve': 0.05, 'spring': 0.1, 'pipe': 0.3, 'ignition': 0.1})
WRIGHT_BEFORE = dict(default_mm=0.7, groups={'cylinders': 0.1, 'pistons': 0.1, 'flywheel': 0.15, 'generator': 0.15, 'valves': 0.2})


def load(path):
    return json.loads((REPO / path).read_text(encoding='utf-8'))


BOX = dict(primitive='box', operation='add', length=10, width=10, height=10)


def minimal(**tessellation):
    """The smallest spec validate_spec accepts, with a tessellation setting."""
    return dict(schema_version=1, units='mm', model_id='m', scope='s', input_mode='text', sources={}, parameters={}, tessellation=tessellation,
                parts=[dict(id='A', label='A', group='fit_parts', evidence='e', features=[BOX]),
                       dict(id='B', label='B', group='other_parts', evidence='e', features=[BOX], **{'class': 'engineering'})])


class NothingMoves(unittest.TestCase):
    def test_every_langley_part_keeps_its_deflection(self):
        spec = load('cad-studies/langley-manly-balzer-1903/part-spec.json')
        before = dict(tessellation=LANGLEY_BEFORE)
        for part in spec['parts']:
            self.assertEqual(deflection_for(spec, part), deflection_for(before, part), part['id'])
        self.assertEqual(len(spec['parts']), 358)

    def test_langley_declares_its_tiers(self):
        setting = load('cad-studies/langley-manly-balzer-1903/part-spec.json')['tessellation']
        self.assertEqual(setting['tiers'], dict(fit=0.02, journal=0.03, thin_wall=0.04, valve=0.05, standard=0.1, body=0.2, pipe=0.3, coarse=0.4))
        self.assertEqual(set(setting['groups'].values()) | {'coarse'}, set(setting['tiers']), 'every tier is used (the default is the coarse one)')
        self.assertNotIn('classes', setting, 'no class ceiling is applied: it would change the mesh and the asset hash')
        validate_spec(load('cad-studies/langley-manly-balzer-1903/part-spec.json'))

    def test_wright_and_r10_resolve_as_before(self):
        wright = load('cad-studies/wright-1903/revision-2/part-spec.json')
        self.assertEqual(wright['tessellation'], WRIGHT_BEFORE)
        self.assertEqual({deflection_for(wright, p) for p in wright['parts']}, {0.1, 0.15, 0.2, 0.7})
        r10 = load('cad-studies/gtsio520-h-static/part-spec.json')
        self.assertEqual(r10['tessellation'], dict(default_mm=0.1), 'the R10 tessellation (and so its asset hash) is not changed')
        self.assertEqual({deflection_for(r10, p) for p in r10['parts']}, {0.1})
        validate_spec(wright)
        validate_spec(r10)


class Resolution(unittest.TestCase):
    def test_order_is_part_then_group_then_default_and_a_class_is_a_ceiling(self):
        setting = dict(default_mm=0.4, tiers=dict(fine=0.02, standard=0.1, coarse=0.4), groups=dict(fit_parts='fine', other_parts=0.3))
        a, b = minimal(**setting)['parts']
        spec = dict(tessellation=setting)
        self.assertEqual(deflection_for(spec, a), 0.02, 'group tier by name')
        self.assertEqual(deflection_for(spec, b), 0.3, 'group tier by number')
        self.assertEqual(deflection_for(spec, dict(id='C', group='unlisted')), 0.4, 'default')
        self.assertEqual(deflection_for(spec, dict(id='D', group='unlisted', tessellation_tier='fine')), 0.02, 'the part names its own tier')
        self.assertEqual(deflection_for(spec, dict(id='D', group='fit_parts', tessellation_tier='coarse')), 0.4, 'the part wins over its group')
        capped = dict(tessellation=dict(setting, classes=dict(engineering='standard')))
        self.assertEqual(deflection_for(capped, b), 0.1, 'an engineering part is not coarser than the ceiling')
        self.assertEqual(deflection_for(capped, a), 0.02, 'a finer tier is kept: the ceiling only caps')
        self.assertEqual(deflection_for(capped, dict(id='E', group='other_parts', **{'class': 'cosmetic'})), 0.3, 'a class without a ceiling is untouched')
        self.assertEqual(deflection_for({}, dict(id='F', group='g')), 0.7, 'no setting at all: the old default')

    def test_the_old_form_still_works(self):
        spec = dict(tessellation=dict(default_mm=0.5, groups=dict(g=0.05)))
        self.assertEqual((deflection_for(spec, dict(id='A', group='g')), deflection_for(spec, dict(id='B', group='h'))), (0.05, 0.5))


class Validation(unittest.TestCase):
    def check(self, **setting):
        validate_spec(minimal(**setting))

    def test_accepts_a_well_formed_setting(self):
        self.check(default_mm=0.4, tiers=dict(fine=0.02), groups=dict(fit_parts='fine'), classes=dict(engineering='fine'))

    def test_refuses_what_would_silently_do_nothing(self):
        for bad in (dict(groups=dict(fit_parts='no_such_tier')), dict(default_mm='no_such_tier'), dict(tiers=dict(fine=0)), dict(tiers=dict(Fine=0.1)),
                    dict(tiers=dict(fine=-1)), dict(groups=dict(fit_parts=0)), dict(classes=dict(heroic=0.1)), dict(classes=dict(engineering='nope')),
                    dict(tolerance=0.1), dict(groups=dict(fit_parts=True))):
            with self.subTest(bad):
                with self.assertRaises(ValueError):
                    self.check(**bad)

    def test_a_part_must_name_a_declared_tier(self):
        spec = minimal(tiers=dict(fine=0.02))
        spec['parts'][0]['tessellation_tier'] = 'fine'
        validate_spec(spec)
        broken = copy.deepcopy(spec)
        broken['parts'][0]['tessellation_tier'] = 'fiine'
        with self.assertRaises(ValueError):
            validate_spec(broken)


if __name__ == '__main__':
    unittest.main()
