"""Flammes : 6 propositions de dessin (Thomas, 2026-11-12 : « je pensais au design des flammes »).
Chaque flamme : 16 × 16 pixels, 3 images qui alternent. python3 art/flammes_v1.py → art/flammes_v1.png"""
import math
import re
from PIL import Image, ImageDraw
from pix import hash2, font, up

SRC = open("../src/ui/icons.ts").read()
PAL = dict(re.findall(r'"?(\w)"?: "(#[0-9a-f]{6})"', SRC.split("export const PALETTE")[1].split("};")[0]))
rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

# Couleurs du feu, du plus froid au plus chaud (contour, rouge sombre, rouge, orange, jaune, blanc).
OUT, DRED, RED, ORA, YEL, WHI = (58, 14, 10), (142, 30, 22), (210, 62, 30), (250, 142, 42), (255, 222, 96), (255, 250, 214)
BANDS = [(0.0, DRED), (0.25, RED), (0.48, ORA), (0.7, YEL), (0.88, WHI)]


def current():
    """La flamme actuelle du jeu (FIRE_FRAMES), pour comparer."""
    block = SRC.split("export const FIRE_FRAMES = [")[1].split("];\n")[0]
    frames = []
    for f in block.split("],")[:3]:
        rows = re.findall(r'"([^"]*)"', f)
        im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
        for y, r in enumerate(rows):
            for x, c in enumerate(r):
                if c != "." and c in PAL:
                    im.putpixel((x, y), rgb(PAL[c]) + (255,))
        frames.append(im)
    return frames


def render(heat, outline=True, bands=BANDS, sparks=()):
    """`heat(x, y)` → chaleur (≤ 0 : rien). Couleur par paliers, contour sombre autour."""
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    hot = [[heat(x + 0.5, y + 0.5) for x in range(16)] for y in range(16)]
    for y in range(16):
        for x in range(16):
            h = hot[y][x]
            if h > 0:
                col = bands[0][1]
                for t, c in bands:
                    if h >= t:
                        col = c
                im.putpixel((x, y), col + (255,))
            elif outline:
                if any(0 <= x + dx < 16 and 0 <= y + dy < 16 and hot[y + dy][x + dx] > 0 for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    im.putpixel((x, y), OUT + (255,))
    for (x, y, c) in sparks:
        if 0 <= x < 16 and 0 <= y < 16:
            im.putpixel((x, y), c + (255,))
    return im


def tongue(x, y, cx, base, top, width, sway, f):
    """Une langue de feu en goutte : large en bas, pointue en haut, qui ondule."""
    if y > base or y < top:
        return -1
    t = (base - y) / (base - top)  # 0 en bas, 1 en haut
    w = width * (1 - t) ** 0.75 * min(1.0, (t + 0.2) * 2.2)
    w = max(w, 0.01)
    off = sway * math.sin(t * 3.2 + f * 2.1) * t
    d = abs(x - cx - off) / w
    return (1 - d) * (1 - 0.55 * t) + 0.25 * (1 - t)


def langues_stage(f, stage):
    """Feu C selon son âge (Thomas, 2026-11-12 : « feu C et durée de vie ») : 0 haut et vif, 1 normal, 2 braises."""
    if stage == 1:
        return langues(f)
    if stage == 0:
        hs = [(3.8, 3 + 2 * ((f + 1) % 3), 3.6), (8.2, 0.5 + [0, 1.2, 0.5][f], 4.8), (12.4, 2.5 + 2 * ((f + 2) % 3), 3.4)]
        sparks = [(2 + (5 * f) % 11, 1 + f % 2, YEL), (13 - (3 * f) % 7, f, WHI), (6 + 2 * f, 2 - f % 2, ORA), (10 - f, 3 if f != 2 else 0, YEL)]
        return render(lambda x, y: max(tongue(x, y, cx, 15.5, top, w, 1.2, f + i) for i, (cx, top, w) in enumerate(hs)), sparks=sparks)
    hs = [(5.5, 10.5 + [0, 1, 0.5][f], 2.4), (10.5, 11.5 + [1, 0, 0.6][f], 2.0)]
    glow = [(255, 150, 60), (255, 200, 90), (200, 80, 40)]
    sparks = [(x, 15, glow[(x + f) % 3]) for x in (2, 4, 7, 9, 12, 14)] + [(3 + f * 4, 14, glow[f % 3]), ((7 + 5 * f) % 13 + 1, 9 - f, ORA)]
    return render(lambda x, y: max(tongue(x, y, cx, 15.5, top, w, 0.6, f + i) for i, (cx, top, w) in enumerate(hs)), sparks=sparks)


def frames_of(fn, n=3):
    return [fn(f) for f in range(n)]


# B — une grande flamme en goutte, cœur blanc, qui ondule.
def goutte(f):
    top = 1.5 + [0, 1.2, 0.5][f]
    return render(lambda x, y: tongue(x, y, 8, 15.5, top, 6.2, 1.6, f) - 0.03 * hash2(int(x), int(y), f))


# C — trois langues de hauteurs différentes et des étincelles qui montent.
def langues(f):
    hs = [(4.5, 6 + 2 * ((f + 1) % 3), 3.2), (8.2, 2 + [0, 1.5, 0.7][f], 4.4), (12, 5 + 2 * ((f + 2) % 3), 3.0)]
    sparks = [(3 + (5 * f) % 9, 3 - f % 2, YEL), (11 - (3 * f) % 6, 1 + f, ORA), (7 + f, 0 if f != 1 else 2, YEL)]
    return render(lambda x, y: max(tongue(x, y, cx, 15.5, top, w, 1.0, f + i) for i, (cx, top, w) in enumerate(hs)), sparks=sparks)


# D — feu bas qui lèche le sol, braises au pied.
def tapis(f):
    def heat(x, y):
        crest = 9 + 2.2 * math.sin(x * 0.9 + f * 2.0) + 1.2 * math.sin(x * 2.1 - f * 1.3)
        if y < crest or x < 0.8 or x > 15.2:
            return -1
        return (y - crest) / (15.5 - crest) * 0.9 + 0.1 - 0.15 * abs(x - 8) / 8
    sparks = [(x, 15, (255, 190, 70) if (x + f) % 3 else (255, 240, 160)) for x in range(2, 15, 3)]
    sparks += [((4 + 5 * f) % 14 + 1, 6 - f, YEL)]
    return render(heat, sparks=sparks)


# E — gros contour sombre, trois couleurs franches (comme les personnages du jeu).
def franc(f):
    bands = [(0.0, RED), (0.4, ORA), (0.75, YEL)]
    top = 2 + [0, 1, 0.4][f]
    def heat(x, y):
        a = tongue(x, y, 7.2, 15.5, top, 5.0, 1.4, f)
        b = tongue(x, y, 11.5, 15.5, 7 + f % 2, 2.6, 0.8, f + 1)
        return max(a, b)
    return render(heat, bands=bands)


# F — vie d'un feu : il naît haut et vif, brûle, puis baisse en braises (une image par étape).
def vie():
    big = render(lambda x, y: max(tongue(x, y, 8, 15.5, 0.5, 6.6, 1.6, 0), tongue(x, y, 3.5, 15.5, 7, 2.5, 1, 1), tongue(x, y, 12.5, 15.5, 6, 2.5, 1, 2)),
                 sparks=[(2, 2, YEL), (13, 1, YEL), (9, 0, WHI)])
    mid = render(lambda x, y: tongue(x, y, 8, 15.5, 5, 5.0, 1.2, 1))
    low = render(lambda x, y: max(tongue(x, y, 6, 15.5, 11, 2.6, 0.6, 2), tongue(x, y, 10.5, 15.5, 12.5, 2.0, 0.6, 0)),
                 sparks=[(3, 15, (255, 150, 60)), (8, 15, (255, 200, 90)), (13, 15, (255, 150, 60)), (5, 14, (200, 80, 40))])
    return [big, mid, low]


DESIGNS = [
    ("A — actuelle", current(), "Trois langues orange, sans contour."),
    ("B — goutte", frames_of(goutte), "Une grande flamme, cœur blanc, qui ondule."),
    ("C — langues et étincelles", frames_of(langues), "Trois langues inégales, étincelles qui montent."),
    ("D — feu bas", frames_of(tapis), "Il lèche le sol, braises au pied."),
    ("E — contour franc", frames_of(franc), "Gros contour sombre, 3 couleurs, comme nos sprites."),
    ("F — vie d'un feu", vie(), "Haut au début, plus bas ensuite, puis des braises."),
]


def floor_tile(x, y):
    """Une dalle sombre du sol, pour voir les flammes en situation."""
    im = Image.new("RGBA", (16, 16), (52, 44, 38, 255))
    d = ImageDraw.Draw(im)
    d.rectangle((0, 0, 15, 15), outline=(38, 31, 27))
    for i in range(6):
        px, py = int(hash2(x * 7 + i, y, 3) * 15), int(hash2(x, y * 5 + i, 4) * 15)
        im.putpixel((px, py), (66, 57, 49, 255))
    return im


def situation(frames, cells=((0, 1), (1, 1), (2, 1), (1, 0), (3, 1))):
    """Un petit carré de 5 × 2 cases en feu, à l'échelle du jeu (×3)."""
    W, H = 5, 2
    im = Image.new("RGBA", (W * 16, H * 16))
    for y in range(H):
        for x in range(W):
            im.paste(floor_tile(x, y), (x * 16, y * 16))
    # lueur chaude sous le feu
    glow = Image.new("RGBA", im.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for (x, y) in cells:
        gd.rectangle((x * 16, y * 16, x * 16 + 15, y * 16 + 15), fill=(255, 120, 30, 45))
    im = Image.alpha_composite(im, glow)
    for i, (x, y) in enumerate(cells):
        fr = frames[i % len(frames)]
        im.alpha_composite(fr, (x * 16, y * 16))
    return up(im, 3)


import sys
if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "export":
    # Écrit src/render/sprites/feu.ts : feu C en trois âges (haut, normal, braises), 3 images chacun.
    cols = {OUT: "o", DRED: "d", RED: "r", ORA: "a", YEL: "y", WHI: "w", (255, 190, 70): "b", (255, 240, 160): "c",
            (255, 150, 60): "e", (255, 200, 90): "g", (200, 80, 40): "h"}
    def rows(im):
        out = []
        for y in range(16):
            line = ""
            for x in range(16):
                px = im.getpixel((x, y))
                line += cols[px[:3]] if px[3] else "."
            out.append(line)
        return out
    pal = {v: "#%02x%02x%02x" % k for k, v in cols.items()}
    stages = [[rows(langues_stage(f, st)) for f in range(3)] for st in range(3)]
    import json
    with open("../src/render/sprites/feu.ts", "w") as fh:
        fh.write("// FICHIER GÉNÉRÉ par art/flammes_v1.py export : ne pas modifier à la main.\n")
        fh.write("/** Flammes C (art/flammes_v1.png), par âge du feu : [0] haut et vif, [1] normal, [2] braises ; 3 images chacun. */\n")
        fh.write("export const FIRE_PALETTE: Record<string, string> = " + json.dumps(pal) + ";\n")
        fh.write("export const FIRE_STAGES: string[][][] = " + json.dumps(stages, indent=1) + ";\n")
    print("src/render/sprites/feu.ts")
    sys.exit(0)

def sheet_main():
    S = 7
    pad = 24
    cardW = max(3 * 16 * S + 2 * 10 + 2 * pad, 470)
    sit_w = 5 * 16 * 3
    cols = 2
    cardH = 16 * S + 2 * 16 * 3 + 110
    W = cols * cardW + (cols + 1) * 20
    rows = math.ceil(len(DESIGNS) / cols)
    H = 70 + rows * (cardH + 20) + 30
    sheet = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 28), "FLAMMES — 6 propositions (3 images qui alternent)", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((W // 2, 52), "En haut : agrandi ×7.   En bas : sur le sol, à la taille du jeu.", fill=(200, 190, 170), font=font(14, False), anchor="mm")
    for i, (name, frames, note) in enumerate(DESIGNS):
        cx = 20 + (i % cols) * (cardW + 20)
        cy = 70 + (i // cols) * (cardH + 20)
        d.rectangle((cx, cy, cx + cardW, cy + cardH), fill=(44, 36, 30), outline=(120, 92, 48), width=2)
        d.text((cx + 14, cy + 10), name, fill=(240, 192, 80), font=font(18))
        x = cx + (cardW - (3 * 16 * S + 20)) // 2
        for fr in frames:
            bg = Image.new("RGBA", (16, 16), (22, 18, 16, 255))
            bg.alpha_composite(fr)
            sheet.paste(up(bg, S).convert("RGB"), (x, cy + 38))
            x += 16 * S + 10
        sit = situation(frames)
        sheet.paste(sit.convert("RGB"), (cx + (cardW - sit.width) // 2, cy + 48 + 16 * S))
        d.text((cx + 14, cy + cardH - 26), note, fill=(220, 210, 190), font=font(14, False))
    sheet.save("flammes_v1.png")
    print("flammes_v1.png", sheet.size)


if __name__ == "__main__":
    sheet_main()
