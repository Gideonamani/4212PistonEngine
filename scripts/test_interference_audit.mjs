import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

// Parts may touch; they may not overlap. scripts/audit_assembly_interference.py intersects every pair of parts in an
// exported model, at the assembled pose and through its baked animation, and writes cad-studies/<model>/interference-audit.json.
// Python's geometry libraries are not part of this suite, so this test checks the record instead: it must describe the model that is
// actually published, find nothing outside the ledger, and the ledger may only shrink. CI also reruns the audit itself.
const read = (path) => JSON.parse(fs.readFileSync(path, 'utf8'));
const sha256 = (path) => {
  const bytes = fs.readFileSync(path);
  return createHash('sha256').update(path.endsWith('.gz') ? gunzipSync(bytes) : bytes).digest('hex');
};
const targets = [
  { name: 'accessory drives', dir: 'cad-studies/accessory-drives', glb: 'web/accessory-drives.glb.gz', contract: 'web/accessory-drives-contract.json' },
  { name: 'reviewed cylinder', dir: 'cad-studies/cylinder', glb: 'web/cylinder-reviewed-20261001.glb.gz' },
  { name: 'hydraulic tappet', dir: 'cad-studies/hydraulic-tappet', glb: 'web/hydraulic-tappet.glb.gz' },
  { name: 'oil pump', dir: 'cad-studies/oil-pump', glb: 'web/oil-pump.glb.gz' },
  { name: 'Wright revision-2 reconstruction', dir: 'cad-studies/wright-1903/revision-2', glb: 'web/wright-1903-reconstruction.glb.gz', contract: 'web/wright-1903-reconstruction-contract.json' },
  { name: 'Langley / Manly-Balzer reconstruction', dir: 'cad-studies/langley-manly-balzer-1903', glb: 'web/langley-manly-balzer-1903.glb.gz', contract: 'web/langley-manly-balzer-1903-contract.json' },
];
const pairKey = (a, b) => [a, b].sort().join(' / ');

for (const target of targets) {
  test(`${target.name}: the interference audit describes the published model and finds nothing new`, () => {
    const audit = read(`${target.dir}/interference-audit.json`);
    const policy = read(`${target.dir}/interference-policy.json`);
    assert.equal(audit.asset_sha256, sha256(target.glb), 'the model changed: rerun scripts/audit_assembly_interference.py');
    // The thresholds cannot be relaxed quietly to make a failure pass.
    assert.ok(policy.max_penetration_mm <= 0.05 && audit.max_penetration_mm <= 0.05);
    assert.ok(policy.volume_tolerance_mm3 <= 0.01 && audit.tolerance_mm3 <= 0.01);
    assert.ok(policy.min_gear_clearance_mm >= 0.02);
    assert.deepEqual(audit.new_violations.map((v) => pairKey(v.a, v.b)), [], 'overlap outside the known-defect ledger');
    assert.deepEqual(audit.unverified_not_waived, [], 'parts that could not be intersected must be waived with a reason');
    assert.deepEqual(audit.stale_ledger_entries, [], 'a fixed defect must be removed from the ledger');
    assert.equal(audit.passed, true);
    const ledger = policy.known_defects.map((entry) => pairKey(entry.a, entry.b)).sort();
    assert.deepEqual(audit.known_defects.map((v) => pairKey(v.a, v.b)).sort(), ledger, 'ledger and audit disagree');
    for (const entry of policy.known_defects) {
      assert.match(entry.status, /^(open|unreviewed|fixed-in-source-pending-rebuild)$/);
      assert.ok(entry.reason && entry.fix && entry.max_mm3 > 0, `${entry.a} / ${entry.b} needs a reason, a fix and a limit`);
    }
    for (const waiver of policy.unverified_waivers) assert.ok(waiver.reason);
    if (ledger.length === 0) assert.equal(audit.clean, true, 'an empty ledger means the audit is clean');
  });
}

for (const [name, dir, contractPath] of [['accessory drives', 'cad-studies/accessory-drives', 'web/accessory-drives-contract.json'], ['Wright reconstruction', 'cad-studies/wright-1903/revision-2', 'web/wright-1903-reconstruction-contract.json'], ['Langley reconstruction', 'cad-studies/langley-manly-balzer-1903', 'web/langley-manly-balzer-1903-contract.json']]) {
  test(`${name}: declared gear meshes are all audited with clearance once the contract carries them`, () => {
    const contract = read(contractPath);
    const audit = read(`${dir}/interference-audit.json`);
    if (!contract.gearMeshes) return; // the published model predates the gear-train declaration; its gear overlaps are in the ledger
    assert.deepEqual(audit.gear_meshes.map((m) => pairKey(m.driver, m.driven)).sort(), contract.gearMeshes.map((m) => pairKey(m.driver, m.driven)).sort());
    for (const mesh of audit.gear_meshes) assert.ok(mesh.ok && mesh.min_gap_mm >= 0.02, `${mesh.driver} / ${mesh.driven}`);
    for (const mesh of contract.gearMeshes) assert.ok(mesh.backlash_mm > 0 && mesh.centre_distance_mm > 0);
  });
}

// GTSIO-520-H R10 ships with no baked clips: the viewer computes its core cycle and exploded layout. CI audits its assembled pose
// (scripts/audit_assembly_interference.py --rest-only); the sampled cycle and exploded poses (scripts/audit_procedural_poses.py, about an
// hour) are recorded at release in cad-studies/gtsio520-h-static/shipped-r10 and must describe the file that is published.
test('GTSIO-520-H R10: the sampled-pose audit describes the published file and finds nothing outside its ledger', () => {
  const dir = 'cad-studies/gtsio520-h-static/shipped-r10';
  const audit = read(`${dir}/interference-audit.json`);
  const policy = read(`${dir}/interference-policy.json`);
  const contract = read('web/gtsio520-r10-contract.json');
  const published = sha256('web/gtsio520-r10-static.glb.gz');
  assert.equal(audit.asset_sha256, published, 'the model changed: rerun node scripts/sample_animated_study_poses.mjs and python scripts/audit_procedural_poses.py');
  assert.equal(contract.asset_sha256, published);
  assert.equal(contract.release_allowed, false, 'this audit does not accept the model for release');
  assert.match(contract.scope, /draft/i);
  assert.ok(policy.max_penetration_mm <= 0.05 && audit.max_penetration_mm <= 0.05);
  assert.ok(policy.volume_tolerance_mm3 <= 0.01 && audit.tolerance_mm3 <= 0.01);
  assert.equal(audit.three_js_and_audit_rest_pose_max_matrix_difference < 1e-6, true, 'Three.js and the auditor must read the assembled pose alike');
  assert.equal(audit.rest_neighbouring_pairs, audit.rest_touching_only, 'the assembled pose has an overlap');
  assert.ok(audit.sampled.cycle.poses >= 72, 'the cycle must be sampled at no more than 10 degrees');
  assert.ok(audit.sampled.explode.poses >= 5);
  assert.deepEqual(audit.new_violations.map((v) => pairKey(v.a, v.b)), [], 'overlap outside the known-defect ledger');
  assert.deepEqual(audit.unverified_not_waived, []);
  assert.deepEqual(audit.stale_ledger_entries, [], 'a fixed defect must be removed from the ledger');
  assert.equal(audit.passed, true);
  const ledger = policy.known_defects.map((entry) => pairKey(entry.a, entry.b)).sort();
  assert.deepEqual(audit.known_defects.map((v) => pairKey(v.a, v.b)).sort(), ledger, 'ledger and audit disagree');
  for (const entry of policy.known_defects) assert.ok(entry.reason && entry.fix && entry.max_mm3 > 0, `${entry.a} / ${entry.b} needs a reason, a fix and a limit`);
  if (ledger.length === 0) assert.equal(audit.clean, true);
  // The contract must say so, and must not claim acceptance.
  const recorded = contract.pending.filter((line) => line.includes(published.slice(0, 12)));
  assert.equal(recorded.length, 1, 'the contract pending list must record this audit against the asset hash');
  assert.match(recorded[0], /not (an )?accept/i, 'the pending line must say this is not an acceptance');
});
