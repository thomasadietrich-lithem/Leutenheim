"""Logo v4 (Thomas, 2026-11-12 : « propose des variations du B [le d20 et les torches], rends le chiffre plus visible ») :
icônes 64 × 64. python3 art/logo_v4.py → art/logo_v4.png ; python3 art/logo_v4.py icon N → pwa/."""
import sys
from PIL import Image, ImageDraw, ImageFont

sys.path.insert(0, "art")
from logo_v3 import GOLDS, K, bg, d20, halo, torch, wordmark  # noqa: E402

INK = (26, 14, 6)
CREAM = (255, 246, 214)
# Chiffres 5 × 7, dessinés en traits de 2 pixels à l'échelle 2.
BOLD = {
    "2": ["01110", "11011", "00011", "00110", "01100", "11000", "11111"],
    "0": ["01110", "11011", "11011", "11011", "11011", "11011", "01110"],
}


def big20(img, cx, cy, scale=1):
    """« 20 » bien lisible : chiffres épais presque noirs, liseré crème autour (ressort sur l'or)."""
    w = 5 * scale
    gap = 1 * scale
    x0 = int(cx - w - gap // 2)
    y0 = int(cy - 7 * scale // 2)
    cells = []
    for n, ch in enumerate("20"):
        for j, row in enumerate(BOLD[ch]):
            for i, b in enumerate(row):
                if b == "1":
                    for sy in range(scale):
                        for sx in range(scale):
                            cells.append((x0 + n * (w + gap) + i * scale + sx, y0 + j * scale + sy))
    s = set(cells)
    px = img.load()
    # Le liseré crème seulement AUTOUR des chiffres (pas dans le trou du 0, qui garde l'or du dé).
    boxes = [(x0 + n * (w + gap), y0, x0 + n * (w + gap) + w - 1, y0 + 7 * scale - 1) for n in range(2)]
    inside = lambda x, y: any(a <= x <= c and b <= y <= d for (a, b, c, d) in boxes)
    for (x, y) in cells:
        for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (1, -1), (-1, 1), (1, 1)]:
            if (x + dx, y + dy) not in s and not inside(x + dx, y + dy):
                px[x + dx, y + dy] = CREAM
    for (x, y) in cells:
        px[x, y] = INK


def die(img, cx, cy, r, **kw):
    d20(img, cx, cy, r, number=False, **kw)
    big20(img, cx, cy + r * 0.12, 2 if r >= 20 else 1)


def b1():
    """B1 — Torches croisées DERRIÈRE le dé, flammes en haut (comme v3-2), dé plus grand."""
    img = Image.new("RGB", (64, 64))
    bg(img, True)
    halo(img, 32, 26, 36, (120, 60, 18), 0.6)
    torch(img, 8, 63, 42, 32)
    torch(img, 56, 63, 42, -32)
    die(img, 32, 41, 20)
    return img


def b2():
    """B2 — Torches croisées SOUS le dé, comme un blason (flammes de chaque côté du dé)."""
    img = Image.new("RGB", (64, 64))
    bg(img, True)
    halo(img, 32, 30, 36, (120, 60, 18), 0.55)
    torch(img, 50, 62, 40, -38)
    torch(img, 14, 62, 40, 38)
    die(img, 32, 28, 21)
    return img


def b2low():
    """B2 retenu (Thomas, 2026-11-12 : « le B2 en baissant le dé ») : torches croisées, flammes de chaque côté, dé plus bas."""
    img = Image.new("RGB", (64, 64))
    bg(img, True)
    halo(img, 32, 30, 36, (120, 60, 18), 0.55)
    torch(img, 50, 63, 38, -36)
    torch(img, 14, 63, 38, 36)
    die(img, 32, 37, 21)
    return img


def b3():
    """B3 — Deux torches droites de part et d'autre, le dé au milieu, bien grand."""
    img = Image.new("RGB", (64, 64))
    bg(img, True)
    halo(img, 8, 18, 26, (130, 66, 18), 0.6)
    halo(img, 56, 18, 26, (130, 66, 18), 0.6)
    torch(img, 7, 62, 34)
    torch(img, 58, 62, 34)
    die(img, 32, 36, 22)
    return img


def b4():
    """B4 — Torches croisées derrière, sur un écu de pierre sombre (blason)."""
    img = Image.new("RGB", (64, 64))
    bg(img)
    d = ImageDraw.Draw(img)
    d.polygon([(6, 6), (58, 6), (58, 34), (32, 62), (6, 34)], fill=(46, 44, 58), outline=K)
    d.polygon([(8, 8), (56, 8), (56, 33), (32, 59), (8, 33)], outline=(84, 86, 112))
    torch(img, 10, 58, 40, 30)
    torch(img, 54, 58, 40, -30)
    die(img, 32, 35, 18)
    return img


VARIANTS = {"B1": b1, "B2": b2, "B3": b3, "B4": b4, "B2bas": b2low}


def plate():
    out = Image.new("RGB", (4 * 300 + 40, 680), (26, 20, 16))
    dr = ImageDraw.Draw(out)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    dr.text((20, 14), "Cave Roller — logo v4 : variations du d20 aux torches, « 20 » plus lisible", font=font, fill=GOLDS[4])
    notes = {
        "B1": ["Torches croisées derrière,", "flammes en haut, dé plus grand."],
        "B2": ["Torches croisées sous le dé,", "flammes de chaque côté."],
        "B3": ["Deux torches droites,", "le dé au milieu, bien grand."],
        "B4": ["Torches croisées sur un écu", "de pierre (blason)."],
    }
    for n, (k, f) in enumerate(list(VARIANTS.items())[:4]):
        x = 20 + n * 300
        dr.text((x, 56), k, font=font, fill=GOLDS[5])
        out.paste(f().resize((256, 256), Image.NEAREST), (x, 88))
        for m, size in enumerate([96, 48]):
            out.paste(f().resize((size, size), Image.LANCZOS), (x + m * 110, 360))
        for j, t in enumerate(notes[k]):
            dr.text((x, 470 + j * 22), t, font=small, fill=(230, 220, 192))
    w = wordmark()
    big = w.resize((w.width * 6, w.height * 6), Image.NEAREST)
    out.paste(big, (20, 540), big)
    dr.text((20, 630), "En petit (96 et 48 pixels) : à peu près la taille d'une icône sur l'écran d'accueil.", font=small, fill=(160, 150, 130))
    out.save("art/logo_v4.png")


if __name__ == "__main__":
    if len(sys.argv) >= 3 and sys.argv[1] == "icon":
        im = VARIANTS[sys.argv[2]]()
        for size in (192, 512):
            im.resize((size, size), Image.NEAREST).save(f"pwa/icon-{size}.png")
    elif len(sys.argv) >= 2 and sys.argv[1] == "final":
        # Le logo retenu, en grand, avec le nom (pour Thomas).
        out = Image.new("RGB", (900, 560), (13, 10, 8))
        ic = b2low().resize((384, 384), Image.NEAREST)
        out.paste(ic, (258, 20))
        for m, size in enumerate([96, 48]):
            out.paste(b2low().resize((size, size), Image.LANCZOS), (40 + m * 110, 300))
        w = wordmark()
        big = w.resize((w.width * 6, w.height * 6), Image.NEAREST)
        out.paste(big, ((900 - big.width) // 2, 430), big)
        out.save("art/logo_final.png")
    else:
        plate()
