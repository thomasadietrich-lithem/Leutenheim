"""Deux nouvelles salles à thème, v1 (Thomas, 2026-11-11).

FORGE : 1 à 2 enclumes ; 0 à 2 armures rouillées sur support ; dalles sombres ; tas de charbon (3 tailles) ; forge allumée
avec soufflet ; une épée rouillée ; 0 à 2 râteliers d'armes rouillées ; 0 à 2 coffres (avec une arme) ; 0 à 3 étagères
murales à outils ; 0 à 2 chaises ; 1 établi ; 0 à 3 tonneaux ; 1 meule à aiguiser.

ALCHIMISTE : un chaudron plein sur un feu (animé) ; 1 à 2 coffres (avec une potion) ; 0 à 3 étagères de verrerie ; un
ours empaillé ; des herbes ; une plante en pot ; une cheminée ; 1 à 3 bibliothèques de 2 cases ; un grimoire sur pied.
« Pense à gérer plusieurs angles, en particulier pour les bibliothèques » : bibliothèque de face (mur du fond) et de
profil (murs de gauche et de droite).

Même vue de 3/4 que le dortoir validé. Tout ce qui est en bois brûlera. Écrit art/forge_v1.png et art/alchimiste_v1.png.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from pix import hash2, hexrgb, grid, to_img, fbm
from dortoir_v2 import Sprite, C, T, walls, chair, hearth
from sols_v1 import floor_b
from trainards_v3 import barrel_v3
from salles_v1 import chest_sprite
from planche import planche

C.update({
    "oak_d": (52, 32, 16, 255), "oak": (86, 56, 28, 255), "oak_l": (112, 76, 40, 255), "oak_h": (138, 98, 56, 255),
    "rust": (122, 66, 40, 255), "rust_d": (82, 44, 28, 255), "rust_l": (160, 96, 60, 255),
    "steel_d": (52, 56, 70, 255), "coal": (28, 24, 30, 255), "coal_l": (58, 52, 60, 255),
    "glow": (255, 120, 40, 255), "glow_l": (255, 190, 90, 255), "leather": (110, 70, 34, 255), "leather_d": (76, 46, 22, 255),
    "grind": (150, 146, 136, 255), "grind_d": (104, 100, 92, 255),
    "brew": (90, 180, 80, 255), "brew_l": (170, 230, 120, 255), "brew_d": (48, 110, 50, 255),
    "glass": (120, 170, 190, 255), "glass_h": (200, 235, 245, 255), "glass_p": (170, 90, 190, 255), "glass_r": (200, 60, 60, 255),
    "fur": (98, 66, 40, 255), "fur_d": (64, 42, 26, 255), "fur_l": (134, 94, 60, 255), "claw": (220, 210, 190, 255),
    "leaf": (70, 130, 60, 255), "leaf_d": (40, 86, 40, 255), "leaf_l": (120, 180, 90, 255), "clay": (164, 92, 60, 255), "clay_d": (118, 62, 40, 255),
    "book_r": (140, 40, 40, 255), "book_b": (50, 70, 130, 255), "book_g": (50, 110, 60, 255), "book_y": (170, 140, 60, 255),
    "page": (232, 222, 190, 255), "ink": (60, 40, 40, 255), "magic": (150, 200, 255, 255), "herb": (120, 150, 70, 255), "herb_d": (80, 100, 50, 255),
})


def dark_slabs(xs, ys):
    """Dalles sombres de la forge : le sol B noirci de suie, sans le rouge de la salle de torture."""
    out = floor_b(xs, ys) * np.array([0.6, 0.58, 0.62])
    soot = fbm(xs, ys, 12, 990, 2) < 0.35
    out[soot] = out[soot] * 0.7
    return out


# ------------------------------------------------------------------ FORGE

def anvil():
    """Enclume de fer sur une souche de bois cerclée : bigorne à gauche, table claire."""
    s = Sprite(16, 18)
    s.r(2, 16, 12, 2, "shadow")
    s.r(4, 9, 8, 7, "oak").r(4, 9, 8, 1, "oak_h").r(4, 12, 8, 1, "iron").r(5, 14, 6, 1, "oak_d")
    s.r(2, 3, 12, 3, "iron").r(2, 3, 12, 1, "iron_l").r(0, 4, 3, 1, "iron").r(0, 3, 2, 1, "iron_l")
    s.r(5, 6, 6, 3, "steel_d").r(4, 8, 8, 1, "iron")
    return s.done()


def armor_stand(rusty=0):
    """Armure rouillée sur son support : croix de bois, plastron et heaume piqués de rouille."""
    s = Sprite(16, 30)
    s.r(3, 28, 10, 2, "shadow")
    s.r(7, 6, 2, 22, "oak").r(4, 26, 8, 2, "oak_d").r(3, 12, 10, 2, "oak")
    s.r(4, 11, 8, 10, "rust").r(4, 11, 8, 1, "rust_l").r(5, 13, 2, 6, "rust_l").r(10, 12, 2, 8, "rust_d")
    s.r(2, 11, 3, 4, "rust_d").r(11, 11, 3, 4, "rust_d")
    s.r(5, 2, 6, 7, "rust").r(5, 2, 6, 1, "rust_l").r(6, 5, 4, 1, "coal")
    for x, y in ((6, 15), (9, 17), (5, 19), (10, 14)):
        s.p(x, y, "iron" if rusty else "rust_d")
    s.r(5, 21, 6, 4, "rust_d").r(5, 21, 6, 1, "rust")
    return s.done()


def coal(size=1):
    """Tas de charbon (petit, moyen, gros) : morceaux noirs à reflets gris."""
    W, H = [(10, 6), (14, 9), (16, 12)][size]
    s = Sprite(16, 13)
    for y in range(H):
        for x in range(W):
            d = ((x - (W - 1) / 2) / (W / 2)) ** 2 + ((y - H) / H) ** 2
            if d <= 1:
                s.p(x + (16 - W) // 2, 13 - H + y - 1, "coal_l" if hash2(x, y, 700 + size) > 0.72 else "coal")
    return s.done()


def forge(frame=0):
    """Forge de pierre (2 cases) : foyer de braises qui rougeoient (3 images), hotte, soufflet de cuir sur le côté."""
    s = Sprite(32, 34)
    s.r(1, 32, 30, 2, "shadow")
    s.r(6, 0, 20, 12, "stone").r(6, 0, 20, 2, "stone_l").r(8, 10, 16, 2, "stone_d")      # hotte
    s.r(4, 12, 24, 20, "stone").r(4, 12, 24, 2, "stone_l").r(4, 30, 24, 2, "stone_d")      # corps
    s.r(8, 15, 16, 8, "coal")
    for i, (x, y) in enumerate(((9, 18), (12, 17), (15, 19), (18, 17), (21, 18), (11, 20), (17, 20), (14, 16))):
        c = ("glow_l", "glow", "fire")[(i + frame) % 3]
        s.r(x, y, 2, 2, c)
    s.r(13, 13, 6, 2, "fire_l" if frame % 2 else "fire")
    s.done()
    # Soufflet à droite : deux planches de bois, cuir plissé, embout de fer vers le foyer.
    s.r(26, 18, 6, 10, "leather").r(26, 18, 6, 2, "oak_l").r(26, 26, 6, 2, "oak").r(27, 21, 4, 1, "leather_d").r(27, 23, 4, 1, "leather_d")
    s.r(24, 22, 3, 2, "iron")
    return s


def rusty_sword():
    """Épée rouillée posée au sol, lame ébréchée."""
    s = Sprite(16, 16)
    for i in range(11):
        s.p(3 + i, 12 - i, "rust" if i % 3 else "rust_d").p(4 + i, 12 - i, "rust_l")
    s.r(1, 12, 4, 1, "oak_d").r(2, 11, 1, 3, "rust_d").r(0, 13, 2, 2, "leather")
    s.p(9, 6, "coal")
    s.r(2, 14, 12, 1, "shadow")
    return s.done()


def weapon_rack():
    """Râtelier d'armes rouillées contre le mur : cadre de bois, une hache, une épée, une masse."""
    s = Sprite(16, 28)
    s.r(1, 26, 14, 2, "shadow")
    s.r(0, 2, 2, 24, "oak").r(14, 2, 2, 24, "oak").r(0, 4, 16, 2, "oak_l").r(0, 20, 16, 2, "oak_l")
    s.r(3, 6, 1, 16, "oak_d").r(2, 6, 3, 4, "rust")                       # hache
    s.r(7, 3, 2, 16, "rust_l").r(7, 3, 1, 16, "rust").r(6, 18, 4, 1, "rust_d").r(7, 19, 2, 3, "leather")  # épée
    s.r(11, 9, 1, 13, "oak_d").r(10, 6, 3, 4, "rust_d").p(10, 6, "rust_l")  # masse
    return s.done()


def tool_shelf():
    """Étagère murale à outils : une planche sur deux consoles, marteaux, tenailles, limes pendues."""
    s = Sprite(16, 22)
    s.r(0, 4, 16, 2, "oak_l").r(0, 4, 16, 1, "oak_h").r(1, 6, 2, 3, "oak_d").r(13, 6, 2, 3, "oak_d")
    s.r(2, 1, 3, 3, "iron").r(3, 0, 1, 1, "iron_l")                       # pot à clous
    s.r(7, 2, 6, 2, "iron_l").r(9, 0, 1, 2, "oak")                         # marteau couché
    for x, ln, c in ((4, 9, "iron"), (8, 7, "iron_l"), (11, 10, "rust")):
        s.r(x, 6, 1, ln, c).p(x - 1, 6 + ln, c).p(x + 1, 6 + ln, c)
    return s.done()


def workbench():
    """Établi (2 cases) : plateau épais marqué, un étau de fer, des outils, des copeaux."""
    s = Sprite(32, 22)
    s.r(1, 20, 30, 2, "shadow")
    s.r(0, 3, 32, 8, "oak_l").r(0, 3, 32, 1, "oak_h").r(1, 6, 30, 1, "oak").r(0, 11, 32, 6, "oak").r(0, 16, 32, 1, "oak_d")
    for x in (1, 28):
        s.r(x, 11, 3, 9, "oak_d")
    s.r(3, 0, 6, 5, "iron").r(3, 0, 6, 1, "iron_l").r(5, 5, 2, 2, "steel_d")     # étau
    s.r(14, 5, 8, 2, "iron_l").r(20, 4, 3, 2, "oak_d")                            # lime
    s.r(24, 4, 5, 3, "rust")                                                       # fer brut
    for x in (12, 16, 26):
        s.p(x, 8, "oak_h")
    return s.done()


def grindstone():
    """Meule à aiguiser : disque de pierre dressé sur un bâti de bois, manivelle, auge d'eau dessous."""
    s = Sprite(16, 22)
    s.r(1, 20, 14, 2, "shadow")
    s.r(2, 12, 12, 3, "oak").r(2, 15, 2, 5, "oak_d").r(12, 15, 2, 5, "oak_d").r(3, 13, 10, 2, "glass")   # auge
    for y in range(13):
        for x in range(16):
            d = ((x - 8) / 5.2) ** 2 + ((y - 7) / 6.2) ** 2
            if d <= 1:
                s.p(x, y, "grind_d" if d > 0.7 else "grind" if (x + y) % 5 else "grind_d")
    s.r(7, 6, 2, 2, "iron").r(9, 6, 5, 1, "iron").r(13, 3, 1, 4, "oak")
    return s.done()


# ------------------------------------------------------------------ ALCHIMISTE

def cauldron(frame=0):
    """Chaudron de fonte sur un feu (3 images) : potion verte qui bouillonne, bulles qui crèvent, vapeur."""
    s = Sprite(18, 26)
    s.r(2, 24, 14, 2, "shadow")
    for i, x in enumerate((5, 8, 11)):
        s.r(x, 20 - (i + frame) % 2, 2, 4, "fire").p(x, 19 - (i + frame) % 2, "fire_l").p(x + 1, 22, "fire_y")
    for y in range(8, 21):
        hw = 8 * math.sin(math.pi * min(1, (y - 6) / 15)) + 0.5
        for x in range(18):
            if abs(x - 8.5) <= hw:
                s.p(x, y, "coal_l" if x < 6 else "coal")
    s.r(1, 7, 16, 2, "iron").r(1, 7, 16, 1, "iron_l")
    s.r(2, 6, 14, 2, "brew").r(3, 6, 4, 1, "brew_l")
    bubbles = [((5, 5), (11, 4)), ((8, 4), (13, 5)), ((4, 4), (10, 5))][frame % 3]
    for x, y in bubbles:
        s.p(x, y, "brew_l").p(x, y + 1, "brew")
    s.done()
    for x, y in (((6, 1), (11, 0)), ((7, 0), (12, 2)), ((5, 2), (10, 1)))[frame % 3]:
        s.p(x, y, (190, 240, 160, 130))
    return s


def glass_shelf():
    """Étagère de verrerie : fioles de couleurs, un alambic, des bocaux d'ingrédients."""
    s = Sprite(16, 30)
    s.r(1, 28, 14, 2, "shadow")
    s.r(0, 0, 2, 28, "oak").r(14, 0, 2, 28, "oak")
    for y in (9, 19):
        s.r(0, y, 16, 2, "oak_l").r(0, y, 16, 1, "oak_h")
    s.r(3, 5, 2, 4, "glass_p").r(3, 4, 2, 1, "glass_h").r(6, 3, 3, 6, "glass").r(7, 2, 1, 1, "glass_h").r(10, 6, 3, 3, "glass_r")
    s.r(3, 13, 4, 6, "glass").r(4, 12, 2, 1, "glass_h").r(4, 15, 2, 3, "brew").r(9, 14, 4, 5, "clay").r(9, 14, 4, 1, "clay_d")
    s.r(3, 23, 3, 4, "glass").p(4, 22, "glass_h").r(8, 24, 5, 3, "herb").r(8, 24, 5, 1, "herb_d")
    return s.done()


def stuffed_bear():
    """Ours empaillé dressé sur un socle : grosse silhouette brune, pattes levées, griffes et crocs pâles, yeux de verre."""
    s = Sprite(20, 34)
    s.r(2, 32, 16, 2, "shadow")
    s.r(3, 28, 14, 4, "oak").r(3, 28, 14, 1, "oak_h")
    for y in range(4, 29):
        hw = 6.5 if y > 10 else 4.5
        hw += 1.0 * math.sin((y - 10) / 6) if y > 10 else 0
        for x in range(20):
            if abs(x - 9.5) <= hw:
                s.p(x, y, "fur_l" if x < 8 and y > 12 else "fur_d" if x > 12 else "fur")
    s.r(6, 2, 8, 6, "fur").r(6, 2, 2, 2, "fur_d").r(12, 2, 2, 2, "fur_d")    # tête, oreilles
    s.r(8, 6, 4, 3, "fur_l").p(9, 7, "coal").p(10, 7, "coal").p(7, 4, "glass_h").p(12, 4, "glass_h")
    s.r(9, 9, 2, 1, "claw")
    s.r(0, 12, 4, 7, "fur_d").r(16, 12, 4, 7, "fur_d").r(0, 11, 1, 2, "claw").r(19, 11, 1, 2, "claw")     # pattes levées
    s.r(5, 26, 4, 2, "fur_d").r(11, 26, 4, 2, "fur_d")
    return s.done()


def herbs():
    """Bouquets d'herbes qui sèchent, pendus à une ficelle (mur du fond)."""
    s = Sprite(16, 16)
    s.r(0, 1, 16, 1, "twine")
    for x, ln, c in ((2, 8, "herb"), (6, 6, "leaf"), (10, 9, "herb_d"), (13, 7, "leaf_d")):
        s.r(x, 2, 1, 2, "twine").r(x - 1, 4, 3, ln, c).p(x, 4 + ln, c)
    return s.done()


def potted_plant():
    """Plante en pot de terre : feuilles larges, quelques tiges."""
    s = Sprite(14, 20)
    s.r(2, 18, 10, 2, "shadow")
    s.r(3, 12, 8, 6, "clay").r(3, 12, 8, 1, "clay_d").r(2, 11, 10, 2, "clay")
    for (x, y, w, h) in ((1, 4, 5, 3), (7, 2, 5, 3), (4, 0, 4, 3), (8, 6, 5, 3), (2, 7, 4, 3)):
        s.r(x, y, w, h, "leaf").r(x, y, w, 1, "leaf_l")
    s.r(6, 3, 1, 8, "leaf_d")
    return s.done()


def books_row(s, x0, y0, w, seed):
    cols = ["book_r", "book_b", "book_g", "book_y", "oak_d"]
    x = x0
    while x < x0 + w:
        bw = 1 + int(hash2(x, y0, seed) * 2)
        h = 5 + int(hash2(x, y0, seed + 1) * 3)
        c = cols[int(hash2(x, y0, seed + 2) * len(cols))]
        if hash2(x, y0, seed + 3) > 0.9:
            x += 1
            continue
        s.r(x, y0 + 7 - h, min(bw, x0 + w - x), h, c).p(x, y0 + 7 - h, "page")
        x += bw


def bookcase_front():
    """Bibliothèque de face (2 cases, contre le mur du fond) : trois rayons de livres serrés, quelques trous."""
    s = Sprite(32, 36)
    s.r(1, 34, 30, 2, "shadow")
    s.r(0, 0, 32, 34, "oak").r(0, 0, 32, 2, "oak_h").r(0, 32, 32, 2, "oak_d")
    for i, y in enumerate((2, 12, 22)):
        s.r(2, y, 28, 9, "oak_d")
        books_row(s, 2, y + 1, 28, 800 + i)
        s.r(2, y + 9, 28, 1, "oak_l")
    s.r(15, 2, 2, 30, "oak")
    return s.done()


def bookcase_side(facing="right"):
    """Bibliothèque de profil (contre un mur de côté, 2 cases de long en hauteur) : on voit le flanc de bois, et en biais
    le bord des rayons et le dos des livres tournés vers la salle."""
    s = Sprite(16, 44)
    s.r(1, 42, 14, 2, "shadow")
    s.r(0, 0, 9, 42, "oak").r(0, 0, 9, 2, "oak_h").r(1, 2, 1, 38, "oak_d")            # flanc contre le mur
    s.r(9, 4, 6, 38, "oak_d")                                                       # tranche des rayons
    for i, y in enumerate((5, 14, 23, 32)):
        s.r(9, y + 7, 6, 1, "oak_l")
        for j in range(6):
            c = ["book_r", "book_b", "book_g", "book_y"][int(hash2(j, y, 830 + i) * 4)]
            h = 5 + int(hash2(j, y, 840) * 2)
            s.r(9 + j, y + 7 - h, 1, h, c)
    s.done()
    return s if facing == "right" else Sprite_from(np.ascontiguousarray(s.a[:, ::-1]))


def Sprite_from(a):
    s = Sprite(a.shape[1], a.shape[0])
    s.a = a
    return s


def grimoire_stand(frame=0):
    """Grimoire ouvert sur un pupitre de bois sculpté ; une lueur bleue monte des pages (2 images)."""
    s = Sprite(14, 24)
    s.r(2, 22, 10, 2, "shadow")
    s.r(6, 10, 2, 11, "oak").r(3, 20, 8, 2, "oak_d").r(2, 7, 10, 4, "oak_l").r(2, 7, 10, 1, "oak_h")
    s.r(1, 4, 12, 4, "page").r(6, 4, 2, 4, "book_r").r(2, 5, 3, 1, "ink").r(9, 5, 3, 1, "ink").r(2, 6, 3, 1, "ink")
    s.done()
    for x, y in (((4, 2), (9, 1)), ((5, 1), (8, 2)))[frame % 2]:
        s.p(x, y, "magic")
    return s


if __name__ == "__main__":
    # --------------------- FORGE (9 × 6)
    IW, IH = 9, 6
    W, H = (IW + 2) * T, (IH + 2) * T
    xs, ys = grid(W, H)
    base = walls(IW, IH)
    fl = dark_slabs(xs, ys)
    base[T:T + IH * T, T:T + IW * T] = fl[T:T + IH * T, T:T + IW * T]
    base[(IH + 1) * T:, 2 * T:3 * T] = fl[(IH + 1) * T:, 2 * T:3 * T] * 0.7
    room = to_img(base).convert("RGBA")

    def put(sp, cx, cy, ox=0, oy=0, r=None):
        im = sp.img() if hasattr(sp, "img") else sp
        (r or room).alpha_composite(im, (cx * T + ox, cy * T + T - im.height + oy))

    put(tool_shelf(), 1, 1, oy=-6)
    put(weapon_rack(), 2, 1, oy=-1)
    put(forge(0), 4, 1, oy=-1)
    put(tool_shelf(), 6, 1, oy=-6)
    put(armor_stand(), 7, 1, oy=-1)
    put(armor_stand(1), 9, 1, oy=-1)
    put(coal(2), 1, 3)
    put(coal(0), 2, 3, ox=2)
    put(anvil(), 4, 3)
    put(barrel_v3(), 6, 3, ox=1)
    put(grindstone(), 9, 3)
    put(chair("right"), 2, 5, ox=2, oy=-1)
    put(workbench(), 3, 5, oy=-1)
    put(anvil(), 7, 5)
    put(chest_sprite(), 9, 6)
    room.alpha_composite(rusty_sword().img(), (6 * T, 5 * T + 2))
    planche("FORGE v1 — à valider (9 × 6 cases)", room, [
        ("enclume", [anvil().img()]),
        ("forge et soufflet (braises animées)", [forge(i).img() for i in range(3)]),
        ("armure rouillée sur support", [armor_stand().img(), armor_stand(1).img()]),
        ("charbon : petit, moyen, gros", [coal(i).img() for i in range(3)]),
        ("râtelier d'armes rouillées", [weapon_rack().img()]),
        ("étagère murale à outils", [tool_shelf().img()]),
        ("établi (2 cases)", [workbench().img()]),
        ("meule à aiguiser", [grindstone().img()]),
        ("épée rouillée (au sol)", [rusty_sword().img()]),
    ], "art/forge_v1.png", note="Dalles noircies de suie. Coffres (0 à 2, une arme dedans), chaises et tonneaux : les dessins déjà validés.")

    # --------------------- ALCHIMISTE (9 × 7)
    IW, IH = 9, 7
    W, H = (IW + 2) * T, (IH + 2) * T
    xs, ys = grid(W, H)
    base = walls(IW, IH)
    fl = floor_b(xs, ys)
    base[T:T + IH * T, T:T + IW * T] = fl[T:T + IH * T, T:T + IW * T]
    base[(IH + 1) * T:, 5 * T:6 * T] = fl[(IH + 1) * T:, 5 * T:6 * T] * 0.7
    room2 = to_img(base).convert("RGBA")
    room2.alpha_composite(hearth().img(), (8 * T, 0))
    put(bookcase_front(), 1, 1, oy=-1, r=room2)
    put(glass_shelf(), 3, 1, oy=-1, r=room2)
    put(herbs(), 4, 1, oy=-12, r=room2)
    put(glass_shelf(), 5, 1, oy=-1, r=room2)
    put(herbs(), 6, 1, oy=-12, r=room2)
    put(stuffed_bear(), 9, 2, ox=-2, oy=-1, r=room2)
    put(bookcase_side("right"), 1, 4, oy=-1, r=room2)
    put(bookcase_side("left"), 9, 6, oy=-1, r=room2)
    put(cauldron(0), 4, 4, ox=-1, r=room2)
    put(grimoire_stand(0), 6, 4, ox=1, r=room2)
    put(potted_plant(), 3, 7, ox=1, r=room2)
    put(chest_sprite(), 7, 7, r=room2)
    put(chest_sprite(), 8, 7, r=room2)
    planche("ALCHIMISTE v1 — à valider (9 × 7 cases)", room2, [
        ("chaudron sur le feu (animé)", [cauldron(i).img() for i in range(3)]),
        ("bibliothèque de face (2 cases, mur du fond)", [bookcase_front().img()]),
        ("bibliothèque de profil : mur de gauche / de droite", [bookcase_side("right").img(), bookcase_side("left").img()]),
        ("étagère de verrerie", [glass_shelf().img()]),
        ("ours empaillé", [stuffed_bear().img()]),
        ("herbes qui sèchent / plante en pot", [herbs().img(), potted_plant().img()]),
        ("grimoire sur pied (lueur animée)", [grimoire_stand(i).img() for i in range(2)]),
    ], "art/alchimiste_v1.png", note="Cheminée dans le mur du fond (celle du jeu). Coffres (1 à 2, une potion dedans) : le dessin déjà validé.")
