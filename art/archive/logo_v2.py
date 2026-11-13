"""Logo v2 (Thomas, 2026-11-12 : « continue à creuser le d20 + l'arche ») : quatre variantes, et le nom.
python3 art/logo_v2.py  →  art/logo_v2.png ; python3 art/logo_v2.py icon N  →  pwa/icon-192.png, pwa/icon-512.png"""
import math
import sys
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, "art")
from logo_v1 import (BG, FIRE, FIRE2, FIREHI, GOLD, GOLD2, GOLDHI, K, S0, S1, S2, SD, SHI, d20, torch, word)  # noqa: E402

GLOW1 = (58, 40, 18); GLOW2 = (92, 64, 26); FLOOR = (44, 36, 30); FLOOR2 = (60, 50, 40)


def stones(img, box=(0, 0, 31, 31)):
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=SD)
    for y in range(y0, y1 + 1, 4):
        off = ((y - y0) // 4) % 2 * 4
        for x in range(x0 - 4, x1 + 1, 8):
            d.rectangle([x + off, y, x + off + 7, y + 3], fill=S1, outline=S0)
            d.point((x + off + 1, y + 1), fill=S2)


def arch_hole(img, l, t, r, b, inside):
    """Ouverture en plein cintre : contour noir, intérieur `inside` (couleur ou fonction)."""
    d = ImageDraw.Draw(img)
    mid = t + (r - l) // 2
    d.ellipse([l - 1, t - 1, r + 1, t + (r - l) + 1], fill=K)
    d.rectangle([l - 1, mid, r + 1, b], fill=K)
    d.ellipse([l, t, r, t + (r - l)], fill=inside)
    d.rectangle([l, mid, r, b], fill=inside)


def voussoirs(img, l, t, r):
    """Les pierres taillées de l'arc, plus claires, autour de l'ouverture."""
    cx = (l + r) / 2
    rad = (r - l) / 2 + 2.5
    cy = t + (r - l) / 2
    for a in range(180, 361, 18):
        x = cx + rad * math.cos(math.radians(a))
        y = cy + rad * math.sin(math.radians(a))
        for dx, dy in [(0, 0), (1, 0), (0, 1), (1, 1)]:
            img.putpixel((int(x) + dx - 1, int(y) + dy - 1), S2)
        img.putpixel((int(x) - 1, int(y) - 1), SHI)


def glow(img, cx, cy, r1, r2):
    d = ImageDraw.Draw(img)
    d.ellipse([cx - r2, cy - r2 * 0.6, cx + r2, cy + r2 * 0.6], fill=GLOW1)
    d.ellipse([cx - r1, cy - r1 * 0.6, cx + r1, cy + r1 * 0.6], fill=GLOW2)


def v1():
    """1 — Le dé debout au seuil de l'arche, sa lueur sur les dalles, deux torches."""
    img = Image.new("RGB", (32, 32), BG)
    stones(img)
    arch_hole(img, 6, 4, 25, 31, (6, 5, 8))
    voussoirs(img, 6, 4, 25)
    d = ImageDraw.Draw(img)
    d.rectangle([6, 27, 25, 31], fill=FLOOR)
    glow(img, 16, 27, 6, 9)
    d20(img, 15.5, 20, 8)
    torch(img, 1, 9)
    torch(img, 29, 9)
    return img


def v2():
    """2 — Le d20 en clé de voûte : l'arche est le cadre, le noir de la cave dessous, deux yeux qui luisent."""
    img = Image.new("RGB", (32, 32), BG)
    stones(img)
    arch_hole(img, 5, 9, 26, 31, (6, 5, 8))
    voussoirs(img, 5, 9, 26)
    d20(img, 15.5, 8, 7, face=False)
    for x in (13, 18):
        img.putpixel((x, 22), FIREHI)
        img.putpixel((x, 23), FIRE2)
    torch(img, 1, 12)
    return img


def v3():
    """3 — Le dé qui SORT de la cave en roulant : traînée de rebonds, lumière d'une torche."""
    img = Image.new("RGB", (32, 32), BG)
    stones(img)
    arch_hole(img, 3, 6, 20, 31, (6, 5, 8))
    voussoirs(img, 3, 6, 20)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 28, 31, 31], fill=FLOOR)
    d.line([(0, 28), (31, 28)], fill=FLOOR2)
    for (x, y) in [(8, 26), (10, 23), (12, 22), (14, 23), (16, 26)]:
        img.putpixel((x, y), GOLD2)
    glow(img, 24, 28, 5, 8)
    d20(img, 24, 22, 6)
    torch(img, 28, 3)
    return img


def v4():
    """4 — L'arche taillée DANS le d20 : la face du dé est une porte de cave, une torche dedans."""
    img = Image.new("RGB", (32, 32), BG)
    d = ImageDraw.Draw(img)
    for y in range(32):
        for x in range(32):
            if (x * 7 + y * 13) % 29 == 0:
                img.putpixel((x, y), (30, 24, 20))
    r = 14
    pts = [(15.5 + r * math.cos(math.radians(a - 90)), 16 + r * math.sin(math.radians(a - 90))) for a in range(0, 360, 60)]
    d.polygon(pts, fill=GOLD2, outline=K)
    tri = [(15.5, 16 - r * 0.62), (15.5 + r * 0.62, 16 + r * 0.42), (15.5 - r * 0.62, 16 + r * 0.42)]
    for p, q in [(pts[0], tri[0]), (pts[1], tri[1]), (pts[2], tri[1]), (pts[3], tri[1]), (pts[3], tri[2]), (pts[4], tri[2]), (pts[5], tri[0]), (pts[1], tri[0]), (pts[5], tri[2])]:
        d.line([p, q], fill=(130, 96, 22))
    d.polygon(tri, fill=GOLD, outline=K)
    arch_hole(img, 12, 12, 19, 22, (6, 5, 8))
    for (x, y, c) in [(15, 17, FIRE2), (16, 17, FIRE), (15, 16, FIRE), (16, 16, FIREHI), (15, 15, FIREHI), (16, 18, FIRE2)]:
        img.putpixel((x, y), c)
    img.putpixel((15, 19), (154, 106, 52))
    img.putpixel((15, 20), (154, 106, 52))
    img.putpixel((11, 7), GOLDHI)
    return img


VARIANTS = {"1": v1, "2": v2, "3": v3, "4": v4}


def stone_word():
    """Le nom gravé : lettres dorées sur un bandeau de pierre."""
    w = word("CAVE ROLLER", GOLD, GOLD2)
    band = Image.new("RGBA", (w.width + 6, w.height + 4), (0, 0, 0, 0))
    stones(band, (0, 0, band.width - 1, band.height - 1))
    d = ImageDraw.Draw(band)
    d.rectangle([0, 0, band.width - 1, band.height - 1], outline=K)
    band.paste(w, (3, 2), w)
    return band


def plate():
    S = 8
    out = Image.new("RGB", (4 * 300 + 40, 700), (26, 20, 16))
    dr = ImageDraw.Draw(out)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    dr.text((20, 14), "Cave Roller — logo v2 : le d20 et l'arche", font=font, fill=GOLD)
    notes = {
        "1": ["Le dé au seuil de l'arche,", "sa lueur sur les dalles."],
        "2": ["Le dé en clé de voûte,", "deux yeux dans le noir."],
        "3": ["Le dé qui sort de la cave", "en roulant (« Roller »)."],
        "4": ["L'arche taillée dans le dé,", "une torche à l'intérieur."],
    }
    for n, (k, f) in enumerate(VARIANTS.items()):
        x = 20 + n * 300
        dr.text((x, 60), k, font=font, fill=GOLDHI)
        out.paste(f().resize((32 * S, 32 * S), Image.NEAREST), (x, 92))
        for m, size in enumerate([48, 24]):
            out.paste(f().resize((size, size), Image.NEAREST), (x + m * 60, 360))
        for j, t in enumerate(notes[k]):
            dr.text((x, 420 + j * 22), t, font=small, fill=(230, 220, 192))
    dr.text((20, 490), "Le nom : en lettres dorées seules (comme v1), ou gravé sur un bandeau de pierre :", font=small, fill=(230, 220, 192))
    w = word("CAVE ROLLER", GOLD, GOLD2)
    out.paste(w.resize((w.width * 5, w.height * 5), Image.NEAREST), (20, 525), w.resize((w.width * 5, w.height * 5), Image.NEAREST))
    b = stone_word()
    out.paste(b.resize((b.width * 5, b.height * 5), Image.NEAREST), (620, 515), b.resize((b.width * 5, b.height * 5), Image.NEAREST))
    dr.text((20, 640), "En petit (48 et 24 pixels) : la taille réelle d'une icône sur l'écran d'accueil.", font=small, fill=(160, 150, 130))
    out.save("art/logo_v2.png")


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "icon":
        im = VARIANTS[sys.argv[2]]()
        for size in (192, 512):
            im.resize((size, size), Image.NEAREST).save(f"pwa/icon-{size}.png")
    else:
        plate()
