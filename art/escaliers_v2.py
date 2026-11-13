"""Planche « escaliers_v2 » (Thomas, 2026-11-13 : « propose des nouveaux designs d'escalier »). PROPOSITION.

Six pistes, chacune en DESCENTE et en MONTÉE, dessinées à 16 × 16 comme une case du jeu, puis posées sur un bout de sol
pour juger l'effet. Vue de dessus légèrement plongeante, comme le reste du jeu.
  python3 art/escaliers_v2.py → art/escaliers_v2.png
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up  # noqa: E402

K = (18, 13, 8, 255)
VOID = (6, 5, 10, 255)
STONE = [(78, 85, 112, 255), (127, 136, 166, 255), (164, 171, 200, 255), (195, 203, 224, 255)]
WOOD = [(90, 56, 23, 255), (122, 82, 48, 255), (154, 106, 52, 255), (185, 130, 74, 255)]
FIRE = [(255, 216, 74, 255), (232, 120, 42, 255), (192, 58, 26, 255)]
MOSS = [(46, 122, 56, 255), (92, 200, 96, 255)]
FLOOR = (60, 58, 72, 255)


def tile():
    return Image.new("RGBA", (16, 16), (0, 0, 0, 0))


def px(im, x, y, c):
    if 0 <= x < 16 and 0 <= y < 16:
        im.putpixel((x, y), c)


def frame(im):
    for i in range(16):
        for (x, y) in ((i, 0), (i, 15), (0, i), (15, i)):
            px(im, x, y, K)


def spiral(up_):
    """Puits en colimaçon : des marches de pierre en éventail qui tournent autour d'un pilier, vers le noir."""
    im = tile()
    for y in range(16):
        for x in range(16):
            dx, dy = x - 7.5, y - 7.5
            r = math.hypot(dx, dy)
            if r > 7.6:
                continue
            a = (math.atan2(dy, dx) + math.pi) / (2 * math.pi)
            step = int(a * 8)
            depth = step / 7 if not up_ else 1 - step / 7
            if r < 2:
                c = STONE[2]
            elif r > 6.8:
                c = K
            else:
                shade = int((1 - depth) * 3.4)
                c = STONE[max(0, min(3, shade))] if depth < 0.85 else VOID
                if int(a * 8 * 4) % 4 == 0:
                    c = K
            px(im, x, y, c)
    return im


def trapdoor(up_):
    """Trappe de bois ouverte et une échelle (descente) ; ou l'échelle qui monte vers une trappe éclairée (montée)."""
    im = tile()
    for y in range(2, 15):
        for x in range(2, 14):
            px(im, x, y, VOID if not up_ else (40, 34, 30, 255))
    if up_:
        for y in range(2, 6):
            for x in range(3, 13):
                px(im, x, y, (255, 236, 160, 255) if (x + y) % 3 else (240, 200, 110, 255))
    for y in range(3, 15):
        px(im, 5, y, WOOD[2])
        px(im, 10, y, WOOD[1])
        if y % 3 == 0:
            for x in range(5, 11):
                px(im, x, y, WOOD[3])
    for x in range(1, 15):  # cadre
        px(im, x, 1, WOOD[1])
        px(im, x, 15, WOOD[0])
    for y in range(1, 16):
        px(im, 1, y, WOOD[1])
        px(im, 14, y, WOOD[0])
    if not up_:
        for x in range(2, 14):  # le battant rabattu en haut
            px(im, x, 0, WOOD[3])
    return im


def rubble(up_):
    """Éboulement : une pente de gros blocs et de gravats qui plonge (ou grimpe) dans le noir."""
    im = tile()
    for y in range(16):
        for x in range(16):
            t = y / 15 if not up_ else 1 - y / 15
            px(im, x, y, VOID if t > 0.75 else (40, 36, 48, 255))
    stones = [(3, 2, 2), (8, 1, 2), (12, 3, 2), (5, 5, 2), (10, 6, 2), (2, 8, 1), (7, 9, 2), (12, 9, 1), (4, 12, 1), (9, 12, 1), (13, 13, 1), (6, 14, 1)]
    for sx, sy, r in stones:
        if up_:
            sy = 15 - sy
        t = sy / 15 if not up_ else 1 - sy / 15
        base = 3 - min(3, int(t * 4))
        for y in range(sy - r, sy + r + 1):
            for x in range(sx - r - 1, sx + r + 2):
                if (x - sx) ** 2 / (r + 1.2) ** 2 + (y - sy) ** 2 / (r + 0.4) ** 2 <= 1:
                    c = STONE[base]
                    if y == sy - r:
                        c = STONE[min(3, base + 1)]
                    if y == sy + r:
                        c = K
                    px(im, x, y, c)
    return im


def grand(up_):
    """Grand escalier de pierre encadré de deux braseros qui brûlent."""
    im = tile()
    for i in range(6):
        y0 = 3 + i * 2
        shade = STONE[3 - min(3, i // 2)] if not up_ else STONE[min(3, i // 2)]
        for x in range(3, 13):
            px(im, x, y0, shade)
            px(im, x, y0 + 1, K if i < 5 else VOID)
    if not up_:
        for x in range(4, 12):
            px(im, x, 14, VOID)
    for bx in (1, 14):
        for y in range(9, 15):
            px(im, bx, y, STONE[0])
        px(im, bx, 8, FIRE[1])
        px(im, bx, 7, FIRE[0])
        px(im, bx, 6, FIRE[0] if bx == 1 else FIRE[1])
    return im


def mine(up_):
    """Puits de mine : un trou rond, un treuil de bois, une corde et un seau."""
    im = tile()
    for y in range(16):
        for x in range(16):
            r = math.hypot(x - 7.5, y - 9)
            if r < 5.5:
                px(im, x, y, VOID if r < 4.5 else STONE[1])
    for x in range(1, 15):
        px(im, x, 2, WOOD[2])
        px(im, x, 3, WOOD[0])
    for y in range(2, 7):
        px(im, 1, y, WOOD[1])
        px(im, 14, y, WOOD[1])
    for y in range(4, 10 if not up_ else 7):
        px(im, 8, y, (220, 200, 150, 255))
    by = 10 if not up_ else 6
    for x in range(6, 11):
        px(im, x, by, WOOD[3])
        px(im, x, by + 1, WOOD[1])
    px(im, 6, by - 1, K)
    px(im, 10, by - 1, K)
    return im


def roots(up_):
    """Racines : des marches taillées dans de grosses racines moussues qui s'enfoncent sous terre."""
    im = tile()
    for y in range(16):
        for x in range(16):
            t = y / 15 if not up_ else 1 - y / 15
            px(im, x, y, VOID if t > 0.7 else (50, 38, 30, 255))
    for i in range(5):
        y0 = 2 + i * 3
        for x in range(2 + (i % 2), 14 - (i % 2)):
            px(im, x, y0, WOOD[1 + (x + i) % 2])
            px(im, x, y0 + 1, WOOD[0])
        px(im, 2 + (i % 2) + (i * 3) % 7, y0, MOSS[1])
        px(im, 6 + (i * 5) % 6, y0, MOSS[0])
    return im


DESIGNS = [
    ("A. Colimaçon", spiral, "un puits de marches en spirale autour d'un pilier"),
    ("B. Trappe et échelle", trapdoor, "un battant de bois, une échelle ; en montée, la lumière d'en haut"),
    ("C. Éboulement", rubble, "une pente de gravats, pour les étages en ruine"),
    ("D. Grand escalier", grand, "larges marches et deux braseros : pour l'étage du boss"),
    ("E. Puits de mine", mine, "treuil, corde et seau : pour une section « mines »"),
    ("F. Racines", roots, "marches dans des racines moussues : pour une section « grottes »"),
]


def on_floor(im):
    """Posé au milieu d'un carré de 3 × 3 cases de sol."""
    big = Image.new("RGBA", (48, 48), FLOOR)
    for y in range(48):
        for x in range(48):
            if (x % 16 == 0) or (y % 16 == 0):
                big.putpixel((x, y), (48, 46, 58, 255))
    big.alpha_composite(im, (16, 16))
    return big


def main():
    W, S = 1100, 4
    sheet = Image.new("RGB", (W, 60 + len(DESIGNS) * 230), (26, 20, 14))
    dr = ImageDraw.Draw(sheet)
    dr.text((W // 2, 24), "ESCALIERS v2 — six pistes, descente et montée (proposition)", fill=(255, 243, 200), font=font(15), anchor="mm")
    for i, (name, fn, note) in enumerate(DESIGNS):
        y = 60 + i * 230
        dr.text((40, y), name, fill=(255, 243, 200), font=font(13), anchor="lm")
        dr.text((40, y + 20), note, fill=(200, 190, 170), font=font(11, False), anchor="lm")
        x = 40
        for up_ in (False, True):
            t = fn(up_)
            a = up(t, S * 2)
            sheet.paste((54, 46, 64), (x - 4, y + 36, x + a.width + 4, y + 40 + a.height))
            sheet.paste(a, (x, y + 38), a)
            dr.text((x + a.width // 2, y + 46 + a.height + 8), "descente" if not up_ else "montée", fill=(220, 210, 190), font=font(11, False), anchor="mm")
            x += a.width + 30
            f = up(on_floor(t), S)
            sheet.paste(f, (x, y + 38))
            x += f.width + 40
    sheet.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "escaliers_v2.png"))
    print("art/escaliers_v2.png", sheet.size)


if __name__ == "__main__":
    main()
