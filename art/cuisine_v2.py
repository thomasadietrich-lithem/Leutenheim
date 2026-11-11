"""Cuisine des Schrats, v2 (Thomas, 2026-11-11 : « Étagères de 2 cases de long avec plusieurs choses. Rends la viande plus
clairement identifiable, avec un crochet, mais uniquement contre le mur du fond. Ajoute des tonneaux et des caisses.
Barrique de vin, avec robinet sur support, robinet qui goutte, animé. La viande gigote. Pense aux items génériques qui
traînent (tonneau, caisse, céréales) »).

Même vue de 3/4 que le dortoir validé. Écrit art/cuisine_v2.png. Lancer depuis la racine du dépôt.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from pix import hash2, grid, to_img
from dortoir_v2 import Sprite, C, T, walls, chair
from dortoir_v3 import table_v3
from cuisine_v1 import tiles_floor, gutter, counter
from trainards_v3 import barrel_v3, crate_v3, crate_stack_v3
from planche import planche

C.update({
    "ham": (178, 72, 64, 255), "ham_d": (124, 44, 44, 255), "ham_l": (212, 110, 96, 255),
    "bone": (232, 222, 196, 255), "bone_d": (170, 158, 132, 255),
    "jute": (164, 132, 84, 255), "jute_d": (118, 92, 56, 255), "jute_l": (196, 166, 112, 255),
    "grain": (222, 190, 112, 255), "glass": (110, 150, 120, 255), "glass_h": (170, 210, 180, 255),
    "wine": (110, 20, 40, 255), "wine_l": (160, 40, 62, 255), "brass": (200, 160, 70, 255), "brass_d": (140, 104, 40, 255),
    "garlic": (226, 220, 200, 255), "clay": (164, 92, 60, 255), "clay_d": (118, 62, 40, 255),
})


def shelf2():
    """Étagère de 2 cases contre le mur du fond : trois planches chargées (bocaux, pots, sacs, bouteilles, bols, ail)."""
    s = Sprite(32, 34)
    s.r(1, 32, 30, 2, "shadow")
    s.r(0, 0, 2, 32, "oak").r(30, 0, 2, 32, "oak").r(15, 0, 2, 32, "oak_d").r(0, 0, 1, 32, "oak_h")
    for y in (9, 19, 29):
        s.r(0, y, 32, 2, "oak_l").r(0, y, 32, 1, "oak_h")
    # Planche du haut : bocaux verts, pot de terre, tresse d'ail qui pend.
    s.r(3, 4, 3, 5, "glass").p(3, 5, "glass_h").r(3, 3, 3, 1, "oak_d")
    s.r(7, 5, 3, 4, "glass").p(7, 6, "glass_h").r(7, 4, 3, 1, "oak_d")
    s.r(11, 3, 4, 6, "clay").r(11, 3, 4, 1, "clay_d").p(12, 5, "fat")
    s.r(18, 5, 4, 4, "copper").r(18, 5, 4, 1, "copper_h").r(23, 2, 1, 7, "jute_d")
    for i, y in enumerate((3, 5, 7)):
        s.r(22 + (i % 2), y, 3, 2, "garlic")
    s.r(26, 4, 3, 5, "sheet_s").r(26, 4, 3, 1, "sheet_w")
    # Planche du milieu : bouteilles, bols empilés, casserole.
    for x in (3, 5, 7):
        s.r(x, 13, 2, 6, "wine").p(x, 14, "wine_l").r(x, 12, 1, 1, "oak_d")
    s.r(10, 16, 5, 3, "clay").r(11, 15, 3, 1, "clay").r(10, 16, 5, 1, "clay_d")
    s.r(18, 14, 6, 5, "copper").r(18, 14, 6, 1, "copper_h").r(24, 16, 3, 1, "oak_d")
    s.r(27, 15, 2, 4, "glass")
    # Planche du bas : deux sacs de grain et un hachoir.
    s.r(3, 23, 6, 6, "jute").r(4, 22, 4, 1, "jute_d").r(3, 23, 1, 6, "jute_l").r(5, 24, 2, 1, "grain")
    s.r(10, 24, 5, 5, "jute_d").r(11, 23, 3, 1, "jute").p(12, 25, "grain")
    s.r(19, 26, 8, 2, "iron_l").r(19, 27, 8, 1, "iron").r(26, 26, 3, 2, "oak_d")
    return s.done()


def wall_hook(phase=0):
    """Crochet de boucher scellé dans le mur du fond ; un jambon y pend PAR L'OS (comme chez le boucher) : os blanc et
    rotule en haut, ficelle et crochet en S, la chair s'élargit vers le bas en une grosse poire rouge bordée de couenne
    pâle, avec la tranche marbrée en bas. `phase` 0, 1, 2 : il se balance (le bas bouge plus que le haut)."""
    sway = (-1, 0, 1)[phase % 3]
    s = Sprite(16, 30)
    s.r(2, 0, 12, 2, "iron").r(2, 0, 12, 1, "iron_l").p(3, 1, "rivet").p(12, 1, "rivet")
    s.r(7, 2, 1, 3, "iron_l").p(8, 5, "iron_l").p(8, 6, "iron")
    # Os et rotule (en haut), noués d'une ficelle.
    s.r(7, 7, 3, 2, "bone").p(9, 8, "bone_d").r(8, 9, 2, 3, "bone").r(7, 10, 4, 1, "twine")
    # Chair : poire qui s'élargit vers le bas et se balance.
    for y in range(12, 28):
        t = (y - 12) / 15
        hw = 1.6 + 4.6 * math.sin(math.pi * min(1.0, 0.25 + t * 0.85)) if t < 0.9 else 5.4 - (t - 0.9) * 20
        cx = 8.5 + sway * t * 1.6
        for x in range(16):
            dx = x - cx
            if abs(dx) > hw:
                continue
            c = "ham_l" if dx < -hw * 0.25 else "ham" if dx < hw * 0.45 else "ham_d"
            if abs(dx) > hw - 1.1:
                c = "fat"
            s.p(x, y, c)
    # Tranche marbrée en bas (on voit la coupe).
    cx = int(round(8.5 + sway * 1.6))
    s.r(cx - 3, 25, 6, 2, "ham_l").p(cx - 1, 25, "fat").p(cx + 1, 26, "fat")
    s.done()
    return s


def grain_sack():
    """Sac de céréales en toile de jute, ficelé en haut, un peu de grain répandu au pied."""
    s = Sprite(15, 18)
    s.r(1, 16, 13, 2, "shadow")
    for y in range(3, 17):
        hw = 4.2 + 2.3 * math.sin(math.pi * min(1, (y - 2) / 13))
        for x in range(15):
            if abs(x - 7) <= hw:
                r = hash2(x, y, 707)
                s.p(x, y, "jute_l" if x < 6 and r > 0.4 else "jute_d" if x > 10 else "jute")
    s.r(5, 0, 5, 3, "jute").r(6, 0, 3, 1, "jute_l").r(4, 3, 7, 1, "twine")
    s.r(4, 7, 7, 1, "jute_d").r(3, 11, 9, 1, "jute_d")
    s.done()
    for x, y in ((1, 16), (3, 17), (12, 17), (13, 16), (10, 17)):
        s.p(x, y, "grain")
    return s


def barrique(phase=0):
    """Barrique de vin couchée sur son chevalet (2 cases) : fond rond cerclé de fer vu de face, douelles, robinet de laiton
    en bas du fond ; une goutte de vin tombe (phase 0, 1, 2) dans une petite flaque."""
    s = Sprite(32, 26)
    s.r(2, 24, 28, 2, "shadow")
    # Chevalet en X sous le tonneau.
    for i in range(9):
        s.p(4 + i, 24 - i, "oak_d").p(12 - i, 24 - i, "oak").p(19 + i, 24 - i, "oak_d").p(27 - i, 24 - i, "oak")
    s.r(2, 15, 28, 2, "oak_l").r(2, 15, 28, 1, "oak_h")
    # Corps couché : douelles horizontales.
    for y in range(2, 16):
        for x in range(8, 31):
            t = (y - 2) / 13
            if abs(t - 0.5) > 0.5:
                continue
            c = "oak_h" if 0.15 < t < 0.4 else "oak_l" if t < 0.75 else "oak"
            s.p(x, y, c)
    for y in (5, 9, 12):
        s.r(9, y, 21, 1, "oak_d")
    for x in (14, 25):
        s.r(x, 2, 2, 14, "iron").r(x, 2, 1, 14, "iron_l")
    # Fond rond, vu de face (à gauche).
    for y in range(0, 18):
        for x in range(0, 14):
            d = ((x - 7) / 7.0) ** 2 + ((y - 8.5) / 8.5) ** 2
            if d <= 1:
                s.p(x, y, "iron" if d > 0.72 else ("oak_l" if (y // 3) % 2 else "oak"))
    s.r(3, 8, 9, 1, "oak_d")
    s.done()
    # Robinet de laiton en bas du fond.
    s.r(6, 13, 3, 2, "brass").r(7, 15, 1, 2, "brass_d").p(6, 13, "fire_y")
    # Goutte qui tombe, puis la flaque.
    gy = (17, 19, 21)[phase % 3]
    s.r(7, gy, 1, 2, "wine_l").p(7, gy, "fire_y" if phase % 3 == 0 else "wine_l")
    s.r(3, 24, 9, 1, "wine").r(4, 25, 7, 1, "wine_l" if phase % 3 == 2 else "wine")
    return s


if __name__ == "__main__":
    IW, IH = 9, 6
    W, H = (IW + 2) * T, (IH + 2) * T
    xs, ys = grid(W, H)
    base = walls(IW, IH)
    fl = tiles_floor(xs, ys)
    gutter(fl, T + 2, 5 * T + 7, 8 * T + 4, 8 * T + 8)
    base[T:T + IH * T, T:T + IW * T] = fl[T:T + IH * T, T:T + IW * T]
    base[(IH + 1) * T:, 3 * T:4 * T] = fl[(IH + 1) * T:, 3 * T:4 * T] * 0.7
    room = to_img(base).convert("RGBA")

    def put(sp, cx, cy, ox=0, oy=0):
        im = sp.img() if hasattr(sp, "img") else sp
        room.alpha_composite(im, (cx * T + ox, cy * T + T - im.height + oy))

    # Mur du fond : étagère (2 cases), crochets à jambon, étagère, plan de travail ensanglanté.
    put(shelf2(), 1, 1, oy=-1)
    put(wall_hook(0), 3, 1, oy=-2)
    put(wall_hook(2), 4, 1, oy=-2)
    put(counter(), 5, 1, oy=-1)
    put(shelf2(), 8, 1, oy=-1)
    # Côté gauche : barrique sur chevalet ; à droite : tonneaux, caisses, sac de grain.
    put(barrique(1), 1, 4, oy=-1)
    put(crate_stack_v3(), 9, 4, ox=-1)
    put(barrel_v3(), 6, 6, ox=1)
    put(crate_v3(), 8, 6, ox=1)
    put(grain_sack(), 7, 6, ox=1)
    put(chair("right"), 4, 4, ox=2, oy=-1)
    put(table_v3(0, True), 5, 4, ox=1, oy=-1)
    planche("CUISINE v2 — à valider (9 × 6 cases)", room, [
        ("étagère, 2 cases", [shelf2().img()]),
        ("jambon au crochet (mur du fond) : il se balance", [wall_hook(i).img() for i in range(3)]),
        ("barrique de vin : le robinet goutte", [barrique(i).img() for i in range(3)]),
        ("sac de céréales", [grain_sack().img()]),
        ("tonneau, caisses (déjà validés)", [barrel_v3().img(), crate_v3().img(), crate_stack_v3().img()]),
    ], "art/cuisine_v2.png", note="Jambons : seulement contre le mur du fond. Le sac de céréales traîne aussi dans le donjon, avec tonneaux et caisses.")
