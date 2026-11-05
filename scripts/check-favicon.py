from PIL import Image
import base64
from pathlib import Path

im = Image.open("icons/favicon.png").convert("RGBA")
print("corner", im.getpixel((0, 0)))
print("near-corner", im.getpixel((2, 2)))
print("edge mid", im.getpixel((32, 0)))
print("center", im.getpixel((32, 32)))

# Prefer SVG as circle reference without embedding huge PNG — simple clip of brand colors
# Keep PNG as primary; write tiny SVG circle mark for completeness
b64 = base64.b64encode(Path("icons/favicon.png").read_bytes()).decode()
Path("icons/favicon.svg").write_text(
    f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="PawsForward">'
    f'<image href="data:image/png;base64,{b64}" width="64" height="64"/></svg>\n',
    encoding="utf-8",
)
print("svg ok", Path("icons/favicon.svg").stat().st_size)
