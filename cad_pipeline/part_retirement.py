"""Exact, hash-bound retirement of replaced identities in a new candidate.

Default extension still rejects deletion. This manifest is an auditable recipe
operation, not a waiver of saved geometry, coverage or current-neighbor checks.
"""
import hashlib
import json


def digest(value):
    return hashlib.sha256(json.dumps(value,sort_keys=True).encode()).hexdigest()


def validate(old,new,manifest=None):
    before={p['id']:p for p in old['parts']};after={p['id']:p for p in new['parts']}
    missing=before.keys()-after.keys()
    if not missing:
        if manifest is not None:raise ValueError('Retirement manifest supplied without deleted identities')
        return []
    if manifest is None:raise ValueError('Part deletion requires a separate reviewed operation')
    if manifest.get('schema_version')!=1 or manifest.get('source_spec_sha256')!=digest(old) or manifest.get('target_spec_sha256')!=digest(new):
        raise ValueError('Retirement source/target specification hash mismatch')
    if not manifest.get('decision') or not manifest.get('authorization') or not manifest.get('source_native_sha256'):
        raise ValueError('Retirement rationale, authorization and frozen native binding required')
    rows=manifest.get('retired',[]);ids=[r['id'] for r in rows]
    if len(ids)!=len(set(ids)) or set(ids)!=missing:raise ValueError('Retirement identities must exactly equal the source/target difference')
    for row in rows:
        if row.get('source_recipe_sha256')!=digest(before[row['id']]):raise ValueError('Retired source recipe changed')
        if not row.get('reason') or not row.get('successor_ids') or not set(row['successor_ids'])<=after.keys():raise ValueError('Explicit current replacement identities required')
    if any(p.get('geometry_instance_of') in missing for p in new['parts']):raise ValueError('Current geometry instance depends on retired identity')
    return sorted(missing)
