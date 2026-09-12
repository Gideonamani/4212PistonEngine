"""Assemble or verify an unpromoted operating-cylinder release candidate.

The output includes the exact web revision, candidate motion profile and both
lossless transport files. It deliberately has no Drive file ID: publishing is a
separate promotion step after the versioned Drive upload has been checked.
"""
from pathlib import Path
import argparse,hashlib,json,shutil,subprocess

repo=Path(__file__).resolve().parents[1]
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def copy(source,target):target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
def load(path):return json.loads(path.read_text())

parser=argparse.ArgumentParser();sub=parser.add_subparsers(dest='command',required=True)
create=sub.add_parser('create');create.add_argument('--package',type=Path,required=True);create.add_argument('--output',type=Path,required=True);create.add_argument('--id',required=True)
verify=sub.add_parser('verify');verify.add_argument('--release',type=Path,required=True)
args=parser.parse_args()

def verify_release(folder):
 manifest=load(folder/'release.json');assert manifest['schema_version']==1 and manifest['state']=='unpromoted'
 assert manifest['drive_asset']['file_id'] is None and manifest['drive_asset']['share_url'] is None
 for name,record in manifest['files'].items():
  path=folder/name;assert path.is_file(),name
  assert path.stat().st_size==record['bytes'] and sha(path)==record['sha256'],name
 motion=load(folder/'web/motion.json');transport=load(folder/'records/transport.json')
 assert motion['asset_sha256']==manifest['asset']['decoded_sha256']==transport['decoded_sha256']
 assert sha(folder/'assets/engine.glb')==motion['asset_sha256']
 assert sha(folder/'assets/engine.glb.gz')==transport['asset_sha256']
 assert load(folder/'web/config.json')['drive_share_url']==''
 assert not (folder/'web/config.json').read_text().find('AIza')>=0
 return manifest

if args.command=='verify':
 manifest=verify_release(args.release.resolve());print(f"Verified unpromoted release: {manifest['release_id']} ({len(manifest['files'])} files)");raise SystemExit

package=args.package.resolve();output=args.output.resolve()
if output.exists():raise ValueError('Output must be a fresh directory')
verification=load(package/'verification.json');morph=load(package/'spring-morph-verification.json');transport=load(package/'transport.json')
motion=load(package/'preview/motion.json')
assert verification['passed'] and morph['passed'] and transport['passed']
assert verification['asset_sha256']==morph['asset_sha256']==transport['decoded_sha256']==motion['asset_sha256']
assert verification['source_sha256']==morph['source_sha256']==transport['source_sha256']
assert motion.get('valves',{}).get('spring_targets') and motion.get('cycle_landmarks')

for source in (repo/'web').rglob('*'):
 if source.is_file() and source.name!='control.glb':copy(source,output/'web'/source.relative_to(repo/'web'))
copy(package/'preview/motion.json',output/'web/motion.json')
# Public delivery is deliberately disabled until a unique Drive file is created.
(output/'web/config.json').write_text(json.dumps({
 'drive_share_url':'','status':'Unpromoted operating-cylinder release candidate; awaiting versioned Drive asset.',
 'local_model_url':'../assets/engine.glb.gz','local_model_fallback_url':'../assets/engine.glb'
},indent=2)+'\n')
copy(package/'engine.glb',output/'assets/engine.glb');copy(package/'engine.glb.gz',output/'assets/engine.glb.gz')
for name in ['cad-manifest.json','blender-manifest.json','verification.json','spring-morph-verification.json','transport.json']:
 copy(package/name,output/'records'/name)
files={}
for path in sorted(p for p in output.rglob('*') if p.is_file()):
 relative=path.relative_to(output).as_posix();files[relative]={'sha256':sha(path),'bytes':path.stat().st_size}
manifest={'schema_version':1,'release_id':args.id,'state':'unpromoted',
 'git_commit':subprocess.check_output(['git','rev-parse','HEAD'],cwd=repo,text=True).strip(),
 'asset':{'decoded_file':'assets/engine.glb','decoded_sha256':verification['asset_sha256'],'decoded_bytes':(package/'engine.glb').stat().st_size,
          'transport_file':'assets/engine.glb.gz','transport_sha256':transport['asset_sha256'],'transport_bytes':transport['transfer_bytes'],'encoding':'gzip'},
 'catalogue':{'file':'web/components.json','sha256':sha(output/'web/components.json')},
 'motion':{'file':'web/motion.json','sha256':sha(output/'web/motion.json'),'bind_angle_deg':motion['bind_angle_deg']},
 'drive_asset':{'file_id':None,'share_url':None,'promotion_requirement':'Upload assets/engine.glb.gz as a new versioned Drive file, verify anonymous API delivery and replace this null binding before publishing web/config.json.'},
 'validation':{'geometry':verification['maximum_bounds_error_m'],'spring_morph':'records/spring-morph-verification.json','transport':'records/transport.json'},
 'scope':'Locally verified operating-cylinder candidate; not a Drive/Pages promotion or physical-device approval.',
 'files':files}
(output/'release.json').write_text(json.dumps(manifest,indent=2)+'\n')
verified=verify_release(output);print(f"Created and verified unpromoted release: {verified['release_id']} ({len(files)} files)")
