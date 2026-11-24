"""Affiches parchemin du culte du poulet v1 (Thomas, 2026-11-24 : « des affiches RP, pas interactives » ; « Ok » pour
les six textes). Du décor accroché aux murs du haut : on les touche pour les lire, rien de plus.

Six affiches, trois dessins (13 × 14, punaisées dans la case de mur) :
  avis      : l'avis de recherche (un poulet dessiné, « RECHERCHÉ » en gros trait rouge) ;
  texte     : sermon, règlement, annonce, note du garde (lignes d'écriture, un petit poulet en tampon) ;
  dechiree  : la chronique arrachée (bas en dents de scie, une lune-œuf dessinée).

  python3 art/affiches_v1.py          → art/affiches_v1.png
  python3 art/affiches_v1.py export   → src/render/sprites/affiches.ts
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up  # noqa: E402
from dortoir_v2 import Sprite, C  # noqa: E402
from export_jeu_v4 import write  # noqa: E402

C.update({
    "parch": (214, 192, 140, 255), "parch_l": (232, 214, 170, 255), "parch_d": (170, 144, 96, 255), "parch_dd": (120, 96, 60, 255),
    "ink": (60, 40, 30, 255), "ink_l": (110, 84, 60, 255), "red": (170, 40, 36, 255), "pin": (200, 200, 210, 255),
    "egg": (236, 232, 214, 255),
})
W, H = 13, 14


def sheet(torn=False):
    s = Sprite(W, H)
    s.r(0, 1, W, H - 1, "parch").r(0, 1, W, 1, "parch_l").r(0, 1, 1, H - 1, "parch_l")
    s.r(W - 1, 1, 1, H - 1, "parch_d").r(0, H - 1, W, 1, "parch_d")
    # Coins cornés, taches d'humidité.
    s.p(W - 1, 1, (0, 0, 0, 0)).p(W - 2, 2, "parch_d").p(1, H - 2, "parch_dd").p(8, 9, "parch_d").p(9, 9, "parch_d")
    if torn:
        for x in range(W):
            cut = 2 + (x * 7) % 3
            s.r(x, H - cut, 1, cut, (0, 0, 0, 0))
            s.p(x, H - cut - 1, "parch_d")
    # La punaise.
    s.r(W // 2, 0, 1, 2, "pin")
    return s


def tiny_chicken(s, x, y, c="ink"):
    s.r(x, y + 1, 3, 2, c).p(x - 1, y, c).p(x - 1, y + 1, c).p(x + 3, y, c).p(x - 2, y + 1, "red").p(x - 1, y - 1, "red")


def avis():
    s = sheet()
    # « RECHERCHÉ » : un gros trait rouge, puis le portrait, puis deux lignes.
    s.r(2, 3, 9, 1, "red")
    s.r(3, 5, 7, 5, "parch_l")
    tiny_chicken(s, 5, 6, "ink")
    s.p(6, 9, "ink_l").p(7, 9, "ink_l")
    s.r(2, 11, 9, 1, "ink_l")
    return s.done()


def texte():
    s = sheet()
    for i, y in enumerate((3, 5, 7, 9)):
        w = [9, 7, 8, 5][i]
        for x in range(2, 2 + w):
            if (x * 5 + y) % 4 != 0:
                s.p(x, y, "ink_l")
    tiny_chicken(s, 8, 10, "red")
    return s.done()


def dechiree():
    s = sheet(torn=True)
    for y in (3, 5):
        for x in range(2, 11):
            if (x * 3 + y) % 5 != 0:
                s.p(x, y, "ink_l")
    # La lune-œuf.
    s.r(5, 7, 3, 3, "egg").p(4, 8, "egg").p(8, 8, "egg").p(6, 6, "egg").p(5, 7, "ink_l")
    return s.done()


SPRITES = {"afficheAvis": avis, "afficheTexte": texte, "afficheDechiree": dechiree}


def main():
    sheet_im = Image.new("RGB", (420, 200), (26, 20, 14))
    d = ImageDraw.Draw(sheet_im)
    d.text((210, 18), "AFFICHES DU CULTE DU POULET v1", fill=(255, 243, 200), font=font(15), anchor="mm")
    for i, (name, fn) in enumerate(SPRITES.items()):
        im = up(fn().img(), 8)
        sheet_im.paste(im, (20 + i * 135, 40), im)
        d.text((20 + i * 135 + 52, 170), name, fill=(232, 212, 150), font=font(12), anchor="mm")
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "affiches_v1.png")
    sheet_im.save(out)
    print("art/affiches_v1.png", sheet_im.size)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
        write("src/render/sprites/affiches.ts", "AFFICHES",
              "Affiches parchemin du culte du poulet (art/affiches_v1.png, Thomas 2026-11-24) : avis de recherche, texte, chronique déchirée.",
              {k: fn().img() for k, fn in SPRITES.items()})
    else:
        main()
