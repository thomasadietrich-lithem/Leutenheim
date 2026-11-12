"""Logo v3 (Thomas, 2026-11-12 : « meilleure résolution, abandonne l'arche, concentre-toi sur le d20, éventuellement les
torches ») : icônes de 64 × 64 pixels. python3 art/logo_v3.py → art/logo_v3.png ; python3 art/logo_v3.py icon N → pwa/."""
import math
import sys
from PIL import Image, ImageDraw, ImageFont

K = (12, 10, 16)
BG = (13, 10, 8)
GOLDS = [(92, 62, 14), (130, 92, 22), (168, 124, 28), (206, 158, 46), (240, 192, 80), (255, 222, 120), (255, 242, 190)]
FIRE = [(150, 40, 16), (208, 70, 24), (240, 120, 40), (255, 160, 58), (255, 210, 80), (255, 246, 190)]
WOOD = [(58, 34, 14), (90, 56, 23), (128, 84, 40), (160, 110, 56)]
IRON = [(40, 42, 54), (70, 74, 92), (120, 124, 146)]
DIG = {"2": ["1111", "0001", "0001", "1111", "1000", "1000", "1111"], "0": ["1111", "1001", "1001", "1001", "1001", "1001", "1111"]}


def bg(img, warm=False):
    """Fond de cave : presque noir, quelques grains."""
    px = img.load()
    for y in range(img.height):
        for x in range(img.width):
            h = (x * 73856093 ^ y * 19349663) % 97
            base = (22, 15, 10) if warm else BG
            px[x, y] = (30, 23, 18) if h == 0 else (18, 14, 12) if h < 4 else base


def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))


def d20(img, cx, cy, r, light=(-0.6, -0.8), glow_side=None, number=True, scale=2):
    """Un d20 vu de face, facettes ombrées selon la lumière (en haut à gauche par défaut)."""
    d = ImageDraw.Draw(img)
    P = [(cx + r * math.cos(math.radians(60 * i - 90)), cy + r * math.sin(math.radians(60 * i - 90))) for i in range(6)]
    k = 0.58
    a = (cx, cy - r * k)
    b = (cx + r * k * math.cos(math.radians(30)), cy + r * k * 0.5)
    c = (cx - r * k * math.cos(math.radians(30)), cy + r * k * 0.5)
    faces = [
        ((a, b, c), 0.0),
        ((P[0], P[1], a), 0.9), ((P[0], a, P[5]), 0.9),
        ((P[1], b, a), 0.55), ((P[1], P[2], b), 1.0), ((P[2], P[3], b), 1.0),
        ((P[3], c, b), 0.55), ((P[3], P[4], c), 1.0), ((P[4], P[5], c), 1.0), ((P[5], a, c), 0.55),
    ]
    lx, ly = light
    for pts, tilt in faces:
        mx = sum(p[0] for p in pts) / 3 - cx
        my = sum(p[1] for p in pts) / 3 - cy
        n = math.hypot(mx, my) or 1
        facing = (mx * lx + my * ly) / n  # -1 à l'ombre, +1 face à la lumière
        level = 4 + facing * 2 * tilt
        if glow_side is not None:
            level += 0.8 * (mx * glow_side) / n * tilt
        level = max(0, min(6, round(level)))
        d.polygon(pts, fill=GOLDS[level])
    # arêtes : un trait sombre entre les facettes
    edges = [(a, b), (b, c), (c, a), (P[0], a), (P[1], a), (P[5], a), (P[1], b), (P[2], b), (P[3], b), (P[3], c), (P[4], c), (P[5], c)]
    for p, q in edges:
        d.line([p, q], fill=GOLDS[1])
    d.polygon(P, outline=K)
    d.line(P + [P[0]], fill=K, width=2)
    if number:
        w = 4 * scale
        x0 = int(cx - w - scale)
        y0 = int(cy - 1 * scale)
        for n, ch in enumerate("20"):
            for j, row in enumerate(DIG[ch]):
                for i, bit in enumerate(row):
                    if bit == "1":
                        X = x0 + n * (w + scale) + i * scale
                        Y = y0 + j * scale // 1 - 2 * scale
                        d.rectangle([X, Y, X + scale - 1, Y + scale - 1], fill=GOLDS[0])
    # éclat de lumière sur l'arête en haut à gauche
    hx, hy = int(cx - r * 0.42), int(cy - r * 0.5)
    for (dx, dy) in [(0, 0), (1, 0), (0, 1), (2, -1)]:
        img.putpixel((hx + dx, hy + dy), GOLDS[6])


def torch(img, x, y, h=26, lean=0):
    """Une torche : manche de bois, bague de fer, flamme en couches. (x, y) : bas du manche."""
    d = ImageDraw.Draw(img)
    for j in range(h):
        X = x + int(lean * j / h)
        Y = y - j
        d.rectangle([X - 2, Y, X + 1, Y], fill=WOOD[1])
        img.putpixel((X - 2, Y), WOOD[0])
        img.putpixel((X + 1, Y), WOOD[0])
        img.putpixel((X - 1, Y), WOOD[2] if j % 5 else WOOD[3])
    tx = x + lean
    ty = y - h
    d.rectangle([tx - 3, ty, tx + 2, ty + 3], fill=IRON[1], outline=IRON[0])
    d.line([(tx - 2, ty + 1), (tx + 1, ty + 1)], fill=IRON[2])
    flame = [
        (0, 12, 0), (-4, 9, 1), (4, 9, 1), (-5, 6, 1), (5, 6, 1), (-3, 3, 2), (3, 3, 2), (-2, -2, 3), (2, -1, 3), (0, -6, 4), (0, 2, 4), (0, 6, 5),
    ]
    # flamme : ellipses de plus en plus petites et claires
    for i, (w, hgt, off) in enumerate([(7, 14, 0), (5, 11, 1), (4, 8, 2), (2, 5, 3)]):
        col = FIRE[1 + i]
        d.ellipse([tx - w - 1, ty - hgt - 1, tx + w - 1, ty + 2 - off], fill=col)
    d.polygon([(tx - 2, ty - 12), (tx, ty - 20), (tx + 1, ty - 11)], fill=FIRE[3])
    d.polygon([(tx - 6, ty - 6), (tx - 8, ty - 13), (tx - 3, ty - 9)], fill=FIRE[2])
    d.polygon([(tx + 5, ty - 6), (tx + 7, ty - 12), (tx + 2, ty - 9)], fill=FIRE[2])
    d.ellipse([tx - 2, ty - 6, tx + 1, ty - 1], fill=FIRE[5])


def halo(img, cx, cy, r, color=(120, 70, 20), strength=0.55):
    px = img.load()
    for y in range(max(0, int(cy - r)), min(img.height, int(cy + r))):
        for x in range(max(0, int(cx - r)), min(img.width, int(cx + r))):
            t = 1 - math.hypot(x - cx, y - cy) / r
            if t > 0:
                t = round(t * 4) / 4 * strength
                px[x, y] = lerp(px[x, y], color, t)


def v1():
    """1 — Le d20 seul, facettes ombrées, « 20 » gravé."""
    img = Image.new("RGB", (64, 64))
    bg(img)
    halo(img, 32, 33, 34, (70, 48, 18), 0.6)
    d20(img, 32, 33, 28)
    return img


def v2():
    """2 — Le d20 devant deux torches croisées."""
    img = Image.new("RGB", (64, 64))
    bg(img, True)
    halo(img, 32, 30, 36, (120, 60, 18), 0.6)
    torch(img, 10, 62, 40, 30)
    torch(img, 54, 62, 40, -30)
    d20(img, 32, 40, 18)
    return img


def v3():
    """3 — Le d20 éclairé par une seule torche, côté droit : chaud d'un côté, l'ombre de l'autre."""
    img = Image.new("RGB", (64, 64))
    bg(img)
    halo(img, 52, 20, 40, (130, 66, 18), 0.65)
    torch(img, 54, 58, 30)
    d20(img, 26, 35, 23, light=(0.8, -0.6), glow_side=1)
    return img


def v4():
    """4 — Le d20 qui flambe : des flammes montent derrière lui."""
    img = Image.new("RGB", (64, 64))
    bg(img, True)
    halo(img, 32, 30, 34, (140, 60, 16), 0.7)
    d = ImageDraw.Draw(img)
    for (x, top, w) in [(18, 8, 7), (32, 2, 9), (46, 8, 7), (25, 6, 5), (39, 5, 5)]:
        d.polygon([(x - w, 40), (x, top), (x + w, 40)], fill=FIRE[2])
        d.polygon([(x - w + 3, 40), (x, top + 7), (x + w - 3, 40)], fill=FIRE[3])
        d.polygon([(x - 2, 40), (x, top + 14), (x + 2, 40)], fill=FIRE[4])
    d20(img, 32, 38, 22)
    return img


VARIANTS = {"1": v1, "2": v2, "3": v3, "4": v4}

FONT = {
    "C": ["0111110", "1100011", "1100000", "1100000", "1100000", "1100000", "1100011", "0111110"],
    "A": ["0011100", "0110110", "1100011", "1100011", "1111111", "1100011", "1100011", "1100011"],
    "V": ["1100011", "1100011", "1100011", "1100011", "0110110", "0110110", "0011100", "0001000"],
    "E": ["1111111", "1100000", "1100000", "1111110", "1100000", "1100000", "1100000", "1111111"],
    "R": ["1111110", "1100011", "1100011", "1111110", "1101100", "1100110", "1100011", "1100011"],
    "O": ["0111110", "1100011", "1100011", "1100011", "1100011", "1100011", "1100011", "0111110"],
    "L": ["1100000", "1100000", "1100000", "1100000", "1100000", "1100000", "1100000", "1111111"],
    " ": ["0000", "0000", "0000", "0000", "0000", "0000", "0000", "0000"],
}


def wordmark():
    """« CAVE ROLLER » en lettres de pixels plus fines (7 × 8), dégradé doré, contour et ombre."""
    text = "CAVE ROLLER"
    width = sum(len(FONT[c][0]) + 1 for c in text) + 4
    img = Image.new("RGBA", (width, 13), (0, 0, 0, 0))
    px = img.load()
    x = 2
    cells = []
    for c in text:
        for j, row in enumerate(FONT[c]):
            for i, bit in enumerate(row):
                if bit == "1":
                    cells.append((x + i, 2 + j, j))
        x += len(FONT[c][0]) + 1
    for (X, Y, j) in cells:
        for dx, dy in [(-1, -1), (0, -1), (1, -1), (-1, 0), (1, 0), (-1, 1), (0, 1), (1, 1), (0, 2), (1, 2), (-1, 2)]:
            if px[X + dx, Y + dy][3] == 0:
                px[X + dx, Y + dy] = K + (255,)
    shades = [GOLDS[6], GOLDS[5], GOLDS[5], GOLDS[4], GOLDS[4], GOLDS[3], GOLDS[2], GOLDS[2]]
    for (X, Y, j) in cells:
        px[X, Y] = shades[j] + (255,)
    return img


def plate():
    out = Image.new("RGB", (4 * 300 + 40, 720), (26, 20, 16))
    dr = ImageDraw.Draw(out)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    dr.text((20, 14), "Cave Roller — logo v3 : le d20 (et les torches), en 64 × 64 pixels", font=font, fill=GOLDS[4])
    notes = {
        "1": ["Le d20 seul, facettes ombrées,", "« 20 » gravé."],
        "2": ["Devant deux torches", "croisées."],
        "3": ["Éclairé par une torche :", "chaud d'un côté, ombre de l'autre."],
        "4": ["Le d20 qui flambe."],
    }
    for n, (k, f) in enumerate(VARIANTS.items()):
        x = 20 + n * 300
        dr.text((x, 56), k, font=font, fill=GOLDS[5])
        out.paste(f().resize((256, 256), Image.NEAREST), (x, 88))
        for m, size in enumerate([96, 48]):
            out.paste(f().resize((size, size), Image.LANCZOS), (x + m * 110, 360))
        for j, t in enumerate(notes[k]):
            dr.text((x, 470 + j * 22), t, font=small, fill=(230, 220, 192))
    w = wordmark()
    big = w.resize((w.width * 6, w.height * 6), Image.NEAREST)
    out.paste(big, (20, 545), big)
    dr.text((20, 640), "En petit (96 et 48 pixels) : à peu près la taille d'une icône sur l'écran d'accueil.", font=small, fill=(160, 150, 130))
    out.save("art/logo_v3.png")


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "icon":
        im = VARIANTS[sys.argv[2]]()
        for size in (192, 512):
            im.resize((size, size), Image.NEAREST).save(f"pwa/icon-{size}.png")
    else:
        plate()
