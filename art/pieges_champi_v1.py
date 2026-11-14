"""Pièges de la section 2 (champignonnière), v1 (Thomas, 2026-11-14 : « Créer des nouveaux pièges adaptés au sol de la
nouvelle section »). Le sol B (pavés ronds moussus) n'a plus de dalles : le piège vit DANS la mousse et la terre.
  1. Lacet de mycélium : un anneau de fils pâles entre les pavés ; déclenché, les fils se dressent et ligotent (2 tours).
  2. Racines-crochets : une fente sombre d'où pointent deux crocs de racine ; déclenché, quatre racines jaillissent (dégâts + 1 tour).
  3. Vesse-de-loup : trois boules de spores à demi enterrées ; déclenché, elles crèvent : nuage de spores (poison, case + voisines).
Écrit art/pieges_champi_v1.png. 18 pixels de large comme les pièges v3 (1 de débord de chaque côté).
"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from pix import hash2, grid, to_img
from planche import planche
from pieges_v3 import S, P

P.update({
    "myc": (214, 226, 210, 190), "myc_l": (236, 248, 236, 230), "myc_d": (150, 170, 160, 150), "glow": (150, 240, 220, 255),
    "soil": (40, 30, 26, 210), "soil_d": (24, 18, 16, 235), "root": (104, 72, 48, 255), "root_l": (150, 108, 70, 255),
    "root_d": (64, 42, 30, 255), "thorn": (210, 190, 150, 255),
    "puff": (196, 178, 140, 255), "puff_l": (226, 212, 176, 255), "puff_d": (130, 112, 84, 255),
    "spore": (200, 210, 120, 150), "spore_l": (228, 236, 160, 110),
})


def snare(state="armed"):
    s = S()
    if state == "armed":
        for t in range(48):
            a = t / 48 * 2 * math.pi
            r = 5.6 + (hash2(t, 3, 901) - 0.5) * 1.6
            x, y = 9 + math.cos(a) * r, 9 + math.sin(a) * r * 0.85
            if hash2(t, 1, 902) > 0.25:
                s.p(int(round(x)), int(round(y)), "myc" if t % 5 else "myc_l")
        for a in (0.4, 1.9, 3.3, 4.7):  # quelques fils vers le centre
            for t in range(2, 5):
                s.p(int(round(9 + math.cos(a) * t)), int(round(9 + math.sin(a) * t * 0.85)), "myc_d")
        s.p(9, 9, "myc_l").p(8, 9, "myc").p(9, 8, "glow")
    else:
        # Les fils se dressent : une gerbe de filaments qui monte et s'entrecroise.
        for k in range(9):
            x0 = 3 + k * 1.5
            for t in range(11):
                x = x0 + math.sin(t * 0.7 + k) * 1.3 + (9 - x0) * t / 16
                y = 15 - t
                s.p(int(round(x)), y, "myc_l" if t > 8 else "myc" if k % 2 else "myc_d")
        for x, y in ((5, 5), (12, 3), (9, 6)):
            s.p(x, y, "glow")
    return s


def hooks(state="armed"):
    s = S()
    # Fente de terre entre les pavés.
    for y in range(18):
        for x in range(18):
            d = ((x - 9) / 6.0) ** 2 + ((y - 10) / 2.2) ** 2 + (hash2(x // 2, y, 911) - 0.5) * 0.5
            if d <= 1:
                s.p(x, y, "soil_d" if d < 0.45 else "soil")
    if state == "armed":
        # Deux crocs à peine sortis.
        for x0, flip in ((6, 1), (12, -1)):
            s.p(x0, 10, "root").p(x0, 9, "root_l").p(x0 + flip, 8, "root").p(x0 + flip, 8, "thorn" if flip > 0 else "root")
    else:
        for i, (x0, flip, hgt) in enumerate(((4, 1, 8), (7, -1, 11), (11, 1, 10), (14, -1, 7))):
            for t in range(hgt):
                x = x0 + int(round(math.sin(t / hgt * 2.2) * 2 * flip))
                y = 11 - t
                s.p(x, y, "root_l" if t % 3 == 0 else "root").p(x + 1, y, "root_d")
                if t in (hgt // 2, hgt - 3):
                    s.p(x - flip, y, "thorn")
            xt = x0 + int(round(math.sin(2.2) * 2 * flip))
            s.p(xt - flip, 11 - hgt, "root").p(xt - 2 * flip, 12 - hgt, "thorn")  # le crochet au bout
    return s


def puffs(state="armed"):
    s = S(18, 24)
    oy = 6
    for (cx, cy, r) in ((6, 10, 3.2), (11.5, 8, 2.6), (11, 13, 2.2)):
        for y in range(18):
            for x in range(18):
                d = ((x - cx) / r) ** 2 + ((y - cy) / (r * 0.85)) ** 2
                if d <= 1.25 and d > 1:
                    s.p(x, y + oy, "soil")
                if d <= 1:
                    if state == "armed":
                        c = "puff_l" if (x < cx and y < cy and d < 0.5) else "puff_d" if (y > cy and d > 0.55) else "puff"
                    else:
                        c = "puff_d" if d > 0.5 else "soil_d"  # crevées : une coque vide
                    s.p(x, y + oy, c)
        if state == "armed":
            s.p(int(cx), int(cy - r * 0.6) + oy, "puff_d")  # le petit pore au sommet
    if state != "armed":
        for y in range(24):
            for x in range(18):
                d = ((x - 9) / 9.5) ** 2 + ((y - 10) / 10.5) ** 2 + (hash2(x // 2, y // 2, 921) - 0.5) * 0.5
                if d <= 1:
                    base = s.a[y, x].astype(float)
                    m = np.array(P["spore"], float)
                    a = 0.55 if d < 0.6 else 0.35
                    s.a[y, x] = (base * (1 - a) + m * a).astype(np.uint8) if base[3] else (*P["spore"][:3], int(160 * a + 40))
        for x, y in ((3, 4), (14, 2), (8, 1), (12, 7), (5, 9)):
            s.p(x, y, "spore_l")
    return s


if __name__ == "__main__":
    from champi_sols_v1 import floor_cobbles
    IW, IH = 7, 3
    W, H = (IW + 2) * 16, (IH + 2) * 16
    xs, ys = grid(W, H)
    room = to_img(floor_cobbles(xs, ys)).convert("RGBA")

    def put(sp, cx, cy):
        im = sp.img()
        room.alpha_composite(im, (cx * 16 - 1, cy * 16 + 16 - im.height + 1))

    put(snare(), 1, 2); put(snare("sprung"), 2, 2)
    put(hooks(), 4, 2); put(hooks("sprung"), 5, 2)
    put(puffs(), 2, 4); put(puffs("sprung"), 5, 4)
    planche("PIÈGES SECTION 2 v1 — dans la mousse et la terre (armé / déclenché)", room, [
        ("lacet de mycélium : armé / déclenché", [snare().img(), snare("sprung").img()]),
        ("racines-crochets : armé / déclenché", [hooks().img(), hooks("sprung").img()]),
        ("vesse-de-loup : armé / déclenché", [puffs().img(), puffs("sprung").img()]),
    ], "art/pieges_champi_v1.png", S=5,
        note="Lacet : ligoté 2 tours. Racines : 1d6 et 1 tour. Vesse : nuage de spores empoisonné, case + voisines, 3 tours.")


def export():
    """python3 -c 'import sys; sys.path.insert(0,"art"); import pieges_champi_v1 as p; p.export()'"""
    from export_jeu_v4 import write
    write("src/render/sprites/piegesChampi.ts", "PIEGES_CHAMPI",
          "Pièges de la section 2 (art/pieges_champi_v1.png, 2026-11-14) : armé / déclenché.",
          {"snare": snare().img(), "snareSprung": snare("sprung").img(), "hooks": hooks().img(), "hooksSprung": hooks("sprung").img(),
           "spores": puffs().img(), "sporesSprung": puffs("sprung").img()})
