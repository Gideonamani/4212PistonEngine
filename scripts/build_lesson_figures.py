"""Builds the manual figures used inside lessons (web/lesson-media/*.webp) from web/lesson-media/figure-sources.json.

Each entry names the figure's file, the PDF it comes from (a path under the Notes folder), the page, and the crop as fractions of the page
(left, top, right, bottom). The script renders just that part of the page, so a figure can be redone at a different size or crop, and anyone
can see exactly which part of which page it is. Credits and licences stay in attribution.json, which the Credits page is built from.

  python scripts/build_lesson_figures.py --notes "../Notes"
  python scripts/build_lesson_figures.py --notes "../Notes" --only faa-valve-types --sheet figures.png

The Notes folder is not part of the repository: a source PDF that is missing is skipped with a warning and the committed image is kept.
"""
import argparse
import json
import sys
from pathlib import Path

import fitz  # PyMuPDF
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
MEDIA = ROOT / 'web' / 'lesson-media'
SOURCES = MEDIA / 'figure-sources.json'
DEFAULT_WIDTH = 1100


def render(pdf: fitz.Document, spec: dict) -> Image.Image:
    page = pdf[spec['page'] - 1]
    left, top, right, bottom = spec['box']
    if not (0 <= left < right <= 1 and 0 <= top < bottom <= 1):
        raise ValueError(f"box must be fractions with left < right and top < bottom, got {spec['box']}")
    rect = fitz.Rect(page.rect.x0 + left * page.rect.width, page.rect.y0 + top * page.rect.height,
                     page.rect.x0 + right * page.rect.width, page.rect.y0 + bottom * page.rect.height)
    width = spec.get('width', DEFAULT_WIDTH)
    zoom = width / rect.width
    pixmap = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=rect, alpha=False)
    return Image.frombytes('RGB', (pixmap.width, pixmap.height), pixmap.samples)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--notes', default=str(ROOT.parent / 'Notes'), help='folder holding the source PDFs')
    parser.add_argument('--only', nargs='+', help='build only these figure ids')
    parser.add_argument('--sheet', help='also write a contact sheet of what was built to this PNG, to look at the crops')
    args = parser.parse_args()

    notes = Path(args.notes)
    figures = json.loads(SOURCES.read_text(encoding='utf-8'))
    built: list[tuple[str, Image.Image]] = []
    documents: dict[str, fitz.Document] = {}
    status = 0
    for figure_id, spec in figures.items():
        if args.only and figure_id not in args.only:
            continue
        pdf_path = notes / spec['pdf']
        if not pdf_path.exists():
            print(f'skip {figure_id}: {pdf_path} not found (the committed image is kept)', file=sys.stderr)
            continue
        if spec['pdf'] not in documents:
            documents[spec['pdf']] = fitz.open(pdf_path)
        try:
            image = render(documents[spec['pdf']], spec)
        except Exception as error:  # a bad box or page number must not stop the other figures
            print(f'FAILED {figure_id}: {error}', file=sys.stderr)
            status = 1
            continue
        out = MEDIA / f'{figure_id}.webp'
        image.save(out, 'WEBP', quality=86, method=6)
        print(f'{figure_id}: {image.width}x{image.height}, {out.stat().st_size // 1024} KB')
        built.append((figure_id, image))

    if args.sheet and built:
        cell = 520
        columns = 2
        rows = (len(built) + columns - 1) // columns
        sheet = Image.new('RGB', (columns * cell, rows * cell), 'white')
        for index, (_, image) in enumerate(built):
            thumb = image.copy()
            thumb.thumbnail((cell - 10, cell - 10))
            sheet.paste(thumb, ((index % columns) * cell + 5, (index // columns) * cell + 5))
        sheet.save(args.sheet)
    return status


if __name__ == '__main__':
    raise SystemExit(main())
