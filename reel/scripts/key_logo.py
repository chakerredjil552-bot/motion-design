"""Key the white background out of the supplied logo without redrawing it.

Every pixel keeps its colour; only alpha is derived. The logo is two colours (orange on white), so a pixel
p = a*orange + (1-a)*white gives a = (255 - p) / (255 - orange) on the most contrasting channel (blue).
Partially white edge pixels are un-premultiplied so no white fringe shows on a dark background.
Pixels darker than the orange (a >= 1) are left exactly as given.
usage: python3 scripts/key_logo.py public/logo/claude-code-original.png public/logo/claude-code.png
"""
import sys

from PIL import Image

ORANGE = (217, 119, 87)


def main(src, dst):
    im = Image.open(src).convert("RGBA")
    px = im.load()
    w, h = im.size
    out = Image.new("RGBA", (w, h))
    op = out.load()
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            a = (255 - b) / (255 - ORANGE[2])
            if a >= 1:
                op[x, y] = (r, g, b, 255)
            elif a <= 0.02:
                op[x, y] = (255, 255, 255, 0)
            else:
                un = [round(min(255, max(0, (c - (1 - a) * 255) / a))) for c in (r, g, b)]
                op[x, y] = (*un, round(a * 255))
    out.save(dst)
    bbox = out.getbbox()
    print(f"{src} -> {dst}  size {w}x{h}  opaque bbox {bbox}")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
