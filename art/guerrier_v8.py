"""Planche « guerrier_v8 » (Thomas, 2026-11-14 : « je ne voulais pas de variations du même design, mais une collection
de nouvelles créations originales ; ton design est moyen et assez fade »). PROPOSITION.

Seize héros GUERRIERS qui n'ont rien en commun que le style du jeu (vue de face légèrement plongeante, grosse tête,
contour sombre) : chacun a sa silhouette, sa carrure, sa tenue, son arme et sa couleur dominante, pour se reconnaître
d'un coup d'œil, même en petit. Dessinés à 32 × 32 (la taille en jeu viendra ensuite) ; à côté, chacun à la taille de
la case du jeu.
  python3 art/guerrier_v8.py → art/guerrier_v8.png
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, outline_mask, up  # noqa: E402

S = 32
OUT = (22, 16, 24)


def tone(c, k):
    return tuple(max(0, min(255, round(v * k))) for v in c[:3])


class C:
    """Toile 32 × 32 ; on peint des formes pleines, le contour sombre est ajouté à la fin (`done`)."""

    def __init__(self):
        self.a = np.zeros((S, S, 4), np.uint8)
        self.line_px = []  # traits intérieurs (dessinés après le contour)

    def px(self, x, y, c):
        if 0 <= x < S and 0 <= y < S:
            self.a[y, x] = tuple(c[:3]) + (255,)
        return self

    def rect(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.px(xx, yy, c)
        return self

    def ell(self, cx, cy, rx, ry, c):
        for yy in range(int(cy - ry) - 1, int(cy + ry) + 2):
            for xx in range(int(cx - rx) - 1, int(cx + rx) + 2):
                if ((xx - cx) / max(rx, 0.5)) ** 2 + ((yy - cy) / max(ry, 0.5)) ** 2 <= 1.0:
                    self.px(xx, yy, c)
        return self

    def line(self, x0, y0, x1, y1, c, w=1):
        n = max(abs(x1 - x0), abs(y1 - y0), 1)
        for i in range(n + 1):
            x = round(x0 + (x1 - x0) * i / n)
            y = round(y0 + (y1 - y0) * i / n)
            self.rect(x, y, w, w, c)
        return self

    def shade(self, x, y, w, h, c, light=1.18, dark=0.72):
        """Un bloc avec un bord clair en haut à gauche et sombre en bas à droite."""
        self.rect(x, y, w, h, c)
        self.rect(x, y, w, 1, tone(c, light))
        self.rect(x, y, 1, h, tone(c, light * 0.95))
        self.rect(x, y + h - 1, w, 1, tone(c, dark))
        self.rect(x + w - 1, y, 1, h, tone(c, dark * 1.05))
        return self

    def done(self):
        m = self.a[..., 3] > 0
        self.a[outline_mask(m)] = OUT + (255,)
        return self

    def img(self):
        return Image.fromarray(self.a, "RGBA")


# Couleurs communes.
SKIN = {"clair": (240, 196, 150), "mat": (204, 150, 104), "brun": (150, 98, 62), "foncé": (104, 66, 44), "pâle": (248, 222, 196)}
STEEL = (176, 186, 200)
IRON = (112, 120, 134)
GOLD = (236, 186, 64)
LEATHER = (132, 84, 48)
WOOD = (150, 104, 60)
EYE = (24, 18, 28)
WHITE = (244, 240, 230)


def face(c, cx, y, skin, eyes="dots", gap=3, mouth=None):
    """Yeux (et bouche) sur un visage déjà peint ; `cx` = milieu du visage."""
    lx, rx = cx - gap // 2 - 1, cx + (gap + 1) // 2
    if eyes == "dots":
        c.px(lx, y, EYE).px(rx, y, EYE)
    elif eyes == "tall":
        c.rect(lx, y, 1, 2, EYE).rect(rx, y, 1, 2, EYE).px(lx, y, WHITE).px(rx, y, WHITE)
    elif eyes == "angry":
        c.px(lx, y, EYE).px(rx, y, EYE).px(lx - 1, y - 1, EYE).px(rx + 1, y - 1, EYE)
    elif eyes == "glow":
        c.px(lx, y, (255, 70, 50)).px(rx, y, (255, 70, 50))
    if mouth:
        c.rect(cx - 1, y + 3, 2, 1, mouth)


def legs(c, x, y, w, h, color, boots, gap=1, boot_h=2):
    half = (w - gap) // 2
    for lx in (x, x + half + gap):
        c.shade(lx, y, half, h, color)
        c.shade(lx, y + h - boot_h, half, boot_h, boots, 1.25, 0.7)


# ---------------------------------------------------------------------------------------------------------------
# Les seize. Chaque fonction peint un héros complet ; pieds vers y = 30.


def heaume():
    """1. Le Heaume : chevalier massif, grand heaume plat à fente, tabard bleu à croix d'or, écu en amande."""
    c = C()
    blue, blue_d = (54, 92, 176), (36, 60, 120)
    legs(c, 10, 22, 11, 8, IRON, (70, 74, 86))
    c.shade(8, 13, 15, 10, STEEL)  # cuirasse
    c.rect(7, 13, 3, 4, STEEL).rect(21, 13, 3, 4, STEEL)  # épaulières
    c.shade(10, 14, 11, 11, blue)  # tabard
    c.rect(15, 15, 1, 8, GOLD).rect(12, 18, 7, 1, GOLD)
    c.shade(9, 2, 13, 12, STEEL)  # heaume seau
    c.rect(9, 7, 13, 1, (40, 40, 52))  # fente
    for x in (12, 14, 16, 18):
        c.px(x, 10, (40, 40, 52)).px(x, 11, (40, 40, 52))  # trous d'aération
    c.rect(15, 2, 1, 12, tone(STEEL, 1.25))  # arête
    c.ell(4, 19, 3, 6, blue)  # écu
    c.rect(4, 14, 1, 11, GOLD).rect(2, 18, 5, 1, GOLD)
    c.line(26, 6, 26, 21, tone(STEEL, 1.2)).rect(24, 21, 5, 1, GOLD).rect(26, 22, 1, 3, LEATHER)  # épée dressée
    return c.done()


def berserker():
    """2. La Bête du Nord : torse nu, peau de loup sur la tête et les épaules, barbe rousse tressée, deux haches."""
    c = C()
    fur, fur_d = (150, 146, 140), (96, 92, 90)
    skin = SKIN["clair"]
    legs(c, 9, 21, 13, 9, (90, 70, 56), (70, 50, 36))
    c.shade(8, 13, 15, 9, skin)  # torse nu
    c.rect(11, 15, 1, 3, tone(skin, 0.8)).rect(19, 15, 1, 3, tone(skin, 0.8)).rect(15, 16, 1, 4, tone(skin, 0.82))
    c.rect(8, 20, 15, 2, LEATHER).px(15, 20, GOLD)
    c.ell(15, 9, 6, 5, skin)  # tête
    c.ell(15, 3, 8, 3, fur)  # crâne de loup
    c.rect(7, 4, 2, 9, fur).rect(22, 4, 2, 9, fur)
    c.rect(5, 11, 5, 4, fur).rect(21, 11, 5, 4, fur)  # pattes sur les épaules
    c.px(9, 2, fur_d).px(21, 2, fur_d).px(8, 1, fur).px(22, 1, fur)  # oreilles
    c.px(12, 3, (230, 200, 70)).px(18, 3, (230, 200, 70))  # yeux du loup
    c.rect(13, 5, 5, 1, fur_d)  # museau
    face(c, 15, 8, skin, "angry", gap=4)
    red = (196, 80, 34)
    c.rect(11, 10, 9, 3, red).rect(13, 13, 2, 3, red).rect(16, 13, 2, 3, red).px(13, 16, GOLD).px(17, 16, GOLD)
    c.line(3, 10, 3, 24, WOOD).ell(2, 11, 2, 3, STEEL)  # hache gauche
    c.line(28, 10, 28, 24, WOOD).ell(29, 11, 2, 3, STEEL)
    return c.done()


def errante():
    """3. La Lame errante : grand chapeau de paille conique, long manteau ocre ouvert, sabre long à la ceinture."""
    c = C()
    coat = (196, 140, 66)
    skin = SKIN["mat"]
    legs(c, 11, 22, 9, 8, (60, 56, 70), (40, 36, 44))
    c.shade(9, 13, 13, 13, coat)  # manteau qui descend
    c.rect(14, 13, 3, 13, (230, 226, 210))  # chemise
    c.rect(9, 19, 13, 2, (120, 40, 40))  # ceinture rouge
    c.ell(15, 10, 5, 4, skin)
    face(c, 15, 10, skin, "dots", gap=4)
    c.ell(15, 6, 12, 3, (214, 190, 120))  # chapeau
    c.ell(15, 4, 5, 3, (230, 206, 136))
    c.line(4, 7, 26, 7, tone((214, 190, 120), 0.75))
    c.line(20, 20, 24, 24, (60, 50, 50), 2).line(24, 24, 29, 29, (220, 226, 236))  # sabre au côté
    c.rect(13, 13, 1, 2, (40, 34, 30)).rect(17, 13, 1, 2, (40, 34, 30))  # mèches noires
    return c.done()


def gladiatrice():
    """4. La Gladiatrice : casque à crête rouge et visière grillagée, bras gauche cuirassé, trident et filet."""
    c = C()
    skin = SKIN["brun"]
    bronze = (200, 140, 70)
    legs(c, 11, 22, 9, 8, skin, bronze)
    c.shade(10, 14, 11, 7, (220, 210, 186))  # tunique courte
    c.rect(10, 20, 11, 3, (150, 40, 40))  # pagne
    c.rect(8, 14, 3, 8, bronze).rect(8, 14, 3, 1, tone(bronze, 1.3))  # manica
    c.rect(21, 14, 2, 6, skin)
    c.shade(10, 4, 11, 10, bronze)  # casque
    c.rect(12, 7, 7, 5, (60, 50, 40))
    for x in (13, 15, 17):
        c.rect(x, 7, 1, 5, tone(bronze, 1.1))
    c.rect(12, 9, 7, 1, tone(bronze, 1.1))
    c.ell(15, 2, 7, 2, (210, 50, 50)).rect(9, 1, 13, 2, (210, 50, 50))  # crête
    c.line(26, 3, 26, 29, WOOD)  # trident
    c.rect(24, 3, 5, 1, STEEL).rect(24, 1, 1, 3, STEEL).rect(28, 1, 1, 3, STEEL).rect(26, 0, 1, 3, STEEL)
    for i in range(4):
        c.line(1, 20 + i * 2, 7, 18 + i * 2, (190, 180, 150))  # filet
    c.line(3, 18, 3, 27, (190, 180, 150)).line(6, 18, 6, 27, (190, 180, 150))
    return c.done()


def lansquenet():
    """5. Le Lansquenet : béret énorme à plumes, manches bouffantes tailladées jaune et rouge, épée à deux mains."""
    c = C()
    skin = SKIN["clair"]
    yel, red = (232, 196, 60), (196, 48, 48)
    legs(c, 10, 21, 11, 9, red, (50, 40, 36))
    for i in range(3):
        c.rect(10 + i * 4, 21, 1, 6, yel)  # crevés des chausses
    c.shade(10, 13, 11, 9, (60, 60, 70))  # pourpoint
    c.ell(8, 15, 3, 4, yel).ell(22, 15, 3, 4, yel)  # manches bouffantes
    c.rect(7, 13, 1, 5, red).rect(9, 13, 1, 5, red).rect(21, 13, 1, 5, red).rect(23, 13, 1, 5, red)
    c.ell(15, 9, 5, 4, skin)
    face(c, 15, 9, skin, "dots", gap=4)
    c.rect(12, 11, 7, 2, (120, 70, 40)).px(15, 12, skin)  # moustache
    c.ell(14, 5, 9, 3, red)  # béret
    c.ell(14, 4, 6, 2, tone(red, 1.15))
    c.line(19, 4, 27, 0, WHITE, 2).line(18, 4, 25, -1, (230, 120, 120))  # plumes
    c.line(4, 2, 4, 26, tone(STEEL, 1.2), 2)  # épée géante
    c.rect(1, 20, 8, 1, GOLD).rect(4, 21, 2, 5, LEATHER).px(2, 19, GOLD).px(7, 19, GOLD)
    return c.done()


def chasseuse():
    """6. La Chasseuse de monstres : chapeau à large bord, long manteau sombre, écharpe rouge au vent, arbalète."""
    c = C()
    skin = SKIN["pâle"]
    coat = (54, 52, 72)
    legs(c, 11, 23, 9, 7, (40, 40, 50), (90, 60, 40), boot_h=3)
    c.shade(9, 13, 13, 13, coat)
    c.rect(9, 24, 3, 3, coat).rect(19, 24, 3, 3, coat)  # pans du manteau
    c.rect(14, 14, 3, 6, (110, 100, 110))
    c.rect(9, 19, 13, 1, LEATHER).rect(9, 15, 13, 1, LEATHER).px(12, 15, (200, 200, 210))  # baudrier
    c.ell(15, 10, 5, 4, skin)
    face(c, 15, 10, skin, "tall", gap=4)
    c.rect(10, 12, 11, 2, (200, 40, 50)).line(21, 12, 28, 15, (200, 40, 50), 2)  # écharpe
    c.ell(15, 6, 10, 2, (40, 36, 48)).rect(11, 2, 9, 4, (40, 36, 48)).rect(11, 5, 9, 1, (150, 40, 50))
    c.rect(10, 7, 11, 2, (200, 200, 210))  # cheveux blancs sous le chapeau
    c.line(1, 21, 9, 21, WOOD).line(2, 18, 2, 24, tone(STEEL, 1.1)).line(3, 18, 8, 21, (220, 220, 220))
    return c.done()


def mineur():
    """7. Le Casseur de cailloux : casque de mineur à lanterne, gilet de cuir, bras énormes, pioche de guerre."""
    c = C()
    skin = SKIN["mat"]
    legs(c, 10, 23, 11, 7, (96, 84, 64), (60, 46, 34), boot_h=3)
    c.shade(7, 13, 17, 11, skin)  # gros bras / torse
    c.shade(10, 13, 11, 10, LEATHER)
    c.rect(10, 22, 11, 2, (80, 60, 40)).px(15, 22, GOLD)
    c.ell(5, 18, 3, 4, skin).ell(25, 18, 3, 4, skin)  # biceps
    c.rect(4, 21, 3, 2, (140, 120, 90)).rect(24, 21, 3, 2, (140, 120, 90))  # bandages
    c.ell(15, 9, 5, 4, skin)
    face(c, 15, 9, skin, "dots", gap=4)
    c.rect(11, 11, 9, 3, (60, 50, 50))  # barbe noire courte
    c.ell(15, 5, 7, 3, (200, 170, 60)).rect(8, 6, 15, 1, tone((200, 170, 60), 0.7))  # casque jaune
    c.ell(15, 4, 2, 2, (255, 240, 170)).px(15, 4, WHITE)  # lanterne
    c.line(27, 6, 27, 29, WOOD, 2).line(23, 7, 31, 4, IRON, 2)  # pioche
    return c.done()


def sentinelle():
    """8. La Sentinelle de Leutenheim : morion à crête, livrée jaune et noire du village, hallebarde."""
    c = C()
    skin = SKIN["clair"]
    yel, blk = (232, 190, 50), (40, 36, 44)
    legs(c, 11, 22, 9, 8, blk, (70, 50, 36))
    c.shade(10, 13, 11, 10, yel)
    c.rect(15, 13, 6, 10, blk)  # livrée mi-partie
    c.rect(10, 22, 11, 1, LEATHER)
    c.rect(12, 16, 3, 3, (180, 50, 40))  # écusson (la cloche)
    c.ell(15, 10, 5, 4, skin)
    face(c, 15, 10, skin, "dots", gap=4, mouth=(170, 90, 80))
    c.ell(15, 7, 8, 2, STEEL).ell(15, 5, 5, 3, STEEL)  # morion
    c.rect(15, 1, 1, 5, tone(STEEL, 1.25)).rect(14, 2, 3, 3, tone(STEEL, 1.1))
    c.line(25, 2, 25, 29, WOOD)  # hallebarde
    c.rect(26, 4, 3, 4, STEEL).rect(23, 5, 2, 2, STEEL).rect(25, 0, 1, 3, STEEL)
    return c.done()


def marmiton():
    """9. Le Marmiton : un gamin, casserole en guise de casque, armure trop grande, épée de bois et couvercle-bouclier."""
    c = C()
    skin = SKIN["clair"]
    legs(c, 12, 25, 7, 5, (110, 90, 70), (80, 60, 40))
    c.shade(9, 17, 13, 9, (150, 150, 160))  # cotte trop grande
    c.rect(9, 25, 13, 1, (150, 150, 160))
    c.rect(11, 19, 1, 6, (120, 120, 132)).rect(19, 19, 1, 6, (120, 120, 132))
    c.ell(15, 12, 6, 5, skin)  # grosse tête d'enfant
    face(c, 15, 12, skin, "tall", gap=4)
    c.px(12, 14, (230, 130, 130)).px(19, 14, (230, 130, 130))  # joues
    c.rect(9, 5, 13, 5, (180, 186, 196)).rect(9, 5, 13, 1, WHITE)  # casserole
    c.rect(22, 7, 6, 2, (90, 60, 40))  # queue de la casserole
    c.rect(9, 9, 13, 1, (110, 116, 130))
    c.ell(5, 20, 4, 4, (170, 176, 186)).px(5, 20, (90, 60, 40))  # couvercle
    c.line(25, 12, 25, 24, (190, 150, 90), 2).rect(23, 22, 6, 1, (120, 80, 40))  # épée de bois
    return c.done()


def paladine():
    """10. La Paladine dorée : armure blanche et or, longs cheveux blancs, auréole, masse d'arme rayonnante."""
    c = C()
    skin = SKIN["foncé"]
    plate = (232, 228, 214)
    legs(c, 11, 22, 9, 8, plate, GOLD)
    c.shade(9, 13, 13, 10, plate)
    c.ell(8, 14, 3, 3, GOLD).ell(22, 14, 3, 3, GOLD)
    c.rect(14, 15, 3, 3, GOLD).px(15, 14, GOLD).px(15, 18, GOLD)  # soleil sur le plastron
    c.rect(10, 22, 11, 3, (230, 230, 240))  # jupe
    c.rect(8, 7, 2, 12, (240, 240, 250)).rect(21, 7, 2, 12, (240, 240, 250))  # cheveux
    c.ell(15, 9, 5, 5, skin)
    c.rect(10, 4, 11, 3, (240, 240, 250))
    face(c, 15, 10, skin, "dots", gap=4)
    c.px(15, 6, GOLD)
    for x in range(10, 21):
        c.px(x, 1, (255, 230, 120))
    c.px(9, 2, (255, 230, 120)).px(21, 2, (255, 230, 120))  # auréole
    c.line(26, 12, 26, 26, WOOD).ell(26, 10, 3, 3, GOLD).px(26, 10, WHITE)
    c.px(26, 5, (255, 240, 160)).px(30, 10, (255, 240, 160)).px(22, 10, (255, 240, 160))
    return c.done()


def bourreau():
    """11. Le Bourreau : grande brute, cagoule de toile, tablier de cuir taché, chaînes, couperet."""
    c = C()
    skin = SKIN["clair"]
    sack = (170, 150, 110)
    legs(c, 9, 23, 13, 7, (70, 60, 56), (50, 40, 34))
    c.shade(6, 12, 19, 12, skin)  # carrure énorme
    c.ell(15, 22, 9, 3, skin)
    c.shade(10, 13, 11, 12, (110, 70, 44))  # tablier
    c.px(13, 17, (150, 40, 40)).px(17, 20, (150, 40, 40)).px(14, 21, (150, 40, 40))
    c.line(6, 13, 25, 21, IRON)  # chaîne en travers
    c.ell(15, 7, 5, 5, sack)  # petite tête encagoulée
    c.rect(12, 6, 2, 2, EYE).rect(17, 6, 2, 2, EYE)
    c.line(13, 10, 17, 10, tone(sack, 0.7))
    c.line(4, 14, 4, 24, WOOD).rect(0, 11, 5, 6, STEEL).rect(0, 11, 5, 1, WHITE)  # couperet
    return c.done()


def noir():
    """12. Le Chevalier noir : armure noire à pointes, heaume cornu à fente rouge, cape en lambeaux, épée dentelée."""
    c = C()
    plate = (54, 50, 64)
    cape = (110, 30, 40)
    c.rect(7, 13, 17, 16, cape)
    c.a[28, 7:24:3, 3] = 0
    legs(c, 10, 22, 11, 8, plate, (34, 30, 40))
    c.shade(9, 13, 13, 10, plate)
    c.rect(7, 12, 3, 3, plate).rect(21, 12, 3, 3, plate)
    c.px(7, 11, IRON).px(23, 11, IRON).px(6, 12, IRON).px(24, 12, IRON)  # pointes
    c.rect(14, 15, 3, 1, IRON).rect(15, 14, 1, 5, IRON)
    c.shade(10, 4, 11, 10, plate)
    c.rect(12, 8, 7, 1, (230, 40, 40))  # fente rouge
    c.line(10, 5, 7, 1, IRON).line(20, 5, 23, 1, IRON)  # cornes
    c.line(27, 4, 27, 21, (140, 140, 160), 2)
    for y in range(5, 20, 3):
        c.px(29, y, (140, 140, 160))
    c.rect(25, 21, 6, 1, IRON).rect(27, 22, 2, 3, (60, 30, 30))
    return c.done()


def cavaliere():
    """13. La Cavalière des steppes : longues tresses, armure d'écailles vertes, bouclier rond peint, lance."""
    c = C()
    skin = SKIN["mat"]
    scale = (70, 140, 100)
    legs(c, 11, 22, 9, 8, (140, 100, 70), (110, 60, 40), boot_h=3)
    c.shade(10, 13, 11, 10, scale)
    for y in range(14, 22, 2):
        for x in range(11 + (y // 2) % 2, 20, 2):
            c.px(x, y, tone(scale, 0.75))
    c.rect(10, 21, 11, 2, (200, 160, 60))
    c.ell(15, 9, 5, 5, skin)
    c.rect(10, 4, 11, 4, (50, 34, 30))
    c.rect(9, 7, 2, 12, (50, 34, 30)).rect(20, 7, 2, 12, (50, 34, 30))  # tresses
    c.px(9, 19, (200, 60, 50)).px(21, 19, (200, 60, 50))
    face(c, 15, 10, skin, "dots", gap=4)
    c.rect(11, 8, 9, 1, (200, 60, 50))  # bandeau peint
    c.ell(5, 19, 4, 4, (200, 70, 50)).ell(5, 19, 2, 2, (240, 200, 90)).px(5, 19, (200, 70, 50))  # bouclier rond
    c.line(26, 1, 26, 29, WOOD).rect(25, 0, 3, 3, STEEL).px(25, 4, (200, 60, 50)).px(27, 5, (200, 60, 50))
    return c.done()


def sergent():
    """14. Le Vieux Sergent : borgne à bandeau, moustache grise en guidon, gambison matelassé, pipe, bouclier cabossé."""
    c = C()
    skin = SKIN["clair"]
    gamb = (170, 160, 130)
    legs(c, 10, 22, 11, 8, (90, 80, 70), (60, 44, 32))
    c.shade(8, 13, 15, 10, gamb)
    c.ell(15, 22, 6, 3, gamb)  # bedaine
    for y in (15, 18, 21):
        c.rect(9, y, 13, 1, tone(gamb, 0.82))
    c.ell(15, 9, 5, 5, skin)
    c.rect(10, 5, 11, 2, (150, 150, 160))  # cheveux ras gris
    c.px(13, 9, EYE)
    c.rect(16, 8, 3, 2, (40, 30, 30)).line(11, 7, 20, 10, (40, 30, 30))  # bandeau
    c.rect(11, 11, 9, 1, (200, 200, 205)).px(10, 12, (200, 200, 205)).px(20, 12, (200, 200, 205))  # moustache
    c.line(18, 12, 21, 13, WOOD).rect(21, 11, 2, 2, (90, 60, 40)).px(22, 10, (200, 200, 200))  # pipe
    c.ell(25, 19, 4, 5, IRON).px(24, 17, (70, 76, 90)).px(26, 21, (70, 76, 90))  # bouclier cabossé
    c.line(4, 13, 4, 25, tone(STEEL, 1.15)).rect(2, 23, 5, 1, IRON)
    return c.done()


def poularde():
    """15. Sire Poularde : chevalier d'opérette, casque en forme de poulet, cape à carreaux, fourche, plume au vent."""
    c = C()
    skin = SKIN["clair"]
    legs(c, 11, 22, 9, 8, (110, 140, 70), (90, 60, 40))
    c.rect(8, 13, 15, 13, (200, 60, 50))
    for y in range(13, 26, 2):
        for x in range(8 + (y // 2) % 2, 23, 2):
            c.px(x, y, (230, 220, 200))  # cape à carreaux
    c.shade(10, 13, 11, 10, (130, 170, 80))
    c.rect(10, 18, 11, 1, LEATHER)
    c.ell(15, 11, 5, 4, skin)
    face(c, 15, 11, skin, "tall", gap=4)
    c.ell(15, 6, 7, 4, WHITE)  # casque poulet
    c.rect(12, 1, 2, 2, (220, 40, 40)).rect(15, 0, 2, 3, (220, 40, 40)).rect(18, 1, 2, 2, (220, 40, 40))  # crête
    c.rect(22, 5, 3, 2, (240, 170, 40)).px(21, 8, (220, 40, 40))  # bec, barbillon
    c.px(20, 4, EYE)
    c.line(4, 4, 4, 28, WOOD).rect(2, 2, 5, 1, IRON).rect(2, 0, 1, 3, IRON).rect(4, 0, 1, 2, IRON).rect(6, 0, 1, 3, IRON)
    return c.done()


def ombre():
    """16. L'Ombre-lame : silhouette fine, capuche et masque, deux dagues, ceinture de couteaux, yeux qui luisent."""
    c = C()
    cloth = (60, 70, 90)
    legs(c, 12, 21, 7, 9, (44, 50, 66), (30, 30, 40))
    c.shade(11, 12, 9, 10, cloth)
    c.rect(11, 18, 9, 1, LEATHER)
    for x in (12, 14, 16, 18):
        c.px(x, 17, STEEL)  # couteaux
    c.ell(15, 8, 6, 6, (50, 56, 76))  # capuche
    c.rect(12, 7, 7, 4, (24, 24, 34))
    face(c, 15, 8, None, "glow", gap=3)
    c.rect(12, 10, 7, 2, (80, 30, 40))  # masque
    c.line(9, 14, 4, 19, cloth).line(21, 14, 26, 19, cloth)  # bras écartés
    c.line(4, 19, 1, 24, (220, 226, 236)).line(26, 19, 29, 24, (220, 226, 236))
    c.rect(3, 19, 2, 1, GOLD).rect(26, 19, 2, 1, GOLD)
    c.line(19, 9, 26, 6, (50, 56, 76))  # pan de capuche au vent
    return c.done()


HEROES = [
    ("1. Le Heaume", "chevalier massif, tabard bleu", heaume),
    ("2. La Bête du Nord", "peau de loup, deux haches", berserker),
    ("3. La Lame errante", "chapeau de paille, sabre", errante),
    ("4. La Gladiatrice", "crête rouge, trident, filet", gladiatrice),
    ("5. Le Lansquenet", "béret à plumes, épée géante", lansquenet),
    ("6. La Chasseuse", "large bord, arbalète", chasseuse),
    ("7. Le Casseur de cailloux", "lanterne, pioche, gros bras", mineur),
    ("8. La Sentinelle", "livrée du village, hallebarde", sentinelle),
    ("9. Le Marmiton", "casserole, épée de bois", marmiton),
    ("10. La Paladine dorée", "auréole, masse rayonnante", paladine),
    ("11. Le Bourreau", "cagoule, couperet, chaînes", bourreau),
    ("12. Le Chevalier noir", "cornes, fente rouge, cape", noir),
    ("13. La Cavalière", "tresses, écailles, lance", cavaliere),
    ("14. Le Vieux Sergent", "borgne, pipe, bedaine", sergent),
    ("15. Sire Poularde", "casque poulet, fourche", poularde),
    ("16. L'Ombre-lame", "capuche, deux dagues", ombre),
]


def main():
    cols, cw, ch = 4, 230, 270
    W = 40 + cols * cw
    rows = (len(HEROES) + cols - 1) // cols
    sheet = Image.new("RGB", (W, 80 + rows * ch), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 24), "GUERRIER v8 — 16 créations originales (une silhouette, une tenue, une arme chacune)", fill=(255, 243, 200), font=font(15), anchor="mm")
    d.text((W // 2, 46), "Grand : 32 × 32 agrandi ×6. Petit, à droite : à la taille d'une case du jeu, sur le sol.", fill=(200, 190, 170), font=font(11, False), anchor="mm")
    for i, (name, sub, fn) in enumerate(HEROES):
        x = 30 + (i % cols) * cw
        y = 70 + (i // cols) * ch
        im = fn().img()
        big = up(im, 6)
        sheet.paste((70, 61, 82), (x, y, x + big.width, y + big.height))
        sheet.paste(big, (x, y), big)
        # À la taille du jeu : une case = 16 px affichée ×3 ; le héros fait ~1,3 case.
        small = im.resize((21, 21), Image.NEAREST)
        tile = Image.new("RGBA", (24, 24), (60, 58, 72, 255))
        tile.alpha_composite(small, (1, 1))
        sheet.paste(up(tile, 2), (x + big.width - 48, y + big.height - 48))
        d.text((x, y + big.height + 8), name, fill=(255, 228, 160), font=font(13))
        d.text((x, y + big.height + 28), sub, fill=(200, 190, 170), font=font(11, False))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "guerrier_v8.png")
    sheet.save(out)
    print("art/guerrier_v8.png", sheet.size)


if __name__ == "__main__":
    main()
