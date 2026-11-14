"""Monstres de la section 2 (champignonnière), v1 — planche à valider (Thomas, 2026-11-14 : « design les sprites du top 4
des Mobs du brief. Leur comportement individuel et stratégie. Les sprites doivent couvrir tous les états »).

Le top 4 du brief (claude/BRIEF_CHAMPIGNONNIERE.md §7) : MYCONIDE, SPORELIN, KOBOLD CUEILLEUR, KOBOLD ENVAHI.
Même format que le Kobold du jeu (src/render/sprites/schrat.ts) : 16 × 16, lignes de lettres, une palette, contour sombre
« O » ajouté tout autour ; vues face (Down), profil vers la droite (Side, retourné en jeu), dos (Up).
États couverts pour chacun : repos ×2, marche ×2, attaque ×2 (dans les trois vues), touché, endormi, mort, à terre ×2,
se relève — plus les états propres (le myconide « écoute », le sporelin éclate, l'envahi se relève une fois, brûlé).
Les deux Kobolds reprennent le dessin du Kobold du jeu (on reconnaît la famille) avec masque et panier, ou champignon.

  python3 art/mobs_champi_v1.py          → art/mobs_champi_v1.png (planche) et art/mobs_champi_v1_salle.png
  python3 art/mobs_champi_v1.py export   → src/render/sprites/mobsChampi.ts (après validation)
"""
import json, math, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from pix import font, grid, to_img, up

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(HERE, "..", "src", "render", "sprites", "schrat.ts")).read()
KPAL = dict(re.findall(r'(\w): "(#[0-9a-f]{6})"', SRC[SRC.index("SCHRAT_PALETTE"):SRC.index("};")]))
ATERRE = open(os.path.join(HERE, "..", "src", "render", "sprites", "aterre.ts")).read()


def kframes(name):
    i = SRC.index(f"  {name}: [")
    j = SRC.index("\n  ],", i)
    return [re.findall(r'"([^"]+)"', blk) for blk in SRC[i:j].split("    [")[1:]]


def aterre(name):
    i = ATERRE.index(f"  {name}: [")
    j = ATERRE.index("],", i)
    return re.findall(r'"([^"]+)"', ATERRE[i:j])


# ---------------------------------------------------------------- petit outil de dessin
class G:
    """Grille 16 × 16 de lettres ; on peint l'intérieur, `done()` pose le contour sombre."""

    def __init__(self, rows=None):
        self.a = [list(r) for r in rows] if rows else [["."] * 16 for _ in range(16)]

    def p(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < 16 and 0 <= y < 16:
            self.a[y][x] = c
        return self

    def get(self, x, y):
        return self.a[y][x] if 0 <= x < 16 and 0 <= y < 16 else "."

    def r(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.p(xx, yy, c)
        return self

    def ell(self, cx, cy, rx, ry, c, shade=None, light=None):
        """Ellipse pleine ; `shade` en bas à droite, `light` en haut à gauche."""
        for y in range(16):
            for x in range(16):
                d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2
                if d <= 1:
                    k = c
                    if shade and (x + 0.5 - cx) / rx + (y + 0.5 - cy) / ry > 0.75:
                        k = shade
                    if light and (x + 0.5 - cx) / rx + (y + 0.5 - cy) / ry < -0.95 and d < 0.6:
                        k = light
                    self.p(x, y, k)
        return self

    def shift(self, dx, dy):
        b = [["."] * 16 for _ in range(16)]
        for y in range(16):
            for x in range(16):
                if self.a[y][x] != "." and 0 <= x + dx < 16 and 0 <= y + dy < 16:
                    b[y + dy][x + dx] = self.a[y][x]
        self.a = b
        return self

    def done(self):
        b = [r[:] for r in self.a]
        for y in range(16):
            for x in range(16):
                if self.a[y][x] != ".":
                    continue
                if any(self.get(x + dx, y + dy) not in (".", "O") for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    b[y][x] = "O"
        self.a = b
        return ["".join(r) for r in self.a]


def flip(rows):
    return [r[::-1] for r in rows]


# ---------------------------------------------------------------- 1. MYCONIDE
MYCO = {"O": "#18121e", "P": "#6e5a86", "p": "#3e3050", "Q": "#9a86b4", "S": "#c4b4d6", "W": "#e6dcc4", "w": "#a89878",
        "G": "#6af0d2", "g": "#2a8a78", "R": "#6e5236", "r": "#3e2c1e", "D": "#3a2a2a"}


def myco_cap(g, cx, cy, rx=6.4, ry=3.3, spots=((5, 3), (9, 2), (11, 4)), gills=True, glow=False):
    g.ell(cx, cy, rx, ry, "P", "p", "Q")
    # Pas de pois blancs (trop « champignon de dessin animé ») : des écailles pâles, en petits traits.
    for sx, sy in spots:
        g.p(sx + (cx - 8), sy + (cy - 4), "S").p(sx + (cx - 8) + 1, sy + (cy - 4), "Q")
    if gills:
        y = int(cy + ry - 0.6)
        for x in range(int(cx - rx + 2), int(cx + rx - 1)):
            g.p(x, y, ("G" if glow or x % 2 else "g"))


def myco_body(g, x0=5, y0=7, h=6, w=6, arms="down", feet=0):
    g.r(x0, y0, w, h, "W")
    g.r(x0 + w - 1, y0, 1, h, "w")
    g.p(x0 + 1, y0 + 1, "D").p(x0 + w - 2, y0 + 1, "D")  # deux creux à la place des yeux : il est aveugle
    g.r(x0 + 2, y0 + 3, 2, 1, "w")  # la bouche, une fente
    if arms == "down":
        g.r(x0 - 1, y0 + 2, 1, 3, "w").r(x0 + w, y0 + 2, 1, 3, "w")
    elif arms == "up":
        g.r(x0 - 1, y0 - 1, 1, 3, "w").r(x0 + w, y0 - 1, 1, 3, "w")
    elif arms == "fwd":
        g.r(x0 + w, y0 + 2, 3, 1, "w").p(x0 + w + 2, y0 + 3, "w")
    # Pieds-racines : `feet` = -1 / 0 / 1 (le pas).
    fy = y0 + h
    lx, rx_ = x0 + 1, x0 + w - 2
    g.r(lx - (1 if feet < 0 else 0), fy - (1 if feet > 0 else 0), 2, 2 if feet <= 0 else 1, "R")
    g.r(rx_ - (0 if feet > 0 else 0), fy - (1 if feet < 0 else 0), 2, 2 if feet >= 0 else 1, "R")
    g.p(lx - 1, fy + 1, "r").p(rx_ + 2, fy + 1, "r")


def myconide(state, view="Down", f=0):
    g = G()
    bob = 1 if (state == "idle" and f == 1) else 0
    if view == "Down":
        if state == "attack" and f == 0:  # il se dresse, chapeau levé, bras en l'air
            myco_body(g, 5, 6, 7, arms="up")
            myco_cap(g, 8, 3, gills=True)
        elif state == "attack":  # il s'abat : le chapeau plonge, une bouffée de spores
            myco_body(g, 5, 8, 5, arms="down")
            myco_cap(g, 8, 6.5, rx=7, ry=3.2, glow=True)
            for x, y in ((1, 12), (14, 11), (2, 14), (13, 14), (0, 9)):
                g.p(x, y, "G")
        else:
            myco_body(g, 5, 7 + bob, 6 - bob, arms="down", feet=(0 if state == "idle" else (-1 if f == 0 else 1)))
            myco_cap(g, 8 + (0 if state == "idle" else (f * 2 - 1) * 0.5), 4 + bob)
    elif view == "Side":
        lean = 1 if state == "walk" else 0
        if state == "attack" and f == 0:
            g.r(6, 6, 4, 7, "W").r(9, 6, 1, 7, "w").r(5, 5, 1, 3, "w")
            g.r(6, 13, 2, 2, "R").r(8, 13, 2, 2, "R")
            myco_cap(g, 7, 3, rx=6, gills=True, spots=((4, 3), (8, 2)))
        elif state == "attack":
            g.r(6, 8, 4, 5, "W").r(9, 8, 1, 5, "w").r(10, 10, 3, 1, "w")
            g.r(6, 13, 2, 2, "R").r(8, 13, 2, 2, "R")
            myco_cap(g, 10, 6.5, rx=6, ry=3, glow=True, spots=((8, 3), (11, 2)))
            for x, y in ((15, 9), (14, 12), (15, 13)):
                g.p(x, y, "G")
        else:
            g.r(6, 7 + bob, 4, 6 - bob, "W").r(9, 7 + bob, 1, 6 - bob, "w")
            g.p(9, 8 + bob, "D")
            g.r(10, 9 + bob, 1, 3, "w")
            step = 0 if state == "idle" else (f * 2 - 1)
            g.r(6 - step, 13, 2, 2, "R").r(8 + step, 13, 2, 2, "R")
            myco_cap(g, 8 + lean, 4 + bob, rx=6.2, spots=((5, 3), (9, 2)))
    else:  # Up : le dessus du chapeau, taché ; pas de branchies
        if state == "attack":
            ys = 2.5 if f == 0 else 5.5
            g.r(5, 7, 6, 6, "W").r(10, 7, 1, 6, "w")
            g.r(6, 13, 2, 2, "R").r(9, 13, 2, 2, "R")
            myco_cap(g, 8, ys, rx=6.6 if f else 6, ry=3.6, gills=False, spots=((4, 3), (7, 1), (10, 3), (12, 2), (7, 5)))
        else:
            g.r(5, 8 + bob, 6, 5 - bob, "W").r(10, 8 + bob, 1, 5 - bob, "w")
            step = 0 if state == "idle" else (f * 2 - 1)
            g.r(6 + step, 13, 2, 2, "R").r(9 - step, 13, 2, 2, "R")
            myco_cap(g, 8, 4.5 + bob, rx=6.6, ry=3.8, gills=False, spots=((4, 3), (7, 1), (10, 3), (12, 2), (7, 5)))
    return g.done()


def myconide_extra(name):
    g = G()
    if name == "hurt":  # secoué : penché, des spores qui tombent du chapeau
        g.r(6, 7, 6, 6, "S").r(11, 7, 1, 6, "w").p(7, 8, "D").p(10, 8, "D")
        g.r(6, 13, 2, 2, "R").r(10, 13, 2, 2, "R")
        g.ell(9, 4, 6.2, 3, "Q", "P")
        for x, y in ((2, 9), (4, 11), (14, 9), (3, 6)):
            g.p(x, y, "G")
    elif name == "sleep":  # enraciné, chapeau baissé jusqu'au sol, branchies éteintes
        g.r(5, 11, 6, 3, "W").r(10, 11, 1, 3, "w")
        g.r(4, 14, 3, 1, "R").r(9, 14, 3, 1, "R")
        myco_cap(g, 8, 10, rx=7, ry=3, gills=False)
    elif name == "dead":  # le chapeau tombé de côté, le pied cassé
        g.ell(5.5, 12.5, 5, 2.4, "p", "D")
        g.p(3, 12, "w").p(6, 11, "w")
        g.r(10, 13, 4, 2, "W").r(13, 13, 1, 2, "w").p(10, 12, "w")
        g.p(14, 15, "r").p(9, 15, "r")
    elif name in ("listen0", "listen1"):  # il « écoute » le sol : le chapeau s'incline, les branchies s'allument par vagues
        myco_body(g, 5, 8, 5, arms="down")
        myco_cap(g, 8, 5, rx=6.8, glow=(name == "listen1"))
        for x, y in (((3, 2), (12, 1)) if name == "listen0" else ((2, 0), (13, 0), (8, 0))):
            g.p(x, y, "G")
    elif name in ("prone0", "prone1"):  # renversé sur le dos : on voit les branchies, les racines pédalent
        g.ell(6, 11, 5.5, 3, "P", "p")
        for x in range(2, 11):
            g.p(x, 9, "G" if x % 2 else "g")
        g.r(10, 9, 4, 3, "W").r(10, 11, 4, 1, "w")
        k = 0 if name == "prone0" else 1
        g.r(14, 8 - k, 1, 2, "R").r(14, 11 + k, 1, 2, "R")
    elif name == "getUp":
        g.r(6, 9, 5, 4, "W").r(10, 9, 1, 4, "w")
        g.r(5, 13, 3, 2, "R").r(9, 13, 2, 2, "R")
        myco_cap(g, 7, 7, rx=6, ry=2.8, gills=True)
    return g.done()


# ---------------------------------------------------------------- 2. SPORELIN
SPOR = {"O": "#18121e", "B": "#bcae70", "b": "#7c6c3e", "H": "#ece2a8", "E": "#1a1420", "e": "#f8f6e8", "k": "#4e4026",
        "L": "#3a2e1e", "Y": "#c8e06a", "y": "#86b03c", "M": "#e86a5a"}


def sporelin(state, view="Down", f=0):
    g = G()
    hop = -2 if (state == "walk" and f == 0) else 0
    squash = state == "walk" and f == 1
    cy = 10.5 + hop + (0.5 if squash else 0)
    rx, ry = (4.6, 3.3) if squash else (4, 3.8)
    if state == "attack":
        rx, ry, cy = (5, 4.4, 9.5) if f == 0 else (3.7, 3.3, 11)
    if state == "idle" and f == 1:
        ry, cy = 3.6, 10.7
    cx = 8 if view != "Side" else 7.5
    g.ell(cx, cy, rx, ry, "B", "b", "H")
    top = int(cy - ry)
    g.p(int(cx), top + 1, "k")  # le pore au sommet
    if view == "Down":
        ey = int(cy) - 1
        g.p(int(cx) - 2, ey, "E").p(int(cx) + 1, ey, "E").p(int(cx) - 2, ey - 1, "e").p(int(cx) + 1, ey - 1, "e")
        if state == "attack" and f == 0:
            g.r(int(cx) - 1, ey + 2, 2, 1, "M")  # il gonfle les joues
    elif view == "Side":
        ey = int(cy) - 1
        g.p(int(cx) + 2, ey, "E").p(int(cx) + 2, ey - 1, "e")
    else:
        g.p(int(cx) - 2, top + 2, "k").p(int(cx) + 2, top + 3, "k")  # des pores sur le dos
    # Pattes
    by = int(cy + ry)
    if hop == 0:
        g.p(int(cx) - 2, by, "L").p(int(cx) + 1, by, "L")
    else:
        g.p(int(cx) - 2, by, "L").p(int(cx) + 1, by + 1, "L").p(int(cx) - 3, by + 1, "L")
    if state == "attack" and f == 1:  # la bouffée vers l'avant (vers le bas en face, la droite de profil)
        pts = ((4, 1), (6, 0), (9, 1), (11, 0), (7, 2), (5, 3), (10, 3)) if view == "Up" else \
              ((12, 7), (14, 8), (13, 10), (15, 11), (13, 12), (14, 6)) if view == "Side" else \
              ((4, 15), (6, 14), (9, 15), (11, 14), (7, 15), (3, 13), (12, 13))
        for i, (x, y) in enumerate(pts):
            g.p(x, y, "Y" if i % 2 else "y")
    return g.done()


def sporelin_extra(name):
    g = G()
    if name == "hurt":
        g.ell(8, 11, 4.8, 3, "H", "B")
        g.r(5, 9, 2, 1, "E").r(9, 9, 2, 1, "E")  # yeux plissés
    elif name == "sleep":
        g.ell(8, 12.5, 4.6, 2.6, "B", "b")
        g.r(6, 12, 1, 1, "E").r(9, 12, 1, 1, "E")
        g.p(8, 10, "k")
    elif name.startswith("burst"):  # il éclate en nuage à sa mort (3 images), puis la peau vide
        k = int(name[-1])
        if k == 0:
            g.ell(8, 9.5, 5.5, 5, "H", "B")
            g.p(6, 8, "E").p(9, 8, "E").r(7, 11, 2, 1, "M")
        else:
            rr = 4 + k * 2.2
            for y in range(16):
                for x in range(16):
                    d = ((x + 0.5 - 8) / rr) ** 2 + ((y + 0.5 - 9) / (rr * 0.85)) ** 2
                    if d <= 1 and (x * 7 + y * 13 + k) % (3 if k == 1 else 4) != 0:
                        g.p(x, y, "Y" if (x + y) % 3 else "y")
            if k == 1:
                g.ell(8, 11, 3, 1.6, "b")
    elif name == "dead":
        g.ell(8, 13.5, 4.6, 1.5, "b", "k")
        g.p(6, 13, "B").p(10, 13, "B")
    elif name in ("prone0", "prone1"):
        g.ell(8, 11, 4.2, 3.4, "B", "b", "H")
        k = 0 if name == "prone0" else 1
        g.p(5, 7 - k, "L").p(10, 7 + k - 1, "L").p(5, 8, "L").p(10, 8, "L")
        g.p(6, 12, "E").p(9, 12, "E")
    elif name == "getUp":
        g.ell(8, 11, 4.2, 3.5, "B", "b", "H")
        g.p(6, 10, "E").p(9, 10, "E").p(6, 14, "L").p(9, 15, "L")
    return g.done()


# ---------------------------------------------------------------- 3. KOBOLD CUEILLEUR (masque, panier, serpette)
CUEIL = {**KPAL, "C": "#8a6a44", "c": "#5a4228", "M": "#c9ccd2", "m": "#7e8590", "X": "#d6ceb2", "x": "#7e7660",
         "V": "#b48a48", "v": "#6e5026", "A": "#9cb63e", "a": "#5c7426", "S": "#efe2c4", "N": "#6af0d2"}


def mask(rows, y0=7, y1=10):
    g = G(rows)
    for y in range(y0, y1 + 1):
        for x in range(16):
            if g.a[y][x] in ("L", "K") and not (y <= 7 and g.a[y][x] == "K"):
                g.a[y][x] = "x" if (x + y) % 3 == 0 else "X"
    return g


def basket_back(g, view, dy=0):
    if view == "Up":
        g.r(4, 8 + dy, 8, 5, "V")
        for x in range(4, 12):
            g.p(x, 8 + dy, "v")
            g.p(x, 10 + dy, "v" if x % 2 else "V")
        g.r(4, 12 + dy, 8, 1, "v")
        g.p(3, 9 + dy, "O").p(12, 9 + dy, "O")
    elif view == "Side":
        g.r(1, 9 + dy, 3, 4, "V")
        g.p(1, 9 + dy, "v").p(2, 9 + dy, "v").p(3, 9 + dy, "v").p(2, 11 + dy, "v")
    else:  # de face : les sangles sur les épaules, le bord du panier dépasse derrière la tête
        for y in (10 + dy, 11 + dy):
            if g.a[y][4] not in ("."):
                g.a[y][4] = "v"
            if g.a[y][11] not in ("."):
                g.a[y][11] = "v"
        for x in (2, 3, 12, 13):
            if g.a[7 + dy][x] == ".":
                g.p(x, 7 + dy, "V")


def kobold_variant(rows, view, kind):
    top = next(y for y, r in enumerate(rows) if r.strip("."))
    if kind == "cueilleur":
        g = mask(rows, top + 5, top + 8)
        g2 = G()
        g2.a = [r[:] for r in g.a]
        if view == "Up":
            basket_back(g2, "Up", top - 2)
        elif view == "Side":
            basket_back(g2, "Side", top - 2)
        else:
            basket_back(g2, "Down", top - 2)
        return ["".join(r) for r in g2.a]
    # envahi : un champignon bleu-vert lui pousse sur le crâne, des fils de mycélium sur le corps
    g = G(rows)
    off = {"Down": 6, "Side": 5, "Up": 7}[view]
    for y in range(16):
        for x in range(16):
            d = ((x + 0.5 - off) / 4.2) ** 2 + ((y + 0.5 - (top - 0.2)) / 2.0) ** 2
            if d <= 1 and y < top + 1:
                g.p(x, y, "n" if y == top else ("N" if (x + y) % 5 else "S"))
    g.p(off, top + 1, "F").p(off - 1, top + 1, "F")
    for x, y in ((5, top + 10), (10, top + 9), (11, top + 11)):
        if g.get(x, y) in "CcAaLH":
            g.p(x, y, "F")
    a = ["".join(r) for r in g.a]
    # contour du chapeau
    g3 = G()
    g3.a = [list(r) for r in a]
    for y in range(16):
        for x in range(16):
            if g3.a[y][x] == "." and any(g3.get(x + dx, y + dy) in "NnS" for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                g3.a[y][x] = "O"
    return ["".join(r) for r in g3.a]


ENV = {**KPAL, "A": "#7f9a84", "a": "#4c6252", "Y": "#a8fff0", "L": "#c6d2c0", "C": "#7a7f86", "c": "#4a4e56",
       "N": "#4ec8b0", "n": "#25786a", "S": "#e6f6ee", "F": "#e2ece4", "T": "#c6c4a8"}
ENV_BURNT = {**ENV, "N": "#3a302c", "n": "#1e1816", "S": "#6a5a50", "F": "#5a4c44", "A": "#5a5a4c", "a": "#36362c"}


def kobold_set(kind):
    out = {}
    for st, nm in (("idle", "idle"), ("walk", "walk"), ("attack", "stab")):
        for v in ("Down", "Side", "Up"):
            for f, rows in enumerate(kframes(f"{nm}{v}")):
                out[f"{st}{v}{f}"] = kobold_variant(rows, v, kind)
    out["hurt"] = kobold_variant(kframes("hurt")[0], "Side", kind)
    out["sleep"] = kobold_variant(kframes("sleep")[0], "Down", kind) if kind == "envahi" else mask(kframes("sleep")[0], 9, 12).done()
    out["dead"] = kobold_variant(kframes("dead")[0], "Down", kind) if kind == "envahi" else kframes("dead")[0]
    out["prone0"] = aterre("prone0")
    out["prone1"] = aterre("prone1")
    out["getUp"] = kobold_variant(aterre("getUp"), "Side", kind)
    if kind == "cueilleur":
        # Le panier tombé (butin) : un dessin à part, posé au sol à sa mort.
        g = G()
        g.r(4, 9, 8, 5, "V").r(4, 9, 8, 1, "v").r(4, 13, 8, 1, "v")
        for x in range(5, 11, 2):
            g.p(x, 11, "v")
        g.r(3, 7, 1, 2, "v").r(12, 7, 1, 2, "v").r(4, 6, 8, 1, "v")
        g.p(6, 8, "S").p(9, 8, "N").p(7, 8, "N")  # des champignons cueillis dépassent
        out["basket"] = g.done()
    else:
        # Il se relève UNE fois (le champignon le remet debout), sauf s'il a brûlé.
        dead = kframes("dead")[0]
        out["rise0"] = kobold_variant(dead, "Down", kind)
        out["rise1"] = out["getUp"]
    return out


def all_sets():
    myco = {}
    for st in ("idle", "walk", "attack"):
        for v in ("Down", "Side", "Up"):
            for f in (0, 1):
                myco[f"{st}{v}{f}"] = myconide(st, v, f)
    for n in ("hurt", "sleep", "dead", "prone0", "prone1", "getUp", "listen0", "listen1"):
        myco[n] = myconide_extra(n)
    spor = {}
    for st in ("idle", "walk", "attack"):
        for v in ("Down", "Side", "Up"):
            for f in (0, 1):
                spor[f"{st}{v}{f}"] = sporelin(st, v, f)
    for n in ("hurt", "sleep", "dead", "prone0", "prone1", "getUp", "burst0", "burst1", "burst2"):
        spor[n] = sporelin_extra(n)
    return {"myconide": (myco, MYCO), "sporelin": (spor, SPOR), "cueilleur": (kobold_set("cueilleur"), CUEIL),
            "envahi": (kobold_set("envahi"), ENV)}


def img(rows, pal):
    im = Image.new("RGBA", (16, 16))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ".":
                h = pal[c]
                im.putpixel((x, y), (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255))
    return im


NAMES = {"myconide": "MYCONIDE", "sporelin": "SPORELIN", "cueilleur": "KOBOLD CUEILLEUR", "envahi": "KOBOLD ENVAHI"}


def sheet(sets):
    S = 4
    cell = 16 * S + 6
    groups = [("repos", "idle"), ("marche", "walk"), ("attaque", "attack")]
    extras = {"myconide": ["hurt", "sleep", "dead", "prone0", "prone1", "getUp", "listen0", "listen1"],
              "sporelin": ["hurt", "sleep", "prone0", "prone1", "getUp", "burst0", "burst1", "burst2", "dead"],
              "cueilleur": ["hurt", "sleep", "dead", "prone0", "prone1", "getUp", "basket"],
              "envahi": ["hurt", "sleep", "dead", "rise0", "rise1", "getUp", "deadBurnt"]}
    labels = {"hurt": "touché", "sleep": "dort", "dead": "mort", "prone0": "à terre", "prone1": "à terre", "getUp": "se relève",
              "listen0": "écoute", "listen1": "écoute", "burst0": "éclate", "burst1": "éclate", "burst2": "éclate", "basket": "panier (butin)",
              "rise0": "se relève 1×", "rise1": "se relève 1×", "deadBurnt": "brûlé : reste mort"}
    blockW = 20 + 18 * cell + 20
    W = blockW
    H = 50 + len(sets) * (40 + 2 * (cell + 18) + 10)
    sh = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(sh)
    d.text((W // 2, 22), "MONSTRES SECTION 2 v1 — à valider : tous les états (face, profil, dos)", fill=(255, 243, 200), font=font(15), anchor="mm")
    y = 50
    for key, (frames, pal) in sets.items():
        d.text((20, y + 6), NAMES[key], fill=(255, 215, 94), font=font(14))
        y += 30
        x = 20
        for gl, st in groups:
            d.text((x, y), gl, fill=(200, 190, 170), font=font(10, False))
            for v in ("Down", "Side", "Up"):
                for f in (0, 1):
                    bg = Image.new("RGB", (16 * S + 4, 16 * S + 4), (70, 61, 82))
                    bg.paste(up(img(frames[f"{st}{v}{f}"], pal), S), (2, 2), up(img(frames[f"{st}{v}{f}"], pal), S))
                    sh.paste(bg, (x, y + 14))
                    x += cell
            x += 0
        y += cell + 18
        x = 20
        for n in extras[key]:
            rows = frames.get(n)
            p = pal
            if n == "deadBurnt":
                rows, p = frames["dead"], ENV_BURNT
            bg = Image.new("RGB", (16 * S + 4, 16 * S + 4), (70, 61, 82))
            im = up(img(rows, p), S)
            bg.paste(im, (2, 2), im)
            sh.paste(bg, (x, y + 14))
            d.text((x, y), labels[n], fill=(200, 190, 170), font=font(10, False))
            x += cell
        y += cell + 28
    return sh


def room(sets):
    from champi_sols_v1 import floor_cobbles
    W, H = 10 * 16, 5 * 16
    xs, ys = grid(W, H)
    im = to_img(floor_cobbles(xs, ys)).convert("RGBA")
    spots = [("myconide", "idleDown0", 2, 1), ("myconide", "listen1", 4, 2), ("sporelin", "idleDown0", 6, 1), ("sporelin", "walkSide0", 7, 3),
             ("cueilleur", "idleDown0", 3, 3), ("cueilleur", "basket", 1, 3), ("envahi", "idleSide0", 8, 2), ("sporelin", "burst2", 5, 4)]
    for key, n, cx, cy in spots:
        frames, pal = sets[key]
        sp = img(frames[n], pal)
        im.alpha_composite(sp, (cx * 16, cy * 16))
    return im


def export(sets):
    out = ["// FICHIER GÉNÉRÉ par art/mobs_champi_v1.py export : ne pas modifier à la main.",
           "/** Monstres de la section 2 (planche art/mobs_champi_v1.png) : myconide, sporelin, Kobold cueilleur, Kobold envahi. */",
           "export const MOBS_CHAMPI: Record<string, { palette: Record<string, string>; frames: Record<string, readonly string[]> }> = {"]
    for key, (frames, pal) in sets.items():
        out.append(f"  {key}: {{ palette: {json.dumps(pal)}, frames: {{")
        for n, rows in frames.items():
            out.append(f"    {n}: {json.dumps(rows)},")
        out.append("  } },")
    out.append("};")
    open(os.path.join(HERE, "..", "src", "render", "sprites", "mobsChampi.ts"), "w").write("\n".join(out) + "\n")


if __name__ == "__main__":
    sets = all_sets()
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        export(sets)
    else:
        sheet(sets).save(os.path.join(HERE, "mobs_champi_v1.png"))
        up(room(sets).convert("RGB"), 4).save(os.path.join(HERE, "mobs_champi_v1_salle.png"))
        print("ok")
