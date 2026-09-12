"""Exercise release assembly bindings without creating a production release."""
from pathlib import Path
import json,subprocess,tempfile,sys
repo=Path(__file__).resolve().parents[1]
package=repo/'build/pipeline-spring-seat'
with tempfile.TemporaryDirectory(prefix='operating-cylinder-release-') as temp:
 output=Path(temp)/'candidate'
 subprocess.run([sys.executable,str(repo/'scripts/assemble_operating_release.py'),'create','--package',str(package),'--output',str(output),'--id','test-candidate'],check=True)
 manifest=json.loads((output/'release.json').read_text())
 assert manifest['state']=='unpromoted' and manifest['drive_asset']['file_id'] is None
 assert manifest['asset']['decoded_sha256']==json.loads((output/'web/motion.json').read_text())['asset_sha256']
 config=json.loads((output/'web/config.json').read_text())
 assert config['drive_share_url']=='' and 'AIza' not in str(config)
 assert config['local_model_url']=='../assets/engine.glb.gz' and config['local_model_fallback_url']=='../assets/engine.glb'
 subprocess.run([sys.executable,str(repo/'scripts/assemble_operating_release.py'),'verify','--release',str(output)],check=True)
 print('Release assembly test passed')
