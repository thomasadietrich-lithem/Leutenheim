"""Salles spéciales v1 (Thomas, 2026-11-26 : « implémente les salles spéciales en test ») : les objets des six salles
proposées le 25/11, en essai (zone d'essai « Salles spéciales »).

  puitsVoeux        le puits aux vœux (margelle de pierre, eau sombre, quelques pièces qui brillent)
  autelPoulet       l'autel du Poulet (pierre, nappe violette, poulet d'argent) ; autelPouletVide : l'offrande faite
  miroir / miroirBrise   le grand miroir au cadre doré, puis brisé (le reflet en est sorti)
  champiFestin / champiFestinMange   le champignon géant comestible (chapeau doré tacheté), puis entamé
  tableCarte / tableCarteLue   la table du cartographe, sa carte déroulée, puis roulée
  ciergeCrypte / ciergeCrypteAllume   le cierge de la crypte, éteint puis allumé

  python3 art/salles_speciales_v1.py          → art/salles_speciales_v1.png
  python3 art/salles_speciales_v1.py export   → src/render/sprites/speciales.ts
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up, hexrgb  # noqa: E402
from dortoir_v2 import Sprite, C  # noqa: E402
from export_jeu_v4 import write  # noqa: E402

C.update({k: hexrgb(v) + (255,) for k, v in {
    "st": "#8a8696", "st_d": "#5e5a6a", "st_l": "#b2aebe", "st_k": "#403c4a",
    "water": "#1a2840", "water_l": "#3a5a84", "coin": "#f0c050", "coin_d": "#a87c1c",
    "vio": "#5c2878", "vio_l": "#80409c", "sil": "#c8d0dc", "sil_d": "#8a94a6", "comb": "#c4343c", "beak": "#e2b040",
    "gold": "#e0b040", "gold_d": "#a87c1c", "gold_l": "#ffe27a", "glass": "#9ab8d8", "glass_l": "#d8ecff", "glass_d": "#5a7898",
    "cap": "#e8b030", "cap_d": "#b07818", "cap_l": "#ffe080", "spot": "#fff3c8", "stem": "#e8dcc0", "stem_d": "#b0a488",
    "wood": "#8a5a30", "wood_d": "#5a3818", "wood_l": "#b07a44", "paper": "#e8dcb4", "paper_d": "#b8a878", "ink": "#6a4a30",
    "wax": "#e8e0cc", "wax_d": "#b0a890", "flame": "#ffd84a", "flame_o": "#ff9a3a", "shadow": "#00000050",
}.items()})


def well():
    s = Sprite(16, 18)
    s.r(1, 15, 14, 2, "shadow")
    s.r(1, 6, 14, 10, "st").r(1, 6, 14, 1, "st_l").r(1, 15, 14, 1, "st_d")
    for x in range(1, 15, 3):
        s.r(x, 9, 1, 6, "st_d")
    s.r(1, 12, 14, 1, "st_d")
    # L'ouverture, l'eau, des pièces.
    s.r(3, 3, 10, 4, "st_d").r(4, 4, 8, 3, "water").r(5, 4, 3, 1, "water_l")
    s.p(6, 5, "coin").p(9, 6, "coin").p(10, 5, "coin_d")
    s.r(2, 2, 12, 1, "st_l").r(2, 3, 1, 4, "st").r(13, 3, 1, 4, "st")
    return s.done()


def chicken_altar(empty=False):
    s = Sprite(16, 20)
    s.r(1, 17, 14, 2, "shadow")
    s.r(1, 9, 14, 9, "st").r(1, 9, 14, 1, "st_l").r(1, 17, 14, 1, "st_d")
    s.r(2, 10, 12, 5, "vio").r(2, 10, 12, 1, "vio_l").r(4, 15, 1, 2, "vio").r(11, 15, 1, 2, "vio")
    s.r(7, 11, 2, 2, "gold")
    # Le poulet d'argent sur l'autel.
    s.r(5, 5, 6, 4, "sil").r(6, 4, 4, 1, "sil").r(10, 3, 1, 3, "sil_d").r(4, 3, 2, 3, "sil")
    s.p(4, 2, "comb").p(5, 2, "comb").p(3, 4, "beak").p(5, 4, "st_k")
    if not empty:
        # Une coupe vide qui attend l'offrande.
        s.r(12, 7, 3, 2, "gold").r(13, 6, 1, 1, "gold_d")
    else:
        s.r(12, 7, 3, 2, "gold").p(13, 6, "cap_l").p(12, 6, "cap")
    return s.done()


def mirror(broken=False):
    s = Sprite(16, 24)
    s.r(2, 22, 12, 2, "shadow")
    s.r(2, 1, 12, 22, "gold_d").r(3, 2, 10, 20, "gold").r(3, 2, 10, 1, "gold_l")
    s.r(4, 3, 8, 18, "glass_d" if broken else "glass").r(5, 4, 2, 10, "glass_l")
    if broken:
        for (x, y) in [(6, 6), (7, 7), (8, 8), (9, 9), (8, 10), (7, 11), (9, 12), (10, 13), (6, 14), (5, 15)]:
            s.p(x, y, "st_k")
        s.r(4, 17, 8, 4, "st_k")
    s.r(1, 0, 14, 1, "gold_d").r(7, 0, 2, 1, "gold_l")
    return s.done()


def feast_mushroom(eaten=False):
    s = Sprite(16, 22)
    s.r(2, 20, 12, 2, "shadow")
    s.r(6, 12, 4, 9, "stem").r(6, 12, 1, 9, "stem_d").r(5, 19, 6, 2, "stem_d")
    # Le chapeau doré, tacheté.
    s.r(1, 6, 14, 6, "cap").r(2, 4, 12, 2, "cap").r(4, 2, 8, 2, "cap").r(1, 11, 14, 1, "cap_d")
    s.r(4, 2, 8, 1, "cap_l").r(2, 4, 3, 1, "cap_l")
    for (x, y) in [(4, 5), (9, 4), (12, 7), (6, 8), (3, 9)]:
        s.r(x, y, 2, 1, "spot")
    if eaten:
        s.r(10, 6, 5, 5, (0, 0, 0, 0)).r(10, 6, 1, 5, "stem").r(11, 10, 4, 1, "stem")
    return s.done()


def map_table(read=False):
    s = Sprite(16, 16)
    s.r(1, 14, 14, 2, "shadow")
    s.r(1, 6, 14, 4, "wood").r(1, 6, 14, 1, "wood_l").r(2, 10, 2, 5, "wood_d").r(12, 10, 2, 5, "wood_d")
    if not read:
        s.r(2, 3, 12, 5, "paper").r(2, 3, 12, 1, "paper_d").r(1, 3, 1, 5, "paper_d").r(14, 3, 1, 5, "paper_d")
        for (x, y, w) in [(3, 4, 4), (8, 5, 3), (4, 6, 5)]:
            s.r(x, y, w, 1, "ink")
        s.p(11, 4, "comb")
    else:
        s.r(3, 5, 10, 2, "paper").r(3, 5, 10, 1, "paper_d").p(3, 6, "ink").p(12, 6, "ink")
    return s.done()


def candle(lit=False):
    s = Sprite(16, 18)
    s.r(5, 16, 6, 2, "shadow")
    s.r(5, 14, 6, 3, "st_d").r(4, 16, 8, 1, "st_k")
    s.r(6, 6, 4, 8, "wax").r(6, 6, 1, 8, "wax_d").r(7, 5, 1, 1, "ink")
    if lit:
        s.r(7, 1, 2, 4, "flame_o").r(7, 2, 1, 2, "flame").p(8, 0, "flame")
    return s.done()


SPRITES = {
    "puitsVoeux": well, "autelPoulet": chicken_altar, "autelPouletVide": lambda: chicken_altar(True),
    "miroir": mirror, "miroirBrise": lambda: mirror(True), "champiFestin": feast_mushroom,
    "champiFestinMange": lambda: feast_mushroom(True), "tableCarte": map_table, "tableCarteLue": lambda: map_table(True),
    "ciergeCrypte": candle, "ciergeCrypteAllume": lambda: candle(True),
}


def main():
    W = 20 + 110 * 6
    sheet = Image.new("RGB", (W, 420), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 18), "SALLES SPÉCIALES v1 — puits, autel du Poulet, miroir, festin, cartographe, crypte", fill=(255, 243, 200), font=font(15), anchor="mm")
    for i, (name, fn) in enumerate(SPRITES.items()):
        im = up(fn().img(), 5)
        x = 20 + (i % 6) * 110
        y = 40 + (i // 6) * 190
        sheet.paste(im, (x, y), im)
        d.text((x + 40, y + 150), name, fill=(232, 212, 150), font=font(11), anchor="mm")
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "salles_speciales_v1.png")
    sheet.save(out)
    print("art/salles_speciales_v1.png", sheet.size)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
        write("src/render/sprites/speciales.ts", "SPECIALES",
              "Salles spéciales v1 (art/salles_speciales_v1.png, Thomas 2026-11-26) : puits, autel du Poulet, miroir, festin, cartographe, crypte.",
              {k: fn().img() for k, fn in SPRITES.items()})
    else:
        main()
