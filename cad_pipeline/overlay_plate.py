"""Draw the section of a built model over a source drawing, to compare dimensions with the plate.

The model's meshes (`geometry.json`) are cut by the plane Y = 0 (the plane through the shaft axis and cylinder 1) and
the cut lines are drawn on the plate image. Each plate half has its own calibration (`plates.json`): pixel scale, the
pixel of the shaft axis and of the cylinder-plane centre line, and the mapping from image axes to model axes. The result
is evidence for resemblance, reported with residuals; it is not a fitting step.

    python cad_pipeline/overlay_plate.py --geometry build/dev/out/geometry.json --plates cad-studies/langley-manly-balzer-1903/plates.json \
        --plate 78A --image build/langley-research/pages/hi_418_rot.png --out build/dev/overlay-78A.png [--crop x0 y0 x1 y1] [--parts A B]
"""
import argparse, json
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw


def section_segments(vertices, triangles, plane_y=0.0):
    """Line segments (pairs of (x, z)) where the triangle mesh crosses the plane Y = plane_y."""
    v = np.asarray(vertices, float)
    t = np.asarray(triangles, int)
    out = []
    y = v[:, 1] - plane_y
    for tri in t:
        d = y[tri]
        s = np.sign(d)
        if np.all(s > 0) or np.all(s < 0):
            continue
        pts = []
        for a, b in ((0, 1), (1, 2), (2, 0)):
            da, db = d[a], d[b]
            if da == 0 and db == 0:
                continue
            if (da > 0) != (db > 0) or da == 0 or db == 0:
                if da == db:
                    continue
                k = da / (da - db) if da != db else 0.0
                if 0.0 <= k <= 1.0:
                    p = v[tri[a]] + k * (v[tri[b]] - v[tri[a]])
                    pts.append((p[0], p[2]))
        if len(pts) >= 2:
            out.append((pts[0], pts[1]))
    return out


def to_pixels(x, z, cal):
    """Model (X, Z) in mm to image pixels for a plate half calibration."""
    s = cal['px_per_mm']
    return cal['x0'] + x * s * cal.get('x_sign', 1), cal['z0_px'] - (z - cal['z_ref_mm']) * s


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--geometry', required=True)
    p.add_argument('--plates', required=True)
    p.add_argument('--plate', required=True)
    p.add_argument('--image', required=True)
    p.add_argument('--out', required=True)
    p.add_argument('--crop', nargs=4, type=int)
    p.add_argument('--parts', nargs='*')
    p.add_argument('--plane-y', type=float, default=0.0)
    p.add_argument('--scale', type=float, default=1.0)
    a = p.parse_args()
    cal = json.loads(Path(a.plates).read_text())['plates'][a.plate]
    geometry = json.loads(Path(a.geometry).read_text())
    img = Image.open(a.image).convert('RGB')
    d = ImageDraw.Draw(img)
    palette = [(220, 30, 30), (30, 140, 30), (30, 60, 220), (200, 120, 0), (160, 30, 160), (0, 150, 150)]
    drawn = 0
    for i, part in enumerate(geometry['parts']):
        if a.parts and not any(part['id'].startswith(prefix) for prefix in a.parts):
            continue
        colour = palette[i % len(palette)]
        for (p0, p1) in section_segments(part['vertices_mm'], part['triangles'], a.plane_y):
            d.line([to_pixels(*p0, cal), to_pixels(*p1, cal)], fill=colour, width=2)
        drawn += 1
    if a.crop:
        img = img.crop(tuple(a.crop))
    if a.scale != 1.0:
        img = img.resize((int(img.width * a.scale), int(img.height * a.scale)))
    img.save(a.out)
    print('overlay', a.out, img.size, 'parts drawn', drawn)


if __name__ == '__main__':
    main()
