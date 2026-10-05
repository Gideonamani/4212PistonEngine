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

test('declared gear meshes are all audited with clearance once the contract carries them', () => {
  const contract = read('web/accessory-drives-contract.json');
  const audit = read('cad-studies/accessory-drives/interference-audit.json');
  if (!contract.gearMeshes) return; // the published model predates the gear-train declaration; its gear overlaps are in the ledger
  assert.deepEqual(audit.gear_meshes.map((m) => pairKey(m.driver, m.driven)).sort(), contract.gearMeshes.map((m) => pairKey(m.driver, m.driven)).sort());
  for (const mesh of audit.gear_meshes) assert.ok(mesh.ok && mesh.min_gap_mm >= 0.02, `${mesh.driver} / ${mesh.driven}`);
  for (const mesh of contract.gearMeshes) assert.ok(mesh.backlash_mm > 0 && mesh.centre_distance_mm > 0);
});
