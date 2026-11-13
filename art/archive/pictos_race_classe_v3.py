"""Pictos de race et de classe v3 (Thomas : « refais humain et halfelin », « guerrier : 2 épées plutôt ») ; base v2 (Thomas, 2026-11-11 : « inspire-toi plutôt de ça », image de tuiles pastel à cadre en
méandres). On reprend l'idée (tuile carrée, cadre à méandres, un symbole au centre, une couleur pastel par tuile), pas le
dessin. 34 × 34 pixels. Écrit art/pictos_race_classe_v3.png. Lancer depuis la racine du dépôt.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from pix import font

N = 34
BG = (251, 245, 230)  # parchemin clair

# Motif de méandre (période 6, 4 de haut), répété le long de chaque bord.
KEY = ["#####.", "....#.", "##.##.", ".#...."]
CORNER = ["####", "#..#", "#.##", "#.#."]


def mix(c, t):
    return tuple(round(a + (255 - a) * t) for a in c)


SYMBOLS = {
    "humain": [  # buste
        "......######......", ".....########.....", "....##########....", "....##++++++##....",
        "....#++++++++#....", "....#+#++++#+#....", "....#++++++++#....", "....#+++##+++#....",
        ".....#++++++#.....", "......#++++#......", ".......####.......", ".......#++#.......",
        "...####++++####...", "..#++++++++++++#..", ".#++++++++++++++#.", ".#++++++++++++++#.",
        ".#++++++++++++++#.", ".################.",
    ],
    "halfelin": [  # grand pied poilu
        "..................", "..................", "...#.#.#..........", "..#+#+#+#.........",
        "..#+++++#.........", "..#+#+#+#.........", "..#+++++#.........", "..#+++++#.........",
        "..#+++++#.........", "..#++++++###......", "..#+++++++++#.#.#.", "..#++++++++++#+#+#",
        "..#++++++++++++++#", "..#++++++++++++++#", "...##############.", "..................",
        "..................", "..................",
    ],
    "elfe": [  # feuille
        ".........#........", "........#+#.......", ".......#+++#......", "......#++#++#.....",
        ".....#+++#+++#....", "....#+#++#++#+#...", "....#++#+#+#++#...", "...#++++###++++#..",
        "...#+#+++#+++#+#..", "...#++#++#++#++#..", "....#++#+#+#++#...", "....#++++#++++#...",
        ".....#+++#+++#....", "......#++#++#.....", ".......#+#+#......", "........###.......",
        ".........#........", ".........#........",
    ],
    "guerrier": [  # écu, l'épée en travers
        "........##........", ".......#**#.......", ".......#**#.......", ".......#**#.......",
        "..#####****#####..", "..#++++#**#++++#..", "..#++++#**#++++#..", "..#+##########+#..",
        "..#+#********#+#..", "..#+##########+#..", "..#++++#**#++++#..", "...#+++#**#+++#...",
        "...#+++#**#+++#...", "....#++#**#++#....", ".....#+#**#+#.....", "......#+##+#......",
        ".......#++#.......", "........##........",
    ],
    "assassin": [  # capuche, deux yeux dans l'ombre
        "........##........", ".......#++#.......", "......#++++#......", ".....#++++++#.....",
        "....#++####++#....", "...#++######++#...", "...#+########+#...", "...#+#..##..#+#...",
        "...#+########+#...", "...#+########+#...", "...#++######++#...", "..#+++######+++#..",
        "..#++++####++++#..", ".#++++++++++++++#.", ".#++++++++++++++#.", ".################.",
        "..................", "..................",
    ],
    "magicien": [  # chapeau étoilé
        "..................", ".............##...", "...........##+#...", ".........##++#....",
        "........#+++#.....", ".......#++++#.....", ".......#+*++#.....", "......#++++++#....",
        "......#++++*+#....", ".....#+++++++#....", ".....#+*++++++#...", "....#++++++++++#..",
        "....############..", ".##++++++++++++++#", "#++++++++++++++++#", ".################.",
        "..................", "..................",
    ],
}

COLORS = {  # une couleur pastel par tuile
    "humain": (226, 112, 112), "halfelin": (196, 140, 86), "elfe": (106, 180, 112),
    "guerrier": (110, 128, 196), "assassin": (150, 112, 196), "magicien": (70, 170, 190),
}
NAMES = {"humain": "Humain", "halfelin": "Halfelin", "elfe": "Elfe", "guerrier": "Guerrier", "assassin": "Assassin", "magicien": "Magicien"}


def pad(rows):
    """Centre un dessin de moins de 18 lignes."""
    top = (18 - len(rows)) // 2
    return ["." * 18] * top + rows + ["." * 18] * (18 - top - len(rows))


def outline(fill):
    """Grille 18 × 18 : les cases remplies deviennent « + », leur bord « # »."""
    out = []
    for y in range(18):
        row = ""
        for x in range(18):
            if (x, y) in fill:
                row += fill[(x, y)]
            elif any((x + dx, y + dy) in fill for dx in (-1, 0, 1) for dy in (-1, 0, 1)):
                row += "#"
            else:
                row += "."
        out.append(row)
    return out


def crossed_swords():
    """Deux épées croisées, pointes en haut : lame claire bordée de la couleur, garde en travers, poignée, pommeau."""
    g = [["."] * 18 for _ in range(18)]
    blades, solid = [], []
    for flip in (False, True):
        X = (lambda x: 17 - x) if flip else (lambda x: x)
        for k in range(1, 11):  # lame : la diagonale, d'une case de large après le croisement
            blades.append((X(k + 1), k))
        solid += [(X(x + d), y) for (x, y) in ((10, 13), (11, 12), (12, 11), (13, 10), (14, 9)) for d in (0, 1)]  # garde, épaisse
        solid += [(X(13), 12), (X(14), 13)]  # poignée
        solid += [(X(15), 14), (X(16), 14), (X(15), 15), (X(16), 15)]  # pommeau
    for (x, y) in blades:
        for dx in (-1, 1):
            if g[y][x + dx] == ".":
                g[y][x + dx] = "#"
    for (x, y) in blades:
        g[y][x] = "+"
    for (x, y) in solid:
        g[y][x] = "#"
    g[0][1] = g[0][16] = "."
    return ["".join(r) for r in g]


SYMBOLS["humain"] = pad([  # couronne
    "..#.....##.....#..",
    ".#+#...#++#...#+#.",
    ".#+#...#++#...#+#.",
    ".#++#.#++++#.#++#.",
    ".#+++#++++++#+++#.",
    ".#++++++++++++++#.",
    ".#++*++++++++*++#.",
    ".#++++++**++++++#.",
    ".################.",
    ".#**************#.",
    ".################.",
])
SYMBOLS["halfelin"] = pad([  # pipe fumante
    "...........#......",
    "..........#+#.....",
    "...........#.#....",
    "............#+#...",
    ".............#....",
    "..####............",
    ".#++++#...........",
    ".#++++#...........",
    ".#++++#######.....",
    ".#+++++++++++####.",
    "..#++++######+++#.",
    "...####......####.",
])
SYMBOLS["halfelin_b"] = pad([  # porte ronde
    ".....########.....",
    "...##++++++++##...",
    "..#++#++++++#++#..",
    ".#+++#++++++#+++#.",
    ".#+++#++++++#+++#.",
    "#++++#++++++#++++#",
    "#++++#++++++#*+++#",
    "#++++#++++++#++++#",
    "#++++#++++++#++++#",
    "#++++#++++++#++++#",
    "##################",
])
SYMBOLS["guerrier"] = crossed_swords()
COLORS["halfelin_b"] = COLORS["halfelin"]
NAMES["halfelin_b"] = "Halfelin (B)"
NAMES["halfelin"] = "Halfelin (A)"
ORDER = ["humain", "halfelin", "halfelin_b", "elfe", "guerrier", "assassin", "magicien"]
for r in SYMBOLS.values():
    assert len(r) == 18 and all(len(x) == 18 for x in r), r


def tile(key):
    col, light = COLORS[key], mix(COLORS[key], 0.6)
    g = [[None] * N for _ in range(N)]
    for i in range(N):  # filet extérieur et intérieur
        for a, b in ((0, i), (N - 1, i), (i, 0), (i, N - 1)):
            g[a][b] = col
    for i in range(7, N - 7):
        for a, b in ((7, i), (N - 8, i), (i, 7), (i, N - 8)):
            g[a][b] = col
    L = N - 4  # bande de méandre, de 2 à N-3
    def put(x, y):
        g[y][x] = col
    for k in range(4, L - 4):
        for r in range(4):
            if KEY[r][(k - 4) % 6] == "#":
                put(2 + k, 2 + r)                 # haut
                put(N - 3 - k, N - 3 - r)         # bas
                put(N - 3 - r, 2 + k)             # droite
                put(2 + r, N - 3 - k)             # gauche
    for r in range(4):
        for c in range(4):
            if CORNER[r][c] == "#":
                put(2 + c, 2 + r); put(N - 3 - c, 2 + r); put(2 + c, N - 3 - r); put(N - 3 - c, N - 3 - r)
    for y, row in enumerate(SYMBOLS[key]):
        for x, ch in enumerate(row):
            if ch != ".":
                g[8 + y][8 + x] = {"#": col, "+": light, "*": BG}[ch]
    im = Image.new("RGB", (N, N), BG)
    for y in range(N):
        for x in range(N):
            if g[y][x]:
                im.putpixel((x, y), g[y][x])
    return im


if __name__ == "__main__":
    S = 4
    W = 24 + 3 * (N * S + 24)
    sheet = Image.new("RGB", (W, 40 + 3 * (N * S + 40)), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 18), "RACES ET CLASSES — pictos v3, à valider", fill=(255, 243, 200), font=font(13), anchor="mm")
    for k, key in enumerate(ORDER):
        x = 24 + (k % 3) * (N * S + 24)
        y = 40 + (k // 3) * (N * S + 40)
        sheet.paste(tile(key).resize((N * S, N * S), Image.NEAREST), (x, y))
        d.text((x + N * S // 2, y + N * S + 14), NAMES[key], fill=(220, 210, 190), font=font(12, False), anchor="mm")
    sheet.save("art/pictos_race_classe_v3.png")
    print("ok")
