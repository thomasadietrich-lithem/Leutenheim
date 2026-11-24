"""Tombe du héros v1 (Thomas, 2026-11-24 : « le PJ devient une tombe » ; « on repasse devant la tombe à l'étage où il est
tombé, à la partie suivante, avec un objet du précédent run »).

Une pierre tombale arrondie sur un petit tertre de terre fraîche, une épée plantée devant ; une croix gravée.
`tombeHeros` : avec l'objet (une lueur dorée au pied) ; `tombeHerosVide` : l'objet a été pris.

  python3 art/tombe_heros_v1.py          → art/tombe_heros_v1.png
  python3 art/tombe_heros_v1.py export   → src/render/sprites/tombe.ts
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up  # noqa: E402
from dortoir_v2 import Sprite, C  # noqa: E402
from export_jeu_v4 import write  # noqa: E402

C.update({
    "st": (132, 134, 146, 255), "st_l": (176, 178, 190, 255), "st_d": (88, 88, 102, 255), "st_dd": (60, 58, 72, 255),
    "dirt": (92, 70, 50, 255), "dirt_l": (122, 96, 68, 255), "dirt_d": (64, 48, 36, 255),
    "moss": (88, 120, 64, 255), "blade": (200, 206, 216, 255), "hilt": (120, 80, 40, 255), "gold": (240, 200, 80, 255),
})


def tomb(glow=True):
    s = Sprite(16, 16)
    # Tertre de terre fraîche.
    s.r(1, 12, 14, 3, "dirt").r(2, 11, 12, 1, "dirt").r(2, 12, 12, 1, "dirt_l").r(1, 14, 14, 1, "dirt_d")
    # La pierre : arrondie en haut.
    s.r(4, 3, 8, 10, "st").r(5, 2, 6, 1, "st").r(6, 1, 4, 1, "st")
    s.r(4, 3, 1, 10, "st_l").r(5, 2, 1, 1, "st_l").r(6, 1, 4, 1, "st_l")
    s.r(11, 3, 1, 10, "st_d").r(10, 2, 1, 1, "st_d")
    # Une croix gravée, une fissure.
    s.r(8, 3, 1, 6, "st_dd").r(6, 5, 5, 1, "st_dd").r(9, 4, 1, 5, "st_l")
    s.p(5, 9, "st_d").p(6, 10, "st_d").p(6, 11, "st_d")
    # Mousse au pied.
    s.p(4, 12, "moss").p(5, 12, "moss").p(11, 12, "moss")
    # L'épée plantée devant, de biais.
    s.r(13, 6, 1, 6, "blade").p(13, 5, "blade").r(12, 8, 3, 1, "hilt").p(13, 7, "hilt")
    if glow:
        s.p(3, 13, "gold").p(2, 12, "gold").p(3, 11, (240, 200, 80, 140))
    return s.done()


def main():
    sheet = Image.new("RGB", (300, 170), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((150, 16), "TOMBE DU HÉROS v1", fill=(255, 243, 200), font=font(15), anchor="mm")
    for i, glow in enumerate((True, False)):
        im = up(tomb(glow).img(), 7)
        sheet.paste(im, (30 + i * 140, 34), im)
        d.text((86 + i * 140, 155), "avec l'objet" if glow else "objet pris", fill=(232, 212, 150), font=font(12), anchor="mm")
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tombe_heros_v1.png")
    sheet.save(out)
    print("art/tombe_heros_v1.png", sheet.size)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
        write("src/render/sprites/tombe.ts", "TOMBE",
              "Tombe du héros (art/tombe_heros_v1.png, Thomas 2026-11-24) : avec l'objet du héros précédent, puis vide.",
              {"tombeHeros": tomb(True).img(), "tombeHerosVide": tomb(False).img()})
    else:
        main()
