"""Archive a validated local reconstruction with sources and rebuild inputs.

Preserves repository-relative layout and excludes probes, backups and caches.
Cloud upload is a separate explicitly verified delivery action.
"""
import argparse,hashlib,json,zipfile
from pathlib import Path

def main():
    p=argparse.ArgumentParser();p.add_argument('--package',type=Path,required=True);p.add_argument('--study',type=Path,required=True);p.add_argument('--name',required=True);a=p.parse_args();root=Path(__file__).resolve().parents[1];folder=a.package.resolve();study=a.study.resolve()
    if not folder.is_relative_to(root) or not study.is_relative_to(root) or Path(a.name).name!=a.name or not a.name.endswith('.zip'):raise ValueError('Package paths must remain inside repository')
    cad=json.loads((folder/'cad/cad-validation.json').read_text());blend=json.loads((folder/'presentation/presentation-manifest.json').read_text())
    if not cad.get('complete_spec') or not cad['geometric_validation_passed']:raise ValueError('Incomplete CAD package')
    for path in ('cad/reopen-validation.json','cad/engineering-checks.json','presentation/blender-validation.json'):
        if not json.loads((folder/path).read_text())['passed']:raise ValueError('Validation did not pass: '+path)
    spec=json.loads((study/'part-spec.json').read_text())
    if hashlib.sha256(json.dumps(spec,sort_keys=True).encode()).hexdigest()!=cad['spec_sha256']:raise ValueError('Spec differs from saved CAD')
    if cad['files']['geometry.json']['sha256']!=blend['cad_geometry_sha256']:raise ValueError('Blender uses stale CAD')
    for parent,manifest in ((folder/'cad',cad),(folder/'presentation',blend)):
        for name,entry in manifest['files'].items():
            if hashlib.sha256((parent/name).read_bytes()).hexdigest()!=entry['sha256']:raise ValueError('Stale artifact '+name)
    files=[]
    for directory in (folder/'cad',folder/'presentation',folder/'research',folder/'study',study,root/'cad_pipeline',root/'.agents/skills'):
        for file in directory.rglob('*'):
            if file.is_file() and '__pycache__' not in file.parts and file.suffix not in ('.FCBak','.FCStd1','.blend1','.pyc','.tmp') and file.name not in ('archive-manifest.json',):files.append(file)
    files += [folder/'review.html',root/'AGENTS.md']+[root/'cad-studies/wright-1903'/n for n in ('mesh-analysis.json','mesh-rois.json','primitive-fits.json')]+[root/'web/wright-1903-engine.glb']
    files=sorted(set(files));records=[dict(path=str(f.relative_to(root)).replace('\\','/'),bytes=f.stat().st_size,sha256=hashlib.sha256(f.read_bytes()).hexdigest()) for f in files]
    payload=dict(model_id=cad['model_id'],engineering_parts=cad['part_count'],native_features=cad['feature_count'],views=len(blend['tour']),scope=spec['scope'],files=records)
    archive=folder/a.name
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for file in files:z.write(file,str(file.relative_to(root)).replace('\\','/'))
        z.writestr('package-manifest.json',json.dumps(payload,indent=2)+'\n')
    with zipfile.ZipFile(archive) as z:
        bad=z.testzip()
        if bad:raise ValueError('Archive CRC failure: '+bad)
    manifest=dict(path=str(archive.relative_to(root)).replace('\\','/'),bytes=archive.stat().st_size,sha256=hashlib.sha256(archive.read_bytes()).hexdigest(),file_count=len(records)+1,scope='Private researched reconstruction candidate; student release retained',files=records)
    (study/'archive-manifest.json').write_text(json.dumps(manifest,indent=2)+'\n');print(json.dumps({k:manifest[k] for k in ('path','bytes','sha256','file_count')}))
if __name__=='__main__':main()
