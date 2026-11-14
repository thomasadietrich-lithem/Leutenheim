"""Section 2, la CHAMPIGNONNIÈRE : ambiance v2 (Thomas, 2026-11-14, sur la v1 : option C retenue ; « attention aux
filaments, le mur du haut n'est pas un plafond » ; « le design des champignons est assez médiocre » ; « il faut qu'on
soit affecté par la quantité de champignons » ; « rends certaines zones moins accessibles, moins carrées » ; « des murs
effondrés, avec de la terre qui vient se répandre dans la pièce et qui affecte le layout ; on peut voir des racines
lumineuses dans la terre nue » ; trois images d'inspiration : on en reprend les idées, jamais le dessin).

- Base : l'option C de la v1 (roche suintante, pierres brun-violet, terre et flaques).
- Plus de filaments qui « pendent » du mur du haut (vue de dessus) : le mycélium RAMPE au sol depuis le pied des murs.
- Murs EFFONDRÉS : une brèche dans le mur, un éboulis de terre qui déborde dans la salle (infranchissable), puis de la
  terre meuble (on y marche) ; des RACINES LUMINEUSES dans la terre nue ; des pierres tombées.
- Salle moins carrée : coins bouchés, mur qui avance.
- Champignons redessinés, en nombre : grappe de chapeaux pointus verts, gros champignon bleu lumineux à pois, petits
  lumineux semés partout, champignon-étagère au pied des murs, corail violet, amanite.

  python3 art/champi_v2.py   → art/champi_v2.png
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import murs_v3 as M  # noqa: E402
from pix import fbm, font, grid, hash2, outline_mask, up, value_noise  # noqa: E402
from dortoir_v2 import Sprite  # noqa: E402
import champi_v1 as V1  # noqa: E402

T = 16
# « # » mur, « . » sol, « E » éboulis de terre (infranchissable), « e » terre meuble (on y marche).
PLAN = [
    "######EEEE######",
    "#....EEEEEE..###",
    "#.....EEEE....##",
    "#....eeeeee....#",
    "#......ee......#",
    "EE.e...........#",
    "EEe..........###",
    "#.............##",
    "##.............#",
    "###............#",
    "################",
]


def cells(ch):
    return [(x, y) for y, row in enumerate(PLAN) for x, c in enumerate(row) if c == ch]


# ---------------------------------------------------------------- champignons (dessin v2)


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c[:3]) + (255,)


def cap(s, cx, top, w, h, tones, conical=False, spots=None, gills=None, glow_edge=None):
    """Un chapeau : rangées de plus en plus larges ; clair en haut à gauche, sombre en bas et au bord droit."""
    light, mid, dark = tones
    for j in range(h):
        t = (j + 1) / h
        f = t if conical else math.sqrt(max(0.0, 1 - (1 - t) ** 2))
        half = max(0.5, w / 2 * f)
        x0, x1 = int(round(cx - half)), int(round(cx + half))
        for x in range(x0, x1):
            u = (x - x0) / max(1, x1 - x0 - 1)
            c = light if (j < h * 0.45 and u < 0.55) else mid
            if u > 0.78 or j == h - 1:
                c = dark
            if glow_edge and j == h - 1:
                c = glow_edge
            s.p(x, top + j, c)
        if spots:
            for (sx, sy) in spots:
                if sy == j and x0 <= cx + sx < x1:
                    s.p(cx + sx, top + j, (240, 250, 255, 255))
    if gills:
        half = w / 2 - 1
        for x in range(int(round(cx - half)), int(round(cx + half))):
            s.p(x, top + h, gills[0] if x % 2 else gills[1])


def stem(s, x, y0, y1, bend, color, dark, width=2):
    """Pied, de (x, y0) jusqu'à y1, qui s'incurve de `bend` pixels."""
    for y in range(y0, y1 + 1):
        t = (y - y0) / max(1, y1 - y0)
        dx = int(round(bend * math.sin(t * math.pi / 2)))
        for k in range(width):
            s.p(x + dx + k, y, dark if k == width - 1 else color)


G_LIGHT, G_MID, G_DARK = (212, 255, 92, 255), (112, 214, 52, 255), (40, 120, 40, 255)
G_GILL = ((200, 240, 150, 255), (60, 120, 50, 255))
G_STEM, G_STEM_D = (196, 220, 120, 255), (120, 150, 70, 255)
B_LIGHT, B_MID, B_DARK = (170, 246, 255, 255), (70, 200, 240, 255), (24, 110, 170, 255)
B_GILL = ((140, 220, 250, 255), (30, 90, 140, 255))
B_STEM, B_STEM_D = (150, 220, 240, 255), (60, 140, 180, 255)


def green_cluster():
    """Grappe de chapeaux pointus vert acide sur de longs pieds courbes (24 × 30)."""
    s = Sprite(24, 30)
    stem(s, 7, 12, 27, 3, G_STEM, G_STEM_D)
    stem(s, 14, 6, 27, -3, G_STEM, G_STEM_D)
    stem(s, 18, 14, 27, -4, G_STEM, G_STEM_D)
    stem(s, 11, 22, 27, 1, G_STEM, G_STEM_D)
    cap(s, 7, 5, 11, 7, (G_LIGHT, G_MID, G_DARK), conical=True, gills=G_GILL)
    cap(s, 15, 0, 9, 6, (G_LIGHT, G_MID, G_DARK), conical=True, gills=G_GILL)
    cap(s, 19, 8, 8, 6, (G_LIGHT, G_MID, G_DARK), conical=True, gills=G_GILL)
    cap(s, 11, 18, 6, 4, (G_LIGHT, G_MID, G_DARK), conical=True, gills=G_GILL)
    s.r(3, 28, 18, 2, (70, 74, 84, 255)).r(5, 28, 4, 1, (110, 116, 126, 255))
    return s.done()


def blue_giant():
    """Gros champignon bleu lumineux à pois, et deux petits à ses pieds (26 × 28)."""
    s = Sprite(26, 28)
    stem(s, 11, 10, 25, 0, B_STEM, B_STEM_D, width=4)
    s.r(11, 12, 1, 12, (220, 250, 255, 255))
    cap(s, 13, 0, 22, 10, (B_LIGHT, B_MID, B_DARK), spots=[(-6, 3), (-2, 2), (3, 4), (-8, 6), (6, 7), (1, 7), (-4, 5)], gills=B_GILL)
    stem(s, 4, 20, 25, 1, B_STEM, B_STEM_D)
    cap(s, 5, 15, 9, 5, (B_LIGHT, B_MID, B_DARK), spots=[(-2, 2), (1, 1)], gills=B_GILL)
    stem(s, 20, 22, 25, -1, B_STEM, B_STEM_D)
    cap(s, 20, 18, 7, 4, (B_LIGHT, B_MID, B_DARK), spots=[(0, 1)], gills=B_GILL)
    s.r(1, 26, 24, 2, (60, 70, 90, 255))
    return s.done()


def tiny_glow(k=0):
    """Petit champignon lumineux (semé par dizaines) : trois variantes."""
    s = Sprite(8, 8)
    L, Mi, D = [(B_LIGHT, B_MID, B_DARK), (G_LIGHT, G_MID, G_DARK), ((236, 200, 255, 255), (180, 120, 240, 255), (100, 60, 160, 255))][k % 3]
    s.r(3, 0, 2, 1, L).r(2, 1, 4, 1, L).p(5, 1, Mi).r(1, 2, 6, 1, Mi).p(2, 2, L).r(1, 3, 6, 1, D)
    s.r(3, 4, 2, 3, (210, 230, 240, 255)).p(4, 5, (150, 170, 186, 255)).p(4, 6, (150, 170, 186, 255))
    return s.done()


def shelf():
    """Champignon-étagère : trois lames ocre qui sortent du pied d'un mur (16 × 9)."""
    s = Sprite(16, 9)
    O, Od, Ol = (214, 150, 70, 255), (150, 92, 40, 255), (246, 200, 120, 255)
    for x, y, w in ((0, 0, 8), (5, 3, 9), (2, 6, 7)):
        s.r(x, y, w, 2, O).r(x, y, w, 1, Ol).r(x + w - 1, y, 1, 2, Od).r(x, y + 2, w - 1, 1, Od)
    return s.done()


def coral():
    """Corail violet (champignon en branches) : 12 × 14."""
    s = Sprite(12, 14)
    P, Pd, Pl = (150, 80, 210, 255), (90, 40, 140, 255), (200, 150, 250, 255)
    for x0, ln, lean in ((1, 8, -1), (4, 12, 0), (7, 10, 1), (9, 6, 1)):
        for k in range(ln):
            x = x0 + (lean * k) // 4
            s.p(x, 13 - k, Pl if k >= ln - 2 else P).p(x + 1, 13 - k, Pd if k < ln - 2 else P)
            if k % 4 == 3:
                s.p(x + (2 if lean >= 0 else -1), 13 - k - 1, Pl)
    return s.done()


def amanita():
    """Amanite rouge à pois blancs, chapeau en dôme (14 × 15)."""
    s = Sprite(14, 15)
    stem(s, 6, 7, 13, 0, (236, 228, 210, 255), (170, 160, 140, 255), width=3)
    s.r(5, 10, 5, 1, (250, 246, 236, 255))  # l'anneau
    cap(s, 7, 0, 14, 7, ((240, 80, 64, 255), (196, 44, 40, 255), (120, 20, 28, 255)), spots=[(-4, 2), (0, 1), (3, 3), (-2, 4), (4, 5)])
    s.r(3, 14, 8, 1, (90, 70, 60, 255))
    return s.done()


def glow_root_strip():
    """Racine lumineuse dans la terre nue (échantillon 24 × 10)."""
    s = Sprite(24, 10)
    s.r(0, 0, 24, 10, (58, 44, 46, 255))
    pts = [(0, 6), (4, 5), (8, 6), (12, 4), (16, 5), (20, 3), (23, 4)]
    for (a, b), (c, d) in zip(pts, pts[1:]):
        for k in range(c - a + 1):
            y = b + (d - b) * k // max(1, c - a)
            s.p(a + k, y, (120, 255, 220, 255))
            s.p(a + k, y + 1, (40, 120, 110, 255))
    s.p(8, 7, (120, 255, 220, 255)).p(9, 8, (120, 255, 220, 255)).p(16, 6, (120, 255, 220, 255)).p(17, 7, (80, 200, 180, 255))
    return s.done(outline=False)


# ---------------------------------------------------------------- la salle


EARTH_TOP, EARTH_MID, EARTH_DK = np.array((168, 126, 98)), np.array((122, 90, 74)), np.array((74, 54, 50))
ROOT_GLOW, ROOT_HALO = np.array((110, 240, 210)), np.array((70, 120, 110))


def earth_field(W, H):
    """Hauteur de la terre en chaque pixel : taches rondes sur les cases « E » (éboulis) et « e » (meuble), bruit."""
    xs, ys = grid(W, H)
    h = np.zeros((H, W))
    for ch, wgt, rad in (("E", 1.0, 1.15), ("e", 0.45, 0.9)):
        for (cx, cy) in cells(ch):
            d = np.hypot(xs - (cx + 0.5) * T, ys - (cy + 0.5) * T) / T
            h = np.maximum(h, wgt * np.clip(1.25 - d / rad, 0, 1))
    h = h + 0.22 * (fbm(xs, ys, 10, 401, 3) - 0.5)
    return h


def room():
    V1.WALLS["C"]()
    floor_plan = [row.replace("E", ".").replace("e", ".") for row in PLAN]
    walls = M.Walls(floor_plan)
    img = M.render(floor_plan, moss=False)
    W, H = img.size
    px = img.load()
    xs, ys = grid(W, H)
    floor = V1.floor_C(xs, ys)
    for Y in range(H):
        for X in range(W):
            if walls.floor(X // T, Y // T):
                px[X, Y] = tuple(int(v) for v in floor[Y, X])
    # Mycélium qui RAMPE au sol depuis le pied des murs (plus de filaments qui pendent).
    a = np.asarray(img).astype(float)
    wallmask = np.zeros((H, W), bool)
    for y, row in enumerate(floor_plan):
        for x, c in enumerate(row):
            if c == "#":
                wallmask[y * T:(y + 1) * T, x * T:(x + 1) * T] = True
    dist = np.full((H, W), 99.0)
    edge = outline_mask(wallmask)
    ey, ex = np.nonzero(edge)
    for k in range(0, len(ex), 3):
        dist = np.minimum(dist, np.hypot(xs - ex[k], ys - ey[k]))
    myc = (~wallmask) & (dist < 9 + 10 * fbm(xs, ys, 18, 311, 2)) & (fbm(xs, ys, 20, 312, 2) > 0.52)
    vein = myc & ((hash2(xs.astype(int), ys.astype(int), 313) > 0.93) | (((xs + ys * 2).astype(int) % 11) == 0))
    a[vein] = a[vein] * 0.45 + np.array((200, 206, 214)) * 0.55
    # Terre : éboulis (haut, infranchissable) et terre meuble ; racines lumineuses ; pierres tombées.
    h = earth_field(W, H)
    loose = (h > 0.18) & ~wallmask
    speck = loose & (h < 0.5) & (hash2(xs.astype(int), ys.astype(int), 321) < (h - 0.1) * 1.4)
    a[speck] = EARTH_MID
    mound = h >= 0.5
    t = np.clip((h - 0.5) / 0.6, 0, 1)
    col = EARTH_DK + (EARTH_MID - EARTH_DK) * np.clip(t * 2, 0, 1)[..., None]
    col = col + (EARTH_TOP - EARTH_MID) * np.clip(t * 2 - 1, 0, 1)[..., None]
    lit = fbm(xs, ys, 4, 331, 2) > 0.58
    col[lit] = col[lit] * 1.12
    a[mound] = col[mound]
    rim = outline_mask(mound) & ~wallmask
    a[rim] = a[rim] * 0.55
    # Racines lumineuses : des lignes sinueuses (crêtes d'un bruit) dans la terre nue.
    n = fbm(xs, ys, 14, 341, 3)
    roots = mound & (np.abs(n - 0.5) < 0.011) & (t > 0.3)
    a[roots] = ROOT_GLOW
    halo = outline_mask(roots) & mound
    a[halo] = a[halo] * 0.4 + ROOT_HALO * 0.6
    # Pierres tombées du mur sur l'éboulis.
    for (cx, cy, w, hh) in ((7, 1, 5, 3), (9, 2, 4, 2), (6, 0, 6, 3), (0, 5, 5, 3), (1, 6, 3, 2), (10, 3, 3, 2)):
        X0, Y0 = cx * T + int(hash2(np.array(cx), np.array(cy), 351) * 8), cy * T + int(hash2(np.array(cy), np.array(cx), 352) * 8)
        a[Y0:Y0 + hh, X0:X0 + w] = (98, 84, 94)
        a[Y0, X0:X0 + w] = (132, 118, 128)
        a[Y0 + hh - 1, X0:X0 + w] = (60, 50, 58)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")
    # Champignons, en nombre.
    lights = []

    def put(sp, x, y, glow=None):
        im = sp.img()
        img.paste(im, (int(x), int(y)), im)
        if glow:
            lights.append((x + im.width / 2, y + im.height * 0.4, glow))

    put(blue_giant(), 11 * T - 2, 5 * T - 6, ("b", 5.5))
    put(green_cluster(), 2 * T - 4, 1 * T - 4, ("g", 4.5))
    put(green_cluster(), 12 * T + 4, 7 * T - 10, ("g", 4.0))
    put(amanita(), 5 * T + 1, 8 * T - 2)
    put(coral(), 13 * T + 2, 2 * T - 2, ("p", 2.0))
    put(shelf(), 1 * T, 3 * T + 2)
    put(shelf(), 14 * T - 14, 4 * T + 4)
    put(shelf(), 9 * T, 9 * T + 6)
    rng = np.random.default_rng(7)
    spots = 0
    while spots < 26:
        x, y = rng.uniform(1, 15) * T, rng.uniform(1, 10) * T
        cx, cy = int(x // T), int(y // T)
        if PLAN[cy][cx] == "#" or (PLAN[cy][cx] == "." and rng.random() < 0.55):
            continue
        k = int(rng.integers(0, 3))
        put(tiny_glow(k), x, y, ("bgp"[k], 1.2))
        spots += 1
    # Lumière : la salle dans le noir ; chaque champignon lumineux éclaire autour de lui, à sa couleur ; les racines aussi.
    a = np.asarray(img).astype(float)
    light = np.full((H, W), 0.42)
    tintmap = np.zeros((H, W, 3))
    hue = {"b": np.array((40, 150, 200)), "g": np.array((90, 170, 40)), "p": np.array((130, 70, 180))}
    for (lx, ly, (k, r)) in lights:
        d = np.hypot(xs - lx, ys - ly) / T
        f = np.clip(1 - d / r, 0, 1)
        light = np.maximum(light, 0.42 + 0.6 * f)
        tintmap += hue[k][None, None, :] * (f ** 2)[..., None] * 0.35
    rd = np.zeros((H, W))
    ry, rx = np.nonzero(roots)
    for k in range(0, len(rx), 4):
        rd = np.maximum(rd, np.clip(1 - np.hypot(xs - rx[k], ys - ry[k]) / 14, 0, 1))
    tintmap += np.array((30, 110, 96))[None, None, :] * (rd ** 2)[..., None] * 0.6
    a = a * light[..., None] * np.array((0.82, 0.92, 1.0)) + tintmap
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def main():
    S = 4
    r = up(room(), S)
    pad = 24
    decors = [
        ("Grappe verte", green_cluster()), ("Géant bleu", blue_giant()), ("Petits lumineux", None),
        ("Étagère", shelf()), ("Corail", coral()), ("Amanite", amanita()), ("Racine lumineuse", glow_root_strip()),
    ]
    dw = 150
    Wb = max(r.width + 2 * pad, pad + len(decors) * dw)
    Hb = 80 + r.height + 40 + 250
    sheet = Image.new("RGB", (Wb, Hb), (22, 18, 14))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 2 · LA CHAMPIGNONNIÈRE · ambiance v2 (option C)", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((Wb // 2, 52), "Murs effondrés (haut, gauche) : éboulis infranchissable, terre meuble, racines lumineuses ; coins bouchés",
           fill=(190, 180, 160), font=font(13, False), anchor="mm")
    sheet.paste(r, ((Wb - r.width) // 2, 72))
    y0 = 72 + r.height + 24
    d.text((pad, y0), "Champignons v2 (agrandis ×5)", fill=(240, 192, 80), font=font(18), anchor="lt")
    for i, (name, sp) in enumerate(decors):
        bg = Image.new("RGB", (dw - 10, 170), (20, 18, 30))
        if sp is None:
            for k in range(3):
                im = up(tiny_glow(k).img(), 5)
                bg.paste(im, (6 + k * 44, bg.height - im.height - 8), im)
        else:
            im = up(sp.img(), 5)
            if im.width > bg.width - 4:
                im = up(sp.img(), 4)
            bg.paste(im, ((bg.width - im.width) // 2, bg.height - im.height - 6), im)
        x = pad + i * dw
        sheet.paste(bg, (x, y0 + 30))
        d.text((x, y0 + 206), name, fill=(220, 210, 190), font=font(13, False), anchor="lt")
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "champi_v2.png")
    sheet.save(out)
    print("art/champi_v2.png", sheet.size)


if __name__ == "__main__":
    main()
