"""Autel de pierre à la pomme dorée (Thomas, 2026-11-12 : « plutôt que la fontaine »).
16 × 16, vue 3/4 plongeante comme les meubles. `python3 art/autel_v1.py` écrit art/autel_v1.png ;
`python3 art/autel_v1.py export` écrit src/render/sprites/autel.ts."""
import sys
from PIL import Image

PAL = {"K": "#120d08", "L": "#c4bed0", "M": "#9a94aa", "D": "#6c667c", "d": "#4a4558", "F": "#ffd84a", "f": "#c89a14",
       "Y": "#fff6b0", "E": "#5cc860", "e": "#2e7a38", "b": "#5a3817", "o": "#7a5418"}

def grid():
    g = [["."] * 16 for _ in range(16)]
    def put(x, y, c):
        if 0 <= x < 16 and 0 <= y < 16: g[y][x] = c
    # Socle : plateau (dessus clair), face avant gravée, base plus large.
    for x in range(2, 14):
        for y in range(8, 10): put(x, y, "L")      # dessus
        for y in range(10, 14): put(x, y, "M")     # face
        put(x, 14, "D")
    for x in range(1, 15): put(x, 15, "d")
    for y in range(8, 15): put(2, y, "D"); put(13, y, "d")
    # Contour
    for x in range(2, 14): put(x, 7, "K")
    for y in range(7, 15): put(1, y, "K"); put(14, y, "K")
    put(0, 15, "K"); put(15, 15, "K")
    for x in range(3, 13): put(x, 10, "D")         # arête du plateau
    # Gravure : un petit soleil doré au milieu de la face
    for (x, y) in [(7, 11), (8, 11), (7, 12), (8, 12)]: put(x, y, "f")
    put(6, 12, "o"); put(9, 11, "o"); put(5, 11, "D"); put(10, 12, "D")
    # Pomme dorée posée sur le plateau
    apple = [(6, 3), (7, 3), (8, 3), (9, 3),
             (5, 4), (6, 4), (7, 4), (8, 4), (9, 4), (10, 4),
             (5, 5), (6, 5), (7, 5), (8, 5), (9, 5), (10, 5),
             (5, 6), (6, 6), (7, 6), (8, 6), (9, 6), (10, 6),
             (6, 7), (7, 7), (8, 7), (9, 7)]
    for (x, y) in apple: put(x, y, "F")
    for (x, y) in [(9, 5), (10, 5), (9, 6), (10, 6), (8, 7), (9, 7), (10, 4)]: put(x, y, "f")
    put(6, 4, "Y"); put(6, 5, "Y"); put(7, 4, "Y")
    put(7, 3, "K"); put(8, 2, "b"); put(8, 1, "b"); put(9, 1, "E"); put(10, 1, "E"); put(10, 0, "e")
    # contour de la pomme
    for (x, y) in apple:
        for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < 16 and 0 <= ny < 16 and g[ny][nx] in ".":
                g[ny][nx] = "K"
    return ["".join(r) for r in g]

def dry():
    rows = [list(r) for r in grid()]
    for y in range(0, 8):
        for x in range(16):
            rows[y][x] = "."
    for x in range(2, 14): rows[7][x] = "K"
    # quelques miettes dorées sur le plateau
    rows[8][6] = "f"; rows[9][9] = "o"
    return ["".join(r) for r in rows]

if __name__ == "__main__":
    full, empty = grid(), dry()
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        out = "// Fichier généré par art/autel_v1.py. Ne pas modifier à la main.\n\n"
        out += "export const AUTEL_PALETTE: Record<string, string> = " + repr(PAL).replace("'", '"') + ";\n\n"
        out += "export const AUTEL = {\n  full: [\n" + "".join(f'    "{r}",\n' for r in full) + "  ],\n  dry: [\n" + "".join(f'    "{r}",\n' for r in empty) + "  ],\n};\n"
        open("src/render/sprites/autel.ts", "w").write(out)
    else:
        S = 16
        img = Image.new("RGB", (16 * S * 2 + 3 * S, 16 * S + 2 * S), "#2a2430")
        for i, rows in enumerate((full, empty)):
            for y, r in enumerate(rows):
                for x, c in enumerate(r):
                    if c in PAL:
                        for yy in range(S):
                            for xx in range(S):
                                img.putpixel((S + i * (16 * S + S) + x * S + xx, S + y * S + yy), tuple(int(PAL[c][k:k + 2], 16) for k in (1, 3, 5)))
        img.save("art/autel_v1.png")
