"""Seed a fresh development run from exact unchanged per-part cache entries.

This never adopts an assembly pass. A failed assembly can contain individually
valid, unchanged solids. Their immutable keyed BREPs are hard-linked on the
same volume (copied otherwise); JSON records are independent copies. Saved CAD,
interface and all-neighbour checks remain mandatory for the new assembly.
"""
import argparse
import json
import os
import shutil
from pathlib import Path
from cad_pipeline.fast_build import part_key
from cad_pipeline.spec import deflection_for,validate_spec


def reuse(spec,source,output):
    validate_spec(spec);source=Path(source).resolve();output=Path(output).resolve()
    if source==output:raise ValueError('Keep the source snapshot intact')
    for name in ('part-cache','brep-cache'):(output/name).mkdir(parents=True,exist_ok=True)
    hits=[];misses=[]
    for part in spec['parts']:
        id=part['id'];key=part_key(part,spec['parameters'],deflection_for(spec,part))
        src=source/'part-cache'/(id+'.json');brep=source/'brep-cache'/(id+'-'+key+'.brep')
        if not src.exists() or not brep.exists():misses.append(id);continue
        data=json.loads(src.read_text());r=data.get('record',{})
        if data.get('key')!=key or r.get('id')!=id or r.get('solids')!=1 or not r.get('valid') or r.get('volume_mm3',0)<=0:
            misses.append(id);continue
        target=output/'brep-cache'/brep.name
        if target.exists():raise ValueError('Use a fresh destination: '+str(target))
        try:os.link(brep,target);method='hard_link_immutable_keyed_brep'
        except OSError:shutil.copyfile(brep,target);method='copy'
        shutil.copyfile(src,output/'part-cache'/src.name)
        hits.append(dict(id=id,key=key,method=method))
    result=dict(source=str(source),reused=hits,rebuild=misses,scope='Exact recipe/parameter/tessellation cache reuse only; source assembly acceptance is neither required nor inherited')
    (output/'snapshot-reuse.json').write_text(json.dumps(result,indent=2)+'\n')
    return result


def main():
    p=argparse.ArgumentParser()
    for name in ('spec','source','output'):p.add_argument('--'+name,type=Path,required=True)
    a=p.parse_args();r=reuse(json.loads(a.spec.read_text()),a.source,a.output)
    print('DIRECT_SNAPSHOT_REUSED',len(r['reused']),'REBUILD',len(r['rebuild']),flush=True)


if __name__=='__main__':main()
