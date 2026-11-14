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


SPRITES = {
    "tapestry": tapestry, "tapestryCut": lambda: tapestry(True),
    "pallet": pallet, "candle": candle, "candleOut": lambda: candle(False),
    "pressurePlate": plate, "pressurePlateDown": lambda: plate(True),
}


def main():
    names = list(SPRITES)
    W = 40 + len(names) * 130
    sheet = Image.new("RGB", (W, 260), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 22), "ZONES SPÉCIALES v1 — le dortoir des traîtres de Krik (déjà en jeu, à valider)", fill=(255, 243, 200), font=font(14), anchor="mm")
    for i, n in enumerate(names):
        im = up(SPRITES[n]().img(), 6)
        x = 20 + i * 130
        bg = Image.new("RGB", (120, 140), (70, 61, 82))
        bg.paste(im, ((120 - im.width) // 2, 130 - im.height), im)
        sheet.paste(bg, (x, 50))
        d.text((x, 200), n, fill=(220, 210, 190), font=font(12, False))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "zones_v1.png")
    sheet.save(out)
    print("art/zones_v1.png", sheet.size)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        sprites = {n: f().img() for n, f in SPRITES.items()}
        sprites["tapestryLow"] = sprites["tapestry"]
        sprites["tapestryLowCut"] = sprites["tapestryCut"]
        os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
        write("src/render/sprites/zones.ts", "ZONES",
              "Zones spéciales de quête v1 (art/zones_v1.png) : tapisserie, paillasse, bougie, dalle à pression.", sprites)
    else:
        main()
