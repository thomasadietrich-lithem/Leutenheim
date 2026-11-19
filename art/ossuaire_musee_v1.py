"""Section 3, l'Ossuaire : première SALLE SPÉCIALE, le MUSÉE (Thomas, 2026-11-19, 10 h 44 : « design la première salle
spéciale ; en mode musée, un énorme squelette de tricératops sur une estrade ; dalle claire ; cordon rouge ; des supports à
bougie ; un écriteau ; garde la quête associée en todo »). PROPOSITION, rien n'est en jeu.

  python3 art/ossuaire_musee_v1.py   → art/ossuaire_musee_v1.png
"""
import importlib.util
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pix import font, grid, hash2, up  # noqa: E402


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ob1 = load("ossuaire_objets_v1")
ob2 = load("ossuaire_objets_v2")
Sprite, C = ob1.Sprite, ob1.C
line, mini = ob2.line, ob2.mini
T = 16

BONE, BONE_D, BONE_S = (226, 214, 184), (176, 162, 132), (70, 60, 50)
BRASS, BRASS_D, BRASS_L = (196, 150, 62), (130, 94, 34), (240, 200, 110)
RED, RED_D, RED_L = (176, 30, 40), (110, 16, 24), (220, 70, 70)

PLAN = [
    "##############",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "#............#",
    "######..######",
]


def pale_floor(a, xs, ys, wall):
    """Dalles claires de musée (grandes dalles de pierre polie, joints fins, quelques veines)."""
    cx, cy = (xs // 16).astype(int), (ys // 16).astype(int)
    lx, ly = xs % 16, ys % 16
    t = hash2(cx, cy, 301)
    base = np.array((196, 192, 182))[None, None, :] * (0.92 + 0.1 * t[..., None])
    vein = (np.abs(((xs * 0.7 + ys * 1.3) % 23) - 11) < 0.5) & (hash2(cx, cy, 302) < 0.4)
    base[vein] = base[vein] * 0.9
    j = (lx == 0) | (ly == 0)
    base[j] = (150, 146, 140)
    hi = (lx == 1) | (ly == 1)
    base[hi & ~j] = np.minimum(base[hi & ~j] * 1.05, 255)
    fl = ~wall
    a[fl] = base[fl]
    # ombre portée du mur du haut
    for k in range(6):
        a[T + k, :][fl[T + k, :]] *= 0.6 + 0.07 * k
    return a


def estrade():
    """Estrade de pierre à deux marches, 7 × 3 cases (112 × 52), vue en 3/4."""
    s = Sprite(114, 54)
    s.r(1, 6, 112, 34, (176, 172, 162)).r(1, 6, 112, 1, (214, 210, 198))  # dessus
    s.r(1, 40, 112, 6, (140, 136, 128)).r(1, 40, 112, 1, (160, 156, 148))  # contremarche haute
    s.r(1, 46, 112, 2, (198, 194, 184))  # marche
    s.r(1, 48, 112, 5, (122, 118, 112))  # contremarche basse
    for x in range(8, 110, 16):
        s.r(x, 41, 1, 5, (116, 112, 106)).r(x + 6, 49, 1, 4, (100, 96, 92))
    # plinthe dorée et plaque au milieu de la marche
    s.r(1, 39, 112, 1, BRASS_D)
    s.r(49, 41, 16, 4, BRASS).r(49, 41, 16, 1, BRASS_L).r(51, 43, 12, 1, BRASS_D)
    return s.done()


def triceratops():
    """Squelette de tricératops monté, de profil vers la gauche, ~150 × 84 (il déborde de l'estrade : énorme)."""
    W_, H_ = 150, 86
    s = Sprite(W_, H_)
    B, D, S_ = BONE, BONE_D, BONE_S

    def thick(x0, y0, x1, y1, w, c=B, edge=D):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x = x0 + (x1 - x0) * i / n
            y = y0 + (y1 - y0) * i / n
            for k in range(w):
                s.p(round(x), round(y) + k, c if k < w - 1 else edge)

    # COLLERETTE : grand bouclier en éventail derrière la tête, bord festonné, deux fenêtres
    cx, cy, r = 40, 26, 23
    for y in range(H_):
        for x in range(W_):
            d = math.hypot(x - cx, (y - cy) * 1.1)
            if d < r and x >= cx - 12 and y < cy + 16:
                s.p(x, y, D if d > r - 3 else B)
    for (hx, hy, hw, hh) in ((42, 12, 7, 6), (50, 22, 6, 7)):
        s.r(hx, hy, hw, hh, S_).r(hx + 1, hy + 1, hw - 2, hh - 2, (40, 34, 30))
    for k in range(11):
        a = math.radians(-105 + k * 19)
        s.r(int(cx + (r + 1) * math.cos(a)), int(cy + (r + 1) * math.sin(a) / 1.1), 2, 2, B)
    # CRÂNE : face, bec crochu, orbite, narine, mâchoire et dents
    s.r(9, 30, 36, 15, B).r(5, 34, 6, 10, B).r(2, 37, 4, 7, D).r(1, 41, 3, 4, D)
    s.r(9, 44, 34, 3, D)
    for x in range(12, 40, 4):
        s.r(x, 45, 2, 2, S_)
    s.r(28, 32, 6, 5, S_).r(29, 33, 4, 3, (30, 26, 22))  # orbite
    s.r(13, 35, 4, 3, S_)  # narine
    s.r(9, 30, 36, 1, (240, 232, 210))
    # cornes : deux grandes au-dessus des yeux, une sur le nez
    thick(30, 31, 6, 12, 3), thick(34, 30, 12, 9, 2)
    s.r(4, 11, 3, 2, B)
    thick(9, 32, 4, 24, 3), s.r(3, 23, 2, 2, B)
    # COU et COLONNE (deux pixels d'épaisseur), épines dorsales
    spine = [(48, 40), (58, 34), (70, 29), (84, 27), (98, 28), (110, 31), (120, 37), (129, 45), (137, 53), (143, 61), (148, 68)]
    for (x0, y0), (x1, y1) in zip(spine, spine[1:]):
        thick(x0, y0, x1, y1, 3)
    for (x, y) in spine[1:7]:
        s.r(x, y - 5, 2, 5, B)
    for (x, y) in spine[7:]:
        s.r(x, y - 3, 1, 3, D)
    # CÔTES : arcs sous la colonne, de plus en plus courtes vers l'arrière
    for k, x in enumerate(range(62, 104, 4)):
        top = 32 - min(k, 4)
        ln = 20 - abs(k - 4) * 1.4
        thick(x, top, x - 2, int(top + ln), 2)
        s.r(x - 3, int(top + ln), 3, 2, D)
    thick(60, 54, 100, 54, 2, D, S_)  # sternum
    # BASSIN
    s.r(104, 28, 16, 10, B).r(107, 31, 7, 4, S_).r(104, 37, 16, 2, D)
    # PATTES : épaisses, genou marqué, pieds à griffes
    for (x, top, back) in ((62, 52, False), (74, 52, False), (106, 38, True), (116, 38, True)):
        mid = top + (14 if not back else 20)
        s.r(x, top, 5, mid - top, B).r(x + 4, top, 1, mid - top, D)
        s.r(x - 1, mid, 6, 3, D)
        s.r(x + 1, mid + 3, 4, 78 - mid - 3, B).r(x + 4, mid + 3, 1, 78 - mid - 3, D)
        s.r(x - 2, 78, 9, 3, B).r(x - 2, 80, 9, 1, D)
    # socle et tiges de fer du montage
    s.r(54, 82, 76, 3, (110, 104, 96))
    for x in (90, 126):
        s.r(x, 40 if x < 100 else 60, 1, 82 - (40 if x < 100 else 60), C["iL"])
    return s.done()


def post():
    """Potelet de laiton du cordon."""
    s = Sprite(6, 16)
    s.r(2, 1, 2, 12, BRASS).r(2, 1, 1, 12, BRASS_L).r(1, 0, 4, 2, BRASS_L).r(0, 13, 6, 3, BRASS_D).r(1, 13, 4, 1, BRASS)
    return s.done()


def candle_stand():
    """Support à bougie sur pied (candélabre de fer), bougie allumée."""
    s = Sprite(10, 26)
    s.r(4, 8, 2, 15, C["i"]).r(4, 8, 1, 15, C["iL"])
    s.r(1, 23, 8, 2, C["i"]).r(2, 22, 6, 1, C["iL"])
    s.r(2, 7, 6, 2, C["iL"]).r(1, 6, 8, 1, C["iH"])
    s.r(3, 1, 4, 6, (236, 228, 210)).r(6, 1, 1, 6, (196, 188, 170))  # bougie
    s.p(4, 0, (255, 220, 120)).p(5, 0, (255, 248, 210))
    return s.done()


def sign():
    """Écriteau sur pied (pupitre de laiton), texte gravé."""
    s = Sprite(16, 20)
    s.r(1, 1, 14, 9, (60, 40, 30)).r(2, 2, 12, 7, (224, 214, 186))
    for y in (3, 5, 7):
        s.r(3, y, 10 if y != 7 else 6, 1, (90, 70, 50))
    s.r(7, 10, 2, 8, BRASS).r(7, 10, 1, 8, BRASS_L).r(4, 18, 8, 2, BRASS_D)
    return s.done()


def rope(a, x0, y0, x1, y1, sag=4):
    """Cordon rouge qui pend entre deux potelets (pixels du monde)."""
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        t = i / n
        x = round(x0 + (x1 - x0) * t)
        y = round(y0 + (y1 - y0) * t + sag * math.sin(math.pi * t))
        a[y, x] = RED
        a[y + 1, x] = RED_D
        if i % 6 == 0:
            a[y, x] = RED_L


def room(lit=True):
    a, xs, ys, wall = mini(PLAN)
    a = pale_floor(a, xs, ys, wall)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")

    def put(sp, x, y, shadow=True):
        ob2.paste(img, sp, x, y, shadow)

    # cordon rouge sur potelets tout autour (le rang du fond passe DERRIÈRE le squelette), une ouverture devant l'écriteau
    posts = [(2 * T + 2, 1 * T + 4), (6 * T + 6, 1 * T + 4), (11 * T + 2, 1 * T + 4), (11 * T + 2, 7 * T + 2), (8 * T, 7 * T + 8), (5 * T, 7 * T + 8), (2 * T + 2, 7 * T + 2)]
    loop = list(zip(posts + [posts[0]], (posts + [posts[0]])[1:]))
    back = [seg for seg in loop if seg[0][1] < 2 * T and seg[1][1] < 2 * T]
    front = [seg for seg in loop if seg not in back and seg[0] != (8 * T, 7 * T + 8)]

    def ropes(segs, with_posts):
        nonlocal img
        arr = np.asarray(img).copy()
        for (x0, y0), (x1, y1) in segs:
            rope(arr, x0 + 3, y0 + 2, x1 + 3, y1 + 2)
        img = Image.fromarray(arr, "RGB")
        for (x, y) in with_posts:
            ob2.paste(img, post(), x, y, True)

    ropes(back, posts[:3])
    # estrade au milieu, le tricératops dessus (il la déborde : il est énorme)
    ex, ey = 3 * T + 8, 4 * T - 4
    put(estrade(), ex, ey, False)
    put(triceratops(), ex - 16, ey + 40 - 86, False)
    ropes(front, posts[3:])
    # supports à bougie aux quatre coins, écriteau devant
    for (x, y) in ((1 * T + 3, 1 * T + 2), (12 * T + 3, 1 * T + 2), (1 * T + 3, 7 * T), (12 * T + 3, 7 * T)):
        ob2.paste(img, candle_stand(), x, y, True)
    ob2.paste(img, sign(), 6 * T + 8, 8 * T - 2, True)
    if not lit:
        return img
    # lumière : les bougies (chaudes) et la lune qui tombe sur l'estrade ; le reste dans la pénombre
    a = np.asarray(img).astype(float)
    W, H = img.size
    gx, gy = grid(W, H)
    L = np.full((H, W), 0.38)
    warm = np.zeros((H, W))
    for (x, y) in ((1 * T + 8, 1 * T + 2), (12 * T + 8, 1 * T + 2), (1 * T + 8, 7 * T), (12 * T + 8, 7 * T)):
        d = np.hypot(gx - x, gy - y) / T
        g = np.clip(1 - d / 3.5, 0, 1)
        L = np.maximum(L, 0.38 + g * 0.7)
        warm = np.maximum(warm, g)
    d = np.hypot(gx - 7 * T, (gy - 4.6 * T) / 0.75) / T
    moon = np.clip(1.2 - d / 2.6, 0, 1)
    L = np.maximum(L, 0.38 + moon * 0.75)
    tint = np.ones((H, W, 3))
    tint = tint * (1 - warm[..., None] * 0.25) + np.array((1.25, 1.0, 0.7)) * warm[..., None] * 0.25
    tint = tint * (1 - moon[..., None] * 0.3) + np.array((0.82, 0.92, 1.15)) * moon[..., None] * 0.3
    a = a * L[..., None] * tint
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def main():
    S = 3
    big = up(room(), S)
    parts = [("Tricératops (×3)", up(triceratops().img(), 3)), ("Estrade (×3)", up(estrade().img(), 3)),
             ("Potelet, cordon (×5)", up(post().img(), 5)), ("Support à bougie (×5)", up(candle_stand().img(), 5)), ("Écriteau (×5)", up(sign().img(), 5))]
    pad = 24
    Wb = max(big.width + 2 * pad, sum(max(p.width, 150) for _, p in parts) + pad * (len(parts) + 1))
    ph = max(p.height for _, p in parts)
    Hb = 80 + big.height + 60 + ph + 40
    sheet = Image.new("RGB", (Wb, Hb), (14, 12, 18))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 3 · SALLE SPÉCIALE · LE MUSÉE (v1)", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((Wb // 2, 54), "Dalles claires · squelette de tricératops sur estrade · cordon rouge sur potelets · supports à bougie · écriteau", fill=(190, 180, 160), font=font(14, False), anchor="mm")
    sheet.paste(big, ((Wb - big.width) // 2, 80))
    x, y = pad, 80 + big.height + 50
    for name, im in parts:
        d.text((x, y - 22), name, fill=(240, 192, 80), font=font(15), anchor="lt")
        bg = Image.new("RGB", im.size, (40, 36, 44))
        bg.paste(im, (0, 0), im)
        sheet.paste(bg, (x, y))
        x += max(im.width, 150) + pad
    sheet.save(os.path.join(HERE, "ossuaire_musee_v1.png"))
    print("art/ossuaire_musee_v1.png", sheet.size)


if __name__ == "__main__":
    main()
