"""Create an ignored local browser package for the six-cylinder web preview."""
from pathlib import Path
from shutil import copy2

root=Path(__file__).resolve().parents[1]
source=root/'build'/'full-engine-web'/'gtsio520-six-cylinder-drive.glb'
if not source.exists(): raise SystemExit('Run export_full_engine_web.py through Blender first.')
preview=root/'build'/'full-engine-web'/'web'
preview.mkdir(parents=True,exist_ok=True)
for name in ('engine.html','engine-viewer.js'):
    copy2(root/'web'/name,preview/name)
copy2(source,preview/'engine.glb')
print(preview/'engine.html')
