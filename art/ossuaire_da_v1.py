"""Section 3, l'OSSUAIRE DE LA LUNE PÂLE : direction artistique v1, PAGE BLANCHE (Thomas, 2026-11-18, 23 h 55 :
« on repart d'une page blanche pour l'esthétique, je veux une vraie personnalité, comme la section 2 qui a une DA à
part »). PROPOSITIONS, rien n'est en jeu. Brief : `claude/BRIEF_OSSUAIRE.md`.

Quatre directions, chacune avec SES murs (pas les briques v3 recolorées), son sol, sa lumière et sa couleur. Même salle
pour toutes : un puits de lune, deux cierges, un sarcophage, une niche de crânes, une colonne.
- A « Craie et lune » : murs de grands blocs de CRAIE BLANCHE (l'inverse des deux sections du dessus, aux murs sombres),
  croissants gravés ; sol de dalles en losange bleu nuit ; lumière de lune bleu-blanc, très froide.
- B « Reliquaire » : murs maçonnés d'OS (assises de tibias, une frise de crânes à hauteur d'homme) sur pierre ocre ;
  sol de terre battue et poussière d'os, rosace d'os incrustée ; lumière de cierges dorée, chaude.
- C « Brume » : murs de BASALTE noir-violet, gros blocs lisses et luisants ; dalles funéraires gravées d'argent sous une
  BRUME violette qui rampe au sol ; lune verdâtre, spectrale.
- D « Temple noir » : MARBRE violet veiné, frise de croissants D'OR ; sol de marbre poli en damier qui REFLÈTE la lune
  et les cierges ; contraste or / violet, le culte riche.

  python3 art/ossuaire_da_v1.py   → art/ossuaire_da_v1.png
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pix import fbm, font, grid, hash2, up, value_noise  # noqa: E402

T = 16
PLAN = [
    "##############",
    "#............#",
    "#............#",
    "#............#",
    "#.....o......#",
    "#............#",
    "#............#",
    "#............#",
    "##############",
]
PH, PW = len(PLAN), len(PLAN[0])
W, H = PW * T, PH * T
WALL = np.array([[PLAN[y // T][x // T] in "#o" for x in range(W)] for y in range(H)])
MOON = (8.5 * T, 4.8 * T)  # centre du puits de lune au sol (pixels)
CANDLES = [(3, 1), (11, 1)]  # cases (le cierge se tient contre le mur du haut)
SARCO = (3, 5)  # case du sarcophage (2 cases de large)
NICHE = (7, 0)  # case de mur avec la niche de crânes


def mix(a, b, t):
    return np.asarray(a, float) * (1 - t) + np.asarray(b, float) * t


# ---------------------------------------------------------------- murs


def wall_A(xs, ys):
    """Grands blocs de craie (16 × 8, assises décalées), joints fins, coups de ciseau ; croissants gravés."""
    row = (ys // 8).astype(int)
    off = (row % 2) * 8
    bx = ((xs + off) // 16).astype(int)
    lx, ly = (xs + off) % 16, ys % 8
    t = hash2(bx, row, 3)
    out = mix((196, 190, 174), (226, 220, 204), t[..., None])
    grain = fbm(xs, ys, 3, 4, 2)
    out = out * (0.93 + 0.1 * grain[..., None])
    chisel = (hash2(xs.astype(int), ys.astype(int), 5) > 0.9) & ((xs.astype(int) + ys.astype(int)) % 3 == 0)
    out[chisel] = out[chisel] * 0.86
    hi = (ly == 1) & (lx > 0)
    out[hi] = np.minimum(out[hi] * 1.07, 255)
    sh = (ly == 7) | (lx == 15)
    out[sh] = out[sh] * 0.8
    j = (ly == 0) | (lx == 0)
    out[j] = (120, 116, 112)
    # croissant gravé sur un bloc sur sept
    glyph = hash2(bx, row, 6) < 0.07
    cx, cy = lx - 8, ly - 4
    r1 = np.hypot(cx, cy)
    r2 = np.hypot(cx - 1.3, cy - 0.6)
    moon = glyph & (r1 < 3.2) & (r2 > 2.6)
    out[moon] = (128, 132, 156)
    return out


def wall_B(xs, ys):
    """Maçonnerie d'os : pierre ocre entre deux assises de gros os couchés (os à nœuds) par case."""
    out = mix((112, 90, 62), (132, 106, 74), fbm(xs, ys, 4, 11, 2)[..., None])
    ty = (ys % 16).astype(int)
    # assises de tibias : bandes de 3 px, rangées 1-3 et 12-14 de chaque case
    for top in (0, 10):
        band = (ty >= top) & (ty < top + 6)
        k = (top * 5)
        seg = ((xs + k) // 12).astype(int)
        lx = ((xs + k) % 12).astype(int)
        ry = ty - top  # 0..5
        shaft = band & (lx >= 2) & (lx <= 9) & (ry >= 2) & (ry <= 3)
        knob = band & ((lx <= 2) | (lx >= 9)) & (ry >= 1) & (ry <= 4) & ~(((lx == 0) | (lx == 11)) & ((ry == 1) | (ry == 4)))
        bone = shaft | knob
        tone = 0.85 + 0.25 * hash2(seg, (ys // 16).astype(int) * 2 + (top > 5), 12)
        col = np.array((214, 198, 162)) * tone[..., None]
        out[band & ~bone] = (46, 34, 24)
        out[bone] = col[bone]
        lit = bone & ((ry == 1) | ((ry == 2) & shaft & ~knob))
        out[lit] = np.minimum(out[lit] * 1.1, 255)
        dim = bone & (ry == 4)
        out[dim] = out[dim] * 0.75
    return out


def wall_C(xs, ys):
    """Basalte : gros blocs lisses noir-violet, arêtes luisantes, quelques coulures d'argent."""
    row = (ys // 16).astype(int)
    off = (row % 2) * 10
    bx = ((xs + off) // 20).astype(int)
    lx, ly = (xs + off) % 20, ys % 16
    t = hash2(bx, row, 21)
    out = mix((34, 30, 44), (48, 42, 60), t[..., None])
    sheen = np.clip(1 - np.abs((lx - ly * 1.2) - 6) / 3, 0, 1) * (hash2(bx, row, 22) > 0.4)
    out = out + sheen[..., None] * np.array((26, 24, 40))
    hi = ((ly == 1) | (lx == 1)) & (lx > 0) & (ly > 0)
    out[hi] = (84, 78, 108)
    j = (ly == 0) | (lx == 0)
    out[j] = (12, 10, 16)
    drip = (hash2((xs // 3).astype(int), row, 23) < 0.08) & (ly > 1) & (ly < 4 + 8 * hash2((xs // 3).astype(int), row, 24)) & (xs.astype(int) % 3 == 1)
    out[drip] = (120, 128, 140)
    return out


def wall_D(xs, ys):
    """Marbre violet veiné en grandes plaques, frise de croissants d'or à hauteur d'homme."""
    row = (ys // 16).astype(int)
    bx = ((xs + (row % 2) * 16) // 32).astype(int)
    lx, ly = (xs + (row % 2) * 16) % 32, ys % 16
    base = mix((70, 58, 92), (86, 72, 110), hash2(bx, row, 31)[..., None])
    v = fbm(xs + ys * 0.7, ys, 10, 32, 3)
    vein = np.abs(v - 0.5) < 0.012
    base[vein] = (176, 164, 200)
    vein2 = np.abs(fbm(xs, ys + xs * 0.4, 7, 33, 2) - 0.5) < 0.015
    base[vein2] = (128, 116, 152)
    j = (lx == 0) | (ly == 0)
    base[j] = (30, 24, 40)
    # frise d'or : rangées 10-13, un croissant tous les 8 px
    fr = (ly >= 10) & (ly <= 13)
    base[fr] = (52, 40, 66)
    base[fr & ((ly == 10) | (ly == 13))] = (196, 156, 62)
    cx, cy = (xs % 8) - 3.5, ly - 11.5
    moon = fr & (np.hypot(cx, cy) < 1.9) & (np.hypot(cx - 0.9, cy - 0.4) > 1.4)
    base[moon] = (242, 204, 98)
    return base


# ---------------------------------------------------------------- sols


def floor_A(xs, ys):
    """Dalles en losange bleu nuit, joints sombres, poussière d'os claire, croissant gravé ici et là."""
    u, v = (xs + ys) / 16, (xs - ys) / 16
    cu, cv = np.floor(u).astype(int), np.floor(v).astype(int)
    fu, fv = u - cu, v - cv
    t = hash2(cu, cv, 41)
    out = mix((40, 42, 66), (52, 54, 82), t[..., None])
    j = (fu < 0.07) | (fv < 0.07)
    out[j] = (20, 20, 34)
    hi = ((fu < 0.13) | (fv < 0.13)) & ~j
    out[hi] = out[hi] * 1.18
    glyph = (hash2(cu, cv, 42) < 0.06) & (np.abs(np.hypot(fu - 0.5, fv - 0.5) - 0.22) < 0.05) & (fu < 0.6)
    out[glyph] = (92, 98, 132)
    dust = (fbm(xs, ys, 20, 43, 2) > 0.66) & (hash2(xs.astype(int), ys.astype(int), 44) > 0.93)
    out[dust] = (110, 110, 124)
    return out


def floor_B(xs, ys):
    """Terre battue ocre, poussière d'os, petits éclats ; rosace d'os incrustée autour du puits de lune."""
    n = fbm(xs, ys, 6, 51, 2)
    out = mix((82, 62, 44), (104, 80, 56), n[..., None])
    chips = hash2(xs.astype(int), ys.astype(int), 52) > 0.95
    out[chips] = (186, 168, 136)
    dust = fbm(xs, ys, 24, 53, 2) > 0.62
    out[dust] = out[dust] * 1.12
    r = np.hypot(xs - MOON[0], (ys - MOON[1]) * 1.0) / T
    ang = np.arctan2(ys - MOON[1], xs - MOON[0])
    ring = (np.abs(r - 2.1) < 0.12) | ((np.abs(r - 1.55) < 0.09) & (np.cos(ang * 12) > 0.2))
    out[ring] = (204, 186, 150)
    spokes = (r > 1.6) & (r < 2.05) & (np.abs(np.sin(ang * 8)) < 0.12)
    out[spokes] = (190, 172, 138)
    return out


def floor_C(xs, ys):
    """Dalles funéraires noires 16 × 16, certaines gravées de lignes d'argent (inscriptions)."""
    cx, cy = (xs // 16).astype(int), (ys // 16).astype(int)
    lx, ly = xs % 16, ys % 16
    out = mix((26, 24, 32), (36, 34, 44), hash2(cx, cy, 61)[..., None])
    j = (lx == 0) | (ly == 0)
    out[j] = (10, 10, 14)
    tomb = hash2(cx, cy, 62) < 0.14
    lines = tomb & (lx > 3) & (lx < 13) & ((ly == 5) | (ly == 8) | (ly == 11)) & (hash2(xs.astype(int), cy * 3 + (ly // 3).astype(int), 63) > 0.25)
    out[lines] = (132, 138, 150)
    frame = tomb & ((lx == 2) | (lx == 13) | (ly == 2) | (ly == 13)) & (lx >= 2) & (lx <= 13) & (ly >= 2) & (ly <= 13)
    out[frame] = (70, 72, 84)
    return out


def floor_D(xs, ys):
    """Marbre poli en damier noir / violet, veiné ; il brille (le reflet est ajouté avec la lumière)."""
    cx, cy = (xs // 16).astype(int), (ys // 16).astype(int)
    dark = (cx + cy) % 2 == 0
    out = np.where(dark[..., None], np.array((30, 26, 40), float), np.array((52, 44, 68), float)) * np.ones((1, 1, 3))
    vein = np.abs(fbm(xs + ys * 0.6, ys, 14, 71, 2) - 0.5) < 0.012
    out[vein] = out[vein] + 26
    j = ((xs % 16) == 0) | ((ys % 16) == 0)
    out[j] = (14, 12, 18)
    return out


# ---------------------------------------------------------------- décors


def candle(px, cx, cy, wax, flame):
    """Cierge debout contre le mur du haut : 3 × 8, coulures, flamme."""
    x0, y0 = cx * T + 6, cy * T + 4
    for y in range(y0, y0 + 9):
        for x in range(x0, x0 + 4):
            px[x, y] = tuple(int(c * (0.8 if x == x0 + 3 else 1)) for c in wax)
    px[x0, y0 + 3] = tuple(int(min(255, c * 1.2)) for c in wax)
    for x in range(x0 - 1, x0 + 5):
        px[x, y0 + 9] = (20, 16, 20)
    px[x0 + 1, y0 - 1] = flame
    px[x0 + 2, y0 - 1] = flame
    px[x0 + 1, y0 - 2] = (255, 248, 220)
    px[x0 + 2, y0 - 3] = flame


def sarcophagus(px, cx, cy, stone, dark, accent):
    """Sarcophage de 2 cases, couvercle à arête, un motif au milieu."""
    x0, y0 = cx * T + 1, cy * T + 2
    w, h = 2 * T - 2, T - 2
    for y in range(y0, y0 + h):
        for x in range(x0, x0 + w):
            edge = x in (x0, x0 + w - 1) or y in (y0, y0 + h - 1)
            lid = y < y0 + 8
            c = dark if edge else (tuple(min(255, int(v * 1.12)) for v in stone) if lid else stone)
            if y == y0 + 4 and not edge:
                c = tuple(int(v * 0.85) for v in stone)
            px[x, y] = c
    mx = x0 + w // 2
    for dx, dy in ((0, 2), (-1, 3), (1, 3), (0, 4), (-2, 5), (2, 5), (0, 6)):
        px[mx + dx, y0 + dy] = accent


def niche(px, cx, cy, back, bone, dark):
    """Niche creusée dans le mur du haut, trois crânes dedans."""
    x0, y0 = cx * T + 1, cy * T + 2
    for y in range(y0, y0 + 14):
        for x in range(x0, x0 + 14):
            arch = y - y0 < 3 and min(x - x0, x0 + 13 - x) < 3 - (y - y0)
            if arch:
                continue
            px[x, y] = dark if (x in (x0, x0 + 13) or y == y0 or (y - y0 < 4 and min(x - x0, x0 + 13 - x) == 3 - (y - y0))) else back
    for k in range(3):
        sx, sy = x0 + 1 + k * 4, y0 + 7
        for y in range(sy, sy + 5):
            for x in range(sx, sx + 4):
                if (y == sy and x in (sx, sx + 3)) or (y == sy + 4 and x in (sx, sx + 3)):
                    continue
                px[x, y] = bone
        px[sx, sy + 2] = dark
        px[sx + 3, sy + 2] = dark
        px[sx + 1, sy + 3] = tuple(int(c * 0.7) for c in bone)


def column(px, cx, cy, wall_fn):
    """La colonne : un bloc du mur de la direction, avec un liseré."""
    pass  # dessinée par le mur lui-même (case « o » du plan)


STYLES = {
    "A": dict(wall=wall_A, floor=floor_A, base=0.5, moon=(0.86, 0.94, 1.12), moonA=1.0, candle=(1.0, 0.9, 1.1),
              wax=(150, 110, 190), flame=(255, 214, 120), stone=(176, 172, 162), sdark=(80, 78, 90), accent=(96, 104, 150),
              nback=(60, 58, 70), bone=(232, 226, 210), ndark=(34, 32, 44), tint=(0.82, 0.88, 1.08), fog=None,
              title="A · Craie et lune", sub="Murs de craie blanche, dalles bleu nuit, lune très froide"),
    "B": dict(wall=wall_B, floor=floor_B, base=0.42, moon=(1.0, 0.98, 0.92), moonA=1.0, candle=(1.25, 1.0, 0.62),
              wax=(150, 110, 190), flame=(255, 200, 90), stone=(150, 128, 96), sdark=(60, 44, 30), accent=(222, 206, 166),
              nback=(44, 32, 22), bone=(226, 212, 176), ndark=(30, 20, 14), tint=(1.05, 0.92, 0.74), fog=None,
              title="B · Reliquaire", sub="Murs maçonnés d'os, terre ocre, rosace d'os, lumière dorée"),
    "C": dict(wall=wall_C, floor=floor_C, base=0.55, moon=(0.78, 1.08, 0.98), moonA=1.1, candle=(1.0, 0.85, 1.15),
              wax=(150, 110, 190), flame=(200, 255, 220), stone=(58, 54, 70), sdark=(16, 14, 22), accent=(150, 156, 170),
              nback=(18, 16, 24), bone=(196, 200, 196), ndark=(8, 8, 12), tint=(0.86, 0.9, 1.0), fog=(150, 110, 190),
              title="C · Brume", sub="Basalte noir, dalles gravées d'argent, brume violette au sol, lune spectrale"),
    "D": dict(wall=wall_D, floor=floor_D, base=0.48, moon=(0.94, 0.94, 1.1), moonA=1.0, candle=(1.2, 0.95, 0.7),
              wax=(236, 228, 214), flame=(255, 210, 110), stone=(96, 82, 120), sdark=(36, 28, 48), accent=(236, 196, 92),
              nback=(34, 26, 44), bone=(226, 218, 200), ndark=(20, 14, 28), tint=(0.92, 0.88, 1.06), fog=None, mirror=True,
              title="D · Temple noir", sub="Marbre violet, frise d'or, sol poli qui reflète la lune et les cierges"),
}


def room(key):
    s = STYLES[key]
    xs, ys = grid(W, H)
    wall = s["wall"](xs, ys)
    floor = s["floor"](xs, ys)
    a = np.where(WALL[..., None], wall, floor)
    # Roche derrière les murs (pas de sol à côté) : noire.
    near = np.zeros((PH, PW), bool)
    for y in range(PH):
        for x in range(PW):
            near[y, x] = any(0 <= y + dy < PH and 0 <= x + dx < PW and PLAN[y + dy][x + dx] == "." for dy in (-1, 0, 1) for dx in (-1, 0, 1))
    rock = np.array([[not near[y // T, x // T] for x in range(W)] for y in range(H)])
    a[rock] = (6, 5, 8)
    # Un liseré sombre là où le mur touche le sol : on lit la forme des murs et de la colonne.
    fl = ~WALL
    edge = WALL & (np.roll(fl, 1, 0) | np.roll(fl, -1, 0) | np.roll(fl, 1, 1) | np.roll(fl, -1, 1))
    a[edge] = a[edge] * 0.45
    # Ombre portée de la colonne vers le bas.
    oy, ox = 4 * T, 6 * T
    a[oy + T:oy + T + 5, ox:ox + T] *= 0.6
    # Ombre portée du mur du haut sur le sol (3/4 : les murs sont hauts).
    shade = np.ones((H, W))
    for y in range(T, T + 6):
        shade[y, :] *= 0.55 + 0.075 * (y - T)
    a = a * shade[..., None]
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")
    px = img.load()
    niche(px, *NICHE, s["nback"], s["bone"], s["ndark"])
    sarcophagus(px, *SARCO, s["stone"], s["sdark"], s["accent"])
    for c in CANDLES:
        candle(px, *c, s["wax"], s["flame"])
    a = np.asarray(img).astype(float)

    # ---------------- lumière
    light = np.full((H, W), s["base"])
    col = np.ones((H, W, 3)) * np.array(s["tint"])
    # Puits de lune : un disque au sol et un rayon qui tombe d'en haut (vers le haut-gauche).
    d = np.hypot((xs - MOON[0]) / T, (ys - MOON[1]) / T / 0.8)
    disc = np.clip(1.25 - d / 1.6, 0, 1) * s["moonA"]
    beam_x = MOON[0] + (ys - MOON[1]) * 0.35
    beam = np.clip(1 - np.abs(xs - beam_x) / (T * 1.3), 0, 1) * (ys < MOON[1]) * 0.45 * s["moonA"]
    m = np.maximum(disc, beam)
    light = np.maximum(light, light + m * 0.9)
    col = col * (1 - m[..., None] * 0.6) + np.array(s["moon"]) * m[..., None] * 0.6
    # Poussière dans le rayon
    motes = (hash2(xs.astype(int), ys.astype(int), 99) > 0.994) & (m > 0.3)
    # Cierges
    for (cx, cy) in CANDLES:
        dd = np.hypot(xs - (cx * T + 8), ys - (cy * T + 3)) / T
        g = np.clip(1 - dd / 3.2, 0, 1) ** 1.5
        light = light + g * 0.7
        col = col * (1 - g[..., None] * 0.5) + np.array(s["candle"]) * g[..., None] * 0.5
    a = a * light[..., None] * col
    if s.get("mirror"):
        # Sol poli : reflet vertical (vers le bas) du puits et des flammes.
        fl = ~WALL
        refl = np.zeros((H, W))
        for (cx, cy) in CANDLES:
            fx = cx * T + 8
            refl += np.clip(1 - np.abs(xs - fx) / 2.5, 0, 1) * np.clip(1 - np.abs(ys - (cy * T + 26)) / 14, 0, 1)
        refl += np.clip(1 - np.abs(xs - MOON[0]) / 10, 0, 1) * np.clip(1 - np.abs(ys - (MOON[1] + 30)) / 16, 0, 1) * 0.6
        streak = (ys.astype(int) % 2 == 0)
        a = a + (refl * fl * streak)[..., None] * np.array((150, 130, 110))
    a[motes] = (235, 240, 255)
    if s["fog"] is not None:
        # Brume qui rampe : nappes lentes, plus épaisses au sol loin des murs du haut, sous les objets hauts.
        f = fbm(xs, ys * 2.2, 40, 7, 2)
        dens = np.clip((f - 0.38) * 2.0, 0, 1) * (~WALL) * np.clip((ys - T * 1.5) / (T * 3), 0, 1)
        band = (np.round(dens * 3) / 3) * 0.38
        a = a * (1 - band[..., None]) + np.array(s["fog"]) * band[..., None]
        edge = (np.abs(dens - 0.5) < 0.03)
        a[edge] = a[edge] * 0.9 + np.array((200, 170, 230)) * 0.1
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def main():
    S = 3
    rooms = {k: up(room(k), S) for k in "ABCD"}
    rw, rh = rooms["A"].size
    pad = 24
    Wb = pad + 2 * (rw + pad)
    Hb = 80 + 2 * (rh + 64)
    sheet = Image.new("RGB", (Wb, Hb), (18, 15, 20))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 3 · L'OSSUAIRE DE LA LUNE PÂLE · direction artistique v1", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((Wb // 2, 52), "Même salle pour les 4 : puits de lune, 2 cierges, sarcophage, niche de crânes, colonne", fill=(190, 180, 160), font=font(14, False), anchor="mm")
    for i, k in enumerate("ABCD"):
        x = pad + (i % 2) * (rw + pad)
        y = 80 + (i // 2) * (rh + 64)
        d.text((x, y + 2), STYLES[k]["title"], fill=(240, 192, 80), font=font(20), anchor="lt")
        d.text((x, y + 26), STYLES[k]["sub"], fill=(200, 190, 170), font=font(13, False), anchor="lt")
        sheet.paste(rooms[k], (x, y + 46))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "ossuaire_da_v1.png")
    sheet.save(out)
    print("art/ossuaire_da_v1.png", sheet.size)


if __name__ == "__main__":
    main()
