"""Deux nouvelles salles à thème, v1 (Thomas, 2026-11-11).

SALLE DE PRIÈRE : 2 à 6 bancs, dont 0 à 3 cassés, avec une allée au milieu ; un autel de prière avec un livre ; un tapis
rouge de velours, déchiré et taché, sur l'allée ; 2 vitraux abîmés dans le mur du fond ; 0 à 2 candélabres de 0 à 3
bougies ; un coffre derrière le pupitre.

SALLE DE TORTURE : une table à chaînes ensanglantée ; 1 à 2 râteliers d'outils rouillés et sanglants ; dalles sombres et
rigole ensanglantée ; 0 à 1 planche au mur pour immobiliser une victime ; 0 à 2 sarcophages à pointes (désamorcer ou
forcer ; un squelette dedans, ou une pointe qui part : -1d4 ; du butin) ; 0 à 2 cordes à crochet pendues au mur du fond.

Même vue de 3/4 que le dortoir validé, même contour, même palette. Écrit art/priere_v1.png et art/torture_v1.png.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from pix import hash2, hexrgb, grid, to_img, fbm
from dortoir_v2 import Sprite, C, T, walls
from sols_v1 import floor_b
from trainards_v2 import skeleton
from escaliers_coffres import SPRITES as CHEST_ROWS, PAL as CHEST_PAL
from planche import planche

C.update({
    "oak_d": (52, 32, 16, 255), "oak": (86, 56, 28, 255), "oak_l": (112, 76, 40, 255), "oak_h": (138, 98, 56, 255),
    "vel": (150, 24, 34, 255), "vel_d": (96, 14, 24, 255), "vel_l": (196, 52, 60, 255), "fringe": (214, 170, 84, 255),
    "stain": (70, 22, 20, 255), "page": (232, 222, 190, 255), "page_d": (180, 166, 130, 255), "ink": (60, 40, 40, 255),
    "cloth": (220, 210, 186, 255), "cloth_d": (170, 156, 128, 255),
    "glass_r": (190, 50, 60, 255), "glass_b": (60, 90, 190, 255), "glass_y": (230, 190, 70, 255), "glass_g": (70, 150, 90, 255),
    "lead": (30, 26, 34, 255), "hole": (8, 6, 12, 255),
    "rust": (122, 66, 40, 255), "rust_d": (82, 44, 28, 255), "rust_l": (160, 96, 60, 255),
    "blood": (128, 24, 30, 255), "blood_d": (82, 14, 20, 255), "rope": (170, 140, 90, 255), "rope_d": (120, 96, 60, 255),
    "bone": (226, 216, 190, 255), "bone_d": (170, 158, 132, 255), "bone_s": (140, 128, 104, 255),
    "rivet": (180, 186, 204, 255), "wax": (236, 228, 200, 255),
})


def chest_sprite():
    s = Sprite(16, 16)
    for y, row in enumerate(CHEST_ROWS["chest"]):
        for x, ch in enumerate(row):
            if ch != ".":
                s.p(x, y, hexrgb(CHEST_PAL[ch]) + (255,))
    return s


# ---------------------------------------------------------------- salle de prière

def pew(broken=False):
    """Banc de 2 cases vu de dos (les fidèles regardent l'autel, en haut) : l'assise en haut, le dossier devant nous,
    haut et sombre, avec ses montants. Cassé : le dossier fendu, une moitié effondrée, des planches au sol."""
    s = Sprite(32, 18)
    s.r(1, 16, 30, 2, "shadow")
    if not broken:
        s.r(1, 2, 30, 3, "oak_l").r(1, 2, 30, 1, "oak_h")          # assise (derrière)
        s.r(0, 5, 32, 9, "oak").r(0, 5, 32, 1, "oak_h")             # dossier (devant)
        s.r(1, 8, 30, 1, "oak_d").r(1, 11, 30, 1, "oak_d")
        for x in (0, 15, 30):
            s.r(x, 4, 2, 12, "oak_d").p(x, 4, "oak_h")
        return s.done()
    s.r(1, 2, 14, 3, "oak_l").r(1, 2, 14, 1, "oak_h")
    s.r(0, 5, 16, 9, "oak").r(0, 5, 16, 1, "oak_h").r(1, 8, 14, 1, "oak_d").r(1, 11, 14, 1, "oak_d")
    for x in (0, 14):
        s.r(x, 4, 2, 12, "oak_d")
    # Cassure en dents de scie, la moitié droite effondrée au sol.
    for y in range(5, 14):
        s.p(15 + (y % 3), y, "oak_d")
    for i in range(14):
        s.p(17 + i, 12 + i // 5, "oak_l").p(17 + i, 13 + i // 5, "oak").p(17 + i, 14 + i // 5, "oak_d")
    s.r(19, 9, 5, 2, "oak_l").r(26, 10, 4, 2, "oak")  # planches tombées
    return s.done()


def altar(open_book=True):
    """Autel de pierre (2 cases) drapé d'une nappe usée ; un pupitre de bois au milieu porte un gros livre ouvert."""
    s = Sprite(32, 26)
    s.r(1, 24, 30, 2, "shadow")
    s.r(0, 10, 32, 14, "stone").r(0, 10, 32, 2, "stone_l").r(0, 22, 32, 2, "stone_d")
    s.r(1, 12, 30, 5, "cloth").r(1, 12, 30, 1, "cloth_d")
    for x in range(1, 31, 3):
        s.r(x, 17, 2, 1 + (x * 7) % 3, "cloth")                    # franges de la nappe, inégales
    s.r(6, 17, 3, 3, "stain").r(22, 13, 2, 2, "stain")              # taches
    # Pupitre et livre.
    s.r(13, 4, 6, 8, "oak").r(13, 4, 6, 1, "oak_h").r(15, 12, 2, 1, "oak_d")
    s.r(10, 1, 12, 5, "page").r(15, 1, 2, 5, "page_d").r(10, 5, 12, 1, "vel_d")
    for y in (2, 3, 4):
        s.r(11, y, 3, 1, "ink").r(18, y, 3, 1, "ink")
    s.p(21, 0, "vel")  # signet
    return s.done()


def candelabrum(candles=3, frame=0):
    """Candélabre de fer sur pied (une case, haut) : 0 à 3 bougies de cire qui vacillent (3 images)."""
    s = Sprite(14, 30)
    s.r(3, 28, 8, 2, "shadow")
    s.r(4, 26, 6, 2, "iron").r(6, 10, 2, 16, "iron").r(6, 10, 1, 16, "iron_l")
    s.r(1, 10, 12, 2, "iron").r(1, 10, 12, 1, "iron_l")
    s.r(1, 8, 2, 2, "iron").r(6, 7, 2, 3, "iron").r(11, 8, 2, 2, "iron")
    s.done()
    for i, (x, top) in enumerate(((1, 4), (6, 2), (11, 4))):
        if i >= candles:
            continue
        s.r(x, top, 2, (8 if i != 1 else 5) - top + (0 if i != 1 else 3), "wax")
        dx = (0, -1, 1)[(frame + i) % 3]
        s.r(x + max(0, dx), top - 3, 1, 3, "fire").p(x + max(0, dx), top - 1, "fire_y").p(x + 1 + min(0, dx), top - 2, "fire_l")
    return s


def runner(w_cells, h_cells):
    """Tapis de velours rouge sur l'allée, frangé d'or, déchiré (trous, bords effilochés) et taché."""
    W, H = w_cells * T, h_cells * T
    s = Sprite(W, H)
    for y in range(H):
        for x in range(2, W - 2):
            n = hash2(x // 2, y // 2, 950)
            if (x in (2, W - 3)) and n > 0.35:
                s.p(x, y, "fringe")
                continue
            c = "vel_l" if x < 5 else "vel_d" if x > W - 6 else "vel"
            if fbm(np.array([x]), np.array([y]), 9, 951, 2)[0] < 0.3:
                c = "stain"
            s.p(x, y, c)
    for (cx, cy, r) in ((8, int(H * 0.3), 3.2), (5, int(H * 0.7), 2.4)):   # déchirures
        for y in range(H):
            for x in range(W):
                if ((x - cx) / r) ** 2 + ((y - cy) / (r * 1.4)) ** 2 + (hash2(x, y, 952) - 0.5) * 0.6 < 1:
                    s.a[y, x] = 0
    for y in range(0, H, 3):
        if hash2(0, y, 953) > 0.5:
            s.a[y, 2] = 0
    return s


def stained_glass(damaged=1):
    """Vitrail en ogive dans le mur du fond : plombs sombres, verre rouge, bleu, jaune, vert ; abîmé (trous noirs, éclats)."""
    s = Sprite(14, 18)
    cols = ["glass_b", "glass_r", "glass_y", "glass_g"]
    for y in range(18):
        for x in range(14):
            arch = y >= 6 or ((x - 6.5) / 6.5) ** 2 + ((y - 6) / 6) ** 2 <= 1
            if not arch:
                continue
            if x in (0, 13) or y == 17 or (y < 6 and ((x - 6.5) / 6.5) ** 2 + ((y - 6) / 6) ** 2 > 0.78):
                s.p(x, y, "stone_l")
                continue
            if x % 4 == 1 or y % 5 == 2:
                s.p(x, y, "lead")
                continue
            c = cols[(x // 4 + y // 5) % 4]
            s.p(x, y, c)
    for (cx, cy, r) in ((4 + 5 * damaged, 9, 2.2), (9 - 4 * damaged, 14, 1.6)):
        for y in range(18):
            for x in range(1, 13):
                if ((x - cx) / r) ** 2 + ((y - cy) / r) ** 2 + (hash2(x, y, 960 + damaged) - 0.5) * 0.8 < 1 and s.a[y, x, 3]:
                    s.p(x, y, "hole")
    return s.done()


# ---------------------------------------------------------------- salle de torture

def dark_floor(xs, ys):
    """Dalles sombres de la salle de torture : le sol B, plus sombre et rougi, avec des taches."""
    out = floor_b(xs, ys) * np.array([0.62, 0.55, 0.6])
    m = fbm(xs, ys, 14, 970, 2) < 0.3
    out[m] = out[m] * 0.6 + np.array(hexrgb("#4a1a1c")) * 0.4
    return out


def blood_gutter(out, x0, y0, y1):
    """Rigole verticale creusée dans les dalles, pleine de sang séché, jusqu'à une grille au bas."""
    out[y0:y1, x0] = hexrgb("#7a7488")
    out[y0:y1, x0 + 1:x0 + 3] = hexrgb("#5a1418")
    out[y0:y1:5, x0 + 1] = hexrgb("#8a2228")
    for y in range(y1 - 3, y1 + 4):
        for x in range(x0 - 3, x0 + 6):
            d = ((x - x0 - 1) / 4.2) ** 2 + ((y - y1) / 3.4) ** 2
            if d <= 1:
                out[y, x] = hexrgb("#141018") if (x % 2) else hexrgb("#5a5f74")


def rack_table():
    """Table à chaînes (2 cases) : plateau de planches épaisses taché de sang, quatre fers à anneaux et leurs chaînes qui pendent."""
    s = Sprite(32, 22)
    s.r(1, 20, 30, 2, "shadow")
    s.r(0, 3, 32, 9, "oak_l").r(0, 3, 32, 1, "oak_h")
    for y in (6, 9):
        s.r(1, y, 30, 1, "oak")
    s.r(0, 12, 32, 6, "oak").r(0, 17, 32, 1, "oak_d")
    for x in (1, 28):
        s.r(x, 12, 3, 8, "oak_d")
    for (x, y, w, h) in ((9, 5, 12, 4), (7, 7, 5, 2), (22, 6, 3, 2)):
        s.r(x, y, w, h, "blood")
    s.r(11, 6, 6, 2, "blood_d")
    for x, ln in ((10, 4), (14, 6), (18, 2)):
        s.r(x, 12, 1, ln, "blood")
    for x, y in ((2, 4), (27, 4), (2, 9), (27, 9)):
        s.r(x, y, 3, 2, "iron").p(x + 1, y, "iron_l")
    for x in (0, 31):
        for y in range(6, 16, 2):
            s.p(x, y, "iron_l").p(x, y + 1, "iron")
    return s.done()


def tool_rack():
    """Râtelier d'outils contre le mur : cadre de bois, tenailles, scie, pinces, crochet, tous rouillés et tachés de sang."""
    s = Sprite(16, 28)
    s.r(1, 26, 14, 2, "shadow")
    s.r(0, 2, 16, 2, "oak_l").r(0, 2, 16, 1, "oak_h").r(0, 2, 2, 24, "oak").r(14, 2, 2, 24, "oak").r(0, 22, 16, 2, "oak_l")
    s.r(3, 4, 1, 12, "rust").r(2, 15, 3, 3, "rust_d").p(3, 16, "blood")                       # tenailles
    s.r(6, 4, 2, 14, "rust_l").r(6, 4, 1, 14, "rust").r(5, 17, 4, 2, "oak_d")                  # scie
    for y in range(5, 17, 2):
        s.p(8, y, "rust_d")
    s.r(10, 4, 1, 8, "iron").r(10, 12, 3, 1, "iron").r(12, 10, 1, 2, "iron").p(12, 10, "blood")  # crochet
    s.r(12, 4, 1, 4, "rust").r(11, 7, 3, 2, "rust_d")
    s.r(6, 12, 2, 3, "blood").p(3, 10, "blood").r(2, 24, 3, 1, "blood")
    return s.done()


def wall_board():
    """Planche au mur pour immobiliser une victime : grand panneau de bois, sangles de cuir aux poignets et aux chevilles,
    une trace de sang qui descend."""
    s = Sprite(16, 30)
    s.r(2, 28, 12, 2, "shadow")
    s.r(2, 0, 12, 28, "oak").r(2, 0, 12, 1, "oak_h").r(2, 0, 1, 28, "oak_l")
    for x in (6, 10):
        s.r(x, 1, 1, 27, "oak_d")
    for y in (5, 22):
        s.r(1, y, 14, 2, "rust_d").r(3, y, 2, 2, "iron").r(11, y, 2, 2, "iron")
    s.r(7, 8, 2, 14, "blood").r(7, 10, 1, 4, "blood_d").r(6, 24, 4, 3, "blood")
    return s.done()


def maiden(state="closed"):
    """Sarcophage à pointes, debout contre le mur : sarcophage de fer rouillé à visage sculpté, rivets.
    Ouvert : un squelette pris entre les pointes (à fouiller). Déclenché : une pointe jaillit de la fente."""
    s = Sprite(18, 30)
    s.r(2, 28, 14, 2, "shadow")
    for y in range(30):
        for x in range(18):
            hw = 7.5 if y > 6 else 4.5 + y * 0.5
            if abs(x - 8.5) <= hw and y < 28:
                s.p(x, y, "rust_l" if x < 6 else "rust_d" if x > 12 else "rust")
    if state == "open":
        for y in range(3, 27):
            for x in range(3, 15):
                if abs(x - 8.5) <= (5.5 if y > 7 else 2.5 + y * 0.4):
                    s.p(x, y, "hole")
        for y in range(5, 26, 4):
            s.p(3, y, "iron_l").p(4, y, "iron_l").p(13, y + 2, "iron_l").p(14, y + 2, "iron_l")
        # Squelette debout, pris dedans.
        s.r(7, 5, 4, 4, "bone").r(8, 6, 1, 1, "hole").r(9, 6, 1, 1, "hole").r(8, 9, 2, 1, "bone_d")
        for y in (11, 13, 15):
            s.r(6, y, 6, 1, "bone")
        s.r(8, 10, 1, 9, "bone_d").r(7, 19, 4, 2, "bone").r(7, 21, 1, 5, "bone_d").r(10, 21, 1, 5, "bone")
        s.r(5, 11, 1, 6, "bone_d")
    else:
        s.r(8, 3, 2, 25, "rust_d")                                     # fente entre les deux portes
        s.r(5, 6, 8, 5, "rust_l").p(6, 8, "hole").p(11, 8, "hole").r(7, 10, 4, 1, "rust_d")  # visage sculpté
        for y in (13, 18, 23):
            s.p(3, y, "rivet").p(14, y, "rivet").r(4, y, 3, 1, "iron").r(11, y, 3, 1, "iron")
        if state == "sprung":
            s.r(9, 15, 7, 1, "iron_l").r(15, 14, 2, 3, "iron_l").p(17, 15, "rivet")
    return s.done()


def rope_hook(phase=0):
    """Corde pendue d'un anneau scellé au mur du fond, crochet de fer au bout ; elle oscille un peu (3 images)."""
    sway = (-1, 0, 1)[phase % 3]
    s = Sprite(12, 28)
    s.r(3, 0, 6, 2, "iron").r(4, 0, 4, 1, "iron_l")
    for y in range(2, 20):
        x = 6 + int(round(sway * (y - 2) / 18))
        s.p(x, y, "rope" if y % 3 else "rope_d")
    x = 6 + sway
    s.r(x, 20, 1, 3, "iron_l").r(x - 2, 23, 1, 2, "iron_l").r(x - 2, 25, 3, 1, "iron").p(x + 1, 24, "iron")
    s.p(x - 2, 23, "blood")
    return s.done()


if __name__ == "__main__":
    # ------------------------- PRIÈRE (9 × 8)
    IW, IH = 9, 8
    W, H = (IW + 2) * T, (IH + 2) * T
    xs, ys = grid(W, H)
    base = walls(IW, IH)
    base[T:T + IH * T, T:T + IW * T] = floor_b(xs, ys)[T:T + IH * T, T:T + IW * T]
    base[(IH + 1) * T:, 5 * T:6 * T] = floor_b(xs, ys)[(IH + 1) * T:, 5 * T:6 * T] * 0.7
    room = to_img(base).convert("RGBA")

    def put(sp, cx, cy, ox=0, oy=0, room=room):
        im = sp.img() if hasattr(sp, "img") else sp
        room.alpha_composite(im, (cx * T + ox, cy * T + T - im.height + oy))

    room.alpha_composite(stained_glass(0).img(), (2 * T + 1, -1))
    room.alpha_composite(stained_glass(1).img(), (8 * T + 1, -1))
    room.alpha_composite(runner(1, 6).img(), (5 * T, 3 * T))
    put(chest_sprite(), 5, 1)
    put(altar(), 4, 2, ox=8, oy=-1)
    put(candelabrum(3, 0), 2, 2, ox=1, oy=-1)
    put(candelabrum(1, 1), 8, 2, ox=1, oy=-1)
    for y, (lb, rb) in zip((4, 6, 8), ((False, False), (False, True), (True, False))):
        put(pew(lb), 3, y, oy=1)
        put(pew(rb), 6, y, oy=1)
    planche("SALLE DE PRIÈRE v1 — à valider (9 × 8 cases)", room, [
        ("banc (2 cases), vu de dos", [pew().img()]),
        ("banc cassé", [pew(True).img()]),
        ("autel, pupitre et livre", [altar().img()]),
        ("candélabre 0 à 3 bougies (vacillent)", [candelabrum(n, n).img() for n in range(4)]),
        ("vitraux abîmés (mur du fond)", [stained_glass(0).img(), stained_glass(1).img()]),
        ("tapis de velours, déchiré, taché", [runner(1, 3).img()]),
        ("coffre derrière le pupitre", [chest_sprite().img()]),
    ], "art/priere_v1.png",
        note="Les fidèles regardent l'autel : on voit les bancs de dos. L'allée reste libre au milieu, le tapis la couvre.")

    # ------------------------- TORTURE (9 × 6)
    IW, IH = 9, 6
    W, H = (IW + 2) * T, (IH + 2) * T
    xs, ys = grid(W, H)
    base = walls(IW, IH)
    fl = dark_floor(xs, ys)
    blood_gutter(fl, 5 * T + 7, 3 * T, 6 * T + 6)
    base[T:T + IH * T, T:T + IW * T] = fl[T:T + IH * T, T:T + IW * T]
    base[(IH + 1) * T:, 2 * T:3 * T] = fl[(IH + 1) * T:, 2 * T:3 * T] * 0.7
    room2 = to_img(base).convert("RGBA")

    def put2(sp, cx, cy, ox=0, oy=0):
        put(sp, cx, cy, ox, oy, room=room2)

    put2(tool_rack(), 1, 1, oy=-1)
    put2(wall_board(), 3, 1, oy=-1)
    put2(rope_hook(0), 5, 1, ox=2, oy=-4)
    put2(rope_hook(2), 6, 1, ox=2, oy=-4)
    put2(tool_rack(), 7, 1, oy=-1)
    put2(maiden("closed"), 9, 1, ox=-1, oy=-1)
    put2(maiden("open"), 9, 3, ox=-1, oy=-1)
    put2(rack_table(), 4, 3, oy=-1)
    room2.alpha_composite(skeleton().img(), (1 * T, 5 * T + 2))
    planche("SALLE DE TORTURE v1 — à valider (9 × 6 cases)", room2, [
        ("table à chaînes (2 cases)", [rack_table().img()]),
        ("râtelier d'outils rouillés", [tool_rack().img()]),
        ("planche au mur", [wall_board().img()]),
        ("corde et crochet (mur du fond, oscille)", [rope_hook(i).img() for i in range(3)]),
        ("sarcophage à pointes : fermé / ouvert (squelette) / la pointe part", [maiden("closed").img(), maiden("open").img(), maiden("sprung").img()]),
    ], "art/torture_v1.png",
        note="Sarcophage : DÉSAMORCER (agilité) ou FORCER (force). Raté : une pointe jaillit, -1d4. Dedans : un squelette, et du butin.")
