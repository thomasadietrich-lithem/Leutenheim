"""Personnage en feu : 4 propositions (Thomas, 2026-11-12 : « prévoir une option quand un perso crame,
peut-être un feu depuis le centre de la tuile »). Flammes du feu C. python3 art/perso_feu_v1.py → art/perso_feu_v1.png"""
import re
from PIL import Image, ImageDraw
from pix import font, up
from flammes_v1 import render, tongue, langues_stage, floor_tile, YEL, ORA, WHI, RED

SRC = open("../src/render/sprites/schrat.ts").read()
PAL = dict(re.findall(r'(\w): "(#[0-9a-f]{6})"', SRC.split("SCHRAT_PALETTE")[1].split("};")[0]))
ROWS = re.findall(r'"([^"]*)"', SRC.split("idleDown: [")[1].split("],")[0])[:16]


def kobold(tint=None):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, r in enumerate(ROWS):
        for x, c in enumerate(r):
            if c in PAL:
                col = tuple(int(PAL[c][i:i + 2], 16) for i in (1, 3, 5))
                if tint and c not in "OK":
                    t, k = tint
                    col = tuple(int(a * (1 - k) + b * k) for a, b in zip(col, t))
                im.putpixel((x, y), col + (255,))
    return im


def fade(im, a):
    im = im.copy()
    im.putalpha(im.getchannel("A").point(lambda v: int(v * a)))
    return im


def opt_a(f):
    """Actuel : la case de flammes entière, à demi transparente, par-dessus."""
    base = kobold()
    base.alpha_composite(fade(langues_stage(f, 1), 0.8))
    return base


def opt_b(f):
    """Depuis le centre : une flamme qui part du ventre et monte au-dessus de la tête ; les pieds et le visage restent lisibles."""
    base = kobold()
    fl = render(lambda x, y: max(tongue(x, y, 7.8, 13.5, 0.5 + [0, 1, 0.5][f], 2.3, 0.9, f),
                                 tongue(x, y, 5.5, 13.5, 9 + f % 2, 1.3, 0.6, f + 1),
                                 tongue(x, y, 10.5, 13.5, 8.5 + (f + 1) % 2, 1.3, 0.6, f + 2)))
    base.alpha_composite(fade(fl, 0.85))
    return base


def opt_c(f):
    """Flammèches sur la tête et les épaules : petites langues aux bords du corps, le personnage reste entier."""
    base = kobold()
    sparks = [(3 + 2 * f, 0, YEL), (12 - f, 1, ORA)]
    fl = render(lambda x, y: max(tongue(x, y, 3.2, 12, 6.5 + f % 2, 1.4, 0.6, f),
                                 tongue(x, y, 12.8, 12, 6 + (f + 1) % 2, 1.4, 0.6, f + 1),
                                 tongue(x, y, 8 + [0, 1, -1][f], 4.5, 0.2, 1.6, 0.6, f + 2)), sparks=sparks)
    base.alpha_composite(fl)
    return base


def opt_d(f):
    """Silhouette rougeoyante : le personnage passe à l'orange et vacille, quelques braises montent ; pas de grande flamme."""
    k = [0.45, 0.6, 0.5][f]
    base = kobold(((255, 120, 40), k))
    d = ImageDraw.Draw(base)
    for (x, y, c) in [(4 + f, 2 - f % 2, YEL), (11 - f, 1 + f % 2, ORA), (8, 0 if f == 1 else 3, WHI), (2 + 2 * f, 6, ORA)]:
        d.point((x, y), fill=c + (255,))
    return base


OPTS = [("A — actuel : la case en flammes", opt_a), ("B — depuis le centre du corps", opt_b),
        ("C — flammèches tête et épaules", opt_c), ("D — silhouette rougeoyante", opt_d)]

S = 7
cardW, cardH = 470, 16 * S + 48 * 2 + 70
W = 2 * cardW + 60
H = 70 + 2 * (cardH + 20) + 10
sheet = Image.new("RGB", (W, H), (26, 20, 14))
d = ImageDraw.Draw(sheet)
d.text((W // 2, 28), "PERSONNAGE EN FEU — 4 propositions (3 images)", fill=(255, 243, 200), font=font(22), anchor="mm")
d.text((W // 2, 52), "En haut : agrandi ×7.   En bas : sur le sol, à la taille du jeu, à côté d'une case en feu.", fill=(200, 190, 170), font=font(14, False), anchor="mm")
for i, (name, fn) in enumerate(OPTS):
    cx = 20 + (i % 2) * (cardW + 20)
    cy = 70 + (i // 2) * (cardH + 20)
    d.rectangle((cx, cy, cx + cardW, cy + cardH), fill=(44, 36, 30), outline=(120, 92, 48), width=2)
    d.text((cx + 14, cy + 10), name, fill=(240, 192, 80), font=font(18))
    x = cx + (cardW - (3 * 16 * S + 20)) // 2
    for f in range(3):
        bg = floor_tile(f, 0)
        bg.alpha_composite(fn(f))
        sheet.paste(up(bg, S).convert("RGB"), (x, cy + 40))
        x += 16 * S + 10
    strip = Image.new("RGBA", (16 * 4, 16))
    for t in range(4):
        strip.paste(floor_tile(t, 1), (t * 16, 0))
    strip.alpha_composite(langues_stage(0, 1), (0, 0))
    strip.alpha_composite(fn(0), (16, 0))
    strip.alpha_composite(fn(1), (48, 0))
    big = up(strip, 3)
    sheet.paste(big.convert("RGB"), (cx + (cardW - big.width) // 2, cy + 52 + 16 * S))
sheet.save("perso_feu_v1.png")
print("perso_feu_v1.png", sheet.size)
