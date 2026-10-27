// What this site is willing to run. A study contract names the schema it was written for and, from the first MEDIS envelope on, the version of the
// motion interface its audits were run against. This module says whether the contract is one the code understands. It never says a contract is
// verified: that stays with `release_allowed`, the contract's scope text and the audit records, none of which this module reads.
// See docs/decisions/002-motion-interface-and-release-envelope.md.

import { MOTION_API_VERSION } from './animated-study-motion.mjs';

/** Contract schemas the animated-study adapter can read. */
export const SUPPORTED_CONTRACT_SCHEMAS = Object.freeze(['4212.animated-study/v1']);

const SEMVER = /^(\d+)\.(\d+)\.(\d+)$/;
const parse = (version) => SEMVER.exec(version)?.slice(1).map(Number);

/**
 * @param {Record<string, unknown>} contract  The parsed study contract.
 * @returns {{ schema: string | null, motionApi: string | null }}
 *   `motionApi` is the motion version the contract says it was audited against, or null when it says nothing, which is every release made
 *   before the envelope. Such a contract is still shown, with the notices it already carries, and is never described as audited against any
 *   motion version. `schema` is null for a contract that declares none.
 * @throws {Error} with a message fit for the student when the contract is for a schema or motion version this build cannot run.
 */
export function checkStudyContract(contract) {
  const schema = typeof contract?.schema === 'string' ? contract.schema : null;
  if (contract?.schema !== undefined && schema === null) throw Error('This mechanism study is in a format this version of the site cannot read.');
  if (schema !== null && !SUPPORTED_CONTRACT_SCHEMAS.includes(schema)) {
    throw Error(/^4212\.animated-study\/v\d+$/.test(schema)
      ? 'This mechanism study was made for a newer version of the site. Reload the page to get the current one.'
      : 'This mechanism study is in a format this version of the site cannot read.');
  }
  const declared = contract?.motion_api;
  if (declared === undefined || declared === null) return { schema, motionApi: null };
  const wanted = typeof declared === 'string' ? parse(declared) : undefined;
  const have = parse(MOTION_API_VERSION);
  if (!wanted) throw Error('This mechanism study names a motion version this site cannot read.');
  // The same major is compatible, and a minor or patch newer than ours is not: the audit then covers poses this build does not produce.
  if (wanted[0] !== have[0] || wanted[1] > have[1] || (wanted[1] === have[1] && wanted[2] > have[2])) {
    throw Error(`This mechanism study was checked against motion version ${declared}, which this version of the site (${MOTION_API_VERSION}) does not match.`);
  }
  return { schema, motionApi: declared };
}
