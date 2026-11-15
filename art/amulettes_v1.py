"""Planche « amulettes_v1 » (Thomas, 2026-11-15 : « propose 4 amulettes, une philosophie différente des bibelots :
vitalité, force, agilité… » ; « Ok. Un peu moins de vie »). Même pendentif pour les quatre (cuivre ; argent pour la version II), une pierre de couleur :
rouge vitalité, orange force, verte agilité, bleue précision ; la version « II » (section 2) a deux petites pierres sur
la chaîne et un éclat. Icônes 16 × 16, palette du jeu (src/ui/icons.ts).
  python3 art/amulettes_v1.py           → art/amulettes_v1.png
  python3 art/amulettes_v1.py rows      → les lignes à recopier dans src/ui/icons.ts
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from pix import font, up

BASE = [
    "................",
    "...g........g...",
    "....g......g....",
    ".....g....g.....",
    "......g..g......",
    ".......gg.......",
    "......KGGK......",
    ".....KGKKGK.....",
    "....KGGGGGGK....",
    "....KGABBCGK....",
    "....KGBBCDGK....",
    "....KGBCDDGK....",
    "....KGCDDDGK....",
    ".....KGGGGK.....",
    "......KKKK......",
    "................",
]
# Version II (section 2) : deux petites pierres sur la chaîne, et deux éclats.
TWO = list(BASE)
TWO[0] = "..g..........g.."
TWO[1] = "...C........C..."
TWO[7] = ".Y...KGKKGK....."
TWO[13] = ".....KGGGGK...Y."

GEMS = {
    "vitalite": {"A": "W", "B": "3", "C": "R", "D": "r"},
    "force": {"A": "W", "B": "X", "C": "O", "D": "x"},
    "agilite": {"A": "W", "B": "J", "C": "E", "D": "e"},
    "precision": {"A": "W", "B": "V", "C": "U", "D": "u"},
}
PAL = {"K": "#120d08", "G": "#f0c050", "g": "#a87c1c", "W": "#f4f7ff", "Y": "#ffe27a", "R": "#d03a44", "r": "#8e1f28", "3": "#e04048",
       "O": "#e8782a", "X": "#ff9a3a", "x": "#c03a1a", "E": "#5cc860", "e": "#2e7a38", "J": "#8ef0a0", "U": "#4a8fd0", "u": "#2a5a94", "V": "#9fd0f4", "T": "#b9824a", "t": "#7a5230", "S": "#c3cbe0", "D": "#7f88a6"}


# Métal (Thomas, 2026-11-15 : « les niveaux 1 en cuivre, les niveaux 2 en argent ») : la monture et la chaîne.
COPPER = {"G": "T", "g": "t"}
SILVER = {"G": "S", "g": "D", "Y": "W"}


def rows(kind, two=False):
    m = {**GEMS[kind], **(SILVER if two else COPPER)}
    return ["".join(m.get(c, c) for c in r) for r in (TWO if two else BASE)]


def img(r):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, line in enumerate(r):
        for x, c in enumerate(line):
            if c != ".":
                h = PAL[c]
                im.putpixel((x, y), (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255))
    return im


NAMES = [("vitalite", "Vitalité", "+4 PV max", "+8 PV max"), ("force", "Force", "+1 Force", "+2 Force"),
         ("agilite", "Agilité", "+2 Agilité", "+4 Agilité"), ("precision", "Précision", "+1 au jet", "+2 au jet")]

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "rows":
        for k, *_ in NAMES:
            for two in (False, True):
                print(f'  amulette_{k}{"_2" if two else ""}: [')
                for r in rows(k, two):
                    print(f'    "{r}",')
                print("  ],")
        sys.exit()
    W, H = 760, 360
    sheet = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 22), "AMULETTES v1 — un chiffre, toujours actif (les bibelots gardent les effets malins)", fill=(255, 243, 200), font=font(14), anchor="mm")
    for i, (k, name, one, two) in enumerate(NAMES):
        x = 40 + i * 180
        for j, tw in enumerate((False, True)):
            y = 60 + j * 150
            a = up(img(rows(k, tw)), 6)
            sheet.paste((54, 46, 64), (x - 4, y - 4, x + a.width + 4, y + a.height + 4))
            sheet.paste(a, (x, y), a)
            d.text((x + a.width // 2, y + a.height + 14), f"{name}{' II' if tw else ''}", fill=(255, 243, 200), font=font(12), anchor="mm")
            d.text((x + a.width // 2, y + a.height + 30), two if tw else one, fill=(200, 190, 170), font=font(11, False), anchor="mm")
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "amulettes_v1.png")
    sheet.save(out)
    print(out)
