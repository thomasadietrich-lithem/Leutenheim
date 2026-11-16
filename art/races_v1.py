"""Planches « races v1 » (Thomas, 2026-11-16 : « génère les sprites [Halfelin, Elfe] ; ajoute couché au sol s'ils
tombent, y compris pour l'humain ; quelque chose de modulaire, capable de s'adapter à l'équipement »). PROPOSITION.

Le héros n'est plus une suite d'images figées : c'est un EMPILEMENT DE CALQUES, sur la grille 16 × 16 du Guerrier v6
(celle qui est en jeu), dont on reprend toutes les poses :
  1. la RACE   : tête (cheveux, oreilles), couleurs de peau et de cheveux, taille (Halfelin −2 pixels, Elfe +1), pieds nus ;
  2. l'ARMURE  : tunique, cuir, cuir clouté, cotte de mailles, harnois (couleurs et motif du torse et des manches) ;
  3. le CASQUE : aucun, cuir, mailles (posé sur les cheveux, quelle que soit la race ou la pose) ;
  4. l'ARME    : poings, couteau, épée courte, masse, cimeterre, épée longue, lance (redessinée dans l'axe de la main) ;
  5. l'ARC     : court ou puissant (poignée rouge).
Poses : celles de la v6 (repos, marche, épée, arc, blessé, mort) + À TERRE vivant (2 images) + SE RELÈVE.

  python3 art/races_v1.py            → art/races_v1.png (races et poses) et art/races_equipement_v1.png (calques)
  python3 art/races_v1.py export     → src/render/sprites/heros.ts (les calques, assemblés en jeu par src/render/heroLook.ts)
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = open(os.path.join(HERE, "guerrier_sheet_v6.py"), encoding="utf-8").read()
BASE = SRC[: SRC.index("def render(g, scale):")]
ROWS_SRC = BASE[BASE.index("ROWS=[") :]

# ---------------------------------------------------------------------------------------------------- 1. RACES
HEADS = {
    "humain": {},  # les têtes de la v6
    "halfelin": {  # tête ronde et large, boucles cuivrées ; une rangée vide en haut : il est plus petit
        "F_HEAD": ["", "....HGHGGHGH", "....GHHHHHHG", "....HHSSSSHH", ".....SOSSOS", "......SssS"],
        "B_HEAD": ["", "....HGHGGHGH", "....GHHHHHHG", "....HHHHHHHH", ".....hHHHHh", "......hssh"],
        "S_HEAD": ["", ".....HGHGGH", "....GHGHHHH", "....HHHHSSS", ".....hHSSOS", "......hSSS"],
    },
    "elfe": {  # visage étroit, longs cheveux clairs jusqu'aux épaules, oreilles en pointe
        "F_HEAD": ["......HGGH", ".....HGGHHH", ".....HHHHHH", "....SHSSSSHS", "....hSOSSOSh", "....h.SssS.h", "....h......h"],
        "B_HEAD": ["......HGGH", ".....HGGHHH", ".....HHHHHH", "....SHHHHHHS", "....hHHGHHHh", "....hHHHHHHh", ".....hHHHHh"],
        "S_HEAD": ["......HGGH", ".....HGGHHH", "....SHHHHHH", ".....SHHSSS", ".....hHSSOS", ".....hhSSS", ".....h"],
    },
}
RACE_PAL = {
    "humain": {},
    "halfelin": {"H": (156, 72, 30), "G": (204, 116, 50), "h": (104, 46, 20), "S": (212, 156, 110), "s": (170, 114, 76),
                 "p": (194, 138, 94)},  # peau hâlée (Thomas : « un peu plus sombre ») ; « p » = les bottes : pieds nus
    "elfe": {"H": (224, 200, 122), "G": (250, 236, 176), "h": (172, 146, 82), "S": (247, 216, 190), "s": (212, 172, 142)},
}
RACE_NAME = {"humain": "HUMAIN", "halfelin": "HALFELIN", "elfe": "ELFE"}

# têtes vues couché (colonnes 0 à 6 de l'image, six rangées)
LY_HEAD = {
    "humain": ["...HHH.", "..HGHHS", "..HHHSO", "..HHHSS", "..hHHSO", "...hhh."],
    "halfelin": ["..HGHH.", ".GHHGHS", ".HGHHSO", ".GHHHSS", ".HHGHSO", "..HHGh."],
    "elfe": [".hHHHHS", "hHHGHHS", "hhHHHSO", "hhHHHSS", "hHHHHSO", ".hHHHHS"],
}

# ---------------------------------------------------------------------------------------------------- 2. ARMURES
PAL_EXTRA = {
    "1": (176, 118, 64), "2": (136, 88, 48), "3": (100, 64, 36),  # cuir
    "4": (182, 190, 202), "5": (134, 142, 158), "6": (96, 102, 118),  # mailles
    "7": (198, 210, 230), "8": (136, 150, 180), "9": (86, 96, 126),  # acier du harnois
    "Y": (236, 196, 84),  # or
    "C": (190, 134, 76), "c": (150, 100, 54), "e": (104, 66, 36),  # casque de cuir
    "A": (190, 60, 52),  # poignée rouge de l'arc puissant
}
ARMORS = ["tunique", "cuir", "cloute", "mailles", "harnois"]
ARMOR_NAME = {"tunique": "Tunique", "cuir": "Cuir", "cloute": "Cuir clouté", "mailles": "Cotte de mailles", "harnois": "Harnois"}


def apply_armor(g, armor):
    if armor == "tunique":
        return
    m = {"cuir": "123", "cloute": "123", "mailles": "456", "harnois": "789"}[armor]
    for y in range(16):
        for x in range(16):
            c = g[y][x]
            if c in "Wwx":
                n = m["Wwx".index(c)]
                if armor == "mailles" and c == "W" and (x + y) % 2:
                    n = "5"  # mailles : un damier
                if armor == "cloute" and c == "W" and x % 2 == 0 and y % 2 == 0:
                    n = "M"  # clous d'acier
                g[y][x] = n
            elif armor == "harnois":
                if c in "Bb":
                    g[y][x] = "9"
                elif c == "P":
                    g[y][x] = "8"  # jambières
                elif c == "q":
                    g[y][x] = "9"
    if armor == "harnois":  # la boucle devient un rivet d'or
        for y in range(16):
            for x in range(1, 15):
                if g[y][x] == "M" and g[y][x - 1] == "9" and g[y][x + 1] in "9M":
                    g[y][x] = "Y"


# ---------------------------------------------------------------------------------------------------- 3. CASQUES
HELMETS = ["aucun", "cuir", "mailles"]
HELMET_NAME = {"aucun": "Sans casque", "cuir": "Casque de cuir", "mailles": "Casque de mailles"}


def apply_helmet(g, kind, lying=False):
    """Casque de cuir : recouvre les trois premières rangées de cheveux (ou colonnes, si le héros est couché).
    Casque de mailles (Thomas, 2026-11-16 : « toute la tête sauf le visage ») : une coiffe qui recouvre TOUS les cheveux
    de la tête (six rangées depuis le sommet, ou six colonnes si le héros est couché) ; seul le visage reste nu."""
    if kind == "aucun":
        return
    cells = [(x, y) for y in range(16) for x in range(16) if g[y][x] in "HG"]
    if not cells:
        return
    if kind == "mailles":
        x0, x1 = min(x for x, _ in cells), max(x for x, _ in cells)
        y0, y1 = min(y for _, y in cells), max(y for _, y in cells)
        if lying:
            x1 = min(15, x0 + 5)
            y0, y1 = max(0, y0 - 1), min(15, y1 + 1)
        else:
            y1 = min(15, y0 + 6)
            x0, x1 = max(0, x0 - 1), min(15, x1 + 1)
        first = x0 if lying else y0
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                # La septième rangée (longs cheveux de l'Elfe) : seulement les mèches claires, pas la lettre « h », qui
                # est aussi la hampe de la flèche encochée.
                if g[y][x] in ("HG" if not lying and y == y0 + 6 else "HGh"):
                    g[y][x] = "7" if (x if lying else y) == first else ("4" if (x + y) % 2 == 0 else "5")
        return
    top, mid, rim = ("C", "c", "e")
    if lying:
        x0 = min(x for x, _ in cells)
        for y in range(16):
            for i in range(3):
                x = x0 + i
                if x < 16 and g[y][x] in "HGh":
                    g[y][x] = (top, mid, rim)[i]
    else:
        y0 = min(y for _, y in cells)
        for i in range(3):
            y = y0 + i
            if y > 15:
                continue
            for x in range(16):
                if g[y][x] in "HGh":
                    g[y][x] = (top, mid, rim)[i]


# ---------------------------------------------------------------------------------------------------- 4. ARMES
WEAPONS = ["poings", "couteau", "epee", "masse", "cimeterre", "epee_longue", "lance"]
WEAPON_NAME = {"poings": "Poings", "couteau": "Couteau", "epee": "Épée courte", "masse": "Masse", "cimeterre": "Cimeterre",
               "epee_longue": "Épée longue", "lance": "Lance"}
WEAPON_LISTS = ["F_SWORD", "B_SWORD", "S_ARM_UP", "S_ARM_BACK", "S_ARM_FWD", "S_ARM_LOW", "F_SW_UP", "F_SW_DOWN", "B_SW_BACK", "B_SW_UP"]


def reweapon(lst, w):
    """Redessine l'arme d'une pose à partir de la poignée (« b ») et de l'axe de la lame (« M »)."""
    if w == "epee":
        return list(lst)
    hand = [p for p in lst if p[2] in "Sw"]
    grip = [p for p in lst if p[2] == "b"]
    blade = [p for p in lst if p[2] == "M"]
    shade = [p for p in lst if p[2] == "m"]
    if not grip or not blade:
        return list(lst)
    hx, hy = grip[0][:2]
    pos = sorted(((p[0], p[1]) for p in blade), key=lambda p: (p[0] - hx) ** 2 + (p[1] - hy) ** 2)
    st = (pos[-1][0] - pos[-2][0], pos[-1][1] - pos[-2][1]) if len(pos) > 1 else (pos[0][0] - hx, pos[0][1] - hy)
    perp = (-st[1], st[0])

    def ext(n):
        out = list(pos)
        for _ in range(n):
            out.append((out[-1][0] + st[0], out[-1][1] + st[1]))
        return out

    if w == "poings":
        return hand
    if w == "couteau":
        return hand + [(hx, hy, "b")] + [(x, y, "M") for x, y in pos[:2]]
    if w == "masse":
        p = ext(1)[:3]
        head = p[-1]
        out = hand + [(hx, hy, "b")] + [(x, y, "b") for x, y in p[:-1]]
        out += [(head[0], head[1], "M"), (head[0] + perp[0], head[1] + perp[1], "m"), (head[0] - perp[0], head[1] - perp[1], "m"),
                (head[0] + st[0], head[1] + st[1], "m")]
        return out
    if w == "cimeterre":
        p = ext(1)
        out = hand + [(hx, hy, "Y")] + [(x, y, "M") for x, y in p[:-2]]
        for x, y in p[-2:]:  # la pointe se recourbe
            out.append((x + perp[0], y + perp[1], "M"))
        out.append((p[-3][0] + perp[0], p[-3][1] + perp[1], "m") if len(p) >= 3 else (p[0][0], p[0][1], "M"))
        return out
    if w == "epee_longue":
        p = ext(2)
        out = hand + [(hx, hy, "b")] + [(x, y, "M") for x, y in p] + shade
        out += [(p[0][0] + perp[0], p[0][1] + perp[1], "m"), (p[0][0] - perp[0], p[0][1] - perp[1], "m")]  # la garde
        return out
    if w == "lance":
        p = ext(3)
        out = hand + [(hx - st[0], hy - st[1], "Q"), (hx, hy, "Q")] + [(x, y, "Q") for x, y in p[:-2]]
        out += [(x, y, "M") for x, y in p[-2:]]
        return out
    return list(lst)


# ---------------------------------------------------------------------------------------------------- TAILLE
def belt_row(g):
    n, y = max((sum(c == "B" for c in g[y]), y) for y in range(16))
    return y if n else None


def shorten(g):
    """Halfelin : on retire la première rangée du torse ; tout ce qui est au-dessus descend d'un pixel."""
    by = belt_row(g)
    if by is None or by < 3:
        return
    del g[by - 2]
    g.insert(0, ["."] * 16)


def lengthen(g):
    """Elfe : une rangée de jambes en plus ; tout ce qui est au-dessus monte d'un pixel."""
    by = belt_row(g)
    if by is None or by + 2 > 15:
        return
    row = g[by + 2][:]
    del g[0]
    g.insert(by + 1, row)


# ---------------------------------------------------------------------------------------------------- À TERRE
def lying_frames(race, weapon="epee"):
    """Mort (comme la v6), à terre vivant ×2, par race. Corps couché sur le dos, tête à gauche."""
    body = {
        "dead": ["..S.....", "wWWw....", "WWWBWPPpp", "WWWBWPP..", "WWWBWPPpp", "wWWx.S..."],
        "prone0": ["..w...P..", "wWWw.PP..", "WWWBWP.pp", "WWWBWPP..", "WWWBWPPpp", "wWWx.S..."],
        "prone1": [".........", "wWWwwS...", "WWWBWPPpp", "WWWBWPP..", "WWWBWP.pp", "wWWxwSPP."],
    }
    out = {}
    for name, rows in body.items():
        g = [["."] * 16 for _ in range(16)]
        b = [r.ljust(9, ".") for r in rows]
        if race == "halfelin":  # plus court : une colonne de torse et une de jambes en moins
            b = [r[:1] + r[2:6] + r[7:] for r in b]
        elif race == "elfe":  # plus long : une colonne de jambes en plus
            b = [r[:6] + r[5] + r[6:] for r in b]
        lift = 1 if name == "prone1" else 0  # il relève la tête
        for y in range(6):
            for x, c in enumerate(LY_HEAD[race][y]):
                if c != ".":
                    g[9 + y - lift][x] = c
            for x, c in enumerate(b[y]):
                if c != "." and 7 + x < 16:
                    g[9 + y][7 + x] = c
        if name == "prone0":  # un bras levé
            g[8][9] = "S"
        if name == "dead" and weapon in ("epee", "epee_longue", "couteau", "cimeterre"):  # la lame tombée à côté
            for x, y, c in ((13, 9, "b"), (14, 8, "M"), (15, 7, "M")):
                g[y][x] = c
        out[name] = g
    return out


def get_up(ns, race):
    """Se relève : assis de profil, une main au sol, les jambes allongées."""
    g = [["."] * 16 for _ in range(16)]
    ns["put"](g, ["PPPPPPpp", "......pp"], 6, 13)
    ns["put"](g, ns["S_TORSO"][:3], -1, 10)
    head = ns["S_HEAD"]
    ns["put"](g, head, -1, 4 if race != "halfelin" else 5)
    ns["pts"](g, [(4, 11, "w"), (3, 12, "w"), (3, 13, "S"), (9, 11, "w"), (10, 12, "S")])
    return g


# ---------------------------------------------------------------------------------------------------- ASSEMBLAGE
SETS = {
    "idleDown": ("REPOS", [0, 1]), "idleSide": ("REPOS", [2, 3]), "idleUp": ("REPOS", [4]),
    "walkDown": ("MARCHE face", [0, 1, 2, 3]), "walkSide": ("MARCHE profil", [0, 1, 2, 3]), "walkUp": ("MARCHE dos", [0, 1, 2, 3]),
    "swordDown": ("EPEE face", [0, 1, 2]), "swordSide": ("EPEE profil", [0, 1, 2]), "swordUp": ("EPEE dos", [0, 1, 2]),
    "bowDown": ("ARC face", [1, 0]), "bowSide": ("ARC profil", [1, 0]), "bowUp": ("ARC dos", [1, 0]),
    "hurt": ("BLESSE / MORT", [0]),
}
LYING = ("dead", "prone0", "prone1")


def raw_frames(race="humain", weapon="epee"):
    """Les images d'une race avec une arme, AVANT l'armure, le casque et le contour (ce que le jeu reçoit)."""
    ns = {}
    exec(BASE, ns)
    for k, v in HEADS[race].items():
        ns[k] = v
    for name in WEAPON_LISTS:
        ns[name][:] = reweapon(ns[name], weapon)  # sur place : ces listes servent de valeurs par défaut
    exec(ROWS_SRC, ns)
    rows = dict(ns["ROWS"])
    frames = {k: [[r[:] for r in rows[name][i][1]] for i in idx] for k, (name, idx) in SETS.items()}
    frames["getUp"] = [get_up(ns, race)]
    for fs in frames.values():
        for g in fs:
            if race == "halfelin":
                shorten(g)
            elif race == "elfe":
                lengthen(g)
    for name, g in lying_frames(race, weapon).items():
        frames[name] = [g]
    return frames, ns


def build(race="humain", armor="tunique", helmet="aucun", weapon="epee", bow="court"):
    """Toutes les images d'un héros : {nom: [grilles 16 × 16 de lettres, contour compris]}."""
    frames, ns = raw_frames(race, weapon)
    out = {}
    for k, fs in frames.items():
        res = []
        for g in fs:
            apply_armor(g, armor)
            apply_helmet(g, helmet, lying=k in LYING)
            if bow == "puissant" and k.startswith("bow"):
                for y in range(16):
                    for x in range(16):
                        if g[y][x] == "d":
                            g[y][x] = "A"
            res.append(ns["outline"](g))
        out[k] = res
    pal = dict(ns["PAL"])
    pal.update(PAL_EXTRA)
    pal.update(RACE_PAL[race])
    return out, pal


# ---------------------------------------------------------------------------------------------------- PLANCHES
BG, FLOOR, GRID, INK, GOLD, DIM = (34, 28, 40), (78, 70, 94), (84, 76, 100), (224, 218, 204), (232, 200, 120), (160, 150, 176)


def fnt(size, bold=True):
    name = "DejaVuSansMono-Bold.ttf" if bold else "DejaVuSansMono.ttf"
    return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/" + name, size)


def sprite(g, pal, s):
    im = Image.new("RGBA", (16 * s, 16 * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y in range(16):
        for x in range(16):
            c = g[y][x]
            if c != ".":
                d.rectangle([x * s, y * s, (x + 1) * s - 1, (y + 1) * s - 1], fill=pal[c])
    return im


def cell(img, d, x, y, g, pal, s, label=None, grid=True, shadow=True):
    n = 16 * s
    d.rectangle([x, y, x + n - 1, y + n - 1], fill=FLOOR)
    if grid and s >= 5:
        for k in range(1, 16):
            d.line([x + k * s, y, x + k * s, y + n - 1], fill=GRID)
            d.line([x, y + k * s, x + n - 1, y + k * s], fill=GRID)
    if shadow:
        sh = Image.new("RGBA", (n, n), (0, 0, 0, 0))
        ImageDraw.Draw(sh).ellipse([4 * s, 13.6 * s, 12 * s, 15.9 * s], fill=(20, 14, 28, 110))
        img.paste(sh, (x, y), sh)
    im = sprite(g, pal, s)
    img.paste(im, (x, y), im)
    if label:
        d.text((x + n // 2, y + n + 2), label, fill=DIM, font=fnt(10, False), anchor="ma")


POSES = [
    ("idleDown", 0, "repos"), ("idleSide", 0, "profil"), ("idleUp", 0, "dos"), ("walkDown", 1, "marche"), ("walkSide", 0, "marche"),
    ("walkSide", 1, "marche"), ("walkUp", 1, "marche"), ("swordSide", 0, "épée 1"), ("swordSide", 1, "épée 2"), ("swordSide", 2, "épée 3"),
    ("swordDown", 0, "épée face"), ("swordUp", 1, "épée dos"), ("bowSide", 0, "arc tendu"), ("bowDown", 0, "arc face"), ("bowUp", 0, "arc dos"),
    ("hurt", 0, "blessé"), ("prone0", 0, "À TERRE 1"), ("prone1", 0, "À TERRE 2"), ("getUp", 0, "SE RELÈVE"), ("dead", 0, "mort"),
]


def sheet_races():
    W = 1000
    S1, S2 = 6, 5
    H = 70 + 16 * S1 + 60 + 3 * (2 * (16 * S2 + 22) + 46) + 130
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.text((16, 12), "CAVE ROLLER — RACES v1 (proposition) : Humain, Halfelin, Elfe", fill=GOLD, font=fnt(17))
    d.text((16, 36), "Grille 16 × 16 du Guerrier en jeu. Guerrier de départ : tunique, épée courte, arc court.", fill=INK, font=fnt(12, False))
    built = {r: build(r) for r in RACE_NAME}
    y = 70
    x = 16
    for r in RACE_NAME:  # les trois races côte à côte
        fs, pal = built[r]
        d.text((x, y - 16), RACE_NAME[r], fill=GOLD, font=fnt(13))
        for i, k in enumerate(("idleDown", "idleSide", "idleUp")):
            cell(img, d, x + i * (16 * S1 + 6), y, fs[k][0], pal, S1)
        x += 3 * (16 * S1 + 6) + 22
    y += 16 * S1 + 44
    for r in RACE_NAME:  # toutes les poses, deux lignes de dix
        fs, pal = built[r]
        d.text((16, y - 20), RACE_NAME[r] + " — toutes les poses", fill=GOLD, font=fnt(13))
        for i, (k, idx, lab) in enumerate(POSES):
            cx = 16 + (i % 10) * (16 * S2 + 16)
            cy = y + (i // 10) * (16 * S2 + 22)
            cell(img, d, cx, cy, fs[k][idx], pal, S2, lab)
        y += 2 * (16 * S2 + 22) + 46
    d.text((16, y - 16), "Taille réelle ×2 et ×3 (repos face, profil, dos ; à terre ; se relève ; mort) :", fill=INK, font=fnt(12, False))
    for sc in (2, 3):
        x = 16
        for r in RACE_NAME:
            fs, pal = built[r]
            for k in ("idleDown", "idleSide", "idleUp", "prone0", "getUp", "dead"):
                cell(img, d, x, y + 6, fs[k][0], pal, sc, grid=False)
                x += 16 * sc + 3
            x += 10
        y += 16 * sc + 10
    img.save(os.path.join(HERE, "races_v1.png"))
    return img.size


def sheet_equipment():
    W = 1000
    S = 5
    n = 16 * S
    rows_h = n + 20
    H = 84 + 3 * (rows_h - 14) + 56 + 3 * (rows_h - 14) + 56 + 4 * (n + 6) + 56 + 4 * (n + 22) + 10
    img = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(img)
    d.text((16, 12), "CAVE ROLLER — RACES v1 : LES CALQUES D'ÉQUIPEMENT (proposition)", fill=GOLD, font=fnt(17))
    d.text((16, 36), "Chaque calque se pose sur n'importe quelle race et n'importe quelle pose.", fill=INK, font=fnt(12, False))
    y = 84
    d.text((16, y - 20), "1. ARMURES (face et profil)", fill=GOLD, font=fnt(13))
    for r in RACE_NAME:
        for i, a in enumerate(ARMORS):
            fs, pal = build(r, armor=a)
            x = 16 + i * (2 * n + 16)
            cell(img, d, x, y, fs["idleDown"][0], pal, S, ARMOR_NAME[a] if r == "elfe" else None)
            cell(img, d, x + n + 2, y, fs["idleSide"][0], pal, S)
        y += rows_h - 14
    y += 56
    d.text((16, y - 20), "2. CASQUES : cuir, puis mailles (face, profil, dos)   |   ARC PUISSANT (poignée rouge)", fill=GOLD, font=fnt(13))
    for r in RACE_NAME:
        x = 16
        for h in ("cuir", "mailles"):
            fs, pal = build(r, helmet=h)
            for k in ("idleDown", "idleSide", "idleUp"):
                cell(img, d, x, y, fs[k][0], pal, S)
                x += n + 2
            x += 14
        fs, pal = build(r, bow="puissant")
        for k in ("bowSide", "bowDown"):
            cell(img, d, x, y, fs[k][0], pal, S)
            x += n + 2
        y += rows_h - 14
    y += 56
    d.text((16, y - 20), "3. ARMES (coup de profil ; dernière ligne : portées au repos)", fill=GOLD, font=fnt(13))
    for r in list(RACE_NAME) + ["repos"]:
        for i, w in enumerate(WEAPONS):
            fs, pal = build("humain" if r == "repos" else r, weapon=w)
            x = 16 + i * (n + 58)
            g = fs["idleDown"][0] if r == "repos" else fs["swordSide"][1]
            cell(img, d, x, y, g, pal, S, WEAPON_NAME[w] if r == "repos" else None)
        y += n + 6
    y += 56
    d.text((16, y - 20), "4. TOUT ENSEMBLE (exemples) : toutes les poses suivent l'équipement", fill=GOLD, font=fnt(13))
    combos = [("humain", "cloute", "cuir", "masse", "court", "Humain : cuir clouté, casque de cuir, masse"),
              ("halfelin", "harnois", "mailles", "lance", "court", "Halfelin : harnois, casque de mailles, lance"),
              ("elfe", "mailles", "cuir", "cimeterre", "puissant", "Elfe : cotte de mailles, casque de cuir, cimeterre, arc puissant"),
              ("halfelin", "cuir", "aucun", "couteau", "court", "Halfelin : cuir, couteau")]
    for r, a, h, w, b, lab in combos:
        fs, pal = build(r, armor=a, helmet=h, weapon=w, bow=b)
        x = 16
        for k, idx in (("idleDown", 0), ("idleSide", 0), ("idleUp", 0), ("walkSide", 0), ("swordSide", 1), ("bowSide", 0), ("hurt", 0),
                       ("prone0", 0), ("getUp", 0), ("dead", 0)):
            cell(img, d, x, y, fs[k][idx], pal, S)
            x += n + 2
        d.text((x + 8, y + n // 2 - 6), "", fill=INK, font=fnt(11, False))
        d.text((16, y + n + 2), lab, fill=DIM, font=fnt(11, False))
        y += n + 22
    img.save(os.path.join(HERE, "races_equipement_v1.png"))
    return img.size


def export():
    """Écrit src/render/sprites/heros.ts : par race, les images de base (poings, tunique, sans casque, sans contour) et,
    par arme, les seuls pixels qui changent (« xyc » : colonne et rangée en base 16, puis la lettre)."""
    hexa = "0123456789abcdef"
    out = ["// FICHIER GÉNÉRÉ par art/races_v1.py (export) : ne pas modifier à la main.",
           "/** Héros en calques (Thomas, 2026-11-16) : images de base par race, pixels d'arme par-dessus ; l'armure, le casque,",
           " *  la poignée de l'arc et le contour sont posés en jeu par `src/render/heroLook.ts`. */", ""]
    _, ns = raw_frames("humain", "poings")
    pal = dict(ns["PAL"])
    pal.update(PAL_EXTRA)
    out.append("export const HERO_PALETTE: Record<string, string> = {")
    for c in sorted(pal):
        out.append('  "%s": "#%02x%02x%02x",' % ((c,) + tuple(pal[c])))
    out += ["};", "", "export const HERO_RACE_PALETTE: Record<string, Record<string, string>> = {"]
    for r in RACE_NAME:
        out.append("  %s: { %s }," % (r, ", ".join('"%s": "#%02x%02x%02x"' % ((c,) + tuple(v)) for c, v in sorted(RACE_PAL[r].items()))))
    out += ["};", "", "export const HERO_BASE: Record<string, Record<string, string[][]>> = {"]
    diffs = {}
    for r in RACE_NAME:
        base, _ = raw_frames(r, "poings")
        out.append("  %s: {" % r)
        for k, fs in base.items():
            out.append("    %s: [" % k)
            for g in fs:
                out.append("      [" + ", ".join('"%s"' % "".join(row) for row in g) + "],")
            out.append("    ],")
        out.append("  },")
        for w in WEAPONS:
            if w == "poings":
                continue
            fr, _ = raw_frames(r, w)
            for k, fs in fr.items():
                packed = []
                for g, b in zip(fs, base[k]):
                    packed.append("".join(hexa[x] + hexa[y] + g[y][x] for y in range(16) for x in range(16) if g[y][x] != b[y][x]))
                if any(packed):
                    diffs.setdefault(r, {}).setdefault(w, {})[k] = packed
    out += ["};", "", "export const HERO_WEAPON: Record<string, Record<string, Record<string, string[]>>> = {"]
    for r in RACE_NAME:
        out.append("  %s: {" % r)
        for w, per in diffs[r].items():
            out.append("    %s: {" % w)
            for k, packed in per.items():
                out.append("      %s: [%s]," % (k, ", ".join('"%s"' % p for p in packed)))
            out.append("    },")
        out.append("  },")
    out += ["};", ""]
    path = os.path.join(HERE, "..", "src", "render", "sprites", "heros.ts")
    open(path, "w", encoding="utf-8").write("\n".join(out))
    print(os.path.getsize(path), "octets")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        export()
    else:
        print(sheet_races(), sheet_equipment())
