"""Essais de pictogramme « pousser » (16x16, palette des icônes du jeu), à choisir avec Thomas."""
import re
from PIL import Image, ImageDraw, ImageFont
src = open("src/ui/icons.ts", encoding="utf8").read()
PAL = dict(re.findall(r'(\w): "(#[0-9a-f]{6})"', src.split("export const PALETTE")[1].split("};")[0]))
ESSAIS = {
 "A · BOTTE QUI COGNE": [
  "................",
  "......KKKKK.....",
  "......KTTTK.....",
  "......KTTTK.....",
  "......KTTTK.....",
  "..G...KTTTK.....",
  "......KTTTTK....",
  ".GGG..KTTTTTKKK.",
  "......KTTTTTTTBK",
  "..G...KTTTTTTTBK",
  "......KbbbbbbbbK",
  "......KKKKKKKKKK",
  "................",
  "................",
  "................",
  "................",
 ],
 "B · COUP DE BOUCLIER": [
  "................",
  "....KKKKK.......",
  "..KKSSSSSKK.....",
  ".KSBBBBBBBSK..W.",
  ".KSBBBBBBBSK.W..",
  "KSBBBKKKBBBSK...",
  "KSBBBKGKBBBSKWWW",
  "KSBBBKKKBBBSK...",
  ".KSBBBBBBBSK.W..",
  ".KSBBBBBBBSK..W.",
  "..KKSSSSSKK.....",
  "....KKKKK.......",
  "................",
  "................",
  "................",
  "................",
 ],
}
for n, rows in ESSAIS.items():
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), (n, [len(r) for r in rows])
S = 10
sheet = Image.new("RGB", (len(ESSAIS) * 200 + 20, 300), (26, 20, 14)); d = ImageDraw.Draw(sheet)
f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 13)
for i, (n, rows) in enumerate(ESSAIS.items()):
    ox = 20 + i * 200
    d.text((ox + 80, 20), n, fill=(255, 243, 200), font=f, anchor="mm")
    d.rectangle([ox, 40, ox + 160, 200], fill=(40, 30, 20), outline=(214, 170, 84), width=3)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ".": d.rectangle([ox + x * S, 40 + y * S, ox + x * S + S - 1, 40 + y * S + S - 1], fill=PAL[c])
    # taille réelle sur un bouton
    bx, by = ox + 56, 225
    d.rectangle([bx, by, bx + 47, by + 47], fill=(40, 30, 20), outline=(214, 170, 84), width=2)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ".": d.rectangle([bx + 8 + x * 2, by + 8 + y * 2, bx + 9 + x * 2, by + 9 + y * 2], fill=PAL[c])
sheet.save("art/pousser_essais.png"); print(sheet.size)
