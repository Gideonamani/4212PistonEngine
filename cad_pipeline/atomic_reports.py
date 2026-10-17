"""Atomic JSON snapshots with bounded retries for transient Windows file locks."""
import json,time,uuid
from pathlib import Path


def write_json(path,value):
    path=Path(path);path.parent.mkdir(parents=True,exist_ok=True)
    temporary=path.with_name(path.name+'.'+uuid.uuid4().hex+'.tmp')
    temporary.write_text(json.dumps(value,indent=2)+'\n',encoding='utf-8')
    for attempt in range(10):
        try:
            temporary.replace(path);return
        except PermissionError:
            if attempt==9:raise
            time.sleep(min(.1*2**attempt,1.))
