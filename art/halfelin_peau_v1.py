"""Planche « Halfelin : teintes de peau v1 » (Thomas, 2026-11-16 : « encore un peu plus sombre, propose plusieurs
variations »). PROPOSITION. Six teintes de peau et de cheveux sur le Halfelin de `races_v1.py`.
  python3 art/halfelin_peau_v1.py → art/halfelin_peau_v1.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

import races_v1 as R  # noqa: E402

CUIVRE = {"H": (156, 72, 30), "G": (204, 116, 50), "h": (104, 46, 20)}
CUIVRE_CLAIR = {"H": (188, 96, 40), "G": (232, 150, 70), "h": (128, 60, 26)}
BRUN = {"H": (78, 46, 28), "G": (118, 74, 42), "h": (50, 30, 20)}
NOIR = {"H": (46, 36, 40), "G": (80, 66, 68), "h": (30, 24, 28)}


def skin(S, s, p):
    return {"S": S, "s": s, "p": p}


VARIANTS = [
    ("A", "Hâlé (actuel), cuivré", {**skin((212, 156, 110), (170, 114, 76), (194, 138, 94)), **CUIVRE}),
    ("B", "Hâlé foncé, cuivré", {**skin((190, 134, 92), (148, 98, 64), (172, 118, 80)), **CUIVRE}),
    ("C", "Brun, cuivré clair", {**skin((166, 110, 72), (126, 80, 50), (148, 96, 62)), **CUIVRE_CLAIR}),
    ("D", "Brun, cheveux bruns", {**skin((166, 110, 72), (126, 80, 50), (148, 96, 62)), **BRUN}),
    ("E", "Brun foncé, cuivré clair", {**skin((138, 88, 56), (102, 62, 38), (122, 76, 48)), **CUIVRE_CLAIR}),
    ("F", "Brun foncé, cheveux noirs", {**skin((138, 88, 56), (102, 62, 38), (122, 76, 48)), **NOIR}),
]
POSES = ["idleDown", "idleSide", "idleUp", "walkSide", "swordSide", "bowSide", "prone0", "getUp"]


def main():
    S = 6
    n = 16 * S
    W = 16 + len(POSES) * (n + 4) + 190
    H = 70 + len(VARIANTS) * (n + 30) + 10
    img = Image.new("RGB", (W, H), R.BG)
    d = ImageDraw.Draw(img)
    d.text((16, 12), "CAVE ROLLER — HALFELIN : teintes de peau v1 (proposition)", fill=R.GOLD, font=R.fnt(17))
    d.text((16, 36), "À droite : la taille du jeu, ×2 et ×3.", fill=R.INK, font=R.fnt(12, False))
    y = 70
    for letter, name, pal_over in VARIANTS:
        R.RACE_PAL["halfelin"] = pal_over
        fs, pal = R.build("halfelin")
        d.text((16, y - 2), letter + "  " + name, fill=R.GOLD, font=R.fnt(13))
        x = 16
        for k in POSES:
            R.cell(img, d, x, y + 16, fs[k][0], pal, S)
            x += n + 4
        x += 8
        for sc in (2, 3):
            for k in ("idleDown", "idleSide"):
                R.cell(img, d, x, y + 16 + (n - 16 * sc) // 2, fs[k][0], pal, sc, grid=False)
                x += 16 * sc + 3
            x += 6
        y += n + 30
    img.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "halfelin_peau_v1.png"))
    print(img.size)


if __name__ == "__main__":
    main()
