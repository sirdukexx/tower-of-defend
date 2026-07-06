#!/usr/bin/env python3
"""Bake extended world maps from the craftpix Level Map art.

The original assets/worldmap/LevelAreaFull.png (1481x2962) holds one dashed
trail good for ~22 level nodes. For more levels, this script composes taller
maps by stacking "middle slab" crops of the original (y=570..2962 - the part
that contains the full trail but not the banner/kingdom/trophy top) beneath
the full map, mirroring alternate slabs for variety, and drawing dashed
connectors (matching the art's dash style: 12px on / 12px off, 6px thick,
color #4d3320 on a 60px band #e8c594) between each slab's trail end and the
next section's trail start.

game.js must agree with this layout: see WM_CROP_TOP / WM_SLAB_H / wmVariant.

Usage: python3 tools/bake_worldmap.py   (writes LevelAreaFull_x2.png / _x3.png)
"""
import math
from PIL import Image, ImageDraw

SRC = 'assets/worldmap/LevelAreaFull.png'
CROP_TOP = 570
BAND = (232, 197, 148)
DASH = (77, 51, 32)

im = Image.open(SRC).convert('RGB')
W, H = im.size
M = im.crop((0, CROP_TOP, W, H))
MH = M.height
Mf = M.transpose(Image.FLIP_LEFT_RIGHT)

# trail endpoints in original px (start = bottom-left, end = top-right)
A_START = (0.22 * W, 0.885 * H)
A_END = (0.84 * W, 0.216 * H)


def sec_pt(pt, flip, oy):
    x, y = pt
    y -= CROP_TOP
    if flip:
        x = W - x
    return (x, y + oy)


def draw_connector(img, p0, p1):
    d = ImageDraw.Draw(img)
    d.line([p0, p1], fill=BAND, width=60)
    for p in (p0, p1):
        d.ellipse([p[0] - 30, p[1] - 30, p[0] + 30, p[1] + 30], fill=BAND)
    L = math.hypot(p1[0] - p0[0], p1[1] - p0[1])
    ux, uy = (p1[0] - p0[0]) / L, (p1[1] - p0[1]) / L
    t = 0
    while t < L:
        a = (p0[0] + ux * t, p0[1] + uy * t)
        e = min(t + 12, L)
        b = (p0[0] + ux * e, p0[1] + uy * e)
        d.line([a, b], fill=DASH, width=6)
        t += 24


# x2: [A][Mf]
x2 = Image.new('RGB', (W, H + MH))
x2.paste(im, (0, 0))
x2.paste(Mf, (0, H))
draw_connector(x2, sec_pt(A_END, True, H), A_START)
x2.save('assets/worldmap/LevelAreaFull_x2.png', optimize=True)
print('x2:', x2.size)

# x3: [A][Mf][M]
x3 = Image.new('RGB', (W, H + MH * 2))
x3.paste(im, (0, 0))
x3.paste(Mf, (0, H))
x3.paste(M, (0, H + MH))
draw_connector(x3, sec_pt(A_END, False, H + MH), sec_pt(A_START, True, H))
draw_connector(x3, sec_pt(A_END, True, H), A_START)
x3.save('assets/worldmap/LevelAreaFull_x3.png', optimize=True)
print('x3:', x3.size)
