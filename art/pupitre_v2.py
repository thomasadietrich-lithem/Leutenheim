"""Pupitre au grimoire v2 (Thomas, 2026-11-12 : « améliore le pupitre avec le livre, mets-le sur un mur de droite en
adaptant le design »). Collé au mur de DROITE, vu de profil : un lourd pied sculpté, un plateau incliné qui monte vers
le mur, le grimoire ouvert tourné vers la salle (pages épaisses, signet rouge qui pend), une bougie fixée au mur et une
lueur bleue qui s'élève des pages (3 images). 16 × 26 pixels. `python3 art/pupitre_v2.py` écrit art/pupitre_v2.png.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from forge_alchimie_v1 import C, Sprite, grimoire_stand
from pix import font


def grimoire_wall(frame=0):
    s = Sprite(16, 26)
    s.r(2, 24, 12, 2, "shadow")
    # Pied : socle large, fût sculpté (bagues), sous le plateau.
    s.r(4, 22, 9, 2, "oak_d").r(5, 21, 7, 1, "oak")
    s.r(7, 13, 3, 8, "oak").r(7, 13, 1, 8, "oak_l").r(7, 15, 3, 1, "oak_d").r(7, 18, 3, 1, "oak_d")
    # Plateau incliné : bas à gauche (vers la salle), haut contre le mur (à droite).
    for i in range(12):
        x = 2 + i
        top = 13 - (i * 5) // 11
        s.r(x, top, 1, 3, "oak_l" if i % 3 else "oak_h")
        s.p(x, top + 2, "oak_d")
    # Grimoire ouvert posé sur le plateau : couverture rouge, pages épaisses, quelques lignes d'encre.
    for i in range(9):
        x = 3 + i
        top = 11 - (i * 5) // 11
        s.p(x, top + 1, "book_r")
        s.r(x, top - 2, 1, 3, "page")
        if i in (1, 2, 6, 7):
            s.p(x, top - 2, "ink")
    s.p(7, 8, "book_r").p(8, 8, "book_r")  # le pli du livre
    # Signet rouge qui pend du bord gauche.
    s.r(3, 12, 1, 4, "book_r").p(3, 16, "rust_d")
    # Bougie fixée au mur, au-dessus du livre.
    s.r(13, 1, 2, 3, "page").r(12, 4, 4, 1, "rust_d").p(15, 5, "rust_d")
    s.done()
    flame = [((13, 0), (14, 0)), ((13, 0),), ((14, 0),)][frame % 3]
    for x, y in flame:
        s.p(x, y, "glow_l")
    # Lueur bleue qui monte des pages.
    for x, y in [((6, 4), (9, 2)), ((7, 3), (10, 1)), ((5, 2), (8, 4))][frame % 3]:
        s.p(x, y, "magic")
    return s


if __name__ == "__main__":
    S = 6
    sheet = Image.new("RGB", (620, 260), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((310, 16), "PUPITRE AU GRIMOIRE v2 — contre le mur de droite, à valider", fill=(255, 243, 200), font=font(13), anchor="mm")
    for k in range(3):
        im = grimoire_wall(k).img().resize((16 * S, 26 * S), Image.NEAREST)
        bg = Image.new("RGB", (16 * S + 20, 26 * S + 20), (58, 52, 64))
        d2 = ImageDraw.Draw(bg)
        d2.rectangle([16 * S + 6, 0, 16 * S + 20, 26 * S + 20], fill=(90, 84, 100))  # le mur de droite
        bg.paste(im, (6, 10), im)
        sheet.paste(bg, (20 + k * 130, 40))
        d.text((20 + k * 130 + 58, 40 + 26 * S + 32), f"image {k + 1}", fill=(200, 190, 170), font=font(11, False), anchor="mm")
    old = grimoire_stand(0).img().resize((14 * S, 24 * S), Image.NEAREST)
    sheet.paste(old, (430, 50), old)
    d.text((472, 40 + 26 * S + 32), "v1 (au milieu)", fill=(200, 190, 170), font=font(11, False), anchor="mm")
    sheet.save("art/pupitre_v2.png")
    print("ok")
