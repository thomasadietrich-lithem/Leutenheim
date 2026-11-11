"""Sols, v1 (Thomas, 2026-11-11 : « Fait des propositions de sols. Ce serait bien de deviner des dalles à certains endroits »
et « Développe deux sols spéciaux (gravier qui crack crak et attire les ennemis à proximité), et flaque d'eau. Il faut
une palette de sprite qui peut générer des formes naturelles »).

Trois sols de base (A, B, C), puis gravier et flaque posés sur le sol A. Tout est procédural (art/pix.py) :
le même calcul, case par case, pourra être refait dans le jeu. Écrit art/sols_v1.png. Lancer depuis la racine du dépôt.
"""
import numpy as np
from PIL import Image, ImageDraw
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from pix import hexrgb, hash2, fbm, value_noise, grid, to_img, up, font, outline_mask, coverage

T = 16
W, H = 10 * T, 7 * T
S = 3  # agrandissement de la planche

EARTH = [hexrgb("#352c38"), hexrgb("#3e3442"), hexrgb("#473c4a")]
STONE = hexrgb("#4b4560")
STONE_HI = hexrgb("#5a5372")
JOINT = hexrgb("#221d2c")


def earth(xs, ys, seed):
    """Terre battue : trois teintes mêlées par un bruit fin, quelques grains."""
    n = fbm(xs, ys, 6, seed, 2)
    out = np.zeros(xs.shape + (3,))
    for i, c in enumerate(EARTH):
        sel = (n >= i / 3) & (n < (i + 1) / 3) if i < 2 else (n >= 2 / 3)
        out[sel] = c
    grain = hash2(xs.astype(int), ys.astype(int), seed + 5) > 0.93
    out[grain] = out[grain] * 0.75
    return out


def slabs(xs, ys, seed, cell=T):
    """Dalles d'une case : teinte propre à chaque dalle, joint sombre, arête claire en haut à gauche, usure au centre."""
    cx, cy = (xs // cell).astype(int), (ys // cell).astype(int)
    lx, ly = xs % cell, ys % cell
    tint = 0.9 + 0.2 * hash2(cx, cy, seed)
    out = np.array(STONE, float)[None, None, :] * tint[..., None]
    hi = ((lx == 1) | (ly == 1)) & (lx > 0) & (ly > 0)
    out[hi] = np.array(STONE_HI) * tint[hi][..., None]
    worn = fbm(xs, ys, 5, seed + 9, 2) > 0.62
    out[worn] = out[worn] * 0.9
    joint = (lx == 0) | (ly == 0)
    out[joint] = JOINT
    crack = (hash2(cx, cy, seed + 3) < 0.12) & (np.abs((lx - ly * (0.6 + hash2(cx, cy, seed + 4)))) < 0.6) & (lx > 3) & (lx < 13)
    out[crack] = JOINT
    return out


def floor_a(xs, ys):
    """A : terre battue ; ici et là, des dalles qui affleurent, aux bords rongés."""
    base = earth(xs, ys, 11)
    show = fbm(xs, ys, 40, 21, 2) + 0.18 * (value_noise(xs, ys, 3, 22) - 0.5)
    m = show > 0.56
    out = base.copy()
    out[m] = slabs(xs, ys, 31)[m]
    edge = outline_mask(m)
    out[edge] = out[edge] * 0.7
    return out


def floor_b(xs, ys):
    """B : dalles partout, mais une terre poussiéreuse les recouvre par plaques."""
    out = slabs(xs, ys, 41)
    dust = fbm(xs, ys, 36, 51, 2) + 0.2 * (value_noise(xs, ys, 3, 52) - 0.5)
    m = dust < 0.4
    out[m] = earth(xs, ys, 61)[m]
    thin = (dust >= 0.4) & (dust < 0.47)
    out[thin] = out[thin] * 0.55 + earth(xs, ys, 61)[thin] * 0.45
    return out


def floor_c(xs, ys):
    """C : petits pavés (une demi-case), rangs décalés, bords arrondis ; quelques pavés manquent (terre)."""
    cell = T // 2
    row = (ys // cell).astype(int)
    shift = (row % 2) * (cell // 2)
    cx = ((xs + shift) // cell).astype(int)
    lx, ly = (xs + shift) % cell, ys % cell
    tint = 0.85 + 0.25 * hash2(cx, row, 71)
    out = np.array(STONE, float)[None, None, :] * tint[..., None]
    top = (ly == 1) & (lx > 0)
    out[top] = np.array(STONE_HI) * tint[top][..., None]
    gap = (lx == 0) | (ly == 0) | (((lx == 1) | (lx == cell - 1)) & ((ly == 1) | (ly == cell - 1)))
    out[gap] = JOINT
    missing = hash2(cx, row, 72) < 0.07
    out[missing] = earth(xs, ys, 73)[missing]
    return out


def gravel(base, xs, ys, cells, seed=81):
    """Gravier : de petits cailloux de 2 pixels (clair en haut, sombre en bas) posés sur une grille de 3 pixels
    décalée au hasard ; serrés au cœur, clairsemés au bord ; forme naturelle qui suit les cases."""
    cov = coverage(cells, base.shape[1], base.shape[0])
    edge = cov + 0.5 * (fbm(xs, ys, 8, seed, 2) - 0.5)
    inside = edge > 0.5
    out = base.copy()
    out[inside] = out[inside] * 0.8  # terre plus sombre sous le gravier
    hgt, wid = base.shape[:2]
    light, mid, dark = hexrgb("#9c94a8"), hexrgb("#766e84"), hexrgb("#4e4758")
    for by in range(0, hgt, 3):
        for bx in range(0, wid, 3):
            r = float(hash2(bx, by, seed + 1))
            px = bx + int(hash2(bx, by, seed + 2) * 2)
            py = by + int(hash2(bx, by, seed + 3) * 2)
            if px + 1 >= wid or py + 1 >= hgt or not inside[py, px]:
                continue
            density = min(0.85, 0.25 + (edge[py, px] - 0.5) * 2.5)
            if r > density:
                continue
            tone = hash2(bx, by, seed + 4)
            top = light if tone > 0.5 else mid
            out[py, px] = top
            out[py, px + 1] = mid if tone > 0.5 else dark
            out[py + 1, px] = mid if tone > 0.5 else dark
            out[py + 1, px + 1] = dark
    return out


def puddle(base, xs, ys, cells, seed=91):
    """Flaque : eau sombre au centre, plus claire au bord, reflet clair sur le bord du haut, sol mouillé autour."""
    cov = coverage(cells, base.shape[1], base.shape[0])
    edge = cov + 0.45 * (fbm(xs, ys, 9, seed, 2) - 0.5)
    m = edge > 0.5
    out = base.copy()
    wet = outline_mask(m) | outline_mask(outline_mask(m) | m) & ~m
    out[wet] = out[wet] * 0.62
    deep = edge > 0.85
    out[m] = hexrgb("#2f4f7e")
    out[deep] = hexrgb("#24365a")
    rim = m.copy()
    rim[1:, :] &= ~m[:-1, :]
    rim[0, :] = False
    out[rim] = hexrgb("#6a9ad0")
    spark = m & ~rim & (hash2(xs.astype(int), ys.astype(int), seed + 3) > 0.996)
    out[spark] = hexrgb("#a8d0f0")
    ripple = m & ~deep & (np.abs(np.sin((xs * 0.7 + ys * 1.3) * 0.5 + 3 * value_noise(xs, ys, 8, seed + 4))) < 0.08)
    out[ripple] = hexrgb("#3d6596")
    return out


def wall_frame(img):
    """Cadre de mur sombre autour d'un échantillon, pour qu'on le lise comme une salle."""
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, img.width - 1, img.height - 1], outline=(18, 13, 8), width=3)
    return img


if __name__ == "__main__":
    xs, ys = grid(W, H)
    a, b, c = floor_a(xs, ys), floor_b(xs, ys), floor_c(xs, ys)
    g_cells = {(1, 1), (2, 1), (3, 1), (2, 2), (3, 2), (4, 2), (3, 3)}
    w_cells = {(6, 3), (7, 3), (7, 4), (6, 4), (8, 4), (7, 5)}
    special = puddle(gravel(a, xs, ys, g_cells), xs, ys, w_cells)
    # Petites flaques d'une seule case, pour voir la variété des formes.
    special = puddle(special, xs, ys, {(8, 1)}, 92)
    special = gravel(special, xs, ys, {(1, 5)}, 82)

    panels = [
        ("A  TERRE BATTUE, DALLES QUI AFFLEURENT", a),
        ("B  DALLES SOUS LA POUSSIÈRE", b),
        ("C  PETITS PAVÉS USÉS", c),
        ("SOLS SPÉCIAUX (sur A) : GRAVIER ET FLAQUES", special),
    ]
    pw, ph = W * S, H * S
    sheet = Image.new("RGB", (pw * 2 + 60, 40 + (ph + 46) * 2 + 10), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((sheet.width // 2, 18), "SOLS v1 — à valider (une case = 16 pixels)", fill=(255, 243, 200), font=font(16), anchor="mm")
    for i, (label, arr) in enumerate(panels):
        x = 20 + (i % 2) * (pw + 20)
        y = 40 + (i // 2) * (ph + 46)
        d.text((x, y + 4), label, fill=(214, 170, 84), font=font(13))
        sheet.paste(wall_frame(up(to_img(arr), S)), (x, y + 24))
    # Repères sur le panneau des sols spéciaux : les cases marquées gravier (G) et eau (E).
    x0, y0 = 20 + pw + 20, 40 + ph + 46 + 24
    for (cx, cy) in g_cells | {(1, 5)}:
        d.text((x0 + cx * T * S + 3, y0 + cy * T * S + 2), "G", fill=(255, 243, 200), font=font(10, False))
    for (cx, cy) in w_cells | {(8, 1)}:
        d.text((x0 + cx * T * S + 3, y0 + cy * T * S + 2), "E", fill=(200, 230, 255), font=font(10, False))
    sheet.save("art/sols_v1.png")
    print(sheet.size)
