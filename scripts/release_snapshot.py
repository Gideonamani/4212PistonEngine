"""Snapshot or restore a complete existing release into a fresh local directory.

No Drive upload, Git publication or in-place replacement is performed.
"""
from pathlib import Path
import argparse,datetime,hashlib,json,shutil,subprocess
repo=Path(__file__).resolve().parents[1]
def digest(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def verified_files(source,manifest):
    for name,expected in manifest['files'].items():
        relative=Path(name)
        if relative.is_absolute() or '..' in relative.parts:raise ValueError('Unsafe manifest path')
        path=(source/relative).resolve()
        if not path.is_relative_to(source.resolve()):raise ValueError('Manifest path escapes snapshot')
        if digest(path)!=expected['sha256'] or path.stat().st_size!=expected['bytes']:raise ValueError('Snapshot hash mismatch: '+name)
    profile=json.loads((source/'web/motion.json').read_text())
    if profile['asset_sha256']!=digest(source/'assets/engine.glb'):raise ValueError('Model/profile mismatch')
def main():
    parser=argparse.ArgumentParser();sub=parser.add_subparsers(dest='operation',required=True)
    capture=sub.add_parser('capture');capture.add_argument('--output',type=Path,required=True);capture.add_argument('--id',required=True)
    capture.add_argument('--model',type=Path,required=True)
    restore=sub.add_parser('restore');restore.add_argument('--source',type=Path,required=True);restore.add_argument('--output',type=Path,required=True)
    args=parser.parse_args();output=args.output.resolve()
    if output.exists():raise ValueError('Output must be a fresh directory')
    if args.operation=='restore':
        source=args.source.resolve();manifest=json.loads((source/'release.json').read_text())
        verified_files(source,manifest)
        for name in manifest['files']:
            dest=output/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source/name,dest)
        (output/'release.json').write_text(json.dumps(manifest,indent=2)+'\n')
        verified_files(output,manifest)
        print('Verified snapshot restore:',manifest['release_id'],len(manifest['files']),'files')
        return
    model=args.model.resolve();profile=json.loads((repo/'web/motion.json').read_text())
    if digest(model)!=profile['asset_sha256']:raise ValueError('Refusing mismatched model and current motion profile')
    files={}
    for source in sorted((repo/'web').rglob('*')):
        if not source.is_file() or source.name=='control.glb':continue
        name=source.relative_to(repo).as_posix();dest=output/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
        files[name]={'sha256':digest(dest),'bytes':dest.stat().st_size}
    dest=output/'assets/engine.glb';dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(model,dest)
    files['assets/engine.glb']={'sha256':digest(dest),'bytes':dest.stat().st_size}
    manifest={'schema_version':1,'release_id':args.id,'created_utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'git_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),
              'scope':'Local rollback snapshot of current web/profile/model; not a new release approval',
              'files':files}
    verified_files(output,manifest)
    (output/'release.json').write_text(json.dumps(manifest,indent=2)+'\n')
    print('Captured verified release snapshot:',args.id,len(files),'files')
if __name__=='__main__':main()
