// Ask the real runner what each CI invocation includes; compare identities, not hand-kept test counts.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

const projects = [...fs.readFileSync('playwright.config.ts', 'utf8').split('projects: [')[1].split('webServer')[0].matchAll(/name:\s*'([^']+)'/g)].map(match=>match[1]);
function listed(args) {
  const report=JSON.parse(execFileSync(process.execPath,['node_modules/@playwright/test/cli.js','test','--list','--reporter=json',...args],{encoding:'utf8',maxBuffer:32*1024*1024}));
  assert.equal(report.errors?.length||0,0,'test discovery failed');
  const ids=[];
  function walk(suite) {
    for(const spec of suite.specs||[])for(const test of spec.tests||[])ids.push(`${test.projectName}:${spec.id}`);
    for(const child of suite.suites||[])walk(child);
  }
  for(const suite of report.suites||[])walk(suite);
  return ids;
}
const all=new Set(listed([])),seen=new Set();assert.ok(all.size>0);
const counts=[];
for(const project of projects) {
  let regular=0,large=0;
  for(const phase of ['regular','large'])for(const shard of [1,2,3]) {
    const ids=listed([`--project=${project}`,`--shard=${shard}/3`,phase==='large'?'--grep':'--grep-invert','@large-model','--pass-with-no-tests']);
    for(const id of ids){assert.ok(!seen.has(id),`duplicate coverage: ${id}`);seen.add(id);}
    if(phase==='large')large+=ids.length;else regular+=ids.length;
  }
  assert.ok(large>0,`${project}: the dedicated phase must discover its tagged checks`);
  counts.push({project,regular,large});
}
assert.deepEqual([...seen].sort(),[...all].sort(),'a browser test was omitted from the CI phases/shards');
console.log(JSON.stringify({passed:true,total:all.size,projects:counts},null,2));
