"""Planche « escaliers_v3 » (Thomas, 2026-11-14 : « escalier non : refais des déclinaisons, mais uniquement des escaliers
droits, pas des alternatives »). PROPOSITION.

Dix déclinaisons d'un ESCALIER DROIT (marches horizontales qui s'enfoncent vers le bas de la case), en descente et en
montée, à 16 × 16 comme une case du jeu, puis posées sur un bout de sol. Elles changent la matière, l'usure, les bords
et un détail, pas la forme.
  python3 art/escaliers_v3.py → art/escaliers_v3.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up  # noqa: E402

K = (18, 13, 8, 255)
VOID = (6, 5, 10, 255)
FLOOR = (60, 58, 72, 255)

STONE = [(195, 203, 224), (164, 171, 200), (127, 136, 166), (96, 104, 134), (66, 72, 98)]
SAND = [(226, 200, 150), (196, 170, 120), (160, 134, 92), (124, 102, 70), (86, 70, 50)]
WOOD = [(200, 146, 84), (170, 116, 62), (138, 92, 48), (104, 68, 34), (70, 44, 22)]
DARK = [(130, 126, 140), (104, 100, 116), (80, 78, 92), (58, 56, 70), (40, 38, 50)]
BRICK = [(206, 120, 96), (176, 92, 72), (140, 70, 56), (104, 50, 42), (70, 34, 30)]
MARBLE = [(244, 240, 232), (220, 214, 204), (190, 184, 176), (150, 146, 140), (110, 106, 102)]


def c(rgb):
    return rgb + (255,)


def stairs(pal, up_=False, steps=5, side="mur", detail=None, wide=False):
    """Un escalier droit : `steps` marches de 2 px (nez clair, contremarche sombre) entre deux bords, vers le noir."""
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    px = im.putpixel
    x0, x1 = (1, 14) if wide else (3, 12)
    # bords
    for y in range(16):
        for x in range(16):
            if x < x0 or x > x1:
                if side == "mur":
                    px((x, y), c(DARK[3] if (x + y // 3) % 3 else DARK[4]))
                elif side == "rampe" and x in (x0 - 1, x1 + 1):
                    px((x, y), c(WOOD[2]))
                elif side == "rampe" and x in (x0 - 2, x1 + 2) and y % 4 == 1:
                    px((x, y), c(WOOD[3]))
                elif side == "chaînes" and x in (x0 - 1, x1 + 1) and y % 2 == 0:
                    px((x, y), c(STONE[2]))
    # marches
    n = steps
    for i in range(n):
        depth = i / (n - 1)
        shade = depth if not up_ else 1 - depth
        k = min(4, int(shade * 4.2))
        y0 = (1 if up_ else 0) + round(i * 14 / n)
        y1 = (1 if up_ else 0) + round((i + 1) * 14 / n)
        for x in range(x0, x1 + 1):
            px((x, y0), c(pal[max(0, k - 1)] if k > 0 else pal[0]))  # nez de la marche
            for y in range(y0 + 1, y1):
                px((x, y), c(pal[min(4, k + 1)]))
            px((x, y1 - 1), K if shade > 0.15 else c(pal[min(4, k + 2)]))
    # le bas (descente) ou le haut (montée) s'enfonce dans le noir
    for x in range(x0, x1 + 1):
        for y in ((14, 15) if not up_ else (0,)):
            px((x, y), VOID)
    if up_:
        for x in range(x0, x1 + 1):  # lumière d'en haut
            px((x, 15), c(pal[0]))
    # détails
    if detail == "mousse":
        for (x, y) in ((x0, 3), (x0 + 1, 4), (x1, 7), (x1 - 1, 8), (x0, 10), (x1, 12)):
            px((x, y), (92, 200, 96, 255))
    elif detail == "fissures":
        for (x, y) in ((x0 + 3, 2), (x0 + 4, 3), (x0 + 4, 4), (x1 - 3, 6), (x1 - 2, 7), (x0 + 6, 10)):
            px((x, y), K)
    elif detail == "tapis":
        for y in range(16 if up_ else 14):
            for x in range(6, 10):
                px((x, y), (208, 58, 68, 255) if x in (7, 8) else (142, 31, 40, 255))
    elif detail == "bougies":
        for (x, y) in ((x0, 2), (x1, 6), (x0, 10)):
            px((x, y), (244, 247, 255, 255))
            px((x, y - 1), (255, 216, 74, 255))
    elif detail == "ossements":
        for (x, y) in ((x0 + 2, 5), (x0 + 3, 5), (x1 - 2, 9), (x1 - 3, 9)):
            px((x, y), (240, 232, 210, 255))
    elif detail == "toiles":
        for i in range(5):
            px((x0 + i, i), (230, 230, 240, 255))
            px((x1 - i, i), (230, 230, 240, 255))
    elif detail == "or":
        for x in range(x0, x1 + 1):
            px((x, 1), (240, 192, 80, 255))
    return im


VARIANTS = [
    ("1. Pierre (actuel, retouché)", dict(pal=STONE)),
    ("2. Pierre usée et moussue", dict(pal=STONE, detail="mousse")),
    ("3. Pierre fendue", dict(pal=STONE, detail="fissures")),
    ("4. Grès des caves", dict(pal=SAND)),
    ("5. Bois avec rampe", dict(pal=WOOD, side="rampe")),
    ("6. Brique", dict(pal=BRICK)),
    ("7. Pierre noire et chaînes", dict(pal=DARK, side="chaînes")),
    ("8. Tapis rouge (chapelle, boss)", dict(pal=STONE, detail="tapis")),
    ("9. Bougies sur les marches", dict(pal=DARK, detail="bougies")),
    ("10. Marbre à nez doré", dict(pal=MARBLE, detail="or")),
    ("11. Escalier large", dict(pal=STONE, wide=True)),
    ("12. Ossements (crypte)", dict(pal=SAND, detail="ossements")),
    ("13. Toiles (antre)", dict(pal=DARK, detail="toiles")),
    ("14. Six marches serrées", dict(pal=STONE, steps=7)),
]


def on_floor(im):
    big = Image.new("RGBA", (48, 48), FLOOR)
    for y in range(48):
        for x in range(48):
            if x % 16 == 0 or y % 16 == 0:
                big.putpixel((x, y), (48, 46, 58, 255))
    big.alpha_composite(im, (16, 16))
    return big


def main():
    cols = 2
    cw, ch = 610, 210
    W = 40 + cols * cw
    rows = (len(VARIANTS) + cols - 1) // cols
    sheet = Image.new("RGB", (W, 70 + rows * ch), (26, 20, 14))
    dr = ImageDraw.Draw(sheet)
    dr.text((W // 2, 24), "ESCALIERS v3 — escaliers DROITS seulement : 14 déclinaisons, descente et montée", fill=(255, 243, 200), font=font(14), anchor="mm")
    for i, (name, kw) in enumerate(VARIANTS):
        x = 30 + (i % cols) * cw
        y = 60 + (i // cols) * ch
        dr.text((x, y), name, fill=(255, 243, 200), font=font(12), anchor="lm")
        xx = x
        for up_ in (False, True):
            t = stairs(up_=up_, **kw)
            a = up(t, 8)
            sheet.paste((54, 46, 64), (xx - 3, y + 14, xx + a.width + 3, y + 20 + a.height))
            sheet.paste(a, (xx, y + 17), a)
            dr.text((xx + a.width // 2, y + 30 + a.height), "descente" if not up_ else "montée", fill=(200, 190, 170), font=font(10, False), anchor="mm")
            xx += a.width + 14
            f = up(on_floor(t), 3)
            sheet.paste(f, (xx, y + 17))
            xx += f.width + 22
    sheet.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "escaliers_v3.png"))
    print("art/escaliers_v3.png", sheet.size)


def export():
    """Les 14 déclinaisons en pixels pour le jeu → src/render/sprites/escaliers.ts (Thomas, 2026-11-14 : « implémente
    l'escalier 3, garde les autres »)."""
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    palette = {}
    def rows(im):
        out = []
        for y in range(16):
            row = ""
            for x in range(16):
                r, g, b, a = im.getpixel((x, y))
                if a == 0:
                    row += "."
                    continue
                key = "#%02x%02x%02x" % (r, g, b)
                if key not in palette:
                    palette[key] = letters[len(palette)]
                row += palette[key]
            out.append(row)
        return out
    variants = [(name, rows(stairs(**kw)), rows(stairs(up_=True, **kw))) for name, kw in VARIANTS]
    lines = ["// FICHIER GÉNÉRÉ par art/escaliers_v3.py (export) : ne pas modifier à la main.",
             "/** Escaliers droits (planche escaliers_v3, 14 déclinaisons) ; le jeu montre `STAIRS_STYLE` (Thomas : la 3). */",
             "export const ESCALIERS_PALETTE: Record<string, string> = {" + ", ".join('"%s": "%s"' % (v, k) for k, v in palette.items()) + "};",
             "export const ESCALIERS: { name: string; down: string[]; up: string[] }[] = ["]
    for name, d, u in variants:
        lines.append("  {")
        lines.append("    name: %s," % repr(name).replace("'", '"'))
        lines.append("    down: [" + ", ".join('"%s"' % r for r in d) + "],")
        lines.append("    up: [" + ", ".join('"%s"' % r for r in u) + "],")
        lines.append("  },")
    lines.append("];")
    lines.append("/** La déclinaison en jeu (numéro de la planche moins un) : 3. Pierre fendue. */")
    lines.append("export const STAIRS_STYLE = 2;")
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "render", "sprites", "escaliers.ts")
    open(out, "w").write("\n".join(lines) + "\n")
    print("src/render/sprites/escaliers.ts", len(palette), "couleurs")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        export()
    else:
        main()
