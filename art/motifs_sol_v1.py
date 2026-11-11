"""Motifs au sol, v1 (Thomas, 2026-11-11 : « Propose des motifs qu'on peut mettre dans le sol aléatoirement. Rosace ou
autre »).

Des dalles gravées ou incrustées, posées au hasard dans le sol B (validé), usées et à moitié mangées par la même
poussière que le sol : on les DEVINE, elles ne crient pas. Six propositions, de 1 ou 2 × 2 cases. Purement décoratives
(on marche dessus). Écrit art/motifs_sol_v1.png. Lancer depuis la racine du dépôt.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
from pix import hash2, fbm, value_noise, grid, to_img, up, font
from sols_v1 import floor_b

GROOVE = np.array((30, 26, 38))       # trait gravé (creux sombre)
LIP = np.array((104, 98, 126))        # arête claire du trait
INLAY = np.array((122, 96, 58))       # incrustation de laiton terni
INLAY_HI = np.array((168, 136, 76))
STONE_LIGHT = np.array((86, 80, 104))  # dalle plus claire du motif


def stamp(base, xs, ys, ox, oy, size, draw):
    """Grave un motif (fonction `draw(u, v)` → 0 rien, 1 creux, 2 laiton, 3 dalle claire) dans un carré de `size` pixels
    en (ox, oy). Usure : la poussière du sol B recouvre une partie du motif, et le trait se perd par endroits."""
    out = base.copy()
    dust = fbm(xs, ys, 36, 51, 2) + 0.2 * (value_noise(xs, ys, 3, 52) - 0.5)
    # Une seule grande dalle sous le motif (pas de joints qui le coupent), un peu plus claire, avec son joint autour ;
    # la poussière la recouvre un peu sur les bords.
    for y in range(size):
        for x in range(size):
            px, py = ox + x, oy + y
            if dust[py, px] < 0.36:
                continue
            edge = x == 0 or y == 0
            tint = 0.95 + 0.1 * float(value_noise(px, py, 6, 79))
            out[py, px] = (STONE_LIGHT * 0.85 * tint) if not edge else (30, 26, 38)
            if (x == 1 or y == 1) and not edge:
                out[py, px] = LIP
    for y in range(size):
        for x in range(size):
            px, py = ox + x, oy + y
            u, v = (x + 0.5) / size * 2 - 1, (y + 0.5) / size * 2 - 1
            k = draw(u, v)
            if not k:
                continue
            worn = dust[py, px] < 0.36 or hash2(px, py, 77) > 0.94
            if worn and k not in (3, 4):
                continue
            if k == 3:
                out[py, px] = out[py, px] * 0.5 + STONE_LIGHT * 0.5
            elif k == 4:
                out[py, px] = out[py, px] * 0.62
            elif k == 1:
                out[py, px] = GROOVE
                if py + 1 < out.shape[0]:
                    out[py + 1, px] = np.maximum(out[py + 1, px], LIP * 0.9)
            else:
                out[py, px] = INLAY_HI if hash2(px, py, 78) > 0.75 else INLAY
    return out


def ring(r, w):
    return lambda u, v: abs(math.hypot(u, v) - r) < w


def rosace(u, v):
    """Rosace : huit pétales en amande autour d'un cœur de laiton, dans un double cercle."""
    r, a = math.hypot(u, v), math.atan2(v, u)
    if abs(r - 0.9) < 0.05 or abs(r - 0.78) < 0.04:
        return 1
    if r < 0.14:
        return 2
    if r < 0.74:
        # Pétale : contour d'une amande le long de chaque direction (8 directions).
        k = (a / (math.pi / 4)) % 1.0
        d = min(k, 1 - k)  # 0 au milieu du pétale, 0,5 entre deux pétales
        width = 0.5 * math.sin(math.pi * min(1.0, max(0.0, (r - 0.16) / 0.58)))
        if abs(d - width * 0.5) < 0.05 and r > 0.18:
            return 1
    return 0


def boussole(u, v):
    """Étoile à quatre branches (rose des vents) en laiton, dans un cercle gravé."""
    r = math.hypot(u, v)
    if abs(r - 0.9) < 0.06:
        return 1
    au, av = abs(u), abs(v)
    if (au < 0.12 * (1 - av / 0.85) and av < 0.85) or (av < 0.12 * (1 - au / 0.85) and au < 0.85):
        return 2
    if abs(au - av) < 0.05 and r < 0.5:
        return 1
    return 0


def runes(u, v):
    """Cercle de runes : deux anneaux et de petits signes entre eux (sceau oublié)."""
    r, a = math.hypot(u, v), math.atan2(v, u)
    if abs(r - 0.92) < 0.05 or abs(r - 0.62) < 0.05:
        return 1
    if 0.68 < r < 0.86:
        seg = (a + math.pi) / (2 * math.pi) * 10
        if abs(seg - round(seg)) < 0.1 or (int(seg) % 2 == 0 and abs(r - 0.77) < 0.03):
            return 1
    if r < 0.3 and abs(abs(u) - abs(v)) < 0.05:
        return 1
    return 0


def damier(u, v):
    """Petit damier de dalles claires et sombres, bordé (une seule case)."""
    if max(abs(u), abs(v)) > 0.88:
        return 1
    return 4 if (int((u + 1) * 2) + int((v + 1) * 2)) % 2 == 0 else 0


def croix(u, v):
    """Croix ancrée (aux bouts élargis) dans un carré : marque de chapelle ou de tombe."""
    au, av = abs(u), abs(v)
    if max(au, av) > 0.86 and max(au, av) < 0.94:
        return 1
    if (au < 0.12 and av < 0.7) or (av < 0.12 and au < 0.7):
        return 1
    if (0.55 < av < 0.7 and au < 0.3) or (0.55 < au < 0.7 and av < 0.3):
        return 1
    return 0


def spirale(u, v):
    """Spirale gravée (labyrinthe ancien)."""
    r, a = math.hypot(u, v), math.atan2(v, u)
    if r > 0.92:
        return 0
    t = (r / 0.9) * 3.0 - (a + math.pi) / (2 * math.pi)
    return 1 if abs(t - round(t)) < 0.12 and r > 0.08 else 0


MOTIFS = [
    ("rosace (2×2)", rosace, 32),
    ("rose des vents, laiton (2×2)", boussole, 32),
    ("sceau de runes (2×2)", runes, 32),
    ("croix ancrée (1)", croix, 16),
    ("damier (1)", damier, 16),
    ("spirale (1)", spirale, 16),
]

if __name__ == "__main__":
    T = 16
    W, H = 14 * T, 6 * T
    xs, ys = grid(W, H)
    base = floor_b(xs, ys)
    spots = [(1, 1), (11, 1), (8, 1), (2, 4), (5, 4), (10, 4)]
    for (cx, cy), (label, fn, size) in zip(spots, MOTIFS):
        base = stamp(base, xs, ys, cx * T, cy * T, size, fn)
    S = 4
    big = up(to_img(base), S)
    sheet = Image.new("RGB", (big.width + 40, 60 + big.height + 40), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((sheet.width // 2, 20), "MOTIFS AU SOL v1 — gravés, usés, sous la poussière (à valider)", fill=(255, 243, 200), font=font(15), anchor="mm")
    sheet.paste(big, (20, 44))
    for (cx, cy), (label, fn, size) in zip(spots, MOTIFS):
        d.text((20 + cx * T * S, 44 + (cy * T + size) * S + 4), label, fill=(240, 220, 170), font=font(12, False))
    sheet.save("art/motifs_sol_v1.png")
    print(sheet.size)
