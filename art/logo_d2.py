"""LOGO RETENU (Thomas, 2026-11-13) : emblème « D2 » (dragon rouge de face au-dessus du d20, médaillon d'or à rubis)
et titre « T6 avec un O normal » (CAVE / ROLLER sur deux lignes, lettres d'or épaisses en relief).
Ne dépend que de art/logo_v3.py et art/logo_v4.py (déjà dans le dépôt). À lancer depuis la racine du dépôt :
  python3 art/logo_d2.py            → art/logo_d2.png (présentation : emblème, tailles d'icône, titre)
  python3 art/logo_d2.py icon       → pwa/icon-192.png, pwa/icon-512.png (emblème sur fond de cave)
  python3 art/logo_d2.py embleme    → art/logo_embleme.png (64 × 64 agrandi ×4, fond transparent hors du médaillon)
  python3 art/logo_d2.py titre      → art/logo_titre.png (titre seul, fond transparent, ×1 : à agrandir sans lissage)"""
import math
import sys
from PIL import Image, ImageDraw

sys.path.insert(0, "art")
import logo_v3  # noqa: E402
from logo_v3 import FIRE, FONT, GOLDS, K, bg, d20, halo  # noqa: E402
from logo_v4 import BOLD, CREAM, INK  # noqa: E402

GOLD = list(GOLDS)
RED = [(66, 12, 16), (128, 24, 26), (182, 46, 36), (234, 108, 66)]
HORN = [(120, 104, 76), (226, 214, 178)]
KEY = (255, 0, 255)
C = 31.5


def number(img, cx, cy):
    """« 20 » épais presque noir, liseré crème."""
    x0, y0 = int(cx - 5), int(cy - 3)
    cells = {(x0 + n * 6 + i, y0 + j) for n, ch in enumerate("20") for j, row in enumerate(BOLD[ch]) for i, b in enumerate(row) if b == "1"}
    px = img.load()
    for (x, y) in cells:
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                if (x + dx, y + dy) not in cells:
                    px[x + dx, y + dy] = CREAM
    for q in cells:
        px[q] = INK


def die(img, cx, cy, r):
    s = int(2 * r + 10)
    tmp = Image.new("RGB", (s, s), KEY)
    d20(tmp, s // 2, s // 2, r, number=False)
    number(tmp, s // 2, s // 2 + r * 0.12)
    mask = Image.new("L", (s, s), 0)
    mp, tp = mask.load(), tmp.load()
    for y in range(s):
        for x in range(s):
            if tp[x, y] != KEY:
                mp[x, y] = 255
    img.paste(tmp, (int(cx - s // 2), int(cy - s // 2)), mask)


def medal(img, R=31, t=6, inner=(18, 12, 10)):
    """Médaillon en relief : biseau extérieur, plat, biseau intérieur, éclairé d'en haut à gauche."""
    px = img.load()
    for y in range(64):
        for x in range(64):
            dx, dy = x - C, y - C
            r = math.hypot(dx, dy)
            if r > R + 1:
                continue
            if r > R or (R - t - 1 < r <= R - t):
                px[x, y] = K
            elif r <= R - t - 1:
                px[x, y] = inner
            else:
                u = (R - r) / t
                dot = (-0.6 * dx - 0.8 * dy) / (r or 1)
                lv = 3.4 + 2.6 * dot if u < 0.28 else 2.6 - 2.6 * dot if u > 0.72 else 3 + 1.2 * dot
                px[x, y] = GOLD[max(0, min(6, round(lv)))]


def studs(img):
    """Quatre rubis (haut, bas, gauche, droite) et quatre clous d'or (diagonales)."""
    d = ImageDraw.Draw(img)
    for k in range(8):
        a = math.radians(45 * k)
        x, y = round(C + 28 * math.cos(a)), round(C + 28 * math.sin(a))
        if k % 2 == 0:
            d.polygon([(x, y - 2), (x + 2, y), (x, y + 2), (x - 2, y)], fill=(200, 30, 40), outline=K)
            d.point((x, y - 1), fill=(255, 170, 160))
        else:
            d.rectangle([x - 1, y - 1, x, y], fill=GOLD[1])
            d.point((x - 1, y - 1), fill=GOLD[6])


def dragon(img, cx, cy, s=0.95):
    """Tête de dragon rouge de face : cornes, arcades froncées, yeux fendus, museau, braises aux joues."""
    d = ImageDraw.Draw(img)
    P = lambda pts, sx=1: [(cx + sx * x * s, cy + y * s) for (x, y) in pts]
    dk, md, lt, hi = RED
    eye = (255, 226, 90)
    for sx in (-1, 1):
        d.polygon(P([(6, -9), (13, -16), (19, -24), (15, -13), (11, -5)], sx), fill=HORN[1], outline=K)
        d.line(P([(8, -9), (14, -15), (17, -20)], sx), fill=HORN[0])
        d.polygon(P([(11, -3), (20, -7), (17, -1), (21, 3), (12, 5)], sx), fill=md, outline=K)
    d.polygon(P([(-12, -4), (-7, -11), (7, -11), (12, -4), (12, 3), (7, 9), (6, 17), (-6, 17), (-7, 9), (-12, 3)]), fill=md, outline=K)
    d.polygon(P([(-6, -10), (6, -10), (4, -3), (-4, -3)]), fill=lt)
    d.polygon(P([(-4, -3), (4, -3), (5, 16), (-5, 16)]), fill=lt)
    d.line(P([(0, -9), (0, 9)]), fill=hi)
    for y in (-8, -4, 0, 4):
        d.line(P([(-2, y), (2, y)]), fill=hi)
    for sx in (-1, 1):
        d.polygon(P([(11, -1), (4, 2), (5, 6), (10, 3)], sx), fill=eye)
        d.line(P([(7, 0), (7, 5)], sx), fill=K, width=1)
        d.point(P([(9, 1)], sx)[0], fill=(255, 250, 210))
        d.line(P([(12, -5), (3, 0)], sx), fill=K, width=2)
        d.line(P([(11, -7), (4, -3)], sx), fill=hi)
        n0, n1 = P([(2, 12)], sx)[0], P([(3, 14)], sx)[0]
        d.rectangle([min(n0[0], n1[0]), n0[1], max(n0[0], n1[0]), n1[1]], fill=K)
        d.line(P([(7, 9), (11, 4)], sx), fill=dk)
        for j, (x, y) in enumerate([(5, 10), (8, 7), (10, 3)]):
            q = P([(x, y)], sx)[0]
            d.ellipse([q[0] - 1, q[1] - 1, q[0] + 1, q[1] + 1], fill=FIRE[4 - j])
    d.line(P([(-6, 17), (6, 17)]), fill=K)
    for x in (-5, -2, 2, 5):
        d.polygon(P([(x - 1, 17), (x + 1, 17), (x, 20)]), fill=HORN[1], outline=K)


def emblem():
    """L'emblème D2, 64 × 64, sur fond de cave."""
    img = Image.new("RGB", (64, 64))
    bg(img)
    medal(img)
    studs(img)
    layer = img.copy()
    halo(layer, 32, 40, 24, (150, 50, 16), 0.65)
    dragon(layer, 32, 22)
    die(layer, 32, 45, 12)
    mask = Image.new("L", (64, 64), 0)
    ImageDraw.Draw(mask).ellipse([C - 24, C - 24, C + 24, C + 24], fill=255)
    img.paste(layer, (0, 0), mask)
    return img


def emblem_cut():
    """Le même, transparent hors du médaillon (pour le menu)."""
    img = emblem().convert("RGBA")
    px = img.load()
    for y in range(64):
        for x in range(64):
            if math.hypot(x - C, y - C) > 32:
                px[x, y] = (0, 0, 0, 0)
    return img


def word(text):
    """Un mot en lettres 14 × 16 (police 7 × 8 doublée) : dégradé d'or, biseau clair/sombre, double contour sombre."""
    cs, x = {}, 0
    for c in text:
        for j, row in enumerate(FONT[c]):
            for i, b in enumerate(row):
                if b == "1":
                    for sy in range(2):
                        for sx in range(2):
                            cs[(x + i * 2 + sx, j * 2 + sy)] = (j * 2 + sy) / 15
        x += (len(FONT[c][0]) + 1) * 2
    pad = 3
    img = Image.new("RGBA", (max(p[0] for p in cs) + 1 + 2 * pad, 16 + 2 * pad), (0, 0, 0, 0))
    px = img.load()
    cur = set(cs)
    for _ in range(2):
        cur = {(x + dx, y + dy) for (x, y) in cur for dx in (-1, 0, 1) for dy in (-1, 0, 1)}
    for (x, y) in cur:
        px[x + pad, y + pad] = K + (255,)
    shades = [GOLD[6], GOLD[5], GOLD[5], GOLD[4], GOLD[4], GOLD[3], GOLD[2], GOLD[2]]
    for (x, y), t in cs.items():
        col = shades[min(7, int(t * 8))]
        if (x - 1, y) not in cs or (x, y - 1) not in cs:
            col = GOLD[6]
        elif (x + 1, y) not in cs or (x, y + 1) not in cs:
            col = GOLD[1]
        px[x + pad, y + pad] = col + (255,)
    return img


def title():
    """« CAVE » au-dessus de « ROLLER », centrés, les contours se touchent presque."""
    a, b = word("CAVE"), word("ROLLER")
    out = Image.new("RGBA", (b.width, a.height + b.height - 3), (0, 0, 0, 0))
    out.paste(a, ((b.width - a.width) // 2, 0), a)
    out.paste(b, (0, a.height - 3), b)
    return out


def plate():
    out = Image.new("RGB", (640, 760), (13, 10, 8))
    out.paste(emblem().resize((384, 384), Image.NEAREST), (128, 24))
    for m, size in enumerate([96, 48]):
        out.paste(emblem().resize((size, size), Image.LANCZOS), (16 + m * 0, 24 + m * 110))
    t = title()
    big = t.resize((t.width * 4, t.height * 4), Image.NEAREST)
    out.paste(big, ((640 - big.width) // 2, 440), big)
    out.save("art/logo_d2.png")


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else ""
    if cmd == "icon":
        for size in (192, 512):
            emblem().resize((size, size), Image.NEAREST).save(f"pwa/icon-{size}.png")
    elif cmd == "embleme":
        emblem_cut().resize((256, 256), Image.NEAREST).save("art/logo_embleme.png")
    elif cmd == "titre":
        title().save("art/logo_titre.png")
    else:
        plate()
