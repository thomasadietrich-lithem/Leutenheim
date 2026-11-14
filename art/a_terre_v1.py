"""Planche « à terre » v1 (Thomas, 2026-11-14 : « faut faire des sprites pour le fait d'être à terre »). PROPOSITION.

Aujourd'hui, un Kobold renversé par une poussée reprend l'image « mort » (yeux fermés) : on croit qu'il est mort.
Proposé : deux images qui alternent, sur le dos mais VIVANT — l'œil ouvert, les pattes et la queue qui gigotent, la
dague encore en main —, puis une image « il se relève » (assis, une main au sol) jouée au tour où il se remet debout.
Même chose pour le frondeur (ses couleurs) ; l'araignée v2 a déjà les siennes (sur le dos, les huit pattes en l'air).

  python3 art/a_terre_v1.py → art/a_terre_v1.png
"""
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up  # noqa: E402

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")


def read_ts(path, key):
    src = open(os.path.join(ROOT, path)).read()
    block = src[src.index(f"  {key}: ["):]
    return re.findall(r'"([.A-Za-z]{16,18})"', block)[:16]


def palette_ts():
    src = open(os.path.join(ROOT, "src/render/sprites/schrat.ts")).read()
    return dict(re.findall(r'  (\w): "(#[0-9a-f]{6})"', src))


SCHRAT_PAL = palette_ts()
FRONDEUR_PAL = {**SCHRAT_PAL, "A": "#e08a3a", "a": "#9c5420", "Y": "#f4e04a", "C": "#6e4c2e", "c": "#40291a", "M": "#7a5230", "m": "#a4abc8", "T": "#cbbf98"}
DEAD = read_ts("src/render/sprites/schrat.ts", "dead")


def grid(rows):
    return [list(r) for r in rows]


def prone(phase):
    """Sur le dos, vivant : l'œil ouvert (orange), les pieds en l'air qui pédalent, la queue qui fouette."""
    g = grid(DEAD)
    g[12][13] = "Y"  # l'œil s'ouvre
    for y in (7, 8, 9):
        for x in range(0, 13):
            if g[y][x] in "Oa":
                g[y][x] = "."
    # Deux pattes dressées qui pédalent : une ligne d'écailles terminée par une griffe sombre.
    legs = [((5, 10), (4, 6)), ((9, 10), (10, 6))] if phase == 0 else [((5, 10), (6, 6)), ((9, 10), (8, 7))]
    for (x0, y0), (x1, y1) in legs:
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n)
            y = round(y0 + (y1 - y0) * i / n)
            if g[y][x] in ".O":
                g[y][x] = "A"
            if g[y][x + 1] == ".":
                g[y][x + 1] = "O"
            if g[y][x - 1] == ".":
                g[y][x - 1] = "O"
        g[y1 - 1][x1] = "O"
        g[y1][x1] = "a"
    # La queue (à gauche) fouette : un pixel en haut ou en bas.
    if phase == 1:
        g[11][0] = "O"
        g[12][0] = "."
        g[10][1] = "O"
    # La dague, encore en main (un éclat clair au-dessus de la main).
    g[9][12] = "M" if phase == 0 else "."
    g[8][12] = "M" if phase == 1 else g[8][12]
    return ["".join(r) for r in g]


def getting_up():
    """Il se relève : assis, le buste redressé, une main au sol."""
    rows = [
        "................",
        "................",
        "................",
        "................",
        "..........OO....",
        ".........OAAO...",
        "........OAYLAO..",
        "........OAAATO..",
        ".........OcCO...",
        "........OcCcAO..",
        ".....OOOcCcCaAO.",
        "...OOaAAAcCcOaO.",
        "..OaAAAAAAAAOMO.",
        ".OaaAAaaaAAAaOO.",
        "..OOOOObMMMOOO..",
        ".......OOOO.....",
    ]
    return rows


def render(rows, pal):
    im = Image.new("RGBA", (16, 16), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, ch in enumerate(r):
            if ch != ".":
                h = pal[ch].lstrip("#")
                im.putpixel((x, y), tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,))
    return im


def swirl(d, cx, cy, r):
    """La bulle « à terre » du jeu (tourbillon rouge), pour situer."""
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(245, 240, 230), outline=(30, 20, 20), width=2)
    d.arc([cx - r * 0.6, cy - r * 0.6, cx + r * 0.6, cy + r * 0.6], 0, 300, fill=(200, 40, 50), width=3)
    d.arc([cx - r * 0.3, cy - r * 0.3, cx + r * 0.3, cy + r * 0.3], 120, 400, fill=(200, 40, 50), width=2)


def main():
    S = 7
    cols = [("aujourd'hui (« mort »)", DEAD), ("à terre 1", prone(0)), ("à terre 2", prone(1)), ("il se relève", getting_up())]
    cw = 16 * S + 70
    W = 60 + len(cols) * cw
    sheet = Image.new("RGB", (W, 520), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 22), "À TERRE v1 — proposition (Kobold, frondeur)", fill=(255, 243, 200), font=font(15), anchor="mm")
    for row, (label, pal) in enumerate((("Kobold", SCHRAT_PAL), ("Frondeur", FRONDEUR_PAL))):
        y = 50 + row * 175
        d.text((24, y), label, fill=(255, 220, 160), font=font(13))
        for i, (name, rows) in enumerate(cols):
            x = 24 + i * cw
            sp = up(render(rows, pal), S)
            sheet.paste((70, 61, 82), (x, y + 20, x + sp.width + 16, y + 20 + sp.height + 16))
            sheet.paste(sp, (x + 8, y + 28), sp)
            if 1 <= i <= 2:
                swirl(d, x + sp.width - 4, y + 38, 13)
            d.text((x, y + 150), name, fill=(200, 190, 170), font=font(11, False))
    notes = [
        "À terre 1 et 2 alternent (4 fois par seconde) : il est vivant et se débat.",
        "L'œil reste OUVERT (fermé = mort) ; la bulle rouge reste au-dessus.",
        "« Il se relève » : joué une fois, au tour où il se remet debout (il perd ce tour).",
        "Araignée : voir art/araignee_v2.png (sur le dos, pattes en l'air, 2 images).",
    ]
    for i, n in enumerate(notes):
        d.text((24, 410 + i * 22), n, fill=(220, 210, 190), font=font(12, False))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "a_terre_v1.png")
    sheet.save(out)
    print("art/a_terre_v1.png", sheet.size)


if __name__ == "__main__":
    main()
