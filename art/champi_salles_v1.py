"""Salles à thème de la section 2, v1 (Thomas, 2026-11-14, la nuit) :

1. LA CHAMPIGNONNIÈRE DE MORILLES (la première salle spéciale, avec sa quête) :
   4 à 6 rangées de terre battue où poussent les morilles ; du matériel agricole (brouette, râteau-bêche-serpette contre
   le mur) ; des caillebotis posés en rangées irrégulières entre les rangs ; des étagères à pots de 2 cases (1 à 2), dans
   chaque orientation (contre le mur du fond, de gauche, de droite, du bas) ; des sacs d'engrais (1 à 3 par case) ; des
   arrosoirs. Sol : terre battue.
2. L'ATELIER DE SCULPTURE : un immense champignon de pierre (3 × 3 cases) pris dans ses échafaudages ; une grue de bois ;
   des tas de gravats (1 à 3) ; des étagères de matériel (1 à 2, toutes orientations) ; des pioches rouillées ; le plan du
   champignon, sur un parchemin posé sur un tréteau. Sol : grandes dalles sombres, poussière de pierre.

Même vue que le reste du jeu : 3/4 plongeant, 16 pixels par case, contour sombre, le dessin peut monter au-dessus de sa
case (meubles hauts). Écrit art/champi_salles_v1.png (les deux salles et chaque meuble).

  python3 art/champi_salles_v1.py           → la planche
  python3 art/champi_salles_v1.py export    → src/render/sprites/champiSalles.ts
"""
import math, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from pix import hash2, fbm, grid, to_img, outline_mask
from planche import planche

OUT = (18, 13, 8)
C = {
    "wood_h": (196, 150, 96), "wood": (150, 106, 64), "wood_d": (100, 68, 42), "wood_dd": (62, 42, 28),
    "soil_l": (118, 88, 66), "soil": (88, 64, 50), "soil_d": (60, 44, 36), "furrow": (40, 30, 26),
    "mo_l": (214, 182, 128), "mo": (164, 126, 82), "mo_d": (100, 72, 46), "stem": (230, 218, 192), "stem_d": (182, 166, 136),
    "pot_l": (204, 120, 78), "pot": (164, 86, 54), "pot_d": (112, 56, 36), "potsoil": (58, 42, 34), "sprout": (120, 180, 96),
    "bag_l": (214, 190, 140), "bag": (174, 150, 104), "bag_d": (124, 102, 68), "bag_dd": (90, 72, 48), "label": (86, 128, 70),
    "zinc_l": (190, 200, 210), "zinc": (136, 146, 160), "zinc_d": (86, 94, 108), "water": (90, 170, 210),
    "rust_l": (176, 100, 58), "rust": (138, 74, 42), "rust_d": (92, 50, 30), "iron": (96, 96, 108), "iron_l": (140, 140, 152),
    "st_l": (182, 174, 190), "st": (140, 132, 152), "st_d": (100, 94, 114), "st_dd": (66, 62, 80), "chip": (210, 204, 216),
    "parch": (228, 208, 162), "parch_d": (190, 164, 116), "ink": (72, 54, 42), "ink_r": (150, 50, 40),
    "rope": (176, 146, 100), "rope_d": (120, 96, 62), "shadow": (20, 16, 18, 120), "glow": (110, 236, 210),
    "comp": (70, 52, 40), "comp_l": (98, 74, 54),
}


class S:
    def __init__(self, w, h):
        self.a = np.zeros((h, w, 4), np.uint8)
        self.w, self.h = w, h

    def p(self, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < self.w and 0 <= y < self.h:
            v = C[c] if isinstance(c, str) else c
            self.a[y, x] = v if len(v) == 4 else (*v, 255)
        return self

    def r(self, x, y, w, h, c):
        for yy in range(int(y), int(y + h)):
            for xx in range(int(x), int(x + w)):
                self.p(xx, yy, c)
        return self

    def line(self, x0, y0, x1, y1, c):
        n = int(max(abs(x1 - x0), abs(y1 - y0))) + 1
        for i in range(n):
            t = i / max(1, n - 1)
            self.p(round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * t), c)
        return self

    def ell(self, cx, cy, rx, ry, c, shade=None, light=None):
        for y in range(self.h):
            for x in range(self.w):
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1:
                    k = c
                    if shade and dx + dy > 0.7:
                        k = shade
                    if light and dx + dy < -0.8:
                        k = light
                    self.p(x, y, k)
        return self

    def done(self, outline=True):
        if outline:
            m = (self.a[..., 3] == 255)
            o = outline_mask(m) & (self.a[..., 3] == 0)
            self.a[o] = OUT + (255,)
        return self

    def img(self):
        return Image.fromarray(self.a, "RGBA")


# =============================================================== 1. CHAMPIGNONNIÈRE DE MORILLES

def morel(s, x, y, h=5, seed=0):
    """Une morille : chapeau conique alvéolé (en nid d'abeille), pied crème. (x, y) = le pied au sol."""
    s.r(x - 1, y - 2, 2, 2, "stem").p(x, y - 1, "stem_d")
    for j in range(h):
        w = max(1, (j + 2) // 2)
        yy = y - 2 - h + j
        for i in range(-w + 1, w + 1):
            k = "mo_d" if (i + j + seed) % 3 == 0 else ("mo_l" if i < 0 and j % 2 else "mo")
            s.p(x - 1 + i, yy, k)
    s.p(x - 1, y - 2 - h, "mo_l")


def morel_row(variant=0):
    """Une case d'un rang de culture : un billon de terre battue, bombé, sillon dessous ; 1 à 3 morilles dessus."""
    s = S(16, 16)
    for y in range(16):
        for x in range(16):
            # Le billon occupe toute la largeur (il continue chez la voisine), bombé de y=4 à y=14.
            top = 4 + int(1.5 * (hash2(x // 3, variant, 70) - 0.5))
            if y < top or y > 14:
                continue
            k = "soil_l" if y <= top + 1 else ("soil_d" if y >= 12 else "soil")
            if hash2(x, y, 71 + variant) > 0.86:
                k = "soil_d" if k != "soil_d" else "furrow"
            s.p(x, y, k)
    s.r(0, 15, 16, 1, "furrow")
    spots = [((4, 11), (11, 12)), ((7, 11),), ((3, 12), (8, 10), (13, 12))][variant % 3]
    for i, (x, y) in enumerate(spots):
        morel(s, x, y, 4 + (i + variant) % 3, i + variant)
    return s


def morel_row_empty():
    """Rang récolté : le billon nu, des trous et des tiges coupées."""
    s = morel_row(0)
    s.a[:] = 0
    base = morel_row(1)
    keep = (base.a[..., 0] == C["soil"][0]) | (base.a[..., 0] == C["soil_l"][0]) | (base.a[..., 0] == C["soil_d"][0]) | (base.a[..., 0] == C["furrow"][0])
    s.a[keep] = base.a[keep]
    for x, y in ((4, 10), (11, 11), (7, 9)):
        s.p(x, y, "furrow").p(x, y - 1, "stem_d")
    return s


def caillebotis(variant=0):
    """Caillebotis v2 (Thomas, 2026-11-15 : « intègre mieux les caillebotis au sol ») : plus de contour noir ; des planches
    étroites, ternies par la boue, posées À PLAT dans la terre (elles s'y enfoncent : ombre en bas, boue qui remonte entre
    elles et sur les bords) ; le pas des planches (4 pixels) se raccorde d'une case à l'autre ; une planche manque ou a
    glissé selon la variante."""
    s = S(16, 16)
    MUD, MUD_D = (58, 44, 34, 150), (40, 30, 24, 200)
    W_H, W, W_D = (150, 116, 80), (122, 92, 62), (88, 66, 46)
    # La boue sous les planches (on la voit entre elles), un peu transparente : le sol passe au travers.
    for y in range(1, 15):
        for x in range(16):
            s.p(x, y, MUD if hash2(x, y, 300 + variant) > 0.3 else MUD_D)
    for k in range(4):
        x0 = k * 4
        if variant == 1 and k == 2:
            continue  # une planche manque : la boue seule
        dy = 1 if (variant == 2 and k == 1) else 0
        top = 1 + dy + int(hash2(k, 0, 310 + variant) * 2)
        bot = 14 + dy - int(hash2(k, 1, 310 + variant) * 2)
        for y in range(top, min(bot, 16)):
            for x in range(x0, x0 + 3):
                c = W_H if (x == x0 and y < bot - 2) else (W_D if x == x0 + 2 else W)
                # La boue remonte sur les planches, par plaques, surtout vers les bouts.
                edge = min(y - top, bot - 1 - y)
                if hash2(x, y, 320 + variant) > (0.55 + 0.12 * edge):
                    c = (90, 70, 52)
                s.p(x, y, c)
        if bot < 16:
            for x in range(x0, x0 + 3):
                s.p(x, bot, (34, 26, 22, 220))  # l'ombre au pied de la planche : elle est posée, enfoncée
        s.p(x0 + 1, top + 2, (70, 64, 60)).p(x0 + 1, bot - 3, (70, 64, 60))  # deux clous ternis
    return s


def pot(s, x, y, kind):
    """Un pot de terre (5 × 5) posé en (x, y) = coin bas gauche ; dedans : morille, pousse, ou rien."""
    s.r(x, y - 4, 5, 1, "pot_l").r(x, y - 3, 5, 3, "pot").r(x + 4, y - 3, 1, 3, "pot_d").r(x + 1, y, 3, 1, "pot_d")
    s.r(x + 1, y - 4, 3, 1, "potsoil")
    if kind == "morel":
        morel(s, x + 3, y - 3, 3, x)
    elif kind == "sprout":
        s.p(x + 2, y - 5, "sprout").p(x + 1, y - 6, "sprout").p(x + 3, y - 6, "sprout")


def pot_shelf(view="front"):
    """Étagère à pots, 2 cases. front : contre le mur du fond (de face) ; back : contre le mur du bas (vue de dos) ;
    side : contre le mur de gauche (de profil, 1 × 2 cases) ; le mur de droite est le même dessin retourné."""
    if view == "front":
        s = S(32, 30)
        s.r(1, 0, 2, 29, "wood_d").r(29, 0, 2, 29, "wood_d")
        for y in (9, 19, 28):
            s.r(1, y, 30, 2, "wood").r(1, y, 30, 1, "wood_h")
        s.r(3, 0, 26, 9, "wood_dd").r(3, 11, 26, 8, "wood_dd").r(3, 21, 26, 7, "wood_dd")
        for i, k in enumerate(("morel", "sprout", "morel", None, "morel")):
            if k is not None or i == 3:
                pot(s, 4 + i * 5, 9, k or "empty")
        for i, k in enumerate(("sprout", "morel", None, "morel")):
            pot(s, 5 + i * 6, 19, k or "empty")
        pot(s, 6, 28, "morel")
        s.r(20, 25, 7, 3, "bag").r(20, 25, 7, 1, "bag_l")  # un petit sac sur l'étagère du bas
        return s
    if view == "back":
        s = S(32, 22)
        s.r(1, 6, 30, 15, "wood_d")
        for x in range(1, 31, 5):
            s.r(x, 6, 1, 15, "wood_dd")
        s.r(1, 6, 30, 1, "wood")
        # Les pots dépassent au-dessus du dos de l'étagère.
        for x, k in ((4, "morel"), (12, "sprout"), (21, "morel")):
            s.r(x, 3, 5, 3, "pot").r(x, 3, 5, 1, "pot_l")
            if k == "morel":
                morel(s, x + 3, 4, 3, x)
            else:
                s.p(x + 2, 2, "sprout").p(x + 1, 1, "sprout").p(x + 3, 1, "sprout")
        return s
    # side : de profil, collée au mur de gauche ; 16 de large, 2 cases de haut, elle monte de 12 pixels.
    s = S(16, 44)
    s.r(1, 0, 4, 44, "wood_d").r(1, 0, 1, 44, "wood")  # le montant contre le mur
    for y in (12, 25, 38):
        s.r(1, y, 12, 3, "wood").r(1, y, 12, 1, "wood_h").r(12, y, 1, 3, "wood_d")
        for k, yy in enumerate((y - 1, y + 7 if y < 38 else y - 1)):
            pass
    for y, kinds in ((12, ("morel", "sprout")), (25, ("sprout", "morel")), (38, ("morel",))):
        for i, k in enumerate(kinds):
            # Les pots, vus de côté, l'un derrière l'autre (en profondeur, plus bas = plus près).
            pot(s, 6, y - (6 if i == 0 else 0) if i == 0 else y, k)
    s.r(12, 0, 2, 44, "wood_d")  # le montant avant
    return s


def fertilizer(n=1):
    """Sacs d'engrais (toile de jute, étiquette verte), 1 à 3 sur la même case : couché, empilé, appuyé."""
    s = S(18, 22)

    def bag(x, y, w=10, h=7, tilt=0):
        s.r(x, y, w, h, "bag").r(x, y, w, 1, "bag_l").r(x, y + h - 1, w, 1, "bag_d").r(x + w - 1, y, 1, h, "bag_d")
        s.r(x + 1, y - 1, 2, 1, "bag_dd").r(x + w - 3, y - 1, 2, 1, "bag_dd")  # les coins noués
        s.r(x + 3, y + 2, w - 6, 3, "label").p(x + 4, y + 3, "bag_l").p(x + w - 5, y + 3, "bag_l")
        s.p(x + 2, y + h - 2, "bag_dd")

    if n >= 2:
        bag(7, 10, 10, 9)
    bag(1, 14, 11, 7)
    if n >= 3:
        bag(3, 5, 10, 8)
    if n == 1:
        s.r(12, 19, 3, 1, "comp")  # un peu de terreau répandu
    return s


def watering_can(lying=False):
    """Arrosoir de zinc : debout (bec vers la droite, l'anse dessus), ou renversé (une flaque)."""
    s = S(16, 16)
    if not lying:
        s.r(3, 7, 7, 7, "zinc").r(3, 7, 1, 7, "zinc_l").r(9, 7, 1, 7, "zinc_d").r(3, 6, 7, 1, "zinc_l")
        s.r(4, 3, 5, 1, "zinc_d").p(3, 4, "zinc_d").p(9, 4, "zinc_d").p(3, 5, "zinc_d").p(9, 5, "zinc_d")  # l'anse
        s.line(10, 11, 14, 6, "zinc").p(14, 5, "zinc_l").p(15, 5, "zinc_d").p(15, 6, "zinc_d")  # le bec, la pomme
        s.r(4, 13, 6, 1, "zinc_d")
        s.p(5, 9, "rust").p(7, 11, "rust")
    else:
        s.r(1, 9, 8, 5, "zinc").r(1, 9, 8, 1, "zinc_l").r(1, 13, 8, 1, "zinc_d").r(0, 10, 1, 3, "zinc_d")
        s.line(9, 11, 13, 12, "zinc").p(14, 12, "zinc_l")
        for x in range(9, 16):
            for y in (14, 15):
                if hash2(x, y, 3) > 0.35:
                    s.p(x, y, (60, 92, 116, 200))
    return s


def tool_rack():
    """Matériel agricole contre le mur : un râteau, une bêche et une serpette accrochée, un seau à leurs pieds."""
    s = S(16, 30)
    s.line(3, 1, 4, 27, "wood").line(4, 1, 5, 27, "wood_d")  # manche du râteau
    s.r(1, 0, 7, 1, "iron").r(1, 1, 1, 2, "iron").r(3, 1, 1, 2, "iron").r(5, 1, 1, 2, "iron").r(7, 1, 1, 2, "iron")
    s.line(10, 4, 10, 22, "wood").line(11, 4, 11, 22, "wood_d")  # manche de la bêche
    s.r(8, 1, 5, 2, "wood_d")
    s.r(8, 22, 6, 6, "iron").r(8, 22, 6, 1, "iron_l").r(13, 22, 1, 6, "rust")
    s.r(6, 10, 2, 3, "wood_h").line(7, 9, 4, 8, "iron_l").p(4, 9, "iron")  # serpette accrochée
    s.r(1, 24, 5, 5, "wood_d").r(1, 24, 5, 1, "wood").r(2, 25, 3, 1, "comp")  # le seau de bois
    return s


def wheelbarrow():
    """Brouette pleine de terreau (2 cases de large), roue à gauche, bras à droite."""
    s = S(32, 20)
    s.ell(5, 15, 4, 4, "wood_d").ell(5, 15, 2, 2, "wood").p(5, 15, "iron")
    s.r(6, 5, 18, 9, "wood").r(6, 5, 18, 1, "wood_h").r(6, 13, 18, 1, "wood_d").r(7, 6, 16, 3, "comp")
    for x in range(8, 22, 3):
        s.p(x, 6, "comp_l").p(x + 1, 7, "mo")
    s.p(12, 5, "mo").p(17, 5, "mo_l")  # quelques morilles cueillies
    s.line(24, 9, 31, 11, "wood_d").line(24, 12, 31, 14, "wood_d")
    s.r(20, 14, 1, 5, "wood_d").r(14, 14, 1, 5, "wood_d")
    return s


# =============================================================== 2. ATELIER DE SCULPTURE

def stone_mushroom():
    """L'immense champignon de pierre (3 × 3 cases), pris dans ses échafaudages ; il monte bien au-dessus de sa case."""
    W, H = 52, 74
    s = S(W, H)
    cx = 26
    # Le pied : une colonne trapue, ciselée, la base encore brute (un bloc).
    s.r(17, 58, 18, 14, "st_d").r(17, 58, 18, 1, "st")  # le bloc brut
    s.r(19, 34, 14, 25, "st").r(19, 34, 2, 25, "st_l").r(30, 34, 3, 25, "st_d")
    for y in range(38, 58, 4):
        s.p(23, y, "st_d").p(27, y + 2, "st_d")  # les coups de ciseau
    # Le chapeau : un grand dôme, à moitié fini (à gauche lisse et clair, à droite encore taillé en facettes).
    for y in range(H):
        for x in range(W):
            dx, dy = (x + 0.5 - cx) / 24, (y + 0.5 - 30) / 20
            if dy <= 0.25 and dx * dx + dy * dy <= 1:
                k = "st_l" if dx < -0.35 and dy < -0.2 else "st"
                if dx > 0.15:
                    # Côté pas encore poli : de grandes facettes taillées, irrégulières, et des traces de ciseau.
                    f = hash2(int((x + y * 0.6) / 5), int((y - x * 0.3) / 4), 77)
                    k = "st_d" if f < 0.4 else ("st" if f < 0.8 else "st_l")
                    if hash2(x, y, 78) > 0.9:
                        k = "st_dd"
                if dy > 0.1:
                    k = "st_dd"
                s.p(x, y, k)
    # Les lamelles sous le chapeau.
    for x in range(6, 47, 2):
        s.p(x, 35, "st_dd").p(x, 36, "st_d")
    # Écailles sculptées sur le dessus, côté fini.
    for x, y in ((12, 22), (17, 17), (24, 14), (15, 27), (21, 22)):
        s.r(x, y, 3, 1, "chip").p(x, y + 1, "st_d")
    # Échafaudages : deux tours de perches, un plancher à mi-hauteur, une échelle, des liens de corde.
    for x in (2, 48):
        s.r(x, 10, 2, 63, "wood").r(x, 10, 1, 63, "wood_h")
    for x in (8, 42):
        s.r(x, 14, 2, 59, "wood_d")
    for y in (38, 60):
        s.r(1, y, 51, 3, "wood").r(1, y, 51, 1, "wood_h").r(1, y + 2, 51, 1, "wood_d")
    s.r(1, 12, 10, 2, "wood").r(41, 12, 10, 2, "wood")
    for x in (2, 8, 42, 48):
        for y in (38, 60, 12):
            s.p(x, y + 1, "rope").p(x + 1, y + 1, "rope_d")
    s.line(4, 14, 9, 37, "wood_d").line(9, 14, 4, 37, "wood_d")  # croisillon
    s.line(43, 41, 48, 59, "wood_d").line(48, 41, 43, 59, "wood_d")
    # L'échelle, posée sur le plancher du bas.
    s.r(36, 41, 1, 19, "wood_d").r(40, 41, 1, 19, "wood_d")
    for y in range(43, 60, 4):
        s.r(36, y, 5, 1, "wood_h")
    # Poussière et éclats au pied.
    for x, y in ((14, 71), (38, 70), (12, 66), (40, 72), (30, 73)):
        s.p(x, y, "chip")
    return s


def crane():
    """Grue de bois (2 cases) : un mât, une flèche vers la droite, une poulie, la corde et un bloc de pierre qui pend."""
    s = S(32, 56)
    s.r(2, 50, 14, 5, "wood_d").r(2, 50, 14, 1, "wood")  # le socle
    s.r(6, 6, 4, 45, "wood").r(6, 6, 1, 45, "wood_h").r(9, 6, 1, 45, "wood_d")  # le mât
    s.line(3, 49, 7, 30, "wood_d").line(13, 49, 9, 30, "wood_d")  # jambes de force
    s.r(4, 4, 27, 3, "wood").r(4, 4, 27, 1, "wood_h").r(4, 6, 27, 1, "wood_d")  # la flèche
    s.line(9, 16, 28, 7, "wood_d")  # le hauban
    s.ell(28, 8, 2, 2, "iron").p(28, 8, "iron_l")  # la poulie
    s.r(28, 10, 1, 24, "rope").r(29, 10, 1, 24, "rope_d")  # la corde
    s.r(23, 34, 9, 8, "st").r(23, 34, 9, 1, "st_l").r(31, 34, 1, 8, "st_d").r(23, 41, 9, 1, "st_d")  # le bloc
    s.line(23, 34, 28, 31, "rope").line(31, 34, 28, 31, "rope")
    s.ell(12, 42, 4, 4, "wood_d").ell(12, 42, 2.5, 2.5, "wood").p(12, 42, "iron")  # le treuil et sa manivelle
    s.r(15, 42, 3, 1, "iron").r(17, 42, 1, 3, "iron")
    for y in range(40, 45):
        s.p(10, y, "rope")
    return s


def rubble(n=1):
    """Tas de gravats : 1 (quelques éclats), 2 (un tas), 3 (un gros tas, un morceau de chapeau sculpté dessus)."""
    s = S(18, 18)
    blobs = {1: [(6, 13, 4, 3), (11, 14, 3, 2)], 2: [(8, 11, 7, 5), (4, 14, 3, 2), (13, 14, 3, 2)],
             3: [(9, 10, 8, 6), (4, 13, 4, 3), (14, 14, 3, 2)]}[n]
    for i, (cx, cy, rx, ry) in enumerate(blobs):
        s.ell(cx, cy, rx, ry, "st", "st_d", "st_l")
    for y in range(18):
        for x in range(18):
            if s.a[y, x, 3] and hash2(x, y, 40 + n) > 0.78:
                s.p(x, y, "st_dd" if hash2(x, y, 41) > 0.5 else "chip")
    if n == 3:
        s.ell(10, 6, 4, 2.2, "st_l", "st")  # un éclat du chapeau sculpté, posé dessus
    return s


def tool_shelf(view="front"):
    """Étagère de matériel du sculpteur, 2 cases : ciseaux, maillets, cordes, petits blocs. Mêmes orientations que
    l'étagère à pots (front, back, side ; la droite = la gauche retournée)."""
    if view == "front":
        s = S(32, 30)
        s.r(1, 0, 2, 29, "wood_d").r(29, 0, 2, 29, "wood_d")
        for y in (9, 19, 28):
            s.r(1, y, 30, 2, "wood").r(1, y, 30, 1, "wood_h")
        s.r(3, 0, 26, 9, "wood_dd").r(3, 11, 26, 8, "wood_dd").r(3, 21, 26, 7, "wood_dd")
        for x in range(5, 17, 3):  # des ciseaux, debout dans un pot
            s.r(x, 2, 1, 7, "iron_l").p(x, 1, "iron")
        s.r(4, 6, 13, 3, "pot")
        s.r(19, 4, 4, 3, "wood_h").r(20, 7, 2, 2, "wood_d").r(24, 4, 4, 3, "wood_h").r(25, 7, 2, 2, "wood_d")  # maillets
        s.ell(9, 16, 4, 3, "rope", "rope_d").p(9, 16, "rope_d")  # une corde enroulée
        s.r(16, 14, 5, 5, "st").r(16, 14, 5, 1, "st_l").r(22, 15, 5, 4, "st_d")  # petits blocs
        s.r(5, 24, 9, 4, "parch_d").r(5, 24, 9, 1, "parch")  # des papiers roulés
        s.r(18, 23, 9, 5, "iron").r(18, 23, 9, 1, "iron_l")  # une caisse à outils
        return s
    if view == "back":
        s = S(32, 22)
        s.r(1, 6, 30, 15, "wood_d")
        for x in range(1, 31, 5):
            s.r(x, 6, 1, 15, "wood_dd")
        s.r(1, 6, 30, 1, "wood")
        s.r(5, 3, 4, 3, "wood_h").r(14, 2, 5, 4, "st").r(14, 2, 5, 1, "st_l").r(23, 4, 5, 2, "rope")
        return s
    s = S(16, 44)
    s.r(1, 0, 4, 44, "wood_d").r(1, 0, 1, 44, "wood")
    for y in (12, 25, 38):
        s.r(1, y, 12, 3, "wood").r(1, y, 12, 1, "wood_h").r(12, y, 1, 3, "wood_d")
    s.r(6, 7, 5, 5, "st").r(6, 7, 5, 1, "st_l")
    s.r(7, 19, 3, 6, "iron_l").r(6, 22, 5, 3, "wood_h")
    s.ell(9, 35, 3, 2.5, "rope", "rope_d")
    s.r(12, 0, 2, 44, "wood_d")
    return s


def picks(lying=False):
    """Pioches rouillées : deux, appuyées contre le mur ; ou une seule, couchée par terre."""
    s = S(16, 26) if not lying else S(16, 16)
    if not lying:
        for x0, x1 in ((3, 6), (10, 12)):
            s.line(x0, 25, x1, 6, "wood").line(x0 + 1, 25, x1 + 1, 6, "wood_d")
            s.line(x1 - 4, 5, x1 + 4, 7, "rust").line(x1 - 4, 6, x1 + 4, 8, "rust_d")
            s.p(x1 - 5, 7, "rust_l").p(x1 + 5, 9, "iron")
    else:
        s.line(2, 11, 13, 9, "wood").line(2, 12, 13, 10, "wood_d")
        s.line(12, 4, 14, 14, "rust").line(13, 4, 15, 14, "rust_d").p(12, 3, "rust_l").p(14, 15, "iron")
    return s


def plan_table():
    """Le plan du champignon : un parchemin cloué sur un tréteau (2 cases), le schéma à l'encre, les cotes en rouge."""
    s = S(32, 24)
    s.line(4, 23, 8, 12, "wood_d").line(27, 23, 23, 12, "wood_d").line(8, 23, 4, 12, "wood_d").line(23, 23, 27, 12, "wood_d")
    s.r(1, 6, 30, 7, "wood").r(1, 6, 30, 1, "wood_h").r(1, 12, 30, 1, "wood_d")  # le plateau
    s.r(3, 2, 26, 9, "parch").r(3, 10, 26, 1, "parch_d").r(28, 2, 1, 9, "parch_d")
    s.r(2, 2, 1, 4, "parch_d").r(29, 4, 1, 4, "parch_d")  # les bords qui roulent
    # Le schéma : le chapeau en arc, le pied, la base ; les cotes en rouge.
    for t in range(15):
        a = math.pi * t / 14
        s.p(round(15 - 7 * math.cos(a)), round(7 - 4 * math.sin(a)), "ink")
    s.r(8, 7, 15, 1, "ink").r(13, 8, 4, 2, "ink").r(11, 9, 8, 1, "ink")
    s.r(5, 3, 1, 7, "ink_r").p(4, 3, "ink_r").p(6, 3, "ink_r").p(4, 9, "ink_r").p(6, 9, "ink_r")
    s.r(24, 4, 3, 1, "ink").r(24, 6, 3, 1, "ink").r(24, 8, 2, 1, "ink")  # des notes
    s.p(3, 2, "iron").p(28, 2, "iron").p(3, 10, "iron").p(28, 10, "iron")  # les clous
    return s


# =============================================================== Sols (aperçu ; refaits à l'identique dans ground.ts)

def packed_earth(xs, ys):
    """Terre battue de la champignonnière : brun chaud, tassé, quelques traces de pas et de brouette, rares cailloux."""
    n = fbm(xs, ys, 6, 611, 3)
    base = np.stack([88 + 30 * n, 68 + 24 * n, 54 + 18 * n], -1)
    ruts = (np.abs(((ys + 3 * fbm(xs, ys, 9, 612, 2)) % 23) - 11) < 0.6) & (fbm(xs, ys, 30, 613, 2) > 0.5)
    base[ruts] *= 0.78
    peb = hash2(xs.astype(int), ys.astype(int), 614) > 0.985
    base[peb] = (140, 122, 104)
    dark = fbm(xs, ys, 20, 615, 2) < 0.35
    base[dark] *= 0.82
    return base


def dark_slabs(xs, ys):
    """Grandes dalles sombres de l'atelier (2 × 2 cases chacune, en quinconce), poussière de pierre claire par plaques."""
    X, Y = xs.astype(int), ys.astype(int)
    row = Y // 24
    ox = (row % 2) * 12
    lx = (X + ox) % 24
    ly = Y % 24
    sid = ((X + ox) // 24) * 7 + row * 13
    tone = 0.85 + 0.25 * hash2(sid, row, 620)
    n = fbm(xs, ys, 5, 621, 2)
    base = np.stack([52 + 14 * n, 48 + 12 * n, 58 + 14 * n], -1) * tone[..., None]
    joint = (lx == 0) | (ly == 0)
    base[joint] = (24, 20, 28)
    edge = ((lx == 1) | (ly == 1)) & ~joint
    base[edge] = base[edge] * 1.25
    dust = fbm(xs, ys, 14, 622, 3)
    d = dust > 0.64
    base[d] = base[d] * 0.75 + np.array([130, 124, 138]) * 0.25
    chips = (hash2(X, Y, 623) > 0.992) & (dust > 0.5)
    base[chips] = (200, 196, 208)
    return base


# =============================================================== Planche

def room_morilles():
    IW, IH = 12, 9
    W, H = IW * 16, IH * 16
    xs, ys = grid(W, H)
    im = to_img(packed_earth(xs, ys)).convert("RGBA")

    def put(sp, x, y, dx=0, dy=0):
        i = sp.img()
        im.alpha_composite(i, (int(x * 16 + dx), int(y * 16 + 16 - i.height + dy)))

    for ry in (2, 4, 6):
        for x in range(2, 10):
            put(morel_row((x + ry) % 3).done(False), x, ry)
    for ry in (3, 5):
        for x in range(2, 10):
            if hash2(x, ry, 9) > 0.25:
                put(caillebotis(int(hash2(x, ry, 8) * 3)), x, ry)
    put(pot_shelf("front").done(), 3, 0)
    put(pot_shelf("front").done(), 7, 0)
    put(tool_rack().done(), 1, 0)
    sh = pot_shelf("side").done()
    put(sh, 0, 4)
    put(fertilizer(3).done(), 11, 1)
    put(fertilizer(1).done(), 11, 3)
    put(watering_can().done(), 10, 7)
    put(watering_can(True).done(), 1, 8)
    put(wheelbarrow().done(), 9, 8)
    put(pot_shelf("back").done(), 4, 8)
    return im


def room_atelier():
    IW, IH = 12, 9
    W, H = IW * 16, IH * 16
    xs, ys = grid(W, H)
    im = to_img(dark_slabs(xs, ys)).convert("RGBA")

    def put(sp, x, y, dx=0, dy=0):
        i = sp.img()
        im.alpha_composite(i, (int(x * 16 + dx), int(y * 16 + 16 - i.height + dy)))

    put(stone_mushroom().done(), 4, 6, -2)
    put(crane().done(), 9, 4)
    put(rubble(3).done(), 3, 7)
    put(rubble(2).done(), 8, 7)
    put(rubble(1).done(), 10, 6)
    put(tool_shelf("front").done(), 1, 0)
    put(tool_shelf("side").done(), 11, 3, 0)
    put(picks().done(), 9, 0)
    put(picks(True).done(), 2, 4)
    put(plan_table().done(), 1, 8)
    return im


def wet(im):
    """Rang arrosé (la quête de Morillon) : la terre fonce, l'eau brille par gouttes."""
    a = np.array(im).astype(float)
    soil = set(C[k] for k in ("soil_l", "soil", "soil_d", "furrow"))
    for y in range(a.shape[0]):
        for x in range(a.shape[1]):
            if tuple(int(v) for v in a[y, x, :3]) in soil:
                a[y, x, :3] *= 0.68
                if hash2(x, y, 90) > 0.93:
                    a[y, x, :3] = (120, 190, 220)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


def pieces():
    side = pot_shelf("side").done().img()
    tside = tool_shelf("side").done().img()
    return {
        "morelRowA": morel_row(0).done(False).img(), "morelRowB": morel_row(1).done(False).img(), "morelRowC": morel_row(2).done(False).img(),
        "morelRowEmpty": morel_row_empty().done(False).img(),
        "morelRowAWet": wet(morel_row(0).done(False).img()), "morelRowBWet": wet(morel_row(1).done(False).img()),
        "morelRowCWet": wet(morel_row(2).done(False).img()),
        "caill0": caillebotis(0).img(), "caill1": caillebotis(1).img(), "caill2": caillebotis(2).img(),
        "potShelf": pot_shelf("front").done().img(), "potShelfBack": pot_shelf("back").done().img(),
        "potShelfL": side, "potShelfR": side.transpose(Image.FLIP_LEFT_RIGHT),
        "engrais1": fertilizer(1).done().img(), "engrais2": fertilizer(2).done().img(), "engrais3": fertilizer(3).done().img(),
        "arrosoir": watering_can().done().img(), "arrosoirTombe": watering_can(True).done().img(),
        "outils": tool_rack().done().img(), "brouette": wheelbarrow().done().img(),
        "champiPierre": stone_mushroom().done().img(), "grue": crane().done().img(),
        "gravats1": rubble(1).done().img(), "gravats2": rubble(2).done().img(), "gravats3": rubble(3).done().img(),
        "toolShelfS": tool_shelf("front").done().img(), "toolShelfSBack": tool_shelf("back").done().img(),
        "toolShelfSL": tside, "toolShelfSR": tside.transpose(Image.FLIP_LEFT_RIGHT),
        "pioches": picks().done().img(), "piocheSol": picks(True).done().img(), "planChampi": plan_table().done().img(),
    }


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        from export_jeu_v4 import write
        write("src/render/sprites/champiSalles.ts", "CHAMPI_SALLES",
              "Salles à thème de la section 2 (art/champi_salles_v1.png, 2026-11-14) : champignonnière de morilles, atelier de sculpture.",
              pieces())
    else:
        P = pieces()
        a, b = room_morilles(), room_atelier()
        both = Image.new("RGBA", (a.width + b.width + 16, max(a.height, b.height)), (26, 20, 14, 255))
        both.alpha_composite(a, (0, 0))
        both.alpha_composite(b, (a.width + 16, 0))
        planche("SALLES SECTION 2 v1 — champignonnière de morilles (à gauche), atelier de sculpture (à droite)", both, [
            ("rangs de morilles (3) / récolté", [P["morelRowA"], P["morelRowB"], P["morelRowC"], P["morelRowEmpty"]]),
            ("caillebotis (entier, planche manquante, glissée)", [P["caill0"], P["caill1"], P["caill2"]]),
            ("étagère à pots : fond / bas / gauche / droite", [P["potShelf"], P["potShelfBack"], P["potShelfL"], P["potShelfR"]]),
            ("sacs d'engrais 1 / 2 / 3", [P["engrais1"], P["engrais2"], P["engrais3"]]),
            ("arrosoirs", [P["arrosoir"], P["arrosoirTombe"]]),
            ("matériel agricole", [P["outils"], P["brouette"]]),
            ("champignon de pierre + échafaudages (3 × 3)", [P["champiPierre"]]),
            ("grue", [P["grue"]]),
            ("gravats 1 / 2 / 3", [P["gravats1"], P["gravats2"], P["gravats3"]]),
            ("étagère de matériel : fond / bas / gauche / droite", [P["toolShelfS"], P["toolShelfSBack"], P["toolShelfSL"], P["toolShelfSR"]]),
            ("pioches rouillées", [P["pioches"], P["piocheSol"]]),
            ("le plan du champignon", [P["planChampi"]]),
        ], "art/champi_salles_v1.png", S=3,
            note="Sols : terre battue (champignonnière), grandes dalles sombres et poussière de pierre (atelier).")
