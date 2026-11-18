"""Blasons des voies du Guerrier, planche v2 (Thomas, 2026-11-18 : la v1 refusée, « propose tout »). Rien en jeu.

    python3 art/blasons_voies_v2.py   → art/blasons_voies_v2.png

Huit pistes, chacune sur une BANNIÈRE (pas un écu : le picto des pouvoirs reste rond et l'écu de la v1 faisait « icône »),
pendue à sa hampe dorée, bas fendu en queue d'aronde, 32 × 40 :
  Ténacité (bleue) : A le chêne, B la tortue, C la montagne, D le rempart ;
  Fureur (rouge)   : A le sanglier, B l'épée flamboyante, C les cornes du taureau, D l'éclair.
"""
from PIL import Image, ImageDraw, ImageFont
from concert_v1 import Grid

PAL = {
    "K": (26, 18, 12), "G": (240, 192, 80), "g": (168, 124, 28), "Y": (255, 226, 122),
    "U": (58, 120, 190), "u": (34, 74, 128), "V": (150, 200, 240),
    "R": (196, 46, 56), "r": (126, 24, 34), "q": (236, 110, 104),
    "W": (244, 240, 230), "w": (196, 192, 182), "x": (120, 116, 110), "B": (120, 78, 40), "b": (78, 50, 24),
    "E": (92, 168, 80), "e": (46, 104, 46), "O": (232, 120, 42),
}


def banner(field, dark):
    g = Grid(32, 40)
    g.rect(2, 1, 29, 2, "G")
    g.rect(1, 1, 1, 2, "g")
    g.rect(30, 1, 30, 2, "g")
    for y in range(3, 39):
        for x in range(5, 27):
            notch = y > 30 and abs(x - 15.5) < (y - 30) * 1.4
            if not notch:
                g.px(x, y, field)
    for y in range(3, 33):
        g.px(5, y, dark)
        g.px(26, y, dark)
    for y in range(4, 34, 5):
        g.px(25, y, dark)
    return g


def oak(g):
    for y in range(7, 21):
        for x in range(8, 24):
            if ((x - 15.5) / 7.5) ** 2 + ((y - 13.5) / 6.8) ** 2 <= 1:
                g.px(x, y, "E" if (x * 7 + y * 3) % 5 else "e")
    g.rect(14, 20, 17, 28, "B"); g.rect(12, 28, 19, 29, "B"); g.rect(15, 21, 15, 27, "b")


def turtle(g):
    for y in range(12, 25):
        for x in range(7, 25):
            if ((x - 15.5) / 8) ** 2 + ((y - 19) / 6.5) ** 2 <= 1 and y <= 23:
                g.px(x, y, "e" if (x + y) % 4 == 0 else "E")
    g.rect(23, 18, 26, 21, "E"); g.px(25, 19, "K")
    for x in (9, 14, 18, 22):
        g.rect(x, 24, x + 1, 26, "E")


def mountain(g):
    for y in range(8, 29):
        w = (y - 8) * 10 // 20
        g.rect(16 - w, y, 15 + w, y, "w")
    for y in range(8, 14):
        w = (y - 8) * 10 // 20
        g.rect(16 - w, y, 15 + w, y, "W")
    for y in range(17, 29):
        w = (y - 17) * 5 // 11
        g.rect(9 - w, y, 8 + w + 1, y, "x")


def rampart(g):
    g.rect(7, 13, 24, 28, "w")
    for x in (7, 11, 15, 19, 23):
        g.rect(x, 10, x + 1, 12, "w")
    for y in (17, 21, 25):
        g.rect(8, y, 23, y, "x")
    for y, off in ((14, 0), (18, 2), (22, 0), (26, 2)):
        for x in range(9 + off, 23, 4):
            g.px(x, y + 1, "x")
    g.rect(14, 22, 17, 28, "K")


def boar(g):
    for y in range(10, 25):
        for x in range(8, 24):
            if ((x - 15.5) / 7) ** 2 + ((y - 17) / 7) ** 2 <= 1:
                g.px(x, y, "b" if y < 13 else "B")
    g.rect(13, 21, 18, 25, "q"); g.px(14, 23, "K"); g.px(17, 23, "K")
    g.rect(10, 22, 11, 26, "W"); g.rect(20, 22, 21, 26, "W")
    g.px(12, 16, "Y"); g.px(19, 16, "Y")
    g.rect(8, 8, 10, 11, "b"); g.rect(21, 8, 23, 11, "b")


def flaming_sword(g):
    g.rect(15, 6, 16, 23, "W"); g.rect(14, 8, 14, 22, "w")
    for y in range(6, 22, 3):
        g.px(17, y, "O"); g.px(18, y + 1, "Y"); g.px(13, y + 1, "O")
    g.rect(11, 23, 20, 24, "G"); g.rect(15, 25, 16, 29, "B"); g.rect(14, 30, 17, 30, "G")


def horns(g):
    for i in range(10):
        g.px(9 - i // 3, 18 - i, "W"); g.px(10 - i // 3, 18 - i, "w")
        g.px(22 + i // 3, 18 - i, "W"); g.px(21 + i // 3, 18 - i, "w")
    g.rect(10, 16, 21, 26, "b"); g.rect(12, 26, 19, 28, "B"); g.px(13, 20, "K"); g.px(18, 20, "K")
    g.px(14, 27, "K"); g.px(17, 27, "K")


def bolt(g):
    pts = [(19, 6), (12, 17), (16, 17), (11, 29), (21, 15), (17, 15), (22, 6)]
    for y in range(6, 30):
        for x in range(8, 24):
            if inside(pts, x + 0.5, y + 0.5):
                g.px(x, y, "Y")
    for y in range(6, 30):
        for x in range(8, 24):
            if g.g[y][x] == "Y" and (g.g[y][x - 1] != "Y"):
                g.px(x, y, "G")


def inside(poly, x, y):
    c = False
    j = len(poly) - 1
    for i in range(len(poly)):
        xi, yi = poly[i]
        xj, yj = poly[j]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-9) + xi:
            c = not c
        j = i
    return c


S = {}
for name, field, dark, draw in (
    ("Ténacité A : chêne", "U", "u", oak), ("Ténacité B : tortue", "U", "u", turtle), ("Ténacité C : montagne", "U", "u", mountain), ("Ténacité D : rempart", "U", "u", rampart),
    ("Fureur A : sanglier", "R", "r", boar), ("Fureur B : épée flamboyante", "R", "r", flaming_sword), ("Fureur C : cornes", "R", "r", horns), ("Fureur D : éclair", "R", "r", bolt),
):
    g = banner(field, dark)
    draw(g)
    S[name] = g.rows()


def render():
    scale, pad = 5, 22
    img = Image.new("RGB", (4 * (32 * scale + pad) + pad, 2 * (40 * scale + 46) + pad), (20, 17, 24))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 12)
    except OSError:
        font = ImageFont.load_default()
    for i, (name, rows) in enumerate(S.items()):
        ox = pad + (i % 4) * (32 * scale + pad)
        oy = pad + (i // 4) * (40 * scale + 46)
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch != ".":
                    d.rectangle([ox + x * scale, oy + y * scale, ox + (x + 1) * scale - 1, oy + (y + 1) * scale - 1], fill=PAL[ch])
        d.text((ox, oy + 40 * scale + 8), name, fill=(230, 220, 190), font=font)
    img.save("art/blasons_voies_v2.png")
    print(img.size)


if __name__ == "__main__":
    render()
