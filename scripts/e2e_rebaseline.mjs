// Re-record the browser tests' ratchet baselines (e2e/baselines/*.json) after a fix has made them smaller.
// Review the diff before committing: it should only ever shrink.
import { spawnSync } from 'node:child_process';

const result = spawnSync('npx', ['playwright', 'test', '--project=phone-360', 'e2e/accessibility.spec.ts', '--workers=1'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, UPDATE_BASELINES: '1' },
});
process.exit(result.status ?? 1);
