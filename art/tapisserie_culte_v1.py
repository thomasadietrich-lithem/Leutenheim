"""Tapisserie du culte maudit v1 (Thomas, 2026-11-16 : « dans l'église, une tapisserie derrière le pupitre, avec le
pictogramme d'une religion maudite, genre violet avec une lune ; propose des options ; les mêmes draperies, pliées,
dans certaines salles de coffre »). PROPOSITION, rien en jeu.

Quatre symboles sur la même bannière violette (40 × 24, accrochée au mur du fond, derrière l'autel de 3 cases) :
  A  LA LUNE PÂLE      : un croissant d'argent et trois étoiles ;
  B  L'ŒIL DE LA LUNE  : un œil fendu, jaune, couché dans le croissant ;
  C  LA LUNE NOIRE     : une éclipse (disque noir cerclé d'argent) et huit rayons ;
  D  LE CROISSANT RENVERSÉ : cornes vers le bas, trois gouttes qui en tombent, une étoile à sept branches au-dessus.
Et pour chacun, la même draperie PLIÉE (16 × 12, posée au sol), un coin du symbole visible.

  python3 art/tapisserie_culte_v1.py   → art/tapisserie_culte_v1.png
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up  # noqa: E402
from dortoir_v2 import Sprite, C  # noqa: E402

C.update({
    "vio": (92, 40, 120, 255), "vio_d": (60, 24, 82, 255), "vio_l": (128, 64, 156, 255), "vio_dd": (40, 16, 56, 255),
    "sil": (196, 200, 214, 255), "sil_d": (128, 132, 150, 255), "moon": (232, 234, 244, 255),
    "rod2": (70, 60, 72, 255), "rod2_l": (120, 112, 124, 255),
    "eye": (240, 200, 70, 255), "pupil": (30, 10, 30, 255), "black": (18, 10, 24, 255),
    "drop": (170, 120, 210, 255),
    "brick": (88, 84, 96), "brick_d": (60, 56, 68), "brick_l": (112, 108, 120), "floor": (70, 64, 60),
})

BW, BH = 40, 24
CX, CY = 20, 11  # centre du symbole


def disk(s, cx, cy, r, c, cut=None):
    """Disque plein (moins un disque `cut` = (dx, dy, r) pour un croissant)."""
    h, w = s.a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    m = (xx - cx) ** 2 + (yy - cy) ** 2 <= r * r
    if cut:
        dx, dy, r2 = cut
        m &= (xx - cx - dx) ** 2 + (yy - cy - dy) ** 2 > r2 * r2
    s.a[m] = C[c]
    return s


def banner_base():
    s = Sprite(BW, BH)
    # Tringle de fer noirci, deux embouts.
    s.r(0, 0, BW, 2, "rod2").r(0, 0, BW, 1, "rod2_l").r(0, 0, 2, 3, "sil_d").r(BW - 2, 0, 2, 3, "sil_d")
    # Le tissu, un peu plus étroit, avec des plis verticaux.
    s.r(2, 2, BW - 4, 18, "vio")
    for x in (8, 15, 25, 32):
        s.r(x, 2, 1, 18, "vio_d")
        s.r(x + 1, 2, 1, 18, "vio_l")
    s.r(2, 2, 1, 18, "vio_l").r(BW - 3, 2, 1, 18, "vio_dd")
    # Galon d'argent terni, en haut et en bas.
    s.r(3, 3, BW - 6, 1, "sil_d").r(3, 18, BW - 6, 1, "sil_d")
    # Bas en pointes (trois languettes) et franges.
    for x0 in (2, 14, 26):
        for i in range(12):
            depth = 3 - abs(i - 5.5) // 2
            s.r(x0 + i, 20, 1, int(depth), "vio")
    for x in range(3, BW - 3, 2):
        s.p(x, 20 + (1 if (x // 2) % 3 else 2), "sil_d")
    # Le fond du médaillon, plus sombre, pour faire ressortir le symbole.
    disk(s, CX, CY, 7, "vio_dd")
    return s


def sym_pale(s, cx=CX, cy=CY, small=False):
    r = 3 if small else 5
    disk(s, cx, cy, r, "moon", cut=(2 if small else 2, -1, r - 1 if small else r - 1))
    if not small:
        for x, y in ((cx + 4, cy - 4), (cx + 5, cy + 1), (cx + 2, cy + 4)):
            s.p(x, y, "sil")
        s.p(cx + 4, cy - 5, "sil_d").p(cx + 4, cy - 3, "sil_d")
    return s


def sym_eye(s, cx=CX, cy=CY, small=False):
    r = 3 if small else 5
    disk(s, cx, cy, r, "moon", cut=(2, 0, r - 1))
    if not small:
        # L'œil couché dans le creux du croissant : amande jaune, pupille fendue.
        for i, h in enumerate((1, 3, 3, 3, 3, 3, 1)):
            s.r(cx - 1 + i, cy - h // 2, 1, h, "eye")
        s.r(cx + 2, cy - 1, 1, 3, "pupil")
        s.r(cx - 1, cy - 2, 7, 1, "sil_d").r(cx - 1, cy + 2, 7, 1, "sil_d")
    else:
        s.p(cx + 1, cy, "eye")
    return s


def sym_black(s, cx=CX, cy=CY, small=False):
    r = 3 if small else 4
    if not small:
        for dx, dy in ((0, -6), (0, 6), (-6, 0), (6, 0), (-4, -4), (4, -4), (-4, 4), (4, 4)):
            s.p(cx + dx, cy + dy, "sil")
            s.p(cx + int(dx * 0.85), cy + int(dy * 0.85), "sil_d")
    disk(s, cx, cy, r + 1, "sil")
    disk(s, cx, cy, r, "black")
    s.p(cx - 1, cy - 1, "vio_dd")
    return s


def sym_reversed(s, cx=CX, cy=CY, small=False):
    r = 3 if small else 5
    # Croissant cornes en bas : le disque évidé par le bas.
    disk(s, cx, cy - (0 if small else 1), r, "moon", cut=(0, 2, r - 1))
    if not small:
        # Étoile à sept branches, au-dessus.
        s.p(cx, cy - 7, "sil").p(cx - 1, cy - 6, "sil_d").p(cx + 1, cy - 6, "sil_d").p(cx, cy - 6, "moon")
        # Trois gouttes qui tombent entre les cornes.
        for x, y in ((cx - 2, cy + 3), (cx, cy + 5), (cx + 2, cy + 3)):
            s.p(x, y, "drop").p(x, y + 1, "vio_l")
    return s


SYMBOLS = [
    ("A", "La Lune pâle", sym_pale),
    ("B", "L'Œil de la Lune", sym_eye),
    ("C", "La Lune noire", sym_black),
    ("D", "Le Croissant renversé", sym_reversed),
]


def banner(sym):
    s = banner_base()
    sym(s)
    return s.done()


def folded(sym):
    """La draperie pliée, posée au sol (16 × 12) : trois épaisseurs, le galon, un coin du symbole."""
    s = Sprite(16, 12)
    s.r(1, 10, 14, 2, (0, 0, 0, 70))  # ombre
    # Trois épaisseurs, la plus basse un peu décalée.
    s.r(2, 7, 13, 3, "vio_d").r(2, 9, 13, 1, "vio_dd").r(3, 8, 11, 1, "sil_d")
    s.r(1, 4, 13, 3, "vio").r(1, 6, 13, 1, "vio_d").r(1, 4, 13, 1, "vio_l")
    s.r(2, 1, 12, 3, "vio").r(2, 1, 12, 1, "vio_l").r(2, 3, 12, 1, "vio_d")
    # Le galon d'argent sur la tranche, les franges qui dépassent.
    s.r(1, 5, 13, 1, "sil_d")
    for x in (14, 15):
        s.p(x, 5, "sil_d").p(x, 8, "sil_d")
    # Un morceau du symbole sur le dessus.
    sym(s, cx=10, cy=2, small=True)
    s.r(0, 0, 16, 1, (0, 0, 0, 0))  # rien ne dépasse au-dessus du pli
    return s.done()


def wall_strip(w_cells=3):
    """Un bout de mur du fond (briques) et une rangée de sol, pour voir la bannière en place."""
    W = w_cells * 16
    im = Image.new("RGBA", (W, 40), C["floor"] + (255,))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, W - 1, 15), fill=C["brick_d"] + (255,))
    for row in range(3):
        y = 1 + row * 5
        off = (row % 2) * 4
        for x in range(-off, W, 8):
            d.rectangle((x + 1, y, x + 7, y + 3), fill=C["brick"] + (255,))
            d.line((x + 1, y, x + 7, y), fill=C["brick_l"] + (255,))
    d.rectangle((0, 16, W - 1, 17), fill=(40, 36, 44, 255))
    return im


def main():
    S = 5
    col = 280
    W = 30 + col * len(SYMBOLS)
    H = 520
    sheet = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 22), "TAPISSERIE DU CULTE MAUDIT v1 — 4 symboles (bannière derrière l'autel ; pliée dans les salles au trésor)",
           fill=(255, 243, 200), font=font(15), anchor="mm")
    for i, (key, name, sym) in enumerate(SYMBOLS):
        x0 = 20 + i * col
        d.text((x0 + col // 2 - 10, 52), f"{key} · {name}", fill=(232, 212, 150), font=font(15), anchor="mm")
        # La bannière seule, agrandie.
        b = up(banner(sym).img(), S)
        bg = Image.new("RGB", (col - 20, 140), (54, 48, 60))
        bg.paste(b, ((bg.width - b.width) // 2, 10), b)
        sheet.paste(bg, (x0, 70))
        # En place : sur le mur du fond, 3 cases.
        strip = wall_strip()
        banner_img = banner(sym).img()
        strip.alpha_composite(banner_img, (4, 0))
        st = up(strip, 4)
        sheet.paste(st, (x0 + (col - 20 - st.width) // 2, 225), st)
        d.text((x0 + col // 2 - 10, 395), "en place (mur du fond)", fill=(170, 160, 140), font=font(11, False), anchor="mm")
        # Pliée, au sol.
        f = up(folded(sym).img(), 6)
        fg = Image.new("RGB", (120, 90), (70, 64, 60))
        fg.paste(f, ((120 - f.width) // 2, (90 - f.height) // 2), f)
        sheet.paste(fg, (x0 + (col - 20 - 120) // 2, 410))
        d.text((x0 + col // 2 - 10, 508), "pliée (salle au trésor)", fill=(170, 160, 140), font=font(11, False), anchor="mm")
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tapisserie_culte_v1.png")
    sheet.save(out)
    print("art/tapisserie_culte_v1.png", sheet.size)


if __name__ == "__main__":
    main()
