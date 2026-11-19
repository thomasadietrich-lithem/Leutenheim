"""Pièges de la section 3 (l'Ossuaire), v1 (Thomas, 2026-11-19, 13 h 40 : « Maintenant piège »). PROPOSITION à valider.
Sur les dalles en losange de l'ossuaire ; chaque piège en ARMÉ (un peu transparent, comme les autres sections) et
DÉCLENCHÉ.
  1. Dalle basculante : une dalle de tombe fêlée ; elle bascule, on tombe dans le caveau (1d8, une case pour remonter).
  2. Mains d'os : des doigts d'os qui dépassent entre les dalles ; déclenché, deux mains agrippent les chevilles (1d4, 2 tours).
  3. Encensoir : un brûle-parfum de fer au ras du sol ; déclenché, un nuage d'encens violet (case + voisines, 3 tours) :
     qui s'y tient est ENGOURDI (il perd un tour sur deux).
  4. Miroir de lune : une dalle d'argent poli ; déclenché, elle renvoie la lune : un éclair froid, la lumière reste 6 tours
     sur les cases autour : les tas d'os et gisants proches se relèvent, et le héros est vu de loin.
Écrit art/pieges_oss_v1.png.
"""
import importlib.util
import math
import os
import sys

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pix import hash2  # noqa: E402
from planche import planche  # noqa: E402
from pieges_v3 import S, P  # noqa: E402

P.update({
    "tomb": (150, 150, 162, 150), "tomb_l": (196, 196, 206, 170), "tomb_d": (96, 96, 110, 180), "crack": (30, 28, 40, 220),
    "bone": (226, 214, 184, 255), "bone_d": (172, 158, 128, 255), "bone_s": (92, 80, 64, 255),
    "iron": (70, 70, 86, 255), "iron_l": (118, 120, 140, 255), "ember": (255, 170, 80, 255), "ember_d": (180, 70, 40, 255),
    "smoke": (150, 110, 190, 140), "smoke_l": (196, 166, 230, 110),
    "silver": (180, 190, 210, 160), "silver_l": (236, 244, 255, 200), "silver_d": (110, 120, 140, 180),
    "moon": (214, 232, 255, 200), "moon_l": (255, 255, 255, 230),
})


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def slab(state="armed"):
    s = S()
    if state == "armed":
        s.r(4, 2, 10, 14, "tomb").r(4, 2, 10, 1, "tomb_l").r(4, 15, 10, 1, "tomb_d").r(4, 2, 1, 14, "tomb_l")
        s.r(8, 4, 2, 7, "tomb_d").r(6, 6, 6, 2, "tomb_d")  # croix gravée
        for (x, y) in ((5, 12), (6, 12), (7, 13), (8, 12), (9, 13), (10, 13), (11, 12), (12, 13)):
            s.p(x, y, "crack")  # la fêlure en travers : elle ne tient plus
        s.r(3, 2, 1, 14, "crack").r(14, 2, 1, 14, "crack")
    else:
        s.r(2, 3, 14, 13, "hole").r(2, 3, 14, 2, "dark")
        # la dalle bascule : elle pend de travers dans le trou
        for k in range(10):
            s.p(4 + k, 6 + k // 2, "tomb_l").p(4 + k, 7 + k // 2, "tomb").p(4 + k, 8 + k // 2, "tomb_d")
        s.r(10, 13, 3, 1, "bone").p(9, 13, "bone_d").r(4, 14, 2, 1, "bone_d")  # os au fond du caveau
    return s


def hands(state="armed"):
    s = S(18, 22)
    oy = 4
    if state == "armed":
        for (x, y) in ((5, 8), (7, 7), (9, 7), (11, 8), (6, 12), (11, 12)):
            s.r(x, y + oy, 1, 2, "bone").p(x, y + 2 + oy, "bone_d")
        s.r(4, 10 + oy, 9, 1, "crack")
    else:
        # deux mains d'os qui jaillissent du sol, doigts écartés et recourbés (b os, d os ombré)
        HAND = [
            "b.b.b....",
            "b.b.b.b..",
            "d.b.b.b..",
            ".bbbbbb.b",
            ".bbbbbbbd",
            "..bbbbbd.",
            "...bbd...",
            "...bb....",
            "...db....",
            "...bb....",
            "...bd....",
        ]
        for ox, flip in ((0, False), (9, True)):
            for y, row in enumerate(HAND):
                for x, c in enumerate(row[::-1] if flip else row):
                    if c != ".":
                        s.p(ox + x, 4 + y + oy, "bone" if c == "b" else "bone_d")
        s.r(2, 15 + oy, 14, 2, "hole").r(3, 14 + oy, 12, 1, "crack")
    return s


def censer(state="armed"):
    s = S(18, 24)
    oy = 6
    # brûle-parfum de fer bas, ajouré, posé entre les dalles
    s.r(5, 8 + oy, 8, 5, "iron").r(5, 8 + oy, 8, 1, "iron_l").r(6, 13 + oy, 6, 2, "iron")
    for x in (6, 8, 10):
        s.p(x, 10 + oy, "hole" if state == "armed" else "ember")
    s.r(7, 6 + oy, 4, 2, "iron").p(8, 5 + oy, "iron_l")
    if state == "armed":
        s.p(9, 4 + oy, "smoke_l").p(8, 2 + oy, "smoke_l")
    else:
        for y in range(24):
            for x in range(18):
                d = ((x - 9) / 9.5) ** 2 + ((y - 9) / 10) ** 2 + (hash2(x // 2, y // 2, 931) - 0.5) * 0.5
                if d <= 1:
                    base = s.a[y, x].astype(float)
                    m = np.array(P["smoke"], float)
                    a = 0.6 if d < 0.55 else 0.35
                    s.a[y, x] = (base * (1 - a) + m * a).astype(np.uint8) if base[3] else (*P["smoke"][:3], int(160 * a + 40))
        for x, y in ((4, 4), (13, 2), (9, 1), (12, 8), (6, 7)):
            s.p(x, y, "smoke_l")
    return s


def mirror(state="armed"):
    s = S(18, 24)
    oy = 6
    # un disque d'argent poli encastré, cerclé de fer, reflet bleuté
    for y in range(18):
        for x in range(18):
            d = math.hypot((x - 8.5) / 6.5, (y - 8.5) / 5.5)
            if d <= 1.0:
                s.p(x, y + oy, "iron" if d > 0.82 else "silver_l" if (x - y) in (-2, -1, 0) and d < 0.7 else "moon" if d < 0.45 else "silver")
    if state != "armed":
        # l'éclair froid : un rayon qui monte et des étincelles
        for y in range(0, 16):
            w = 1 + (16 - y) // 6
            for x in range(9 - w, 9 + w):
                s.p(x, y + oy - 6, "moon" if abs(x - 9) > 0 else "moon_l")
        for k in range(12):
            a = k / 12 * 2 * math.pi
            s.p(int(9 + math.cos(a) * 8), int(9 + oy + math.sin(a) * 7), "moon_l" if k % 2 else "moon")
    return s


def pendulum_slot():
    """Lame pendule (couloirs) : une rainure en travers de la case, marquée d'entailles ; la lame se dessine en jeu."""
    s = S()
    s.r(1, 8, 16, 3, "hole").r(1, 7, 16, 1, "tomb_d").r(1, 11, 16, 1, "tomb_l")
    for x in (3, 7, 11, 15):
        s.p(x, 6, "crack").p(x, 12, "crack")
    return s


def export():
    """python3 art/pieges_oss_v1.py export → src/render/sprites/piegesOss.ts"""
    from export_jeu_v4 import write
    write("src/render/sprites/piegesOss.ts", "PIEGES_OSS",
          "Pièges de la section 3 (art/pieges_oss_v1.png, Thomas 2026-11-19 : « Ok ») : armé / déclenché ; rainure de la lame pendule.",
          {"tombSlab": slab().img(), "tombSlabSprung": slab("sprung").img(), "boneHands": hands().img(), "boneHandsSprung": hands("sprung").img(),
           "censer": censer().img(), "censerSprung": censer("sprung").img(), "moonMirror": mirror().img(), "moonMirrorSprung": mirror("sprung").img(),
           "pendulum": pendulum_slot().img(), "pendulumSprung": pendulum_slot().img()})


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "export":
    export()
elif __name__ == "__main__":
    ob2 = load("ossuaire_objets_v2")
    from PIL import Image
    plan = ["#" * 11] + ["#" + "." * 9 + "#" for _ in range(4)] + ["#" * 11]
    a, xs, ys, wall = ob2.mini(plan)
    room = Image.fromarray(np.clip(a * 0.85, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

    def put(sp, cx, cy):
        im = sp.img()
        room.alpha_composite(im, (cx * 16 - 1, cy * 16 + 16 - im.height + 1))

    put(slab(), 1, 2); put(slab("sprung"), 2, 2)
    put(hands(), 4, 2); put(hands("sprung"), 5, 2)
    put(censer(), 7, 2); put(censer("sprung"), 8, 3)
    put(mirror(), 2, 4); put(mirror("sprung"), 5, 4)
    planche("PIÈGES SECTION 3 v1 — sur les dalles de l'ossuaire (armé / déclenché)", room, [
        ("dalle basculante : armé / déclenché", [slab().img(), slab("sprung").img()]),
        ("mains d'os : armé / déclenché", [hands().img(), hands("sprung").img()]),
        ("encensoir : armé / déclenché", [censer().img(), censer("sprung").img()]),
        ("miroir de lune : armé / déclenché", [mirror().img(), mirror("sprung").img()]),
    ], "art/pieges_oss_v1.png", S=5,
        note="Dalle : 1d8, un tour pour remonter. Mains : 1d4, agrippé 2 tours. Encensoir : engourdi. Miroir : la lune 6 tours.")
