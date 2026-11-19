"""Section 3, l'Ossuaire : deuxième SALLE SPÉCIALE, la CHAPELLE DES OS, et une autre sœur d'os (Thomas, 2026-11-19,
13 h 23 : « fais une chapelle aussi comme spéciale dans la section, avec une autre sœur d'os »). PROPOSITION, rien n'est
en jeu.

La chapelle d'avant le culte de la Lune pâle : bancs faits de fémurs, allée de dalles usées, autel de craie avec un calice
d'argent et deux chandeliers (ses cierges sont la seule lumière chaude de l'étage), une ROSACE ajourée dans le mur du fond
par où tombe un rai de lune sur l'autel, des alcôves de crânes, un bénitier, un lustre d'os. SŒUR CLAVICULE, la sœur
aînée de Sœur Osseuse, y prie à genoux : voile blanc, guimpe bleu pâle, chapelet d'argent.

  python3 art/ossuaire_chapelle_v1.py   → art/ossuaire_chapelle_v1.png
"""
import importlib.util
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pix import font, grid, up  # noqa: E402


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ob1 = load("ossuaire_objets_v1")
ob2 = load("ossuaire_objets_v2")
mus = load("ossuaire_musee_v1")
Sprite, C = ob1.Sprite, ob1.C
T = 16

# 14 × 10 de sol ; porte en bas au milieu.
PLAN = ["#" * 16] + ["#" + "." * 14 + "#" for _ in range(10)] + ["#" * 7 + ".." + "#" * 7]

BONE, BONE_D, BONE_S = (226, 214, 184), (176, 162, 132), (96, 84, 66)
SILVER, SILVER_D, SILVER_L = (180, 190, 206), (110, 118, 134), (236, 242, 252)
CLOTH, CLOTH_D, CLOTH_L = (88, 98, 128), (54, 60, 84), (128, 140, 172)


def pew():
    """Banc de fémurs : une assise de planches grises posée sur des fémurs croisés, un dossier d'os (2 cases)."""
    s = Sprite(32, 16)
    # dossier : rangée de fémurs debout, têtes rondes
    for x in range(1, 31, 3):
        s.r(x, 1, 2, 7, BONE).r(x + 1, 1, 1, 7, BONE_D).r(x - 0, 0, 3, 1, BONE)
    s.r(0, 7, 32, 1, BONE_D)
    # assise
    s.r(0, 8, 32, 3, (120, 112, 104)).r(0, 8, 32, 1, (156, 148, 138)).r(0, 10, 32, 1, (84, 78, 74))
    # pieds : fémurs en X
    for x0 in (2, 26):
        ob2.line(s, x0, 11, x0 + 4, 15, BONE), ob2.line(s, x0 + 4, 11, x0, 15, BONE_D)
    return s.done()


def pew_broken():
    s = Sprite(32, 16)
    for x in range(1, 16, 3):
        s.r(x, 1, 2, 7, BONE).r(x + 1, 1, 1, 7, BONE_D)
    s.r(0, 8, 18, 3, (120, 112, 104)).r(0, 8, 18, 1, (156, 148, 138))
    ob2.line(s, 18, 8, 26, 13, (120, 112, 104)), ob2.line(s, 18, 9, 26, 14, (84, 78, 74))
    for x, y in ((22, 4), (27, 9), (29, 13)):
        s.r(x, y, 3, 1, BONE).p(x, y + 1, BONE_D)
    ob2.line(s, 2, 11, 6, 15, BONE), ob2.line(s, 6, 11, 2, 15, BONE_D)
    return s.done()


def chapel_altar():
    """Autel de craie à nappe blanche bordée de bleu, calice d'argent, livre ouvert (3 cases)."""
    s = Sprite(48, 26)
    s.r(1, 11, 46, 13, "sD").r(1, 11, 46, 1, "s").r(1, 22, 46, 2, "sDD")
    s.r(1, 4, 46, 7, "s").r(1, 4, 46, 1, "sL").r(1, 10, 46, 1, "sDD")
    s.r(8, 4, 32, 7, (232, 228, 216)).r(8, 11, 32, 9, (232, 228, 216)).r(8, 19, 32, 1, CLOTH)
    s.r(8, 11, 1, 9, CLOTH).r(39, 11, 1, 9, CLOTH)
    # croix d'os brodée
    s.r(23, 12, 2, 6, BONE_D).r(21, 14, 6, 2, BONE_D)
    # calice d'argent
    s.r(20, 0, 7, 3, SILVER).r(20, 0, 7, 1, SILVER_L).r(22, 3, 3, 1, SILVER_D).r(23, 4, 1, 1, SILVER_D)
    # livre ouvert
    s.r(30, 2, 10, 3, (240, 234, 214)).r(34, 2, 1, 3, (150, 140, 120)).r(30, 5, 10, 1, (90, 40, 40))
    return s.done()


def chandelier():
    """Grand chandelier d'argent à trois cierges allumés."""
    s = Sprite(16, 30)
    s.r(7, 10, 2, 16, SILVER_D).r(7, 10, 1, 16, SILVER).r(3, 26, 10, 3, SILVER_D).r(4, 25, 8, 1, SILVER)
    s.r(2, 9, 12, 2, SILVER).r(2, 9, 12, 1, SILVER_L)
    for x in (2, 7, 12):
        s.r(x, 3, 2, 6, (240, 234, 220)).r(x + 1, 3, 1, 6, (200, 192, 176))
        s.p(x, 1, (255, 214, 110)).p(x, 2, (255, 244, 200)).p(x + 1, 2, (255, 200, 90))
    return s.done()


def rosace():
    """Rosace ajourée dans le mur du fond : un cercle de craie, six pétales évidés où passe la lumière (2 cases)."""
    s = Sprite(32, 16)
    yy, xx = np.mgrid[0:16, 0:32]
    cx, cy = 15.5, 7.5
    d = np.hypot((xx - cx) / 1.0, (yy - cy) / 0.95)
    ring = (d <= 7.6) & (d >= 6.4)
    s.a[ring] = (*C["sL"], 255)
    ang = np.arctan2(yy - cy, xx - cx)
    hole = (d < 6.4) & (np.cos(6 * ang) > 0.15) & (d > 1.8)
    s.a[hole] = (196, 222, 255, 255)
    s.a[(d < 6.4) & ~hole & (d > 1.8)] = (*C["s"], 255)
    s.a[d <= 1.8] = (*C["sL"], 255)
    return s.done()


def stoup():
    """Bénitier : une vasque de craie sur un pied, eau pâle."""
    s = Sprite(14, 16)
    s.r(1, 3, 12, 4, "s").r(1, 3, 12, 1, "sL").r(2, 4, 10, 2, (150, 184, 220)).r(3, 4, 4, 1, (210, 230, 250))
    s.r(2, 7, 10, 1, "sD").r(5, 8, 4, 6, "sD").r(5, 8, 1, 6, "s").r(3, 13, 8, 2, "sDD")
    return s.done()


def aisle(a):
    """Allée de dalles bleu-gris usées, de la porte à l'autel."""
    for y in range(4 * T, 11 * T):
        for x in range(7 * T, 9 * T):
            lx, ly = x % T, y % T
            c = np.array(CLOTH_D if (lx == 0 or ly == 0) else CLOTH) * (0.85 + 0.15 * ((x * 7 + y * 13) % 5) / 4)
            a[y, x] = a[y, x] * 0.35 + c * 0.65


# ---------------------------------------------------------------- SŒUR CLAVICULE (16 × 16, comme Sœur Osseuse)
# La sœur aînée : VOILE BLANC (et non noir), guimpe bleu pâle, chapelet d'argent, robe gris-bleu.
SOEUR_PAL = {"K": (16, 12, 18), "V": (226, 224, 232), "v": (170, 168, 186), "X": (176, 200, 230), "W": (230, 220, 194),
             "w": (168, 156, 128), "E": (18, 13, 16), "H": (90, 98, 124), "h": (64, 70, 94), "R": (200, 210, 228)}
SOEUR = [
    "....KKKKKKKK....",
    "...KVVVVVVVVK...",
    "..KVvXXXXXXvVK..",
    "..KVXWWWWWWXVK..",
    "..KVXWEEWEEXVK..",
    "..KVXWEEWEEXVK..",
    "..KVXWWwwWWXVK..",
    "..KVKXwKKwXKVK..",
    ".KVVVKXXXXKVVVK.",
    ".KVHHHHHHHHHHVK.",
    ".KVHhHRHHRHhHVK.",
    "..KHWWHRRHWWHK..",
    "..KHhHHHRHHhHK..",
    "..KHhHHHRHHhHK..",
    "..KVHHHHHHHHVK..",
    "...KVK.KK.KVK...",
]
SOEUR_PRAY = [
    "................",
    "....KKKKKKKK....",
    "...KVVVVVVVVK...",
    "..KVvXXXXXXvVK..",
    "..KVXWWWWWWXVK..",
    "..KVXWEEWEEXVK..",
    "..KVXWWwwWWXVK..",
    "..KVKXwKKwXKVK..",
    ".KVVVKXWWXKVVVK.",
    ".KVHHHHWWHHHHVK.",
    ".KVHhHHRRHHhHVK.",
    "..KHHHHHRHHHHK..",
    ".KHhHHHHRHHHhHK.",
    ".KHHHHHHHHHHHHK.",
    "KVHHhHHHHHHhHHVK",
    ".KKKKKKKKKKKKKK.",
]
# Sa bulle : un cierge d'argent allumé.
BUBBLE = ["...Y....", "..YyY...", "...y....", "..RRR...", "..RWR...", "..RWR...", "..RWR...", ".RRRRR.."]
BUBBLE_PAL = {"Y": (255, 214, 110), "y": (255, 244, 200), "R": (110, 118, 134), "W": (236, 242, 252)}


def sprite(rows, pal):
    s = Sprite(len(rows[0]), len(rows))
    s.rows(0, 0, rows, pal)
    return s


def room():
    a, xs, ys, wall = ob2.mini(PLAN)
    aisle(a)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")
    put = lambda sp, x, y, sh=True: ob2.paste(img, sp, x, y, sh)  # noqa: E731
    # mur du fond : rosace au milieu, alcôves de crânes de part et d'autre (peintes comme dans le jeu : une rangée de crânes)
    img.paste(rosace().img(), (7 * T, 0), rosace().img())
    for x0 in (2 * T, 11 * T):
        sk = Sprite(3 * T, 12)
        sk.r(0, 0, 3 * T, 12, "k")
        for k in range(8):
            ob2.skull_face(sk, 1 + k * 6, 3)
        sk.done()
        img.paste(sk.img(), (x0, 2), sk.img())
    # autel et ses deux chandeliers, sous la rosace
    put(chapel_altar(), 6 * T + 8, 1 * T + 6, False)
    put(chandelier(), 5 * T, 1 * T - 2)
    put(chandelier(), 10 * T + 2, 1 * T - 2)
    # la sœur à genoux devant l'autel
    put(sprite(SOEUR_PRAY, SOEUR_PAL).done(), 7 * T + 8, 3 * T + 2)
    # bancs de fémurs de part et d'autre de l'allée (un cassé)
    for row, y in enumerate(range(5 * T, 10 * T, 2 * T)):
        for x in (3 * T, 10 * T):
            put(pew_broken() if (row, x) == (1, 10 * T) else pew(), x + (8 if x > 8 * T else 0), y)
    # bénitier à l'entrée, lustre d'os au-dessus de l'allée, pilier de crânes dans les coins
    put(stoup(), 6 * T, 10 * T)
    put(ob2.bone_chandelier(), 7 * T + 3, 6 * T, False)
    put(ob2.skull_pillar(), 1 * T, 9 * T - 14)
    put(ob2.skull_pillar(), 14 * T, 9 * T - 14)
    # lumière : rai de lune par la rosace sur l'autel et l'allée, cierges chauds autour de l'autel, le reste sombre
    a = np.asarray(img).astype(float)
    W, H = img.size
    gx, gy = grid(W, H)
    L = np.full((H, W), 0.42)
    warm = np.zeros((H, W))
    for (x, y) in ((5 * T + 8, 1 * T), (10 * T + 10, 1 * T)):
        g = np.clip(1 - np.hypot(gx - x, gy - y) / T / 4.2, 0, 1)
        L = np.maximum(L, 0.42 + g * 0.8)
        warm = np.maximum(warm, g)
    # le rai : un trapèze qui s'élargit de la rosace vers le bas
    half = 0.9 * T + (gy - T) * 0.18
    ray = np.clip(1 - np.abs(gx - 8 * T) / np.maximum(half, 1), 0, 1) * (gy > T) * np.clip(1 - (gy - T) / (8 * T), 0.15, 1)
    L = np.maximum(L, 0.42 + ray * 0.9)
    tint = np.ones((H, W, 3))
    tint = tint * (1 - warm[..., None] * 0.28) + np.array((1.25, 1.0, 0.7)) * warm[..., None] * 0.28
    tint = tint * (1 - ray[..., None] * 0.3) + np.array((0.82, 0.92, 1.15)) * ray[..., None] * 0.3
    a = a * L[..., None] * tint
    # poussière dans le rai
    rng = np.random.default_rng(3)
    for _ in range(70):
        y = int(rng.integers(T, 9 * T))
        x = int(8 * T + rng.normal(0, 0.5) * (0.9 * T + (y - T) * 0.18))
        if 0 <= x < W and ray[y, x] > 0.3:
            a[y, x] = np.minimum(a[y, x] * 1.5 + 30, 255)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def main():
    S = 3
    big = up(room(), S)
    parts = [
        ("Sœur Clavicule (×6)", up(sprite(SOEUR, SOEUR_PAL).done().img(), 6)),
        ("…en prière (×6)", up(sprite(SOEUR_PRAY, SOEUR_PAL).done().img(), 6)),
        ("Sa bulle (×8)", up(sprite(BUBBLE, BUBBLE_PAL).done().img(), 8)),
        ("Banc de fémurs, cassé (×3)", up(pew().img(), 3)),
        ("Autel (×3)", up(chapel_altar().img(), 3)),
        ("Chandelier, rosace, bénitier (×3)", None),
    ]
    trio = Image.new("RGBA", (16 * 3 + 32 * 3 + 14 * 3 + 30, 30 * 3), (0, 0, 0, 0))
    for im, x in ((up(chandelier().img(), 3), 0), (up(rosace().img(), 3), 16 * 3 + 12), (up(stoup().img(), 3), 16 * 3 + 32 * 3 + 24)):
        trio.paste(im, (x, trio.height - im.height), im)
    parts[-1] = (parts[-1][0], trio)
    pad = 24
    Wb = max(big.width + 2 * pad, 1200)
    sheet = Image.new("RGB", (Wb, 90 + big.height + 60 + 2 * 200 + 230), (14, 12, 18))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 3 · SALLE SPÉCIALE · LA CHAPELLE DES OS (v1) · SŒUR CLAVICULE", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((Wb // 2, 54), "Bancs de fémurs · allée · autel, calice d'argent, deux chandeliers · rosace du fond où tombe la lune · alcôves de crânes · bénitier · lustre d'os",
           fill=(190, 180, 160), font=font(13, False), anchor="mm")
    sheet.paste(big, ((Wb - big.width) // 2, 80))
    x, y = pad, 80 + big.height + 50
    rowh = 0
    for name, im in parts:
        if x + max(im.width, 300) > Wb - pad:
            x, y = pad, y + rowh + 50
            rowh = 0
        d.text((x, y - 22), name, fill=(240, 192, 80), font=font(15), anchor="lt")
        bg = Image.new("RGB", im.size, (40, 36, 44))
        bg.paste(im, (0, 0), im)
        sheet.paste(bg, (x, y))
        x += max(im.width, 300) + pad
        rowh = max(rowh, im.height)
    y += rowh + 40
    note = [
        "SŒUR CLAVICULE (proposition) : la sœur aînée de Sœur Osseuse, restée fidèle à la vieille chapelle quand le culte de la Lune pâle a pris l'ossuaire.",
        "Elle ne bouge pas de sa chapelle. Trois demandes (une par rencontre) :",
        "  1. « Les morts ne dorment plus » : briser le crâne de 5 squelettes → BÉNÉDICTION DU REPOS (sur l'étage, les tas d'os ne se relèvent plus).",
        "  2. « Mes cierges d'argent » : en rallumer 3 dans les salles de l'étage → POTION DE NUIT (éteint la lune autour de vous 10 tours).",
        "  3. « Ma sœur » : si l'on a aidé Sœur Osseuse plus haut, elle vous reconnaît → son CHAPELET D'ARGENT (amulette : +2 CA contre les morts).",
        "La chapelle : salle spéciale rare de la section 3, jamais verrouillée ; pas de monstre dedans ; ses cierges éclairent (lumière chaude).",
    ]
    for i, t in enumerate(note):
        d.text((pad, y + i * 22), t, fill=(200, 196, 210), font=font(13, False), anchor="lt")
    sheet = sheet.crop((0, 0, Wb, y + len(note) * 22 + 20))
    sheet.save(os.path.join(HERE, "ossuaire_chapelle_v1.png"))
    print("art/ossuaire_chapelle_v1.png", sheet.size)


if __name__ == "__main__":
    main()
