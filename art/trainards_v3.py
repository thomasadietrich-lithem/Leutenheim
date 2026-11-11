"""Objets qui traînent, v3 (Thomas, 2026-11-11 : quatre images d'inspiration — un tonneau, une caisse, une botte de
paille, un mur à grilles rondes — « Inspiration, mais garantis la cohérence. Regarde les grilles circulaires : au sol ce
serait malin. Mais attention »).

Rien n'est recopié : on reprend des idées (cercles de fer qui suivent la courbe du tonneau, coins ferrés de la caisse,
paille bicolore liée d'une ficelle, grille ronde) et on les redessine avec NOTRE palette, NOTRE contour sombre et NOTRE
angle (3/4 plongeant, de face : jamais de vue isométrique de biais). La grille au sol est un ovale aplati (le sol est vu
en biais), plate, à barreaux : elle ne doit jamais ressembler à un trou ni au piège.
Écrit art/trainards_v3.png. Lancer depuis la racine du dépôt.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
from pix import hash2, grid, to_img, up, font
from sols_v1 import floor_b
from dortoir_v2 import Sprite, C, T, walls
from trainards_v2 import skeleton, cobweb, crate_stack as _unused  # noqa: F401  (squelette et toile validés)

C.update({
    "oak_d": (52, 32, 16, 255), "oak": (86, 56, 28, 255), "oak_l": (112, 76, 40, 255), "oak_h": (138, 98, 56, 255),
    "hay_d": (128, 88, 40, 255), "hay": (178, 132, 56, 255), "hay_l": (206, 168, 82, 255), "hay_h": (228, 204, 132, 255),
    "twine": (110, 72, 34, 255), "rivet": (180, 186, 204, 255),
    "hole": (12, 10, 18, 255), "rust": (92, 58, 40, 255),
})


def barrel_v3():
    """Tonneau : couvercle ovale en haut (planches), corps bombé, douelles qui suivent le galbe, deux cercles de fer
    qui plongent au milieu (on voit l'avant du cercle d'un peu au-dessus), reflet clair au milieu du fer."""
    W, H = 15, 22
    s = Sprite(W, H)
    cx = (W - 1) / 2
    top, bottom = 4, 20
    s.r(2, 20, 11, 2, "shadow")

    def half(y):  # demi-largeur du corps : bombé au milieu
        t = (y - top) / (bottom - top)
        return 5.2 + 1.8 * math.sin(math.pi * t)

    for y in range(top, bottom + 1):
        hw = half(y)
        for x in range(W):
            u = (x - cx) / hw
            if abs(u) > 1:
                continue
            # Ombre arrondie : plus sombre sur les bords.
            c = "oak_h" if -0.55 < u < 0.05 else "oak_l" if abs(u) < 0.8 else "oak"
            s.p(x, y, c)
    # Douelles : lignes aux mêmes angles, elles s'écartent au milieu et se resserrent en haut et en bas.
    for ang in (-0.62, -0.25, 0.12, 0.48):
        for y in range(top + 1, bottom + 1):
            s.p(int(round(cx + half(y) * ang)), y, "oak_d")
    # Fond (arc du bas).
    for x in range(W):
        u = (x - cx) / half(bottom)
        if abs(u) <= 1:
            s.p(x, bottom + int(round(1.2 * math.sqrt(1 - u * u))), "oak")
    # Cercles de fer : ils suivent l'avant du tonneau (arc qui descend au milieu), reflet clair au centre.
    for y0 in (7, 16):
        hw = half(y0)
        for x in range(W):
            u = (x - cx) / hw
            if abs(u) > 1:
                continue
            dy = int(round(1.6 * math.sqrt(1 - u * u)))
            s.p(x, y0 + dy, "iron").p(x, y0 + dy + 1, "shadow")
            s.p(x, y0 + dy - 1, "rivet" if abs(u) < 0.45 else "iron_l")
    # Couvercle : ovale plat, cerclé de fer sombre, planches à l'horizontale.
    for y in range(0, 7):
        for x in range(W):
            dx, dy = (x - cx) / 6.3, (y - 3) / 3.0
            d = dx * dx + dy * dy
            if d <= 1.0:
                s.p(x, y, "iron" if d > 0.62 else "oak_h" if y % 2 == 0 else "oak_l")
    s.r(5, 3, 5, 1, "oak_d")  # joint central du couvercle
    return s.done()


def crate_v3():
    """Caisse : dessus en planches (vues en profondeur), face avant en planches avec une traverse en diagonale,
    coins ferrés et rivets. Toujours de face (pas de vue isométrique)."""
    s = Sprite(15, 19)
    s.r(1, 17, 13, 2, "shadow")
    # Dessus.
    s.r(0, 0, 15, 5, "oak_h")
    for x in (3, 7, 11):
        s.r(x, 0, 1, 5, "oak_l")
    s.r(0, 4, 15, 1, "oak_l")
    # Face avant : planches horizontales, cadre, traverse diagonale.
    s.r(0, 5, 15, 12, "oak_l")
    for y in (8, 11, 14):
        s.r(1, y, 13, 1, "oak")
    s.r(0, 5, 2, 12, "oak").r(13, 5, 2, 12, "oak").r(0, 5, 15, 1, "oak").r(0, 15, 15, 2, "oak")
    for i in range(10):
        s.p(2 + int(i * 1.1), 14 - i, "oak_h").p(3 + int(i * 1.1), 14 - i, "oak")
    # Coins ferrés et rivets.
    for x, y in ((0, 0), (12, 0), (0, 5), (12, 5), (0, 14), (12, 14)):
        s.r(x, y, 3, 3 if y else 2, "iron").p(x + 1, y + 1 if y else y, "rivet")
    return s.done()


def crate_stack_v3():
    """Deux caisses empilées, celle du haut un peu décalée (on comprend que c'est une pile)."""
    s = Sprite(17, 30)
    low, high = crate_v3().a, crate_v3().a
    s.a[11:30, 0:15] = low
    m = high[..., 3] > 0
    s.a[0:19, 2:17][m] = high[m]
    return s


def hay_bale():
    """Botte de paille (garde-manger, écurie, dortoir pauvre) : dessus clair, face dorée à brins, côté droit plus sombre,
    deux ficelles, brins qui dépassent."""
    s = Sprite(17, 15)
    s.r(1, 13, 15, 2, "shadow")
    for y in range(0, 13):
        for x in range(0, 17):
            r = hash2(x, y, 410)
            if y < 4:
                c = "hay_h" if r > 0.6 else "hay_l"
            elif x >= 13:
                c = "hay_d" if r > 0.3 else "twine"
            else:
                c = "hay_h" if r > 0.85 else "hay_l" if r > 0.45 else "hay" if r > 0.12 else "hay_d"
            # Bords irréguliers : quelques brins manquent ou dépassent.
            if (x in (0, 16) or y == 0) and r > 0.7:
                continue
            s.p(x, y, c)
    for x in (2, 7, 14):
        s.p(x, -1 + 1, "hay_h")  # brins sur le dessus
    s.p(16, 6, "hay").p(16, 9, "hay_d")
    # Ficelles : une qui passe sur le dessus et descend sur la face, une autour.
    s.r(6, 0, 1, 13, "twine").r(0, 8, 13, 1, "twine").r(13, 8, 3, 1, "oak_d")
    return s.done()


def floor_grate():
    """Grille ronde au sol : vue en biais, c'est un ovale aplati ; anneau de fer clair en haut, sombre en bas, barreaux
    sur un fond noir ; un peu de rouille autour. Plate : on marche dessus. Sans contour noir (elle fait partie du sol)."""
    s = Sprite(16, 16)
    cx, cy, rx, ry = 7.5, 8.0, 7.2, 5.6
    for y in range(16):
        for x in range(16):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            d = dx * dx + dy * dy
            if 1.0 < d <= 1.45 and hash2(x, y, 420) > 0.45:
                s.p(x, y, "rust")
            elif 0.72 < d <= 1.0:
                s.p(x, y, "iron_l" if dy < -0.2 else "iron" if dy < 0.4 else "stone_d")
            elif d <= 0.72:
                s.p(x, y, "hole")
    # Barreaux : quatre en long, une traverse ; leur bord du haut accroche la lumière.
    for x in (3, 5, 7, 9, 11):
        for y in range(3, 14):
            dx, dy = (x - cx) / rx, (y - cy) / ry
            if dx * dx + dy * dy <= 0.72:
                s.p(x, y, "iron")
    for x in range(1, 15):
        dx = (x - cx) / rx
        if dx * dx <= 0.72:
            s.p(x, 7, "iron_l").p(x, 8, "iron")
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
    room.alpha_composite(floor_grate().img(), (5 * T, 3 * T))
    put(barrel_v3(), 6, 1, ox=1, oy=-1)
    put(barrel_v3(), 7, 1, ox=1, oy=-1)
    put(crate_stack_v3(), 8, 1, ox=-1, oy=-1)
    put(crate_v3(), 8, 4, ox=0, oy=-1)
    put(hay_bale(), 1, 4, ox=0, oy=-1)
    put(skeleton(), 2, 2, ox=4, oy=-2)

    S = 4
    big = up(room.convert("RGB"), S)
    pieces = [("tonneau", barrel_v3()), ("caisse", crate_v3()), ("caisses empilées", crate_stack_v3()),
              ("botte de paille", hay_bale()), ("grille au sol", floor_grate())]
    sheet = Image.new("RGB", (big.width + 40, 50 + big.height + 24 + 186), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((sheet.width // 2, 20), "OBJETS QUI TRAÎNENT v3 (d'après tes inspirations) — à valider", fill=(255, 243, 200), font=font(14), anchor="mm")
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
    sheet.save("art/trainards_v3.png")
    print(sheet.size)
