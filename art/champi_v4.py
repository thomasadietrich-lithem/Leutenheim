"""Section 2, la CHAMPIGNONNIÈRE : ambiance v4 (Thomas, 2026-11-14, sur la v3 : « on est vraiment pas mal » ; « il
faut comprendre que les murs sont éventrés à l'endroit où la terre est entrée : briques brisées et déplacées tout
autour » ; « abîme un chouille plus les murs, même loin des brèches » ; « que proposes-tu comme porte et porte
verrouillée ? » ; « que proposes-tu pour camoufler une salle secrète ? »).

- La salle de la v3, avec des BRÈCHES ÉVENTRÉES (bords de mur déchiquetés, briques fendues, briques arrachées et
  éparpillées autour de la brèche) et des murs un peu ABÎMÉS partout (éclats au bord, fissures, briques manquantes).
- TROIS PORTES (fermée, ouverte, verrouillée) : A bois pourri, B racines tressées, C grille rouillée.
- QUATRE CAMOUFLAGES de salle secrète : rideau de mycélium, éboulis aux racines, fissure lumineuse, grappe qui bouche.

  python3 art/champi_v4.py   → art/champi_v4.png
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import murs_v3 as M  # noqa: E402
import champi_v1 as V1  # noqa: E402
import champi_v3 as V3  # noqa: E402
from pix import fbm, font, grid, hash2, outline_mask, up  # noqa: E402
from dortoir_v2 import Sprite  # noqa: E402

T = 16
BRICK, BRICK_HI, BRICK_SH = np.array((150, 128, 140)), np.array((196, 178, 188)), np.array((96, 80, 90))
CRACK = np.array((18, 12, 16))
HOLE = np.array((10, 8, 12))


def brick(a, X, Y, w, h, tilt=0):
    """Une brique arrachée, posée de travers (tilt : marche d'un pixel)."""
    H, W = a.shape[:2]
    for j in range(h):
        for i in range(w):
            x, y = X + i, Y + j + (tilt * i) // max(1, w)
            if 0 <= x < W and 0 <= y < H:
                a[y, x] = BRICK_HI if j == 0 else BRICK_SH if j == h - 1 else BRICK
    for i in range(w):
        x, y = X + i, Y + h + (tilt * i) // max(1, w)
        if 0 <= x < W and 0 <= y < H:
            a[y, x] = (24, 18, 22)


def cracks(a, mask, rng, n, length):
    """Fissures sombres qui serpentent dans les pierres."""
    ys, xs = np.nonzero(mask)
    if len(xs) == 0:
        return
    H, W = a.shape[:2]
    for _ in range(n):
        i = rng.integers(0, len(xs))
        x, y = float(xs[i]), float(ys[i])
        ang = rng.uniform(0, 2 * math.pi)
        for _ in range(int(rng.integers(length // 2, length))):
            xi, yi = int(x), int(y)
            if 0 <= xi < W and 0 <= yi < H and mask[yi, xi]:
                a[yi, xi] = CRACK
            ang += rng.uniform(-0.7, 0.7)
            x += math.cos(ang)
            y += math.sin(ang)


def worn_walls(a, xs, ys, wallmask):
    """Murs un peu abîmés partout : éclats au bord côté salle, fissures, quelques briques manquantes, taches sombres."""
    rng = np.random.default_rng(21)
    floor = ~wallmask
    near = wallmask & (ndimage.distance_transform_edt(wallmask) < 5)
    # Éclats : de petites encoches au bord du mur.
    edge = wallmask & ndimage.binary_dilation(floor)
    ey, ex = np.nonzero(edge)
    for k in rng.choice(len(ex), size=len(ex) // 40, replace=False):
        w, h = int(rng.integers(2, 4)), int(rng.integers(1, 3))
        x0, y0 = ex[k] - w // 2, ey[k] - h // 2
        sub = (slice(max(0, y0), y0 + h), slice(max(0, x0), x0 + w))
        a[sub] = a[sub] * 0.35
    cracks(a, near, rng, 14, 10)
    # Briques manquantes : un trou noir, la brique d'en dessous éclairée sur son bord.
    ny, nx = np.nonzero(near & (ndimage.distance_transform_edt(wallmask) > 2))
    for k in rng.choice(len(nx), size=6, replace=False):
        x0, y0 = nx[k], ny[k]
        a[y0:y0 + 2, x0:x0 + 4] = HOLE
        a[y0 + 2:y0 + 3, x0:x0 + 4] = (90, 78, 86)
    stain = wallmask & (fbm(xs, ys, 12, 701, 2) > 0.66)
    a[stain] = a[stain] * 0.82


def breach_damage(a, xs, ys, wallmask, mound):
    """Les brèches ÉVENTRÉES : bords déchiquetés, briques fendues, briques arrachées éparpillées autour."""
    rng = np.random.default_rng(31)
    H, W = a.shape[:2]
    E = np.zeros((H, W), bool)
    for (cx, cy) in V3.cells("E"):
        E[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T] = True
    dE = ndimage.distance_transform_edt(~E)
    # Bord déchiqueté : le mur est grignoté sur quelques pixels, irrégulièrement (dents, pierres à moitié cassées).
    bite = wallmask & (dE < 4 + 12 * fbm(xs, ys, 5, 711, 2))
    # Dans la morsure : un amas de morceaux de briques (blocs de 3 × 2, clair dessus, sombre dessous) dans la terre.
    a[bite] = (58, 42, 44)
    blk = hash2((xs // 3).astype(int), (ys // 2).astype(int), 713)
    chunk = bite & (blk > 0.45)
    a[chunk] = BRICK * (0.75 + 0.4 * blk[chunk][..., None])
    top = chunk & ((ys.astype(int) % 2) == 0)
    a[top] = BRICK_HI * 0.95
    rim = outline_mask(bite) & wallmask
    a[rim] = (20, 14, 18)
    # Briques fendues tout autour (plus de fissures, plus longues).
    cracks(a, wallmask & ~bite & (dE < 22), rng, 22, 14)
    # Briques arrachées : éparpillées sur le sol et sur l'éboulis, de plus en plus rares en s'éloignant.
    around = (~wallmask) & (dE < 30) & (dE > 2)
    ry, rx = np.nonzero(around)
    for _ in range(70):
        i = rng.integers(0, len(rx))
        if rng.random() > 1.2 - dE[ry[i], rx[i]] / 30:
            continue
        brick(a, int(rx[i]), int(ry[i]), int(rng.integers(4, 7)), int(rng.integers(2, 4)), int(rng.integers(-2, 3)))
    # Éclats de brique (petits morceaux).
    for _ in range(80):
        i = rng.integers(0, len(rx))
        if dE[ry[i], rx[i]] < 22:
            a[ry[i], rx[i]] = BRICK_HI if rng.random() < 0.5 else BRICK


# ---------------------------------------------------------------- portes (une case de mur, vue de dessus)

WOOD, WOOD_D, WOOD_L = (104, 74, 52, 255), (66, 46, 34, 255), (132, 98, 70, 255)
ROT = (70, 86, 60, 255)
IRON, IRON_D, IRON_L = (84, 84, 96, 255), (50, 50, 60, 255), (130, 130, 146, 255)
RUST = (140, 76, 44, 255)
MYC, MYC_D = (214, 220, 226, 255), (160, 168, 178, 255)
GLOW = (120, 255, 214, 255)
ROOT, ROOT_D, ROOT_L = (112, 80, 56, 255), (72, 50, 36, 255), (150, 112, 80, 255)


def door_rotten(state):
    """A · BOIS POURRI : planches gonflées d'humidité, taches de moisissure, un disque lumineux qui y pousse."""
    s = Sprite(16, 16)
    if state == "open":
        s.r(0, 0, 3, 16, WOOD).r(2, 0, 1, 16, WOOD_D).p(1, 5, ROT).p(0, 11, ROT)
        return s.done(outline=False)
    for x in range(16):
        c = WOOD_D if x % 4 == 0 else WOOD_L if x % 4 == 1 else WOOD
        s.r(x, 0, 1, 16, c)
    s.r(0, 3, 16, 1, IRON_D).r(0, 12, 16, 1, IRON_D)
    for (x, y) in ((2, 6), (3, 7), (9, 9), (10, 8), (13, 14), (6, 1)):
        s.p(x, y, ROT)
    s.r(11, 5, 3, 3, (90, 220, 200, 255)).p(12, 6, (190, 255, 240, 255))
    s.p(4, 14, CRACK_PX).p(5, 13, CRACK_PX).p(5, 12, CRACK_PX)
    if state == "locked":
        # Barre de fer et cadenas, mangés par le mycélium.
        s.r(0, 7, 16, 2, IRON).r(0, 7, 16, 1, IRON_L)
        s.r(6, 6, 4, 5, (200, 160, 60, 255)).r(7, 9, 2, 1, (60, 40, 20, 255)).r(6, 6, 4, 1, (240, 210, 110, 255))
        for x in (1, 2, 12, 14):
            s.p(x, 9, MYC).p(x, 10, MYC_D)
        s.p(3, 6, MYC).p(13, 6, MYC)
    return s.done(outline=False)


CRACK_PX = (30, 20, 16, 255)


def door_roots(state):
    """B · RACINES TRESSÉES : un battant de racines entrecroisées ; des fils lumineux courent dedans."""
    s = Sprite(16, 16)
    if state == "open":
        for y in range(16):
            s.p(0 + (y % 3 == 0), y, ROOT).p(1, y, ROOT_D).p(15 - (y % 4 == 1), y, ROOT).p(14, y, ROOT_D)
        s.p(1, 6, GLOW).p(14, 11, GLOW)
        return s.done(outline=False)
    s.r(0, 0, 16, 16, (40, 28, 22, 255))
    for k in range(-16, 16, 4):
        for i in range(16):
            x, y = i, i + k
            if 0 <= y < 16:
                s.p(x, y, ROOT if (i // 2) % 2 else ROOT_L)
            x2, y2 = 15 - i, i + k + 2
            if 0 <= y2 < 16:
                s.p(x2, y2, ROOT_D if (i // 2) % 2 else ROOT)
    for (x, y) in ((3, 2), (4, 3), (5, 4), (10, 9), (11, 10), (12, 11), (7, 13), (8, 12)):
        s.p(x, y, GLOW)
    if state == "locked":
        # Un gros nœud de racines serré au milieu, qui luit : il faut le trancher (ou le brûler).
        s.r(5, 5, 6, 6, ROOT_D).r(6, 6, 4, 4, ROOT).r(7, 7, 2, 2, GLOW).p(6, 5, ROOT_L).p(10, 9, ROOT_L)
        for (x, y) in ((4, 7), (11, 8), (7, 4), (8, 11)):
            s.p(x, y, ROOT_L)
    return s.done(outline=False)


def door_grate(state):
    """C · GRILLE ROUILLÉE : des barreaux qu'on voit à travers (comme la prison), rouille et mycélium aux pieds."""
    s = Sprite(16, 16)
    if state == "open":
        s.r(0, 0, 2, 16, IRON).r(1, 0, 1, 16, IRON_D).p(0, 4, RUST).p(1, 10, RUST)
        return s.done(outline=False)
    for x in (1, 4, 7, 10, 13):
        s.r(x, 0, 2, 16, IRON).r(x + 1, 0, 1, 16, IRON_D).p(x, 1, IRON_L)
    s.r(0, 2, 16, 1, IRON_D).r(0, 13, 16, 1, IRON_D)
    for (x, y) in ((4, 6), (5, 9), (10, 4), (13, 11), (1, 12)):
        s.p(x, y, RUST)
    for x in (0, 3, 6, 9, 12, 15):
        s.p(x, 15, MYC).p(x, 14, MYC_D)
    if state == "locked":
        # Une chaîne enroulée et un gros cadenas.
        for x in range(0, 16, 2):
            s.r(x, 7 + (x // 2) % 2, 2, 1, IRON_L)
        s.r(6, 8, 5, 5, (200, 160, 60, 255)).r(7, 6, 3, 2, IRON_L).r(8, 10, 1, 2, (60, 40, 20, 255)).r(6, 8, 5, 1, (240, 210, 110, 255))
    return s.done(outline=False)


VIGNETTE = ["#####", "#...#", "##D##", "#...#", "#####"]


def wall_vignette(draw_cell, plan=VIGNETTE):
    """Un petit morceau de mur (option C), et ce qu'on dessine dans la case « D »."""
    V1.WALLS["C"]()
    fp = [r.replace("S", "#") for r in plan]
    walls = M.Walls([r.replace("D", "#") for r in fp])
    img = M.render([r.replace("D", "#") for r in fp], moss=False)
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
    for y, row in enumerate(fp):
        for x, c in enumerate(row):
            if c in "#D":
                wallmask[y * T:(y + 1) * T, x * T:(x + 1) * T] = True
    worn_walls(a, xs, ys, wallmask)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")
    for y, row in enumerate(plan):
        for x, c in enumerate(row):
            if c in "DS":
                draw_cell(img, x, y)
    return img


def paste_cell(sprite):
    def f(img, x, y):
        im = sprite.img()
        img.paste(im, (x * T, y * T), im)
    return f


# ---------------------------------------------------------------- camouflages de salle secrète


def camo_mycelium(img, x, y):
    """Rideau de mycélium : la case de mur est noyée sous les filaments ; seuls quelques spores dérivent par devant."""
    a = np.asarray(img).astype(float)
    X0, Y0 = x * T, y * T
    rng = np.random.default_rng(41)
    H, W = a.shape[:2]
    xs, ys = grid(W, H)
    blob = np.hypot((xs - X0 - 8) / 1.5, ys - Y0 - 8) < 9 + 4 * (fbm(xs, ys, 4, 811, 2) - 0.5)
    by, bx = np.nonzero(blob)
    for j, i in zip(by, bx):
        dd = math.hypot((i - X0 - 8) / 1.5, j - Y0 - 8)
        if rng.random() < 0.85 - dd / 14 or (i + j * 2) % 5 == 0 and dd < 7:
            a[j, i] = MYC[:3] if rng.random() < 0.6 else MYC_D[:3]
    for (dx, dy) in ((4, 20), (9, 24), (12, 19), (6, 28)):
        a[Y0 + dy, X0 + dx] = (190, 255, 236)
    img.paste(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB"))


def camo_rubble(img, x, y):
    """Éboulis aux racines : un petit tas de terre bouche une brèche ; toutes ses racines lumineuses filent vers elle."""
    a = np.asarray(img).astype(float)
    H, W = a.shape[:2]
    xs, ys = grid(W, H)
    cx, cy = (x + 0.5) * T, (y + 0.9) * T
    d = np.hypot((xs - cx) / 1.3, ys - cy)
    m = d < 13 + 3 * (fbm(xs, ys, 4, 801, 2) - 0.5)
    hgt = np.clip((13 - d) / 13, 0, 1)
    col = np.array((96, 70, 60)) + np.array((70, 56, 40)) * hgt[..., None]
    a[m] = col[m]
    face = np.zeros_like(m)
    for k in range(1, 4):
        face[k:, :] |= m[:-k, :]
    face &= ~m
    a[face] = (62, 44, 42)
    a[outline_mask(m | face)] = (30, 22, 24)
    rng = np.random.default_rng(42)
    for sx in (-10, -4, 4, 10):
        px_, py_ = cx + sx, cy + 8
        for _ in range(14):
            if m[int(py_), int(px_)]:
                a[int(py_), int(px_)] = (120, 255, 220)
            px_ += (cx - px_) * 0.12 + rng.uniform(-0.5, 0.5)
            py_ -= 0.9
    img.paste(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB"))


def camo_crack(img, x, y):
    """Fissure lumineuse : une lézarde dans le mur, d'où filtre la lueur bleu-vert de la salle cachée."""
    a = np.asarray(img).astype(float)
    H, W = a.shape[:2]
    xs, ys = grid(W, H)
    X0, Y0 = x * T, y * T
    pts = [(7, 0), (8, 3), (6, 6), (8, 9), (9, 12), (7, 15)]
    line = np.zeros((H, W), bool)
    for (x1, y1), (x2, y2) in zip(pts, pts[1:]):
        for k in range(8):
            line[Y0 + y1 + (y2 - y1) * k // 8, X0 + x1 + (x2 - x1) * k // 8] = True
    a[line] = (150, 255, 230)
    halo = ndimage.binary_dilation(line, iterations=2) & ~line
    a[halo] = a[halo] * 0.5 + np.array((60, 170, 150)) * 0.5
    glow = np.clip(1 - np.hypot(xs - X0 - 8, ys - Y0 - 20) / 18, 0, 1)
    a = a + np.array((20, 70, 60)) * glow[..., None]
    img.paste(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB"))


def camo_cluster(img, x, y):
    """Grappe qui bouche : une brèche dans le mur, entièrement remplie par une grosse grappe ; on la coupe."""
    a = np.asarray(img).astype(float)
    a[y * T:(y + 1) * T, x * T:(x + 1) * T] = (40, 30, 32)
    img.paste(Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB"))
    for (dx, dy, sp) in ((-2, -12, V3.green_cluster()), (4, -4, V3.group("touffe", "g"))):
        im = sp.img()
        img.paste(im, (x * T + dx, y * T + dy + (T - im.height) + 12), im)


def dark(img, k=0.62):
    a = np.asarray(img).astype(float) * np.array((0.82, 0.92, 1.0)) * k
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def main():
    V3.PRE_HOOK = lambda a, xs, ys, wm: worn_walls(a, xs, ys, wm)
    V3.HOOK = breach_damage
    S = 4
    r = up(V3.room(), S)
    pad = 24
    VS = 4
    doors = [("A · Bois pourri", door_rotten), ("B · Racines tressées", door_roots), ("C · Grille rouillée", door_grate)]
    camos = [("Rideau de mycélium", camo_mycelium), ("Éboulis aux racines", camo_rubble), ("Fissure lumineuse", camo_crack), ("Grappe qui bouche", camo_cluster)]
    vw = 5 * T * VS
    Wb = max(r.width + 2 * pad, pad + 4 * (vw + pad), 2 * pad + 3 * (3 * (3 * T * 3 + 4) + 28))
    Hb = 80 + r.height + 40 + (vw + 70) * 2 + 120
    sheet = Image.new("RGB", (Wb, Hb), (22, 18, 14))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 2 · LA CHAMPIGNONNIÈRE · ambiance v4 (option C)", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((Wb // 2, 52), "Brèches éventrées (briques arrachées et éparpillées) · murs un peu abîmés partout · portes · salles secrètes",
           fill=(190, 180, 160), font=font(13, False), anchor="mm")
    sheet.paste(r, ((Wb - r.width) // 2, 72))
    y = 72 + r.height + 30
    d.text((pad, y), "Portes : fermée · ouverte · verrouillée (une case de mur)", fill=(240, 192, 80), font=font(18), anchor="lt")
    y += 30
    x = pad
    for name, fn in doors:
        x0 = x
        for st in ("closed", "open", "locked"):
            v = wall_vignette(paste_cell(fn(st)), ["...", "#D#", "..."])
            im = up(dark(v, 0.85), 3)
            sheet.paste(im, (x, y))
            x += im.width + 4
        d.text((x0, y + im.height + 6), name, fill=(220, 210, 190), font=font(14, False), anchor="lt")
        x += 28
    y += 3 * T * 3 + 40
    d.text((pad, y), "Camoufler une salle secrète (la case du milieu cache le passage)", fill=(240, 192, 80), font=font(18), anchor="lt")
    y += 30
    x = pad
    for name, fn in camos:
        v = wall_vignette(fn, ["#####", ".....", "##S##", ".....", "....."])
        im = up(dark(v, 0.8), 4)
        sheet.paste(im, (x, y))
        d.text((x, y + im.height + 6), name, fill=(220, 210, 190), font=font(14, False), anchor="lt")
        x += im.width + pad
    sheet = sheet.crop((0, 0, Wb, y + 5 * T * 4 + 40))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "champi_v4.png")
    sheet.save(out)
    print("art/champi_v4.png", sheet.size)


if __name__ == "__main__":
    main()
