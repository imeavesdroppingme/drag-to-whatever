#!/usr/bin/env python3
"""Rasterize the playful hand-drop mark to PNG action icons."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw

OUT = Path(__file__).resolve().parent.parent / "icons"
AMBER = (214, 122, 42, 255)
CREAM = (247, 243, 236, 255)
CREAM_DIM = (232, 223, 210, 255)
CHARCOAL = (31, 31, 34, 255)
SKIN = (242, 194, 154, 255)
SKIN_SHADOW = (232, 180, 137, 255)
SKIN_LINE = (196, 138, 85, 255)


def rotate_point(x: float, y: float, cx: float, cy: float, deg: float) -> tuple[float, float]:
    rad = math.radians(deg)
    cos_a, sin_a = math.cos(rad), math.sin(rad)
    dx, dy = x - cx, y - cy
    return cx + dx * cos_a - dy * sin_a, cy + dx * sin_a + dy * cos_a


def draw_icon(size: int) -> Image.Image:
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    s = size / 32.0

    def P(*vals: float) -> list[float]:
        return [v * s for v in vals]

    # Tile
    d.rounded_rectangle(P(1, 1, 31, 31), radius=8 * s, fill=CHARCOAL)
    d.rounded_rectangle(
        P(1.75, 1.75, 30.25, 30.25),
        radius=7.25 * s,
        outline=AMBER,
        width=max(1, round(1.5 * s)),
    )

    # Floating paper (approx rotated rect via polygon)
    paper = [(17.2, 3.2), (26.4, 3.2), (26.4, 14.7), (17.2, 14.7)]
    # rotate around top-left-ish of paper by 18deg
    cx, cy = 17.2, 3.2
    paper_r = [rotate_point(x, y, cx, cy, 18) for x, y in paper]
    d.polygon([(x * s, y * s) for x, y in paper_r], fill=CREAM)

    # fold corner
    fold = [rotate_point(22.8, 3.2, cx, cy, 18), rotate_point(26.4, 6.4, cx, cy, 18), rotate_point(22.8, 6.4, cx, cy, 18)]
    d.polygon([(x * s, y * s) for x, y in fold], fill=CREAM_DIM)

    # paper lines
    for y0 in (5.2, 7.4, 9.6):
        x1, y1 = rotate_point(19.3, y0, cx, cy, 18)
        x2 = 24.3 if y0 < 9 else 22.6
        x2, y2 = rotate_point(x2, y0, cx, cy, 18)
        d.line([(x1 * s, y1 * s), (x2 * s, y2 * s)], fill=AMBER, width=max(1, round(0.9 * s)))

    # Motion dashes
    w = max(1, round(1.2 * s))
    d.line(P(14.2, 9.5, 15.8, 7.8), fill=AMBER, width=w)
    d.line(P(12.6, 11.4, 14.0, 9.9), fill=AMBER, width=w)

    # Open hand (simplified blob + fingers)
    hand = [
        (7.2, 26.2),
        (7.2, 24.0),
        (9.4, 23.8),
        (9.6, 21.7),
        (11.6, 21.5),
        (12.0, 22.8),
        (13.2, 20.7),
        (15.0, 20.7),
        (15.4, 22.6),
        (16.8, 21.0),
        (18.6, 21.2),
        (18.8, 23.6),
        (20.2, 23.2),
        (21.0, 25.0),
        (19.6, 26.8),
        (11.0, 28.4),
        (8.2, 27.6),
    ]
    d.polygon([(x * s, y * s) for x, y in hand], fill=SKIN)

    # Thumb
    thumb = [(6.2, 23.6), (5.8, 25.0), (6.8, 26.6), (8.0, 25.8), (7.8, 24.0)]
    d.polygon([(x * s, y * s) for x, y in thumb], fill=SKIN_SHADOW)

    # Finger crease hints
    lw = max(1, round(0.7 * s))
    d.arc(P(9.0, 20.5, 13.0, 24.5), start=200, end=320, fill=SKIN_LINE, width=lw)
    d.arc(P(13.0, 19.8, 16.5, 23.5), start=200, end=320, fill=SKIN_LINE, width=lw)
    d.arc(P(16.5, 20.2, 19.5, 23.8), start=200, end=320, fill=SKIN_LINE, width=lw)

    # Palm speck
    r = max(0.6, 0.55 * s)
    d.ellipse([11.6 * s - r, 25.4 * s - r, 11.6 * s + r, 25.4 * s + r], fill=SKIN_LINE)

    return img


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for size in (16, 32, 48, 128):
        draw_icon(size).save(OUT / f"icon{size}.png", optimize=True)
    print(f"icons written to {OUT}")


if __name__ == "__main__":
    main()
