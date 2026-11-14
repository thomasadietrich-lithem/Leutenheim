"""Zones spéciales de quête v1 (Thomas, 2026-11-14 : « fonce toutes les quêtes ») : les objets du DORTOIR DES TRAÎTRES
de Krik. PROPOSITION, déjà en jeu (à valider sur cette planche).

- tapisserie (dans le mur : rouge et or, un blason de Kobold, des franges) et tapisserie tranchée (des lambeaux) ;
- paillasse (sac de paille, une couverture) ;
- bougie (allumée, soufflée : un filet de fumée) ;
- dalle à pression (levée, fendue ; enfoncée).

  python3 art/zones_v1.py          → art/zones_v1.png
  python3 art/zones_v1.py export   → src/render/sprites/zones.ts
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up  # noqa: E402
from dortoir_v2 import Sprite, C  # noqa: E402
from export_jeu_v4 import write  # noqa: E402

C.update({
    "tap": (156, 40, 46, 255), "tap_d": (104, 26, 34, 255), "tap_l": (196, 64, 66, 255),
    "gold": (226, 178, 64, 255), "gold_d": (160, 116, 36, 255), "rod": (110, 72, 40, 255),
    "straw": (206, 172, 96, 255), "straw_d": (160, 128, 66, 255), "straw_l": (232, 204, 130, 255),
    "blanket": (96, 110, 76, 255), "blanket_d": (66, 78, 52, 255),
    "wax": (240, 232, 210, 255), "wax_d": (200, 190, 166, 255), "flame": (255, 200, 80, 255), "flame_c": (255, 244, 190, 255),
    "dish": (150, 140, 128, 255), "smoke": (170, 168, 176, 160),
    "slab": (128, 124, 140, 255), "slab_d": (92, 88, 104, 255), "slab_l": (166, 162, 178, 255), "crack": (60, 56, 70, 255),
})


def tapestry(cut=False):
    """Tapisserie de 14 × 17, accrochée à une tringle, dans la case de mur."""
    s = Sprite(14, 17)
    s.r(0, 0, 14, 2, "rod").r(0, 0, 14, 1, "gold")
    if not cut:
        s.r(1, 2, 12, 13, "tap").r(1, 2, 1, 13, "tap_l").r(12, 2, 1, 13, "tap_d")
        s.r(2, 3, 10, 1, "gold").r(2, 13, 10, 1, "gold").r(2, 3, 1, 11, "gold").r(11, 3, 1, 11, "gold")
        # Le blason : une tête de Kobold cornue, stylisée.
        s.r(5, 6, 4, 4, "gold_d").p(4, 5, "gold_d").p(9, 5, "gold_d").p(6, 7, "tap_d").p(7, 7, "tap_d").r(6, 9, 2, 1, "tap_d")
        for x in range(1, 13, 2):
            s.p(x, 15, "gold").p(x, 16, "gold_d")
    else:
        # Tranchée : deux lambeaux qui pendent sur les côtés.
        s.r(1, 2, 3, 9, "tap").r(1, 2, 1, 9, "tap_l").p(3, 11, "tap").p(2, 12, "tap_d")
        s.r(10, 2, 3, 7, "tap").r(12, 2, 1, 7, "tap_d").p(10, 9, "tap").p(11, 10, "tap_d")
        s.p(2, 3, "gold").p(11, 3, "gold")
    return s.done()


VEL = ((110, 50, 130, 255), (72, 30, 88, 255), (150, 80, 170, 255), (226, 178, 64, 255))


def tapestry_edge(side, cut=False, vel=None):
    """Tapisserie (ou rideau, `vel`) vue par la tranche, sur un mur du bas ou de côté (Thomas, 2026-11-14 : « oriente
    correctement la tapisserie en fonction du côté ») : la tringle longe le bord du mur qui donne sur la salle, et l'on
    voit le haut du tissu. `side` : "low" (mur du bas), "L" (mur de gauche : bord droit), "R" (mur de droite : bord gauche)."""
    s = Sprite(14, 17)
    main, dark, light, trim = (vel or ("tap", "tap_d", "tap_l", "gold"))
    if side == "low":
        s.r(0, 1, 14, 1, "gold").r(0, 2, 14, 1, "rod")
        if not cut:
            s.r(1, 3, 12, 2, main)
            for x in range(1, 13, 3):
                s.p(x, 3, light).p(x + 1, 4, dark)
            s.r(1, 5, 12, 1, dark)
        else:
            s.r(1, 3, 3, 2, main).r(10, 3, 3, 1, main).p(2, 5, dark)
    else:
        x0 = 12 if side == "L" else 1
        rx = 13 if side == "L" else 0
        s.r(rx, 0, 1, 17, "gold")
        s.r(x0, 0, 1, 17, "rod")
        fx = x0 - 2 if side == "L" else x0 + 1
        if not cut:
            s.r(fx, 1, 2, 15, main)
            for y in range(1, 16, 3):
                s.p(fx, y, light).p(fx + 1, y + 1, dark)
            s.r(fx, 15, 2, 1, trim)
        else:
            s.r(fx, 1, 2, 4, main).r(fx, 12, 2, 3, main).p(fx, 5, dark)
    return s.done()


def curtain(opened=False):
    """Le rideau du tripot de Fifrelin (dans le mur) : velours violet sur une tringle ; ouvert, tiré sur les côtés."""
    s = Sprite(14, 17)
    s.r(0, 0, 14, 2, "rod").r(0, 0, 14, 1, "gold")
    vel, vel_d, vel_l = (110, 50, 130, 255), (72, 30, 88, 255), (150, 80, 170, 255)
    if not opened:
        s.r(1, 2, 12, 14, vel)
        for x in (2, 5, 8, 11):
            s.r(x, 2, 1, 14, vel_l if x % 2 else vel_d)
        s.r(1, 15, 12, 1, vel_d)
    else:
        s.r(1, 2, 3, 13, vel).r(1, 2, 1, 13, vel_l).r(10, 2, 3, 13, vel).r(12, 2, 1, 13, vel_d)
        s.r(1, 9, 3, 1, (226, 178, 64, 255)).r(10, 9, 3, 1, (226, 178, 64, 255))
    return s.done()


def pallet():
    s = Sprite(14, 9)
    s.r(0, 2, 14, 6, "straw").r(0, 2, 14, 1, "straw_l").r(0, 7, 14, 1, "straw_d")
    for x in (2, 5, 9, 12):
        s.p(x, 4, "straw_d").p(x + 1, 5, "straw_l")
    s.r(6, 1, 8, 6, "blanket").r(6, 1, 8, 1, (130, 146, 104, 255)).r(13, 1, 1, 6, "blanket_d")
    s.r(1, 3, 4, 3, (226, 220, 200, 255))  # le petit oreiller
    return s.done()


def candle(lit=True):
    s = Sprite(8, 13)
    s.r(0, 10, 8, 3, "dish").r(0, 10, 8, 1, (190, 182, 170, 255))
    s.r(2, 4, 4, 6, "wax").r(5, 4, 1, 6, "wax_d").p(2, 4, (255, 255, 250, 255))
    s.p(3, 3, (40, 30, 30, 255))
    s.done()
    if lit:
        s.r(3, 0, 2, 3, "flame").p(3, 1, "flame_c").p(4, 2, "flame_c")
    else:
        s.p(3, 1, "smoke").p(4, 0, "smoke")
    return s


def plate(down=False):
    s = Sprite(14, 14)
    s.r(0, 0, 14, 14, "slab_d" if down else "slab")
    if not down:
        s.r(0, 0, 14, 1, "slab_l").r(0, 0, 1, 14, "slab_l").r(0, 13, 14, 1, "slab_d").r(13, 0, 1, 14, "slab_d")
        s.p(4, 4, "crack").p(5, 5, "crack").p(9, 8, "crack").p(10, 9, "crack")
    else:
        s.r(0, 0, 14, 2, (60, 56, 70, 255)).r(0, 0, 2, 14, (60, 56, 70, 255))
        s.r(5, 5, 4, 4, (40, 34, 30, 255))  # la niche ouverte
    return s.done(outline=False)


def cierge(lit=False):
    """Un grand cierge d'église sur un pied de fer forgé (8 × 18)."""
    s = Sprite(8, 18)
    s.r(1, 15, 6, 3, "dish").r(3, 10, 2, 5, (90, 84, 92, 255)).r(1, 9, 6, 2, (110, 104, 112, 255))
    s.r(2, 2, 4, 7, "wax").r(5, 2, 1, 7, "wax_d").p(2, 3, (255, 255, 250, 255)).p(3, 5, "wax_d")
    s.p(3, 1, (40, 30, 30, 255))
    s.done()
    if lit:
        s.r(3, -1, 2, 2, "flame").p(3, 0, "flame_c")
        s.a[0, 3] = C["flame"]
        s.a[0, 4] = C["flame_c"]
    else:
        s.a[0, 4] = C["smoke"]
    return s


def grate(glint=False):
    """Une grille ronde au sol (planche trainards v3) : un ovale de fer à barreaux, un peu rouillé (14 × 12)."""
    s = Sprite(14, 12)
    import math
    for y in range(12):
        for x in range(14):
            if ((x - 6.5) / 6.8) ** 2 + ((y - 5.5) / 5.6) ** 2 <= 1:
                s.p(x, y, (40, 36, 44, 255))
    for y in range(12):
        for x in range(14):
            d = ((x - 6.5) / 6.8) ** 2 + ((y - 5.5) / 5.6) ** 2
            if 0.62 <= d <= 1:
                s.p(x, y, (116, 112, 124, 255) if y < 6 else (84, 80, 92, 255))
    for x in (3, 5, 7, 9, 11):
        for y in range(2, 10):
            if ((x - 6.5) / 6.8) ** 2 + ((y - 5.5) / 5.6) ** 2 <= 0.62:
                s.p(x, y, (100, 96, 108, 255))
    s.p(4, 8, (150, 80, 40, 255)).p(10, 3, (150, 80, 40, 255))
    if glint:
        for (x, y) in ((6, 1), (6, 3), (5, 2), (7, 2)):
            s.p(x, y, (255, 226, 122, 255))
        s.p(6, 2, (255, 255, 230, 255))
    return s.done(outline=False)


def scarecrow_helmet():
    """L'épouvantail de la ferme, coiffé du casque qu'on lui a posé (le chapeau de paille devient de fer)."""
    import re
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "render", "sprites", "ferme.ts")).read()
    i = src.index('"scarecrow"')
    pal = dict(re.findall(r'"(\w)": "(#[0-9a-f]{6})"', src[i:src.index('"rows"', i)]))
    start = src.index("[", src.index('"rows"', i))
    rows = re.findall(r'"([.a-z]+)"', src[start:src.index("]", start)])
    im = Image.new("RGBA", (len(rows[0]), len(rows)), (0, 0, 0, 0))
    steel = {"b": (164, 171, 200)}
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch == ".":
                continue
            if y <= 3 and ch in steel:
                im.putpixel((x, y), steel[ch] + (255,))
            else:
                h = pal[ch].lstrip("#")
                im.putpixel((x, y), tuple(int(h[k:k + 2], 16) for k in (0, 2, 4)) + (255,))
    im.putpixel((len(rows[0]) // 2, 1), (230, 236, 250, 255))

    class W:
        def img(self):
            return im
    return W()


# ---- Tonneau creux de Gluck (Thomas, 2026-11-14 : « améliore le design du tonneau de la quête ») ----
# Une grosse barrique couchée, ENCASTRÉE dans le mur, le fond tourné vers la salle ; une pomme peinte sur le fond
# (la marque de Gluck). « Found » : après une fouille, un filet de lumière passe autour du fond, une étincelle dorée.
WOOD, WOOD_D, WOOD_L, WOOD_DD = (146, 102, 58, 255), (110, 74, 40, 255), (178, 132, 80, 255), (74, 48, 24, 255)
IRON, IRON_L, IRON_D = (96, 100, 120, 255), (148, 154, 176, 255), (60, 62, 78, 255)
APPLE, APPLE_D, LEAF = (206, 56, 52, 255), (140, 30, 34, 255), (110, 160, 60, 255)
LIGHT, SPARK = (255, 226, 122, 255), (255, 250, 220, 255)


def cask_face(found=False):
    """Le fond rond de la barrique, vu de face (mur du haut, la salle en dessous) : 14 × 14."""
    s = Sprite(14, 14)
    for y in range(14):
        for x in range(14):
            d = ((x - 6.5) / 6.9) ** 2 + ((y - 6.5) / 6.9) ** 2
            if d > 1:
                continue
            if d >= 0.74:
                s.p(x, y, IRON_L if (y < 6 and x < 9) else IRON if y < 9 else IRON_D)
            elif d >= 0.58:
                s.p(x, y, WOOD_DD)
            else:
                # Les douelles du fond : planches verticales, un joint sombre tous les 3 pixels, reflet en haut à gauche.
                c = WOOD_D if x % 3 == 0 else WOOD_L if (x < 6 and y < 6) else WOOD
                s.p(x, y, c)
    # La bonde et sa cheville de laiton.
    s.r(6, 10, 2, 1, (200, 160, 60, 255)).p(6, 11, (120, 90, 30, 255)).p(7, 11, (120, 90, 30, 255))
    # La pomme peinte (la marque de Gluck).
    s.r(5, 5, 4, 3, APPLE).r(6, 8, 2, 1, APPLE).p(8, 6, APPLE_D).p(8, 7, APPLE_D).p(5, 5, (236, 110, 100, 255))
    s.p(7, 4, WOOD_DD).p(8, 3, LEAF)
    s.done()
    if found:
        # Un filet de lumière sur le pourtour (il est creux : le fond bouge) et une étincelle.
        for (x, y) in ((1, 4), (1, 5), (1, 6), (1, 7), (2, 3), (12, 8), (12, 9), (11, 10)):
            s.a[y, x] = LIGHT
        for (x, y) in ((11, 0), (11, 2), (10, 1), (12, 1), (11, 3), (9, 1)):
            s.a[y, x] = LIGHT
        s.a[1, 11] = SPARK
    return s


def cask_top(found=False):
    """La barrique couchée vue de dessus, le fond vers le HAUT (mur du bas, la salle au-dessus) : 14 × 15."""
    s = Sprite(14, 15)
    import math
    for y in range(15):
        bulge = math.sin(math.pi * (y + 0.5) / 15)
        half = 5 + round(1.4 * bulge)
        x0, x1 = 7 - half, 7 + half
        for x in range(x0, x1):
            c = WOOD_D if (x - x0) % 3 == 0 else WOOD_L if x - x0 < 3 else WOOD
            if x == x1 - 1:
                c = WOOD_D
            s.p(x, y, c)
    # Les cercles de fer.
    for y in (4, 10):
        for yy, col in ((y, IRON_L), (y + 1, IRON_D)):
            half = 5 + round(1.4 * math.sin(math.pi * (yy + 0.5) / 15))
            s.r(7 - half, yy, 2 * half, 1, col)
    # Le fond, côté salle : la tranche de bois et la pomme peinte qui dépasse.
    s.r(3, 0, 8, 1, IRON_L).r(3, 1, 8, 1, WOOD_DD)
    s.r(6, 1, 2, 1, APPLE)
    s.done()
    # On efface ce que le contour a fait déborder hors de l'image (rien à faire : Sprite garde sa taille).
    if found:
        # Un filet de lumière tout autour du fond (il est creux : le fond bouge) et une grande étincelle.
        for x in range(2, 12):
            s.a[0, x] = LIGHT
        s.a[1, 2] = s.a[1, 11] = LIGHT
        for (x, y) in ((10, 5), (10, 6), (10, 8), (10, 9), (8, 7), (9, 7), (11, 7), (12, 7)):
            s.a[y, x] = LIGHT
        s.a[7, 10] = SPARK
    return s


def turned(fn, k):
    """La barrique couchée, tournée d'un quart de tour (fond vers la droite ou vers la gauche)."""
    im = fn().img().rotate(90 * k, expand=True)

    class Wrap:
        def img(self):
            return im
    return Wrap()


SPRITES = {
    "tapestry": tapestry, "tapestryCut": lambda: tapestry(True),
    "pallet": pallet, "candle": candle, "candleOut": lambda: candle(False),
    "pressurePlate": plate, "pressurePlateDown": lambda: plate(True),
    "cierge": cierge, "ciergeLit": lambda: cierge(True),
    "grate": grate, "grateGlint": lambda: grate(True),
    "scarecrowHat": scarecrow_helmet,
    "curtain": curtain, "curtainOpen": lambda: curtain(True),
    "tapestryLow": lambda: tapestry_edge("low"), "tapestryLowCut": lambda: tapestry_edge("low", True),
    "tapestrySideL": lambda: tapestry_edge("L"), "tapestrySideLCut": lambda: tapestry_edge("L", True),
    "tapestrySideR": lambda: tapestry_edge("R"), "tapestrySideRCut": lambda: tapestry_edge("R", True),
    "curtainLow": lambda: tapestry_edge("low", vel=VEL), "curtainLowOpen": lambda: tapestry_edge("low", True, VEL),
    "curtainSideL": lambda: tapestry_edge("L", vel=VEL), "curtainSideLOpen": lambda: tapestry_edge("L", True, VEL),
    "curtainSideR": lambda: tapestry_edge("R", vel=VEL), "curtainSideROpen": lambda: tapestry_edge("R", True, VEL),
    "cask": cask_face, "caskFound": lambda: cask_face(True),
    "caskLow": cask_top, "caskLowFound": lambda: cask_top(True),
    # Mur de gauche (la salle à droite) : le fond vers la droite ; mur de droite : vers la gauche.
    "caskSideL": lambda: turned(cask_top, -1), "caskSideLFound": lambda: turned(lambda: cask_top(True), -1),
    "caskSideR": lambda: turned(cask_top, 1), "caskSideRFound": lambda: turned(lambda: cask_top(True), 1),
}


def main():
    names = list(SPRITES)
    W = 40 + min(len(names), 12) * 130
    rows_n = (len(names) + 11) // 12
    sheet = Image.new("RGB", (W, 60 + rows_n * 200), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 22), "ZONES SPÉCIALES v1 — objets des quêtes v3 (en jeu, à valider)", fill=(255, 243, 200), font=font(14), anchor="mm")
    for i, n in enumerate(names):
        im = up(SPRITES[n]().img(), 6)
        x = 20 + (i % 12) * 130
        yy = 50 + (i // 12) * 200
        bg = Image.new("RGB", (120, 140), (70, 61, 82))
        bg.paste(im, ((120 - im.width) // 2, 130 - im.height), im)
        sheet.paste(bg, (x, yy))
        d.text((x, yy + 150), n, fill=(220, 210, 190), font=font(12, False))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "zones_v1.png")
    sheet.save(out)
    print("art/zones_v1.png", sheet.size)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        sprites = {n: f().img() for n, f in SPRITES.items()}
        os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
        write("src/render/sprites/zones.ts", "ZONES",
              "Zones spéciales de quête v1 (art/zones_v1.png) : tapisserie, paillasse, bougie, dalle à pression.", sprites)
    else:
        main()
