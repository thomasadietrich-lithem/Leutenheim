"""Pièces secrètes et prison v1 (Thomas, 2026-11-14). PROPOSITION, déjà en jeu (à valider sur cette planche).

PIÈCES SECRÈTES : briques manquantes et petits creux dans les murs (dans la case de mur, comme la tapisserie) ;
coffre d'acier (même forme que le coffre de bois, recoloré dans le jeu) ; présentoir (colonne de pierre, coussin de
velours, calice et pièces).
PRISON : grille d'alcôve (fermée, ouverte), seau (debout, renversé), bureau du geôlier avec son registre ouvert, anneau
au mur, chaînes au mur. Et le PNJ proposé : Plumeau, le greffier enchaîné.

  python3 art/secret_prison_v1.py          → art/secret_prison_v1.png
  python3 art/secret_prison_v1.py export   → src/render/sprites/secret.ts
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up  # noqa: E402
from dortoir_v2 import Sprite, C  # noqa: E402
from export_jeu_v4 import write  # noqa: E402

C.update({
    "hole": (12, 10, 16, 255), "hole_m": (30, 26, 36, 255), "lip": (120, 116, 128, 255), "lip_d": (78, 74, 88, 255),
    "dust": (96, 88, 80, 255),
    "iron": (92, 96, 112, 255), "iron_d": (52, 54, 66, 255), "iron_l": (146, 152, 170, 255), "rust": (138, 78, 44, 255),
    "stone": (128, 122, 132, 255), "stone_d": (88, 82, 94, 255), "stone_l": (164, 158, 168, 255),
    "velvet": (128, 36, 52, 255), "velvet_d": (86, 22, 36, 255), "velvet_l": (168, 60, 76, 255),
    "gold": (226, 178, 64, 255), "gold_d": (160, 116, 36, 255), "gold_l": (255, 226, 130, 255),
    "oak": (110, 72, 40, 255), "oak_d": (70, 44, 24, 255), "oak_l": (146, 100, 58, 255),
    "page": (232, 222, 196, 255), "page_d": (190, 178, 150, 255), "ink": (40, 36, 52, 255), "quill": (240, 240, 236, 255),
    "water": (70, 96, 120, 200), "wood_b": (120, 84, 50, 255), "wood_bd": (82, 54, 30, 255),
    "skin": (226, 186, 150, 255), "skin_d": (186, 140, 108, 255), "beard": (206, 206, 214, 255), "beard_d": (150, 150, 162, 255),
    "robe": (46, 44, 60, 255), "robe_d": (28, 26, 38, 255), "robe_l": (72, 70, 92, 255), "glass": (190, 220, 240, 255),
})

W, H = 14, 17  # sprites de mur : posés à (1, -1) dans la case de mur, comme la tapisserie


def wall_gap(variant=0):
    """Brique manquante (agrandie, Thomas 2026-11-14 : « agrandis un peu les brèches ») : un trou rectangulaire noir,
    une lèvre de pierre claire dessous, des éclats de mortier, un peu de poussière."""
    s = Sprite(W, H)
    x, y, w, h = (2, 5, 9, 5) if variant == 0 else (5, 8, 8, 4)
    s.r(x, y, w, h, "hole").r(x, y, w, 1, "hole_m").r(x, y, 1, h, "hole_m")
    s.r(x, y + h, w, 1, "lip").r(x + w, y, 1, h, "lip_d").p(x + w - 1, y - 1, "lip_d").p(x + 1, y - 1, "lip_d")
    if variant == 1:
        # Deux briques manquantes, décalées.
        s.r(1, 2, 6, 4, "hole").r(1, 2, 6, 1, "hole_m").r(1, 6, 6, 1, "lip").r(7, 2, 1, 4, "lip_d")
    s.p(x + 1, y + h + 1, "dust").p(x + w - 2, y + h + 1, "dust").p(x + 3, y + h + 1, "dust")
    return s.done(outline=False)


def wall_hole(variant=0):
    """Petit creux (agrandi) : un trou rond et profond entre deux briques (certains laissent voir ce qu'il y a derrière)."""
    s = Sprite(W, H)
    x, y = (5, 7) if variant == 0 else (3, 4)
    s.r(x, y, 5, 4, "hole").r(x + 1, y - 1, 3, 1, "hole").r(x + 1, y + 4, 3, 1, "hole")
    s.r(x - 1, y + 1, 1, 2, "hole_m").r(x + 5, y + 1, 1, 2, "hole_m").r(x, y, 5, 1, "hole_m")
    s.r(x, y + 5, 5, 1, "lip").p(x + 2, y + 6, "dust").p(x + 4, y + 6, "dust")
    return s.done(outline=False)


def display():
    """Présentoir : colonne de pierre cannelée, plateau, coussin de velours, un calice d'or et quelques pièces."""
    s = Sprite(14, 24)
    s.r(2, 21, 10, 3, "stone_d").r(2, 21, 10, 1, "stone")           # socle
    s.r(4, 10, 6, 11, "stone").r(4, 10, 1, 11, "stone_l").r(9, 10, 1, 11, "stone_d")
    s.r(6, 11, 1, 9, "stone_d")                                      # cannelure
    s.r(1, 8, 12, 2, "stone_l").r(1, 9, 12, 1, "stone")              # plateau
    s.r(2, 5, 10, 3, "velvet").r(2, 5, 10, 1, "velvet_l").r(2, 7, 10, 1, "velvet_d")
    # Le calice.
    s.r(6, 0, 3, 3, "gold").p(6, 0, "gold_l").r(7, 3, 1, 2, "gold_d").r(5, 4, 5, 1, "gold")
    s.p(3, 5, "gold").p(4, 6, "gold_d").p(10, 5, "gold").p(11, 6, "gold_d")  # pièces
    return s.done()


def grille(opened=False):
    """Grille d'alcôve de prison (une case) : cadre de fer, six barreaux, une traverse, la serrure ; ouverte, la porte
    pivote contre le mur (on la voit par la tranche à gauche)."""
    s = Sprite(16, 22)
    s.r(0, 0, 2, 22, "iron_d").r(14, 0, 2, 22, "iron_d").r(0, 0, 16, 2, "iron_d")  # cadre
    s.r(0, 0, 1, 22, "iron").r(0, 0, 16, 1, "iron")
    if not opened:
        for x in (3, 5, 7, 9, 11, 13):
            s.r(x, 2, 1, 20, "iron").p(x, 2, "iron_l")
        s.r(2, 10, 12, 2, "iron").r(2, 10, 12, 1, "iron_l")
        s.r(11, 12, 3, 3, "iron_d").p(12, 13, "hole")                 # serrure
        s.p(5, 16, "rust").p(9, 6, "rust").p(13, 19, "rust")
    else:
        # La porte ouverte : rabattue contre le montant gauche (barreaux serrés), le passage libre.
        s.r(2, 2, 3, 20, "iron").r(2, 2, 1, 20, "iron_l").r(2, 10, 3, 2, "iron_l").p(3, 15, "rust")
    return s.done()


def bucket(tipped=False):
    """Seau de bois cerclé de fer ; renversé : couché, une flaque d'eau sale devant."""
    s = Sprite(12, 12)
    if not tipped:
        s.r(2, 3, 8, 8, "wood_b").r(2, 3, 1, 8, "oak_l").r(9, 3, 1, 8, "wood_bd")
        s.r(1, 2, 10, 2, "wood_bd").r(2, 2, 8, 1, "hole_m")              # le bord, l'intérieur sombre
        s.r(2, 5, 8, 1, "iron").r(2, 9, 8, 1, "iron")
        s.r(1, 0, 1, 3, "iron_d").r(10, 0, 1, 3, "iron_d").r(1, 0, 10, 1, "iron_d")  # l'anse
    else:
        s.r(0, 8, 12, 3, "water").r(1, 11, 9, 1, "water")
        s.r(1, 3, 8, 6, "wood_b").r(1, 3, 8, 1, "oak_l").r(1, 8, 8, 1, "wood_bd")
        s.r(9, 2, 2, 8, "wood_bd").r(10, 3, 1, 6, "hole_m")              # l'ouverture, tournée vers la droite
        s.r(3, 3, 1, 6, "iron").r(7, 3, 1, 6, "iron")
    return s.done()


def desk():
    """Bureau du geôlier (deux cases) : plateau de chêne, tiroirs, le REGISTRE ouvert, l'encrier et la plume."""
    s = Sprite(32, 22)
    s.r(1, 8, 30, 3, "oak_l").r(1, 8, 30, 1, (176, 124, 74, 255))      # plateau
    s.r(2, 11, 28, 9, "oak").r(2, 11, 28, 1, "oak_d")                   # face
    s.r(4, 13, 8, 4, "oak_d").r(5, 14, 6, 2, "oak").p(8, 15, "gold")   # tiroir gauche
    s.r(20, 13, 8, 4, "oak_d").r(21, 14, 6, 2, "oak").p(24, 15, "gold")
    s.r(2, 20, 2, 2, "oak_d").r(28, 20, 2, 2, "oak_d")                  # pieds
    # Le registre ouvert, de biais.
    s.r(6, 3, 14, 6, "page").r(12, 3, 2, 6, "page_d").r(6, 8, 14, 1, "page_d")
    for y in (4, 6):
        s.r(7, y, 4, 1, "ink").r(15, y, 4, 1, "ink")
    s.r(5, 4, 1, 5, "velvet_d")                                         # la couverture qui dépasse
    # Encrier et plume.
    s.r(23, 5, 3, 3, "ink").p(24, 4, "iron_d")
    s.p(25, 0, "quill").p(25, 1, "quill").p(26, 0, "quill").p(24, 2, "quill").p(24, 3, "beard_d")
    return s.done()


def wall_ring():
    """Anneau de fer scellé dans le mur, une agrafe et un peu de rouille."""
    s = Sprite(W, H)
    s.r(6, 4, 2, 2, "iron_d")
    s.r(5, 6, 4, 1, "iron").p(4, 7, "iron").p(9, 7, "iron").p(4, 8, "iron").p(9, 8, "iron").r(5, 9, 4, 1, "iron_d")
    s.p(5, 6, "iron_l").p(8, 9, "rust")
    return s.done()


def wall_chains():
    """Chaînes au mur : deux chaînes qui pendent d'une agrafe, des fers ouverts au bout."""
    s = Sprite(W, H)
    s.r(5, 1, 4, 2, "iron_d")
    for x in (4, 9):
        for y in range(3, 12, 2):
            s.p(x, y, "iron").p(x, y + 1, "iron_d")
        s.r(x - 1, 13, 3, 1, "iron").p(x - 1, 14, "iron").p(x + 1, 14, "iron").r(x - 1, 15, 3, 1, "iron_d")
    s.p(4, 7, "rust").p(9, 10, "rust")
    return s.done()


def plumeau(frame=0):
    """PNJ PROPOSÉ : Plumeau, le greffier enchaîné. Vieil humain maigre, longue robe noire râpée, barbe grise, lunettes
    rondes, une plume derrière l'oreille, doigts tachés d'encre, un fer à la cheville et sa chaîne."""
    s = Sprite(16, 22)
    s.r(4, 20, 8, 2, (0, 0, 0, 90))                                    # ombre
    s.r(4, 9, 8, 11, "robe").r(4, 9, 1, 11, "robe_l").r(11, 9, 1, 11, "robe_d")
    s.r(5, 18, 2, 2, "robe_d").r(9, 18, 2, 2, "robe_d")               # bas de robe déchiré
    s.r(4, 2, 8, 7, "skin").r(4, 2, 8, 2, "beard_d")                   # tête, cheveux gris
    s.r(4, 1, 8, 1, "beard_d").p(3, 3, "beard_d").p(12, 3, "beard_d")
    s.r(5, 4, 2, 2, "glass").r(9, 4, 2, 2, "glass").r(7, 4, 2, 1, "iron_d")  # lunettes rondes
    s.p(5, 5, "ink").p(10, 5, "ink")
    s.r(5, 7, 6, 5, "beard").r(6, 12, 4, 1, "beard_d").p(7, 7, "skin_d").p(8, 7, "skin_d")  # la barbe
    s.r(12, 1, 1, 4, "quill").p(13, 0, "quill")                        # la plume derrière l'oreille
    arm = 0 if frame == 0 else 1
    s.r(2, 10 + arm, 2, 6, "robe").r(12, 10, 2, 6, "robe")
    s.r(2, 16 + arm, 2, 2, "skin").p(2, 17 + arm, "ink").r(12, 16, 2, 2, "skin").p(13, 17, "ink")
    s.r(9, 19, 3, 1, "iron").p(12, 20, "iron_d").p(13, 21, "iron")      # le fer et la chaîne
    return s.done()


SPRITES = {
    "wallGapA": wall_gap, "wallGapB": lambda: wall_gap(1), "wallHoleA": wall_hole, "wallHoleB": lambda: wall_hole(1),
    "display": display, "grille": grille, "grilleOpen": lambda: grille(True),
    "bucket": bucket, "bucketTipped": lambda: bucket(True), "desk": desk,
    "wallRing": wall_ring, "wallChains": wall_chains,
}
PROPOSALS = {"plumeau0": plumeau, "plumeau1": lambda: plumeau(1)}


def steel_chest(open_=False):
    """Le coffre d'acier : le coffre du jeu (decor.ts) recoloré comme dans `tiles.ts`."""
    src = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "render", "sprites", "decor.ts")).read()
    pal = dict(re.findall(r'"(\w)": "(#[0-9a-f]{6})"', src[:src.index("export const DECOR =")]))
    pal.update({"B": "#7f88a6", "b": "#4e5570", "T": "#a4abc8", "t": "#5e6680", "S": "#2a2e40"})
    key = "chestOpen" if open_ else "chest"
    i = src.index(f"  {key}: [")
    rows = re.findall(r'"([^"]+)"', src[i:src.index("]", i)])
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch in pal:
                h = pal[ch].lstrip("#")
                im.putpixel((x, y), tuple(int(h[k:k + 2], 16) for k in (0, 2, 4)) + (255,))

    class Wrap:
        def img(self):
            return im
    return Wrap()


def wall_bg(w=120, h=140):
    """Un bout de mur de briques, pour poser les sprites de mur sur la planche."""
    bg = Image.new("RGB", (w, h), (70, 61, 82))
    d = ImageDraw.Draw(bg)
    for y in range(0, h, 18):
        d.line([(0, y), (w, y)], fill=(48, 42, 58))
        off = 0 if (y // 18) % 2 else 20
        for x in range(off, w, 40):
            d.line([(x, y), (x, y + 18)], fill=(48, 42, 58))
    return bg


def main():
    items = list(SPRITES.items()) + [("steelChest", lambda: steel_chest()), ("steelChestOpen", lambda: steel_chest(True))] + list(PROPOSALS.items())
    cols = 8
    rows_n = (len(items) + cols - 1) // cols
    Wd = 40 + cols * 150
    sheet = Image.new("RGB", (Wd, 70 + rows_n * 220), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((Wd // 2, 24), "PIÈCES SECRÈTES ET PRISON v1 — en jeu, à valider ; Plumeau : PNJ proposé", fill=(255, 243, 200), font=font(15), anchor="mm")
    for i, (n, f) in enumerate(items):
        im = up(f().img(), 6 if f().img().width <= 16 else 4)
        x = 20 + (i % cols) * 150
        y = 50 + (i // cols) * 220
        bg = wall_bg(140, 170) if n.startswith("wall") else Image.new("RGB", (140, 170), (70, 61, 82))
        bg.paste(im, ((140 - im.width) // 2, 160 - im.height), im)
        sheet.paste(bg, (x, y))
        d.text((x, y + 178), n, fill=(220, 210, 190), font=font(13, False))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "secret_prison_v1.png")
    sheet.save(out)
    print("art/secret_prison_v1.png", sheet.size)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        sprites = {n: f().img() for n, f in {**SPRITES, **PROPOSALS}.items()}
        os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
        write("src/render/sprites/secret.ts", "SECRET",
              "Pièces secrètes et prison v1 (art/secret_prison_v1.png) : creux et briques manquantes, présentoir, grilles, seau, bureau, anneau, chaînes ; Plumeau (proposé).", sprites)
    else:
        main()
