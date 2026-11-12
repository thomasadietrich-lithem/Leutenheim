"""Bouton de la barre d'actions : 7 propositions de picto (Thomas, 2026-11-12 : « propose d'autres pictogrammes »).
Pixels 16 × 16, palette du jeu, posés dans une vraie capture de la barre du bas.
python3 art/pictos_actions_v1.py [capture.png] → art/pictos_actions_v1.png"""
import re
import sys
from PIL import Image, ImageDraw
from pix import font, up

SRC = open("src/ui/icons.ts").read()
PAL = dict(re.findall(r'"?(\w)"?: "(#[0-9a-f]{6})"', SRC.split("export const PALETTE")[1].split("};")[0]))
CURRENT = re.findall(r'"([^"]*)"', SRC.split("  actions: [")[1].split("],")[0])

ICONS = [
    ("A — actuel : barre de 3 cases", CURRENT),
    ("B — engrenage", [
        "................",
        "......KKKK......",
        "......KGGK......",
        "..KK.KGGGGK.KK..",
        "..KGKKGGGGKKGK..",
        "..KGGGGggGGGGK..",
        "...KGGgKKgGGK...",
        "KKKKGgK..KgGKKKK",
        "KGGGGgK..KgGGGGK",
        "KKKKGGgKKgGGKKKK",
        "...KGGGggGGGK...",
        "..KGGGGGGGGGGK..",
        "..KGKKGGGGKKGK..",
        "..KK.KGGGGK.KK..",
        "......KGGK......",
        "......KKKK......",
    ]),
    ("C — rose des vents", [
        "................",
        ".......K........",
        "......KGK.......",
        "......KGK.......",
        ".....KGYgK......",
        ".....KGYgK......",
        ".KKKKGGYggKKKK..",
        "KGGGGYYWYYggggK.",
        ".KKKKggYGGKKKK..",
        ".....KgYGK......",
        ".....KgYGK......",
        "......KgK.......",
        "......KgK.......",
        ".......K........",
        "................",
        "................",
    ]),
    ("D — parchemin (liste)", [
        "................",
        "..KKKKKKKKKKK...",
        ".KLLLLLLLLLLLK..",
        ".KZKKKKKKKKKZK..",
        "..KLLLLLLLLLK...",
        "..KLULnnnnnLK...",
        "..KLLLLLLLLLK...",
        "..KLOLnnnnnLK...",
        "..KLLLLLLLLLK...",
        "..KLRLnnnnLLK...",
        "..KLLLLLLLLLK...",
        ".KKKKKKKKKKKKK..",
        "KLLLLLLLLLLLLLK.",
        "KZZZZZZZZZZZZZK.",
        ".KKKKKKKKKKKKK..",
        "................",
    ]),
    ("E — loupe et torche croisées", [
        "..KKK......KYK..",
        ".KVVVK....KXYXK.",
        "KVWVVUK...KXOXK.",
        "KVVVUUK....KOK..",
        "KVVUUUK...KTK...",
        ".KUUuK...KTK....",
        "..KKKgK.KTK.....",
        "......KgTK......",
        ".....KTKgK......",
        "....KTK..KgK....",
        "...KBK....KgK...",
        "..KBK......KgK..",
        ".KBK........KgK.",
        ".KK..........KK.",
        "................",
        "................",
    ]),
    ("F — trois points", [
        "................",
        "................",
        "................",
        ".KKKKKKKKKKKKKK.",
        ".KbbbbbbbbbbbbK.",
        ".KbnnnnnnnnnnbK.",
        ".KbnnnnnnnnnnbK.",
        ".KbnGGnGGnGGnbK.",
        ".KbnGgnGgnGgnbK.",
        ".KbnnnnnnnnnnbK.",
        ".KbnnnnnnnnnnbK.",
        ".KbbbbbbbbbbbbK.",
        ".KKKKKKKKKKKKKK.",
        "................",
        "................",
        "................",
    ]),
    ("G — éclair", [
        "........KKKK....",
        ".......KYYGK....",
        "......KYYGK.....",
        ".....KYYGK......",
        "....KYYGK.......",
        "...KYYGKKKKK....",
        "..KYYGGGGGGK....",
        "..KKKKKKYGK.....",
        ".......KYGK.....",
        "......KYGK......",
        ".....KYGK.......",
        "....KYGK........",
        "...KYgK.........",
        "...KgK..........",
        "...KK...........",
        "................",
    ]),
]


def icon(rows):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, r in enumerate(rows[:16]):
        for x, c in enumerate(r[:16]):
            if c in PAL:
                h = PAL[c]
                im.putpixel((x, y), tuple(int(h[i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    return im


# Capture de la barre du bas (densité 2) : bouton « actions » à (182.5, 706, 83×48), picto 28 px à (210, 716).
shot = Image.open(sys.argv[1] if len(sys.argv) > 1 else "/tmp/dbg/bar_full.png").convert("RGB")
S = 2
bar = shot.crop((6 * S, 700 * S, 354 * S, 756 * S))
fill = shot.getpixel((int(200 * S), int(712 * S)))

W = 760
cardH = 16 * 6 + 54
H = 70 + len(ICONS) * (cardH + 14)
sheet = Image.new("RGB", (W, H), (26, 20, 14))
d = ImageDraw.Draw(sheet)
d.text((W // 2, 26), "BOUTON DE LA BARRE D'ACTIONS — 7 pictos", fill=(255, 243, 200), font=font(22), anchor="mm")
d.text((W // 2, 50), "À gauche : agrandi ×6.  À droite : dans la vraie barre du bas (au milieu).", fill=(200, 190, 170), font=font(14, False), anchor="mm")
y = 70
for name, rows in ICONS:
    im = icon(rows)
    d.rectangle((14, y, W - 14, y + cardH), fill=(44, 36, 30), outline=(120, 92, 48), width=2)
    d.text((28, y + 10), name, fill=(240, 192, 80), font=font(18))
    tile = Image.new("RGBA", (16, 16), fill + (255,))
    tile.alpha_composite(im)
    sheet.paste(up(tile, 6).convert("RGB"), (28, y + 40))
    b = bar.copy()
    px, py = int((210 - 6) * S), int((716 - 700) * S)
    ImageDraw.Draw(b).rectangle((px, py, px + 28 * S - 1, py + 28 * S - 1), fill=fill)
    b.paste(up(im, 28 * S // 16), (px, py), up(im, 28 * S // 16))
    b = b.resize((b.width * 3 // 4, b.height * 3 // 4), Image.LANCZOS)
    sheet.paste(b, (28 + 16 * 6 + 24, y + 40 + (16 * 6 - b.height) // 2))
    y += cardH + 14
sheet.save("art/pictos_actions_v1.png")
print("art/pictos_actions_v1.png", sheet.size)
