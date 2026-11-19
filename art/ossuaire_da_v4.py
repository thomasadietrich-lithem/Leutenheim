"""Section 3, l'OSSUAIRE DE LA LUNE PÂLE : direction artistique v4 (Thomas, 2026-11-19, 8 h 35 : « ok fonce, je valide
tout sauf le 2 [bordure de dalles droites] ; diversifie les pierres tombales dans le sol ; revois la fine rangée de
pierre au bas des alcôves, elle semble terminer au mauvais endroit ; ajoute de l'usure au sol aussi »). PROPOSITION,
rien n'est en jeu.

- CRÂNES TOUJOURS TOURNÉS VERS LA SALLE, orbites et nez visibles : le même crâne de face, tourné selon le mur (haut :
  mâchoire vers le bas ; bas : mâchoire vers le haut ; côtés : mâchoire vers la salle).
- ALCÔVES ENCADRÉES de craie taillée en relief (linteau, jambages, et un REBORD qui s'arrête pile aux jambages) ;
  contenu varié : rangées de crânes, os croisés, un gros crâne au milieu des longues alcôves.
- MURS USÉS : fissures, blocs plus gris, traces d'humidité.
- SOL USÉ : dalles fêlées, coins écornés, dalles manquantes (terre), passage plus sombre ; PIERRES TOMBALES variées
  encastrées (inscription, crâne gravé, brisée, à anneau, double, os croisés, petite plaque).
- LUMIÈRE : en plus des paliers, une COLONNE de lumière visible au-dessus de chaque puits (poussière qui flotte).

  python3 art/ossuaire_da_v4.py   → art/ossuaire_da_v4.png
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
# Pierres tombales encastrées dans le sol : (case x, case y, sorte)
TOMBS = [(11, 2, "ins"), (5, 2, "crane"), (17, 4, "brisee"), (6, 4, "anneau"), (10, 8, "double"), (3, 11, "os"),
         (17, 10, "petite"), (1, 1, "petite"), (12, 4, "ins"), (6, 10, "brisee"), (16, 7, "crane")]


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
                    if hash2(bid[0], bid[1], 13) < 0.16:
                        c = c * 0.8  # bloc plus gris
                    if hash2(bid[0], bid[1], 14) < 0.12 and abs((a - 2) - b * 1.4) < 0.7 and 1 < a < 12:
                        c = c * 0.55  # fissure
                    damp = fbm(np.array(float(X)), np.array(float(Y) * 0.35), 9, 15, 2)
                    if damp > 0.68:
                        c = c * (0.86 if (X + Y) % 2 else 0.8)  # trace d'humidité qui coule
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
    # Usure : dalles fêlées, coins écornés, dalles manquantes (terre), passage plus sombre.
    crack = (hash2(cu, cv, 45) < 0.18) & (np.abs(fu - fv * 0.7 - 0.15) < 0.04) & (fu > 0.12) & (fv > 0.12)
    out[crack] = (18, 18, 30)
    chip = (hash2(cu, cv, 46) < 0.22) & (fu + fv < 0.42) & ~j
    out[chip] = out[chip] * 0.62
    gone = hash2(cu, cv, 47) < 0.035
    earth = np.array((44, 36, 40)) * (0.85 + 0.3 * hash2(xs.astype(int), ys.astype(int), 48))[..., None]
    out[gone] = earth[gone]
    pebble = gone & (hash2(xs.astype(int), ys.astype(int), 49) > 0.9)
    out[pebble] = (90, 86, 96)
    path = fbm(xs, ys, 30, 50, 2) > 0.6
    out[path] = out[path] * 0.85
    return out


BONE, BONE_D, BONE_S, RECESS = np.array((222, 212, 186)), np.array((168, 156, 130)), np.array((60, 52, 44)), np.array((22, 20, 28))


SKULL = [".###.", "#####", "#o#o#", "##n##", ".jjj."]
BIG_SKULL = ["..###..", ".#####.", "#######", "#oo#oo#", "#oo#oo#", "###n###", ".#jjj#.", "..jjj.."]
XBONES = ["k...k", ".k.k.", "..k..", ".k.k.", "k...k"]


def turned(rows, side):
    """Le dessin de face (mâchoire en bas), tourné pour que la mâchoire regarde la salle."""
    g = np.array([list(r) for r in rows])
    k = {"S": 0, "N": 2, "W": 3, "E": 1}[side]  # rot90 tourne dans le sens inverse des aiguilles
    return np.rot90(g, k)


def stamp(a, rows, side, sx, sy, shade):
    g = turned(rows, side)
    for dy in range(g.shape[0]):
        for dx in range(g.shape[1]):
            ch = g[dy, dx]
            if ch == ".":
                continue
            a[sy + dy, sx + dx] = {"#": BONE * shade, "o": BONE_S, "n": BONE_S * 1.4, "j": BONE_D * shade, "k": BONE * shade * 0.95}[ch]
    return g.shape


FRAME, FRAME_HI, FRAME_D = np.array((236, 230, 214)), np.array((250, 246, 234)), np.array((96, 92, 92))


def alcove(a, side, c0, c1):
    """Alcôve d'ossuaire : creux à fond arrondi, ENCADREMENT de craie taillée (linteau, jambages, rebord qui s'arrête aux
    jambages), crânes tournés vers la salle, os croisés et gros crâne pour varier."""
    horiz = side in "SN"
    if horiz:
        X0, X1 = c0[0] * T + 2, (c1[0] + 1) * T - 2
        Y0, Y1 = (c0[1] * T + 1, (c0[1] + 1) * T) if side == "S" else (c0[1] * T, (c0[1] + 1) * T - 1)
    else:
        Y0, Y1 = c0[1] * T + 2, (c1[1] + 1) * T - 2
        X0, X1 = (c0[0] * T, (c0[0] + 1) * T - 1) if side == "W" else (c0[0] * T + 1, (c0[0] + 1) * T)
    sub = a[Y0:Y1, X0:X1]
    h, w = sub.shape[:2]
    # repère local : d = profondeur depuis l'ouverture (0 = bord de la salle), t = position le long du mur
    def local(y, x):
        if side == "S":
            return h - 1 - y, x, w
        if side == "N":
            return y, x, w
        if side == "W":
            return x, y, h
        return w - 1 - x, y, h
    depth_max = (h if horiz else w) - 1
    frame = np.zeros((h, w), bool)
    hole = np.zeros((h, w), bool)
    sill = np.zeros((h, w), bool)
    for y in range(h):
        for x in range(w):
            d, t, L = local(y, x)
            end = min(t, L - 1 - t)
            back = depth_max - d
            if d <= 1:
                # le REBORD : deux pixels côté salle, sur toute la longueur de l'encadrement (pas au-delà)
                sill[y, x] = True
                continue
            if end < 2 or back < 2:
                frame[y, x] = True  # jambages et linteau
                continue
            r = 4
            e2, b2 = end - 2, back - 2
            if b2 < r and e2 < r and (r - b2) ** 2 + (r - e2) ** 2 > r * r:
                frame[y, x] = True  # le fond arrondi est taillé dans l'encadrement
                continue
            hole[y, x] = True
    sub[hole] = RECESS
    sub[frame] = FRAME
    sub[sill] = FRAME
    # relief : un trait clair côté lumière (haut et gauche), un trait sombre autour du creux et au bord de la salle
    inner = hole & ~(np.roll(hole, 1, 0) & np.roll(hole, -1, 0) & np.roll(hole, 1, 1) & np.roll(hole, -1, 1))
    sub[inner] = RECESS * 0.6
    ring = (frame | sill) & (np.roll(hole, 1, 0) | np.roll(hole, -1, 0) | np.roll(hole, 1, 1) | np.roll(hole, -1, 1))
    sub[ring] = FRAME_D
    lit = (frame | sill) & ~ring & ~(np.roll(frame | sill, 1, 0)) 
    sub[lit] = FRAME_HI
    for y in range(h):
        for x in range(w):
            if (frame[y, x] or sill[y, x]) and local(y, x)[0] == 0:
                sub[y, x] = FRAME_D * 0.8  # arête du rebord, côté salle
    # Contenu : on remplit le creux le long du mur, en tranches.
    seed = c0[0] * 7 + c0[1]
    hh, ww = (h, w)
    span = w if horiz else h
    mid = span // 2

    def fits(sx, sy, gh, gw):
        return all(0 <= sy + dy < hh and 0 <= sx + dx < ww and hole[sy + dy, sx + dx] for dy in range(gh) for dx in range(gw))

    def place(rows, t_pos, d_pos, shade):
        g = turned(rows, side)
        gh, gw = g.shape
        if side == "S":
            sx, sy = t_pos, h - 1 - d_pos - gh + 1
        elif side == "N":
            sx, sy = t_pos, d_pos
        elif side == "W":
            sx, sy = d_pos, t_pos
        else:
            sx, sy = w - 1 - d_pos - gw + 1, t_pos
        if fits(sx, sy, gh, gw):
            stamp(sub, rows, side, sx, sy, shade)
            return True
        return False

    big = span >= 70
    if big:
        place(BIG_SKULL, mid - 3, 2, 1.0)
    t = 3
    k = 0
    while t < span - 6:
        if big and abs(t + 2 - mid) < 7:
            t += 1
            continue
        motif = XBONES if hash2(t, seed, 90) < 0.18 else SKULL
        shade = 0.8 + 0.25 * hash2(t, seed, 78)
        # deux rangées : devant (près de la salle) et derrière, décalées
        place(motif, t, 2, shade)
        place(SKULL, t + 3, 7, 0.7 + 0.2 * hash2(t, seed, 79))
        t += 6
        k += 1


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


STONE, STONE_HI, STONE_D, CARVE = np.array((112, 114, 132)), np.array((140, 142, 160)), np.array((46, 46, 62)), np.array((70, 72, 92))


def tomb(a, cx, cy, kind):
    """Pierre tombale encastrée dans le sol (à plat), plusieurs sortes."""
    w = 2 * T if kind == "double" else T
    x0, y0 = cx * T, cy * T
    if kind == "petite":
        x0, y0, ww, hh = x0 + 4, y0 + 4, 8, 8
    else:
        x0, y0, ww, hh = x0 + 2, y0 + 1, w - 4, T - 2
    r = a[y0:y0 + hh, x0:x0 + ww]
    r[:] = STONE * (0.92 + 0.12 * hash2(cx, cy, 91))
    r[0, :] = STONE_HI
    r[:, 0] = STONE_HI
    r[-1, :] = STONE_D
    r[:, -1] = STONE_D
    if kind in ("ins", "double"):
        for k, yy in enumerate((4, 7, 10)):
            if yy < hh - 2:
                for xx in range(3, ww - 3):
                    if hash2(xx // 2, cy * 9 + k, 92) > 0.25 and (kind != "double" or abs(xx - ww // 2) > 1):
                        r[yy, xx] = CARVE
        if kind == "double":
            r[2:hh - 2, ww // 2] = STONE_D
    elif kind == "crane":
        g = np.array([list(q) for q in SKULL])
        for dy in range(5):
            for dx in range(5):
                if g[dy, dx] != ".":
                    r[4 + dy, ww // 2 - 2 + dx] = CARVE if g[dy, dx] in "onj" else STONE_HI
    elif kind == "os":
        g = np.array([list(q) for q in XBONES])
        for dy in range(5):
            for dx in range(5):
                if g[dy, dx] != ".":
                    r[4 + dy, ww // 2 - 2 + dx] = CARVE
    elif kind == "anneau":
        for (dx, dy) in ((5, 5), (6, 4), (7, 4), (8, 5), (8, 6), (7, 7), (6, 7), (5, 6)):
            r[dy + 1, dx] = (40, 36, 34)
        r[2, 6] = (90, 80, 70)
    elif kind == "brisee":
        for k in range(ww):
            yy = int(3 + k * 0.6 + (k % 3 == 0))
            if 0 < yy < hh - 1:
                r[yy, k] = STONE_D
        r[hh - 4:, ww - 4:] = np.array((44, 36, 40))  # le coin manque : la terre dessous
    elif kind == "petite":
        r[3:5, 3:5] = CARVE


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
    for (cx, cy, k) in TOMBS:
        tomb(a, cx, cy, k)
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
    # COLONNE DE LUNE : la lumière qui tombe du plafond, visible au-dessus du puits (translucide, tramée sur les bords)
    if not flat:
        for (mx, my, f_) in MOONS:
            cxp, top, bot = mx * T, (my - 2.6) * T, my * T
            half = 1.1 * T
            inside = (np.abs(xs - cxp) < half * (0.75 + 0.25 * (ys - top) / (bot - top))) & (ys > top) & (ys < bot)
            fade = np.clip((ys - top) / (bot - top), 0, 1)
            edgef = np.abs(xs - cxp) / half
            alpha = inside * fade * 0.4 * f_ * np.where(edgef > 0.7, (bayer > 0.5) * 1.0, 1.0)
            a = a * (1 - alpha[..., None]) + np.array((210, 226, 255)) * alpha[..., None]
    # poussière qui flotte dans les colonnes de lune
    motes = (hash2(xs.astype(int), ys.astype(int), 99) > 0.992) & (pools > 0.2)
    a[motes] = (235, 240, 255)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def main():
    S = 3
    room = up(main_room(), S)
    pad = 24
    Z = 6
    crops = [("Mur du haut", (9 * T, 0, 17 * T, 2 * T)), ("Mur du bas", (1 * T, 11 * T, 8 * T, 13 * T)), ("Côté", (17 * T, 0, 20 * T, 6 * T))]
    raw = main_room()
    flatimg = main_room(flat=True)
    zooms = [(n, up((flatimg if True else raw).crop(b), 4)) for n, b in crops]
    kinds = [("Inscription", "ins"), ("Crâne gravé", "crane"), ("Brisée", "brisee"), ("À anneau", "anneau"), ("Os croisés", "os"), ("Petite plaque", "petite"), ("Double", "double")]
    xs_, ys_ = grid(2 * T, T)
    legend = []
    for name, k in kinds:
        tile = floor_layer(xs_ + 3 * T, ys_ + 5 * T).copy()
        tomb(tile, 0, 0, k)
        im = Image.fromarray(np.clip(tile * np.array((0.9, 0.95, 1.05)), 0, 255).astype(np.uint8), "RGB")
        legend.append((name, up(im if k == "double" else im.crop((0, 0, T, T)), 5)))
    pass
    zh = max(z.height for _, z in zooms if z is not None)
    Wb = max(room.width + 2 * pad, sum(z.width for _, z in zooms if z is not None) + pad * (len(zooms) + 1))
    Hb = room.height + 140 + zh + 140
    sheet = Image.new("RGB", (Wb, Hb), (14, 12, 18))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 3 · L'OSSUAIRE · direction artistique v4", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((Wb // 2, 54), "Crânes tournés vers la salle · alcôves encadrées · usure des murs et du sol · pierres tombales · colonnes de lune", fill=(190, 180, 160), font=font(14, False), anchor="mm")
    sheet.paste(room, ((Wb - room.width) // 2, 80))
    x = pad
    y = 80 + room.height + 34
    for n, z in zooms:
        if z is None:
            continue
        d.text((x, y - 24), n, fill=(240, 192, 80), font=font(16), anchor="lt")
        sheet.paste(z, (x, y))
        x += z.width + pad
    y2 = y + zh + 50
    d.text((pad, y2 - 26), "Pierres tombales encastrées (×5)", fill=(240, 192, 80), font=font(16), anchor="lt")
    x = pad
    for n, im in legend:
        sheet.paste(im, (x, y2))
        d.text((x, y2 + im.height + 6), n, fill=(220, 210, 190), font=font(13, False), anchor="lt")
        x += max(im.width, 110) + 14
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ossuaire_da_v4.png")
    sheet.save(out)
    print("art/ossuaire_da_v4.png", sheet.size)


if __name__ == "__main__":
    main()
