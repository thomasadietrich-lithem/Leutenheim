"""Kobold frondeur v1 (Thomas, 2026-11-11 : « Kobold frondeur ok ») : le Kobold du jeu (planche art/schrat_v2.png, validée),
en jaque de cuir au lieu de la cotte de mailles, une fronde de cuir à la place de la dague (la pierre grise au bout).
Même dessin, autre palette : on reconnaît la famille, on distingue le tireur. Écrit art/frondeur_v2.png.
"""
import json, os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from pix import font

SRC = open(os.path.join(os.path.dirname(__file__), "..", "src", "render", "sprites", "schrat.ts")).read()
PAL = dict(re.findall(r'(\w): "(#[0-9a-f]{6})"', SRC[SRC.index("SCHRAT_PALETTE"):SRC.index("};")]))
# Jaque de cuir (C, c) ; fronde (M : lanière de cuir, m : la pierre) ; cornes un peu plus sombres (T).
FRONDEUR = {**PAL, "A": "#e08a3a", "a": "#9c5420", "Y": "#f4e04a", "C": "#6e4c2e", "c": "#40291a", "M": "#7a5230", "m": "#a4abc8", "T": "#cbbf98"}


def frames(name):
    i = SRC.index(f"  {name}: [")
    j = SRC.index("\n  ],", i)
    return [re.findall(r'"([^"]+)"', blk) for blk in SRC[i:j].split("    [")[1:]]


def render(rows, pal, S=6):
    im = Image.new("RGB", (16 * S, 16 * S), (70, 61, 82))
    d = ImageDraw.Draw(im)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ".":
                d.rectangle([x * S, y * S, x * S + S - 1, y * S + S - 1], fill=pal[c])
    return im


if __name__ == "__main__":
    poses = [("idleDown", 0), ("walkSide", 0), ("stabDown", 1), ("stabSide", 1), ("idleUp", 0)]
    W = max(760, 20 + len(poses) * (96 + 12))
    sheet = Image.new("RGB", (W, 300), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 18), "KOBOLD FRONDEUR v2 (orange) — à valider (en bas), à côté du Kobold (en haut)", fill=(255, 243, 200), font=font(13), anchor="mm")
    for k, (name, f) in enumerate(poses):
        rows = frames(name)[f]
        sheet.paste(render(rows, PAL), (20 + k * 108, 40))
        sheet.paste(render(rows, FRONDEUR), (20 + k * 108, 160))
    d.text((20, 270), "Peau orange, œil jaune, jaque de cuir sombre, fronde et pierre grise à la place de la dague.", fill=(200, 190, 170), font=font(11, False))
    sheet.save("art/frondeur_v2.png")
    print(json.dumps({k: FRONDEUR[k] for k in "AaYCcMmT"}))
