"""Section 3, l'OSSUAIRE : planche des OBJETS v2 (Thomas, 2026-11-19, 10 h 02, sur la v1 : « os épars pas lisible ; puits de
lune : jouer sur l'effet lumineux plutôt qu'un sprite par-dessus ; descente et montée entourées de murs comme dans les
autres étages, et dans le bon sens ; on doit voir le sol à travers les grilles ; grilles pour murs latéraux et bas
(inversée) ; propose des vrais squelettes qui traînent ; pierres tombales au sol pivotées à 360 degrés comme les tapis,
à cheval sur plusieurs blocs ; propose d'autres éléments »). PROPOSITION, rien n'est en jeu.

  python3 art/ossuaire_objets_v2.py   → art/ossuaire_objets_v2.png
"""
import importlib.util
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pix import fbm, font, grid, hash2, up  # noqa: E402


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


da4 = load("ossuaire_da_v4")
ob1 = load("ossuaire_objets_v1")
Sprite, C, SKULL, SK, SK_CARVED = ob1.Sprite, ob1.C, ob1.SKULL, ob1.SK, ob1.SK_CARVED
T = 16


# ---------------------------------------------------------------- petit décor de salle (plan à la main)

def mini(plan, lit=None):
    """Un morceau de salle v4 d'après un plan (# mur, . sol) ; `lit` : fonction de lumière (sinon sans ombre)."""
    da4.PLAN = plan
    da4.PH, da4.PW = len(plan), len(plan[0])
    da4.W, da4.H = da4.PW * T, da4.PH * T
    W, H = da4.W, da4.H
    xs, ys = grid(W, H)
    wall = np.array([[plan[y // T][x // T] == "#" for x in range(W)] for y in range(H)])
    a = np.where(wall[..., None], da4.wall_pixel_layer(), da4.floor_layer(xs + 37, ys + 11))
    fl = ~wall
    # roche pleine (mur sans sol autour) : noire
    near = np.zeros((da4.PH, da4.PW), bool)
    for y in range(da4.PH):
        for x in range(da4.PW):
            near[y, x] = any(0 <= y + dy < da4.PH and 0 <= x + dx < da4.PW and plan[y + dy][x + dx] != "#" for dy in (-1, 0, 1) for dx in (-1, 0, 1))
    rock = np.kron(~near, np.ones((T, T))).astype(bool)
    a[rock] = (6, 5, 8)
    edge = wall & (np.roll(fl, 1, 0) | np.roll(fl, -1, 0) | np.roll(fl, 1, 1) | np.roll(fl, -1, 1))
    a[edge] *= 0.45
    for cy in range(da4.PH - 1):
        for cx in range(da4.PW):
            if plan[cy][cx] == "#" and plan[cy + 1][cx] != "#":
                for k in range(6):
                    a[(cy + 1) * T + k, cx * T:(cx + 1) * T] *= 0.55 + 0.075 * k
    return a * np.array((0.88, 0.93, 1.06)), xs, ys, wall


def to_img(a):
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def paste(img, sprite, x, y, shadow=True):
    im = sprite.img()
    if shadow:
        sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse([x + 2, y + im.height - 4, x + im.width - 2, y + im.height + 2], fill=(0, 0, 0, 80))
        img.paste(sh, (0, 0), sh)
    img.paste(im, (x, y), im)
    return img


# ---------------------------------------------------------------- squelettes

def line(s, x0, y0, x1, y1, c):
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        s.p(round(x0 + (x1 - x0) * i / max(n, 1)), round(y0 + (y1 - y0) * i / max(n, 1)), c)


def skull_face(s, x, y, rot=0):
    g = np.rot90(np.array([list(r) for r in SKULL]), rot)
    for dy in range(5):
        for dx in range(5):
            if g[dy, dx] != ".":
                s.p(x + dx, y + dy, SK[g[dy, dx]])


def skel_lying():
    """Couché sur le dos, la tête à gauche (on voit son visage)."""
    s = Sprite(32, 17)
    skull_face(s, 1, 6, 3)
    line(s, 6, 8, 19, 8, "bD")  # colonne
    for x in (8, 10, 12, 14):
        line(s, x, 5, x + 1, 4, "b")
        line(s, x, 5, x, 11, "b")
        line(s, x, 11, x + 1, 12, "b")
    s.r(7, 5, 9, 1, "b").r(7, 11, 9, 1, "b")
    line(s, 7, 4, 12, 2, "b"), line(s, 12, 2, 18, 3, "b"), s.r(18, 2, 2, 2, "bD")  # bras du haut
    line(s, 7, 12, 12, 14, "b"), line(s, 12, 14, 17, 15, "b"), s.r(17, 15, 2, 1, "bD")  # bras du bas
    s.r(18, 6, 4, 5, "b").p(19, 8, "bS").p(20, 8, "bS")  # bassin
    line(s, 22, 7, 26, 6, "b"), line(s, 26, 6, 30, 6, "b"), s.r(29, 5, 2, 1, "bD")
    line(s, 22, 10, 26, 11, "b"), line(s, 26, 11, 30, 12, "b"), s.r(29, 12, 2, 1, "bD")
    s.p(26, 6, "bD").p(26, 11, "bD")  # genoux
    return s.done()


def skel_sitting():
    """Assis, adossé au mur, la tête penchée, les jambes vers nous."""
    s = Sprite(20, 22)
    skull_face(s, 8, 0)
    s.p(7, 2, "b")  # crâne un peu de travers
    line(s, 10, 5, 10, 13, "bD")
    for y in (6, 8, 10):
        s.r(6, y, 9, 1, "b")
        s.p(6, y + 1, "bD").p(14, y + 1, "bD")
    line(s, 5, 6, 3, 11, "b"), line(s, 3, 11, 4, 15, "b"), s.r(3, 15, 2, 2, "bD")
    line(s, 15, 6, 17, 11, "b"), line(s, 17, 11, 16, 15, "b"), s.r(16, 15, 2, 2, "bD")
    s.r(7, 13, 7, 3, "b").p(9, 14, "bS").p(11, 14, "bS")
    line(s, 8, 16, 6, 19, "b"), line(s, 6, 19, 6, 20, "b"), s.r(4, 20, 3, 1, "bD")
    line(s, 12, 16, 14, 19, "b"), line(s, 14, 19, 14, 20, "b"), s.r(14, 20, 3, 1, "bD")
    return s.done()


def skel_crawling():
    """Face contre terre, un bras tendu vers l'avant (on voit le dos du crâne)."""
    s = Sprite(32, 15)
    s.r(9, 4, 5, 5, "b").r(10, 3, 3, 1, "b").p(11, 5, "bD").p(12, 7, "bD")  # arrière du crâne
    line(s, 1, 6, 8, 6, "b"), s.r(0, 5, 2, 3, "bD")  # bras tendu
    line(s, 9, 9, 6, 12, "b"), s.r(5, 12, 2, 1, "bD")  # l'autre bras replié
    line(s, 14, 6, 24, 6, "bD")
    for x in (15, 17, 19, 21):
        line(s, x, 3, x, 9, "b")
    s.r(23, 4, 4, 5, "b").p(24, 6, "bS")
    line(s, 27, 5, 31, 3, "b"), line(s, 27, 8, 31, 10, "b")
    return s.done()


def skel_pieces():
    """En morceaux : cage et bassin, le crâne roulé à l'écart, un fémur."""
    s = Sprite(30, 16)
    line(s, 3, 7, 12, 7, "bD")
    for x in (4, 6, 8, 10):
        line(s, x, 4, x, 10, "b")
    s.r(12, 5, 4, 5, "b").p(13, 7, "bS")
    line(s, 17, 13, 26, 12, "b"), s.r(16, 12, 2, 2, "b"), s.r(25, 11, 2, 2, "b")
    skull_face(s, 23, 1)
    s.p(22, 4, "bD")
    return s.done()


# ---------------------------------------------------------------- escaliers enchâssés (dans le bon sens)

def stairs_tile(down):
    """Une case d'escalier vue du dessus, l'entrée en BAS (côté salle).
    Descente : la marche du bas est claire, les suivantes s'enfoncent vers le haut dans le noir et la brume.
    Montée : on voit les contremarches ; plus on monte (vers le haut de la case), plus c'est clair."""
    s = Sprite(16, 16)
    for k in range(5):
        y = 16 - 3 * (k + 1)
        if down:
            tread = ["sL", "s", "sD", "sDD", "k"][k]
            s.r(1, y, 14, 3, tread).r(1, y, 14, 1, "k" if k > 0 else "sD")
        else:
            tread = ["sD", "s", "s", "sL", "sL"][k]
            s.r(1, y, 14, 2, tread).r(1, y + 2, 14, 1, "sDD")
    s.r(0, 0, 16, 1, "k")
    if down:
        for (x, y) in ((3, 2), (6, 1), (10, 3), (12, 1)):
            s.r(x, y, 3, 1, "vD")
    return s.done(False)


STAIR_PLAN = ["#####", "#####", "#...#", "#...#"]


def stairs_panel(down):
    plan = ["#####", "##.##", "#...#", "#...#"]
    a, xs, ys, wall = mini(plan)
    img = to_img(a)
    img.paste(stairs_tile(down).img(), (2 * T, T), stairs_tile(down).img())
    return img


# ---------------------------------------------------------------- grilles qu'on voit à travers

def grille_panel(side, open_):
    """Grille de fer dans une porte ; « haut » : passage vers le haut ; « côté » : passage gauche-droite (grille vue par
    le dessus) ; « bas » : passage vers le bas, vue de l'autre côté (traverse en bas)."""
    if side == "côté":
        plan = ["#####", "#####", ".....", "#####", "#####"]
    else:
        plan = ["##.##", "##.##", "##.##", "#...#", "#...#"] if side == "haut" else ["#...#", "#...#", "##.##", "##.##", "##.##"]
    a, xs, ys, wall = mini(plan)
    img = to_img(a)
    s = Sprite(16, 16)
    I, IL, IH = C["i"], C["iL"], C["iH"]
    bars = (1, 5, 9, 13)
    if side in ("haut", "bas"):
        length = 15 if not open_ else 4
        y0 = 0 if side == "haut" else 16 - length
        for x in bars:
            s.r(x, y0, 2, length, IH).r(x + 1, y0, 1, length, I)  # barreau : un côté clair, un côté sombre
            tip = y0 + length - 1 if side == "haut" else y0
            s.p(x, tip, C["moon"])
        rail = (1, 9) if side == "haut" else (14, 6)
        s.r(0, rail[0], 16, 2, IL).r(0, rail[0] + 1, 16, 1, I)
        if not open_:
            s.r(0, rail[1], 16, 2, IL).r(0, rail[1] + 1, 16, 1, I)
    else:
        # vue du dessus : la traverse et les pointes des barreaux ; levée, il n'en reste qu'un bout sous le linteau
        n = 16 if not open_ else 3
        s.r(7, 0, 2, n, IH).r(8, 0, 1, n, I)
        for y in range(1, n - 1, 3):
            s.r(5, y, 6, 2, IL).p(5, y, IH).p(10, y + 1, I)
    img.paste(s.img(), (2 * T, 2 * T), s.img())
    return img


# ---------------------------------------------------------------- puits de lune : la lumière seule

def moon_panel():
    plan = ["######", "#....#", "#....#", "#....#", "#....#", "######"]
    a, xs, ys, wall = mini(plan)
    mx, my = 3 * T, 3.3 * T
    d = np.hypot(xs - mx, (ys - my) / 0.8) / T
    bayer = np.array([[0.125, 0.625], [0.875, 0.375]])[ys.astype(int) % 2, xs.astype(int) % 2]
    I = np.clip(1.4 - d / 1.4, 0, 1.4) + np.clip(1 - d / 3.2, 0, 1) * 0.5
    jit = (bayer - 0.5) * 0.12
    q = (I + jit > 0.18).astype(int) + (I + jit > 0.5) + (I + jit > 1.0)
    L = np.array([0.1, 0.42, 0.9, 1.35])[q]
    a = a * L[..., None] * np.array((0.82, 0.92, 1.14))
    # la colonne de lumière qui tombe du plafond
    top, bot, half = my - 2.6 * T, my, 1.0 * T
    inside = (np.abs(xs - mx) < half * (0.7 + 0.3 * (ys - top) / (bot - top))) & (ys > top) & (ys < bot + 4)
    edge = np.abs(xs - mx) / half
    alpha = inside * np.clip((ys - top) / (bot - top), 0, 1) * 0.4 * np.where(edge > 0.7, bayer > 0.5, 1)
    a = a * (1 - alpha[..., None]) + np.array((210, 226, 255)) * alpha[..., None]
    # brume qui s'éclaire dans la lumière
    f = fbm(xs, ys * 2.2, 30, 7, 2)
    dens = np.clip((f - 0.3) * 2.2, 0, 1) * ~wall
    band = (np.round(dens * 3) / 3) * 0.55 * np.clip(0.3 + L, 0, 1)
    a = a * (1 - band[..., None]) + np.array((150, 116, 196))[None, None, :] * (0.1 + 0.8 * L[..., None]) * band[..., None]
    motes = (hash2(xs.astype(int), ys.astype(int), 99) > 0.985) & (I > 0.6)
    a[motes] = (235, 240, 255)
    return to_img(a)


# ---------------------------------------------------------------- pierres tombales pivotées (comme les tapis)

def slab_buffer(kind):
    buf = np.full((T, 2 * T, 3), -1.0)
    da4.tomb(buf, 0, 0, kind)
    m = buf[..., 0] >= 0
    if kind != "double":
        buf, m = buf[:, :T], m[:, :T]
    ys_, xs_ = np.nonzero(m)
    return buf[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1], m[ys_.min():ys_.max() + 1, xs_.min():xs_.max() + 1]


def rotated_slab(a, kind, cx, cy, deg):
    """Pose une pierre tombale à n'importe quel angle (échantillonnage au pixel), centrée en (cx, cy) pixels."""
    buf, m = slab_buffer(kind)
    h, w = m.shape
    th = math.radians(deg)
    c, s = math.cos(th), math.sin(th)
    R = int(math.hypot(w, h) / 2) + 2
    out_m = np.zeros((2 * R, 2 * R), bool)
    out_c = np.zeros((2 * R, 2 * R, 3))
    for y in range(2 * R):
        for x in range(2 * R):
            dx, dy = x - R + 0.5, y - R + 0.5
            u = c * dx + s * dy + w / 2
            v = -s * dx + c * dy + h / 2
            iu, iv = int(math.floor(u)), int(math.floor(v))
            if 0 <= iu < w and 0 <= iv < h and m[iv, iu]:
                out_m[y, x] = True
                out_c[y, x] = buf[iv, iu]
    # relief : arête claire en haut à gauche, sombre en bas à droite (la lumière ne tourne pas avec la pierre)
    up_ = out_m & ~np.roll(out_m, 1, 0)
    lf = out_m & ~np.roll(out_m, 1, 1)
    dn = out_m & ~np.roll(out_m, -1, 0)
    rt = out_m & ~np.roll(out_m, -1, 1)
    out_c[dn | rt] = da4.STONE_D
    out_c[up_ | lf] = da4.STONE_HI
    # liseré de terre autour (la pierre est encastrée)
    ring = ~out_m & (np.roll(out_m, 1, 0) | np.roll(out_m, -1, 0) | np.roll(out_m, 1, 1) | np.roll(out_m, -1, 1))
    y0, x0 = int(cy) - R, int(cx) - R
    reg = a[y0:y0 + 2 * R, x0:x0 + 2 * R]
    reg[ring] = reg[ring] * 0.5
    reg[out_m] = out_c[out_m]


def tombs_panel():
    plan = ["##########", "#........#", "#........#", "#........#", "#........#", "##########"]
    a, xs, ys, wall = mini(plan)
    for (kind, cx, cy, deg) in (("ins", 34, 34, 17), ("double", 82, 30, -28), ("crane", 128, 34, 63), ("brisee", 30, 66, 141),
                                ("os", 74, 70, 205), ("anneau", 112, 68, 300), ("petite", 140, 62, 38), ("double", 52, 52, 96)):
        rotated_slab(a, kind, cx, cy, deg)
    return to_img(a)


# ---------------------------------------------------------------- autres éléments proposés

def bone_chandelier():
    """Lustre d'os (éteint) suspendu : couronne de crânes et de fémurs, son ombre au sol."""
    s = Sprite(26, 16)
    for x in range(1, 25):
        s.p(x, 6, "bD")
    for k, x in enumerate((1, 7, 13, 19)):
        skull_face(s, x + 1, 7)
    line(s, 2, 6, 12, 0, "iL"), line(s, 23, 6, 13, 0, "iL"), line(s, 12, 0, 12, 6, "iL")
    for x in (4, 10, 16, 22):
        s.r(x, 3, 1, 3, "b")
    return s.done()


def skull_pillar():
    s = Sprite(16, 30)
    s.r(1, 2, 14, 26, "k")
    for y in range(3, 26, 5):
        for x in (1, 6, 11) if (y // 5) % 2 == 0 else (3, 8):
            skull_face(s, x, y)
    s.r(0, 0, 16, 3, "s").r(0, 0, 16, 1, "sL").r(0, 27, 16, 3, "sD")
    return s.done()


def coffins():
    s = Sprite(22, 26)
    for (y, tone) in ((14, "c"), (3, "cL")):
        s.r(1, y + 1, 18, 9, "cD" if tone == "c" else "c")
        s.r(3, y, 14, 1, tone).r(1, y + 4, 19, 1, tone)
        s.r(9, y + 2, 2, 6, "v").r(7, y + 4, 6, 1, "v")
    return s.done()


def veiled_statue():
    s = Sprite(16, 30)
    s.r(5, 1, 6, 6, "sL").r(4, 3, 8, 6, "s").r(6, 5, 4, 3, "sDD")  # voile, le visage dans l'ombre
    s.r(3, 9, 10, 15, "s").r(3, 9, 2, 15, "sL").r(11, 9, 2, 15, "sD")
    for x in (6, 8, 10):
        s.r(x, 12, 1, 12, "sD")
    s.r(6, 13, 4, 3, "sL")  # mains jointes
    s.r(1, 24, 14, 6, "sD").r(1, 24, 14, 1, "s").r(1, 29, 14, 1, "sDD")
    return s.done()


def grate_pit():
    """Fosse commune sous une grille au sol (2 × 2) : on voit les os en dessous."""
    s = Sprite(30, 30)
    s.r(0, 0, 30, 30, "sD").r(2, 2, 26, 26, "k")
    for (x, y) in ((4, 5), (12, 3), (19, 8), (7, 15), (16, 18), (21, 21), (5, 22)):
        skull_face(s, x, y)
    for (x0, y0, x1, y1) in ((3, 11, 13, 13), (14, 12, 25, 10), (9, 24, 19, 26)):
        line(s, x0, y0, x1, y1, "bD")
    for k in range(2, 28, 4):
        s.r(k, 2, 1, 26, "iL").r(2, k, 26, 1, "iL")
    s.r(0, 0, 30, 1, "sL").r(0, 0, 1, 30, "sL")
    return s.done()


def barrow():
    s = Sprite(26, 18)
    s.r(4, 4, 16, 8, (92, 70, 48)).r(4, 4, 16, 1, (130, 100, 70)).r(4, 11, 16, 1, (60, 44, 30))
    skull_face(s, 6, 0), skull_face(s, 12, 1)
    line(s, 9, 2, 17, 2, "b")
    s.r(1, 7, 4, 1, (80, 60, 40)).r(19, 9, 6, 1, (80, 60, 40))
    s.r(5, 12, 5, 5, "i").r(6, 13, 3, 3, "iL")
    line(s, 21, 0, 25, 14, "iL"), s.r(23, 13, 3, 4, "iL")  # la pelle
    return s.done()


# ---------------------------------------------------------------- planche

def floor_panel(wt, ht):
    plan = ["#" * wt] + ["#" + "." * (wt - 2) + "#" for _ in range(ht - 2)] + ["#" * wt]
    a, *_ = mini(plan)
    return to_img(a)


def main():
    Z = 3
    sk = [
        ("Squelette couché", skel_lying(), 5, 4, (20, 26)),
        ("Assis contre le mur", skel_sitting(), 4, 4, (22, 18)),
        ("Face contre terre", skel_crawling(), 5, 4, (20, 26)),
        ("En morceaux", skel_pieces(), 5, 4, (20, 24)),
    ]
    other = [
        ("Lustre d'os (éteint)", bone_chandelier(), 4, 4, (19, 20)),
        ("Pilier de crânes", skull_pillar(), 3, 4, (16, 14)),
        ("Cercueils empilés", coffins(), 4, 4, (20, 18)),
        ("Statue voilée", veiled_statue(), 3, 4, (16, 14)),
        ("Fosse sous grille", grate_pit(), 4, 4, (17, 18)),
        ("Brouette du fossoyeur", barrow(), 4, 4, (19, 24)),
    ]
    rows = []
    rows.append(("SQUELETTES QUI TRAÎNENT (remplacent les os épars)", [(n, paste(floor_panel(w, h), sp, *at)) for n, sp, w, h, at in sk]))
    rows.append(("ESCALIERS ENCHÂSSÉS · GRILLES (on voit à travers)", [
        ("Descente", stairs_panel(True)), ("Montée", stairs_panel(False)),
        ("Grille, mur du haut", grille_panel("haut", False)), ("… levée", grille_panel("haut", True)),
        ("Mur de côté", grille_panel("côté", False)), ("… levée", grille_panel("côté", True)),
        ("Mur du bas", grille_panel("bas", False)), ("… levée", grille_panel("bas", True)),
    ]))
    rows.append(("PUITS DE LUNE (lumière seule) · PIERRES TOMBALES À TOUS LES ANGLES", [("Puits de lune", moon_panel()), ("Pierres tombales", tombs_panel())]))
    rows.append(("AUTRES ÉLÉMENTS PROPOSÉS", [(n, paste(floor_panel(w, h), sp, *at, shadow=n != "Fosse sous grille")) for n, sp, w, h, at in other]))
    maxw, pad = 1560, 18
    layout = []
    y = 90
    for title, items in rows:
        layout.append(("title", title, pad, y))
        y += 40
        x, rowh = pad, 0
        for name, im in items:
            im = up(im, Z)
            if x + im.width > maxw - pad:
                x, y = pad, y + rowh + 42
                rowh = 0
            layout.append(("item", name, im, x, y))
            x += im.width + pad
            rowh = max(rowh, im.height)
        y += rowh + 30
    sheet = Image.new("RGB", (maxw, y + 10), (14, 12, 18))
    d = ImageDraw.Draw(sheet)
    d.text((maxw // 2, 26), "SECTION 3 · L'OSSUAIRE · objets v2", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((maxw // 2, 54), "Squelettes · escaliers enchâssés · grilles des 3 murs · lune en lumière seule · pierres tombales à tous les angles · nouveautés · ×3", fill=(190, 180, 160), font=font(14, False), anchor="mm")
    for e in layout:
        if e[0] == "title":
            d.text((e[2], e[3]), e[1], fill=(255, 220, 140), font=font(17), anchor="lt")
        else:
            _, name, im, x, yy = e
            d.text((x, yy - 18), name, fill=(240, 192, 80), font=font(13), anchor="lt")
            sheet.paste(im, (x, yy))
    sheet.save(os.path.join(HERE, "ossuaire_objets_v2.png"))
    print("art/ossuaire_objets_v2.png", sheet.size)


if __name__ == "__main__":
    main()
