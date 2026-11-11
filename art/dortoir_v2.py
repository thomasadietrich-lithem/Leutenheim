"""Dortoir v2 (Thomas, 2026-11-11 : « Les salles ce ne va pas. On ne comprend pas les objets, l'identité n'est pas assez
forte. Commence par une salle. Le dortoir : 2 à 4 lits superposés, qu'on voit pas tout à fait au-dessus mais en biais
pour comprendre la hauteur ; 1 tapis à cheval entre plusieurs cases qui peut brûler et étouffe les pas ; une cheminée ;
une table et 1 à 3 chaises ; 0 à 1 chaise renversée qui bloque une case »).

Vue légèrement de face (3/4) : les meubles hauts débordent sur la case du dessus, comme un personnage.
Écrit art/dortoir_v2.png (la salle entière, puis chaque meuble agrandi). Lancer depuis la racine du dépôt.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
from pix import hexrgb, hash2, grid, to_img, up, font, outline_mask
from sols_v1 import floor_a

T = 16
OUT = hexrgb("#120d08")

# Palette (reprise des objets validés) : bois, paille, draps, métal, feu.
C = {
    "wood_d": "#4a2e14", "wood": "#7a5230", "wood_l": "#9a6a34", "wood_h": "#b9824a",
    "straw_d": "#a08c64", "straw": "#d8c8a0", "straw_l": "#e6dcc0",
    "sheet_w": "#f4f7ff", "sheet_s": "#c3cbe0",
    "red": "#a8323a", "red_d": "#6e1e26", "red_l": "#d04a50",
    "blue": "#3a5a94", "blue_d": "#253a66", "blue_l": "#5a82c0",
    "gold": "#d6aa54", "gold_d": "#a87c1c",
    "shadow": "#1c1622",
    "stone": "#6e7594", "stone_l": "#a4abc8", "stone_d": "#4e5570",
    "fire": "#ff8a2a", "fire_l": "#ffb040", "fire_y": "#ffe08a", "ember": "#ff5a2a",
    "iron": "#5a5f74", "iron_l": "#8a90a8",
}
C = {k: hexrgb(v) + (255,) for k, v in C.items()}


class Sprite:
    """Petite toile RGBA ; `r(x, y, w, h, couleur)` peint un rectangle ; `done()` ajoute le contour sombre."""

    def __init__(self, w, h):
        self.a = np.zeros((h, w, 4), np.uint8)

    def r(self, x, y, w, h, c):
        self.a[max(0, y):y + h, max(0, x):x + w] = C[c] if isinstance(c, str) else c
        return self

    def p(self, x, y, c):
        return self.r(x, y, 1, 1, c)

    def done(self, outline=True):
        if outline:
            m = self.a[..., 3] > 0
            o = outline_mask(m)
            self.a[o] = OUT + (255,)
        return self

    def img(self):
        return Image.fromarray(self.a, "RGBA")


def bunk(blanket="red"):
    """Lit superposé, 2 cases de large × 1 de profondeur ; il dépasse de 12 pixels vers le haut (sa hauteur).
    Montants aux deux bouts, couchette du haut, ombre dessous, couchette du bas, échelle à droite."""
    s = Sprite(34, 30)
    bl, bd, bh = blanket, blanket + "_d", blanket + "_l"
    # Ombre au sol.
    s.r(3, 27, 28, 2, "shadow")
    # Montants (derrière d'abord, plus sombres, puis devant).
    for x in (1, 31):
        s.r(x, 0, 2, 28, "wood_d")
    # Couchette du HAUT : dessus du matelas (paille), drap, oreiller, couverture, puis le bord avant en bois.
    s.r(3, 1, 28, 6, "straw")
    s.r(3, 1, 28, 1, "straw_l")
    s.r(4, 2, 6, 4, "sheet_w").r(4, 5, 6, 1, "sheet_s")
    s.r(11, 1, 20, 6, bl).r(11, 1, 20, 1, bh).r(11, 6, 20, 1, bd)
    s.r(3, 7, 28, 3, "wood_l").r(3, 7, 28, 1, "wood_h").r(3, 9, 28, 1, "wood")
    # Dessous de la couchette du haut : ombre profonde (on comprend qu'il y a un étage).
    s.r(3, 10, 28, 4, "shadow")
    # Couchette du BAS.
    s.r(3, 14, 28, 6, "straw")
    s.r(3, 14, 28, 1, "straw_l")
    s.r(4, 15, 6, 4, "sheet_w").r(4, 18, 6, 1, "sheet_s")
    s.r(11, 14, 20, 6, bl).r(11, 14, 20, 1, bh).r(11, 19, 20, 1, bd)
    # Pli de couverture qui pend sur le bord.
    s.r(22, 20, 6, 2, bd)
    s.r(3, 20, 28, 3, "wood_l").r(3, 20, 28, 1, "wood_h").r(3, 22, 28, 1, "wood")
    # Pieds, entre le bord du bas et le sol.
    s.r(3, 23, 28, 4, "shadow")
    # Montants de devant, par-dessus.
    for x in (0, 32):
        s.r(x, 0, 2, 28, "wood").r(x, 0, 1, 28, "wood_h").r(x, 0, 2, 1, "wood_h")
    # Échelle, contre le montant de droite : deux barreaux entre les couchettes.
    for y in (11, 16, 24):
        s.r(27, y, 5, 1, "wood_h")
    s.r(27, 10, 1, 17, "wood")
    return s.done()


def rug():
    """Tapis 3 × 2 cases : rouge, bordure dorée à motif, franges aux deux bouts ; un peu usé."""
    w, h = 3 * T - 4, 2 * T - 6
    s = Sprite(w + 4, h)
    s.r(2, 0, w, h, "red")
    s.r(2, 0, w, 2, "gold_d").r(2, h - 2, w, 2, "gold_d").r(2, 0, 2, h, "gold_d").r(w, 0, 2, h, "gold_d")
    s.r(5, 3, w - 6, 1, "gold").r(5, h - 4, w - 6, 1, "gold").r(5, 3, 1, h - 6, "gold").r(w - 2, 3, 1, h - 6, "gold")
    # Losanges au centre.
    cx, cy = (w + 4) // 2, h // 2
    for dx, dy in ((0, -4), (-1, -3), (1, -3), (-2, -2), (2, -2), (-3, -1), (3, -1), (-4, 0), (4, 0),
                   (-3, 1), (3, 1), (-2, 2), (2, 2), (-1, 3), (1, 3), (0, 4)):
        s.p(cx + dx, cy + dy, "gold")
    s.r(cx - 1, cy - 1, 3, 3, "red_l")
    for dx in (-12, 12):
        s.p(cx + dx, cy, "gold").p(cx + dx - 1, cy, "red_l").p(cx + dx + 1, cy, "red_l")
    # Usure : quelques pixels plus sombres.
    for i in range(14):
        x, y = 6 + int(hash2(i, 1, 5) * (w - 8)), 4 + int(hash2(i, 2, 5) * (h - 8))
        s.p(x, y, "red_d")
    # Franges aux deux bouts (pas de contour : fils fins).
    for y in range(1, h - 1, 2):
        s.p(0, y, "straw").p(1, y, "straw_d").p(w + 3, y, "straw").p(w + 2, y, "straw_d")
    return s


def table():
    """Table 2 × 1 cases, vue en biais : plateau, chant, pieds ; une chope, un pain, une bougie."""
    s = Sprite(30, 22)
    s.r(2, 20, 26, 2, "shadow")
    s.r(0, 2, 30, 10, "wood_l").r(0, 2, 30, 1, "wood_h")
    for y in (5, 8):
        s.r(1, y, 28, 1, "wood")  # planches
    s.r(0, 12, 30, 3, "wood").r(0, 14, 30, 1, "wood_d")
    for x in (1, 26):
        s.r(x, 15, 3, 6, "wood_d")
    # Chope (métal), pain, bougie.
    s.r(5, 3, 4, 5, "iron").r(5, 3, 4, 1, "iron_l").r(9, 4, 1, 3, "iron")
    s.r(13, 5, 7, 4, "wood_h").r(14, 5, 5, 1, "straw").p(15, 7, "wood").p(17, 7, "wood")
    s.r(23, 2, 2, 6, "sheet_w").p(23, 0, "fire_l").p(23, 1, "fire_y")
    return s.done()


def chair(facing="right"):
    """Chaise vue en biais : dossier haut derrière, assise, quatre pieds. Elle dépasse vers le haut (dossier)."""
    s = Sprite(12, 20)
    s.r(1, 18, 10, 2, "shadow")
    # Dossier (côté gauche si la chaise regarde à droite).
    bx = 0 if facing == "right" else 9
    s.r(bx, 0, 3, 13, "wood").r(bx, 0, 3, 1, "wood_h").r(bx + 1, 2, 1, 8, "wood_d")
    s.r(1, 9, 10, 4, "wood_l").r(1, 9, 10, 1, "wood_h")
    s.r(1, 13, 10, 1, "wood_d")
    for x in (1, 9):
        s.r(x, 14, 2, 5, "wood_d")
    return s.done()


def chair_fallen():
    """Chaise renversée en arrière : le dossier à plat au sol, l'assise dressée, les pieds qui pointent vers la droite.
    Bloque sa case."""
    s = Sprite(16, 14)
    s.r(0, 12, 16, 2, "shadow")
    # Dossier à plat au sol, avec ses barreaux.
    s.r(0, 9, 11, 3, "wood").r(0, 9, 11, 1, "wood_h")
    for x in (3, 6):
        s.r(x, 10, 1, 2, "wood_d")
    # Assise dressée à la verticale, au bout du dossier.
    s.r(9, 1, 3, 11, "wood_l").r(9, 1, 1, 11, "wood_h").r(11, 1, 1, 11, "wood")
    # Quatre pieds (deux par deux) qui pointent vers la droite, en l'air.
    s.r(12, 1, 4, 2, "wood_d").r(12, 6, 4, 2, "wood_d")
    s.p(15, 3, "wood").p(15, 4, "wood").p(15, 5, "wood")
    return s.done()


def hearth():
    """Cheminée dans le mur du haut, foyer vers la salle (même dessin que celle du jeu, plus marqué)."""
    s = Sprite(16, 16)
    s.r(0, 0, 16, 16, "stone").r(0, 0, 16, 4, "stone_l").r(0, 3, 16, 1, "stone_d")
    s.r(0, 4, 3, 12, "stone").r(13, 4, 3, 12, "stone")
    s.r(3, 4, 10, 12, OUT + (255,))
    s.r(4, 13, 8, 2, "wood").r(5, 12, 6, 1, "wood_l")
    s.r(5, 9, 6, 4, "fire").r(6, 7, 3, 3, "fire").r(6, 10, 4, 3, "fire_l").r(7, 11, 2, 2, "fire_y")
    s.p(4, 14, "ember").p(11, 14, "ember")
    return s


def walls(w, h):
    """Murs de briques vus du dessus (comme dans le jeu, simplifiés) autour d'une salle de w × h cases intérieures."""
    W, H = (w + 2) * T, (h + 2) * T
    xs, ys = grid(W, H)
    img = np.zeros((H, W, 3))
    row = (ys // 6).astype(int)
    bx = ((xs + (row % 2) * 6) // 12).astype(int)
    tint = 0.85 + 0.25 * hash2(bx, row, 7)
    img[:] = np.array(hexrgb("#5d6180"))
    img = img * tint[..., None]
    joint = (ys % 6 == 0) | ((xs + (row % 2) * 6) % 12 == 0)
    img[joint] = hexrgb("#2a2e40")
    return img


if __name__ == "__main__":
    IW, IH = 8, 6  # intérieur de la salle, en cases
    W, H = (IW + 2) * T, (IH + 2) * T
    xs, ys = grid(W, H)
    base = walls(IW, IH)
    fl = floor_a(xs, ys)
    base[T:T + IH * T, T:T + IW * T] = fl[T:T + IH * T, T:T + IW * T]
    # Porte en bas (ouverture) pour situer l'entrée.
    base[(IH + 1) * T:, 4 * T:5 * T] = fl[(IH + 1) * T:, 4 * T:5 * T] * 0.7
    room = to_img(base).convert("RGBA")

    def put(sprite, cx, cy, ox=0, oy=0, foot_h=T):
        """Pose un dessin dont le bas (l'emprise au sol) commence à la case (cx, cy) ; il déborde vers le haut."""
        im = sprite.img()
        x = cx * T + ox
        y = cy * T + foot_h - im.height + oy
        room.alpha_composite(im, (x, y))

    # Ordre : du haut vers le bas (ce qui est devant recouvre ce qui est derrière).
    room.alpha_composite(rug().img(), (3 * T + 2, 3 * T + 3))
    room.alpha_composite(hearth().img(), (6 * T, 0))
    put(bunk("red"), 1, 1, ox=-1, oy=-1)
    put(bunk("blue"), 3, 1, ox=-1, oy=-1)
    put(bunk("red"), 1, 4, ox=-1, oy=-1)
    put(chair("right"), 6, 4, ox=2, oy=-1)
    put(table(), 7, 4, ox=-6, oy=-1)  # 2 cases : 7-8 (la table touche le mur de droite)
    put(chair("left"), 8, 5, ox=2, oy=-1)
    put(chair_fallen(), 6, 6, ox=0, oy=-1)

    S = 4
    big = up(room.convert("RGB"), S)
    # Planche : la salle, puis les meubles un par un.
    pieces = [("lit superposé", bunk("red")), ("lit (couverture bleue)", bunk("blue")), ("tapis 3×2 (brûle, étouffe les pas)", rug()),
              ("table + chope, pain, bougie", table()), ("chaise", chair()), ("chaise renversée (bloque)", chair_fallen()),
              ("cheminée", hearth())]
    sheet = Image.new("RGB", (big.width + 40, 50 + big.height + 24 + 2 * 186), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((sheet.width // 2, 20), "DORTOIR v2 — à valider (8 × 6 cases, vue légèrement de face)", fill=(255, 243, 200), font=font(15), anchor="mm")
    sheet.paste(big, (20, 44))
    y = 44 + big.height + 24
    x = 20
    for label, sp in pieces:
        im = up(sp.img(), 4)
        bw = max(im.width + 12, 150)
        bg = Image.new("RGB", (bw, 150), (70, 61, 82))
        bg.paste(im, ((bw - im.width) // 2, 150 - im.height - 8), im)
        if x + bg.width > sheet.width - 10:
            x, y = 20, y + 186
        sheet.paste(bg, (x, y))
        d.text((x, y + 156), label, fill=(220, 210, 190), font=font(11, False))
        x += bg.width + 14
    sheet.save("art/dortoir_v2.png")
    print(sheet.size)
