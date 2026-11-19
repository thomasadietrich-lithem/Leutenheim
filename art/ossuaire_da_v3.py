"""Section 3, l'OSSUAIRE DE LA LUNE PÂLE : direction artistique v3 (Thomas, 2026-11-19, 8 h 23, sur la v2 : « pas mal ;
revois le X et le T ; pour les murs du bas et des côtés, revoir la forme des alcôves ; rends-les un peu moins carrées
aux bords extérieurs ; on doit vraiment voir les zones lumineuses et d'ombre, mieux les définir ; épaissis un peu le
brouillard »). PROPOSITION, rien n'est en jeu.

- X et T : la case de jonction prend, en haut, l'assise couchée du mur horizontal (qui la traverse) et, en bas, les
  pierres debout du mur vertical (qui la traversent) : chaque mur continue à travers l'autre, une assise sur deux.
- ALCÔVES selon le mur : mur du HAUT (on voit dedans de face) : crânes de face ; mur du BAS (on voit dedans par-dessus) :
  dessus des crânes et os couchés ; murs de CÔTÉ : crânes de profil, empilés en hauteur. Bords arrondis au fond,
  jambages irréguliers (pierre cassée), plus de rectangle net.
- LUMIÈRE EN PALIERS : pleine lune, demi-jour, pénombre, noir, avec un tramage de pixels entre deux paliers (on voit
  nettement où commence l'ombre).
- BRUME plus épaisse.

  python3 art/ossuaire_da_v3.py   → art/ossuaire_da_v3.png
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pix import fbm, font, grid, hash2, up  # noqa: E402

T = 16
# Quatre salles séparées par deux murs qui se croisent : un X au milieu, des T contre le pourtour.
PLAN = [
    "####################",
    "#.......#..........#",
    "#.......#..........#",
    "#.......#..........#",
    "#..................#",
    "#.......#..........#",
    "####.#######.#######",
    "#.......#..........#",
    "#.......#..........#",
    "#..................#",
    "#.......#..........#",
    "#.......#..........#",
    "####################",
]
PH, PW = len(PLAN), len(PLAN[0])
W, H = PW * T, PH * T
MOONS = [(14.5, 3.0, 1.0), (4.0, 9.5, 0.85)]  # puits de lune (case x, case y, force)
# Alcôves : (côté ouvert, première case, dernière case) ; « S » = mur du haut (ouvert vers le sud), « N » = mur du bas,
# « W » = mur de droite (ouvert vers l'ouest), « E » = mur de gauche.
ALCOVES = [("S", (2, 0), (5, 0)), ("S", (10, 0), (16, 0)), ("S", (13, 6), (18, 6)), ("N", (2, 12), (6, 12)),
           ("W", (19, 1), (19, 4)), ("E", (0, 7), (0, 11)), ("N", (11, 12), (16, 12))]
SARCOS = [(2, 9), (14, 9)]


def is_wall(x, y):
    return x < 0 or y < 0 or x >= PW or y >= PH or PLAN[y][x] == "#"


def kind(x, y):
    """H : mur qui court de gauche à droite ; V : de haut en bas ; J : angle, T ou X (les deux)."""
    h = (x > 0 and PLAN[y][x - 1] == "#") or (x < PW - 1 and PLAN[y][x + 1] == "#")
    v = (y > 0 and PLAN[y - 1][x] == "#") or (y < PH - 1 and PLAN[y + 1][x] == "#")
    # Un mur du pourtour garde son sens : il n'est jonction que si un mur intérieur le rejoint.
    if h and v:
        inner_h = 0 < y < PH - 1 and ((0 < x - 1 < PW - 1 and is_wall(x - 1, y)) or (0 < x + 1 < PW - 1 and is_wall(x + 1, y))) and 0 < x < PW - 1
        border_v = x in (0, PW - 1)
        border_h = y in (0, PH - 1)
        if border_h and not (0 < y + 1 < PH - 1 and is_wall(x, y + 1)) and not (0 < y - 1 < PH - 1 and is_wall(x, y - 1)):
            return "H"
        if border_v and not inner_h:
            return "V"
        return "J"
    return "V" if v else "H"


CHALK_A, CHALK_B, JOINT = np.array((194, 188, 172)), np.array((224, 218, 202)), np.array((118, 114, 112))


def chalk(t, grain):
    return (CHALK_A * (1 - t) + CHALK_B * t) * (0.93 + 0.1 * grain)


def wall_pixel_layer():
    """Les blocs de craie, case par case, selon le sens du mur ; en harpe aux jonctions."""
    out = np.zeros((H, W, 3))
    xs, ys = grid(W, H)
    grain = fbm(xs, ys, 3, 4, 2)
    for cy in range(PH):
        for cx in range(PW):
            if PLAN[cy][cx] != "#":
                continue
            k = kind(cx, cy)
            for ly in range(T):
                for lx in range(T):
                    X, Y = cx * T + lx, cy * T + ly
                    if k == "H":
                        row = Y // 8
                        u = X + (row % 2) * 8
                        bid, a, b = (u // 16, row), u % 16, Y % 8
                        jnt, hi, sh = a == 0 or b == 0, b == 1 and a > 0, b == 7 or a == 15
                    elif k == "V":
                        col = X // 8
                        u = Y + (col % 2) * 8
                        bid, a, b = (col, u // 16 + 1000), X % 8, u % 16
                        jnt, hi, sh = a == 0 or b == 0, a == 1 and b > 0, a == 7 or b == 15
                    else:
                        # Jonction (angle, T, X) : en haut l'assise couchée qui traverse, en bas les pierres debout.
                        if ly < 8:
                            row = Y // 8
                            u = X + (row % 2) * 8
                            bid, a, b = (u // 16, row), u % 16, Y % 8
                            jnt, hi, sh = a == 0 or b == 0, b == 1 and a > 0, b == 7 or a == 15
                        else:
                            col = X // 8
                            u = Y + (col % 2) * 8
                            bid, a, b = (col, u // 16 + 1000), X % 8, u % 16
                            jnt, hi, sh = a == 0 or b == 0 or ly == 8, a == 1 and b > 0, a == 7 or b == 15
                    t = hash2(bid[0], bid[1], 3)
                    c = chalk(float(t), float(grain[Y, X]))
                    if hash2(X, Y, 5) > 0.9 and (X + Y) % 3 == 0:
                        c = c * 0.86
                    if hi:
                        c = np.minimum(c * 1.07, 255)
                    if sh:
                        c = c * 0.8
                    if jnt:
                        c = JOINT
                    out[Y, X] = c
    return out


def floor_layer(xs, ys):
    """Dalles en losange bleu nuit, joints sombres, un peu de poussière d'os ; aucune gravure."""
    u, v = (xs + ys) / 16, (xs - ys) / 16
    cu, cv = np.floor(u).astype(int), np.floor(v).astype(int)
    fu, fv = u - cu, v - cv
    t = hash2(cu, cv, 41)
    out = np.array((40, 42, 66)) * (1 - t[..., None]) + np.array((52, 54, 82)) * t[..., None]
    j = (fu < 0.07) | (fv < 0.07)
    out[j] = (20, 20, 34)
    hi = ((fu < 0.13) | (fv < 0.13)) & ~j
    out[hi] = out[hi] * 1.18
    dust = (fbm(xs, ys, 20, 43, 2) > 0.66) & (hash2(xs.astype(int), ys.astype(int), 44) > 0.93)
    out[dust] = (110, 110, 124)
    return out


BONE, BONE_D, BONE_S, RECESS = np.array((222, 212, 186)), np.array((168, 156, 130)), np.array((60, 52, 44)), np.array((22, 20, 28))


def skull_front(a, sx, sy, shade):
    for dy in range(5):
        for dx in range(5):
            if (dy in (0, 4)) and dx in (0, 4):
                continue
            a[sy + dy, sx + dx] = BONE * shade
    a[sy + 4, sx + 1:sx + 4] = BONE_D * shade
    a[sy + 2, sx + 1] = BONE_S
    a[sy + 2, sx + 3] = BONE_S
    a[sy + 3, sx + 2] = BONE_S * 1.4
    a[sy + 1, sx + 1] = np.minimum(BONE * shade * 1.12, 255)


def skull_top(a, sx, sy, shade):
    """Dessus d'un crâne (vu d'en haut) : un ovale clair, reflet en haut à gauche, suture au milieu."""
    for dy in range(4):
        for dx in range(5):
            if (dy in (0, 3)) and dx in (0, 4):
                continue
            a[sy + dy, sx + dx] = BONE * shade * (0.86 if dy == 3 else 1)
    a[sy + 1, sx + 1] = np.minimum(BONE * shade * 1.15, 255)
    a[sy + 1:sy + 3, sx + 2] = BONE_D * shade


def skull_side(a, sx, sy, shade, face_left):
    """Crâne de profil : le dôme vers le fond, l'orbite et la mâchoire vers la salle."""
    rows = [".###.", "#####", "o####", "n####", ".jj#."]
    for dy, r in enumerate(rows):
        for dx, ch in enumerate(r):
            X = sx + (dx if face_left else 4 - dx)
            if ch == ".":
                continue
            a[sy + dy, X] = BONE_S if ch in "on" else (BONE_D * shade if ch == "j" else BONE * shade)
    a[sy + 1, sx + (3 if face_left else 1)] = np.minimum(BONE * shade * 1.12, 255)


def alcove(a, side, c0, c1):
    """Large alcôve d'ossuaire creusée dans un tronçon de mur. Fond arrondi, jambages de pierre cassée, rien au sol."""
    EDGE = np.array((12, 10, 16))
    if side in "SN":
        X0, X1 = c0[0] * T + 3, (c1[0] + 1) * T - 3
        Y0, Y1 = (c0[1] * T + 2, (c0[1] + 1) * T) if side == "S" else (c0[1] * T, (c0[1] + 1) * T - 2)
    else:
        Y0, Y1 = c0[1] * T + 3, (c1[1] + 1) * T - 3
        X0, X1 = (c0[0] * T, (c0[0] + 1) * T - 2) if side == "W" else (c0[0] * T + 2, (c0[0] + 1) * T)
    mask = np.zeros((Y1 - Y0, X1 - X0), bool)
    h, w = mask.shape
    for y in range(h):
        for x in range(w):
            # profondeur depuis l'ouverture, et position le long du mur
            if side == "S":
                depth, along, L = h - 1 - y, x, w
            elif side == "N":
                depth, along, L = y, x, w
            elif side == "W":
                depth, along, L = x, y, h
            else:
                depth, along, L = w - 1 - x, y, h
            back = (h if side in "SN" else w) - 1 - depth
            # jambages irréguliers : le bord bouge d'un pixel ici et là
            jag = int(hash2(along // 3, c0[0] * 31 + c0[1], 81) * 2) if depth > 2 else 0
            end = min(along, L - 1 - along)
            if end < jag:
                continue
            # fond arrondi : on rogne les coins du côté du fond
            r = 4
            if back < r and end < r and (r - back) ** 2 + (r - end) ** 2 > r * r:
                continue
            mask[y, x] = True
    sub = a[Y0:Y1, X0:X1]
    sub[mask] = RECESS
    # liseré sombre autour du creux (sauf côté ouvert)
    edge = mask & ~(np.roll(mask, 1, 0) & np.roll(mask, -1, 0) & np.roll(mask, 1, 1) & np.roll(mask, -1, 1))
    open_side = {"S": (slice(h - 1, h), slice(None)), "N": (slice(0, 1), slice(None)), "W": (slice(None), slice(0, 1)), "E": (slice(None), slice(w - 1, w))}[side]
    keep = np.zeros_like(edge)
    keep[open_side] = True
    sub[edge & ~keep] = EDGE

    def inside(x, y, ww, hh):
        return all(0 <= y + dy < h and 0 <= x + dx < w and mask[y + dy, x + dx] for dy in range(hh) for dx in range(ww))

    seed = c0[0] * 7 + c0[1]
    if side == "S":
        for (sy, off) in ((1, 0), (6, 3)):
            for sx in range(1 + off, w - 5, 6):
                if hash2(sx, sy + seed, 77) < 0.07 or not inside(sx, sy, 5, 5):
                    continue
                skull_front(sub, sx, sy, 0.8 + 0.25 * hash2(sx, sy, 78))
        for x in range(1, w - 1):
            if mask[h - 2, x] and (x % 9) < 8:
                sub[h - 2, x] = BONE_D
                sub[h - 1, x] = BONE_S
    elif side == "N":
        # vu par-dessus : os couchés côté ouverture, dessus des crânes au fond
        for x in range(1, w - 1):
            if mask[1, x] and (x % 8) < 7:
                sub[1, x] = BONE
                sub[2, x] = BONE_D
        for (sy, off) in ((4, 1), (8, 4)):
            for sx in range(1 + off, w - 5, 6):
                if hash2(sx, sy + seed, 77) < 0.08 or not inside(sx, sy, 5, 4):
                    continue
                skull_top(sub, sx, sy, 0.78 + 0.25 * hash2(sx, sy, 78))
    else:
        face_left = side == "W"
        cols = (1, 6) if face_left else (w - 6, w - 11)
        for k, sxb in enumerate(cols):
            for sy in range(1 + 3 * k, h - 5, 6):
                if hash2(sxb, sy + seed, 77) < 0.08 or not inside(sxb, sy, 5, 5):
                    continue
                skull_side(sub, sxb, sy, 0.78 + 0.25 * hash2(sxb, sy, 78), face_left)
        bx = w - 2 if face_left else 1
        for y in range(1, h - 1):
            if mask[y, bx] and (y % 9) < 8:
                sub[y, bx] = BONE_D


def sarcophagus(a, cx, cy):
    x0, y0 = cx * T + 1, cy * T + 2
    w, h = 2 * T - 2, T - 3
    a[y0:y0 + h, x0:x0 + w] = (168, 164, 154)
    a[y0:y0 + 7, x0:x0 + w] = (186, 182, 170)
    a[y0 + 4, x0 + 1:x0 + w - 1] = (146, 142, 134)
    a[y0, x0:x0 + w] = (60, 58, 66)
    a[y0 + h - 1, x0:x0 + w] = (60, 58, 66)
    a[y0:y0 + h, x0] = (60, 58, 66)
    a[y0:y0 + h, x0 + w - 1] = (60, 58, 66)
    a[y0 + h:y0 + h + 3, x0 + 1:x0 + w] *= 0.5  # ombre


def light_map(xs, ys):
    """La lune seule : chaque puits éclaire autour de lui, jusqu'aux murs (pas à travers)."""
    cell_lit = np.zeros((PH, PW))
    for (mx, my, f) in MOONS:
        for cy in range(PH):
            for cx in range(PW):
                # ligne de vue en cases depuis le puits
                n = int(max(abs(cx + 0.5 - mx), abs(cy + 0.5 - my)) * 3) + 1
                ok = True
                for i in range(1, n):
                    px_ = mx + (cx + 0.5 - mx) * i / n
                    py_ = my + (cy + 0.5 - my) * i / n
                    if PLAN[int(py_)][int(px_)] == "#" and (int(px_), int(py_)) != (cx, cy):
                        ok = False
                        break
                if ok:
                    cell_lit[cy, cx] = 1
        vis = np.kron(cell_lit, np.ones((T, T)))
        # adoucit le bord des zones vues
        for _ in range(2):
            vis = (vis + np.roll(vis, 1, 0) + np.roll(vis, -1, 0) + np.roll(vis, 1, 1) + np.roll(vis, -1, 1)) / 5
        cell_lit[:] = 0
        d = np.hypot(xs - mx * T, (ys - my * T) / 0.85) / T
        pool = np.clip(1.2 - d / 1.8, 0, 1)  # la flaque de lune au sol
        spill = np.clip(1 - d / 7.0, 0, 1) * 0.6  # la lumière qui se répand dans la salle
        yield (np.maximum(pool, spill) * vis * f, pool * f)


def main_room(flat=False):
    xs, ys = grid(W, H)
    wall = np.array([[PLAN[y // T][x // T] == "#" for x in range(W)] for y in range(H)])
    a = np.where(wall[..., None], wall_pixel_layer(), floor_layer(xs, ys))
    # liseré sombre du mur contre le sol, ombre portée des murs vers le sud
    fl = ~wall
    edge = wall & (np.roll(fl, 1, 0) | np.roll(fl, -1, 0) | np.roll(fl, 1, 1) | np.roll(fl, -1, 1))
    a[edge] *= 0.45
    for cy in range(PH - 1):
        for cx in range(PW):
            if PLAN[cy][cx] == "#" and PLAN[cy + 1][cx] == ".":
                for k in range(7):
                    a[(cy + 1) * T + k, cx * T:(cx + 1) * T] *= 0.5 + 0.07 * k
    for (side, c0, c1) in ALCOVES:
        alcove(a, side, c0, c1)
    for s in SARCOS:
        sarcophagus(a, *s)
    # lumière
    I = np.zeros((H, W))
    pools = np.zeros((H, W))
    for lit, pool in light_map(xs, ys):
        I = np.maximum(I, lit + pool * 0.6)
        pools = np.maximum(pools, pool)
    # Paliers : noir, pénombre, demi-jour, pleine lune ; tramage de pixels (2 × 2) entre deux paliers.
    bayer = np.array([[0.125, 0.625], [0.875, 0.375]])[ys.astype(int) % 2, xs.astype(int) % 2]
    STEPS = np.array([0.06, 0.4, 0.88, 1.3])
    jit = (bayer - 0.5) * 0.08
    q = (I + jit > 0.1).astype(int) + (I + jit > 0.32) + (pools * 0.6 + I * 0.4 + jit > 0.55)
    L = STEPS[q]
    if flat:
        L = np.full((H, W), 0.9)
    tint = np.array((0.8, 0.9, 1.12))
    a = a * L[..., None] * tint
    # brume (direction C) : nappes lentes au sol ; elle s'éclaire dans la lune et se perd dans le noir
    f = fbm(xs, ys * 2.2, 40, 7, 2)
    dens = np.clip((f - 0.38) * 2.0, 0, 1) * fl
    dens = np.clip((f - 0.3) * 2.2, 0, 1) * fl
    band = (np.round(dens * 3) / 3) * 0.62
    band = band * np.clip(0.3 + L, 0, 1)
    fogc = np.array((150, 116, 196))[None, None, :] * (0.1 + 0.8 * L[..., None])
    a = a * (1 - band[..., None]) + fogc * band[..., None]
    # poussière qui flotte dans les colonnes de lune
    motes = (hash2(xs.astype(int), ys.astype(int), 99) > 0.993) & (pools > 0.35) & fl
    a[motes] = (235, 240, 255)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def main():
    S = 3
    room = up(main_room(), S)
    pad = 24
    Z = 6
    crops = [("X (sans ombre)", (6 * T, 4 * T, 11 * T, 8 * T)), ("T (sans ombre)", (0, 5 * T, 4 * T, 8 * T)), ("Alcôve du bas", (1 * T, 10 * T, 8 * T, 13 * T)), ("Alcôve de côté", (16 * T, 0, 20 * T, 6 * T))]
    raw = main_room()
    flatimg = main_room(flat=True)
    zooms = [(n, up((flatimg if n.startswith(("X", "T")) else raw).crop(b), 4)) for n, b in crops]
    zh = max(z.height for _, z in zooms)
    Wb = max(room.width + 2 * pad, sum(z.width for _, z in zooms) + pad * (len(zooms) + 1))
    Hb = room.height + 140 + zh
    sheet = Image.new("RGB", (Wb, Hb), (14, 12, 18))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 3 · L'OSSUAIRE · direction artistique v3", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((Wb // 2, 54), "X et T revus · alcôves selon le mur (haut : de face, bas : par-dessus, côtés : de profil) · lumière en paliers · brume épaissie", fill=(190, 180, 160), font=font(14, False), anchor="mm")
    sheet.paste(room, ((Wb - room.width) // 2, 80))
    x = pad
    y = 80 + room.height + 34
    for n, z in zooms:
        d.text((x, y - 24), n, fill=(240, 192, 80), font=font(16), anchor="lt")
        sheet.paste(z, (x, y))
        x += z.width + pad
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ossuaire_da_v3.png")
    sheet.save(out)
    print("art/ossuaire_da_v3.png", sheet.size)


if __name__ == "__main__":
    main()
