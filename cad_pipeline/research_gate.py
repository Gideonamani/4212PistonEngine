"""Check research bookkeeping and actual component coverage, before CAD generation.

This does not judge whether sources were correctly interpreted or certify fidelity.
"""
import argparse, hashlib, json
from pathlib import Path

# An ordered tuple, not a set: the order is written into research-readiness.json, and a set's order changes from run to run.
DISPOSITIONS=('modelled','simplified','deferred','outside_scope')

def review(inventory, part_ids=None):
    sources=inventory.get('sources',{})
    if not inventory.get('target') or not inventory.get('decision'):raise ValueError('Research target/decision missing')
    if not inventory.get('reviewed_locators') or not inventory.get('conflicts'):raise ValueError('Figure review/conflict decisions missing')
    components=inventory.get('components',[]);ids=set();mapped=set();counts={k:0 for k in DISPOSITIONS}
    for c in components:
        if c['id'] in ids:raise ValueError('Duplicate inventory ID')
        ids.add(c['id'])
        for key in ('name','function','interfaces','locator','decision'):
            if not c.get(key):raise ValueError('Incomplete research record '+c['id']+': '+key)
        if not c.get('source_ids') or any(s not in sources for s in c['source_ids']):raise ValueError('Missing component evidence '+c['id'])
        disposition=c.get('disposition')
        if disposition not in DISPOSITIONS:raise ValueError('Invalid disposition')
        counts[disposition]+=1
        if disposition in ('modelled','simplified'):
            if not c.get('part_ids'):raise ValueError('Unmapped component '+c['id'])
            mapped.update(c['part_ids'])
            if part_ids is not None and set(c['part_ids'])-set(part_ids):raise ValueError('Missing CAD parts for '+c['id'])
    expected=set(inventory.get('expected_callouts',[]))
    if expected-ids:raise ValueError('Unaccounted source callouts '+str(sorted(expected-ids)))
    for m in inventory.get('mechanisms',[]):
        if not m.get('path') or not m.get('checks') or not m.get('source_ids'):raise ValueError('Incomplete mechanism plan')
        if any(c not in ids for c in m.get('components',[])):raise ValueError('Unknown mechanism component')
        if any(s not in sources for s in m['source_ids']):raise ValueError('Unknown mechanism evidence')
    if not inventory.get('mechanisms'):raise ValueError('Mechanism review missing')
    for gap in inventory.get('gaps',[]):
        if not gap.get('next_evidence') or not gap.get('modelling_consequence'):raise ValueError('Unresolved gap lacks plan')
        if gap.get('blocks_selected_scope'):raise ValueError('Research issue blocks modelling: '+gap['topic'])
    if part_ids is not None and set(part_ids)-mapped:raise ValueError('CAD parts not accounted in research inventory: '+str(sorted(set(part_ids)-mapped)))
    return dict(passed=True,components=len(components),source_callouts=len(expected),dispositions=counts,
                coverage_checked=part_ids is not None,mechanisms=len(inventory['mechanisms']),
                historical_accuracy_verified=False,scope=inventory['decision'])

def check_spec_research(spec,root):
    link=spec.get('research')
    if not link:return None
    root=Path(root).resolve();path=(root/link['inventory_path']).resolve()
    if not path.is_relative_to(root):raise ValueError('Research path escapes repo')
    data=path.read_bytes()
    if hashlib.sha256(data).hexdigest()!=link['inventory_sha256']:raise ValueError('Research inventory changed; review and regenerate specification')
    return review(json.loads(data),[p['id'] for p in spec['parts']])

def main():
    p=argparse.ArgumentParser();p.add_argument('--inventory',type=Path,required=True);p.add_argument('--spec',type=Path);p.add_argument('--output',type=Path)
    a=p.parse_args();ids=[p['id'] for p in json.loads(a.spec.read_text())['parts']] if a.spec else None
    result=review(json.loads(a.inventory.read_text()),ids)
    if a.output:a.output.write_text(json.dumps(result,indent=2)+'\n')
    print(json.dumps(result,indent=2))
if __name__=='__main__':main()
