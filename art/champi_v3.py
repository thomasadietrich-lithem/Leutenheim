"""Section 2, la CHAMPIGNONNIÈRE : ambiance v3 (Thomas, 2026-11-14, sur la v2 : « il faut de la vie sur les murs :
des champignons circulaires, de la bioluminescence comme la v1 » ; « pas de socle : on doit comprendre qu'ils occupent
une dalle » ; « retire les amanites et les étagères » ; « petits lumineux en groupes réfléchis » ; « on ne comprend pas
les nuages de terre : continue à creuser »). Ci-dessous, la note de la v2.

Ambiance v2 (Thomas, 2026-11-14, sur la v1 : option C retenue ; « attention aux
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

  python3 art/champi_v3.py   → art/champi_v3.png
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


P_LIGHT, P_MID, P_DARK = (236, 200, 255, 255), (180, 120, 240, 255), (100, 60, 160, 255)
TONES = {"b": (B_LIGHT, B_MID, B_DARK), "g": (G_LIGHT, G_MID, G_DARK), "p": (P_LIGHT, P_MID, P_DARK)}
STEMS = {"b": (B_STEM, B_STEM_D), "g": (G_STEM, G_STEM_D), "p": ((226, 210, 240, 255), (150, 120, 180, 255))}


# Tous les champignons tiennent sur UNE dalle (16 de large) et n'ont pas de socle : le bas des pieds touche le bas de la
# case ; ce qui est haut déborde sur la case du dessus (comme les meubles).
def green_cluster():
    """Grappe de chapeaux pointus vert acide, pieds longs et courbes (16 × 26)."""
    s = Sprite(16, 26)
    stem(s, 4, 10, 25, 1, G_STEM, G_STEM_D)
    stem(s, 9, 5, 25, -1, G_STEM, G_STEM_D)
    stem(s, 12, 13, 25, -2, G_STEM, G_STEM_D)
    stem(s, 7, 20, 25, 0, G_STEM, G_STEM_D)
    cap(s, 4, 4, 8, 6, TONES["g"], conical=True, gills=G_GILL)
    cap(s, 10, 0, 7, 5, TONES["g"], conical=True, gills=G_GILL)
    cap(s, 13, 8, 6, 5, TONES["g"], conical=True, gills=G_GILL)
    cap(s, 7, 16, 5, 4, TONES["g"], conical=True, gills=G_GILL)
    return s.done()


def blue_giant():
    """Gros champignon bleu lumineux à pois (16 × 22)."""
    s = Sprite(16, 22)
    stem(s, 6, 8, 21, 0, B_STEM, B_STEM_D, width=4)
    s.r(6, 10, 1, 10, (220, 250, 255, 255))
    cap(s, 8, 0, 16, 8, TONES["b"], spots=[(-5, 3), (-1, 2), (3, 4), (-6, 5), (5, 6), (0, 6), (-3, 4)], gills=B_GILL)
    cap(s, 2, 15, 5, 3, TONES["b"])
    stem(s, 2, 18, 21, 0, B_STEM, B_STEM_D)
    return s.done()


def tiny(s, x, y, k, size=1, h=2):
    """Un petit champignon : chapeau en dôme (6 ou 4 de large), pied de `h` pixels ; (x, y) = bas du pied."""
    L, Mi, D = TONES[k]
    st, sd = STEMS[k]
    top = y - h
    if size == 1:
        s.r(x - 1, top - 4, 2, 1, L).r(x - 2, top - 3, 4, 1, L).p(x + 1, top - 3, Mi).r(x - 3, top - 2, 6, 1, Mi).p(x - 2, top - 2, L).r(x - 3, top - 1, 6, 1, D)
        s.r(x - 1, top, 2, h, st).r(x, top, 1, h, sd)
    else:
        s.p(x, top - 3, L).r(x - 1, top - 2, 3, 1, Mi).p(x - 1, top - 2, L).r(x - 2, top - 1, 4, 1, D)
        s.r(x, top, 1, h, st)


def group(kind, k):
    """Groupes de petits lumineux sur une dalle (16 × 14) : en escalier, en rond de sorcière, en touffe serrée."""
    s = Sprite(16, 18)
    # Dessinés du fond vers l'avant : chacun garde son contour, on les compte d'un coup d'œil.
    spots = {
        "escalier": ((13, 13, 1, 7), (8, 15, 1, 4), (3, 17, 2, 1)),
        "rond": ((5, 11, 2, 1), (11, 11, 2, 1), (2, 14, 2, 1), (14, 14, 2, 1), (8, 17, 2, 1)),
        "touffe": ((10, 14, 1, 8), (5, 16, 1, 3), (13, 17, 2, 1)),
    }[kind]
    for (x, y, z, h) in spots:
        one = Sprite(16, 18)
        tiny(one, x, y, k, z, h)
        one.done()
        on = one.a[..., 3] > 0
        s.a[on] = one.a[on]
    return s


def coral():
    """Corail violet (champignon en branches), sur une dalle (14 × 14)."""
    s = Sprite(14, 14)
    P, Pd, Pl = (150, 80, 210, 255), (90, 40, 140, 255), (210, 160, 255, 255)
    for x0, ln, lean in ((2, 8, -1), (5, 12, 0), (8, 10, 1), (11, 6, 1)):
        for k in range(ln):
            x = x0 + (lean * k) // 4
            s.p(x, 13 - k, Pl if k >= ln - 2 else P).p(x + 1, 13 - k, Pd if k < ln - 2 else P)
            if k % 4 == 3:
                s.p(x + (2 if lean >= 0 else -1), 13 - k - 1, Pl)
    return s.done()


def wall_disc(r=3, k="o"):
    """Champignon CIRCULAIRE collé sur une pierre du mur, vu de dessus : un disque à cernes ; lumineux ou ocre."""
    pal = {"o": ((236, 196, 130), (196, 140, 80), (120, 80, 44)), "b": ((190, 255, 240), (90, 220, 200), (30, 120, 120))}[k]
    n = 2 * r + 1
    s = Sprite(n, n)
    for y in range(n):
        for x in range(n):
            d = math.hypot(x - r, y - r)
            if d <= r + 0.3:
                c = pal[0] if d < r * 0.35 else pal[1] if (d < r * 0.7 or int(d * 2) % 2 == 0) else pal[2]
                if x < r and y < r and d > r * 0.6:
                    c = pal[0]
                s.p(x, y, c + (255,))
    return s.done()


def glow_root_strip():
    """Racine lumineuse dans la terre (échantillon 24 × 10)."""
    s = Sprite(24, 10)
    s.r(0, 0, 24, 10, (122, 90, 74, 255))
    pts = [(0, 6), (4, 5), (8, 6), (12, 4), (16, 5), (20, 3), (23, 4)]
    for (a, b), (c, d) in zip(pts, pts[1:]):
        for k in range(c - a + 1):
            y = b + (d - b) * k // max(1, c - a)
            s.p(a + k, y, (120, 255, 220, 255)).p(a + k, y + 1, (60, 120, 104, 255))
    return s.done(outline=False)


# ---------------------------------------------------------------- la salle

E_TOP, E_MID, E_DK, E_FACE, E_RIM = (np.array(c) for c in ((168, 128, 100), (130, 96, 78), (96, 70, 60), (62, 44, 42), (30, 22, 24)))


def earth_mound(a, xs, ys, wallmask):
    """L'ÉBOULIS : un tas de terre qui vient de la brèche. Bord net et sombre, flanc avant plus sombre (il a du relief),
    dessus clair, mottes, pierres du mur tombées, racines lumineuses dans les creux."""
    from scipy import ndimage
    H, W = a.shape[:2]
    m = np.zeros((H, W), bool)
    for (cx, cy) in cells("E"):
        m[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T] = True
    # Contour arrondi et irrégulier : on lisse le carré des cases, et un bruit grignote le bord.
    soft = ndimage.gaussian_filter(m.astype(float), 5) + 0.25 * (fbm(xs, ys, 7, 501, 2) - 0.5)
    mound = soft > 0.5
    inner = ndimage.distance_transform_edt(mound)
    # Relief : plus haut au cœur ; le dessus est éclairé d'en haut à gauche.
    hgt = np.clip(inner / 10, 0, 1)
    col = E_DK + (E_MID - E_DK) * np.clip(hgt * 2, 0, 1)[..., None] + (E_TOP - E_MID) * np.clip(hgt * 2 - 1, 0, 1)[..., None]
    slope = np.zeros((H, W))
    slope[1:, 1:] = hgt[1:, 1:] - hgt[:-1, :-1]
    col = col * (1 + 0.6 * np.clip(slope * 8, -0.3, 0.3))[..., None]
    # Mottes : petites taches plus claires et plus sombres.
    clod = hash2((xs // 2).astype(int), (ys // 2).astype(int), 511)
    col[clod > 0.9] *= 1.15
    col[clod < 0.08] *= 0.8
    a[mound] = col[mound]
    # Flanc avant (le bas du tas) : 4 pixels plus sombres sous le bord, il « tient debout ».
    face = np.zeros((H, W), bool)
    for k in range(1, 5):
        face[k:, :] |= mound[:-k, :]
    face &= ~mound & ~wallmask
    a[face] = E_FACE * (0.9 + 0.2 * hash2(xs.astype(int), ys.astype(int), 512)[face][..., None])
    rim = outline_mask(mound | face) & ~wallmask
    a[rim] = E_RIM
    # Pierres du mur tombées sur le tas (des briques, comme le mur).
    rng = np.random.default_rng(3)
    ys_m, xs_m = np.nonzero(mound & (inner > 3))
    for _ in range(9):
        i = rng.integers(0, len(xs_m))
        X0, Y0, w, h = xs_m[i], ys_m[i], int(rng.integers(4, 7)), int(rng.integers(2, 4))
        a[Y0:Y0 + h, X0:X0 + w] = (124, 108, 118)
        a[Y0, X0:X0 + w] = (168, 152, 160)
        a[Y0 + h - 1, X0:X0 + w] = (84, 70, 80)
        a[Y0 + h:Y0 + h + 1, X0:X0 + w] = E_RIM
    # Racines lumineuses : elles sortent de la brèche (en haut) et plongent dans la terre, en se ramifiant.
    roots = np.zeros((H, W), bool)
    for (cx, cy) in cells("E"):
        if rng.random() < 0.55:
            x, y = (cx + rng.random()) * T, cy * T + 2.0
            ang = math.pi / 2 + rng.uniform(-0.6, 0.6)
            for _ in range(int(rng.integers(14, 30))):
                xi, yi = int(x), int(y)
                if 0 <= xi < W and 0 <= yi < H and mound[yi, xi] and inner[yi, xi] > 2:
                    roots[yi, xi] = True
                ang += rng.uniform(-0.45, 0.45)
                x += math.cos(ang)
                y += math.sin(ang) * 0.9
    a[roots] = (120, 255, 220)
    halo = outline_mask(roots) & mound
    a[halo] = a[halo] * 0.45 + np.array((60, 150, 136)) * 0.55
    return mound, roots


def loose_earth(a, xs, ys, wallmask, mound):
    """TERRE MEUBLE (on y marche) : des mottes et des cailloux bien séparés sur le sol, pas un nuage."""
    H, W = a.shape[:2]
    rng = np.random.default_rng(11)
    for (cx, cy) in cells("e"):
        for _ in range(int(rng.integers(4, 8))):
            X, Y = int((cx + rng.random()) * T), int((cy + rng.random()) * T)
            w, h = int(rng.integers(2, 4)), int(rng.integers(1, 3))
            if wallmask[Y:Y + h + 1, X:X + w].any() or mound[Y:Y + h + 1, X:X + w].any():
                continue
            pebble = rng.random() < 0.3
            a[Y:Y + h, X:X + w] = (100, 88, 96) if pebble else E_MID
            a[Y, X:X + w] = (140, 126, 136) if pebble else E_TOP
            a[Y + h, X:X + w] = E_RIM


def wall_life(a, xs, ys, wallmask, floor_plan):
    """Vie sur les murs : points bioluminescents dans les joints (comme la v1), champignons circulaires collés aux
    pierres près de la salle."""
    H, W = a.shape[:2]
    near = np.zeros((H, W), bool)
    from scipy import ndimage
    near = wallmask & (ndimage.distance_transform_edt(wallmask) < 9)
    mortar = np.all(np.abs(a - np.array(M.COL["mortar"])) < 2, axis=-1)
    dots = near & mortar & (hash2(xs.astype(int), ys.astype(int), 601) < 0.06)
    a[dots] = (120, 255, 214)
    glow = outline_mask(dots) & wallmask & ~mortar
    a[glow] = a[glow] * 0.6 + np.array((50, 140, 120)) * 0.4
    return dots


# Retouches ajoutées par les versions suivantes (champi_v4 : murs abîmés, brèche éventrée).
PRE_HOOK = None
HOOK = None


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
    a = np.asarray(img).astype(float)
    wallmask = np.zeros((H, W), bool)
    for y, row in enumerate(floor_plan):
        for x, c in enumerate(row):
            if c == "#":
                wallmask[y * T:(y + 1) * T, x * T:(x + 1) * T] = True
    # Mycélium qui rampe au sol depuis le pied des murs.
    from scipy import ndimage
    dist = ndimage.distance_transform_edt(~wallmask)
    myc = (~wallmask) & (dist < 7 + 9 * fbm(xs, ys, 18, 311, 2)) & (fbm(xs, ys, 20, 312, 2) > 0.52)
    vein = myc & ((hash2(xs.astype(int), ys.astype(int), 313) > 0.93) | (((xs + ys * 2).astype(int) % 11) == 0))
    a[vein] = a[vein] * 0.45 + np.array((200, 206, 214)) * 0.55
    dots = wall_life(a, xs, ys, wallmask, floor_plan)
    if PRE_HOOK:
        PRE_HOOK(a, xs, ys, wallmask)
    mound, roots = earth_mound(a, xs, ys, wallmask)
    loose_earth(a, xs, ys, wallmask, mound)
    if HOOK:
        HOOK(a, xs, ys, wallmask, mound)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")
    lights = []

    def put(sp, cx, cy, glow=None, dx=0):
        """Posé sur la dalle (cx, cy) : le bas du dessin sur le bas de la case, centré."""
        im = sp.img()
        x = cx * T + (T - im.width) // 2 + dx
        y = (cy + 1) * T - im.height
        img.paste(im, (x, y), im)
        if glow:
            lights.append((x + im.width / 2, y + im.height * 0.45, glow))

    def put_px(sp, x, y, glow=None):
        im = sp.img()
        img.paste(im, (x, y), im)
        if glow:
            lights.append((x + im.width / 2, y + im.height / 2, glow))

    # Champignons circulaires sur les pierres du mur, près de la salle (quelques-uns lumineux).
    for (x, y, r, k) in ((3 * T + 2, 0 * T + 9, 3, "o"), (4 * T + 6, 0 * T + 4, 2, "o"), (12 * T + 4, 1 * T + 6, 3, "b"),
                         (14 * T + 4, 3 * T + 2, 2, "o"), (15 * T + 3, 6 * T + 4, 3, "b"), (15 * T + 2, 7 * T + 9, 2, "o"),
                         (1 * T + 2, 9 * T + 3, 3, "o"), (2 * T + 5, 9 * T + 6, 2, "b"), (10 * T + 3, 10 * T + 4, 3, "o"),
                         (6 * T + 2, 10 * T + 5, 2, "b"), (0 * T + 6, 3 * T + 4, 3, "b")):
        put_px(wall_disc(r, k), x - r, y - r, ("b", 1.6) if k == "b" else None)
    put(blue_giant(), 11, 4, ("b", 5.5))
    put(green_cluster(), 2, 1, ("g", 4.5))
    put(green_cluster(), 13, 7, ("g", 4.0))
    put(coral(), 12, 1, ("p", 2.2))
    for (cx, cy, kind, k) in ((5, 3, "escalier", "b"), (10, 3, "rond", "g"), (3, 4, "touffe", "p"), (7, 8, "rond", "b"),
                              (12, 9, "touffe", "g"), (2, 7, "escalier", "b"), (9, 6, "touffe", "p"), (13, 4, "escalier", "p")):
        put(group(kind, k), cx, cy, (k, 2.4))
    # Lumière.
    a = np.asarray(img).astype(float)
    light = np.full((H, W), 0.42)
    tint = np.zeros((H, W, 3))
    hue = {"b": np.array((40, 150, 200)), "g": np.array((90, 170, 40)), "p": np.array((130, 70, 180))}
    for (lx, ly, (k, r)) in lights:
        f = np.clip(1 - np.hypot(xs - lx, ys - ly) / T / r, 0, 1)
        light = np.maximum(light, 0.42 + 0.6 * f)
        tint += hue[k][None, None, :] * (f ** 2)[..., None] * 0.35
    for mask, col, rad, amt in ((roots, (30, 110, 96), 12, 0.6), (dots, (30, 110, 96), 7, 0.35)):
        ys_, xs_ = np.nonzero(mask)
        rd = np.zeros((H, W))
        for k in range(0, len(xs_), 3):
            rd = np.maximum(rd, np.clip(1 - np.hypot(xs - xs_[k], ys - ys_[k]) / rad, 0, 1))
        tint += np.array(col)[None, None, :] * (rd ** 2)[..., None] * amt
        light = np.maximum(light, 0.42 + 0.25 * rd)
    a = a * light[..., None] * np.array((0.82, 0.92, 1.0)) + tint
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def main():
    S = 4
    r = up(room(), S)
    pad = 24
    decors = [
        ("Grappe verte", green_cluster()), ("Géant bleu", blue_giant()), ("Corail", coral()),
        ("Groupe en escalier", group("escalier", "b")), ("Rond de sorcière", group("rond", "g")), ("Touffe", group("touffe", "p")),
        ("Disques du mur", None), ("Racine lumineuse", glow_root_strip()),
    ]
    dw = 132
    Wb = max(r.width + 2 * pad, pad + len(decors) * dw)
    Hb = 80 + r.height + 40 + 250
    sheet = Image.new("RGB", (Wb, Hb), (22, 18, 14))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 2 · LA CHAMPIGNONNIÈRE · ambiance v3 (option C)", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((Wb // 2, 52), "Éboulis en relief (infranchissable) · terre meuble en mottes · vie sur les murs · un champignon = une dalle",
           fill=(190, 180, 160), font=font(13, False), anchor="mm")
    sheet.paste(r, ((Wb - r.width) // 2, 72))
    y0 = 72 + r.height + 24
    d.text((pad, y0), "Champignons v3 (agrandis ×6, sur une dalle de 16 × 16)", fill=(240, 192, 80), font=font(18), anchor="lt")
    for i, (name, sp) in enumerate(decors):
        bg = Image.new("RGB", (dw - 10, 180), (20, 18, 30))
        dd = ImageDraw.Draw(bg)
        if sp is None:
            for k, (rr, kk) in enumerate(((3, "o"), (2, "o"), (3, "b"))):
                im = up(wall_disc(rr, kk).img(), 6)
                bg.paste(im, (6 + k * 40, 60 + (k % 2) * 30), im)
        else:
            im = up(sp.img(), 6 if sp.img().width <= 16 else 4)
            # La dalle : un carré de 16 × 16 en pointillé, pour voir que le champignon tient dessus.
            tx, ty = (bg.width - 96) // 2, bg.height - 96 - 6
            if name != "Racine lumineuse":
                for k in range(0, 96, 6):
                    for (a1, b1) in ((tx + k, ty), (tx + k, ty + 95), (tx, ty + k), (tx + 95, ty + k)):
                        dd.point((a1, b1), fill=(90, 84, 110))
            bg.paste(im, ((bg.width - im.width) // 2, bg.height - im.height - 6), im)
        x = pad + i * dw
        sheet.paste(bg, (x, y0 + 30))
        d.text((x, y0 + 216), name, fill=(220, 210, 190), font=font(12, False), anchor="lt")
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "champi_v3.png")
    sheet.save(out)
    print("art/champi_v3.png", sheet.size)


if __name__ == "__main__":
    main()
