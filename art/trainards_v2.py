"""Objets qui traînent, v2 (Thomas, 2026-11-11, sur la v1 : « TB, mais attention à la superposition des caisses avec
une caisse devant. Le tonneau a une drôle de tête au niveau de la partie circulaire. Squelette sans épée et truc qui
traîne, et abîmé, pas en parfait état. Toile ok. Sol B excellent. »)

Première demande (Thomas, 2026-11-11 : « Rajoute 0 à 1 squelette par étage qui traîne avec du loot » et
« Commence à réfléchir à du mobilier qui traîne, propose des grilles (hors salles spéciales) : caisse, tonneaux,
toile d'araignée (idée de mob) »).

Même vue légèrement de face que le dortoir v2 (art/dortoir_v2.py) : ce qui est haut déborde sur la case du dessus.
Écrit art/trainards_v1.png : une salle d'exemple, puis chaque objet agrandi. Lancer depuis la racine du dépôt.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
from pix import hash2, grid, to_img, up, font
from sols_v1 import floor_b
from dortoir_v2 import Sprite, C, T, walls

C.update({k: v for k, v in {
    "bone": (230, 224, 204, 255), "bone_d": (168, 160, 140, 255), "bone_s": (110, 104, 92, 255),
    "web": (220, 224, 236, 150), "web_l": (240, 244, 255, 210),
    "leather": (110, 70, 34, 255), "leather_l": (150, 98, 48, 255),
    "coin": (240, 192, 80, 255), "coin_d": (168, 124, 28, 255),
    "blade": (195, 203, 224, 255), "blade_d": (127, 136, 166, 255),
}.items()})


def barrel():
    """Tonneau debout : dessus ovale (couvercle de planches dans un cercle de fer), douelles bombées, deux cercles de fer.
    Déborde de 6 pixels."""
    s = Sprite(14, 22)
    s.r(1, 20, 12, 2, "shadow")
    # Corps bombé : plus large au milieu.
    s.r(1, 6, 12, 14, "wood_l").r(0, 9, 14, 8, "wood_l")
    for x in (3, 6, 9, 11):
        s.r(x, 6, 1, 14, "wood")
    s.r(1, 6, 1, 14, "wood_h").r(0, 9, 1, 8, "wood_h")
    s.r(0, 9, 14, 2, "iron").r(0, 9, 14, 1, "iron_l").r(0, 15, 14, 2, "iron").r(0, 15, 14, 1, "iron_l")
    # Dessus : ovale plat (vu de haut), cerclé de fer ; planches du couvercle à l'horizontale.
    rows = [(3, 11), (1, 13), (0, 14), (0, 14), (1, 13), (3, 11)]
    for i, (x0, x1) in enumerate(rows):
        s.r(x0, i, x1 - x0, 1, "iron")
        if 0 < i < 5:
            s.r(x0 + 1, i, x1 - x0 - 2, 1, "wood_h")
    s.r(2, 2, 10, 1, "wood_l").r(2, 3, 10, 1, "wood_h").r(4, 4, 6, 1, "wood_l")
    return s.done()


def crate():
    """Caisse vue en biais : dessus clair, face avant à planches et croisillon. Déborde de 5 pixels."""
    s = Sprite(15, 19)
    s.r(1, 17, 13, 2, "shadow")
    s.r(0, 0, 15, 5, "wood_h").r(0, 0, 15, 1, "straw_d")
    for x in (4, 9):
        s.r(x, 0, 1, 5, "wood_l")
    s.r(0, 5, 15, 12, "wood_l")
    s.r(0, 5, 15, 2, "wood").r(0, 15, 15, 2, "wood").r(0, 5, 2, 12, "wood").r(13, 5, 2, 12, "wood")
    for i in range(9):
        s.p(3 + i, 7 + i, "wood_d").p(11 - i, 7 + i, "wood_d")
    return s.done()


def crate_stack():
    """Deux caisses empilées (une case) : la pile se voit de loin."""
    s = Sprite(16, 30)
    low, top = crate().a, crate().a
    s.a[11:30, 0:15] = low
    m = top[..., 3] > 0
    s.a[0:19, 0:15][m] = top[m]
    return s


def skeleton():
    """Squelette abîmé, couché au sol (vu de dessus, il est plat) : crâne fendu et de travers, mâchoire détachée,
    côtes brisées ou manquantes, un bras et une jambe épars, os jaunis. Rien d'autre autour : son butin se trouve en le
    fouillant."""
    s = Sprite(26, 16)
    # Crâne de travers, fendu, une orbite plus grande.
    s.r(1, 3, 6, 5, "bone").r(2, 2, 4, 1, "bone").r(2, 8, 4, 1, "bone_d")
    s.r(2, 4, 2, 2, "bone_s").r(5, 4, 1, 2, "bone_s").p(3, 2, "bone_s").p(4, 3, "bone_s")  # fêlure
    # Mâchoire détachée, un peu plus bas.
    s.r(2, 11, 4, 1, "bone_d").p(1, 10, "bone_d").p(6, 10, "bone_d")
    # Colonne (cassée au milieu) et côtes : certaines brisées, une manquante.
    s.r(8, 7, 4, 1, "bone_d").r(13, 8, 4, 1, "bone_d")
    for x, top, bot in ((9, 4, 10), (11, 5, 10), (15, 4, 8)):
        s.r(x, top, 1, bot - top + 1, "bone_d" if x == 15 else "bone")
    s.p(13, 6, "bone_d").p(13, 10, "bone")  # côte brisée en deux morceaux
    # Bassin à moitié.
    s.r(17, 6, 3, 4, "bone_d").p(18, 6, "bone")
    # Une jambe en place, l'autre éparpillée plus loin.
    s.r(20, 6, 5, 1, "bone").p(24, 5, "bone")
    s.r(21, 11, 3, 1, "bone_d").r(19, 13, 2, 1, "bone_d")
    # Bras : un seul os, écarté vers le haut ; quelques petits os (phalanges) épars.
    s.r(9, 1, 4, 1, "bone_d").p(8, 0, "bone_d")
    for x, y in ((14, 13), (16, 14), (11, 13)):
        s.p(x, y, "bone_s")
    return s.done()


def cobweb():
    """Toile d'araignée dans un coin (en haut à gauche) : fils rayonnants et deux arcs. Transparente, sans contour."""
    s = Sprite(16, 16)
    for i in range(16):
        s.p(i, 0, "web_l").p(0, i, "web_l")
        if i < 13:
            s.p(i, i, "web")
    for i in range(12):
        s.p(i, i // 2 + (1 if i % 2 else 0), "web").p(i // 2 + (1 if i % 2 else 0), i, "web")
    # Arcs concentriques.
    for r, c in ((5, "web_l"), (9, "web"), (13, "web")):
        for a in np.linspace(0, np.pi / 2, 3 * r):
            x, y = int(round(r * np.cos(a))), int(round(r * np.sin(a)))
            s.p(x, y, c)
    s.p(6, 6, "shadow").p(7, 6, "shadow").p(6, 7, "shadow")  # une petite proie emmaillotée
    return s


if __name__ == "__main__":
    IW, IH = 8, 5
    W, H = (IW + 2) * T, (IH + 2) * T
    xs, ys = grid(W, H)
    base = walls(IW, IH)
    fl = floor_b(xs, ys)
    base[T:T + IH * T, T:T + IW * T] = fl[T:T + IH * T, T:T + IW * T]
    base[(IH + 1) * T:, 3 * T:4 * T] = fl[(IH + 1) * T:, 3 * T:4 * T] * 0.7
    room = to_img(base).convert("RGBA")

    def put(sp, cx, cy, ox=0, oy=0):
        im = sp.img()
        room.alpha_composite(im, (cx * T + ox, cy * T + T - im.height + oy))

    room.alpha_composite(cobweb().img(), (T, T))
    put(barrel(), 6, 1, ox=1, oy=-1)
    put(barrel(), 7, 1, ox=1, oy=-1)
    put(crate_stack(), 8, 1, ox=0, oy=-1)
    put(crate(), 8, 4, ox=0, oy=-1)  # jamais une caisse juste devant une pile : une case d'écart au moins
    put(skeleton(), 3, 3, ox=-4, oy=-2)
    room.alpha_composite(cobweb().img().transpose(Image.FLIP_TOP_BOTTOM), (T, IH * T))

    S = 4
    big = up(room.convert("RGB"), S)
    pieces = [("tonneau", barrel()), ("caisse", crate()), ("caisses empilées", crate_stack()),
              ("squelette abîmé", skeleton()), ("toile (coin)", cobweb())]
    sheet = Image.new("RGB", (big.width + 40, 50 + big.height + 24 + 186), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((sheet.width // 2, 20), "OBJETS QUI TRAÎNENT v2 — à valider", fill=(255, 243, 200), font=font(15), anchor="mm")
    sheet.paste(big, (20, 44))
    x, y = 20, 44 + big.height + 24
    for label, sp in pieces:
        im = up(sp.img(), 4)
        bw = max(im.width + 12, 118)
        bg = Image.new("RGB", (bw, 150), (70, 61, 82))
        bg.paste(im, ((bw - im.width) // 2, 150 - im.height - 8), im)
        sheet.paste(bg, (x, y))
        d.text((x, y + 156), label, fill=(220, 210, 190), font=font(11, False))
        x += bw + 12
    sheet.save("art/trainards_v2.png")
    print(sheet.size)
