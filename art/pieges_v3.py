"""Pièges, v3 (Thomas, 2026-11-11 : « Redesign les pièges, ils ne sont pas convaincants. Fais des pièges empoisonnés
aussi »). v2 (plaques de fer rivetées) refusée : trop « boîte posée sur le sol », on ne lit pas un danger.

Idée v3 : le piège fait PARTIE du sol. C'est une dalle qui n'est pas comme les autres — légèrement enfoncée, déchaussée,
de travers, aux bords rongés qui mordent un peu sur les joints voisins — et qui trahit ce qu'elle cache :
  1. Pointes : la dalle est percée de trous sombres en quinconce, une pointe luit au fond ; déclenché, les pointes jaillissent.
  2. Fosse : une dalle fendue en étoile, qui s'affaisse ; déclenché, elle s'effondre (trou noir aux bords cassés).
  3. Poison (aiguille) : petite dalle de pression ronde, tachée de vert, une aiguille brille au centre ; déclenché, giclée verte.
  4. Poison (gaz) : une grille ronde sous laquelle bouillonne une vapeur verte (animée) ; déclenché, nuage vert sur la case.
Chaque piège tient dans UNE case (16 pixels) ; il ne déborde que d'un pixel, irrégulièrement. Écrit art/pieges_v3.png.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from pix import hash2, grid, to_img
from sols_v1 import floor_b
from planche import planche

T = 16
P = {
    "out": (18, 13, 8, 255), "dark": (34, 29, 44, 200), "hole": (12, 9, 16, 255),
    # 2026-11-11 (Thomas : « ils contrastent trop, surtout sur les sols usés ») : la dalle reprend les couleurs du sol B
    # (pierre, joint), et elle est un peu transparente : la poussière du sol passe à travers.
    "slab": (75, 69, 96, 140), "slab_l": (90, 83, 114, 150), "slab_d": (52, 46, 68, 170),
    "spike": (220, 226, 240, 255), "spike_d": (130, 136, 158, 255), "rust": (120, 70, 46, 255),
    "blood": (120, 28, 34, 255), "green": (96, 170, 60, 255), "green_l": (170, 230, 110, 255), "green_d": (52, 100, 40, 255),
    "mist": (150, 220, 110, 120), "mist_l": (190, 240, 150, 90), "iron": (90, 95, 116, 255), "iron_l": (138, 144, 168, 255),
    "needle": (240, 244, 255, 255),
}


class S:
    def __init__(self, w=18, h=18):
        self.a = np.zeros((h, w, 4), np.uint8)

    def p(self, x, y, c):
        if 0 <= x < self.a.shape[1] and 0 <= y < self.a.shape[0]:
            self.a[y, x] = P[c] if isinstance(c, str) else c
        return self

    def r(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.p(xx, yy, c)
        return self

    def img(self):
        return Image.fromarray(self.a, "RGBA")


def sunken_slab(s, seed, inset=1.0):
    """Dalle déchaussée : contour irrégulier (±1 pixel autour de la case), bord sombre (elle est enfoncée), arête claire."""
    for y in range(18):
        for x in range(18):
            # Distance au bord de la case (1..16), bruitée : silhouette pas carrée.
            d = min(x - 1, y - 1, 16 - x, 16 - y) + (hash2(x // 3, y // 3, seed) - 0.5) * 1.6
            if d < -0.6:
                continue
            if d < 0.6:
                s.p(x, y, "dark")  # la fente autour : elle s'est enfoncée
            elif d < 1.6 and (x < 6 or y < 6):
                s.p(x, y, "slab_d")  # ombre du rebord, en haut à gauche
            else:
                r = hash2(x, y, seed + 1)
                s.p(x, y, "slab_l" if (x + y < 10 and r > 0.5) else "slab_d" if r < 0.15 else "slab")


def spikes(state="armed"):
    s = S()
    sunken_slab(s, 801)
    for i, (x, y) in enumerate(((4, 4), (9, 4), (14, 5), (6, 9), (11, 9), (4, 13), (9, 13), (13, 13))):
        if state == "armed":
            s.r(x - 1, y - 1, 2, 2, "hole").p(x, y, "dark")
            if i % 3 == 0:
                s.p(x - 1, y - 1, "spike_d")  # une pointe luit au fond
        else:
            s.r(x - 1, y, 2, 1, "hole")
            s.r(x - 1, y - 4, 1, 4, "spike").r(x, y - 4, 1, 4, "spike_d").p(x - 1, y - 5, "spike")
            if i in (1, 4):
                s.p(x - 1, y - 3, "blood").p(x - 1, y - 2, "blood")
    return s


def pit(state="armed"):
    s = S()
    sunken_slab(s, 811)
    if state == "armed":
        # Fêlures en étoile depuis le centre (la dalle ne tient plus).
        for ang in (0.3, 1.5, 2.6, 3.9, 5.1):
            for t in range(1, 8):
                x, y = 9 + math.cos(ang) * t, 9 + math.sin(ang) * t * 0.9
                s.p(int(round(x)), int(round(y)), "dark")
        s.r(8, 8, 2, 2, "hole")
    else:
        for y in range(18):
            for x in range(18):
                d = ((x - 9) / 6.5) ** 2 + ((y - 9.5) / 6.0) ** 2 + (hash2(x, y, 812) - 0.5) * 0.35
                if d <= 1:
                    s.p(x, y, "hole" if y > 6 else "slab_d")
        for x, y in ((3, 4), (14, 13), (5, 15)):
            s.r(x, y, 2, 1, "slab_l")  # éclats de la dalle
    return s


def needle(state="armed"):
    s = S()
    sunken_slab(s, 821)
    # Plaque de pression ronde au centre, cerclée de fer, tachée de vert (le poison a coulé).
    for y in range(18):
        for x in range(18):
            d = ((x - 9) / 4.6) ** 2 + ((y - 9) / 4.2) ** 2
            if d <= 1:
                s.p(x, y, "iron" if d > 0.6 else "slab_d")
    for x, y in ((6, 11), (7, 12), (11, 12), (12, 11), (10, 13), (5, 12)):
        s.p(x, y, "green_d")
    if state == "armed":
        s.p(9, 8, "needle").p(9, 9, "spike_d").p(8, 10, "green")
    else:
        s.r(9, 4, 1, 5, "needle").p(9, 9, "spike_d")
        for x, y in ((6, 3), (12, 2), (4, 6), (14, 5), (8, 2), (11, 6)):
            s.p(x, y, "green_l").p(x, y + 1, "green")
    return s


def gas(state="armed", phase=0):
    s = S(18, 24)
    sub = S()
    sunken_slab(sub, 831)
    s.a[6:24] = sub.a
    oy = 6
    # Grille ronde, barreaux, vapeur verte au fond.
    for y in range(18):
        for x in range(18):
            d = ((x - 9) / 5.2) ** 2 + ((y - 9) / 4.6) ** 2
            if d <= 1:
                bar = x % 3 == 0
                s.p(x, y + oy, "iron_l" if d > 0.7 and y < 9 else "iron" if d > 0.7 or bar else ("green_d" if (x + y + phase) % 4 else "green"))
    # Volutes qui montent (animées) ; déclenché : gros nuage.
    if state == "armed":
        for i, (x, y) in enumerate(((7, 7), (11, 5), (9, 3))):
            yy = y - phase + 6 - 3
            if 0 <= yy:
                s.p(x + (phase + i) % 2, yy, "mist").p(x + 1, yy - 1, "mist_l")
    else:
        for y in range(24):
            for x in range(18):
                d = ((x - 9) / 9.5) ** 2 + ((y - 11) / 10.5) ** 2 + (hash2(x // 2, y // 2, 840 + phase) - 0.5) * 0.5
                if d <= 1:
                    base = s.a[y, x].astype(float)
                    m = np.array(P["mist"], float)
                    a = 0.55 if d < 0.6 else 0.35
                    s.a[y, x] = (base * (1 - a) + m * a).astype(np.uint8) if base[3] else (*P["mist"][:3], int(160 * a + 40))
    return s


if __name__ == "__main__":
    IW, IH = 9, 3
    W, H = (IW + 2) * T, (IH + 2) * T
    xs, ys = grid(W, H)
    base = floor_b(xs, ys) * 0.95
    room = to_img(base).convert("RGBA")

    def put(sp, cx, cy):
        im = sp.img()
        room.alpha_composite(im, (cx * T - 1, cy * T + T - im.height + 1))

    put(spikes(), 1, 2)
    put(spikes("sprung"), 2, 2)
    put(pit(), 4, 2)
    put(pit("sprung"), 5, 2)
    put(needle(), 7, 2)
    put(needle("sprung"), 8, 2)
    put(gas(), 3, 4)
    put(gas("sprung"), 6, 4)
    planche("PIÈGES v3 — à valider : la dalle elle-même trahit le piège (armé / déclenché)", room, [
        ("pointes : armé / déclenché", [spikes().img(), spikes("sprung").img()]),
        ("fosse : armé / déclenché", [pit().img(), pit("sprung").img()]),
        ("POISON aiguille : armé / déclenché", [needle().img(), needle("sprung").img()]),
        ("POISON gaz : vapeur animée (3) / déclenché", [gas("armed", i).img() for i in range(3)] + [gas("sprung").img()]),
    ], "art/pieges_v3.png", S=5,
        note="Poison : PV perdus quelques tours (comme la potion de poison). Gaz : la case et ses voisines, 3 tours. Valeurs à régler ensemble.")
