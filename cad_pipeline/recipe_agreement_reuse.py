"""Reuse ordinary recipe checks only with exact native and direct identities.

The existing cache-adoption manifest supplies the actual direct BREP hashes.
Mass/bounds outliers are deliberately recomputed under the new boundary gate.
The caller must validate the previous pair-cache engine/source seal first.
"""
import copy


def eligible(old,part_id,current_fingerprint,direct_sha256,previous_fingerprints,adopted):
    prior=old.get(part_id);record=adopted.get(part_id)
    if not prior:return None
    expected_direct=record['brep_sha256'] if record else prior.get('direct_brep_sha256')
    if previous_fingerprints.get(part_id)!=current_fingerprint or expected_direct!=direct_sha256:return None
    if prior.get('bounds_error_mm',float('inf'))>1e-5 or prior.get('relative_volume_error',float('inf'))>1e-6:return None
    if prior.get('passed') is False:return None
    if prior.get('boundary_difference_mm3') and any(abs(v)>1e-5 for v in prior['boundary_difference_mm3']):return None
    result=copy.deepcopy(prior)
    result.update(passed=True,recipe_check_reused=True,direct_brep_sha256=direct_sha256,
        agreement_method='Reused measured bounds/mass: identical recomputed native fingerprint and hash-verified adopted direct BREP')
    return result
