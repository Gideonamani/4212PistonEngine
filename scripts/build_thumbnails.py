"""Build the square course and lesson card thumbnails listed in web/thumbnails/sources.json.

Manual and book pages are read from the Notes folder (not part of the repository), so an item whose PDF is missing is skipped
with a warning and its committed thumbnail is left as it is.

    python scripts/build_thumbnails.py --notes "../Notes" [--only lesson-terminologies] [--sheet out.png]
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
SPEC = WEB / "thumbnails" / "sources.json"
RENDERS = ROOT / "scripts" / "thumbnail_sources"
ACCENT = (45, 212, 191)  # the app's teal, used for the diagonal seam
PAGE_DPI = 200


class MissingSource(Exception):
    pass


def crop_fraction(image: Image.Image, box: list[float] | None) -> Image.Image:
    if not box:
        return image
    w, h = image.size
    return image.crop((round(box[0] * w), round(box[1] * h), round(box[2] * w), round(box[3] * h)))


def edge_colour(image: Image.Image) -> tuple[int, int, int]:
    """Most common colour along the image border, so padding blends with the figure's own background."""
    border = image.resize((64, 64)).convert("RGB")
    pixels = [border.getpixel((i, j)) for i in range(64) for j in (0, 1, 62, 63)] + [border.getpixel((j, i)) for i in range(64) for j in (0, 1, 62, 63)]
    return max(set(pixels), key=pixels.count)


def to_square(image: Image.Image, size: int, fit: str, focus: list[float], bg: str | None) -> Image.Image:
    image = image.convert("RGB")
    w, h = image.size
    if fit == "contain":
        colour = tuple(int(bg.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) if bg else edge_colour(image)
        scale = size / max(w, h)
        resized = image.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        canvas = Image.new("RGB", (size, size), colour)
        canvas.paste(resized, ((size - resized.width) // 2, (size - resized.height) // 2))
        return canvas
    side = min(w, h)
    left = round((w - side) * focus[0])
    top = round((h - side) * focus[1])
    return image.crop((left, top, left + side, top + side)).resize((size, size), Image.LANCZOS)


def load(spec: dict, notes: Path, size: int) -> Image.Image:
    kind = spec["kind"]
    if kind == "diagonal":
        first, second = (load(part, notes, size) for part in spec["parts"])
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).polygon([(size, 0), (size, size), (0, size)], fill=255)
        first.paste(second, (0, 0), mask)
        ImageDraw.Draw(first).line([(size, 0), (0, size)], fill=ACCENT, width=max(2, size // 120))
        return first
    if kind == "pdf":
        import fitz  # PyMuPDF

        path = notes / spec["pdf"]
        if not path.exists():
            raise MissingSource(str(path))
        with fitz.open(path) as document:
            pixmap = document[spec["page"] - 1].get_pixmap(dpi=PAGE_DPI)
        image = Image.frombytes("RGB", (pixmap.width, pixmap.height), pixmap.samples)
    elif kind == "render":
        image = Image.open(RENDERS / spec["path"])
    elif kind == "image":
        image = Image.open(WEB / spec["path"])
    else:
        raise ValueError(f"Unknown thumbnail kind: {kind}")
    return to_square(crop_fraction(image, spec.get("box")), size, spec.get("fit", "cover"), spec.get("focus", [0.5, 0.5]), spec.get("bg"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--notes", type=Path, default=ROOT.parent / "Notes", help="folder holding the manual and book PDFs")
    parser.add_argument("--only", nargs="*", help="build just these item ids")
    parser.add_argument("--sheet", type=Path, help="also write a labelled contact sheet of every built thumbnail")
    args = parser.parse_args()

    spec = json.loads(SPEC.read_text(encoding="utf-8"))
    size = spec["size"]
    built: list[tuple[str, Image.Image]] = []
    for item_id, item in spec["items"].items():
        if args.only and item_id not in args.only:
            continue
        try:
            image = load(item, args.notes, size)
        except MissingSource as missing:
            print(f"skip {item_id}: source not found ({missing})", file=sys.stderr)
            continue
        target = SPEC.parent / f"{item_id}.webp"
        image.save(target, quality=82, method=6)
        built.append((item_id, image))
        print(f"{item_id}: {target.stat().st_size // 1024} KB")

    if args.sheet and built:
        columns = 5
        rows = -(-len(built) // columns)
        gap, label = 12, 22
        sheet = Image.new("RGB", (columns * (size + gap) + gap, rows * (size + label + gap) + gap), (7, 20, 24))
        draw = ImageDraw.Draw(sheet)
        for index, (item_id, image) in enumerate(built):
            x = gap + (index % columns) * (size + gap)
            y = gap + (index // columns) * (size + label + gap)
            sheet.paste(image, (x, y))
            draw.text((x, y + size + 4), item_id, fill=(150, 220, 215))
        sheet.save(args.sheet)
    return 0


if __name__ == "__main__":
    sys.exit(main())
