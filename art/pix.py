"""Outils communs des planches procédurales (sols, dortoir) : bruit lisse, toile de pixels, agrandissement, textes.

Tout est dessiné à 1 pixel = 1 pixel du jeu (une case = 16 × 16), puis agrandi sans lissage.
Le bruit dépend seulement des coordonnées et d'une graine : le jeu pourra refaire exactement le même dessin.
"""
import math
import numpy as np
from PIL import Image, ImageDraw, ImageFont

FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
FONT_R = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"


def hexrgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hash2(x, y, seed):
    """Hasard fixe par point entier, entre 0 et 1 (même formule facile à refaire en TypeScript)."""
    h = (np.asarray(x, dtype=np.int64) * 374761393 + np.asarray(y, dtype=np.int64) * 668265263 + seed * 2246822519) & 0xFFFFFFFF
    h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
    h = h ^ (h >> 16)
    return (h & 0xFFFF) / 65535.0


def value_noise(px, py, scale, seed):
    """Bruit lisse : hasard aux nœuds d'une grille de pas `scale`, interpolé en douceur entre eux."""
    fx, fy = px / scale, py / scale
    x0, y0 = np.floor(fx).astype(np.int64), np.floor(fy).astype(np.int64)
    tx, ty = fx - x0, fy - y0
    sx, sy = tx * tx * (3 - 2 * tx), ty * ty * (3 - 2 * ty)
    a, b = hash2(x0, y0, seed), hash2(x0 + 1, y0, seed)
    c, d = hash2(x0, y0 + 1, seed), hash2(x0 + 1, y0 + 1, seed)
    return (a + (b - a) * sx) * (1 - sy) + (c + (d - c) * sx) * sy


def fbm(px, py, scale, seed, octaves=3):
    total, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        total = total + amp * value_noise(px, py, scale / (2 ** o), seed + 17 * o)
        norm += amp
        amp *= 0.5
    return total / norm


def grid(w, h):
    ys, xs = np.mgrid[0:h, 0:w]
    return xs.astype(np.float64), ys.astype(np.float64)


def to_img(rgb):
    return Image.fromarray(np.clip(rgb, 0, 255).astype(np.uint8), "RGB")


def up(img, s):
    return img.resize((img.width * s, img.height * s), Image.NEAREST)


def font(size, bold=True):
    return ImageFont.truetype(FONT if bold else FONT_R, size)


def outline_mask(mask):
    """Pixels juste à l'extérieur d'une forme (4 voisins) : pour le contour sombre."""
    m = mask.astype(bool)
    o = np.zeros_like(m)
    o[1:, :] |= m[:-1, :]
    o[:-1, :] |= m[1:, :]
    o[:, 1:] |= m[:, :-1]
    o[:, :-1] |= m[:, 1:]
    return o & ~m


def coverage(cells, w, h, tile=16, sigma=0.6):
    """Part de « zone » autour de chaque pixel : somme de taches rondes centrées sur les cases marquées (≈1 au cœur
    d'un groupe de cases, ≈0,5 au bord d'une case, puis 0). `cells` : ensemble de (cx, cy). Sert à donner une forme
    naturelle et arrondie (gravier, flaque) qui suit les cases du jeu."""
    xs, ys = grid(w, h)
    cov = np.zeros((h, w))
    for (cx, cy) in cells:
        dx = (xs + 0.5 - (cx + 0.5) * tile) / tile
        dy = (ys + 0.5 - (cy + 0.5) * tile) / tile
        cov += np.exp(-(dx * dx + dy * dy) / (2 * sigma * sigma))
    return np.clip(cov, 0, 1.4)
