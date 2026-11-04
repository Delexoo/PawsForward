"""Bake circular / rounded brand icons for favicon + PWA (CSS cannot round tab icons)."""
from PIL import Image, ImageDraw
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BRAND = os.path.join(ROOT, "doc", "brand-mark.png")
ICONS = os.path.join(ROOT, "icons")


def make_mask(size, radius_ratio, scale=4):
    """Hi-res mask then downscale for smooth anti-aliased edges."""
    big = size * scale
    mask = Image.new("L", (big, big), 0)
    draw = ImageDraw.Draw(mask)
    if radius_ratio >= 0.49:
        draw.ellipse((0, 0, big - 1, big - 1), fill=255)
    else:
        r = max(1, int(big * radius_ratio))
        draw.rounded_rectangle((0, 0, big - 1, big - 1), radius=r, fill=255)
    return mask.resize((size, size), Image.Resampling.LANCZOS)


def rounded(src_path, size, radius_ratio=0.5, pad_ratio=0.06, out_path=None):
    src = Image.open(src_path).convert("RGBA")
    # White disc first so the circle never shows black fringes
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 255))
    pad = int(size * pad_ratio)
    inner = max(1, size - pad * 2)
    dog = src.resize((inner, inner), Image.Resampling.LANCZOS)
    canvas.paste(dog, (pad, pad), dog if dog.mode == "RGBA" else None)

    mask = make_mask(size, radius_ratio)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(canvas, (0, 0))
    out.putalpha(mask)
    if out_path:
        out.save(out_path, "PNG")
    return out


def main():
    rounded(BRAND, 64, 0.5, 0.04, os.path.join(ICONS, "favicon.png"))
    rounded(BRAND, 32, 0.5, 0.04, os.path.join(ICONS, "favicon-32.png"))
    rounded(BRAND, 192, 0.5, 0.06, os.path.join(ICONS, "icon-192.png"))
    rounded(BRAND, 512, 0.5, 0.06, os.path.join(ICONS, "icon-512.png"))
    rounded(BRAND, 180, 0.22, 0.0, os.path.join(ICONS, "apple-touch-icon.png"))

    src = Image.open(BRAND).convert("RGBA")
    maskable = Image.new("RGBA", (512, 512), (255, 255, 255, 255))
    safe = 410
    dog = src.resize((safe, safe), Image.Resampling.LANCZOS)
    maskable.paste(dog, ((512 - safe) // 2, (512 - safe) // 2))
    maskable.convert("RGB").save(os.path.join(ICONS, "icon-maskable-512.png"), "PNG")

    for name in (
        "favicon.png",
        "favicon-32.png",
        "apple-touch-icon.png",
        "icon-192.png",
        "icon-512.png",
        "icon-maskable-512.png",
    ):
        path = os.path.join(ICONS, name)
        im = Image.open(path)
        print(name, im.size, im.mode)


if __name__ == "__main__":
    main()
