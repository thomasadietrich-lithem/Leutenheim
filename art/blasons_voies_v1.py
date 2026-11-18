"""Blasons des voies du Guerrier, planche v1 (proposition du directeur §5 : « un BLASON par voie, différent du picto du
premier pouvoir ; noms proposés : Ténacité (bleue), Fureur (rouge) »). Rien en jeu : à valider.

    python3 art/blasons_voies_v1.py   → art/blasons_voies_v1.png

Trois pistes par voie, un écu de 32 × 32 au contour sombre, bord doré :
  bleue (Ténacité) : A la tour, B le bouclier rond et ses rivets, C l'enclume ;
  rouge (Fureur)   : A les deux haches croisées, B la flamme, C la tête de loup hurlant.
"""
from PIL import Image, ImageDraw
from concert_v1 import Grid

PAL = {
    "K": (26, 18, 12), "G": (240, 192, 80), "g": (168, 124, 28),
    "U": (74, 143, 208), "u": (42, 90, 148), "V": (159, 208, 244),
    "R": (208, 58, 68), "r": (142, 31, 40), "q": (240, 120, 110),
    "W": (244, 240, 230), "w": (190, 186, 176), "x": (110, 106, 100), "O": (232, 120, 42), "Y": (255, 226, 122),
}


def shield(field, dark):
    g = Grid(32, 32)
    for y in range(1, 31):
        half = 14 if y < 18 else max(1, 14 - (y - 18) * 14 // 12)
        for x in range(16 - half, 16 + half):
            g.px(x, y, "G")
        for x in range(16 - half + 2, 16 + half - 2):
            if 3 <= y <= 28:
                g.px(x, y, field)
    return g


def tower(g):
    g.rect(11, 9, 20, 23, "w"); g.rect(10, 7, 21, 9, "W")
    for x in (10, 13, 16, 19):
        g.rect(x, 5, x + 1, 6, "W")
    g.rect(14, 17, 17, 23, "x"); g.rect(15, 12, 16, 14, "x")


def round_shield(g):
    for y in range(8, 25):
        for x in range(8, 25):
            d = ((x - 16) ** 2 + (y - 16) ** 2) ** 0.5
            if d <= 8:
                g.px(x, y, "w" if d > 6 else "W")
    for (x, y) in ((16, 10), (16, 22), (10, 16), (22, 16), (16, 16)):
        g.px(x, y, "x")


def anvil(g):
    g.rect(8, 11, 23, 14, "w"); g.rect(5, 11, 8, 12, "w"); g.rect(13, 15, 18, 19, "x"); g.rect(10, 20, 21, 22, "w")
    g.rect(9, 11, 22, 11, "W")


def axes(g):
    # Deux manches de bois croisés, deux fers en demi-lune.
    for i in range(17):
        for t in (0, 1):
            g.px(8 + i + t, 9 + i, "x")
            g.px(23 - i - t, 9 + i, "x")
    for y in range(4, 15):
        w = 5 - abs(y - 9) // 2
        g.rect(6 - w // 2, y, 6 + w, y, "W")
        g.rect(25 - w, y, 25 + w // 2, y, "W")
    g.rect(6, 6, 7, 12, "w"); g.rect(24, 6, 25, 12, "w")


def flame(g):
    for y in range(6, 26):
        w = max(1, (y - 6) * 7 // 14) if y < 20 else 7 - (y - 20)
        for x in range(16 - w, 16 + w):
            g.px(x, y, "O" if abs(x - 16) < w - 2 else "Y")
    g.rect(15, 18, 16, 23, "Y")


def wolf(g):
    g.rect(10, 10, 21, 20, "w"); g.rect(10, 6, 12, 10, "w"); g.rect(19, 6, 21, 10, "w")
    g.rect(13, 20, 18, 24, "w"); g.rect(14, 22, 17, 24, "K"); g.px(13, 13, "K"); g.px(18, 13, "K"); g.rect(15, 17, 16, 18, "K")


S = {}
for name, field, dark, draw in (("bleue A : tour", "U", "u", tower), ("bleue B : bouclier rond", "U", "u", round_shield), ("bleue C : enclume", "U", "u", anvil),
                                 ("rouge A : haches", "R", "r", axes), ("rouge B : flamme", "R", "r", flame), ("rouge C : loup", "R", "r", wolf)):
    g = shield(field, dark)
    draw(g)
    S[name] = g.rows()


def render():
    scale, pad = 6, 24
    img = Image.new("RGB", (3 * (32 * scale + pad) + pad, 2 * (32 * scale + 50) + pad), (20, 17, 24))
    d = ImageDraw.Draw(img)
    from PIL import ImageFont
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 11)
    except OSError:
        font = ImageFont.load_default()
    for i, (name, rows) in enumerate(S.items()):
        ox = pad + (i % 3) * (32 * scale + pad)
        oy = pad + (i // 3) * (32 * scale + 50)
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch != ".":
                    d.rectangle([ox + x * scale, oy + y * scale, ox + (x + 1) * scale - 1, oy + (y + 1) * scale - 1], fill=PAL[ch])
        d.text((ox, oy + 32 * scale + 8), name + ("  (Ténacité)" if "bleue" in name else "  (Fureur)"), fill=(230, 220, 190), font=font)
    img.save("art/blasons_voies_v1.png")
    print(img.size)


if __name__ == "__main__":
    render()
