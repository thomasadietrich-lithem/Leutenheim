"""Salle de concert (section 2), planche v1 (Thomas, 2026-11-18 : « chaises 4 à 8 tournées vers une estrade avec deux
rideaux rouges ; 0 à 1 piano, une harpe, un tambour » ; quête validée : « retrouver la partition »).

    python3 art/concert_v1.py          → art/concert_v1.png
    python3 art/export_salles_s2.py    → src/render/sprites/expo.ts et concert.ts

Dessinés par petites fonctions (rectangles, lignes) sur une grille de lettres : estrade et rideaux (4 × 2 cases, le
lambrequin déborde au-dessus), piano droit (2 cases), harpe, tambour, chaise vue de dos, pupitre du chef, le Maestro
(Kobold en queue-de-pie), et les icônes de la partition, du diapason et du Grand Poulet d'Or.
"""
from PIL import Image, ImageDraw

PAL = {
    "K": (26, 18, 12), "O": (30, 20, 34), "o": (46, 32, 52),
    "R": (196, 44, 56), "r": (132, 24, 36), "q": (232, 92, 96),
    "G": (240, 192, 80), "g": (168, 124, 28), "Y": (255, 226, 122),
    "T": (176, 120, 66), "B": (128, 82, 40), "b": (84, 52, 24),
    "W": (244, 240, 230), "w": (200, 196, 186), "x": (120, 116, 110),
    "N": (40, 36, 44), "n": (70, 64, 76),
    "A": (176, 188, 150), "a": (112, 124, 90), "L": (222, 220, 146),
    "S": (196, 204, 220), "s": (130, 138, 158),
}


class Grid:
    def __init__(self, w, h):
        self.w, self.h = w, h
        self.g = [["."] * w for _ in range(h)]

    def px(self, x, y, c):
        if 0 <= x < self.w and 0 <= y < self.h:
            self.g[y][x] = c

    def rect(self, x0, y0, x1, y1, c):
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.px(x, y, c)

    def box(self, x0, y0, x1, y1, fill, edge="K"):
        self.rect(x0, y0, x1, y1, edge)
        self.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)

    def rows(self, outline=True):
        """Contour sombre tout autour (style du jeu) : chaque case vide qui touche le dessin devient « K »."""
        if outline:
            src = [r[:] for r in self.g]
            for y in range(self.h):
                for x in range(self.w):
                    if src[y][x] != ".":
                        continue
                    if any(0 <= x + dx < self.w and 0 <= y + dy < self.h and src[y + dy][x + dx] not in ".K" for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                        self.g[y][x] = "K"
        return ["".join(r) for r in self.g]


def estrade():
    """4 × 2 cases (64 × 32) et 16 pixels au-dessus (lambrequin, fond de scène) : 64 × 48. v2 (Thomas, 2026-11-18 : « la
    profondeur de la scène n'est pas très bien représentée ») : le plancher en perspective (le bord du fond plus étroit, les
    lattes qui fuient vers le fond), un rideau de fond rouge sombre, les grands rideaux d'avant-scène drapés et noués,
    la rampe de lumières au bord, et la face avant de l'estrade."""
    g = Grid(64, 48)
    top, back, front, base = 0, 16, 37, 47
    # Rideau de fond, rouge sombre, plis serrés (le fond de la scène).
    g.rect(1, 1, 62, back + 2, "r")
    for x in range(3, 62, 3):
        g.rect(x, 6, x, back + 2, "o")
    # Les coulisses, dans l'ombre, de chaque côté du plancher.
    g.rect(1, back, 62, front, "O")
    # Plancher en perspective : du bord du fond (x 12 à 51) au bord avant (x 1 à 62).
    for y in range(back, front + 1):
        f = (y - back) / (front - back)
        x0 = round(12 - 11 * f)
        x1 = round(51 + 11 * f)
        g.rect(x0, y, x1, y, "T")
        # Les joints des lattes fuient vers le fond de la scène.
        for k in range(-3, 4):
            xb = 31.5 + k * 5.5
            xf = 31.5 + k * 9
            g.px(round(xb + (xf - xb) * f), y, "B")
    for y in range(back + 5, front, 6):
        f = (y - back) / (front - back)
        g.rect(round(12 - 11 * f), y, round(51 + 11 * f), y, "B")
    # Bord du fond (une ombre) ; rampe de lumières dorées au bord avant.
    g.rect(12, back, 51, back, "b")
    g.rect(1, front, 62, front, "b")
    for x in range(5, 60, 6):
        g.rect(x, front - 1, x + 1, front - 1, "Y")
        g.px(x, front - 2, "G")
    # Face avant de l'estrade : planches, deux montants.
    g.rect(0, front + 1, 63, base, "B")
    for y in (front + 4, front + 7):
        g.rect(1, y, 62, y, "b")
    for x in (10, 31, 53):
        g.rect(x, front + 1, x + 1, base - 1, "b")
    # Grands rideaux d'avant-scène, drapés : larges en haut, noués par une embrasse dorée, évasés en bas.
    def drape(side):
        for y in range(1, front + 1):
            if y < 22:
                w = 12 - (y - 1) * 5 // 21
            elif y < 25:
                w = 6
            else:
                w = 6 + (y - 25) * 6 // 12
            for i in range(w):
                x = i if side == 0 else 63 - i
                g.px(x, y, "q" if i % 3 == 1 else "R" if i % 3 == 0 else "r")
        for i in range(7):
            x = i if side == 0 else 63 - i
            g.px(x, 22, "G")
            g.px(x, 23, "g")
    drape(0)
    drape(1)
    # Lambrequin rouge à franges dorées, devant tout.
    g.rect(1, 1, 62, 4, "R")
    for x in range(1, 63, 4):
        g.rect(x, 1, x, 4, "r")
    g.rect(1, 5, 62, 5, "G")
    for x in range(2, 62, 3):
        g.px(x, 6, "g")
    # Contour.
    g.rect(0, 0, 63, 0, "K")
    g.rect(0, 0, 0, base, "K")
    g.rect(63, 0, 63, base, "K")
    g.rect(0, base, 63, base, "K")
    return g.rows(outline=False)


def piano():
    """Piano droit, 2 cases (32 × 26)."""
    g = Grid(32, 26)
    g.box(1, 2, 30, 18, "b")
    g.rect(2, 3, 29, 4, "B")
    g.rect(4, 6, 27, 12, "B")
    g.rect(14, 7, 17, 11, "G")
    # Clavier.
    g.box(0, 16, 31, 20, "W")
    for x in range(2, 30, 3):
        g.rect(x, 17, x, 18, "K")
    g.rect(1, 21, 30, 21, "b")
    g.rect(2, 22, 3, 25, "b")
    g.rect(28, 22, 29, 25, "b")
    g.rect(1, 25, 30, 25, "K")
    return g.rows()


def harpe():
    """Harpe dorée (16 × 26)."""
    g = Grid(16, 26)
    # Colonne et console dorées, table d'harmonie en bois.
    g.rect(2, 2, 3, 23, "G")
    g.rect(1, 2, 1, 23, "K")
    g.rect(4, 2, 4, 23, "g")
    for i in range(10):
        g.px(4 + i, 2 + i // 2, "G")
        g.px(4 + i, 1 + i // 2, "K")
    g.rect(13, 6, 14, 22, "B")
    g.rect(15, 6, 15, 22, "K")
    for x in range(6, 13, 2):
        g.rect(x, 4 + (x - 4) // 2, x, 21, "Y")
    g.rect(1, 23, 15, 24, "b")
    g.rect(1, 25, 15, 25, "K")
    return g.rows()


def tambour():
    """Tambour à cordes et ses baguettes (16 × 16)."""
    g = Grid(16, 16)
    g.box(2, 5, 13, 14, "R")
    g.rect(3, 4, 12, 6, "W")
    g.rect(2, 4, 2, 6, "K")
    g.rect(13, 4, 13, 6, "K")
    g.rect(3, 3, 12, 3, "K")
    g.rect(3, 7, 12, 7, "G")
    g.rect(3, 12, 12, 12, "G")
    for i, x in enumerate(range(3, 13, 3)):
        g.px(x, 8 + (i % 2), "W")
        g.px(x + 1, 10 - (i % 2), "W")
    # Baguettes croisées.
    for i in range(6):
        g.px(9 + i, 1 + i // 2, "T")
        g.px(14 - i, 1 + i // 2, "T")
    return g.rows()


def chaise_dos():
    """Chaise vue de dos (le public regarde la scène, en haut) : 16 × 18."""
    g = Grid(16, 18)
    g.box(3, 1, 12, 8, "T")
    g.rect(4, 3, 11, 3, "B")
    g.rect(4, 6, 11, 6, "B")
    g.box(2, 8, 13, 11, "B")
    g.rect(3, 12, 4, 17, "b")
    g.rect(11, 12, 12, 17, "b")
    g.rect(2, 12, 2, 17, "K")
    g.rect(13, 12, 13, 17, "K")
    return g.rows()


def pupitre():
    """Pupitre du chef, sa partition ouverte (16 × 20)."""
    g = Grid(16, 20)
    g.box(1, 2, 14, 9, "W")
    g.rect(7, 3, 8, 8, "w")
    for y in (4, 6):
        g.rect(2, y, 6, y, "x")
        g.rect(9, y, 13, y, "x")
    g.rect(7, 10, 8, 17, "N")
    g.rect(4, 18, 11, 18, "N")
    g.rect(3, 19, 12, 19, "K")
    return g.rows()


def icon_partition():
    g = Grid(16, 16)
    g.box(2, 1, 13, 14, "W")
    for y in (4, 7, 10):
        g.rect(3, y, 12, y, "x")
    for (x, y) in ((5, 3), (8, 6), (10, 9), (6, 9)):
        g.rect(x, y, x + 1, y + 1, "K")
        g.rect(x + 1, y - 3, x + 1, y, "K")
    g.rect(12, 2, 12, 13, "w")
    return g.rows()


def icon_diapason():
    g = Grid(16, 16)
    g.rect(4, 1, 5, 9, "S")
    g.rect(10, 1, 11, 9, "S")
    g.rect(3, 1, 3, 9, "K")
    g.rect(12, 1, 12, 9, "K")
    g.rect(4, 9, 11, 10, "S")
    g.rect(6, 10, 9, 10, "s")
    g.rect(7, 11, 8, 14, "s")
    g.rect(6, 15, 9, 15, "K")
    for (x, y) in ((1, 3), (14, 3), (1, 6), (14, 6)):
        g.px(x, y, "Y")
    return g.rows()


def icon_poulet_or():
    """Le Grand Poulet d'Or, statuette (icône de quête)."""
    g = Grid(16, 16)
    g.box(4, 3, 11, 10, "G")
    g.rect(5, 2, 7, 2, "R")
    g.rect(11, 5, 13, 6, "Y")
    g.px(9, 5, "K")
    g.rect(2, 6, 4, 8, "g")
    g.rect(6, 11, 6, 12, "g")
    g.rect(9, 11, 9, 12, "g")
    g.box(3, 12, 12, 15, "B")
    return g.rows()


S = {
    "estrade": estrade(),
    "piano": piano(),
    "harpe": harpe(),
    "tambour": tambour(),
    "chaiseDos": chaise_dos(),
    "pupitreChef": pupitre(),
    "partition (icône)": icon_partition(),
    "diapason (icône)": icon_diapason(),
    "Grand Poulet d'Or (icône)": icon_poulet_or(),
}


def render():
    scale = 5
    pad = 20
    x = pad
    hmax = max(len(r) for r in S.values())
    img = Image.new("RGB", (sum(len(r[0]) * scale + pad for r in S.values()) + pad, hmax * scale + 2 * pad), (20, 17, 24))
    d = ImageDraw.Draw(img)
    for rows in S.values():
        for yy, row in enumerate(rows):
            for xx, ch in enumerate(row):
                if ch != ".":
                    d.rectangle([x + xx * scale, pad + yy * scale, x + (xx + 1) * scale - 1, pad + (yy + 1) * scale - 1], fill=PAL[ch])
        x += len(rows[0]) * scale + pad
    img.save("art/concert_v1.png")
    print(img.size)


if __name__ == "__main__":
    render()
