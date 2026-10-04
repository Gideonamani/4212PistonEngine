"""Bounded, explicit review of a STEP mass-property discrepancy.

This is a sampled geometric comparison, not a proof of continuous equivalence.
The normal volume limits remain unchanged; a reviewed exception must identify
the exact saved files and every part failing the original per-solid limit.
"""
import math


def accept_boundary_exception(pairs, evidence, policy, current_hashes):
    if evidence.get('source_hashes') != current_hashes or policy.get('source_hashes') != current_hashes:
        raise ValueError('STEP exception evidence belongs to different saved files')
    reviewed = set(policy.get('reviewed_part_ids', []))
    failures = {p['native_id'] for p in pairs if p['relative_error'] > 1e-4}
    records = evidence.get('parts', [])
    if not reviewed or failures != reviewed or {r['id'] for r in records} != reviewed or len(records) != len(reviewed):
        raise ValueError('STEP exception does not cover exactly the failing parts')
    if not policy.get('reason') or evidence.get('sampling_method') != 'all_vertices_and_projected_face_centroids_bidirectional':
        raise ValueError('Missing STEP exception rationale or sampling method')
    if any(not math.isfinite(p['relative_error']) or p['relative_error'] > 2e-4 for p in pairs):
        raise ValueError('STEP mass discrepancy exceeds the bounded exception')
    for record in records:
        limits = {'relative_volume_error': 2e-4, 'optimal_bounds_error_mm': 1e-6, 'sampled_boundary_error_mm': 1e-6}
        if any(not math.isfinite(record[k]) or record[k] < 0 or record[k] > limit for k, limit in limits.items()):
            raise ValueError('STEP boundary discrepancy: ' + record['id'])
        if record['native_vertices'] != record['step_vertices'] or record['native_faces'] != record['step_faces']:
            raise ValueError('STEP topology count discrepancy: ' + record['id'])
    return dict(reviewed_part_ids=sorted(reviewed), reason=policy['reason'],
                maximum_relative_volume_error=2e-4, maximum_sampled_boundary_error_mm=1e-6,
                maximum_optimal_bounds_error_mm=1e-6,
                measured_maximum_sampled_boundary_error_mm=max(r['sampled_boundary_error_mm'] for r in records),
                limitation='Vertices and projected face centroids sampled in both directions; continuous boundary equivalence is not proven')
