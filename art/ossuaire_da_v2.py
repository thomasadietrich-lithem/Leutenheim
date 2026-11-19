"""Section 3, l'OSSUAIRE DE LA LUNE PÂLE : direction artistique v2 (Thomas, 2026-11-19, 8 h 15, sur la planche v1 :
« on mélange le A avec la brume du C ; retire les lunes dessinées, on comprend mal ; veille à la cohérence de
l'orientation ainsi que des sections de murs en X et T ; consacrer des sections de murs entières avec de larges alcôves
remplies d'os et de crânes ; la seule source lumineuse devrait être la lune ; davantage d'ombre dans les sections sans
lumière »). PROPOSITION, rien n'est en jeu.

- Murs de CRAIE (direction A) : grands blocs ; ils suivent le mur (assises couchées le long d'un mur horizontal,
  debout le long d'un mur vertical) ; aux angles, T et X les assises se croisent EN HARPE (une longue pierre, puis
  deux courtes), sans pilier. Plus aucun croissant gravé.
- ALCÔVES D'OSSUAIRE : des tronçons entiers de mur (3 à 5 cases) creusés en une large niche remplie de crânes empilés et
  d'os longs ; les os restent dans le mur, rien ne déborde au sol.
- Sol : dalles en losange bleu nuit (direction A), sans gravure ; BRUME violette qui rampe au sol (direction C).
- LUMIÈRE : seulement les PUITS DE LUNE (la lumière tombe d'en haut, aucune forme de lune dessinée) ; elle ne passe pas
  les murs ; ailleurs, l'ombre presque noire.

  python3 art/ossuaire_da_v2.py   → art/ossuaire_da_v2.png
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
ALCOVES = [(2, 0, 5), (10, 0, 16), (13, 6, 18)]  # tronçons de mur creusés : (x début, rangée, x fin), face au sud
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
                        # Harpe : une longue pierre (haut), puis deux courtes (bas), sans pilier.
                        if ly < 8:
                            bid, a, b = (cx * 7 + 3, cy * 5 + 2000), lx, ly
                            jnt, hi, sh = lx == 0 or ly == 0, ly == 1 and lx > 0, ly == 7 or lx == 15
                        else:
                            bid, a, b = (cx * 7 + lx // 8, cy * 5 + 3000), lx % 8, ly - 8
                            jnt, hi, sh = a == 0 or b == 0, b == 1 and a > 0, b == 7 or a == 7
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


def alcove(a, x0, row, x1):
    """Large alcôve d'ossuaire creusée dans un tronçon de mur : linteau et jambages de craie, crânes empilés et os."""
    X0, X1 = x0 * T + 3, (x1 + 1) * T - 3
    Y0, Y1 = row * T + 2, (row + 1) * T
    a[Y0:Y1, X0:X1] = RECESS
    # Deux rangées de crânes serrés (5 × 5), la seconde décalée ; des os longs coincés entre eux.
    for (sy, off) in ((Y0 + 1, 0), (Y0 + 6, 3)):
        for sx in range(X0 + 1 + off, X1 - 5, 6):
            if hash2(sx, sy, 77) < 0.07:
                continue  # un crâne manque : on voit le noir derrière
            shade = 0.8 + 0.25 * hash2(sx, sy, 78)
            for dy in range(5):
                for dx in range(5):
                    if (dy == 0 and dx in (0, 4)) or (dy == 4 and dx in (0, 4)):
                        continue
                    a[sy + dy, sx + dx] = BONE * shade
            a[sy + 4, sx + 1:sx + 4] = BONE_D * shade
            a[sy + 2, sx + 1] = BONE_S
            a[sy + 2, sx + 3] = BONE_S
            a[sy + 3, sx + 2] = BONE_S * 1.4
            a[sy + 1, sx + 1] = np.minimum(BONE * shade * 1.12, 255)
            # un os long en travers, juste à droite
            if hash2(sx, sy, 79) < 0.5:
                a[sy + 2, sx + 5] = BONE_D
    # bord inférieur : un fémur couché au pied de l'alcôve, dans le mur
    for X in range(X0 + 1, X1 - 1):
        if (X - X0) % 9 < 8:
            a[Y1 - 2, X] = BONE_D
            a[Y1 - 1, X] = BONE_S
    # liseré sombre du creux
    a[Y0, X0:X1] = (12, 10, 16)
    a[Y0:Y1, X0] = (12, 10, 16)
    a[Y0:Y1, X1 - 1] = (12, 10, 16)


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
        for _ in range(6):
            vis = (vis + np.roll(vis, 3, 0) + np.roll(vis, -3, 0) + np.roll(vis, 3, 1) + np.roll(vis, -3, 1)) / 5
        cell_lit[:] = 0
        d = np.hypot(xs - mx * T, (ys - my * T) / 0.85) / T
        pool = np.clip(1.2 - d / 1.8, 0, 1)  # la flaque de lune au sol
        spill = np.clip(1 - d / 8.0, 0, 1) ** 1.3 * 0.75  # la lumière qui se répand dans la salle
        yield (np.maximum(pool, spill) * vis * f, pool * f)


def main_room():
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
    for (x0, row, x1) in ALCOVES:
        alcove(a, x0, row, x1)
    for s in SARCOS:
        sarcophagus(a, *s)
    # lumière
    L = np.full((H, W), 0.08)
    pools = np.zeros((H, W))
    for lit, pool in light_map(xs, ys):
        L = np.maximum(L, 0.08 + lit * 1.45 + pool * 0.5)
        pools = np.maximum(pools, pool)
    tint = np.array((0.8, 0.9, 1.12))
    a = a * L[..., None] * tint
    # brume (direction C) : nappes lentes au sol ; elle s'éclaire dans la lune et se perd dans le noir
    f = fbm(xs, ys * 2.2, 40, 7, 2)
    dens = np.clip((f - 0.38) * 2.0, 0, 1) * fl
    band = (np.round(dens * 3) / 3) * 0.42
    band = band * np.clip(0.25 + L, 0, 1)
    fogc = np.array((150, 116, 196))[None, None, :] * (0.1 + 0.8 * L[..., None])
    a = a * (1 - band[..., None]) + fogc * band[..., None]
    # poussière qui flotte dans les colonnes de lune
    motes = (hash2(xs.astype(int), ys.astype(int), 99) > 0.993) & (pools > 0.35)
    a[motes] = (235, 240, 255)
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def main():
    S = 3
    room = up(main_room(), S)
    pad = 24
    Z = 6
    crops = [("Alcôve d'ossuaire", (10 * T, 0, 16 * T, 2 * T)), ("Croisement en X (harpe)", (6 * T, 4 * T, 11 * T, 8 * T)), ("T contre le pourtour", (0, 5 * T, 4 * T, 8 * T))]
    raw = main_room()
    zooms = [(n, up(raw.crop(b), 4)) for n, b in crops]
    zh = max(z.height for _, z in zooms)
    Wb = max(room.width + 2 * pad, sum(z.width for _, z in zooms) + pad * (len(zooms) + 1))
    Hb = room.height + 140 + zh
    sheet = Image.new("RGB", (Wb, Hb), (14, 12, 18))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 3 · L'OSSUAIRE · direction artistique v2 (A + brume de C)", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((Wb // 2, 54), "Craie qui suit le sens des murs, harpe aux angles, T et X · alcôves d'ossuaire · seule lumière : deux puits de lune", fill=(190, 180, 160), font=font(14, False), anchor="mm")
    sheet.paste(room, ((Wb - room.width) // 2, 80))
    x = pad
    y = 80 + room.height + 34
    for n, z in zooms:
        d.text((x, y - 24), n, fill=(240, 192, 80), font=font(16), anchor="lt")
        sheet.paste(z, (x, y))
        x += z.width + pad
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ossuaire_da_v2.png")
    sheet.save(out)
    print("art/ossuaire_da_v2.png", sheet.size)


if __name__ == "__main__":
    main()
