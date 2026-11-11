"""Rigoles v2 (Thomas, 2026-11-11 : « les rigoles devraient être moins régulières, et atteindre les voies d'évacuation »).
Une rigole est maintenant faite de morceaux qui se raccordent par le milieu des bords de la case (N, E, S, O) : droits
(deux variantes, légèrement courbés), virages arrondis, bout (une petite flaque d'où elle part) et évacuation (la
grille, avec le bout de rigole qui y entre). Bords de pierre un peu irréguliers. Deux couleurs : eau (cuisine) et sang
(torture). `pieces()` renvoie {nom: image 16 × 16} ; `python3 art/rigoles_v2.py` écrit la planche art/rigoles_v2.png.
"""
import math, os, random, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from pix import font, hexrgb

EDGE = {"N": (7.5, -0.5), "S": (7.5, 15.5), "E": (15.5, 7.5), "W": (-0.5, 7.5)}
STYLE = {
    "water": {"deep": "#2a2632", "shine": "#4a4a5e", "lit": "#a8a6b2", "shade": "#3a3440"},
    "blood": {"deep": "#5a1418", "shine": "#8a2228", "lit": "#7a7488", "shade": "#2e2228"},
}


def curve(a, b, bend):
    """Points de a vers b en passant près du centre (virage arrondi, ou droite légèrement courbée)."""
    c = (7.5, 7.5)
    pts = []
    for i in range(33):
        t = i / 32
        x = (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0]
        y = (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]
        if bend:  # droite : on la bombe un peu de côté
            nx, ny = -(b[1] - a[1]), b[0] - a[0]
            n = math.hypot(nx, ny) or 1
            off = bend * math.sin(math.pi * t)
            x += off * nx / n
            y += off * ny / n
        pts.append((x, y))
    return pts


def draw(lines, style, seed, blob=None, grate=False):
    st = {k: hexrgb(v) for k, v in STYLE[style].items()}
    rnd = random.Random(seed)
    noise = [[rnd.uniform(-0.45, 0.45) for _ in range(16)] for _ in range(16)]
    im = Image.new("RGBA", (16, 16))
    pts = [p for l in lines for p in l]
    for y in range(16):
        for x in range(16):
            best, near = 99.0, (0, 0)
            for (px, py) in pts:
                d = math.hypot(x - px, y - py)
                if d < best:
                    best, near = d, (px, py)
            if blob:
                d = math.hypot(x - blob[0], y - blob[1]) - 1.6
                if d < best:
                    best, near = max(d, 0), blob
            if grate:
                dg = ((x - 7.5) / 5.4) ** 2 + ((y - 7.5) / 4.4) ** 2
                if dg <= 1.0:
                    if dg <= 0.6:
                        c = st["deep"] if x % 2 else hexrgb("#5a5f74")
                    else:
                        c = hexrgb("#8a90a8") if y < 8 else hexrgb("#4e5570")
                    im.putpixel((x, y), c + (255,))
                    continue
            if best <= 1.15 + noise[y][x] * 0.4:
                c = st["shine"] if (x + 2 * y + seed) % 9 == 0 else st["deep"]
            elif best <= 2.25 + noise[y][x]:
                side = (x - near[0]) + (y - near[1])
                c = st["lit"] if side < 0 else st["shade"]
            else:
                continue
            im.putpixel((x, y), c + (255,))
    return im


def pieces():
    out = {}
    for style, pre in (("water", "gut"), ("blood", "bgut")):
        seed = 0
        for a, b in (("N", "S"), ("E", "W")):
            for v, bend in (("a", 1.4), ("b", -1.4)):
                seed += 1
                out[f"{pre}_{a}{b}{v}"] = draw([curve(EDGE[a], EDGE[b], bend)], style, seed)
        for a, b in (("N", "E"), ("N", "W"), ("S", "E"), ("S", "W")):
            seed += 1
            out[f"{pre}_{a}{b}"] = draw([curve(EDGE[a], EDGE[b], 0)], style, seed)
        for d in "NESW":
            seed += 1
            out[f"{pre}_{d}"] = draw([curve(EDGE[d], (7.5, 7.5), 0.6)], style, seed, blob=(7.5, 7.5))
            out[f"{pre}Drain_{d}"] = draw([curve(EDGE[d], (7.5, 7.5), 0)], style, seed + 50, grate=True)
    return out


if __name__ == "__main__":
    ps = pieces()
    S = 5
    sheet = Image.new("RGB", (40 + 8 * (16 * S + 8), 520), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((sheet.width // 2, 16), "RIGOLES v2 — morceaux qui se raccordent, tracé irrégulier jusqu'à la grille", fill=(255, 243, 200), font=font(13), anchor="mm")
    floor = hexrgb("#4a4450")
    names = list(ps)
    for k, n in enumerate(names):
        tile = Image.new("RGBA", (16, 16), floor + (255,))
        tile.alpha_composite(ps[n])
        x = 20 + (k % 8) * (16 * S + 8)
        y = 40 + (k // 8) * (16 * S + 12)
        sheet.paste(tile.convert("RGB").resize((16 * S, 16 * S), Image.NEAREST), (x, y))
    sheet.save("art/rigoles_v2.png")
    print(len(ps))
