"""Interference audit of an exported GLB at poses the viewer computes in the browser rather than bakes into the file.

scripts/audit_assembly_interference.py audits the assembled pose and the clips baked into a GLB. The GTSIO-520-H R10 study ships with no
baked clips: the core cycle and the exploded layout are computed from its contract by createProceduralStudySampler() in the viewer. So
this tool takes poses sampled from that same sampler (scripts/sample_animated_study_poses.mjs writes them) and intersects every pair of
parts whose bounds meet, exactly (Manifold boolean), with the audit's own thresholds, ledger policy and "touching is allowed, overlap is not"
rule.

    node scripts/sample_animated_study_poses.mjs web/gtsio520-r10-static.glb.gz web/gtsio520-r10-contract.json --cycle-step 10 \\
        --explode-fractions 0.18,0.36,0.58,0.8,1 --out build/gtsio520-poses.json
    python3 scripts/audit_procedural_poses.py web/gtsio520-r10-static.glb.gz build/gtsio520-poses.json \\
        --policy cad-studies/gtsio520-h-static/interference-policy.json --output <audit>.json

Poses of kind `rest` and `cycle` decide the exit status. Poses of kind `explode` are reported separately and do not: an exploded layout
moves nested parts apart along straight lines, so parts cross their neighbours in transit by design (docs/assembly-interference.md, the
exploded-view exception). Only parts whose pose differs from rest are re-posed, and a pair is skipped when both parts have the same pose
change (one rigid body, so the rest-pose check already covers it). Sampling is discrete: an overlap narrower than the step between poses
could be missed, and the report says what step was used.
"""
import argparse, hashlib, importlib.util, json, platform, sys, time
from pathlib import Path

import numpy as np

HERE = Path(__file__).resolve().parent
_spec = importlib.util.spec_from_file_location('audit_assembly_interference', HERE / 'audit_assembly_interference.py')
audit = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(audit)

GATING_KINDS = ('rest', 'cycle')


def world_from_elements(elements):
    """Three.js Matrix4.elements are column-major; return the ordinary row-major 4x4."""
    return np.asarray(elements, dtype=np.float64).reshape(4, 4).T


def signature(delta):
    return np.round(delta, 9).tobytes()


class Pose:
    """The solids of every part at one pose, built once for the parts that stay at rest and rebuilt for the ones that move."""

    def __init__(self, parts, rest_world, rest_solid):
        self.parts, self.rest_world, self.rest_solid = parts, rest_world, rest_solid

    def build(self, moved):
        solids, sigs = {}, {}
        for part_id, part in self.parts.items():
            if part_id in moved:
                world = world_from_elements(moved[part_id])
                solids[part_id] = part.posed(world)
                sigs[part_id] = signature(world @ np.linalg.inv(self.rest_world[part_id]))
            else:
                solids[part_id] = self.rest_solid[part_id]
                sigs[part_id] = b'rest'
        return solids, sigs


def candidate_pairs(order, solids, sigs, moving):
    """Pairs (a, b) with a < b whose bounds meet, where at least one part moved and the two do not share a pose change."""
    index = {part_id: k for k, part_id in enumerate(order)}
    lo = np.array([solids[i][1] for i in order])
    hi = np.array([solids[i][2] for i in order])
    pairs = set()
    for part_id in moving:
        i = index[part_id]
        hit = np.all(hi >= lo[i], axis=1) & np.all(lo <= hi[i], axis=1)
        hit[i] = False
        for j in np.nonzero(hit)[0]:
            other = order[j]
            if sigs[part_id] == sigs[other]:
                continue
            pairs.add((part_id, other) if part_id < other else (other, part_id))
    return sorted(pairs)


def intersect(solids, pairs):
    """{(a, b): (volume mm^3, thickness mm)} for every listed pair, with the audit's slab-thickness measure 2V/S."""
    result = {}
    for a, b in pairs:
        shared = solids[a][0] ^ solids[b][0]
        volume, area = max(0.0, shared.volume()), shared.surface_area()
        result[(a, b)] = (volume, 2 * volume / area if area > 0 else 0.0)
    return result


def core_view_parts(contract):
    """Part ids the viewer shows (solid or ghosted) in the default view of the core-cycle motion, or None when the contract has no such filter."""
    for motion in (contract or {}).get('motions', []):
        display = motion.get('display') or {}
        if (motion.get('procedural') or {}).get('type') == 'gtsio-core-cycle' and display.get('visiblePartIds') is not None:
            return set(display['visiblePartIds']) | set(display.get('ghostPartIds', []))
    return None


def audit_poses(glb_path, poses_data, policy=None, log=print, contract=None, poses_file_sha256=None):
    started = time.time()
    core_view = core_view_parts(contract)
    policy = policy or {}
    tolerance = policy.get('volume_tolerance_mm3', 1e-3)
    thickness_limit = policy.get('max_penetration_mm', .05)
    glb = audit.Glb(glb_path)
    if glb.sha256 != poses_data['asset_sha256']:
        raise ValueError(f"poses were sampled from {poses_data['asset_sha256']}, but the file is {glb.sha256}")
    built = time.time()
    nodes = glb.mesh_nodes()
    parts = {}
    for node in nodes:
        part = audit.Part(glb, node)
        parts[part.id] = part
    unverified = sorted(i for i, p in parts.items() if p.status != 'ok')
    log(f'{len(parts)} parts read in {time.time() - built:.0f} s, {len(unverified)} cannot be intersected exactly: {unverified}')
    parts = {i: p for i, p in parts.items() if p.status == 'ok'}

    rest_world = {i: glb.world_matrix(p.index) for i, p in parts.items()}
    rest_pose = next(p for p in poses_data['poses'] if p['kind'] == 'rest')
    reading_error = max(float(np.abs(world_from_elements(rest_pose['all_parts'][i]) - rest_world[i]).max()) for i in parts)
    if reading_error > 1e-6:
        raise ValueError(f'Three.js and this reader disagree about the assembled pose by {reading_error}')
    rest_solid = {i: p.posed(rest_world[i]) for i, p in parts.items()}
    factory = Pose(parts, rest_world, rest_solid)
    order = sorted(parts)

    interferes = lambda volume, thickness: volume > tolerance and thickness > thickness_limit
    findings = {'gating': {}, 'explode': {}}
    summaries, touching_stats = [], dict(max_sliver_mm3=0.0, max_sliver_thickness_mm=0.0)
    rest_pairs = rest_touching = 0

    for pose in poses_data['poses']:
        t0 = time.time()
        kind = pose['kind']
        if kind == 'rest':
            solids, sigs = rest_solid, {i: b'rest' for i in parts}
            pairs = candidate_pairs(order, solids, {i: str(k).encode() for k, i in enumerate(order)}, order)   # all pairs
        else:
            moved = {i: m for i, m in pose['world'].items() if i in parts}
            solids, sigs = factory.build(moved)
            pairs = candidate_pairs(order, solids, sigs, sorted(moved))
        results = intersect(solids, pairs)
        bucket = findings['gating' if kind in GATING_KINDS else 'explode']
        violations = 0
        for (a, b), (volume, thickness) in results.items():
            if interferes(volume, thickness):
                violations += 1
                item = bucket.setdefault(frozenset((a, b)), dict(a=a, b=b, max_overlap_mm3=0.0, max_thickness_mm=0.0,
                                                                  first_seen=pose['label'], poses=[]))
                item['max_overlap_mm3'] = max(item['max_overlap_mm3'], volume)
                item['max_thickness_mm'] = max(item['max_thickness_mm'], thickness)
                if len(item['poses']) < 6:
                    item['poses'].append(pose['label'])
            elif volume > 0:
                touching_stats['max_sliver_mm3'] = max(touching_stats['max_sliver_mm3'], volume)
                touching_stats['max_sliver_thickness_mm'] = max(touching_stats['max_sliver_thickness_mm'], thickness)
        if kind == 'rest':
            rest_pairs = len(results)
            rest_touching = rest_pairs - violations
        summary = dict(label=pose['label'], kind=kind, moved_parts=pose['moved_parts'], pairs_intersected=len(results),
                       overlapping_pairs=violations, seconds=round(time.time() - t0, 2))
        if kind == 'explode':           # a held layout can be looked at, so say which pairs it contains
            summary['overlaps'] = [dict(a=a, b=b, volume_mm3=round(v, 3), thickness_mm=round(t, 3))
                                   for (a, b), (v, t) in sorted(results.items(), key=lambda kv: -kv[1][0]) if interferes(v, t)]
        summaries.append(summary)
        log(f"{pose['label']}: {pose['moved_parts']} moved, {len(results)} pairs intersected, {violations} overlapping, {time.time() - t0:.1f} s")

    if core_view is not None:
        for item in findings['gating'].values():
            item['shown_in_core_view'] = item['a'] in core_view and item['b'] in core_view
    by_kind = {}
    for s in summaries:
        k = by_kind.setdefault(s['kind'], dict(poses=0, labels=[], pairs_intersected=0, max_moved_parts=0))
        k['poses'] += 1
        k['labels'].append(s['label'])
        k['pairs_intersected'] += s['pairs_intersected']
        k['max_moved_parts'] = max(k['max_moved_parts'], s['moved_parts'])
    explode = sorted(findings['explode'].values(), key=lambda item: -item['max_overlap_mm3'])
    report = dict(
        asset_sha256=glb.sha256, asset_bytes=glb.bytes, parts=len(parts) + len(unverified), tolerance_mm3=tolerance,
        max_penetration_mm=thickness_limit,
        method='Poses sampled from the viewer\'s own procedural sampler (createProceduralStudySampler) by scripts/sample_animated_study_poses.mjs; '
               'every pair whose bounds meet is intersected exactly (Manifold boolean) at the assembled pose and at each sampled pose, skipping '
               'pairs of parts that share the same pose change. Touching is allowed, overlap is not; an overlap thinner than max_penetration_mm '
               'is treated as mesh tessellation noise on a touching face. Discrete sampling: an overlap narrower than the step could be missed.',
        sampler=poses_data.get('sampler'), contract=poses_data.get('contract'), poses_file_sha256=poses_file_sha256,
        three_js_and_audit_rest_pose_max_matrix_difference=reading_error,
        rest_neighbouring_pairs=rest_pairs, rest_touching_only=rest_touching,
        sampled=by_kind, pose_summaries=summaries,
        largest_non_overlapping_contact=touching_stats,
        unverified_parts=unverified,
        overlaps_total=len(findings['gating']),
        overlap_findings=sorted(findings['gating'].values(), key=lambda item: -item['max_overlap_mm3']),
        cycle_view_split=None if core_view is None else dict(
            core_view_parts=len(core_view),
            core_view_overlapping_pairs=sum(1 for i in findings['gating'].values() if i['shown_in_core_view']),
            assembled_view_only_overlapping_pairs=sum(1 for i in findings['gating'].values() if not i['shown_in_core_view']),
            note='The core cycle opens in the core view, which shows only the listed parts (some ghosted). The Assembled view shows all 1,396 '
                 'parts while the same cycle runs, so a pair with a part outside the core view can only be seen there.'),
        exploded_layout_informational=dict(
            note='Exploded layouts move parts in straight stages, so transit overlaps are expected and do not decide the result '
                 '(docs/assembly-interference.md, exploded-view exception). Listed to show what the layouts contain.',
            overlapping_pairs=len(explode), worst=[dict(a=i['a'], b=i['b'], max_overlap_mm3=round(i['max_overlap_mm3'], 3),
                                                       max_thickness_mm=round(i['max_thickness_mm'], 3), first_seen=i['first_seen'])
                                                  for i in explode[:40]]),
        timing=dict(total_seconds=round(time.time() - started, 1), python=platform.python_version(), machine=platform.platform()))
    return classify(report, policy)


def classify(report, policy):
    """Sort the report's overlaps into the policy ledger (known defects) and new violations, and set `clean` and `passed`.

    The ledger is a ratchet as in audit_assembly_interference.py: an overlap listed there passes while it stays within its recorded
    volume, a pair that is no longer observed makes the entry stale, and anything else is a new violation."""
    policy = policy or {}
    tolerance = report['tolerance_mm3']
    ledger = {frozenset((e['a'], e['b'])): e for e in policy.get('known_defects', [])}
    known, violations = [], []
    for item in report['overlap_findings']:
        entry = ledger.get(frozenset((item['a'], item['b'])))
        if entry and item['max_overlap_mm3'] <= entry['max_mm3'] * 1.05 + tolerance:
            known.append(dict(item, ledger=entry.get('reason')))
        else:
            violations.append(dict(item, ledger='over the recorded ledger limit' if entry else 'not in ledger'))
    seen = {frozenset((i['a'], i['b'])) for i in report['overlap_findings']}
    waived = {w['part'] for w in policy.get('unverified_waivers', [])}
    report['unverified_not_waived'] = [u for u in report['unverified_parts'] if u not in waived]
    report['stale_ledger_entries'] = [dict(a=e['a'], b=e['b'], note='no longer observed: remove it from known_defects')
                                      for key, e in ledger.items() if key not in seen]
    report['known_defects'], report['new_violations'] = known, violations
    report['clean'] = not report['overlap_findings'] and not report['unverified_not_waived']
    report['passed'] = not violations and not report['unverified_not_waived'] and not report['stale_ledger_entries']
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('glb', nargs='?')
    parser.add_argument('poses', nargs='?')
    parser.add_argument('--reclassify', help='apply --policy to the overlaps in an earlier report of this tool, without sampling again')
    parser.add_argument('--stamp-poses', help='with --reclassify: record the SHA-256 of the poses file that report was made from')
    parser.add_argument('--policy')
    parser.add_argument('--contract', help='the model contract, to say which overlapping pairs the default core view shows')
    parser.add_argument('--output')
    args = parser.parse_args()
    policy = json.loads(Path(args.policy).read_text(encoding='utf8')) if args.policy else None
    contract = json.loads(Path(args.contract).read_text(encoding='utf8')) if args.contract else None
    if args.reclassify:
        report = json.loads(Path(args.reclassify).read_text(encoding='utf8'))
        report.pop('contract_sha256', None)
        if args.stamp_poses:
            report['poses_file_sha256'] = hashlib.sha256(Path(args.stamp_poses).read_bytes()).hexdigest()
        report = classify(report, policy)
    else:
        if not (args.glb and args.poses):
            parser.error('give the GLB and the poses file, or --reclassify')
        poses = json.loads(Path(args.poses).read_text(encoding='utf8'))
        report = audit_poses(args.glb, poses, policy, contract=contract,
                             poses_file_sha256=hashlib.sha256(Path(args.poses).read_bytes()).hexdigest())
    if args.output:
        Path(args.output).write_text(json.dumps(report, indent=2) + '\n', encoding='utf8')
    for item in report['new_violations']:
        print(f"VIOLATION {item['a']} / {item['b']}: {item['max_overlap_mm3']:.3f} mm3, {item['max_thickness_mm']:.2f} mm thick ({item['first_seen']}) {item['ledger']}")
    for item in report['stale_ledger_entries']:
        print(f"STALE LEDGER {item['a']} / {item['b']}: {item['note']}")
    for item in report['known_defects']:
        print(f"known     {item['a']} / {item['b']}: {item['max_overlap_mm3']:.3f} mm3, {item['max_thickness_mm']:.2f} mm thick")
    if report['cycle_view_split']:
        split = report['cycle_view_split']
        print(f"cycle overlaps: {split['core_view_overlapping_pairs']} between parts the core view shows, {split['assembled_view_only_overlapping_pairs']} only in the Assembled view")
    print(f"exploded layouts (informational): {report['exploded_layout_informational']['overlapping_pairs']} overlapping pairs")
    print('CLEAN' if report['clean'] else 'PASSED (known defects remain)' if report['passed'] else 'FAILED')
    sys.exit(0 if report['passed'] else 1)


if __name__ == '__main__':
    main()
