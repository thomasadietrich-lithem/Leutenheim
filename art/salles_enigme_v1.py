"""Salles à énigme v1 (Thomas, 2026-11-21 : « un nouveau type de salle spéciale : les salles interactives ») :
PROPOSITION à valider, rien en jeu.

Chaque salle : une énigme simple qui se résout avec un objet posé à coup sûr sur l'étage, une CLEF D'ARGENT à aller
chercher et un COFFRE D'ARGENT. Huit salles : tir, rebond, racines, glisse (idées de Thomas), balance, salle noire,
gardiens (idées de Claude retenues ; la poulie est retirée). Les murs et le sol suivent la section ; ici, la section 1.

    python3 art/salles_enigme_v1.py          → art/salles_enigme_v1.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

from dortoir_v2 import Sprite, C  # noqa: E402
from murs_v3 import render as render_walls, T  # noqa: E402
from pix import hexrgb  # noqa: E402

C.update({k: hexrgb(v) + (255,) for k, v in {
    "straw": "#d8c8a0", "straw_d": "#a08c64", "straw_l": "#ece2c4",
    "tw": "#f2efe6", "tr": "#c8323c", "tr_d": "#86202a", "tb": "#3a78c8", "tb_d": "#245090",
    "iron": "#3a3a44", "iron_d": "#22222a", "iron_l": "#6a6a78", "black": "#1c1a22", "black_l": "#4a4658",
    "silver": "#c8d0dc", "silver_d": "#8a94a6", "silver_l": "#f2f6fc", "silver_k": "#5e6678",
    "root": "#6a4424", "root_d": "#3e2612", "root_l": "#94643a", "root_t": "#8aa04a",
    "stone": "#8a8696", "stone_d": "#5e5a6a", "stone_l": "#b2aebe", "eye": "#ffe27a", "eye_c": "#fff6c8",
    "rope": "#c8a46a", "rope_d": "#8a6a3a", "pit": "#0c0a10", "pit_e": "#3a3442",
    "chalk": "#e8e2d0", "shadow": "#00000050", "arrow": "#9a6a34", "fl": "#f4f7ff",
}.items()})


def target(blue=False, arrows=0):
    """Cible de paille ronde sur son chevalet de bois (16 × 22 : elle dépasse de 6 pixels vers le haut)."""
    s = Sprite(16, 22)
    s.r(3, 19, 10, 2, "shadow")
    s.r(2, 12, 2, 9, "wood_d").r(12, 12, 2, 9, "wood_d").r(7, 14, 2, 7, "wood")
    ring, dark = ("tb", "tb_d") if blue else ("tr", "tr_d")
    # disque de 14 : anneaux paille / couleur / blanc / couleur / blanc
    for y in range(14):
        for x in range(14):
            d = ((x - 6.5) ** 2 + (y - 6.5) ** 2) ** 0.5
            if d > 6.9:
                continue
            c = "straw" if d > 6 else ring if d > 4.6 else "tw" if d > 3.3 else ring if d > 1.9 else "tw" if d > 0.9 else dark
            if c == ring and x + y > 15:
                c = dark
            s.p(1 + x, y, c)
    s.r(2, 0, 4, 1, "straw_l")
    for k in range(arrows):
        ax, ay = (5, 5) if k == 0 else (9, 8)
        s.r(ax, ay, 1, 1, "iron_d").r(ax + 1, ay + 1, 3, 1, "arrow").r(ax + 4, ay + 1, 2, 1, "fl")
    return s.done()


def deflector(slash=True):
    """Cible noire de rebond, tournée de 45° vers la salle (16 × 22). `slash` : posée contre le mur de DROITE, sa face
    regarde vers la gauche et le joueur ; sinon contre le mur de GAUCHE, face vers la droite. On voit la face annelée
    (noir, gris, cœur d'argent) en ovale, et l'épaisseur du dos, côté mur."""
    s = Sprite(16, 22)
    s.r(4, 19, 8, 2, "shadow").r(7, 13, 2, 7, "iron_d").r(5, 19, 6, 1, "iron")
    back = 1 if slash else -1  # le dos dépasse du côté du mur
    for y in range(15):
        for x in range(16):
            u, v = (x - 7.5), (y - 7)
            d = ((u + 1.2 * back) / 4.2) ** 2 + (v / 7.0) ** 2
            db = ((u - 2.0 * back) / 4.2) ** 2 + (v / 6.6) ** 2
            if d <= 1:
                c = "silver" if d > 0.8 else "black" if d > 0.52 else "black_l" if d > 0.3 else "black" if d > 0.1 else "silver_l"
                s.p(x, y, c)
            elif db <= 1:
                s.p(x, y, "wood_l" if db > 0.75 else "wood")
    return s.done()


def chest(open_=False):
    """Coffre d'argent (16 × 16) : bois sombre cerclé d'argent, serrure en forme de clef."""
    s = Sprite(16, 16)
    s.r(2, 14, 12, 2, "shadow")
    if open_:
        s.r(1, 1, 14, 5, "silver_d").r(2, 2, 12, 3, "black")
        s.r(1, 6, 14, 8, "wood_d").r(2, 7, 12, 2, "black").r(5, 7, 6, 1, "eye")
    else:
        s.r(1, 2, 14, 5, "wood").r(1, 2, 14, 1, "wood_h").r(1, 7, 14, 7, "wood_d")
    for x in (1, 7, 14):
        s.r(x, 2 if not open_ else 6, 1, 12 if not open_ else 8, "silver")
    s.r(1, 7, 14, 1, "silver_l").r(1, 13, 14, 1, "silver_d")
    if not open_:
        s.r(6, 6, 4, 4, "silver").r(7, 7, 2, 1, "silver_k").r(7, 8, 1, 1, "silver_k")
    return s.done()


def key():
    """Clef d'argent au sol (16 × 16, petite, au milieu)."""
    s = Sprite(16, 16)
    s.r(4, 7, 3, 3, "silver").p(5, 8, "black").r(7, 8, 6, 1, "silver").r(11, 9, 1, 2, "silver").r(9, 9, 1, 1, "silver")
    s.p(4, 7, "silver_l")
    return s.done()


def fence():
    """Barrière basse de bois (une case) qui coupe la salle de tir."""
    s = Sprite(16, 16)
    s.r(0, 5, 16, 2, "wood_l").r(0, 9, 16, 2, "wood").r(1, 3, 2, 10, "wood_d").r(13, 3, 2, 10, "wood_d")
    s.r(0, 5, 16, 1, "wood_h")
    return s.done()


def roots(glow=None):
    """Mur de racines tressées (16 × 20) qui bouche une alcôve ; il brûle. `glow` : bouts lumineux (section 2)."""
    s = Sprite(16, 20)
    rng = np.random.default_rng(5)
    for k in range(9):
        x0 = int(rng.integers(0, 14))
        for y in range(20):
            x = int(x0 + 2.5 * np.sin(y * 0.45 + k))
            if 0 <= x < 15:
                s.r(x, y, 2, 1, "root" if (y + k) % 4 else "root_l")
                s.p(min(15, x + 2), y, "root_d")
    for (x, y) in ((3, 3), (11, 6), (6, 12), (13, 15), (2, 17)):
        s.p(x, y, glow or "root_t")
    return s.done()


def gate(up=False):
    """Herse de fer (16 × 20) : baissée elle bloque ; levée, on ne voit que ses pointes en haut."""
    s = Sprite(16, 20)
    h = 5 if up else 18
    for x in (1, 5, 9, 13):
        s.r(x, 0, 2, h, "iron").p(x, 0, "iron_l")
    s.r(0, 2, 16, 2, "iron_d")
    if not up:
        s.r(0, 11, 16, 2, "iron_d")
        for x in (1, 5, 9, 13):
            s.p(x, h, "iron_l").p(x + 1, h, "iron_l")
    return s.done()


def plate():
    """Grande dalle de la balance (32 × 32) : pierre claire, une empreinte de pied de géant gravée."""
    s = Sprite(32, 32)
    s.r(1, 1, 30, 30, "stone").r(1, 1, 30, 1, "stone_l").r(1, 1, 1, 30, "stone_l").r(1, 30, 30, 1, "stone_d").r(30, 1, 1, 30, "stone_d")
    s.r(10, 8, 12, 16, "stone_d").r(11, 9, 10, 14, "stone").r(12, 10, 8, 12, "stone_d")
    for i, x in enumerate((9, 13, 17, 21)):
        s.r(x, 3 + (i % 2), 3, 4, "stone_d")
    return s.done(False)


def guardian():
    """Statue gardienne (16 × 26) : un moine de pierre encapuchonné, deux yeux qui brillent."""
    s = Sprite(16, 26)
    s.r(2, 23, 12, 2, "shadow").r(2, 20, 12, 4, "stone_d").r(2, 20, 12, 1, "stone_l")
    s.r(4, 6, 8, 14, "stone").r(4, 6, 1, 14, "stone_l").r(11, 6, 1, 14, "stone_d")
    s.r(4, 1, 8, 7, "stone").r(5, 0, 6, 2, "stone_l").r(5, 3, 6, 4, "stone_d")
    s.p(6, 4, "eye").p(9, 4, "eye").p(6, 5, "eye_c").p(9, 5, "eye_c")
    s.r(6, 12, 4, 6, "stone_d")
    return s.done()


def pulley():
    """Poulie au plafond (16 × 30) : roue de bois, corde, la clef d'argent qui pend au bout."""
    s = Sprite(16, 30)
    s.r(4, 0, 8, 6, "wood_d").r(5, 1, 6, 4, "wood").r(7, 2, 2, 2, "iron")
    s.r(7, 5, 1, 18, "rope").r(8, 6, 1, 17, "rope_d")
    s.r(5, 23, 5, 4, "silver").p(7, 24, "black").r(7, 27, 1, 3, "silver").p(8, 28, "silver")
    return s.done()


def cleat():
    """Taquet au mur où la corde est nouée (on tire dedans pour la couper)."""
    s = Sprite(16, 16)
    s.r(5, 3, 6, 3, "wood").r(7, 2, 2, 6, "wood_d").r(6, 6, 4, 3, "rope").r(7, 9, 2, 3, "rope_d")
    return s.done()


def pit():
    """Trou d'une case : bord de pierre, noir au fond."""
    s = Sprite(16, 16)
    s.r(0, 0, 16, 16, "pit_e").r(1, 2, 14, 13, "pit").r(1, 1, 14, 1, "stone_d")
    return s.done(False)


SPR = {
    "T": target(), "Tb": target(True), "Ta": target(arrows=2), "/": deflector(True), "\\": deflector(False),
    "C": chest(), "Co": chest(True), "K": key(), "F": fence(), "R": roots(), "G": gate(), "Gu": gate(True),
    "P": plate(), "S": guardian(), "Y": pulley(), "Q": cleat(), "O": pit(),
}


def water(img, cells, frozen=False):
    """Eau profonde (impossible à traverser), ou la même gelée."""
    px = img.load()
    for (cx, cy) in cells:
        for j in range(T):
            for i in range(T):
                X, Y = cx * T + i, cy * T + j
                if frozen:
                    c = (205, 236, 255)
                    if (i - j + cx * 5) % 11 == 0 and 3 < i < 13:
                        c = (255, 255, 255)
                else:
                    c = (22, 34, 66)
                    if (i * 3 + j * 7 + cx * 11 + cy * 5) % 23 == 0:
                        c = (44, 70, 120)
                    if (cx, cy - 1) not in cells and j < 2:
                        c = (70, 110, 170)
                px[X, Y] = c


def lanes(d, x0, y0, x1, y1, cols, scale):
    """Pistes de tir à la craie : un trait entre deux pistes, la ligne de tir en bas."""
    for c in cols:
        for y in range(y0, y1):
            d.rectangle([(c * T + 7) * scale, (y * T) * scale, (c * T + 8) * scale - 1, (y * T + 15) * scale - 1], fill=(222, 214, 192))
    d.rectangle([(x0 * T) * scale, (y1 * T + 7) * scale, (x1 * T) * scale - 1, (y1 * T + 8) * scale - 1], fill=(240, 232, 210))


ROOMS = [
    ("1. Salle de tir", "Flèche de recul dans la cible BLEUE : elle recule et ouvre le fond (clef, coffre).", [
        "###########",
        "#.........#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#####D#####",
    ], {(5, 1): "C", (3, 1): "K", (1, 3): "T", (2, 3): "F", (3, 3): "Ta", (4, 3): "F", (5, 3): "Tb", (6, 3): "F", (7, 3): "T", (8, 3): "F", (9, 3): "T"},
     dict(lanes=((1, 4, 10, 6), (2, 4, 6, 8)))),
    ("2. Salle de rebond", "Salle en long, une cible noire une rangée sur deux, en alternant gauche et droite. Flèche ricochante tirée de la ligne de tir : elle rebondit en zigzag sur les 3 cibles, la clef apparaît au fond.", [
        "#########",
        "#.......#",
        "#.......#",
        "#.......#",
        "#.......#",
        "#.......#",
        "#.......#",
        "#.......#",
        "#.......#",
        "#.......#",
        "####D####",
    ], {(4, 1): "C", (2, 1): "K", (1, 3): "\\", (7, 5): "/", (1, 7): "\\"},
     dict(path=[(4, 9), (1.6, 7.2), (6.4, 5.2), (1.6, 3.2), (2, 1.8)], lanes=((1, 9, 8, 8), ()))),
    ("3. Salle des racines", "Une seule haie de racines d'un bout à l'autre : une torche ou une potion de feu suffit, le feu court d'une racine à l'autre et ouvre les deux alcôves.", [
        "###########",
        "##...#...##",
        "##...#...##",
        "#.........#",
        "#.........#",
        "#.........#",
        "#####D#####",
    ], {(3, 1): "C", (7, 1): "K", (1, 3): "R", (2, 3): "R", (3, 3): "R", (4, 3): "R", (5, 3): "R", (6, 3): "R", (7, 3): "R", (8, 3): "R", (9, 3): "R"}, {}),
    ("4. Salle de glisse", "Eau profonde : on ne passe pas. Potion de gel : on glisse jusqu'à l'autre rive.", [
        "###########",
        "#.........#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#####D#####",
    ], {(5, 1): "C", (2, 1): "K"}, dict(water=[(x, y) for x in range(1, 10) for y in (3, 4)], ice=[(5, 3), (5, 4), (4, 3), (4, 4), (6, 3), (6, 4)])),
    ("5. Salle de la balance", "Potion de géant bue sur la grande dalle : la herse se lève sur la clef.", [
        "###########",
        "####...####",
        "#.........#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#####D#####",
    ], {(5, 1): "K", (5, 2): "G", (2, 2): "C"}, dict(plate=(4, 3))),
    ("6. Salle noire", "Aucune lumière, des pièges cachés partout. Torche allumée : les dalles sûres se voient.", [
        "###########",
        "#.........#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#####D#####",
    ], {(5, 1): "C", (8, 2): "K"}, dict(dark=True)),
    ("7. Salle des gardiens", "Une dalle vue par un œil fait tomber la herse. Dans le brouillard, ils ne voient plus.", [
        "###########",
        "####...####",
        "#.........#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#.........#",
        "#####D#####",
    ], {(5, 1): "K", (5, 2): "Gu", (8, 1): "C", (1, 3): "S", (9, 5): "S"}, dict(gaze=[(3, (2, 9)), (5, (1, 8))])),
]


def room(plan, items, extra, scale=3):
    base = render_walls(plan)
    if extra.get("water"):
        water(base, set(extra["water"]))
    if extra.get("pits"):
        for (x, y) in extra["pits"]:
            base.paste(SPR["O"].img(), (x * T, y * T), SPR["O"].img())
    if extra.get("plate"):
        x, y = extra["plate"]
        base.paste(SPR["P"].img(), (x * T, y * T), SPR["P"].img())
    img = base.convert("RGBA")
    big = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    d = ImageDraw.Draw(big)
    if extra.get("lanes"):
        (x0, y0, x1, y1), cols = extra["lanes"]
        lanes(d, x0, y0, x1, y1, cols, scale)
    if extra.get("gaze"):
        for (row, (a, b)) in extra["gaze"]:
            ov = Image.new("RGBA", big.size, (0, 0, 0, 0))
            ImageDraw.Draw(ov).rectangle([a * T * scale, row * T * scale, b * T * scale + T * scale - 1, row * T * scale + T * scale - 1], fill=(255, 226, 122, 60))
            big = Image.alpha_composite(big, ov)
            d = ImageDraw.Draw(big)
    # objets, de haut en bas (ce qui est plus bas passe devant)
    for (x, y), k in sorted(items.items(), key=lambda kv: kv[0][1]):
        im = SPR[k].img()
        im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
        big.alpha_composite(im, (x * T * scale + (T * scale - im.width) // 2, (y + 1) * T * scale - im.height))
    if extra.get("path"):
        pts = [(int((x + 0.5) * T * scale), int((y + 0.5) * T * scale)) for x, y in extra["path"]]
        for a, b in zip(pts, pts[1:]):
            n = int(max(abs(b[0] - a[0]), abs(b[1] - a[1])) / 10)
            for i in range(0, n, 2):
                t = i / max(1, n)
                x, y = a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t
                d.rectangle([x - 3, y - 3, x + 2, y + 2], fill=(255, 226, 122))
    if extra.get("rope"):
        (ax, ay), (bx, by) = extra["rope"]
        d.line([(ax * T * scale, ay * T * scale), (bx * T * scale, by * T * scale)], fill=(200, 164, 106), width=scale)
    if extra.get("dark"):
        # deux moitiés : à gauche sans torche, à droite avec la torche (dalles sûres marquées d'une croix de craie)
        w = big.width // 2
        dark = Image.new("RGBA", (w, big.height), (6, 5, 9, 238))
        big.alpha_composite(dark, (0, 0))
        safe = [(5, 5), (5, 4), (6, 4), (7, 3), (8, 3), (8, 2), (7, 2), (6, 2), (5, 2)]
        for (x, y) in [c for c in safe if c != (8, 2)]:
            if x * T * scale >= w:
                cx, cy = int((x + 0.5) * T * scale), int((y + 0.5) * T * scale)
                d = ImageDraw.Draw(big)
                d.line([(cx - 9, cy - 9), (cx + 9, cy + 9)], fill=(232, 226, 208), width=3)
                d.line([(cx - 9, cy + 9), (cx + 9, cy - 9)], fill=(232, 226, 208), width=3)
        for (x, y) in [(6, 5), (7, 4), (9, 4), (9, 2)]:
            cx, cy = int((x + 0.5) * T * scale), int((y + 0.5) * T * scale)
            d.rectangle([cx - 18, cy - 18, cx + 18, cy + 18], outline=(220, 60, 60), width=3)
    return big


def ice_room(plan, items, extra, scale=3):
    """La salle de glisse une fois l'eau gelée (glace au milieu, le trajet du héros)."""
    base = render_walls(plan)
    cells = set(extra["water"])
    water(base, cells - set(extra["ice"]))
    water(base, set(extra["ice"]), frozen=True)
    img = base.convert("RGBA")
    big = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    for (x, y), k in sorted(items.items(), key=lambda kv: kv[0][1]):
        im = SPR[k].img().resize((SPR[k].img().width * scale, SPR[k].img().height * scale), Image.NEAREST)
        big.alpha_composite(im, (x * T * scale + (T * scale - im.width) // 2, (y + 1) * T * scale - im.height))
    d = ImageDraw.Draw(big)
    for y in (5.5, 4.5, 3.5, 2.5):
        cx, cy = int(5.5 * T * scale), int(y * T * scale)
        d.rectangle([cx - 3, cy - 3, cx + 2, cy + 2], fill=(255, 226, 122))
    return big


def strip(scale=4):
    """Les nouveaux éléments, seuls, et leurs couleurs selon la section."""
    names = [("Cible", "T"), ("Cible bleue", "Tb"), ("Flèches plantées", "Ta"), ("Noire, à droite", "/"), ("Noire, à gauche", "\\"),
             ("Coffre d'argent", "C"), ("Ouvert", "Co"), ("Clef d'argent", "K"), ("Racines", "R"), ("Herse", "G"),
             ("Herse levée", "Gu"), ("Gardien", "S")]
    ims = [(n, SPR[k].img()) for n, k in names]
    # variantes de section des racines : S2 bouts lumineux, S3 racines pâles comme des os
    C.update({"root": hexrgb("#d8d0b8") + (255,), "root_l": hexrgb("#f0ead8") + (255,), "root_d": hexrgb("#8a8270") + (255,)})
    s3 = roots("silver_l").img()
    C.update({"root": hexrgb("#6a4424") + (255,), "root_l": hexrgb("#94643a") + (255,), "root_d": hexrgb("#3e2612") + (255,)})
    ims += [("Racines S2", roots(hexrgb("#7ae0ff") + (255,)).img()), ("Racines S3", s3)]
    return ims


def main():
    scale = 3
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    sm = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    tiles = []
    for title, note, plan, items, extra in ROOMS:
        tiles.append((title, note, room(plan, items, extra, scale)))
        if extra.get("ice"):
            tiles.append(("4 bis. Glisse, eau gelée", "Le héros glisse tout droit et tombe sur l'autre rive.", ice_room(plan, items, extra, scale)))
    cols = 3
    pad = 26
    cw = max(t[2].width for t in tiles) + pad
    rh = max(t[2].height for t in tiles) + 110
    rows = (len(tiles) + cols - 1) // cols
    st = strip()
    sh = 2 * (4 * max(i.height for _, i in st) + 40) + 40
    W = cols * cw + pad
    H = 60 + rows * rh + sh + 40
    out = Image.new("RGB", (W, H), (24, 20, 28))
    d = ImageDraw.Draw(out)
    d.text((pad, 16), "Salles à énigme v1 — clef d'argent et coffre d'argent (section 1 ; murs et sol suivent la section)", font=f, fill=(240, 220, 170))
    for i, (title, note, im) in enumerate(tiles):
        x = pad + (i % cols) * cw
        y = 60 + (i // cols) * rh
        d.text((x, y), title, font=f, fill=(240, 220, 170))
        words, line, ly = note.split(), "", y + 26
        for w_ in words:
            if d.textlength(line + " " + w_, font=sm) > cw - pad:
                d.text((x, ly), line, font=sm, fill=(210, 200, 180))
                line, ly = w_, ly + 19
            else:
                line = (line + " " + w_).strip()
        d.text((x, ly), line, font=sm, fill=(210, 200, 180))
        out.paste(im, (x, y + 92), im)
    y = 60 + rows * rh + 10
    d.text((pad, y), "Éléments nouveaux (×4) et racines selon la section", font=f, fill=(240, 220, 170))
    x = pad
    y += 36
    for n, im in st:
        big = im.resize((im.width * 4, im.height * 4), Image.NEAREST)
        if x + big.width > W - pad:
            x = pad
            y += 4 * 30 + 40
        out.paste(big, (x, y), big)
        d.text((x, y + big.height + 4), n, font=sm, fill=(210, 200, 180))
        x += max(big.width, 120) + 18
    out.save("art/salles_enigme_v1.png")
    print(out.size)


if __name__ == "__main__":
    main()
