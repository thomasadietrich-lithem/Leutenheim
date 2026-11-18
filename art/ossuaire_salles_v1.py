"""Section 3, l'Ossuaire de la Lune pâle : PLANS DE SALLES, planche v1 (Thomas, 2026-11-18 : « propose les templates de
salles ; éviter des rectangles comme la section 1, mais pas non plus la structure de la section 2 ; il faut pas que les os
soient trop denses »). Rien en jeu.

    python3 art/ossuaire_salles_v1.py   → art/ossuaire_salles_v1.png

Sept formes « bâties » (le culte a construit ses catacombes : des plans d'église et de cloître, symétriques, pas des
grottes) ; les os restent sur les MURS, dans quelques niches seulement (une case de mur sur cinq environ), jamais en tas
au sol. Légende : # mur, . sol, n niche à crânes (dans le mur), o colonne, L puits de lune, s sarcophage, g gisant,
c cierge, a autel, + porte.
"""
from PIL import Image, ImageDraw, ImageFont

PLANS = {
    "A · Croix (crypte)": [
        "#####+#####",
        "####...####",
        "###n...n###",
        "####.s.####",
        "#n.......n#",
        "+...cLc...+",
        "#n.......n#",
        "####.s.####",
        "###n...n###",
        "####...####",
        "#####+#####",
    ],
    "B · Rotonde": [
        "####+####",
        "##n...n##",
        "#.......#",
        "#n.o.o.n#",
        "+...L...+",
        "#n.o.o.n#",
        "#.......#",
        "##n...n##",
        "####+####",
    ],
    "C · Galerie à alcôves": [
        "#n###n###n###n#",
        "#s#.#s#.#s#.#s#",
        "+.............+",
        "#s#.#s#.#s#.#s#",
        "#n###n###n###n#",
    ],
    "D · Nef et bas-côtés": [
        "#####n#n#####",
        "##....a....##",
        "#n.o.....o.n#",
        "#.....L.....#",
        "#n.o.....o.n#",
        "#...g...g...#",
        "#n.o.....o.n#",
        "#...........#",
        "######+######",
    ],
    "E · Chapelle à absides": [
        "####n###n####",
        "###...a...###",
        "##n...c...n##",
        "#...........#",
        "#.##.....##.#",
        "#.n#..L..#n.#",
        "####.....####",
        "#...........#",
        "######+######",
    ],
    "F · Cloître": [
        "#n###+###n#",
        "#.........#",
        "#.#n###n#.#",
        "#.#.....#.#",
        "+...gLg...+",
        "#.#.....#.#",
        "#.#n###n#.#",
        "#.........#",
        "#n###+###n#",
    ],
    "G · Puits des morts": [
        "##n#+#n##",
        "#c.....c#",
        "n..ooo..n",
        "+..oLo..+",
        "n..o.o..n",
        "#c.....c#",
        "##n###n##",
    ],
}

COL = {
    "#": (58, 54, 66), ".": (150, 142, 124), "n": (58, 54, 66), "o": (96, 92, 104), "L": (200, 222, 240),
    "s": (110, 104, 96), "g": (176, 170, 156), "c": (150, 142, 124), "a": (120, 112, 130), "+": (120, 82, 44),
}


def render():
    tile, pad = 14, 26
    cols = 4
    names = list(PLANS)
    img = Image.new("RGB", (cols * (15 * tile + pad) + pad, 2 * (11 * tile + 60) + pad), (20, 17, 24))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 13)
    except OSError:
        font = ImageFont.load_default()
    for i, name in enumerate(names):
        plan = PLANS[name]
        ox = pad + (i % cols) * (15 * tile + pad)
        oy = pad + (i // cols) * (11 * tile + 60)
        for y, row in enumerate(plan):
            for x, ch in enumerate(row):
                x0, y0 = ox + x * tile, oy + y * tile
                d.rectangle([x0, y0, x0 + tile - 1, y0 + tile - 1], fill=COL[ch])
                if ch == "#":
                    d.line([x0, y0 + tile // 2, x0 + tile - 1, y0 + tile // 2], fill=(46, 42, 52))
                if ch == "n":
                    # Une niche : trois petits crânes pâles dans le mur.
                    for k in range(3):
                        d.rectangle([x0 + 2 + k * 4, y0 + 5, x0 + 4 + k * 4, y0 + 8], fill=(222, 214, 192))
                if ch == "L":
                    d.rectangle([x0, y0, x0 + tile - 1, y0 + tile - 1], fill=(150, 142, 124))
                    d.ellipse([x0 + 1, y0 + 1, x0 + tile - 2, y0 + tile - 2], fill=(200, 222, 240))
                if ch == "c":
                    d.rectangle([x0 + 5, y0 + 4, x0 + 8, y0 + 11], fill=(140, 90, 180))
                    d.rectangle([x0 + 6, y0 + 1, x0 + 7, y0 + 3], fill=(255, 216, 74))
                if ch == "g":
                    d.rectangle([x0 + 2, y0 + 3, x0 + tile - 3, y0 + tile - 4], fill=(176, 170, 156), outline=(60, 56, 50))
                if ch == "s":
                    d.rectangle([x0 + 1, y0 + 1, x0 + tile - 2, y0 + tile - 2], fill=(110, 104, 96), outline=(40, 36, 32))
                if ch == "a":
                    d.rectangle([x0 + 1, y0 + 4, x0 + tile - 2, y0 + tile - 3], fill=(120, 112, 130), outline=(40, 36, 32))
                    d.rectangle([x0 + 5, y0 + 1, x0 + 8, y0 + 4], fill=(200, 222, 240))
        d.text((ox, oy + len(plan) * tile + 8), name, fill=(230, 220, 190), font=font)
    img.save("art/ossuaire_salles_v1.png")
    print(img.size)


if __name__ == "__main__":
    render()
