"""Cuisine des Schrats, v1 (Thomas, 2026-11-11 : « Design la cuisine. Étagère à ustensiles 1-3. Plan de travail
ensanglanté 1. Viande avariée, mouches, suspendue au plafond 0-2. Carrelage plus clair et fendu. Table, pommes 0-4.
Rigole dans le carrelage avec évacuation »).

Même vue de 3/4 plongeante que le dortoir (validé) ; même palette, même contour. Écrit art/cuisine_v1.png (la salle,
puis chaque élément). Lancer depuis la racine du dépôt.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
from pix import hash2, fbm, grid, to_img, up, font, hexrgb
from dortoir_v2 import Sprite, C, T, walls, chair
from dortoir_v3 import table_v3

C.update({
    "oak_d": (52, 32, 16, 255), "oak": (86, 56, 28, 255), "oak_l": (112, 76, 40, 255), "oak_h": (138, 98, 56, 255),
    "copper": (184, 104, 52, 255), "copper_d": (120, 62, 30, 255), "copper_h": (226, 150, 90, 255),
    "blood": (128, 24, 30, 255), "blood_d": (82, 14, 20, 255),
    "meat": (150, 70, 70, 255), "meat_d": (104, 44, 50, 255), "rot": (112, 120, 60, 255), "fat": (214, 196, 160, 255),
    "fly": (16, 14, 20, 255), "chain": (90, 94, 110, 255),
})


def tiles_floor(xs, ys):
    """Carrelage clair (carreaux d'une demi-case), joints gris, quelques carreaux fendus, de la crasse dans les coins."""
    cell = 8
    cx, cy = (xs // cell).astype(int), (ys // cell).astype(int)
    lx, ly = xs % cell, ys % cell
    tint = 0.92 + 0.12 * hash2(cx, cy, 601)
    base = np.array(hexrgb("#7a7886"), float)
    out = base[None, None, :] * tint[..., None]
    out[(lx == 1) | (ly == 1)] *= 1.08
    joint = (lx == 0) | (ly == 0)
    out[joint] = hexrgb("#4e4c58")
    cracked = (hash2(cx, cy, 602) < 0.14) & (np.abs(lx - ly * (0.4 + hash2(cx, cy, 603))) < 0.6) & (lx > 1)
    out[cracked] = hexrgb("#46444e")
    grime = fbm(xs, ys, 20, 604, 2) < 0.38
    out[grime & ~joint] *= 0.82
    return out


def gutter(out, x0, y0, x1, drain_x):
    """Rigole creusée dans le carrelage (une ligne sombre de 2 pixels, bord clair au-dessus) jusqu'à une évacuation ronde."""
    out[y0, x0:x1] = hexrgb("#a8a6b2")
    out[y0 + 1:y0 + 3, x0:x1] = hexrgb("#2a2632")
    out[y0 + 2, x0:x1] = hexrgb("#3a2228")  # un fond rougi
    for y in range(y0 - 4, y0 + 7):
        for x in range(drain_x - 5, drain_x + 6):
            d = ((x - drain_x) / 5.2) ** 2 + ((y - y0 - 1) / 4.2) ** 2
            if d <= 0.62:
                out[y, x] = hexrgb("#141018") if (x - drain_x) % 2 else hexrgb("#5a5f74")
            elif d <= 1.0:
                out[y, x] = hexrgb("#8a90a8") if y < y0 + 1 else hexrgb("#4e5570")


def shelf(variant=0):
    """Étagère à ustensiles contre le mur : deux planches, casseroles de cuivre, louches et couteaux pendus."""
    s = Sprite(16, 30)
    s.r(1, 28, 14, 2, "shadow")
    s.r(0, 0, 2, 28, "oak").r(14, 0, 2, 28, "oak").r(0, 0, 1, 28, "oak_h")
    for y in (8, 18):
        s.r(0, y, 16, 2, "oak_l").r(0, y, 16, 1, "oak_h")
    # En haut : pots et bocaux ; au milieu : casseroles ; en bas : louche et couteaux pendus.
    s.r(3, 4, 3, 4, "copper").r(3, 4, 3, 1, "copper_h").r(8, 3, 4, 5, "sheet_s").r(8, 3, 4, 1, "sheet_w").r(9, 5, 2, 2, "red_d")
    s.r(2, 13, 5, 5, "copper").r(2, 13, 5, 1, "copper_h").r(7, 15, 2, 1, "oak_d").r(9, 12, 4, 6, "copper_d").r(9, 12, 4, 1, "copper")
    for x, ln in ((3, 6), (6, 7), (9, 5), (12, 6)):
        s.r(x, 20, 1, 2, "iron_l" if variant else "oak_d")
        s.r(x - (1 if x == 3 else 0), 22, 2 if x == 3 else 1, ln - 2, "iron_l" if x != 3 else "copper")
    return s.done()


def counter():
    """Plan de travail (2 cases), dessus taché de sang qui coule sur la face, un hachoir planté, un quartier de viande."""
    s = Sprite(32, 22)
    s.r(1, 20, 30, 2, "shadow")
    s.r(0, 2, 32, 9, "oak_l").r(0, 2, 32, 1, "oak_h")
    for y in (5, 8):
        s.r(1, y, 30, 1, "oak")
    s.r(0, 11, 32, 8, "oak").r(0, 18, 32, 1, "oak_d")
    for x in (1, 29):
        s.r(x, 11, 2, 9, "oak_d")
    # Sang : grande flaque sur le dessus, coulures sur la face.
    for (x, y, w, h) in ((6, 4, 9, 4), (5, 5, 11, 2), (18, 6, 4, 2)):
        s.r(x, y, w, h, "blood")
    s.r(8, 5, 4, 2, "blood_d")
    for x, ln in ((7, 5), (10, 3), (13, 6), (19, 2)):
        s.r(x, 11, 1, ln, "blood")
    # Quartier de viande et hachoir planté.
    s.r(22, 3, 7, 5, "meat").r(22, 3, 7, 1, "fat").r(23, 6, 5, 1, "meat_d")
    s.r(16, 0, 1, 4, "oak_d").r(15, 3, 4, 3, "iron_l").r(15, 5, 4, 1, "iron")
    return s.done()


def hanging_meat(phase=0):
    """Viande avariée pendue à une chaîne : verdâtre par endroits, os qui dépasse, deux mouches qui tournent."""
    s = Sprite(14, 30)
    s.r(6, 0, 1, 10, "chain").p(5, 9, "chain").p(7, 9, "chain")
    s.r(3, 10, 8, 12, "meat").r(4, 22, 6, 2, "meat").r(3, 10, 8, 1, "meat_d").r(4, 12, 3, 4, "rot").r(8, 17, 2, 3, "rot")
    s.r(9, 13, 1, 3, "fat").r(6, 23, 2, 3, "fat")
    s.done()
    flies = [((1, 12), (12, 18)), ((2, 16), (11, 11))][phase % 2]
    for x, y in flies:
        s.p(x, y, "fly").p(x + 1, y - 1, (190, 200, 220, 160))
    s.r(4, 28, 6, 2, "shadow")
    return s


if __name__ == "__main__":
    IW, IH = 8, 6
    W, H = (IW + 2) * T, (IH + 2) * T
    xs, ys = grid(W, H)
    base = walls(IW, IH)
    fl = tiles_floor(xs, ys)
    gutter(fl, T + 2, 5 * T + 7, 7 * T + 4, 7 * T + 8)
    base[T:T + IH * T, T:T + IW * T] = fl[T:T + IH * T, T:T + IW * T]
    base[(IH + 1) * T:, 2 * T:3 * T] = fl[(IH + 1) * T:, 2 * T:3 * T] * 0.7
    room = to_img(base).convert("RGBA")

    def put(sp, cx, cy, ox=0, oy=0):
        im = sp.img() if hasattr(sp, "img") else sp
        room.alpha_composite(im, (cx * T + ox, cy * T + T - im.height + oy))

    put(shelf(0), 1, 1, oy=-1)
    put(shelf(1), 2, 1, oy=-1)
    put(shelf(0), 6, 1, oy=-1)
    put(counter(), 3, 1, oy=-1)
    put(hanging_meat(0), 7, 3, ox=1, oy=-4)
    put(hanging_meat(1), 2, 3, ox=1, oy=-4)
    put(chair("right"), 3, 4, ox=2, oy=-1)
    t = table_v3(0, True)
    put(t, 4, 4, ox=1, oy=-1)
    # Pommes sur la table (0 à 4) : ici 3 de plus à côté de l'assiette.
    S = 4
    big = up(room.convert("RGB"), S)
    pieces = [("étagère à ustensiles", shelf(0)), ("plan de travail", counter()), ("viande pendue 1/2", hanging_meat(0)), ("viande pendue 2/2", hanging_meat(1))]
    sheet = Image.new("RGB", (big.width + 40, 50 + big.height + 24 + 190), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((sheet.width // 2, 20), "CUISINE v1 — à valider (8 × 6 cases)", fill=(255, 243, 200), font=font(15), anchor="mm")
    sheet.paste(big, (20, 44))
    x, y = 20, 44 + big.height + 24
    for label, sp in pieces:
        im = up(sp.img(), 4)
        bw = max(im.width + 12, 140)
        bg = Image.new("RGB", (bw, 150), (70, 61, 82))
        bg.paste(im, ((bw - im.width) // 2, 150 - im.height - 8), im)
        sheet.paste(bg, (x, y))
        d.text((x, y + 156), label, fill=(220, 210, 190), font=font(11, False))
        x += bw + 12
    sheet.save("art/cuisine_v1.png")
    print(sheet.size)
