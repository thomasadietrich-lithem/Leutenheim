"""Armes v4 (Thomas, 2026-11-11 : « Créer javeline, moins précis, + de dommage, niveau 3. Couteau de boucher lvl 2
rapide, commun. Arc puissant lvl 5, peu commun »). Icônes 16 × 16, même palette et même contour que objets_v3.
Écrit art/armes_v4.png. Lancer depuis la racine du dépôt.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from pix import up, font
from dortoir_v2 import Sprite, C

C.update({"oak_d": (52, 32, 16, 255), "oak": (86, 56, 28, 255), "oak_l": (112, 76, 40, 255), "oak_h": (138, 98, 56, 255),
          "horn": (214, 200, 168, 255), "horn_d": (150, 136, 108, 255), "leather": (110, 70, 34, 255), "string": (230, 226, 210, 255), "blood": (128, 24, 30, 255)})


def javelin():
    """Javeline : hampe fine en diagonale, pointe de fer en feuille, poignée de cuir au milieu."""
    s = Sprite(16, 16)
    for i in range(12):
        s.p(1 + i, 14 - i, "oak_l")
    for i in range(5, 8):
        s.p(1 + i, 14 - i, "leather")
    s.p(12, 3, "iron").p(13, 2, "iron_l").p(14, 1, "sheet_w").p(13, 3, "iron").p(12, 2, "iron_l").p(14, 2, "iron").p(13, 1, "iron_l")
    return s.done()


def cleaver():
    """Couteau de boucher : lame large et rectangulaire, dos droit, trou de suspension, manche de bois à rivets."""
    s = Sprite(16, 16)
    s.r(5, 2, 9, 7, "iron").r(5, 2, 9, 1, "iron_l").r(5, 8, 9, 1, "sheet_w").p(12, 3, "shadow")
    s.r(6, 5, 2, 1, "blood")
    s.r(1, 9, 5, 3, "oak").r(1, 9, 5, 1, "oak_h").p(2, 10, "sheet_s").p(4, 10, "sheet_s").r(5, 8, 1, 4, "iron_l")
    return s.done()


def power_bow():
    """Arc puissant : arc recourbé (bouts retournés en corne), bois sombre, poignée de cuir, corde tendue."""
    s = Sprite(16, 16)
    pts = [(4, 1), (6, 2), (7, 3), (8, 4), (9, 5), (9, 6), (9, 7), (9, 8), (9, 9), (9, 10), (8, 11), (7, 12), (6, 13), (4, 14)]
    for x, y in pts:
        s.p(x, y, "oak_d").p(x + 1, y, "oak")
    s.r(2, 0, 2, 2, "horn").r(2, 14, 2, 2, "horn").p(1, 0, "horn_d").p(1, 15, "horn_d")
    s.r(9, 6, 2, 4, "leather").p(5, 1, "oak").p(5, 14, "oak")
    # Corde tendue d'une corne à l'autre (le bois bombe vers la droite).
    for y in range(2, 14):
        s.p(2, y, "string")
    return s.done()


if __name__ == "__main__":
    items = [("Javeline — Lv3, peu commune", javelin(), "à lancer (6 cases), −2 au jet, 1d8+2 ;\nrécupérée comme une flèche"),
             ("Couteau de boucher — Lv2, commun", cleaver(), "rapide, +4, 1d4+2"),
             ("Arc puissant — Lv5, peu commun", power_bow(), "portée 11, +3, 1d8 (arc court : 9, 1d6)")]
    sheet = Image.new("RGB", (900, 300), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((450, 20), "ARMES v4 — à valider", fill=(255, 243, 200), font=font(15), anchor="mm")
    x = 20
    for name, sp, text in items:
        im = up(sp.img(), 8)
        bg = Image.new("RGB", (im.width + 24, im.height + 24), (70, 61, 82))
        bg.paste(im, (12, 12), im)
        sheet.paste(bg, (x + 70, 44))
        d.text((x, 44 + bg.height + 10), name, fill=(255, 220, 160), font=font(12))
        for i, line in enumerate(text.split("\n")):
            d.text((x, 44 + bg.height + 30 + i * 16), line, fill=(220, 210, 190), font=font(11, False))
        x += 295
    sheet.save("art/armes_v4.png")
    print(sheet.size)
