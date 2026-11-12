"""Propositions de logo pour Cave Roller (2026-11-12) : icône d'appli (32 × 32 pixels) + nom en lettres de pixels.
python3 art/logo_v1.py  →  art/logo_v1.png ; python3 art/logo_v1.py icon B  →  pwa/icon-192.png et pwa/icon-512.png"""
import sys
from PIL import Image, ImageDraw, ImageFont

K = (12, 10, 16); BG = (13, 10, 8); GOLD = (240, 192, 80); GOLD2 = (168, 124, 28); GOLDHI = (255, 226, 122)
S0 = (84, 86, 112); S1 = (104, 107, 136); S2 = (124, 128, 158); SHI = (182, 186, 214); SD = (54, 54, 74)
FIRE = (255, 154, 58); FIRE2 = (232, 120, 42); FIREHI = (255, 216, 74); BROWN = (90, 56, 23); BROWN2 = (154, 106, 52)
SKIN = (238, 190, 145); HAIR = (128, 78, 40); WHITE = (242, 238, 226); RED = (208, 58, 68); KOB = (184, 224, 90); KOB2 = (94, 138, 42)

FONT = {  # 5 × 7, lettres de pixels
    "C": ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    "A": ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    "V": ["10001", "10001", "10001", "10001", "01010", "01010", "00100"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "L": ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    " ": ["000", "000", "000", "000", "000", "000", "000"],
}


def word(text, color, shade, outline=K):
    """Le nom en lettres de pixels, avec ombre portée et contour."""
    cols = sum(len(FONT[c][0]) + 1 for c in text) + 2
    img = Image.new("RGBA", (cols + 2, 7 + 4), (0, 0, 0, 0))
    px = img.load()
    x = 1
    for c in text:
        g = FONT[c]
        for j, row in enumerate(g):
            for i, b in enumerate(row):
                if b == "1":
                    for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1), (1, 1), (1, 2), (0, 2), (-1, 1)]:
                        X, Y = x + i + dx, 1 + j + dy
                        if 0 <= X < img.width and 0 <= Y < img.height and px[X, Y][3] == 0:
                            px[X, Y] = outline + (255,)
        for j, row in enumerate(g):
            for i, b in enumerate(row):
                if b == "1":
                    px[x + i, 1 + j] = (shade if j >= 4 else color) + (255,)
        x += len(g[0]) + 1
    return img


def canvas():
    return Image.new("RGB", (32, 32), BG)


def d20(img, ox, oy, r=12, face=True):
    """Un d20 vu de face : hexagone, triangle central, « 20 »."""
    d = ImageDraw.Draw(img)
    import math
    pts = [(ox + r * math.cos(math.radians(a - 90)), oy + r * math.sin(math.radians(a - 90))) for a in range(0, 360, 60)]
    d.polygon(pts, fill=GOLD2, outline=K)
    tri = [(ox, oy - r * 0.62), (ox + r * 0.62, oy + r * 0.42), (ox - r * 0.62, oy + r * 0.42)]
    d.polygon(tri, fill=GOLD, outline=GOLD2)
    for p, q in [(pts[0], tri[0]), (pts[1], tri[1]), (pts[2], tri[1]), (pts[3], tri[1]), (pts[3], tri[2]), (pts[4], tri[2]), (pts[5], tri[0]), (pts[1], tri[0]), (pts[5], tri[2])]:
        d.line([p, q], fill=GOLD2)
    d.polygon(pts, outline=K)
    if face:
        digits = {"2": ["111", "001", "111", "100", "111"], "0": ["111", "101", "101", "101", "111"]}
        x0 = int(ox) - 3
        y0 = int(oy) - 2
        for n, ch in enumerate("20"):
            for j, row in enumerate(digits[ch]):
                for i, b in enumerate(row):
                    if b == "1":
                        img.putpixel((x0 + n * 4 + i, y0 + j), K)
    img.putpixel((int(ox - r * 0.3), int(oy - r * 0.35)), GOLDHI)


def torch(img, x, y):
    d = ImageDraw.Draw(img)
    d.rectangle([x, y + 3, x + 1, y + 9], fill=BROWN2, outline=None)
    d.point([(x + 1, y + 4), (x + 1, y + 6)], fill=BROWN)
    for (i, j, c) in [(0, 0, FIRE2), (1, 0, FIRE), (0, -1, FIRE), (1, -1, FIREHI), (0, -2, FIREHI), (1, 1, FIRE2), (0, 1, FIRE), (-1, 0, FIRE2), (2, 0, FIRE2), (1, -2, FIRE)]:
        img.putpixel((x + i, y + 2 + j), c)


def arch(img, fill_inside=(4, 3, 6)):
    """Une arche de cave en pierres, l'intérieur noir."""
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 31, 31], fill=SD)
    for y in range(0, 32, 4):
        off = (y // 4) % 2 * 4
        for x in range(-4, 32, 8):
            d.rectangle([x + off, y, x + off + 7, y + 3], fill=S1, outline=S0)
            d.point((x + off + 1, y + 1), fill=S2)
    d.ellipse([5, 5, 26, 30], fill=K)
    d.rectangle([5, 17, 26, 31], fill=K)
    d.ellipse([7, 7, 24, 28], fill=fill_inside)
    d.rectangle([7, 17, 24, 31], fill=fill_inside)


def hero_head(img, ox, oy):
    rows = [
        "...KKKKKK...",
        "..KHHHHHHK..",
        ".KHHhHHHHHK.",
        ".KHSSSSSSHK.",
        ".KSSKSSKSSK.",
        ".KSSKSSKSSK.",
        ".KSSSSSSSSK.",
        "..KSSssSSK..",
        "...KKKKKK...",
    ]
    pal = {"K": K, "H": HAIR, "h": (160, 104, 56), "S": SKIN, "s": (200, 140, 100)}
    for j, r in enumerate(rows):
        for i, c in enumerate(r):
            if c in pal:
                img.putpixel((ox + i, oy + j), pal[c])


def kobold(img, ox, oy):
    rows = [
        "O........O..",
        "OTO....OTO..",
        ".OaAAAAaO...",
        "OaAAAAAAaO..",
        "OAYKAAKYAO..",
        "OAAAAAAAAO..",
        ".OaLLLLaO...",
        ".OaLKKLaO...",
        "..OaAAaO....",
    ]
    pal = {"O": K, "T": (122, 82, 48), "A": KOB, "a": KOB2, "Y": FIREHI, "K": K, "L": (230, 220, 192)}
    for j, r in enumerate(rows):
        for i, c in enumerate(r):
            if c in pal:
                img.putpixel((ox + i, oy + j), pal[c])


def icon_A():
    """A — Le d20 doré, seul, sur fond de cave : simple, lisible en petit."""
    img = canvas()
    d = ImageDraw.Draw(img)
    for y in range(32):
        for x in range(32):
            if (x * 7 + y * 13) % 29 == 0:
                img.putpixel((x, y), (30, 24, 20))
    d20(img, 15.5, 16, 13)
    return img


def icon_B():
    """B — L'arche de la cave, une torche, le d20 qui roule dans le noir."""
    img = canvas()
    arch(img)
    d = ImageDraw.Draw(img)
    for r, a in [(9, 40), (6, 70)]:
        d.ellipse([16 - r, 20 - r, 16 + r, 20 + r], fill=(40 + a // 3, 26 + a // 6, 12))
    d20(img, 16, 21, 7, face=False)
    torch(img, 2, 8)
    torch(img, 28, 8)
    return img


def icon_C():
    """C — Le héros (sa tête du jeu) dans l'arche, le d20 à ses pieds."""
    img = canvas()
    arch(img, fill_inside=(28, 20, 14))
    hero_head(img, 10, 10)
    d20(img, 16, 25, 5, face=False)
    torch(img, 2, 8)
    return img


def icon_D():
    """D — Un Kobold qui jette un œil par-dessus le d20 (la mascotte)."""
    img = canvas()
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 31, 31], fill=(20, 16, 24))
    kobold(img, 10, 2)
    d20(img, 16, 20, 11)
    return img


ICONS = {"A": icon_A, "B": icon_B, "C": icon_C, "D": icon_D}


def plate():
    S = 8
    W = 4 * 300 + 40
    out = Image.new("RGB", (W, 640), (26, 20, 16))
    dr = ImageDraw.Draw(out)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    dr.text((20, 14), "Cave Roller — propositions de logo (icône d'appli 32 × 32, et le nom)", font=font, fill=GOLD)
    notes = {
        "A": ["Le d20 doré, seul.", "Le plus lisible en petit."],
        "B": ["L'arche de la cave, deux torches,", "le dé qui roule dans le noir."],
        "C": ["Le héros dans l'arche,", "le dé à ses pieds."],
        "D": ["Un Kobold derrière le dé :", "la mascotte, plus drôle."],
    }
    wm = word("CAVE ROLLER", GOLD, GOLD2)
    for n, (k, f) in enumerate(ICONS.items()):
        x = 20 + n * 300
        dr.text((x, 60), k, font=font, fill=GOLDHI)
        big = f().resize((32 * S, 32 * S), Image.NEAREST)
        out.paste(big, (x, 92))
        # en petit, comme sur un téléphone
        for m, size in enumerate([48, 24]):
            out.paste(f().resize((size, size), Image.NEAREST), (x + m * 60, 360))
        w = wm.resize((wm.width * 4, wm.height * 4), Image.NEAREST)
        out.paste(w, (x, 430), w)
        for j, t in enumerate(notes[k]):
            dr.text((x, 500 + j * 22), t, font=small, fill=(230, 220, 192))
    dr.text((20, 590), "En petit : la taille réelle d'une icône sur l'écran d'accueil.", font=small, fill=(160, 150, 130))
    out.save("art/logo_v1.png")


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "icon":
        im = ICONS[sys.argv[2]]()
        for size in (192, 512):
            im.resize((size, size), Image.NEAREST).save(f"pwa/icon-{size}.png")
    else:
        plate()
