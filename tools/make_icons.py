#!/usr/bin/env python3
"""Render the extension icon set from the side-panel camera glyph.

Usage: python tools/make_icons.py
Writes icons/icon16.png, icon32.png, icon48.png and icon128.png.

Requires Pillow (`pip install Pillow`). Only re-run this when the glyph or
palette changes; the generated PNGs are committed to the repository so that
loading the unpacked extension never needs a build step.
"""
from pathlib import Path

from PIL import Image, ImageDraw

# Matches --ink and the white brand mark used in sidepanel/sidepanel.css.
# Deliberately not Facebook blue (#1877F2): the extension is independent of Meta.
BACKGROUND = (25, 50, 74, 255)
GLYPH = (255, 255, 255, 255)
SIZES = (16, 32, 48, 128)
SUPERSAMPLE = 8
ICON_DIR = Path(__file__).resolve().parent.parent / "icons"


def draw(size: int, simplified: bool) -> Image.Image:
    """Draw one icon at `size` px, supersampled then downscaled for clean edges."""
    s = size * SUPERSAMPLE
    image = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    pen = ImageDraw.Draw(image)
    u = s / 32.0  # The glyph is authored on the 32x32 grid of the side-panel SVG.

    pen.rounded_rectangle((0, 0, s - 1, s - 1), radius=7 * u, fill=BACKGROUND)

    stroke = round((3.0 if simplified else 2.1) * u)
    if not simplified:
        # Viewfinder bump above the body: M10 7 V4.5 H18 L20 7.
        pen.line(
            [(10 * u, 7 * u), (10 * u, 4.6 * u), (18 * u, 4.6 * u), (20.2 * u, 7 * u)],
            fill=GLYPH, width=stroke, joint="curve",
        )

    body = (4.6 * u, 7.6 * u, 27.4 * u, 25.4 * u)
    pen.rounded_rectangle(body, radius=3 * u, outline=GLYPH, width=stroke)

    lens = 5.6 * u if simplified else 6.3 * u
    pen.ellipse(
        (16 * u - lens, 16.5 * u - lens, 16 * u + lens, 16.5 * u + lens),
        outline=GLYPH, width=stroke,
    )
    if not simplified:
        # Download arrow inside the lens, the one mark that is not in the SVG.
        pen.line([(16 * u, 12.9 * u), (16 * u, 18.0 * u)], fill=GLYPH, width=stroke)
        pen.polygon(
            [(13.6 * u, 17.0 * u), (18.4 * u, 17.0 * u), (16 * u, 20.3 * u)],
            fill=GLYPH,
        )

    return image.resize((size, size), Image.LANCZOS)


def main() -> None:
    ICON_DIR.mkdir(exist_ok=True)
    for size in SIZES:
        path = ICON_DIR / f"icon{size}.png"
        draw(size, simplified=size <= 32).save(path, optimize=True)
        print(f"wrote {path.relative_to(ICON_DIR.parent)}")


if __name__ == "__main__":
    main()
