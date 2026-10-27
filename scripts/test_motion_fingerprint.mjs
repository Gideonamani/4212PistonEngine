import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { MOTION_API_VERSION, describeMotionApi } from '../src/viewer/core/animated-study-motion.mjs';
import { SUPPORTED_CONTRACT_SCHEMAS, checkStudyContract } from '../src/viewer/core/motion-compatibility.mjs';
import { FINGERPRINT_ANGLES, FINGERPRINT_BODIES, motionFingerprint } from '../src/viewer/core/motion-fingerprint.mjs';

const committed = JSON.parse(fs.readFileSync(new URL('../src/viewer/core/motion-fingerprint.json', import.meta.url), 'utf8'));

test('the committed fingerprint is the one the procedural motion produces now', () => {
  const now = motionFingerprint();
  assert.equal(
    now.fingerprint,
    committed.fingerprint,
    'A pose changed. If that was meant: decide whether the meaning of a pose changed (then bump MOTION_API_VERSION), run `node scripts/write_motion_fingerprint.mjs`, '
    + 'commit the new motion-fingerprint.json, and ask for the MEDIS audits that read this motion to be rerun (docs/decisions/002-motion-interface-and-release-envelope.md). If it was not meant, undo the change.',
  );
  assert.deepEqual({ ...now, fingerprint: undefined }, { ...committed, fingerprint: undefined });
});

test('the fingerprint names the motion version it was taken at, so a version bump needs a new fixture too', () => {
  assert.equal(committed.motion_api_version, MOTION_API_VERSION);
  assert.equal(describeMotionApi().version, MOTION_API_VERSION);
});

test('the fingerprint is stable between calls and covers every body, angle and the mirror', () => {
  assert.equal(motionFingerprint().fingerprint, motionFingerprint().fingerprint);
  assert.equal(committed.bodies, FINGERPRINT_BODIES.length);
  assert.equal(committed.angles, FINGERPRINT_ANGLES.length);
  assert.equal(committed.variants, 2);
  assert.equal(new Set(FINGERPRINT_BODIES).size, FINGERPRINT_BODIES.length, 'a body listed twice weakens nothing but hides what is covered');
  assert.deepEqual(FINGERPRINT_ANGLES.slice(0, 3), [0, 30, 60]);
  assert.equal(FINGERPRINT_ANGLES.at(-1), 720);
});

test('changing any single motion parameter changes the fingerprint (a mutation of the motion cannot go unnoticed)', () => {
  const changes = {
    case_cam_y: -77.9, head_seat: 157.1, valve_offset: 25.1, intake_angle: 18.1, exhaust_angle: 20.1,
    intake_valve_length: 124.3, exhaust_valve_length: 124.8, cam_rate: -0.4,
  };
  const baseline = motionFingerprint().fingerprint;
  for (const [name, value] of Object.entries(changes)) {
    assert.notEqual(motionFingerprint({ parameters: { [name]: value } }).fingerprint, baseline, `${name} is not covered by the fingerprint`);
  }
});

test('the fingerprint ignores differences below a nanometre but not above', () => {
  const baseline = motionFingerprint().fingerprint;
  assert.equal(motionFingerprint({ parameters: { head_seat: 157 + 1e-12 } }).fingerprint, baseline);
  assert.notEqual(motionFingerprint({ parameters: { head_seat: 157 + 1e-4 } }).fingerprint, baseline);
});

test('the described interface lists the bodies the fingerprint exercises', () => {
  const described = describeMotionApi();
  assert.equal(described.matrix.translationUnit, 'metres');
  assert.equal(described.crankAngle.unit, 'degrees');
  assert.deepEqual(described.crankAngle.range, [0, FINGERPRINT_ANGLES.at(-1)]);
  const text = described.bodies.join(' ');
  for (const body of ['crank', 'cam', 'rod', 'piston', 'lifter', 'valve', 'rocker', 'pushrod', 'spring', 'spin:', 'fixed:']) assert.ok(text.includes(body), `${body} is not described`);
});

const known = { schema: '4212.animated-study/v1', asset_sha256: 'x', release_allowed: false };

test('a contract with no schema or motion version is legacy: accepted, and never described as audited', () => {
  assert.deepEqual(checkStudyContract({}), { schema: null, motionApi: null });
  assert.deepEqual(checkStudyContract(known), { schema: known.schema, motionApi: null });
});

test('a contract for a newer or unknown schema is rejected with a message a student can act on', () => {
  assert.throws(() => checkStudyContract({ schema: '4212.animated-study/v2' }), /newer version of the site/);
  assert.throws(() => checkStudyContract({ schema: '4212.animated-study/v10' }), /newer version of the site/);
  assert.throws(() => checkStudyContract({ schema: '4212.engine-contract/v1' }), /format this version of the site cannot read/);
  assert.throws(() => checkStudyContract({ schema: 7 }), /format this version of the site cannot read/);
  assert.throws(() => checkStudyContract({ schema: '' }), /format this version of the site cannot read/);
  assert.deepEqual([...SUPPORTED_CONTRACT_SCHEMAS], ['4212.animated-study/v1']);
});

test('the motion version a contract was audited against must be one this build runs', () => {
  const [major, minor, patch] = MOTION_API_VERSION.split('.').map(Number);
  const at = (...parts) => ({ ...known, motion_api: parts.join('.') });
  assert.deepEqual(checkStudyContract(at(major, minor, patch)), { schema: known.schema, motionApi: MOTION_API_VERSION });
  if (minor > 0) assert.doesNotThrow(() => checkStudyContract(at(major, minor - 1, 99)), 'an audit from an older minor of the same major still describes this motion');
  assert.throws(() => checkStudyContract(at(major, minor, patch + 1)), /does not match/);
  assert.throws(() => checkStudyContract(at(major, minor + 1, 0)), /does not match/);
  assert.throws(() => checkStudyContract(at(major + 1, 0, 0)), /does not match/);
  if (major > 0) assert.throws(() => checkStudyContract(at(major - 1, 9, 9)), /does not match/);
  for (const bad of ['1', '1.0', 'v1.0.0', '1.0.0-beta', 7, {}, true]) assert.throws(() => checkStudyContract({ ...known, motion_api: bad }), /motion version this site cannot read/);
});

test('every study contract shipped today is accepted, and none claims clearance by passing the check', () => {
  const contracts = fs.readdirSync(new URL('../web/', import.meta.url)).filter((name) => /-contract\.json$/.test(name));
  assert.ok(contracts.length >= 5, 'the shipped contracts were not found');
  for (const name of contracts) {
    const contract = JSON.parse(fs.readFileSync(new URL(`../web/${name}`, import.meta.url), 'utf8'));
    if (typeof contract.schema === 'string' && !contract.schema.startsWith('4212.animated-study/')) continue; // the full-engine contract has its own adapter
    assert.doesNotThrow(() => checkStudyContract(contract), name);
  }
  const r10 = JSON.parse(fs.readFileSync(new URL('../web/gtsio520-r10-contract.json', import.meta.url), 'utf8'));
  assert.equal(r10.release_allowed, false, 'the R10 release stays a draft; passing the compatibility check says nothing about release permission');
  assert.equal(checkStudyContract(r10).motionApi, null, 'the R10 release has no motion-version audit yet and must not read as if it had one');
});
