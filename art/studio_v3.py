"""Logo du studio, « P1 » refait en pixels (Thomas, 2026-11-17 : « mets le logo studio au démarrage du jeu »).

Le P1 validé le 2026-11-13 (dalle de pierre gravée « LTH / STUDIO », fissures et mousse aux coins) avait été dessiné
dans une autre conversation (`art/studio_v2.py`, jamais poussé) : ce script le redessine à la manière du jeu.

    python3 art/studio_v3.py          → art/studio_v3.png (planche, ×6)
    python3 art/studio_v3.py export   → art/logo_studio.png (80 × 64, fond transparent, à agrandir sans lissage)
"""
import random
import sys

from PIL import Image

W, H = 80, 64
FONT = {
    "L": ["1100000", "1100000", "1100000", "1100000", "1100000", "1100000", "1100000", "1111111"],
    "T": ["1111111", "1111111", "0011100", "0011100", "0011100", "0011100", "0011100", "0011100"],
    "H": ["1100011", "1100011", "1100011", "1111111", "1111111", "1100011", "1100011", "1100011"],
}
SMALL = {
    "S": ["111", "100", "111", "001", "111"],
    "T": ["111", "010", "010", "010", "010"],
    "U": ["101", "101", "101", "101", "111"],
    "D": ["110", "101", "101", "101", "110"],
    "I": ["111", "010", "010", "010", "111"],
    "O": ["111", "101", "101", "101", "111"],
}
OUT = (20, 16, 22, 255)
STONE = [(92, 90, 98, 255), (108, 106, 112, 255), (124, 122, 126, 255)]
LIGHT = (156, 152, 150, 255)
SHADOW = (64, 62, 72, 255)
CUT = (34, 30, 38, 255)
CUT_LIGHT = (176, 170, 160, 255)
MOSS = [(70, 112, 52, 255), (98, 142, 62, 255), (52, 84, 42, 255)]


def draw():
    rnd = random.Random(7)
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    px = img.load()
    x0, y0, x1, y1 = 4, 4, W - 5, H - 5
    # La dalle : coins abattus, pierre grenue, biseau clair en haut à gauche, sombre en bas à droite.
    for y in range(y0, y1 + 1):
        for x in range(x0, x1 + 1):
            corner = min(x - x0, x1 - x) + min(y - y0, y1 - y)
            if corner < 3:
                continue
            c = STONE[rnd.choice((0, 1, 1, 2))]
            if x - x0 < 2 or y - y0 < 2:
                c = LIGHT
            elif x1 - x < 2 or y1 - y < 2:
                c = SHADOW
            px[x, y] = c
    # Contour sombre.
    for y in range(H):
        for x in range(W):
            if px[x, y][3] == 0 and any(0 <= x + dx < W and 0 <= y + dy < H and px[x + dx, y + dy][3] and px[x + dx, y + dy] != OUT for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                px[x, y] = OUT

    def engrave(x, y):
        px[x, y] = CUT
        # La lumière accroche le bord bas-droit de l'entaille.
        for dx, dy in ((1, 0), (0, 1)):
            if px[x + dx, y + dy] not in (CUT, OUT):
                px[x + dx, y + dy] = CUT_LIGHT

    # « LTH » : la police 7 × 8 du titre, doublée.
    word = "LTH"
    width = len(word) * 14 + (len(word) - 1) * 3
    sx, sy = (W - width) // 2, 13
    cells = []
    for i, ch in enumerate(word):
        for r, row in enumerate(FONT[ch]):
            for c, bit in enumerate(row):
                if bit == "1":
                    for a in range(2):
                        for b in range(2):
                            cells.append((sx + i * 17 + c * 2 + a, sy + r * 2 + b))
    for x, y in cells:
        engrave(x, y)
    for x, y in cells:
        px[x, y] = CUT
    # Un trait gravé, puis « STUDIO » en petites lettres.
    for x in range(16, W - 16):
        engrave(x, 35)
    word = "STUDIO"
    width = len(word) * 3 + (len(word) - 1) * 2
    sx, sy = (W - width) // 2 + 1, 40
    small = []
    for i, ch in enumerate(word):
        for r, row in enumerate(SMALL[ch]):
            for c, bit in enumerate(row):
                if bit == "1":
                    small.append((sx + i * 5 + c, sy + r))
    for x, y in small:
        engrave(x, y)
    for x, y in small:
        px[x, y] = CUT
    # Fissures : deux, partant d'un bord.
    for (x, y, steps, d) in ((x0 + 6, y1 - 1, 9, -1), (x1 - 3, y0 + 3, 7, 1)):
        for _ in range(steps):
            if px[x, y] not in (OUT,):
                px[x, y] = CUT
            y += d
            x += rnd.choice((-1, 0, 0, 1))
    # Mousse aux coins (haut-gauche et bas-droit), en taches.
    for (cx, cy) in ((x0 + 3, y0 + 3), (x1 - 3, y1 - 3), (x1 - 4, y0 + 3)):
        for _ in range(26):
            x = cx + int(rnd.gauss(0, 2.2))
            y = cy + int(rnd.gauss(0, 1.6))
            if 0 <= x < W and 0 <= y < H and px[x, y][3] and px[x, y] not in (OUT, CUT):
                px[x, y] = rnd.choice(MOSS)
    return img


def chicken_strip():
    """La poule qui traverse le bas de l'écran du logo, une fois de temps en temps (Thomas, 2026-11-17) : les deux
    images du poulet du jeu (`src/render/sprites/poulet.ts`), côte à côte (32 × 16)."""
    import re
    src = open("src/render/sprites/poulet.ts").read()
    pal = dict(re.findall(r'(\w): "(#[0-9a-f]{6})"', src.split("export const POULET:")[0]))
    frames = []
    for name in ("idle", "run"):
        block = src.split(name + ": [")[1].split("]")[0]
        frames.append(re.findall(r'"([^"]{16})"', block))
    strip = Image.new("RGBA", (32, 16), (0, 0, 0, 0))
    for i, rows in enumerate(frames):
        for y, row in enumerate(rows):
            for x, ch in enumerate(row):
                if ch != ".":
                    c = pal[ch]
                    strip.putpixel((i * 16 + x, y), (int(c[1:3], 16), int(c[3:5], 16), int(c[5:7], 16), 255))
    return strip


if __name__ == "__main__":
    img = draw()
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        img.save("art/logo_studio.png")
        chicken_strip().save("art/logo_poulet.png")
    else:
        big = Image.new("RGBA", (W * 6 + 40, H * 6 + 40), (14, 12, 18, 255))
        big.alpha_composite(img.resize((W * 6, H * 6), Image.NEAREST), (20, 20))
        big.save("art/studio_v3.png")
