"""Grille de sprites du Schrat, v1 (proposition, pas en jeu). Lancer depuis la racine du dépôt.

Petit pillard écailleux : reptile orange à museau, deux petites cornes, queue, pagne de cuir, dague courte.
Même méthode que le héros : 16x16, contour sombre automatique, vu légèrement du dessus ;
face, profil droit (le gauche en miroir), dos. Plus petit que le héros (environ 11 points de haut au lieu de 14).
"""
import re
from PIL import Image, ImageDraw, ImageFont

PAL = {
    "O": (24, 18, 30),     # contour
    "A": (217, 118, 58),   # écailles
    "a": (158, 76, 34),    # écailles sombres (ombre, crête)
    "L": (240, 204, 146),  # ventre
    "Y": (250, 222, 80),   # œil
    "K": (24, 18, 30),     # pupille
    "T": (232, 222, 190),  # cornes, dents
    "H": (120, 74, 38),    # pagne
    "h": (82, 48, 24),
    "b": (98, 62, 30),     # manche de la dague
    "M": (224, 230, 236),  # lame
    "m": (132, 142, 156),
}

def grid(rows):
    g = [list(r.ljust(16, ".")[:16]) for r in rows]
    while len(g) < 16:
        g.append(list("." * 16))
    return g

def outline(g):
    o = [r[:] for r in g]
    for y in range(16):
        for x in range(16):
            if g[y][x] == ".":
                for ax, ay in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + ax, y + ay
                    if 0 <= nx < 16 and 0 <= ny < 16 and g[ny][nx] not in ".O":
                        o[y][x] = "O"
                        break
    return o

def shift(g, dx=0, dy=0, rows=range(16)):
    """Décale une partie de l'image (pour respirer, s'élancer)."""
    o = [r[:] for r in g]
    for y in rows:
        for x in range(16):
            o[y][x] = "."
    for y in rows:
        for x in range(16):
            ny, nx = y + dy, x + dx
            if g[y][x] != "." and 0 <= ny < 16 and 0 <= nx < 16:
                o[ny][nx] = g[y][x]
    for y in range(16):
        if y not in rows:
            for x in range(16):
                if o[y][x] == "." and g[y][x] != ".":
                    o[y][x] = g[y][x]
    return o

def paint(g, pts):
    o = [r[:] for r in g]
    for x, y, c in pts:
        if 0 <= x < 16 and 0 <= y < 16:
            o[y][x] = c
    return o

# ---------- PROFIL (vers la droite) ----------
P_BODY = [
    "", "", "",
    ".......T..T.....",
    "......aAAAAa....",
    ".....aAAAAAAa...",
    ".....AAAYKAAAAa.",
    ".....AAAAAAAAAAa",
    "......aAATATAAa.",
    ".......aAAAAa...",
    "......AALLLA....",
    "..aa.AALLLLAA...",
    "...aAAHHHHHA....",
]
P_LEGS = ["....aa.AA.AA....", "......aaa.aaa..."]
P_LEGS_A = ["....aa.AA..AA...", "......aaa...aaa."]
P_LEGS_B = ["....aa..AAA.....", ".......aaaa....."]
P_DAGGER = [(12, 12, "b"), (13, 11, "M"), (14, 10, "M"), (13, 10, "m")]
P_DAGGER_UP = [(11, 11, "A"), (12, 10, "b"), (12, 9, "M"), (12, 8, "M"), (13, 8, "m")]
P_DAGGER_STAB = [(12, 11, "A"), (13, 11, "b"), (14, 11, "M"), (15, 11, "M"), (14, 12, "m")]

def profile(legs=P_LEGS, dagger=P_DAGGER, bob=0, lunge=0):
    g = grid(P_BODY + legs)
    if bob:
        g = shift(g, 0, bob, rows=range(3, 13))
    g = paint(g, [(x, y + bob, c) for x, y, c in dagger])
    if lunge:
        g = shift(g, lunge, 0, rows=range(3, 13))
    return outline(g)

# ---------- FACE (vers le bas) ----------
# De face : cornes écartées, yeux sur les côtés (reptile), museau clair avec narines et deux crocs.
F_BODY = [
    "", "", "",
    "...T........T...",
    "....TaAAAAaT....",
    "...aAAAAAAAAa...",
    "...AYKAAAAKYA...",
    "...AAAAAAAAAA...",
    "....aALLLLAa....",
    "....aLKLLKLa....",
    ".....aTLLTa.....",
    "....AALLLLAA....",
    "...AAALLLLAAA...",
    "...a.HHHHHH.....",
]
F_LEGS = [".....AA..AA.....", ".....aa..aa....."]
F_LEGS_A = [".....AA..AA.....", ".....aa...aa...."]
F_LEGS_B = [".....AA..AA.....", "....aa...aa....."]
F_DAGGER = [(12, 13, "b"), (13, 12, "M"), (13, 11, "M"), (14, 12, "m")]
F_DAGGER_UP = [(12, 11, "A"), (13, 10, "b"), (13, 9, "M"), (13, 8, "M"), (14, 9, "m")]
F_DAGGER_STAB = [(11, 13, "A"), (11, 14, "b"), (12, 15, "M"), (12, 14, "m")]

def front(legs=F_LEGS, dagger=F_DAGGER, bob=0):
    g = grid(F_BODY + legs)
    if bob:
        g = shift(g, 0, bob, rows=range(3, 14))
    g = paint(g, [(x, y + bob, c) for x, y, c in dagger])
    return outline(g)

# ---------- DOS (vers le haut) ----------
B_BODY = [
    "", "", "",
    "...T........T...",
    "....TaAAAAaT....",
    "...aAAAAAAAAa...",
    "...aAAAAAAAAa...",
    "...AAAAAAAAAA...",
    "...aAAAAAAAAa...",
    "....aAAaaAAa....",
    ".....aAaaAa.....",
    "....AAAaaAAA....",
    "...AAAAaaAAAA...",
    "....HHHHHHHHa...",
]
B_LEGS = [".....AAaaAA.....", ".....aa.aaa....."]
B_LEGS_A = [".....AAaaAA.....", "....aa..aa......"]
B_LEGS_B = [".....AAaaAA.....", "......aaa.aa...."]
B_DAGGER = [(3, 13, "b"), (2, 12, "M"), (2, 11, "M"), (1, 12, "m")]
B_DAGGER_UP = [(3, 11, "A"), (2, 10, "b"), (2, 9, "M"), (2, 8, "M"), (1, 9, "m")]
B_DAGGER_STAB = [(3, 10, "A"), (3, 9, "b"), (3, 8, "M"), (3, 7, "M"), (3, 6, "M"), (2, 7, "m")]

def back(legs=B_LEGS, dagger=B_DAGGER, bob=0):
    g = grid(B_BODY + legs)
    if bob:
        g = shift(g, 0, bob, rows=range(3, 14))
    g = paint(g, [(x, y + bob, c) for x, y, c in dagger])
    return outline(g)

# ---------- Poses à part ----------
# Endormi : roulé en boule, la tête posée sur les pattes, l'œil fermé, la queue enroulée devant.
SLEEP = outline(grid([
    "", "", "", "", "", "", "", "",
    "................",
    ".......T.T......",
    "......aAAAAa....",
    "....aAAAaaAAAAa.",
    "...aAAAAAAAAAAAa",
    "..aAALLLLLAAaaa.",
    "..aaaaaaaaaaa...",
]))
# Mort : sur le dos, ventre clair en l'air, pattes levées, œil en croix, la dague tombée à côté.
DEAD = outline(grid([
    "", "", "", "", "", "", "", "", "",
    ".....a..a.......",
    ".....A..A....T..",
    "..aaAAAAAAAAAAT.",
    ".aAALLLLLLLAAKA.",
    "..aaAAAAAAAAaa..",
    ".......bMMM.....",
]))

def hurt(g):
    """Touché : un éclair clair sur les écailles (comme le héros)."""
    swap = {"A": "L", "a": "A", "L": "T"}
    return [[swap.get(c, c) for c in row] for row in g]

FRAMES = [
    ("repos 1", front()), ("repos 2", front(bob=1)), ("marche 1", front(F_LEGS_A)), ("marche 2", front(F_LEGS_B)),
    ("dague levée", front(dagger=F_DAGGER_UP)), ("coup", front(dagger=F_DAGGER_STAB)),
    ("repos 1", profile()), ("repos 2", profile(bob=1)), ("marche 1", profile(P_LEGS_A)), ("marche 2", profile(P_LEGS_B)),
    ("dague levée", profile(dagger=P_DAGGER_UP)), ("coup", profile(dagger=P_DAGGER_STAB, lunge=1)),
    ("repos 1", back()), ("repos 2", back(bob=1)), ("marche 1", back(B_LEGS_A)), ("marche 2", back(B_LEGS_B)),
    ("dague levée", back(dagger=B_DAGGER_UP)), ("coup", back(dagger=B_DAGGER_STAB)),
    ("touché", hurt(profile())), ("endormi", SLEEP), ("mort", DEAD),
]
ROW_TITLES = ["FACE", "PROFIL", "DOS", "AUTRES"]

def hero_idle():
    """Le héros de face, à la même échelle, pour comparer les tailles."""
    src = open("src/render/sprites/guerrier.ts", encoding="utf8").read()
    pal = {k: tuple(int(v[i:i + 2], 16) for i in (1, 3, 5)) for k, v in re.findall(r'(\w): "(#[0-9a-f]{6})"', src.split("export const GUERRIER")[1].split("};")[0])}
    rows = re.findall(r'"([^"]+)"', src.split("idleDown: [")[1].split("]")[0])
    return rows, pal

def render(g, scale, pal=PAL, bg=None):
    im = Image.new("RGBA", (16 * scale, 16 * scale), bg or (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y, row in enumerate(g):
        for x, c in enumerate(row):
            if c != ".":
                d.rectangle([x * scale, y * scale, (x + 1) * scale - 1, (y + 1) * scale - 1], fill=pal[c])
    return im

if __name__ == "__main__":
    S = 6
    cell = 16 * S + 12
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 13)
    fs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
    W = 140 + 6 * cell
    H = 40 + 4 * (cell + 34) + 230
    sheet = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 18), "SCHRAT — GRILLE v1 (proposition, rien en jeu)", fill=(255, 243, 200), font=f, anchor="mm")
    for i, (label, g) in enumerate(FRAMES):
        row, col = (i // 6, i % 6) if i < 18 else (3, i - 18)
        x = 140 + col * cell
        y = 40 + row * (cell + 34)
        if col == 0:
            d.text((10, y + cell // 2), ROW_TITLES[row], fill=(214, 170, 84), font=fs, anchor="lm")
        d.rectangle([x, y, x + cell - 6, y + cell - 6], fill=(70, 61, 82))
        sheet.paste(render(g, S), (x + 3, y + 3), render(g, S))
        d.text((x + (cell - 6) // 2, y + cell + 6), f"{i + 1}. {label}", fill=(220, 210, 190), font=fs, anchor="mm")
    # En situation : sur trois dalles, à la taille du jeu, à côté du héros.
    y0 = 40 + 4 * (cell + 34) + 10
    d.text((10, y0 + 8), "EN JEU (taille réelle x3)", fill=(214, 170, 84), font=fs, anchor="lm")
    T = 48
    hero_rows, hero_pal = hero_idle()
    for k in range(5):
        d.rectangle([140 + k * T, y0 + 30, 140 + (k + 1) * T - 1, y0 + 30 + T - 1], fill=(70, 61, 82), outline=(58, 50, 68))
    size = round(T * 1.3)
    hero = render(hero_rows, 1, hero_pal).resize((size, size), Image.NEAREST)
    sheet.paste(hero, (140 + T // 2 - size // 2, y0 + 30 + T // 2 - size // 2 - 6), hero)
    for k, g in ((2, profile()), (4, FRAMES[0][1])):
        sch = render(g, 1).resize((size, size), Image.NEAREST)
        sheet.paste(sch, (140 + k * T + T // 2 - size // 2, y0 + 30 + T // 2 - size // 2 - 6), sch)
    d.text((140 + 2 * T, y0 + 30 + T + 14), "héros / Schrat (profil) / Schrat (face)", fill=(200, 190, 170), font=fs, anchor="mm")
    # Le losange actuel, pour mémoire.
    lx = 140 + 6 * T
    d.rectangle([lx, y0 + 30, lx + T - 1, y0 + 30 + T - 1], fill=(70, 61, 82))
    d.polygon([(lx + T // 2, y0 + 36), (lx + T - 6, y0 + 30 + T // 2), (lx + T // 2, y0 + 30 + T - 6), (lx + 6, y0 + 30 + T // 2)], fill=(217, 118, 58))
    d.text((lx + T // 2, y0 + 30 + T + 14), "actuel", fill=(150, 150, 150), font=fs, anchor="mm")
    sheet.save("art/schrat_v1.png")
    print(sheet.size)
