"""Section 2 : propositions de SOL (Thomas, 2026-11-14 : « propose un autre sol, pour ne pas être trop proche du design
de la section précédente »). Le sol en jeu (terre brun-violet, flaques, quelques dalles) rappelle trop les dalles de la
section 1. Quatre pistes, sur la même salle que la planche v5 (murs, éboulis, champignons) :

- A · Terre noire à racines : terre presque noire, un réseau de fines racines, des bouts de racines qui luisent ; aucune dalle.
- B · Pavés ronds moussus : des galets ronds serrés (pas des dalles carrées), joints pleins de mousse bleu-vert.
- C · Caillebotis de culture : des planches posées sur la boue, comme dans une vraie champignonnière.
- D · Feutre de mycélium : le sol entier est un tapis de mycélium gris-bleu, fibreux, taché de spores.

  python3 art/champi_sols_v1.py   → art/champi_sols_v1.png
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import champi_v1 as V1  # noqa: E402
import champi_v3 as V3  # noqa: E402
import champi_v4 as V4  # noqa: E402
import champi_v5 as V5  # noqa: E402
from pix import fbm, font, hash2, outline_mask, up, value_noise  # noqa: E402

T = 16


def floor_roots(xs, ys):
    n = fbm(xs, ys, 6, 901, 2)
    out = np.zeros(xs.shape + (3,))
    tones = [(22, 18, 20), (28, 23, 25), (34, 28, 30)]
    for i, c in enumerate(tones):
        sel = (n >= i / 3) & (n < (i + 1) / 3) if i < 2 else (n >= 2 / 3)
        out[sel] = c
    r1 = np.abs(fbm(xs, ys, 18, 902, 3) - 0.5) < 0.016
    r2 = np.abs(fbm(xs, ys, 9, 903, 2) - 0.5) < 0.012
    roots = r1 | r2
    out[roots] = (84, 60, 44)
    out[outline_mask(roots) & ~roots] *= 0.7
    tips = roots & (hash2(xs.astype(int), ys.astype(int), 904) > 0.985)
    out[tips] = (120, 255, 214)
    return out


def floor_cobbles(xs, ys):
    """Galets ronds : cellules de Voronoï sur une grille de 7 pixels, bords arrondis, mousse dans les joints."""
    cell = 7
    gx, gy = (xs // cell).astype(int), (ys // cell).astype(int)
    best = np.full(xs.shape, 1e9)
    second = np.full(xs.shape, 1e9)
    seedv = np.zeros(xs.shape)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            cx, cy = gx + dx, gy + dy
            px = (cx + 0.2 + 0.6 * hash2(cx, cy, 911)) * cell
            py = (cy + 0.2 + 0.6 * hash2(cx, cy, 912)) * cell
            d = np.hypot(xs - px, ys - py)
            closer = d < best
            second = np.where(closer, best, np.minimum(second, d))
            seedv = np.where(closer, hash2(cx, cy, 913), seedv)
            best = np.where(closer, d, best)
    edge = second - best
    base = np.array((60, 56, 70))[None, None, :] * (0.8 + 0.35 * seedv)[..., None]
    shade = np.clip(1.15 - best / cell, 0.75, 1.15)
    out = base * shade[..., None]
    joint = edge < 1.4
    out[joint] = (22, 20, 26)
    moss = joint & (fbm(xs, ys, 10, 914, 2) > 0.5)
    out[moss] = (40, 110, 96)
    out[moss & (hash2(xs.astype(int), ys.astype(int), 915) > 0.9)] = (90, 200, 170)
    return out


def floor_boards(xs, ys):
    """Caillebotis : planches de 4 pixels, en travées de 3 cases, posées sur une boue sombre (visible entre les travées)."""
    mud = np.zeros(xs.shape + (3,))
    mud[:] = (30, 24, 24)
    mud[fbm(xs, ys, 8, 921, 2) > 0.55] = (40, 32, 30)
    lane = ((ys // T).astype(int) % 3) != 2
    plank = (ys.astype(int) % 4)
    board_id = (ys // 4).astype(int) * 7 + ((xs + (ys // 4) * 13) // 24).astype(int)
    tint = 0.8 + 0.3 * hash2(board_id, board_id * 3, 922)
    out = np.array((96, 72, 50))[None, None, :] * tint[..., None]
    out[plank == 0] = (48, 34, 26)
    out[plank == 1] *= 1.15
    ends = ((xs + (ys // 4) * 13).astype(int) % 24) == 0
    out[ends] = (48, 34, 26)
    rot = fbm(xs, ys, 12, 923, 2) > 0.66
    out[rot] = out[rot] * 0.6 + np.array((60, 80, 56)) * 0.4
    nail = (((xs + (ys // 4) * 13).astype(int) % 24) == 2) & (plank == 2)
    out[nail] = (150, 150, 160)
    return np.where(lane[..., None], out, mud)


def floor_felt(xs, ys):
    """Feutre de mycélium : fibres gris-bleu entrecroisées, taches plus sombres, spores lumineuses."""
    n = fbm(xs, ys, 5, 931, 3)
    out = np.array((70, 76, 88))[None, None, :] * (0.75 + 0.5 * n)[..., None]
    f1 = ((xs + ys * 0.5 + 6 * value_noise(xs, ys, 6, 932)).astype(int) % 5) == 0
    f2 = ((xs * 0.4 - ys + 6 * value_noise(xs, ys, 7, 933)).astype(int) % 6) == 0
    out[f1 | f2] *= 1.22
    dark = fbm(xs, ys, 24, 934, 2) < 0.36
    out[dark] *= 0.6
    spores = hash2(xs.astype(int), ys.astype(int), 935) > 0.992
    out[spores] = (150, 255, 220)
    return out


OPTIONS = [("A · Terre noire à racines", floor_roots), ("B · Pavés ronds moussus", floor_cobbles),
           ("C · Caillebotis de culture", floor_boards), ("D · Feutre de mycélium", floor_felt)]


def main():
    V3.PRE_HOOK = lambda a, xs, ys, wm: V4.worn_walls(a, xs, ys, wm)
    V3.HOOK = V5.displaced_stones
    V3.FALLEN_BRICKS = False
    rooms = []
    for name, fn in OPTIONS:
        V1.floor_C = fn
        rooms.append((name, up(V3.room(), 2)))
    pad = 24
    rw, rh = rooms[0][1].size
    Wb = pad + 2 * (rw + pad)
    Hb = 80 + 2 * (rh + 44)
    sheet = Image.new("RGB", (Wb, Hb), (22, 18, 14))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 2 · PROPOSITIONS DE SOL (pour s'éloigner des dalles de la section 1)", fill=(255, 243, 200), font=font(20), anchor="mm")
    d.text((Wb // 2, 52), "Même salle que la v5 : seuls changent le sol et la lumière qui s'y pose", fill=(190, 180, 160), font=font(13, False), anchor="mm")
    for i, (name, im) in enumerate(rooms):
        x = pad + (i % 2) * (rw + pad)
        y = 70 + (i // 2) * (rh + 44)
        d.text((x, y + 4), name, fill=(240, 192, 80), font=font(18), anchor="lt")
        sheet.paste(im, (x, y + 30))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "champi_sols_v1.png")
    sheet.save(out)
    print("art/champi_sols_v1.png", sheet.size)


if __name__ == "__main__":
    main()
