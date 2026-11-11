"""Objets v4 (Thomas, 2026-11-11) : à valider avant d'entrer en jeu.
- POTIONS : une seule fiole pour toutes (la ronde), seule la couleur change ;
- JAVELINE v2 : droite, nette, sans escalier de pixels (16 × 32, comme les autres armes longues) ;
- PICTOS « une main » / « deux mains », dans le coin des armes ;
- CASQUE DE CUIR (+1 CA) et CASQUE DE MAILLE (+2 CA, proposé) ;
- SAC D'ŒUFS ÉCRASÉ (trace au sol) ; AMARRES : fils tendus entre les colonnes et la grande toile.
Les icônes sont écrites en lignes de lettres avec la palette du jeu (`src/ui/icons.ts`), pour être recopiées telles quelles.
Écrit art/objets_v4.png. Lancer depuis la racine du dépôt.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from pix import font

SRC = open(os.path.join(os.path.dirname(__file__), "..", "src", "ui", "icons.ts")).read()
line = SRC[SRC.index("export const PALETTE"):]
line = line[:line.index("\n")]
PAL = {k: v for k, v in re.findall(r'"?([A-Za-z0-9])"?: "(#[0-9a-f]{6})"', line)}


def rows_of(name):
    i = SRC.index(f"  {name}: [")
    return re.findall(r'"([^"]+)"', SRC[i:SRC.index("],", i)])


def flask(liquid, light, dark):
    """La fiole ronde (celle de la jouvence) : bouchon, col, panse ronde ; `liquid`, `light`, `dark` = lettres de couleur."""
    t = [
        ".......KK.......",
        "......KbBK......",
        "......KBbK......",
        ".....KcSScK.....",
        ".....KKcSKK.....",
        "....KcSSSScK....",
        "...KcLLLLLLcK...",
        "..KcLWLLLLDDcK..",
        "..KcLWLLLDDDcK..",
        "..KcLLLLDDDddK..",
        "..KcLLLDDDddcK..",
        "...KcLDDDddcK...",
        "....KcDDddcK....",
        ".....KccccK.....",
        "......KKKK......",
        "................",
    ]
    return [r.replace("L", liquid).replace("D", light).replace("d", dark) for r in t]


POTIONS = {
    "potion_jouvence": flask("F", "G", "f"),
    "potion_poison": flask("A", "E", "e"),
    "potion_vitesse": flask("I", "U", "i"),
    "potion_feu": flask("X", "O", "x"),
}

JAVELINE = [
    "......KK........",
    ".....KWSK.......",
    ".....KWSK.......",
    "....KWSSDK......",
    "....KWSSDK......",
    "....KWSSDK......",
    ".....KSDK.......",
    ".....KCCK.......",
    "......KK........",
] + ["......KTtK......"[:16] if False else ".....KTtK......." for _ in range(8)] + [
    ".....KrrK.......",
    ".....K2rK.......",
    ".....Kr2K.......",
    ".....K2rK.......",
    ".....KrrK.......",
] + [".....KTtK......." for _ in range(7)] + [
    ".....KbbK.......",
    "......KK........",
    "................",
]
JAVELINE = JAVELINE[:32] + ["................"] * (32 - len(JAVELINE))

# Pictos de prise (8 × 8), posés dans le coin de la case de l'arme : un gantelet, ou deux.
PALM = [
    "..K.K.K..",
    ".KZKZKZK.",
    ".KZKZKZK.",
    "KKZZZZZK.",
    "KZKZZZZK.",
    ".KZZZZZK.",
    "..KZZZK..",
    "...KKK...",
]
ONE_HAND = PALM
TWO_HANDS = [a[::-1] + b for a, b in zip(PALM, PALM)]

CASQUE_CUIR = [
    "................",
    "......KKKK......",
    "....KKtBBtKK....",
    "...KtBBTTBBtK...",
    "..KtBTTBBBBBtK..",
    "..KBTBBBBBBBBK..",
    "..KBBKBBBBKBBK..",
    "..KbBBBBBBBBbK..",
    "..KbbtttttttbK..",
    "..KbKKKKKKKKbK..",
    "..KbK......KbK..",
    "..KbbK....KbbK..",
    "...KbK....KbK...",
    "...KKK....KKK...",
    "................",
    "................",
]

CASQUE_MAILLE = [
    "................",
    "......KKKK......",
    "....KKCSSCKK....",
    "...KCSDSDSSCK...",
    "..KCSDSDSDSDCK..",
    "..KSDSDSDSDSSK..",
    "..KDSKKKKKKSDK..",
    "..KSDK....KDSK..",
    "..KDSK....KSDK..",
    "..KSDK....KDSK..",
    "..KDSDK..KDSDK..",
    "..KSDSDKKDSDSK..",
    "..KDSDSDSDSDSK..",
    "...KCCCCCCCCK...",
    "....KKKKKKKK....",
    "................",
]


def render(rows, S=6, bg=(70, 61, 82)):
    w, h = len(rows[0]), len(rows)
    im = Image.new("RGB", (w * S, h * S), bg)
    d = ImageDraw.Draw(im)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ".":
                d.rectangle([x * S, y * S, x * S + S - 1, y * S + S - 1], fill=PAL[c])
    return im


EGG_PAL = {"g": (84, 120, 40, 255), "G": (130, 168, 60, 255), "s": (200, 192, 170, 255), "S": (236, 230, 210, 255), "k": (40, 36, 30, 255)}
EGG_ROWS = [
    "................",
    "................",
    "....gg....g.....",
    "...gGGg..gGg....",
    "..gGsSGgggGg....",
    "..gSSkSGGGg..g..",
    ".gGsS.sGsSGg.gg.",
    ".gGGgsSkSSsGgGg.",
    "..gGGGsSssGGGg..",
    "...ggGGGGgGGg...",
    "..g..gggggGg....",
    ".gg.....gGg.....",
    "........gg......",
    "................",
    "................",
    "................",
]


def egg_smash_img():
    """La trace, en vrai : 16 × 16, transparente (pour le jeu)."""
    im = Image.new("RGBA", (16, 16))
    for y, r in enumerate(EGG_ROWS):
        for x, c in enumerate(r):
            if c != ".":
                im.putpixel((x, y), EGG_PAL[c])
    return im


def egg_smash(S=6):
    """Sac d'œufs écrasé, plat (une case) : coquilles crevées, membrane affaissée, flaque verdâtre."""
    bg = Image.new("RGBA", (16, 16), (58, 52, 66, 255))
    bg.alpha_composite(egg_smash_img())
    return bg.convert("RGB").resize((16 * S, 16 * S), Image.NEAREST)


def threads(S=3):
    """Maquette : deux colonnes, la grande toile, les amarres tendues (fil épais, plus clair au milieu) ; à droite, une
    amarre tranchée : le fil pend, effiloché."""
    T = 16
    W, H = 12 * T, 7 * T
    im = Image.new("RGB", (W, H), (52, 48, 60))
    d = ImageDraw.Draw(im)
    for y in range(0, H, T):
        for x in range(0, W, T):
            d.rectangle([x, y, x + T - 1, y + T - 1], outline=(46, 42, 54))
    hub = (6 * T, 3.5 * T)
    for r in range(4, 22, 4):
        d.ellipse([hub[0] - r, hub[1] - r, hub[0] + r, hub[1] + r], outline=(200, 198, 190))
    for a in range(8):
        import math
        d.line([hub, (hub[0] + 22 * math.cos(a * math.pi / 4), hub[1] + 22 * math.sin(a * math.pi / 4))], fill=(210, 208, 200))
    pillars = [(1.5 * T, 1.5 * T), (10.5 * T, 1.5 * T), (1.5 * T, 5.5 * T)]
    for (px, py) in pillars:
        d.rectangle([px - 6, py - 6, px + 6, py + 6], fill=(110, 116, 148), outline=(18, 13, 8))
        d.rectangle([px - 7, py - 3, px + 7, py - 1], fill=(226, 222, 214))
        d.rectangle([px - 7, py + 2, px + 7, py + 3], fill=(226, 222, 214))
    for (px, py) in pillars[:2]:
        d.line([(px, py), hub], fill=(120, 116, 108), width=3)
        d.line([(px, py), hub], fill=(244, 240, 230), width=1)
    # Amarre tranchée : un bout pend de la colonne, l'autre de la toile.
    px, py = pillars[2]
    d.line([(px + 4, py), (px + 14, py - 3), (px + 18, py + 2)], fill=(200, 196, 186), width=2)
    d.line([(hub[0] - 20, hub[1] + 8), (hub[0] - 30, hub[1] + 14), (hub[0] - 33, hub[1] + 20)], fill=(200, 196, 186), width=2)
    return im.resize((W * S, H * S), Image.NEAREST)


def sheet():
    items = []
    old = [render(rows_of(k)) for k in POTIONS]
    new = [render(v) for v in POTIONS.values()]
    items.append(("POTIONS : avant", old))
    items.append(("POTIONS v4 : même fiole, couleurs : jouvence, poison, vitesse, feu", new))
    items.append(("JAVELINE : avant / v2", [render(rows_of("javeline")), render(JAVELINE, 4)]))
    items.append(("PRISE : une main / deux mains (coin de la case)", [render(ONE_HAND, 10), render(TWO_HANDS, 10)]))
    items.append(("CASQUE DE CUIR (+1 CA) / CASQUE DE MAILLE (+2 CA)", [render(CASQUE_CUIR), render(CASQUE_MAILLE)]))
    items.append(("SAC D'ŒUFS ÉCRASÉ (trace au sol)", [egg_smash()]))
    items.append(("AMARRES : fils tendus colonne → grande toile ; à droite en bas, coupée", [threads()]))
    pad = 16
    rows_h = [max(i.height for i in ims) + 40 for _, ims in items]
    W = max(sum(i.width for i in ims) + pad * (len(ims) + 1) for _, ims in items)
    W = max(W, 900)
    H = 60 + sum(rows_h)
    out = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(out)
    d.text((W // 2, 24), "OBJETS v4 — à valider", fill=(255, 243, 200), font=font(15), anchor="mm")
    y = 50
    for (label, ims), h in zip(items, rows_h):
        d.text((pad, y), label, fill=(220, 210, 190), font=font(12, False))
        x = pad
        for im in ims:
            out.paste(im, (x, y + 22))
            x += im.width + pad
        y += h
    out.save("art/objets_v4.png")
    print("art/objets_v4.png", out.size)


if __name__ == "__main__":
    sheet()
