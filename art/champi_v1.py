"""Section 2, la CHAMPIGNONNIÈRE : ambiance v1 (Thomas, 2026-11-14 : « commence à drafter le sol, les murs et les décors
simples ; propose plusieurs options ; je propose des pierres un peu plus sombres, dans le même esprit que la section du
dessus »). PROPOSITIONS, rien n'est en jeu. Brief : `claude/BRIEF_CHAMPIGNONNIERE.md`.

Quatre options de sol + murs, dessinées sur la même petite salle, puis les décors simples :
- A « Pierre sombre » (l'idée de Thomas) : les murs v3 de la section 1, pierres plus sombres et plus froides, joints
  presque noirs ; sol de dalles sombres sous une terre humide ; des filaments blancs de mycélium au lieu de la mousse.
- B « Terre humide » : le sol A de la planche des sols (terre battue où affleurent des dalles), plus sombre et mouillé ;
  murs sombres, mycélium épais qui descend des joints.
- C « Roche suintante » : pierres sombres tirant sur le brun-violet, coulures d'humidité sous les joints ; sol de terre
  et de flaques, quelques dalles.
- D « Pierre et lueurs » : comme A, avec des points lumineux bleu-vert dans les joints du mur et un tapis de mycélium au sol.

Décors simples : champignon lumineux (ouvert, refermé), touffe de petits champignons, filaments au mur, goutte qui
tombe, flaque, racine, grand chapeau (remplace la colonne).

  python3 art/champi_v1.py   → art/champi_v1.png
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import murs_v3 as M  # noqa: E402
from pix import fbm, font, grid, hash2, outline_mask, up, value_noise  # noqa: E402
from dortoir_v2 import Sprite  # noqa: E402

T = 16
PLAN = [
    "##############",
    "#............#",
    "#............#",
    "#..##........#",
    "#..##........#",
    "#.......#....#",
    "#............#",
    "#............#",
    "##############",
]

# ---------------------------------------------------------------- sols


def earth(xs, ys, seed, tones):
    n = fbm(xs, ys, 6, seed, 2)
    out = np.zeros(xs.shape + (3,))
    for i, c in enumerate(tones):
        sel = (n >= i / 3) & (n < (i + 1) / 3) if i < 2 else (n >= 2 / 3)
        out[sel] = c
    grain = hash2(xs.astype(int), ys.astype(int), seed + 5) > 0.93
    out[grain] = out[grain] * 0.75
    return out


def slabs(xs, ys, seed, stone, hi, joint):
    cx, cy = (xs // T).astype(int), (ys // T).astype(int)
    lx, ly = xs % T, ys % T
    tint = 0.88 + 0.2 * hash2(cx, cy, seed)
    out = np.array(stone, float)[None, None, :] * tint[..., None]
    h = ((lx == 1) | (ly == 1)) & (lx > 0) & (ly > 0)
    out[h] = np.array(hi) * tint[h][..., None]
    worn = fbm(xs, ys, 5, seed + 9, 2) > 0.62
    out[worn] = out[worn] * 0.88
    j = (lx == 0) | (ly == 0)
    out[j] = joint
    crack = (hash2(cx, cy, seed + 3) < 0.14) & (np.abs((lx - ly * (0.6 + hash2(cx, cy, seed + 4)))) < 0.6) & (lx > 3) & (lx < 13)
    out[crack] = joint
    return out


WET_EARTH = [(34, 32, 36), (40, 38, 42), (47, 44, 48)]
DARK_STONE, DARK_HI, DARK_JOINT = (52, 52, 66), (64, 64, 80), (20, 18, 26)


def floor_A(xs, ys):
    """Dalles sombres, une terre humide les recouvre par plaques ; quelques reflets mouillés."""
    out = slabs(xs, ys, 41, DARK_STONE, DARK_HI, DARK_JOINT)
    dust = fbm(xs, ys, 36, 51, 2) + 0.2 * (value_noise(xs, ys, 3, 52) - 0.5)
    m = dust < 0.42
    out[m] = earth(xs, ys, 61, WET_EARTH)[m]
    wet = (fbm(xs, ys, 14, 71, 2) > 0.66) & (hash2(xs.astype(int), ys.astype(int), 72) > 0.6)
    out[wet] = out[wet] * 1.25
    return out


def floor_B(xs, ys):
    """Terre battue humide où affleurent des dalles aux bords rongés."""
    base = earth(xs, ys, 11, [(38, 33, 34), (45, 39, 40), (53, 46, 46)])
    show = fbm(xs, ys, 40, 21, 2) + 0.18 * (value_noise(xs, ys, 3, 22) - 0.5)
    m = show > 0.6
    out = base.copy()
    out[m] = slabs(xs, ys, 31, DARK_STONE, DARK_HI, DARK_JOINT)[m]
    edge = outline_mask(m)
    out[edge] = out[edge] * 0.65
    return out


def floor_C(xs, ys):
    """Terre brun-violet, flaques sombres qui brillent, rares dalles."""
    base = earth(xs, ys, 13, [(40, 32, 38), (48, 38, 44), (56, 45, 50)])
    show = fbm(xs, ys, 40, 23, 2)
    m = show > 0.66
    base[m] = slabs(xs, ys, 33, (58, 50, 62), (70, 62, 76), DARK_JOINT)[m]
    pud = fbm(xs, ys, 22, 91, 3) < 0.3
    base[pud] = (26, 34, 44)
    rim = outline_mask(pud)
    base[rim] = (60, 74, 86)
    shine = pud & (hash2(xs.astype(int), ys.astype(int), 93) > 0.94)
    base[shine] = (120, 150, 170)
    return base


def floor_D(xs, ys):
    """Comme A, avec un tapis de mycélium blanc-bleu par plaques (filaments fins)."""
    out = floor_A(xs, ys)
    myc = fbm(xs, ys, 26, 81, 2) > 0.7
    threads = myc & ((hash2(xs.astype(int), ys.astype(int), 82) > 0.8) | ((xs + ys * 2).astype(int) % 7 == 0) | ((xs * 2 - ys).astype(int) % 9 == 0))
    out[threads] = (176, 190, 200)
    halo = outline_mask(threads) & myc
    out[halo] = out[halo] * 0.6 + np.array((120, 140, 150)) * 0.4
    return out


# ---------------------------------------------------------------- murs (murs v3, recolorés)


def wall_variant(stone_base, jamb_base, mortar, hi, sh):
    def stone_color(bid):
        t = M.hsh(*[hash(p) & 0xFFFF if isinstance(p, str) else p for p in bid])
        base = jamb_base if bid[0] == "jamb" else stone_base
        k = 0.82 + 0.34 * (0.5 + t * 0.4 if bid[0] == "jamb" else t)
        return tuple(min(255, int(c * k)) for c in base)

    def apply():
        M.stone_color = stone_color
        M.COL.update({"mortar": mortar, "hi": hi, "sh": sh, "dark": (8, 7, 10)})
    return apply


WALLS = {
    "A": wall_variant((70, 72, 94), (96, 98, 122), (30, 28, 38), (128, 132, 156), (14, 12, 20)),
    "B": wall_variant((66, 64, 84), (90, 88, 110), (26, 24, 32), (120, 122, 144), (12, 10, 18)),
    "C": wall_variant((74, 62, 72), (98, 84, 94), (32, 24, 30), (132, 118, 128), (16, 10, 14)),
    "D": wall_variant((66, 70, 92), (92, 96, 120), (24, 26, 36), (124, 130, 154), (12, 12, 20)),
}


def wall_dressing(px, walls, opt, W, H):
    """Mycélium à la place de la mousse ; coulures (C) ; points lumineux (D)."""
    for Y in range(H):
        for X in range(W):
            cx, cy = X // T, Y // T
            if not walls.wall(cx, cy):
                continue
            n = M.smooth_noise(X, Y, 8, 31)
            near = any(walls.floor((X + dx) // T, (Y + dy) // T) for dx, dy in ((0, 3), (0, -3), (3, 0), (-3, 0)))
            if not near:
                continue
            r = M.hsh(X, Y, 32)
            joint = px[X, Y] == M.COL["mortar"]
            thick = 0.6 if opt == "B" else 0.7
            if n > thick and (joint or r < (n - thick) * 3):
                px[X, Y] = (212, 218, 222) if r < 0.5 else (168, 176, 184)
            if opt == "C" and joint and M.hsh(X // 3, Y // 6, 33) < 0.18:
                # coulure d'humidité : quelques pixels sombres et brillants sous le joint
                for k in range(1, 4):
                    if Y + k < H and walls.wall((X) // T, (Y + k) // T):
                        px[X, Y + k] = (30, 40, 52) if k < 3 else (70, 92, 110)
            if opt == "D" and joint and r < 0.035:
                px[X, Y] = (120, 255, 214)


# ---------------------------------------------------------------- décors (sprites)

GLOW, GLOW_L, GLOW_D = (96, 230, 200, 255), (190, 255, 236, 255), (40, 140, 130, 255)
STEM, STEM_D = (214, 206, 186, 255), (150, 140, 124, 255)
CAP, CAP_D = (70, 120, 140, 255), (40, 74, 92, 255)


def glow_mushroom(closed=False):
    """Champignon lumineux : chapeau bleu-vert qui luit ; refermé (il a eu peur du bruit), il se recroqueville et s'éteint."""
    s = Sprite(12, 12)
    if not closed:
        s.r(1, 2, 10, 3, GLOW).r(2, 1, 8, 1, GLOW).r(3, 0, 6, 1, GLOW_L).r(1, 5, 10, 1, GLOW_D)
        s.p(3, 2, GLOW_L).p(4, 2, GLOW_L).p(7, 3, GLOW_L)
        s.r(5, 6, 2, 5, STEM).r(6, 6, 1, 5, STEM_D)
        s.r(3, 11, 6, 1, (60, 52, 56, 255))
        # un petit à côté
        s.r(8, 7, 3, 2, GLOW).p(9, 6, GLOW_L).r(9, 9, 1, 2, STEM)
    else:
        s.r(3, 3, 6, 4, CAP).r(4, 2, 4, 1, CAP).r(3, 6, 6, 1, CAP_D).p(4, 4, (100, 150, 166, 255))
        s.r(5, 7, 2, 4, STEM_D).r(3, 11, 6, 1, (60, 52, 56, 255))
        s.r(8, 8, 2, 2, CAP).r(9, 10, 1, 1, STEM_D)
    return s.done()


def tuft():
    """Touffe de petits champignons bruns (décor au sol)."""
    s = Sprite(12, 9)
    for x, y, w in ((1, 3, 4), (6, 1, 5), (4, 5, 3)):
        s.r(x, y, w, 2, (150, 104, 70, 255)).r(x, y, w, 1, (190, 140, 96, 255))
        s.r(x + w // 2, y + 2, 1, 8 - y - 2, STEM)
    return s.done()


def wall_threads():
    """Filaments de mycélium qui pendent d'un joint du mur."""
    s = Sprite(14, 10)
    s.r(0, 0, 14, 1, (212, 218, 222, 255))
    for x, ln in ((1, 4), (3, 7), (6, 3), (8, 9), (11, 5), (13, 6)):
        s.r(x, 1, 1, ln, (190, 198, 206, 255)).p(x, ln, (230, 236, 240, 255))
    return s.done(outline=False)


def drip(stage=0):
    """Goutte qui tombe du plafond : trois images (qui se forme, qui tombe, qui éclabousse)."""
    s = Sprite(6, 12)
    W1 = (150, 196, 220, 255)
    if stage == 0:
        s.r(2, 0, 2, 2, W1)
    elif stage == 1:
        s.r(2, 5, 2, 3, W1).p(2, 4, W1)
    else:
        s.p(0, 10, W1).p(5, 10, W1).r(1, 11, 4, 1, W1).p(2, 9, W1).p(3, 9, W1)
    return s.done(outline=False)


def root():
    """Racine qui sort du mur et rampe sur le sol."""
    s = Sprite(16, 8)
    R, RD = (110, 82, 60, 255), (74, 54, 38, 255)
    s.r(0, 1, 5, 2, R).r(4, 2, 4, 2, R).r(7, 3, 5, 2, R).r(11, 4, 4, 1, R).p(15, 5, R)
    s.r(0, 3, 6, 1, RD).r(5, 4, 6, 1, RD).p(9, 6, R).p(10, 7, R)
    return s.done()


def big_cap(state="whole"):
    """GRAND CHAPEAU (remplace la colonne) : un champignon géant d'une case, on se cache dessous ; coupé : la souche."""
    s = Sprite(18, 26)
    if state == "whole":
        s.r(0, 4, 18, 6, (150, 72, 62, 255)).r(2, 2, 14, 2, (150, 72, 62, 255)).r(5, 0, 8, 2, (176, 92, 78, 255))
        s.r(0, 10, 18, 2, (100, 44, 40, 255)).r(2, 12, 14, 1, (210, 196, 170, 255))
        for x, y in ((4, 3), (10, 5), (14, 7), (6, 7)):
            s.r(x, y, 2, 2, (232, 220, 196, 255))
        s.r(6, 13, 6, 12, STEM).r(10, 13, 2, 12, STEM_D).r(4, 24, 10, 2, (180, 170, 150, 255))
    else:
        s.r(6, 18, 6, 6, STEM).r(10, 18, 2, 6, STEM_D).r(6, 17, 6, 1, (240, 234, 220, 255)).r(4, 24, 10, 2, (180, 170, 150, 255))
        s.p(8, 16, (110, 170, 60, 255)).p(9, 15, (130, 196, 70, 255))  # une pousse qui repart
    return s.done()


# ---------------------------------------------------------------- une salle par option

DECOR = [  # (case x, case y, sprite, décalage) : mêmes décors pour chaque option
    (10, 1, "glow", (2, 4)), (2, 6, "glow", (2, 4)), (11, 6, "tuft", (2, 7)), (6, 2, "tuft", (2, 7)),
    (8, 5, "cap", (-1, -10)),
]


def room(opt):
    WALLS[opt]()
    walls = M.Walls(PLAN)
    img = M.render(PLAN, moss=False)
    W, H = img.size
    px = img.load()
    xs, ys = grid(W, H)
    floor = {"A": floor_A, "B": floor_B, "C": floor_C, "D": floor_D}[opt](xs, ys)
    for Y in range(H):
        for X in range(W):
            if walls.floor(X // T, Y // T):
                px[X, Y] = tuple(int(v) for v in floor[Y, X])
    wall_dressing(px, walls, opt, W, H)
    # Le pilier 2 × 2 du plan reste en pierre ; la case (8, 5) devient un GRAND CHAPEAU posé sur du sol.
    for Y in range(5 * T, 6 * T):
        for X in range(8 * T, 9 * T):
            px[X, Y] = tuple(int(v) for v in floor[Y, X])
    sprites = {"glow": glow_mushroom().img(), "tuft": tuft().img(), "cap": big_cap().img()}
    for cx, cy, name, (ox, oy) in DECOR:
        sp = sprites[name]
        img.paste(sp, (cx * T + ox, cy * T + oy), sp)
    img.paste(wall_threads().img(), (5 * T + 1, 1 * T - 1), wall_threads().img())
    img.paste(wall_threads().img(), (9 * T + 1, 1 * T - 1), wall_threads().img())
    img.paste(root().img(), (1 * T - 2, 3 * T + 4), root().img())
    # Lumière : la salle dans le noir, deux halos bleu-vert autour des champignons lumineux.
    a = np.asarray(img).astype(float)
    light = np.full((H, W), 0.55)
    for (cx, cy) in ((10.5, 1.6), (2.5, 6.6)):
        d = np.hypot(xs - cx * T, ys - cy * T) / T
        light = np.maximum(light, np.clip(1.2 - d / 5.0, 0, 1))
    tint = np.array((0.78, 1.0, 0.96))
    glow = np.clip(1.0 - light, 0, 1)
    a = a * light[..., None] * (tint[None, None, :] * (1 - glow[..., None] * 0.3) + glow[..., None] * 0.3 * np.array((0.6, 0.7, 1.0)))
    near = np.zeros((H, W))
    for (cx, cy) in ((10.5, 1.6), (2.5, 6.6)):
        d = np.hypot(xs - cx * T, ys - cy * T) / T
        near = np.maximum(near, np.clip(1 - d / 2.2, 0, 1))
    a = a + near[..., None] * np.array((14, 52, 44))
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


TITLES = {
    "A": "A · Pierre sombre (idée de Thomas)",
    "B": "B · Terre humide",
    "C": "C · Roche suintante",
    "D": "D · Pierre et lueurs",
}


def main():
    S = 3
    rooms = {k: up(room(k), S) for k in "ABCD"}
    rw, rh = rooms["A"].size
    pad = 24
    decors = [
        ("Lumineux", glow_mushroom()), ("… refermé", glow_mushroom(True)), ("Touffe", tuft()),
        ("Filaments", wall_threads()), ("Goutte 1", drip(0)), ("Goutte 2", drip(1)), ("Goutte 3", drip(2)),
        ("Racine", root()), ("Grand chapeau", big_cap()), ("… coupé", big_cap("cut")),
    ]
    dw = 136
    Wb = pad + 2 * (rw + pad)
    Hb = 70 + 2 * (rh + 44) + 60 + 200
    sheet = Image.new("RGB", (Wb, Hb), (22, 18, 14))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 2 · LA CHAMPIGNONNIÈRE · ambiance v1 (propositions)", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((Wb // 2, 50), "Même salle pour les 4 options : murs v3 recolorés, sol, mycélium, 2 champignons lumineux, 1 grand chapeau", fill=(190, 180, 160), font=font(14, False), anchor="mm")
    for i, k in enumerate("ABCD"):
        x = pad + (i % 2) * (rw + pad)
        y = 70 + (i // 2) * (rh + 44)
        d.text((x, y + 4), TITLES[k], fill=(240, 192, 80), font=font(18), anchor="lt")
        sheet.paste(rooms[k], (x, y + 30))
    y0 = 70 + 2 * (rh + 44) + 20
    d.text((pad, y0), "Décors simples (agrandis ×6)", fill=(240, 192, 80), font=font(18), anchor="lt")
    for i, (name, sp) in enumerate(decors):
        im = up(sp.img(), 6)
        x = pad + i * dw
        bg = Image.new("RGB", (dw - 8, 168), (34, 34, 40))
        bg.paste(im, ((bg.width - im.width) // 2, bg.height - im.height - 6), im)
        sheet.paste(bg, (x, y0 + 30))
        d.text((x, y0 + 204), name, fill=(220, 210, 190), font=font(12, False), anchor="lt")
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "champi_v1.png")
    sheet.save(out)
    print("art/champi_v1.png", sheet.size)


if __name__ == "__main__":
    main()
