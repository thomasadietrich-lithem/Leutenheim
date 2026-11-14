"""Planche « héros v9 » (Thomas, 2026-11-14 : « je te demande un design plus soigné de NOTRE héros ; il reste avec peu de
loot, et niveau 1 »). PROPOSITION. Remplace les v7 (variations fades) et v8 (hors sujet : seize autres personnages).

Seize façons de dessiner LE MÊME héros : l'Humain Guerrier du début de partie, niveau 1, avec son équipement de départ
et rien d'autre : tunique, ceinture, épée courte sobre (sans garde), arc court et carquois dans le dos, bottes. Chaque
proposition est un parti pris de dessin (coupe de la tunique, coiffure, carrure, pose, matières, couleurs sourdes),
dessinée plus finement : trois tons par matière, mains, visage, coutures, reflets.
Dessin à 32 × 32 (vue de face légèrement plongeante, grosse tête, contour sombre), puis à la taille du jeu.
  python3 art/heros_v9.py → art/heros_v9.png
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, outline_mask, up  # noqa: E402

S = 32
OUT = (24, 17, 22)


def k(c, f):
    return tuple(max(0, min(255, round(v * f))) for v in c[:3])


def ramp(c):
    """Trois tons d'une matière : ombre, base, lumière."""
    return k(c, 0.72), tuple(c), k(c, 1.2)


class Canvas:
    def __init__(self):
        self.a = np.zeros((S, S, 4), np.uint8)
        self.after = []  # pixels posés par-dessus le contour (rares)

    def px(self, x, y, c):
        if 0 <= x < S and 0 <= y < S and c is not None:
            self.a[y, x] = tuple(c[:3]) + (255,)

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.px(xx, yy, c)

    def line(self, x0, y0, x1, y1, c):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            self.px(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), c)

    def ell(self, cx, cy, rx, ry, c):
        for yy in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for xx in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 <= 1.0:
                    self.px(xx, yy, c)

    def body_rect(self, x, y, w, h, c, light_left=True):
        """Un volume : base, lumière sur le bord gauche et le haut, ombre à droite et en bas."""
        sh, base, li = ramp(c)
        self.rect(x, y, w, h, base)
        self.rect(x, y, 1, h, li)
        self.rect(x, y, w, 1, li)
        self.rect(x + w - 1, y, 1, h, sh)
        self.rect(x, y + h - 1, w, 1, sh)

    def outline(self):
        m = self.a[..., 3] > 0
        self.a[outline_mask(m)] = OUT + (255,)
        for x, y, c in self.after:
            self.px(x, y, c)

    def img(self):
        return Image.fromarray(self.a, "RGBA")


SKINS = {"clair": (236, 188, 146), "rosé": (242, 196, 168), "hâlé": (206, 150, 106), "brun": (156, 102, 66), "ébène": (104, 68, 48)}
HAIR = {"brun": (110, 66, 36), "châtain": (150, 98, 54), "noir": (44, 34, 40), "roux": (186, 82, 40), "blond": (220, 182, 96), "cendré": (170, 150, 120)}
BLADE = (198, 206, 218)
WOOD = (150, 100, 56)
LEATHER = (126, 80, 46)
STRING = (230, 222, 196)
FLETCH = (226, 226, 220)


def draw_back_gear(c, cfg):
    """Ce qui est derrière le corps : l'arc (courbe), le carquois et ses flèches."""
    side = cfg.get("quiver", "right")
    if side == "right":
        qx = 20
        c.rect(qx, 9, 3, 8, ramp(LEATHER)[0])
        c.rect(qx, 9, 3, 1, ramp(LEATHER)[2])
        for i, fx in enumerate((qx, qx + 1, qx + 2)):
            c.px(fx, 7 + (i % 2), FLETCH)
            c.px(fx, 8, (190, 70, 60) if i == 1 else FLETCH)
    else:
        qx = 9
        c.rect(qx, 9, 3, 8, ramp(LEATHER)[0])
        for i, fx in enumerate((qx, qx + 1, qx + 2)):
            c.px(fx, 7 + (i % 2), FLETCH)
    bow = cfg.get("bow", "left")
    if bow == "left":
        for y in range(8, 25):
            off = round(2.2 * (1 - ((y - 16) / 8.5) ** 2))
            c.px(7 - off, y, WOOD)
        c.line(7, 8, 7, 24, STRING)
    elif bow == "across":
        c.line(6, 22, 24, 7, WOOD)
        c.line(7, 23, 25, 8, k(WOOD, 0.8))


def draw_legs(c, cfg):
    pants = cfg["pants"]
    boots = cfg["boots"]
    sh, base, li = ramp(pants)
    top = cfg.get("hem", 23)
    stance = cfg.get("stance", 1)
    for lx in (12 - stance, 17 + stance - 1):
        c.rect(lx, top, 4, 30 - top, base)
        c.rect(lx, top, 1, 30 - top, li)
        c.rect(lx + 3, top, 1, 30 - top, sh)
    bsh, bbase, bli = ramp(boots)
    bh = cfg.get("boot_h", 3)
    for lx in (12 - stance, 17 + stance - 1):
        c.rect(lx - (1 if lx < 15 else 0), 30 - bh, 5, bh, bbase)
        c.rect(lx - (1 if lx < 15 else 0), 30 - bh, 5, 1, bli)
        c.rect(lx - (1 if lx < 15 else 0), 29, 5, 1, bsh)
        if cfg.get("cuffs"):
            c.rect(lx - (1 if lx < 15 else 0), 30 - bh, 5, 1, k(boots, 1.35))


def draw_torso(c, cfg):
    t = cfg["tunic"]
    sh, base, li = ramp(t)
    cut = cfg.get("cut", "classic")
    top, hem = 13, cfg.get("hem", 23)
    w0, w1 = (10, 21) if cfg.get("build") != "lean" else (11, 20)
    if cfg.get("build") == "stocky":
        w0, w1 = 9, 22
    c.rect(w0, top, w1 - w0 + 1, hem - top + 1, base)
    c.rect(w0, top, 2, hem - top + 1, li)
    c.rect(w1 - 1, top, 2, hem - top + 1, sh)
    # Bas de la tunique : jupe un peu évasée.
    c.rect(w0 - 1, hem - 2, w1 - w0 + 3, 3, base)
    c.rect(w0 - 1, hem, w1 - w0 + 3, 1, sh)
    if cut == "v":
        for i in range(4):
            c.rect(15 - i // 2, top + i, 2 + (i // 2) * 2 - 1, 1, cfg["skin"])
        c.line(14, top, 15, top + 3, k(t, 0.6))
    elif cut == "laced":
        c.rect(15, top, 1, 5, cfg["skin"])
        for y in range(top, top + 5, 2):
            c.px(14, y, STRING)
            c.px(16, y, STRING)
    elif cut == "hood":
        c.rect(w0, top - 1, w1 - w0 + 1, 2, k(t, 0.85))
        c.line(w0 + 1, top, w0 + 3, top + 2, k(t, 0.6))
        c.line(w1 - 1, top, w1 - 3, top + 2, k(t, 0.6))
    elif cut == "collar":
        c.rect(12, top, 7, 1, k(t, 1.3))
    elif cut == "vest":
        vest = cfg.get("vest", LEATHER)
        vsh, vb, vli = ramp(vest)
        c.rect(w0, top + 1, 4, hem - top - 3, vb)
        c.rect(w1 - 3, top + 1, 4, hem - top - 3, vb)
        c.rect(w0, top + 1, 1, hem - top - 3, vli)
        c.rect(w1, top + 1, 1, hem - top - 3, vsh)
    elif cut == "padded":
        for y in range(top + 2, hem, 2):
            c.rect(w0 + 1, y, w1 - w0 - 1, 1, k(t, 0.84))
    elif cut == "sash":
        c.line(w0, top + 1, w1, hem - 3, cfg.get("sash", (150, 50, 50)))
        c.line(w0, top + 2, w1, hem - 2, k(cfg.get("sash", (150, 50, 50)), 0.75))
    if cfg.get("patch"):
        px_, py_ = cfg["patch"]
        c.rect(px_, py_, 3, 3, k(t, 0.8) if t[0] < 200 else (190, 170, 130))
        c.px(px_, py_, k(t, 0.55))
        c.px(px_ + 2, py_ + 2, k(t, 0.55))
    # Ceinture.
    belt = cfg.get("belt", (90, 56, 34))
    by = cfg.get("belt_y", 19)
    c.rect(w0, by, w1 - w0 + 1, 2, belt)
    c.rect(w0, by, w1 - w0 + 1, 1, k(belt, 1.25))
    c.rect(14, by, 3, 2, cfg.get("buckle", (170, 160, 140)))
    c.px(15, by, belt)
    # Bandoulière du carquois.
    if cfg.get("strap", True):
        c.line(w0 + 1, top, w1 - 1, by - 1, k(LEATHER, 0.85))
    # Bras et mains.
    skin = cfg["skin"]
    ssh, sbase, sli = ramp(skin)
    sleeve = cfg.get("sleeve", "short")
    for side, ax in (("l", w0 - 3), ("r", w1 + 1)):
        arm_len = 8
        if sleeve == "long":
            c.rect(ax, top + 1, 3, arm_len - 1, base)
            c.rect(ax, top + 1, 1, arm_len - 1, li if side == "l" else base)
            c.rect(ax + 2, top + 1, 1, arm_len - 1, sh)
        elif sleeve == "short":
            c.rect(ax, top + 1, 3, 3, base)
            c.rect(ax, top + 4, 3, arm_len - 4, sbase)
            c.rect(ax + 2, top + 4, 1, arm_len - 4, ssh)
        else:  # sans manches
            c.rect(ax, top + 1, 3, arm_len - 1, sbase)
            c.rect(ax + 2, top + 1, 1, arm_len - 1, ssh)
        if cfg.get("bracers"):
            c.rect(ax, top + arm_len - 3, 3, 2, cfg.get("bracer_c", LEATHER))
        c.rect(ax, top + arm_len, 3, 2, sbase)  # main
        c.px(ax + 2, top + arm_len + 1, ssh)


def draw_sword(c, cfg):
    pose = cfg.get("pose", "down")
    hand_x = 23 if cfg.get("build") != "stocky" else 24
    if cfg.get("build") == "lean":
        hand_x = 22
    sh, base, li = ramp(BLADE)
    grip = cfg.get("grip", (96, 62, 38))
    if pose == "down":
        c.rect(hand_x, 22, 1, 2, grip)
        c.rect(hand_x, 24, 1, 6, base)
        c.rect(hand_x + 1, 24, 1, 5, sh)
        c.px(hand_x, 24, li)
    elif pose == "up":
        c.rect(hand_x, 21, 2, 2, grip)
        c.rect(hand_x, 12, 2, 9, base)
        c.rect(hand_x, 12, 1, 9, li)
        c.px(hand_x + 1, 11, base)
    elif pose == "shoulder":
        c.line(hand_x, 20, hand_x - 1, 21, grip)
        c.line(hand_x + 1, 19, hand_x + 6, 9, base)
        c.line(hand_x + 2, 19, hand_x + 7, 9, sh)
    elif pose == "sheath":
        c.rect(hand_x - 1, 20, 2, 2, grip)
        c.rect(hand_x - 1, 22, 2, 6, k(LEATHER, 0.8))
        c.px(hand_x - 1, 27, (170, 160, 140))
    elif pose == "guard":
        # En garde : la lame part vers le haut et l'extérieur, devant l'épaule.
        c.rect(hand_x, 20, 2, 2, grip)
        c.line(hand_x + 1, 19, hand_x + 5, 10, base)
        c.line(hand_x + 2, 19, hand_x + 6, 10, sh)
        c.px(hand_x + 5, 9, li)


def draw_head(c, cfg):
    skin = cfg["skin"]
    ssh, sbase, sli = ramp(skin)
    cx = 15.5
    hw = cfg.get("head_w", 6.2)
    c.ell(cx, 8.2, hw, 5.6, sbase)
    # Ombre sous la mâchoire et oreilles.
    c.rect(11, 12, 10, 1, ssh)
    c.px(9, 8, ssh)
    c.px(22, 8, ssh)
    c.px(9, 9, sbase)
    c.px(22, 9, sbase)
    # Cheveux.
    hair = cfg["hair"]
    hsh, hb, hli = ramp(hair)
    style = cfg.get("style", "short")
    if style == "short":
        c.ell(cx, 4.6, 6.6, 3.4, hb)
        c.rect(10, 4, 2, 4, hb)
        c.rect(20, 4, 2, 4, hb)
        c.rect(13, 6, 4, 1, hb)
        c.line(13, 3, 17, 3, hli)
    elif style == "mop":
        c.ell(cx, 4.8, 7.4, 4.0, hb)
        for x in (10, 12, 14, 17, 19, 21):
            c.px(x, 8, hb)
            c.px(x, 7, hb)
        c.line(12, 2, 18, 2, hli)
        c.px(11, 4, hli)
    elif style == "tail":
        c.ell(cx, 4.4, 6.6, 3.2, hb)
        c.rect(10, 4, 2, 3, hb)
        c.rect(20, 4, 2, 3, hb)
        c.rect(22, 5, 2, 6, hb)
        c.px(23, 11, hsh)
        c.rect(22, 5, 2, 1, (170, 60, 50))
        c.line(13, 2, 18, 2, hli)
    elif style == "cropped":
        c.ell(cx, 4.4, 6.0, 2.6, hb)
        c.line(12, 3, 19, 3, hli)
    elif style == "long":
        c.ell(cx, 4.6, 7.0, 3.6, hb)
        c.rect(9, 4, 3, 10, hb)
        c.rect(20, 4, 3, 10, hb)
        c.rect(9, 13, 3, 1, hsh)
        c.rect(20, 13, 3, 1, hsh)
        c.line(13, 2, 18, 2, hli)
    elif style == "braid":
        c.ell(cx, 4.4, 6.6, 3.2, hb)
        c.rect(10, 4, 2, 4, hb)
        c.rect(20, 4, 2, 4, hb)
        for y in range(9, 18, 2):
            c.px(21, y, hb)
            c.px(22, y + 1, hb)
        c.px(21, 18, (170, 60, 50))
        c.line(13, 2, 18, 2, hli)
    elif style == "hood":
        hood = cfg.get("hood_c", (110, 100, 80))
        c.ell(cx, 6.0, 7.6, 5.4, hood)
        c.ell(cx, 8.8, 5.2, 4.2, sbase)
        c.rect(12, 5, 7, 1, hb)
        c.line(11, 2, 17, 1, k(hood, 1.2))
    elif style == "bandana":
        c.ell(cx, 4.8, 6.6, 3.4, hb)
        c.rect(10, 4, 2, 4, hb)
        c.rect(20, 4, 2, 4, hb)
        band = cfg.get("band", (170, 60, 50))
        c.rect(9, 4, 14, 2, band)
        c.rect(9, 4, 14, 1, k(band, 1.25))
        c.rect(22, 5, 3, 1, band)
        c.px(24, 6, band)
    elif style == "bald":
        c.line(12, 3, 18, 3, sli)
        c.rect(9, 7, 1, 2, hb)
        c.rect(22, 7, 1, 2, hb)
    # Visage.
    ey = cfg.get("eye_y", 8)
    eye = cfg.get("eye", (40, 30, 40))
    c.rect(12, ey, 2, 2, eye)
    c.rect(18, ey, 2, 2, eye)
    c.px(12, ey, (250, 250, 250))
    c.px(18, ey, (250, 250, 250))
    if cfg.get("brows"):
        c.rect(12, ey - 2, 2, 1, hsh)
        c.rect(18, ey - 2, 2, 1, hsh)
    c.px(15, ey + 2, ssh)
    c.px(16, ey + 2, ssh)  # nez
    mouth = cfg.get("mouth", "line")
    if mouth == "line":
        c.rect(15, ey + 4, 2, 1, k(skin, 0.6))
    elif mouth == "smile":
        c.px(14, ey + 3, k(skin, 0.6))
        c.rect(15, ey + 4, 2, 1, k(skin, 0.6))
        c.px(17, ey + 3, k(skin, 0.6))
    if cfg.get("freckles"):
        for x in (12, 13, 18, 19):
            c.px(x, ey + 3, k(skin, 0.82))
    if cfg.get("blush"):
        c.px(11, ey + 3, (232, 140, 130))
        c.px(20, ey + 3, (232, 140, 130))
    if cfg.get("scar"):
        c.line(19, ey - 1, 20, ey + 3, k(skin, 0.7))
    if cfg.get("stubble"):
        c.rect(12, 11, 8, 2, k(skin, 0.86))
    if cfg.get("beard"):
        c.rect(11, 11, 10, 2, hb)
        c.rect(13, 13, 6, 1, hb)
        c.rect(15, ey + 4, 2, 1, k(skin, 0.6))
    if cfg.get("cape_collar"):
        cap = cfg["cape_collar"]
        c.rect(10, 13, 12, 2, cap)
        c.rect(10, 13, 12, 1, k(cap, 1.2))
        c.px(15, 14, (170, 160, 140))


def draw_cape(c, cfg):
    if not cfg.get("cape"):
        return
    cap = cfg["cape"]
    sh, base, li = ramp(cap)
    c.rect(9, 13, 14, cfg.get("cape_len", 12), sh)
    for x in range(9, 23, 3):
        c.px(x, 13 + cfg.get("cape_len", 12), sh)


def hero(cfg):
    c = Canvas()
    draw_cape(c, cfg)
    draw_back_gear(c, cfg)
    draw_legs(c, cfg)
    draw_torso(c, cfg)
    draw_head(c, cfg)
    draw_sword(c, cfg)
    c.outline()
    return c


BASE = dict(skin=SKINS["clair"], hair=HAIR["brun"], tunic=(232, 226, 210), pants=(96, 84, 74), boots=(106, 70, 44))

VARIANTS = [
    ("1. Le fils du meunier", "tunique écrue lacée, pièce au coude, épée basse",
     dict(cut="laced", patch=(18, 20), style="mop", hair=HAIR["châtain"], freckles=True)),
    ("2. L'apprenti garde", "gambison matelassé, cheveux courts, épée en garde",
     dict(cut="padded", tunic=(190, 176, 140), style="short", pose="guard", brows=True, bracers=True)),
    ("3. Le capuchon", "capuche de laine, manches longues, épée au fourreau",
     dict(style="hood", hood_c=(118, 104, 82), sleeve="long", tunic=(150, 140, 110), pose="sheath", hair=HAIR["noir"])),
    ("4. La queue-de-cheval", "tunique bleu passé, queue nouée de rouge, épée haute",
     dict(style="tail", tunic=(120, 140, 170), pose="up", skin=SKINS["hâlé"], hair=HAIR["noir"], cut="collar")),
    ("5. Le gilet de cuir", "gilet sur chemise, cheveux ébouriffés, épée sur l'épaule",
     dict(cut="vest", style="mop", pose="shoulder", hair=HAIR["roux"], freckles=True, sleeve="long")),
    ("6. Le bandeau rouge", "bandeau au front, sans manches, avant-bras bandés",
     dict(style="bandana", sleeve="none", bracers=True, bracer_c=(214, 206, 186), skin=SKINS["brun"], hair=HAIR["noir"], tunic=(200, 186, 150))),
    ("7. Le petit manteau", "courte cape verte au col, cheveux blonds, épée basse",
     dict(cape=(70, 110, 70), cape_collar=(80, 124, 80), style="short", hair=HAIR["blond"], cape_len=11, mouth="smile")),
    ("8. La tresse", "longue tresse, tunique ceinte d'une écharpe",
     dict(style="braid", cut="sash", sash=(160, 70, 60), skin=SKINS["rosé"], hair=HAIR["cendré"], blush=True)),
    ("9. Le balafré débutant", "une cicatrice déjà, mâchoire mal rasée",
     dict(scar=True, stubble=True, style="cropped", hair=HAIR["brun"], brows=True, tunic=(208, 196, 170), pose="guard")),
    ("10. Le costaud", "carrure large, cheveux ras, tunique brune",
     dict(build="stocky", style="cropped", tunic=(150, 116, 80), pants=(80, 70, 60), hair=HAIR["noir"], skin=SKINS["ébène"], brows=True)),
    ("11. L'efflanqué", "grand et maigre, cheveux longs, manches longues",
     dict(build="lean", style="long", sleeve="long", tunic=(176, 170, 150), hair=HAIR["brun"], pose="sheath")),
    ("12. Le col en V", "tunique blanche au col en V, bottes à revers",
     dict(cut="v", cuffs=True, style="short", hair=HAIR["châtain"], mouth="smile", boot_h=4)),
    ("13. Le jeune barbu", "barbe courte, tunique ocre, arc en travers",
     dict(beard=True, style="short", hair=HAIR["roux"], tunic=(200, 156, 90), bow="across", quiver="left")),
    ("14. Le capuchon gris", "capuche grise et cape longue, presque un pèlerin",
     dict(style="hood", hood_c=(120, 120, 128), cape=(96, 96, 104), cape_len=14, tunic=(170, 166, 156), pose="sheath", hair=HAIR["blond"])),
    ("15. La recrue rieuse", "joues rouges, cheveux en bataille, épée sur l'épaule",
     dict(style="mop", hair=HAIR["blond"], blush=True, mouth="smile", pose="shoulder", tunic=(226, 214, 180), cut="laced")),
    ("16. Le héros actuel, soigné", "la tunique blanche du jeu, en plus soigné",
     dict(cut="collar", style="short", hair=HAIR["brun"], brows=True)),
]


def main():
    cols, cw, ch = 4, 230, 285
    W = 40 + cols * cw
    rows = (len(VARIANTS) + cols - 1) // cols
    sheet = Image.new("RGB", (W, 90 + rows * ch), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 22), "NOTRE HÉROS, niveau 1 — 16 dessins plus soignés (même équipement de départ)", fill=(255, 243, 200), font=font(15), anchor="mm")
    d.text((W // 2, 44), "Tunique, ceinture, épée courte sans garde, arc court et carquois dans le dos, bottes. Rien d'autre.", fill=(200, 190, 170), font=font(11, False), anchor="mm")
    d.text((W // 2, 60), "Grand : 32 × 32 agrandi ×6 ; petit, en bas à droite : à la taille d'une case du jeu.", fill=(200, 190, 170), font=font(11, False), anchor="mm")
    for i, (name, sub, over) in enumerate(VARIANTS):
        cfg = dict(BASE)
        cfg.update(over)
        im = hero(cfg).img()
        x = 30 + (i % cols) * cw
        y = 80 + (i // cols) * ch
        big = up(im, 6)
        sheet.paste((70, 61, 82), (x, y, x + big.width, y + big.height))
        sheet.paste(big, (x, y), big)
        small = im.resize((21, 21), Image.NEAREST)
        tile = Image.new("RGBA", (24, 24), (60, 58, 72, 255))
        tile.alpha_composite(small, (1, 1))
        sheet.paste(up(tile, 2), (x + big.width - 48, y + big.height - 48))
        d.text((x, y + big.height + 8), name, fill=(255, 228, 160), font=font(13))
        words, lines_, cur = sub.split(), [], ""
        for w in words:
            if len(cur) + len(w) + 1 > 30:
                lines_.append(cur)
                cur = w
            else:
                cur = (cur + " " + w).strip()
        lines_.append(cur)
        for j, l in enumerate(lines_):
            d.text((x, y + big.height + 27 + j * 14), l, fill=(200, 190, 170), font=font(11, False))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "heros_v9.png")
    sheet.save(out)
    print("art/heros_v9.png", sheet.size)


if __name__ == "__main__":
    main()


def export_two():
    """La proposition n° 2 (l'apprenti garde) en pixels pour le jeu → src/render/sprites/heros_v9.ts (Thomas, 2026-11-14 :
    « implémente la 2, côte à côte avec le perso actuel »)."""
    import json
    cfg = dict(BASE)
    cfg.update(VARIANTS[1][2])
    im = hero(cfg).img()
    letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    pal, rows = {}, []
    for y in range(im.height):
        row = ""
        for x in range(im.width):
            r, g, b, a = im.getpixel((x, y))
            if a == 0:
                row += "."
                continue
            key = "#%02x%02x%02x" % (r, g, b)
            if key not in pal:
                pal[key] = letters[len(pal)]
            row += pal[key]
        rows.append(row)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "render", "sprites", "heros_v9.ts")
    lines = ["// FICHIER GÉNÉRÉ par art/heros_v9.py (export_two) : ne pas modifier à la main.",
             "/** Proposition n° 2 de la planche héros v9 (l'apprenti garde), 32 × 32, de face : montrée à côté du héros actuel. */",
             "export const HEROS_V9_TWO = { palette: " + json.dumps({v: k for k, v in pal.items()}) + ", rows: ["]
    lines += ['  "%s",' % r for r in rows]
    lines.append("] };")
    open(out, "w").write("\n".join(lines) + "\n")
    print("src/render/sprites/heros_v9.ts", len(pal), "couleurs")
