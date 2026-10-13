"""Convert a downloaded picture to a lesson-media WebP: flatten any transparency onto white (the diagrams are drawn for a white page), cap the width, save.

  python -I scripts/lesson-rework/to_webp.py <input image> <output .webp> [max width]

The input is untrusted data from the web, so run this with -I and keep inputs in their own folder, away from this script.
"""
import sys
from pathlib import Path

from PIL import Image

source, target = Path(sys.argv[1]), Path(sys.argv[2])
max_width = int(sys.argv[3]) if len(sys.argv) > 3 else 1100
with Image.open(source) as image:
    image.load()
    if image.mode in ('RGBA', 'LA') or (image.mode == 'P' and 'transparency' in image.info):
        rgba = image.convert('RGBA')
        flat = Image.new('RGB', rgba.size, (255, 255, 255))
        flat.paste(rgba, mask=rgba.split()[-1])
    else:
        flat = image.convert('RGB')
    if flat.width > max_width:
        flat = flat.resize((max_width, round(flat.height * max_width / flat.width)), Image.LANCZOS)
    target.parent.mkdir(parents=True, exist_ok=True)
    flat.save(target, 'WEBP', quality=88, method=6)
print(f'{source.name} -> {target.name} {flat.width}x{flat.height} {target.stat().st_size // 1024} KB')
