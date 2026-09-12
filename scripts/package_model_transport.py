"""Create a lossless download asset alongside a verified, unchanged GLB."""
from pathlib import Path
import argparse,gzip,hashlib,json,time
parser=argparse.ArgumentParser();parser.add_argument('--package',type=Path,required=True)
args=parser.parse_args();folder=args.package.resolve()
check=json.loads((folder/'verification.json').read_text())
source=folder/'engine.glb';raw=source.read_bytes();sha=hashlib.sha256(raw).hexdigest()
assert check['passed'] and check['asset_sha256']==sha
started=time.perf_counter();packed=gzip.compress(raw,compresslevel=9,mtime=0)
assert gzip.decompress(packed)==raw
assert len(packed)<len(raw)
destination=folder/'engine.glb.gz';destination.write_bytes(packed)
report={'schema_version':1,'passed':True,'encoding':'gzip','asset_file':destination.name,
 'asset_sha256':hashlib.sha256(packed).hexdigest(),'transfer_bytes':len(packed),
 'decoded_file':source.name,'decoded_sha256':sha,'decoded_bytes':len(raw),
 'source_sha256':check['source_sha256'],'saving_percent':round(100*(1-len(packed)/len(raw)),2),
 'compression_seconds':round(time.perf_counter()-started,3),
 'scope':'Byte-exact lossless download compression. Triangle count and GPU memory are unchanged.'}
(folder/'transport.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
