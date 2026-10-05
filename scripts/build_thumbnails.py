"""Build the course and lesson card thumbnails, the Explore gallery previews and the course banners listed in web/thumbnails/sources.json.

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
PREVIEWS = WEB / "model-previews"
BANNERS = WEB / "banners"
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


def fit_to(image: Image.Image, size: tuple[int, int], fit: str, focus: list[float], bg: str | None) -> Image.Image:
    """Resize to exactly `size`: 'cover' crops the overflow around `focus`, 'contain' pads with the figure's own background."""
    image = image.convert("RGB")
    w, h = image.size
    target_w, target_h = size
    if fit == "contain":
        colour = tuple(int(bg.lstrip("#")[i:i + 2], 16) for i in (0, 2, 4)) if bg else edge_colour(image)
        scale = min(target_w / w, target_h / h)
        resized = image.resize((max(1, round(w * scale)), max(1, round(h * scale))), Image.LANCZOS)
        canvas = Image.new("RGB", size, colour)
        canvas.paste(resized, ((target_w - resized.width) // 2, (target_h - resized.height) // 2))
        return canvas
    scale = max(target_w / w, target_h / h)
    crop_w, crop_h = round(target_w / scale), round(target_h / scale)
    left = round((w - crop_w) * focus[0])
    top = round((h - crop_h) * focus[1])
    return image.crop((left, top, left + crop_w, top + crop_h)).resize(size, Image.LANCZOS)


def shifted(image: Image.Image, shift: list[int]) -> Image.Image:
    """Slide the picture by (dx, dy) pixels, filling the gap with its own background, to place a subject off-centre."""
    canvas = Image.new("RGB", image.size, edge_colour(image))
    canvas.paste(image, (shift[0], shift[1]))
    return canvas


def load(spec: dict, notes: Path, size: tuple[int, int]) -> Image.Image:
    kind = spec["kind"]
    if kind == "diagonal":
        # The second picture fills the right of a slanted seam running from (seam[0], top) to (seam[1], bottom), as fractions of the
        # width, drawn with a teal line unless "line" is false. The default [1, 0] is the corner-to-corner diagonal of a square card.
        width, height = size
        top, bottom = spec.get("seam", [1.0, 0.0])
        first, second = (load(part, notes, size) for part in spec["parts"])
        start, end = (round(top * width), 0), (round(bottom * width), height)
        mask = Image.new("L", size, 0)
        ImageDraw.Draw(mask).polygon([start, (width, 0), (width, height), end], fill=255)
        first.paste(second, (0, 0), mask)
        if spec.get("line", True):
            ImageDraw.Draw(first).line([start, end], fill=ACCENT, width=max(2, width // 120))
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
    fitted = fit_to(crop_fraction(image, spec.get("box")), size, spec.get("fit", "cover"), spec.get("focus", [0.5, 0.5]), spec.get("bg"))
    return shifted(fitted, spec["shift"]) if spec.get("shift") else fitted


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--notes", type=Path, default=ROOT.parent / "Notes", help="folder holding the manual and book PDFs")
    parser.add_argument("--only", nargs="*", help="build just these item ids")
    parser.add_argument("--sheet", type=Path, help="also write a labelled contact sheet of every built thumbnail")
    args = parser.parse_args()

    spec = json.loads(SPEC.read_text(encoding="utf-8"))
    built: list[tuple[str, Image.Image]] = []
    jobs = [(item_id, item, (spec["size"], spec["size"]), SPEC.parent) for item_id, item in spec["items"].items()]
    jobs += [(f"preview {model_id}", item, tuple(spec["previews"]["size"]), PREVIEWS) for model_id, item in spec["previews"]["items"].items()]
    jobs += [(f"banner {pack_id}", item, tuple(spec["banners"]["size"]), BANNERS) for pack_id, item in spec["banners"]["items"].items()]
    for label, item, size, folder in jobs:
        item_id = label.removeprefix("preview ").removeprefix("banner ")
        if args.only and item_id not in args.only:
            continue
        try:
            image = load(item, args.notes, size)
        except MissingSource as missing:
            print(f"skip {label}: source not found ({missing})", file=sys.stderr)
            continue
        folder.mkdir(exist_ok=True)
        target = folder / f"{item_id}.webp"
        image.save(target, quality=82, method=6)
        built.append((label, image))
        print(f"{label}: {target.stat().st_size // 1024} KB")

    if args.sheet and built:
        size = spec["size"]
        columns = 5
        gap, caption = 12, 22
        rows = -(-len(built) // columns)
        row_height = max(image.height for _, image in built) + caption + gap
        sheet = Image.new("RGB", (columns * (max(image.width for _, image in built) + gap) + gap, rows * row_height + gap), (7, 20, 24))
        draw = ImageDraw.Draw(sheet)
        cell = max(image.width for _, image in built) + gap
        for index, (label, image) in enumerate(built):
            x = gap + (index % columns) * cell
            y = gap + (index // columns) * row_height
            sheet.paste(image, (x, y))
            draw.text((x, y + image.height + 4), label, fill=(150, 220, 215))
        sheet.save(args.sheet)
    return 0


if __name__ == "__main__":
    sys.exit(main())
