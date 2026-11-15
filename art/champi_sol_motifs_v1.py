"""Section 2 : ce qui remplace les dalles gravées au sol (Thomas, 2026-11-15 : « retire les designs gravure au sol,
propose une alternative »). Des marques NATURELLES de la champignonnière, posées sur le sol B (pavés ronds), sans pierre
taillée. Six pistes, à choisir :
  A. Rond de sorcière : un cercle de tout petits champignons pâles (2 × 2 cases).
  B. Tapis de mycélium : une étoile de filaments blancs qui rampe entre les pavés (2 × 2).
  C. Pavés soulevés : des racines ont soulevé et fendu quelques pavés, une lueur dans la fente (1 case).
  D. Poussière de spores : une tache dorée de spores tombées, en dégradé (1 à 2 cases).
  E. Regard d'écoulement : une grille ronde de fonte, rouillée, de la mousse tout autour (1 case).
  F. Flaque de suintement : une eau sombre et irisée entre les pavés, sans bord taillé (1 à 2 cases).
  python3 art/champi_sol_motifs_v1.py → art/champi_sol_motifs_v1.png
"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from pix import hash2, fbm, grid, to_img
from planche import planche
from champi_sols_v1 import floor_cobbles

T = 16


def base(w, h, ox=0, oy=0):
    xs, ys = grid(w * T, h * T)
    return floor_cobbles(xs + ox, ys + oy)


def witch_ring(a, cx, cy, r):
    for k in range(18):
        t = k / 18 * 2 * math.pi + hash2(k, 1, 5) * 0.2
        x = int(round(cx + math.cos(t) * r))
        y = int(round(cy + math.sin(t) * r * 0.8))
        # Un minuscule champignon : chapeau 3 px, pied 1 px, son ombre.
        a[y + 1, x - 1:x + 2] = (20, 16, 20)
        a[y, x] = (230, 222, 200)
        a[y - 1, x - 1:x + 2] = (226, 210, 176) if k % 3 else (200, 170, 130)
        a[y - 2, x] = (246, 236, 214)
    # L'herbe brûlée au milieu du cercle : les pavés pâlissent.
    h, w = a.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    inside = ((xs - cx) / (r - 2)) ** 2 + ((ys - cy) / ((r - 2) * 0.8)) ** 2 < 1
    a[inside] = a[inside] * 0.75 + np.array((110, 104, 96)) * 0.25


def myc_mat(a, cx, cy):
    h, w = a.shape[:2]
    for k in range(9):
        ang = k / 9 * 2 * math.pi + hash2(k, 2, 7)
        L = 9 + 6 * hash2(k, 3, 7)
        for t in np.linspace(0, L, 40):
            x = cx + math.cos(ang) * t + math.sin(t * 0.7 + k) * 1.2
            y = cy + math.sin(ang) * t * 0.85 + math.cos(t * 0.6 + k) * 1.0
            xi, yi = int(round(x)), int(round(y))
            if 0 <= xi < w and 0 <= yi < h:
                a[yi, xi] = (226, 232, 226) if t < L * 0.6 else (170, 182, 182)
    a[cy - 1:cy + 2, cx - 1:cx + 2] = (240, 244, 238)
    a[cy, cx] = (140, 250, 220)


def heaved(a):
    # Fente en zigzag au milieu, pavés soulevés (plus clairs d'un côté, ombre de l'autre), racine et lueur.
    pts = [(2, 9), (5, 7), (8, 8), (11, 6), (14, 7)]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        for t in np.linspace(0, 1, 12):
            x, y = int(round(x0 + (x1 - x0) * t)), int(round(y0 + (y1 - y0) * t))
            a[y, x] = (12, 10, 14)
            a[y - 1, x] = a[y - 1, x] * 1.3
            a[y + 1, x] = a[y + 1, x] * 0.6
    for x, y in ((6, 7), (10, 7)):
        a[y, x] = (120, 250, 214)
    for t in range(5):
        a[8 + t // 2, 8 + t] = (120, 84, 56)


def spore_dust(a, cx, cy, rx, ry):
    h, w = a.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    d = ((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2 + (fbm(xs.astype(float), ys.astype(float), 4, 33, 2) - 0.5) * 0.8
    m = d < 1
    k = np.clip(1 - d, 0, 1)[..., None] * 0.55
    a[m] = (a * (1 - k) + np.array((214, 182, 92)) * k)[m]
    sp = m & (hash2(xs, ys, 34) > 0.9)
    a[sp] = (250, 228, 140)


def grate(a):
    h, w = a.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    d = np.hypot((xs - 7.5) / 6.0, (ys - 7.5) / 5.2)
    a[(d < 1.35) & (d >= 1) & (hash2(xs, ys, 41) > 0.35)] = (40, 110, 96)
    ring = (d < 1) & (d > 0.78)
    a[ring] = (88, 70, 60)
    a[ring & (ys < 7)] = (128, 100, 84)
    inner = d <= 0.78
    a[inner] = (14, 12, 16)
    bars = inner & (xs % 3 == 1)
    a[bars] = (104, 70, 52)
    a[inner & (ys == 7)] = (104, 70, 52)


def seep(a, cx, cy, rx, ry):
    h, w = a.shape[:2]
    ys, xs = np.mgrid[0:h, 0:w]
    d = ((xs - cx) / rx) ** 2 + ((ys - cy) / ry) ** 2 + (fbm(xs.astype(float), ys.astype(float), 5, 51, 2) - 0.5) * 0.7
    m = d < 1
    a[m] = (18, 26, 32)
    hi = m & (np.sin(xs * 0.9 + ys * 0.5) > 0.85)
    a[hi] = (70, 110, 120)
    irid = m & (hash2(xs, ys, 52) > 0.95)
    a[irid] = (150, 120, 200)
    edge = (d >= 1) & (d < 1.35)
    a[edge] = a[edge] * 0.7


if __name__ == "__main__":
    W, H = 12, 4
    room = base(W, H)
    # Les six pistes sur la même allée (chacune à sa place).
    sub = room[8:40, 4:36]; witch_ring(sub, 16, 16, 11)
    sub = room[8:40, 40:72]; myc_mat(sub, 16, 16)
    sub = room[16:32, 80:96]; heaved(sub)
    sub = room[8:40, 104:136]; spore_dust(sub, 16, 16, 13, 9)
    sub = room[16:32, 144:160]; grate(sub)
    sub = room[10:38, 164:190]; seep(sub, 13, 14, 11, 8)
    big = to_img(room).convert("RGBA")
    pieces = []
    for label, fn, size in (("A · rond de sorcière (2 × 2)", lambda a: witch_ring(a, 16, 16, 11), 2),
                            ("B · tapis de mycélium (2 × 2)", lambda a: myc_mat(a, 16, 16), 2),
                            ("C · pavés soulevés, racine et lueur", heaved, 1),
                            ("D · poussière de spores", lambda a: spore_dust(a, 16, 16, 13, 9), 2),
                            ("E · regard d'écoulement rouillé", grate, 1),
                            ("F · flaque de suintement irisée", lambda a: seep(a, 13, 14, 11, 8), 2)):
        a = base(size, size, 300, 300)
        fn(a)
        pieces.append((label, [to_img(a).convert("RGBA")]))
    planche("SECTION 2 — À LA PLACE DES DALLES GRAVÉES : six marques naturelles du sol (à choisir)", big, pieces,
            "art/champi_sol_motifs_v1.png", S=4, note="Décor seulement. Idées : le rond de sorcière (le d20 du brief), les spores qui font éternuer.")
