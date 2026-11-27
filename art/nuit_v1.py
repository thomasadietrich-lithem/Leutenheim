"""Nuit du 27 au 28/11 (Thomas : « dessine, et implémente cette nuit ») : brief claude/BRIEF_SECTION4_ET_S3.md.

Section 3 (l'Ossuaire) :
  cimetière intérieur : tombeCroix, tombeDalle, tombeFraiche, tombeCreusee, pelleFichee, brouetteOs ; PNJ pelleCreuse
  salle d'embaumement : tableEmbaume, etagereBocaux, sarcoDebout, sarcoDeboutOuvert, sechoirBandelettes ; PNJ bandelette
  bal macabre        : orgueBal, pisteBal (dalle ronde, à plat)
Section 2 (la Champignonnière) :
  cuisine aux spores  : marmiteSpores0/1, etagereChampi, tableChampi ; PNJ boletus

  python3 art/nuit_v1.py          → art/nuit_v1.png
  python3 art/nuit_v1.py export   → src/render/sprites/nuit.ts
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up, hexrgb  # noqa: E402
from dortoir_v2 import Sprite, C  # noqa: E402
from export_jeu_v4 import write  # noqa: E402

C.update({k: hexrgb(v) + (255,) for k, v in {
    "st": "#8a8696", "st_d": "#5e5a6a", "st_l": "#b2aebe", "st_k": "#403c4a",
    "earth": "#5a4030", "earth_l": "#7a5a40", "earth_d": "#3a2818",
    "wood": "#8a5a30", "wood_d": "#5a3818", "wood_l": "#b07a44",
    "bone": "#e8e0c8", "bone_d": "#b4a888", "bone_k": "#786c56",
    "iron": "#a8b0bc", "iron_l": "#d8e0ea", "iron_d": "#6a7280",
    "cloth": "#e8dcb4", "cloth_d": "#b8a878", "cloth_k": "#8a7a54",
    "glass": "#9ab8d8", "glass_l": "#d8ecff", "glass_d": "#5a7898",
    "gold": "#e0b040", "gold_l": "#ffe27a", "gold_d": "#a87c1c",
    "blue": "#2a5a94", "blue_l": "#4a8fd0", "red": "#b02838", "red_d": "#7a1a24",
    "slime": "#6a9a3a", "slime_l": "#a8d060", "spore": "#b48ce0", "spore_d": "#7a5aa0",
    "skin": "#e0a878", "skin_d": "#b07848", "coat": "#3a3442", "coat_l": "#5a5466",
    "hat": "#4a3420", "hat_l": "#6a4a2a", "beard": "#b8b4ac", "eye": "#0c0a10", "glow": "#9fe0ff",
    "cap": "#c4343c", "cap_l": "#e86060", "cap_s": "#fff3c8", "stem": "#e8dcc0", "stem_d": "#b0a488",
    "toque": "#f4f0e4", "toque_d": "#cfc6ae", "soup": "#7aa040", "soup_l": "#b8e070",
    "flame": "#ffd84a", "flame_o": "#ff9a3a", "pipe": "#c8a050", "pipe_d": "#8a6a28",
    "floor": "#4a4458", "floor_l": "#6a6478", "shadow": "#00000050",
}.items()})


# ---------------- Cimetière intérieur ----------------

def tomb_cross():
    s = Sprite(16, 20)
    s.r(2, 17, 12, 2, "shadow")
    s.r(2, 13, 12, 5, "earth").r(3, 13, 10, 1, "earth_l").r(2, 17, 12, 1, "earth_d")
    s.r(7, 2, 3, 13, "st").r(4, 5, 9, 3, "st").r(7, 2, 1, 13, "st_l").r(4, 5, 9, 1, "st_l").r(9, 3, 1, 12, "st_d")
    s.p(8, 9, "st_d").p(7, 11, "st_d")
    return s.done()


def tomb_slab():
    s = Sprite(16, 18)
    s.r(2, 15, 12, 2, "shadow")
    s.r(3, 4, 10, 12, "st").r(4, 3, 8, 1, "st").r(5, 2, 6, 1, "st")
    s.r(3, 4, 1, 12, "st_l").r(4, 3, 1, 1, "st_l").r(5, 2, 6, 1, "st_l").r(12, 4, 1, 12, "st_d")
    # Une inscription effacée, un éclat.
    s.r(5, 7, 6, 1, "st_k").r(5, 9, 5, 1, "st_k").r(6, 11, 4, 1, "st_k").p(11, 6, "st_d").p(10, 5, "st_d")
    s.r(2, 15, 12, 1, "earth_d")
    return s.done()


def tomb_fresh(dug=False):
    s = Sprite(16, 14)
    s.r(1, 11, 14, 2, "shadow")
    if dug:
        # Fosse ouverte : un trou noir, la terre rejetée de côté.
        s.r(2, 5, 12, 7, "earth_d").r(3, 6, 10, 5, "eye").r(2, 4, 4, 2, "earth_l").r(11, 3, 4, 3, "earth").r(12, 3, 2, 1, "earth_l")
    else:
        s.r(2, 5, 12, 7, "earth").r(3, 4, 10, 2, "earth_l").r(2, 11, 12, 1, "earth_d")
        s.p(5, 6, "earth_d").p(9, 8, "earth_d").p(11, 6, "earth_d")
        # Une fleur fanée.
        s.r(7, 1, 1, 4, "slime").p(6, 1, "red").p(8, 1, "red").p(7, 0, "red")
    return s.done()


def shovel_planted():
    s = Sprite(16, 22)
    s.r(3, 19, 10, 2, "shadow")
    s.r(3, 16, 10, 4, "earth").r(4, 16, 8, 1, "earth_l")
    s.r(7, 1, 2, 13, "wood").r(7, 1, 1, 13, "wood_l").r(5, 0, 6, 2, "wood_d").r(6, 0, 4, 1, "wood")
    s.r(5, 12, 6, 6, "iron").r(5, 12, 6, 1, "iron_l").r(10, 13, 1, 5, "iron_d")
    return s.done()


def barrow():
    s = Sprite(32, 18)
    s.r(4, 15, 24, 2, "shadow")
    s.r(4, 6, 18, 8, "wood").r(4, 6, 18, 1, "wood_l").r(4, 13, 18, 1, "wood_d")
    s.r(22, 8, 8, 2, "wood_d").r(28, 9, 3, 1, "wood_d")
    s.r(5, 12, 2, 4, "wood_d").r(19, 11, 4, 5, "iron_d").r(20, 12, 2, 3, "iron")
    # Les os qui dépassent : crâne, fémurs.
    s.r(6, 2, 5, 5, "bone").r(7, 4, 1, 1, "eye").r(9, 4, 1, 1, "eye").r(6, 2, 5, 1, "bone_d")
    s.r(12, 3, 8, 2, "bone").r(11, 2, 2, 2, "bone").r(19, 2, 2, 2, "bone").r(12, 4, 8, 1, "bone_d")
    s.r(14, 5, 6, 2, "bone_d")
    return s.done()


def gravedigger(frame=0):
    """Pelle-Creuse : chapeau à large bord, barbe grise, manteau sombre, la pelle sur l'épaule."""
    s = Sprite(16, 18)
    bob = frame
    s.r(4, 16, 9, 2, "shadow")
    # Pelle sur l'épaule (derrière).
    s.r(11, 1 + bob, 1, 11, "wood").r(10, 0 + bob, 3, 3, "iron").r(10, 0 + bob, 3, 1, "iron_l")
    # Chapeau.
    s.r(3, 2 + bob, 10, 1, "hat").r(5, 0 + bob, 6, 2, "hat_l").r(5, 1 + bob, 6, 1, "hat")
    # Visage, barbe.
    s.r(5, 3 + bob, 6, 4, "skin").r(5, 3 + bob, 6, 1, "skin_d").p(6, 4 + bob, "eye").p(9, 4 + bob, "eye")
    s.r(5, 6 + bob, 6, 3, "beard").r(6, 9 + bob, 4, 1, "beard")
    # Manteau.
    s.r(4, 9, 8, 6, "coat").r(4, 9, 1, 6, "coat_l").r(7, 9, 1, 6, "coat_l")
    s.r(3, 10, 1, 4, "coat").r(12, 10, 1, 4, "coat").p(3, 14, "skin").p(12, 14, "skin")
    s.r(5, 15, 2, 2, "hat").r(9, 15, 2, 2, "hat")
    return s.done()


# ---------------- Salle d'embaumement ----------------

def embalm_table():
    s = Sprite(32, 20)
    s.r(2, 17, 28, 2, "shadow")
    s.r(2, 9, 28, 6, "st").r(2, 9, 28, 1, "st_l").r(2, 14, 28, 1, "st_d")
    s.r(3, 15, 3, 3, "st_d").r(26, 15, 3, 3, "st_d")
    # Le corps enveloppé de bandelettes.
    s.r(5, 4, 22, 6, "cloth").r(5, 4, 22, 1, "cloth_d")
    for x in range(7, 27, 3):
        s.r(x, 4, 1, 6, "cloth_k")
    s.r(4, 5, 4, 4, "cloth").r(4, 6, 1, 2, "cloth_d")
    # Un bocal et un pinceau posés au bout.
    s.r(27, 5, 3, 4, "glass").r(27, 5, 3, 1, "glass_l").r(27, 4, 3, 1, "gold")
    return s.done()


def jar_shelf():
    s = Sprite(32, 26)
    s.r(1, 2, 30, 22, "wood_d").r(2, 3, 28, 20, "wood")
    for y in (10, 17, 23):
        s.r(1, y, 30, 2, "wood_l").r(1, y + 1, 30, 1, "wood_d")
    jars = [("gold", 4), ("glass", 10), ("red", 16), ("slime", 22), ("glass", 26)]
    for i, (c, x) in enumerate(jars):
        y = 4 + (i % 2)
        s.r(x, y, 4, 6 - (i % 2), "glass").r(x, y + 2, 4, 4 - (i % 2), c).r(x, y, 4, 1, "glass_l").r(x, y - 1, 4, 1, "wood_d")
    # Rangée du bas : vases canopes (tête de chacal, de faucon).
    for x, c in ((5, "bone"), (13, "gold"), (21, "bone")):
        s.r(x, 13, 5, 4, c).r(x + 1, 11, 3, 2, c).r(x, 13, 5, 1, "bone_d").p(x + 1, 12, "eye")
    return s.done()


def sarcophagus_upright(open_=False):
    s = Sprite(16, 30)
    s.r(2, 27, 12, 2, "shadow")
    s.r(2, 2, 12, 26, "gold_d").r(3, 1, 10, 1, "gold_d")
    if open_:
        # Ouvert : l'intérieur noir, des bandelettes qui pendent.
        s.r(4, 3, 8, 23, "eye").r(6, 6, 1, 12, "cloth").r(9, 9, 1, 9, "cloth_d")
    else:
        s.r(3, 2, 10, 25, "gold").r(3, 2, 10, 1, "gold_l")
        # Le visage peint, les bras croisés, les bandes bleues.
        s.r(5, 4, 6, 6, "skin").p(6, 6, "eye").p(9, 6, "eye").r(6, 8, 4, 1, "skin_d")
        s.r(4, 3, 8, 1, "blue").r(4, 10, 8, 1, "blue")
        for y in (13, 17, 21, 25):
            s.r(3, y, 10, 1, "blue")
        s.r(5, 11, 6, 2, "red").r(4, 12, 1, 1, "gold_l").r(11, 12, 1, 1, "gold_l")
    return s.done()


def bandage_rack():
    s = Sprite(16, 24)
    s.r(2, 22, 12, 2, "shadow")
    s.r(2, 2, 1, 21, "wood").r(13, 2, 1, 21, "wood").r(1, 2, 14, 2, "wood_l").r(1, 3, 14, 1, "wood_d")
    for x, h in ((4, 14), (7, 10), (10, 16)):
        s.r(x, 4, 2, h, "cloth").r(x + 1, 4, 1, h, "cloth_d")
    s.r(2, 20, 12, 1, "wood_d")
    return s.done()


def mummy(frame=0):
    """Dame Bandelette : momie polie, bandelettes jaunies, yeux qui luisent, un collier d'or."""
    s = Sprite(16, 18)
    s.r(4, 16, 9, 2, "shadow")
    b = frame
    s.r(5, 1 + b, 6, 6, "cloth").r(5, 1 + b, 6, 1, "cloth_d").r(5, 3 + b, 6, 1, "cloth_k")
    s.p(6, 4 + b, "glow").p(9, 4 + b, "glow").r(5, 6 + b, 6, 1, "cloth_k")
    s.r(4, 8, 8, 1, "gold").r(5, 9, 6, 1, "gold_d")
    s.r(4, 9, 8, 7, "cloth").r(4, 11, 8, 1, "cloth_k").r(4, 14, 8, 1, "cloth_k").r(11, 9, 1, 7, "cloth_d")
    s.r(3, 10, 1, 5, "cloth").r(12, 10, 1, 5, "cloth").r(12, 14, 2, 1, "cloth_d")
    s.r(5, 16, 2, 1, "cloth_d").r(9, 16, 2, 1, "cloth_d")
    return s.done()


# ---------------- Bal macabre ----------------

def organ():
    s = Sprite(32, 30)
    s.r(2, 27, 28, 2, "shadow")
    s.r(2, 14, 28, 13, "wood_d").r(3, 15, 26, 11, "wood").r(3, 15, 26, 1, "wood_l")
    for i, x in enumerate(range(4, 29, 3)):
        h = 12 - abs(i - 4) * 2
        s.r(x, 14 - h, 2, h, "pipe").r(x, 14 - h, 1, h, "gold_l").r(x, 13 - h, 2, 1, "pipe_d")
    s.r(6, 19, 20, 3, "bone").r(6, 21, 20, 1, "bone_d")
    for x in range(7, 26, 2):
        s.r(x, 19, 1, 2, "eye")
    s.r(12, 23, 8, 2, "wood_d")
    return s.done()


def ball_floor():
    """Dalle ronde de la piste (à plat, 3 × 3 cases) : un cercle de pierre claire, une lune gravée au milieu."""
    s = Sprite(48, 48)
    cx, cy = 24, 24
    for y in range(48):
        for x in range(48):
            d = ((x - cx + 0.5) ** 2 + (y - cy + 0.5) ** 2) ** 0.5
            if d < 22:
                s.p(x, y, "floor_l" if d > 19 or (8 < d < 9.5) else "floor")
            if 13.5 < d < 14.5:
                s.p(x, y, "bone_k")
    s.r(22, 19, 5, 10, "bone_d").r(20, 21, 3, 6, "bone_d").r(21, 20, 1, 1, "bone_d")
    return s.done(outline=False)


# ---------------- Cuisine aux spores (section 2) ----------------

def spore_pot(frame=0):
    s = Sprite(16, 20)
    s.r(2, 17, 12, 2, "shadow")
    s.r(4, 16, 8, 2, "flame_o").r(6, 15 - frame, 4, 2, "flame")
    s.r(2, 8, 12, 8, "iron_d").r(2, 8, 12, 1, "iron").r(1, 8, 1, 3, "iron_d").r(14, 8, 1, 3, "iron_d")
    s.r(3, 6, 10, 3, "soup").r(4, 6, 4, 1, "soup_l")
    # Bulles et spores qui montent.
    s.p(5 + frame * 3, 5, "soup_l").p(9 - frame, 4, "soup_l")
    s.p(4 + frame, 2, "spore").p(10 - frame * 2, 1 + frame, "spore").p(7, 0 + frame, "spore_d")
    # La louche.
    s.r(11, 2, 1, 6, "wood_l").r(10, 1, 3, 1, "wood")
    return s.done()


def mushroom_shelf():
    s = Sprite(32, 24)
    s.r(1, 2, 30, 20, "wood_d").r(2, 3, 28, 18, "wood")
    for y in (10, 19):
        s.r(1, y, 30, 2, "wood_l").r(1, y + 1, 30, 1, "wood_d")
    for x, c in ((4, "cap"), (11, "blue_l"), (18, "gold"), (25, "cap")):
        s.r(x, 5, 4, 3, c).r(x + 1, 8, 2, 2, "stem").p(x + 1, 5, "cap_s")
    for x, c in ((6, "spore"), (15, "slime_l"), (23, "spore")):
        s.r(x, 13, 4, 6, "glass").r(x, 15, 4, 4, c).r(x, 13, 4, 1, "glass_l")
    return s.done()


def mushroom_table():
    s = Sprite(32, 18)
    s.r(2, 15, 28, 2, "shadow")
    s.r(2, 7, 28, 6, "wood").r(2, 7, 28, 1, "wood_l").r(2, 12, 28, 1, "wood_d")
    s.r(3, 13, 2, 3, "wood_d").r(27, 13, 2, 3, "wood_d")
    # Planche à découper, champignons tranchés, couteau.
    s.r(5, 4, 10, 4, "wood_l").r(6, 5, 2, 2, "cap").r(9, 5, 2, 2, "stem").r(12, 5, 2, 2, "cap")
    s.r(17, 5, 6, 1, "iron_l").r(23, 5, 2, 1, "wood_d")
    s.r(25, 3, 4, 4, "cap").r(26, 6, 2, 2, "stem").p(26, 3, "cap_s")
    return s.done()


def myconid_chef(frame=0):
    """Boletus : un Myconide au chapeau brun, une toque blanche posée dessus, la louche à la main."""
    s = Sprite(16, 20)
    b = frame
    s.r(4, 18, 9, 2, "shadow")
    s.r(5, 0 + b, 6, 3, "toque").r(4, 2 + b, 8, 1, "toque").r(5, 0 + b, 6, 1, "toque_d").r(5, 3 + b, 6, 1, "toque_d")
    s.r(2, 4 + b, 12, 4, "hat_l").r(3, 4 + b, 10, 1, "wood_l").p(4, 5 + b, "cap_s").p(11, 6 + b, "cap_s")
    s.r(5, 8, 6, 8, "stem").r(5, 8, 6, 1, "stem_d").p(6, 10, "eye").p(9, 10, "eye").r(7, 12, 2, 1, "stem_d")
    s.r(4, 13, 8, 3, "toque").r(4, 13, 8, 1, "toque_d")
    s.r(12, 9, 1, 7, "wood_l").r(11, 15, 3, 2, "iron")
    s.r(5, 16, 2, 2, "stem_d").r(9, 16, 2, 2, "stem_d")
    return s.done()


# ---------------- Section 4 : la Vespère (chauve-souris géante) ----------------

def vespere(frame=0):
    """Ailes hautes (0) ou basses (1) ; corps brun-violet, oreilles pointues, yeux rouges, crocs."""
    s = Sprite(20, 16)
    body, wing, wing_d = "spore_d", "coat_l", "coat"
    s.r(8, 5, 4, 7, body).r(8, 4, 1, 2, body).r(11, 4, 1, 2, body).p(9, 7, "red").p(10, 7, "red").p(9, 10, "bone").p(10, 10, "bone")
    if frame == 0:
        s.r(1, 2, 7, 2, wing).r(2, 4, 6, 2, wing).r(4, 6, 4, 2, wing_d).r(12, 2, 7, 2, wing).r(12, 4, 6, 2, wing).r(12, 6, 4, 2, wing_d)
        s.p(1, 1, wing_d).p(18, 1, wing_d)
    else:
        s.r(1, 8, 7, 2, wing).r(2, 6, 6, 2, wing).r(4, 10, 3, 2, wing_d).r(12, 8, 7, 2, wing).r(12, 6, 6, 2, wing).r(13, 10, 3, 2, wing_d)
        s.p(1, 10, wing_d).p(18, 10, wing_d)
    s.r(9, 12, 1, 2, body).r(10, 12, 1, 2, body)
    return s.done()


SPRITES = {
    "vespere0": vespere, "vespere1": lambda: vespere(1),
    "tombeCroix": tomb_cross, "tombeDalle": tomb_slab, "tombeFraiche": tomb_fresh, "tombeCreusee": lambda: tomb_fresh(True),
    "pelleFichee": shovel_planted, "brouetteOs": barrow,
    "pelleCreuse0": gravedigger, "pelleCreuse1": lambda: gravedigger(1),
    "tableEmbaume": embalm_table, "etagereBocaux": jar_shelf, "sarcoDebout": sarcophagus_upright,
    "sarcoDeboutOuvert": lambda: sarcophagus_upright(True), "sechoirBandelettes": bandage_rack,
    "bandelette0": mummy, "bandelette1": lambda: mummy(1),
    "orgueBal": organ, "pisteBal": ball_floor,
    "marmiteSpores0": spore_pot, "marmiteSpores1": lambda: spore_pot(1), "etagereChampi": mushroom_shelf,
    "tableChampi": mushroom_table, "boletus0": myconid_chef, "boletus1": lambda: myconid_chef(1),
}


def main():
    cols = 8
    W = 20 + 130 * cols
    rows = (len(SPRITES) + cols - 1) // cols
    sheet = Image.new("RGB", (W, 60 + rows * 240), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 22), "NUIT v1 — cimetière (Pelle-Creuse), embaumement (Dame Bandelette), bal macabre, cuisine aux spores (Boletus)", fill=(255, 243, 200), font=font(15), anchor="mm")
    for i, (name, fn) in enumerate(SPRITES.items()):
        im = up(fn().img(), 4)
        x = 20 + (i % cols) * 130
        y = 50 + (i // cols) * 240
        sheet.paste(im, (x, y), im)
        d.text((x + 60, y + 215), name, fill=(232, 212, 150), font=font(11), anchor="mm")
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "nuit_v1.png")
    sheet.save(out)
    print("art/nuit_v1.png", sheet.size)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
        write("src/render/sprites/nuit.ts", "NUIT",
              "Nuit du 27-28/11 (art/nuit_v1.png) : cimetière, embaumement, bal macabre (section 3), cuisine aux spores (section 2), et leurs PNJ.",
              {k: fn().img() for k, fn in SPRITES.items()})
    else:
        main()
