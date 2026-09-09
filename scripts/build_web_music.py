"""Build the optional web excerpt from the project's original score. Requires ffmpeg."""
from pathlib import Path
import subprocess

repo = Path(__file__).resolve().parents[1]
source = repo.parent / 'EngineSimulation/v5/Original_Quiet_Workshop_Score.wav'
output = repo / 'web/audio/quiet-workshop.mp3'
output.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
                '-t', '120', '-af', 'afade=t=in:st=0:d=2,afade=t=out:st=116:d=4',
                '-c:a', 'libmp3lame', '-b:a', '96k', '-map_metadata', '-1',
                '-metadata', 'title=Quiet Workshop - Engine Explorer', str(output)], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-i', str(output), '-f', 'null', '-'], check=True)
print(f'Built and decoded {output.name}: {output.stat().st_size} bytes')
