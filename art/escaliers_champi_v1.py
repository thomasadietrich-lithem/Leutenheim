"""Planche « escaliers_champi_v1 » (Thomas, 2026-11-15 : « refais les escaliers de la section deux »). PROPOSITION.

Même forme que l'escalier de la section 1 (escalier droit, élargi, 16 × 16), mais taillé dans la terre de la
champignonnière : marches de terre battue tenues par des planches ou des racines, filaments de mycélium, petits
champignons lumineux sur les bords. Descente et montée.
  python3 art/escaliers_champi_v1.py         → art/escaliers_champi_v1.png
  python3 art/escaliers_champi_v1.py export  → src/render/sprites/escaliersChampi.ts
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up  # noqa: E402

K = (14, 10, 8, 255)
VOID = (6, 5, 8, 255)
FLOOR = (66, 52, 44, 255)

EARTH = [(170, 130, 96), (138, 102, 74), (108, 78, 58), (80, 58, 44), (56, 40, 32)]
PLANK = [(196, 150, 96), (150, 106, 64), (100, 68, 42)]
ROOT = [(150, 116, 84), (104, 76, 54)]
WALL = [(74, 58, 52), (54, 42, 40)]
MYC = (226, 220, 200, 255)
GLOW = [(110, 236, 210), (60, 168, 150)]
CAP = [(214, 182, 128), (150, 108, 70)]
MOSS = (96, 150, 78, 255)


def c(rgb):
    return rgb + (255,) if len(rgb) == 3 else rgb


def stairs(up_=False, edge="planches", side="terre", glow=True, steps=5):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = im.putpixel
    x0, x1 = 1, 14
    # bords : la paroi de terre
    for y in range(16):
        for x in (0, 15):
            px((x, y), c(WALL[0] if (x + y // 2) % 3 else WALL[1]))
    # marches
    n = steps
    for i in range(n):
        depth = i / (n - 1)
        shade = depth if not up_ else 1 - depth
        k = min(4, int(shade * 4.2))
        y0 = (1 if up_ else 0) + round(i * 14 / n)
        y1 = (1 if up_ else 0) + round((i + 1) * 14 / n)
        for x in range(x0, x1 + 1):
            # le nez de la marche : une planche, une racine ou de la terre tassée
            if edge == "planches":
                nose = PLANK[0] if k < 2 else PLANK[1] if k < 4 else PLANK[2]
                if x in (x0 + 4, x1 - 4):
                    nose = PLANK[2]  # joint entre deux planches
            elif edge == "racines":
                nose = ROOT[0] if (x + i) % 5 else ROOT[1]
                if k >= 3:
                    nose = ROOT[1]
            else:
                nose = EARTH[max(0, k - 1)]
            px((x, y0), c(nose))
            for y in range(y0 + 1, y1):
                px((x, y), c(EARTH[min(4, k + 1)]))
            px((x, y1 - 1), K if shade > 0.15 else c(EARTH[min(4, k + 2)]))
        # grains de terre sur la contremarche
        gx = x0 + (i * 5 + 3) % (x1 - x0)
        if y1 - 2 > y0:
            px((gx, y0 + 1), c(EARTH[min(4, k + 2)]))
    for x in range(x0, x1 + 1):
        for y in ((14, 15) if not up_ else (0,)):
            px((x, y), VOID)
    if up_:
        for x in range(x0, x1 + 1):
            px((x, 15), c(EARTH[0]))
    # mycélium : quelques filaments blancs qui descendent le long des bords
    for (x, y) in ((x0, 2), (x0, 3), (x0 + 1, 3), (x1, 6), (x1, 7), (x1 - 1, 8), (x0, 9), (x0 + 1, 10)):
        if not up_ or y < 15:
            px((x, y), MYC)
    if side == "mousse":
        for (x, y) in ((x0 + 1, 1), (x1 - 1, 4), (x1, 11), (x0 + 2, 6)):
            px((x, y), MOSS)
    # champignons lumineux sur les bords (pied clair, chapeau qui luit)
    if glow:
        for (x, y) in ((x1, 2), (x0, 6), (x1 - 1, 11)):
            px((x, y), c(GLOW[0]))
            px((x - 1 if x > 7 else x + 1, y), c(GLOW[1]))
            px((x, y + 1), MYC)
    else:
        for (x, y) in ((x1, 2), (x0, 6)):
            px((x, y), c(CAP[0]))
            px((x - 1 if x > 7 else x + 1, y), c(CAP[1]))
            px((x, y + 1), MYC)
    return im


VARIANTS = [
    ("1. Terre et planches, champignons lumineux (EN JEU)", dict(edge="planches")),
    ("2. Terre et racines, champignons lumineux", dict(edge="racines")),
    ("3. Terre tassée, mousse et morilles", dict(edge="terre", side="mousse", glow=False)),
]
IN_GAME = 0


def on_floor(im):
    big = Image.new("RGBA", (48, 48), FLOOR)
    for y in range(48):
        for x in range(48):
            if x % 16 == 0 or y % 16 == 0:
                big.putpixel((x, y), (52, 40, 34, 255))
    big.alpha_composite(im, (16, 16))
    return big


def main():
    cw, ch = 610, 210
    W = 40 + cw
    sheet = Image.new("RGB", (W, 70 + len(VARIANTS) * ch), (26, 20, 14))
    dr = ImageDraw.Draw(sheet)
    dr.text((W // 2, 24), "ESCALIERS de la section 2 — 3 déclinaisons, descente et montée", fill=(255, 243, 200), font=font(14), anchor="mm")
    for i, (name, kw) in enumerate(VARIANTS):
        x = 30
        y = 60 + i * ch
        dr.text((x, y), name, fill=(255, 243, 200), font=font(12), anchor="lm")
        xx = x
        for up_ in (False, True):
            t = stairs(up_=up_, **kw)
            a = up(t, 8)
            sheet.paste((54, 46, 64), (xx - 3, y + 14, xx + a.width + 3, y + 20 + a.height))
            sheet.paste(a, (xx, y + 17), a)
            dr.text((xx + a.width // 2, y + 30 + a.height), "descente" if not up_ else "montée", fill=(200, 190, 170), font=font(10, False), anchor="mm")
            xx += a.width + 14
            f = up(on_floor(t), 3)
            sheet.paste(f, (xx, y + 17))
            xx += f.width + 22
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "escaliers_champi_v1.png")
    sheet.save(out)
    print(out, sheet.size)


def export():
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    palette = {}

    def rows(im):
        out = []
        for y in range(16):
            row = ""
            for x in range(16):
                r, g, b, a = im.getpixel((x, y))
                if a == 0:
                    row += "."
                    continue
                key = "#%02x%02x%02x" % (r, g, b)
                if key not in palette:
                    palette[key] = letters[len(palette)]
                row += palette[key]
            out.append(row)
        return out
    name, kw = VARIANTS[IN_GAME]
    d, u = rows(stairs(**kw)), rows(stairs(up_=True, **kw))
    lines = ["// FICHIER GÉNÉRÉ par art/escaliers_champi_v1.py (export) : ne pas modifier à la main.",
             "/** Escaliers de la section 2 : %s. */" % name,
             "export const ESCALIERS_CHAMPI_PALETTE: Record<string, string> = {" + ", ".join('"%s": "%s"' % (v, k) for k, v in palette.items()) + "};",
             "export const ESCALIERS_CHAMPI = {",
             "  down: [" + ", ".join('"%s"' % r for r in d) + "],",
             "  up: [" + ", ".join('"%s"' % r for r in u) + "],",
             "};"]
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "render", "sprites", "escaliersChampi.ts")
    open(out, "w").write("\n".join(lines) + "\n")
    print("escaliersChampi.ts", len(palette), "couleurs")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        export()
    else:
        main()
