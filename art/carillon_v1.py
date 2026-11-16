"""Planche « carillon_v1 » : le BOSS DE LA SECTION 2 (Thomas, 2026-11-16 : « Carillon go »). PROPOSITION.

LE CARILLON : un champignon géant dont le chapeau a la forme d'une cloche, pendu à une racine qui sort de la voûte, au
fond d'une grotte ronde. C'est lui qu'on entendait sonner (« Ça sonne plus bas ») ; la vraie cloche est plus bas encore.
Sous le chapeau pend le BATTANT, une grosse boule de spores qui luit. Il ne bouge pas ; tous les 3 tours il SONNE :
une onde part de lui, le héros qui n'est pas abrité (souche de pierre, éboulis) tombe à terre, et les Kobolds envahis
qui dorment se réveillent.

Même vue que le jeu : 3/4 plongeant, 16 pixels par case, contour sombre. Le Carillon fait 3 × 3 cases (48 × 56 pixels,
la racine monte au-dessus de sa case).
  python3 art/carillon_v1.py → art/carillon_v1.png
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from PIL import Image  # noqa: E402

from champi_salles_v1 import S  # noqa: E402
from champi_sols_v1 import floor_cobbles  # noqa: E402
from mobs_champi_v1 import all_sets, img as mob_img  # noqa: E402
from pix import grid, hash2, to_img  # noqa: E402
from planche import planche  # noqa: E402

# Couleurs (C : choisies pour la planche).
CAP = [(196, 150, 128), (150, 104, 98), (108, 74, 86), (74, 50, 66), (46, 32, 46)]  # du plus clair au plus sombre
BAND = (214, 182, 146)
RIM = (236, 214, 176)
RIM_D = (176, 150, 122)
INSIDE = (28, 20, 30)
GILL = (86, 62, 74)
GLOW = (110, 236, 210)
GLOW_D = (52, 150, 134)
ROOT = [(120, 92, 96), (86, 64, 72), (58, 42, 52)]
CLAP = [(236, 246, 160), (196, 214, 96), (128, 156, 56)]
CRACK = (24, 16, 22)
STAR = (255, 226, 122)


def half_width(t):
    """Profil de la cloche : un dôme arrondi en haut, qui s'évase, et la lèvre qui s'ouvre au bord."""
    if t < 0.14:
        return 10 * math.sqrt(max(0.0, t) / 0.14)
    return 10 + 9 * ((t - 0.14) / 0.86) ** 1.6 + 4 * max(0.0, (t - 0.8) / 0.2) ** 2


def carillon(sway=0.0, ring=False, clapper=True, cracked=False, stunned=False, glow=1.0):
    """Le Carillon, `sway` : balancement du bas du chapeau (pixels), `ring` : il vibre en sonnant."""
    s = S(48, 58)
    cx, top, lip = 24, 9, 44
    # La racine qui le tient, sortie de la voûte (elle part du haut de l'image).
    for y in range(0, top + 2):
        w = 3 + (1 if y % 5 == 2 else 0)
        for x in range(cx - w, cx + w + 1):
            k = 0 if x < cx - 1 else 1 if x < cx + 2 else 2
            s.p(x, y, ROOT[k])
        if y % 4 == 1:
            s.p(cx + w, y, ROOT[2]).p(cx - w, y, ROOT[1])
    s.p(cx - 2, 3, GLOW).p(cx + 1, 6, GLOW_D)
    # Le chapeau en cloche.
    for y in range(top, lip + 1):
        t = (y - top) / (lip - top)
        hw = half_width(t)
        off = sway * t * t
        for x in range(48):
            dx = x + 0.5 - (cx + off)
            if abs(dx) > hw:
                continue
            u = dx / hw  # -1 (gauche, éclairé) à 1 (droite, ombre)
            k = 1 + (u > 0.25) + (u > 0.7) - (u < -0.55)
            k = max(0, min(4, k))
            c = CAP[k]
            # Deux anneaux clairs, comme sur une vraie cloche.
            if abs(t - 0.3) < 0.025 or abs(t - 0.86) < 0.025:
                c = BAND if u < 0.5 else CAP[1]
            # Grain de la chair du champignon.
            elif hash2(x, y, 41) > 0.86:
                c = CAP[min(4, k + 1)]
            s.p(x, y, c)
    # Taches lumineuses du chapeau.
    spots = [(-0.45, 0.38), (0.1, 0.5), (0.5, 0.42), (-0.2, 0.66), (0.35, 0.7), (-0.62, 0.6), (0.0, 0.16), (-0.35, 0.14), (0.4, 0.2),
             (0.7, 0.62), (-0.75, 0.78), (0.15, 0.8), (0.6, 0.8)]
    for su, st in spots:
        y = round(top + st * (lip - top))
        hw = half_width(st)
        x = round(cx + sway * st * st + su * hw)
        g = GLOW if glow > 0.5 else GLOW_D
        s.p(x, y, g).p(x, y + 1, GLOW_D)
        if glow > 0.5:
            s.p(x + 1, y, g).p(x + 1, y + 1, GLOW_D)
    # La lèvre : le bord crème et le dessous sombre avec ses lamelles.
    off = sway
    hw = half_width(1.0)
    for x in range(48):
        dx = x + 0.5 - (cx + off)
        if abs(dx) <= hw:
            s.p(x, lip + 1, RIM if dx < hw * 0.4 else RIM_D)
    for y in range(lip + 2, lip + 6):
        ry = 4
        for x in range(48):
            dx = (x + 0.5 - (cx + off)) / (hw - 1)
            dy = (y - (lip + 2)) / ry
            if dx * dx + dy * dy <= 1:
                s.p(x, y, INSIDE)
                if (x + y) % 4 == 0 and abs(dx) > 0.25:
                    s.p(x, y, GILL)
    # Le battant : une boule de spores qui luit, au bout d'une fibre.
    bx = round(cx + off * 1.25)
    if clapper:
        s.line(bx, lip + 2, bx, lip + 6, ROOT[0])
        s.ell(bx + 0.5, lip + 9, 4, 4, CLAP[1], shade=CLAP[2], light=CLAP[0])
        s.p(bx - 1, lip + 7, (255, 255, 230))
    else:
        # Cassé : la fibre effilochée pend, le battant est tombé.
        for i, ddx in enumerate((-1, 0, 1)):
            s.line(bx, lip + 2, bx + ddx * 2, lip + 6 + i % 2, ROOT[1])
    # Il sonne : des traits de vibration de chaque côté de la lèvre.
    if ring:
        for side in (-1, 1):
            for k in range(3):
                x = round(cx + off + side * (hw + 2 + k * 2))
                s.line(x, lip - 6 + k, x, lip - 2 + k, STAR if k == 0 else GLOW)
    # Fêlures (il a sonné faux, ou il est vaincu).
    if cracked:
        path = [(cx - 6, top + 10), (cx - 4, top + 15), (cx - 7, top + 20), (cx - 5, top + 26), (cx - 8, top + 31)]
        for (x0, y0), (x1, y1) in zip(path, path[1:]):
            s.line(x0 + round(sway * 0.4), y0, x1 + round(sway * 0.5), y1, CRACK)
        s.line(cx + 9, top + 22, cx + 12, top + 28, CRACK).line(cx + 12, top + 28, cx + 11, top + 33, CRACK)
    if stunned:
        for i in range(3):
            a = i * 2.1 + 0.6
            x = round(cx + 9 * math.cos(a))
            y = round(top - 2 + 2 * math.sin(a))
            s.p(x, y, STAR).p(x + 1, y, STAR).p(x, y - 1, STAR).p(x, y + 1, STAR)
    return s.done()


def carillon_dead():
    """Vaincu : la racine a cédé, la cloche est tombée de côté, fendue ; le battant a roulé."""
    s = S(48, 58)
    cx = 22
    # La racine rompue, qui pend de la voûte.
    for y in range(0, 14):
        for x in range(cx + 2 - 2, cx + 2 + 3):
            s.p(x, y, ROOT[0] if x < cx + 3 else ROOT[2])
    s.line(cx + 1, 14, cx - 1, 17, ROOT[1]).line(cx + 3, 14, cx + 4, 18, ROOT[1])
    # La cloche couchée : un grand ovale sombre, la lèvre vers la droite.
    s.ell(22, 44, 19, 9, CAP[2], shade=CAP[3], light=CAP[1])
    s.ell(38, 44, 4, 8, INSIDE)
    for y in range(37, 52):
        s.p(34, y, RIM)
    s.line(10, 40, 16, 46, CRACK).line(16, 46, 13, 50, CRACK).line(24, 37, 27, 43, CRACK)
    for x, y in ((14, 42), (22, 48), (28, 40)):
        s.p(x, y, GLOW_D)
    s.ell(44.5, 52, 3, 3, CLAP[2], shade=(80, 96, 40))
    return s.done()


def wave(r):
    """L'onde du coup de cloche : un anneau qui s'élargit (rayon `r` en cases), bleu-vert, translucide."""
    W, H = 176, 112
    im = np.zeros((H, W, 4), np.uint8)
    cx, cy = W / 2, H / 2
    for y in range(H):
        for x in range(W):
            d = math.hypot((x + 0.5 - cx) / (r * 16 / 2 + 0.01), (y + 0.5 - cy) / (r * 16 / 3.2 + 0.01))
            if 0.86 < d < 1.0:
                a = 200 if 0.92 < d < 0.98 else 110
                im[y, x] = (*(GLOW if (x + y) % 3 else STAR), a)
            elif 0.7 < d <= 0.86 and (x * 7 + y * 3) % 11 == 0:
                im[y, x] = (*GLOW_D, 90)
    return Image.fromarray(im, "RGBA")


def waves():
    """Les trois temps de l'onde dans une seule image (pour la planche)."""
    im = wave(1.2)
    for r in (2.2, 3.2):
        im.alpha_composite(wave(r))
    return im.resize((im.width // 2, im.height // 2), Image.NEAREST)


def stump():
    """Abri : une souche de pierre (un champignon pétrifié, coupé), moussue ; elle bloque et on se cache derrière."""
    s = S(16, 22)
    for y in range(6, 21):
        for x in range(3, 13):
            k = (150, 140, 160) if x < 6 else (112, 104, 124) if x < 10 else (80, 74, 94)
            s.p(x, y, k)
    s.ell(8, 6.5, 5.5, 3, (178, 170, 188), shade=(140, 132, 152))
    s.ell(8, 6.5, 3, 1.5, (120, 112, 134))
    for x, y in ((4, 12), (5, 13), (11, 16), (10, 17), (6, 19), (3, 18)):
        s.p(x, y, (92, 150, 78))
    s.p(9, 10, GLOW).p(4, 15, GLOW_D)
    return s.done()


def room():
    """La grotte du Carillon (15 × 11 cases) : le Carillon au fond, au milieu ; 6 souches de pierre en arc pour s'abriter ;
    3 Kobolds envahis endormis ; l'entrée en bas. L'escalier de la section 3 est derrière lui (scellé tant qu'il vit)."""
    IW, IH = 15, 11
    W, H = IW * 16, IH * 16
    xs, ys = grid(W, H)
    base = floor_cobbles(xs, ys)
    # Les murs : une bande de pierre sombre (en haut 2 rangées, sur les côtés 1), en arrondi aux coins.
    X, Y = xs // 16, ys // 16
    corner = ((X <= 1) & (Y <= 2)) | ((X >= IW - 2) & (Y <= 2)) | ((X <= 1) & (Y >= IH - 2)) | ((X >= IW - 2) & (Y >= IH - 2))
    wall = (Y < 2) | (X < 1) | (X >= IW - 1) | ((Y >= IH - 1) & ((X < 6) | (X > 8))) | corner
    n = hash2(xs.astype(int) // 5, ys.astype(int) // 4, 77)
    stone = np.stack([58 + 22 * n, 48 + 18 * n, 62 + 22 * n], -1)
    joints = ((ys.astype(int) % 4) == 0) | (((xs.astype(int) + (ys.astype(int) // 4) * 3) % 7) == 0)
    stone[joints] = (30, 24, 34)
    base[wall] = stone[wall]
    im = to_img(base).convert("RGBA")
    # Mycélium au pied du mur du haut.
    for x in range(16, W - 16):
        if hash2(x, 3, 5) > 0.4:
            im.putpixel((x, 32), (210, 204, 190, 255))
        if hash2(x, 4, 5) > 0.75:
            im.putpixel((x, 33), (190, 184, 170, 255))

    def put(sp, x, y, dx=0, dy=0):
        i = sp if isinstance(sp, Image.Image) else sp.img()
        im.alpha_composite(i, (int(x * 16 + dx), int(y * 16 + 16 - i.height + dy)))

    put(carillon(), 6, 4)
    for x, y in ((3, 4), (11, 4), (2, 7), (12, 7), (5, 8), (9, 8)):
        put(stump(), x, y)
    sets = all_sets()
    frames, pal = sets["envahi"]
    for x, y in ((4, 6), (10, 5), (7, 9)):
        im.alpha_composite(mob_img(frames["sleep"], pal), (x * 16, y * 16))
    return im


def main():
    pieces = [
        ("Carillon : repos (il se balance un peu)", [carillon(-1).img(), carillon(0).img(), carillon(1).img()]),
        ("Il SONNE (tous les 3 tours)", [carillon(-3, ring=True).img(), carillon(3, ring=True).img()]),
        ("L'onde qui s'élargit (3 temps, superposés)", [waves()]),
        ("Sonné faux (un coup juste avant) : fêlé, sonné", [carillon(0, cracked=True, stunned=True, glow=0.3).img()]),
        ("Battant cassé (flèches, poussée)", [carillon(0, clapper=False).img()]),
        ("Vaincu", [carillon_dead().img()]),
        ("Abri : souche de pierre", [stump().img()]),
    ]
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "carillon_v1.png")
    planche("LE CARILLON — boss de la section 2 (proposition)", room(), pieces, out, S=3,
            note="Tous les 3 tours il sonne : hors d'un abri, à terre ; les envahis se réveillent. Casser le battant, ou le faire sonner faux.")
    print(out)


if __name__ == "__main__":
    main()
