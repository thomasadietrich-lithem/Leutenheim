"""Planche « héros v10 » (Thomas, 2026-11-14 : « je veux 16 designs ORIGINAUX, et après on fait des variations » ; le n° 2
de la v9 lui plaît). PROPOSITION.

Seize DESIGNS différents de NOTRE héros (Humain Guerrier, niveau 1, équipement de départ : tunique, épée courte, arc
court, carquois). Ce ne sont plus des variations d'un même gabarit : chacun a sa propre construction (proportions,
silhouette, pose, angle de vue, façon de dessiner : contour, ombres, palette). On en choisira un, puis on fera ses
variations.
  python3 art/heros_v10.py → art/heros_v10.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up  # noqa: E402
from heros_v9 import Canvas as _Canvas, k, ramp, SKINS, HAIR, BLADE, WOOD, LEATHER, STRING, FLETCH, hero as v9_hero, BASE as V9_BASE  # noqa: E402
import heros_v9  # noqa: E402

class Canvas(_Canvas):
    """Comme celle de la v9, mais chaque trait renvoie la toile (on enchaîne)."""

    def px(self, *a):
        super().px(*a)
        return self

    def rect(self, *a):
        super().rect(*a)
        return self

    def line(self, *a):
        super().line(*a)
        return self

    def ell(self, *a):
        super().ell(*a)
        return self


SKIN = SKINS["clair"]
EYE = (34, 26, 34)
WHITE = (248, 246, 240)


def outline_with(c, color):
    """Contour d'une autre couleur que le noir (pour les styles « contour teinté »)."""
    from pix import outline_mask
    m = c.a[..., 3] > 0
    c.a[outline_mask(m)] = tuple(color) + (255,)


# 1 ------------------------------------------------------------------------------------------------------------
def chibi():
    """1. MIGNON : deux têtes de haut, tête ronde énorme, grands yeux brillants, petit corps, épée-jouet."""
    c = Canvas()
    sh, b, li = ramp(SKIN)
    c.ell(25, 18, 1.6, 6, WOOD)  # arc derrière
    c.rect(13, 25, 3, 5, (90, 80, 72)).rect(17, 25, 3, 5, (90, 80, 72))
    c.rect(12, 28, 4, 2, (110, 72, 44)).rect(17, 28, 4, 2, (110, 72, 44))
    c.ell(16, 22, 6, 4.5, (236, 230, 214))
    c.rect(10, 23, 12, 2, (110, 72, 44)).px(16, 23, (200, 190, 160))
    c.ell(16, 11, 10, 9, b)
    c.ell(16, 6, 10.5, 6, HAIR["châtain"])
    c.rect(6, 6, 3, 8, HAIR["châtain"]).rect(23, 6, 3, 8, HAIR["châtain"])
    c.px(12, 2, k(HAIR["châtain"], 1.3)).px(13, 2, k(HAIR["châtain"], 1.3))
    for ex in (10, 19):
        c.rect(ex, 11, 3, 4, EYE)
        c.px(ex, 11, WHITE).px(ex + 1, 11, WHITE).px(ex + 2, 14, (110, 140, 200))
    c.px(9, 16, (240, 150, 140)).px(23, 16, (240, 150, 140))
    c.rect(15, 16, 2, 1, k(SKIN, 0.6))
    c.rect(5, 21, 2, 2, b).line(5, 20, 3, 14, BLADE).line(4, 20, 2, 14, k(BLADE, 1.2))
    c.outline()
    return c


# 2 ------------------------------------------------------------------------------------------------------------
def trois_quarts():
    """2. ÉLANCÉ DE TROIS-QUARTS : trois têtes de haut, corps tourné, épée tenue devant à deux mains."""
    c = Canvas()
    tunic = (214, 206, 186)
    c.line(9, 6, 9, 22, WOOD).line(10, 6, 10, 22, k(WOOD, 0.75))  # arc dans le dos, de biais
    c.rect(19, 5, 3, 8, k(LEATHER, 0.8)).px(19, 4, FLETCH).px(21, 3, FLETCH)
    c.rect(13, 22, 3, 7, (84, 74, 66)).rect(17, 22, 3, 6, k((84, 74, 66), 0.8))
    c.rect(12, 28, 5, 2, (100, 64, 40)).rect(17, 27, 4, 2, k((100, 64, 40), 0.8))
    c.rect(12, 12, 8, 11, tunic).rect(12, 12, 2, 11, k(tunic, 1.15)).rect(18, 12, 2, 11, k(tunic, 0.78))
    c.rect(11, 20, 10, 3, tunic).rect(11, 22, 10, 1, k(tunic, 0.75))
    c.rect(12, 18, 8, 1, (96, 60, 36))
    c.line(12, 12, 19, 18, k(LEATHER, 0.85))
    c.ell(16, 7, 4.2, 4.6, SKIN)
    c.ell(15, 4.2, 4.6, 2.8, HAIR["brun"]).rect(11, 4, 2, 4, HAIR["brun"])
    c.px(17, 7, EYE).px(19, 7, EYE).px(20, 9, k(SKIN, 0.7))
    c.rect(19, 15, 3, 2, SKIN).rect(20, 13, 2, 2, tunic)  # mains jointes devant
    c.line(21, 14, 26, 3, BLADE).line(22, 14, 27, 3, k(BLADE, 0.7))
    c.outline()
    return c


# 3 ------------------------------------------------------------------------------------------------------------
def pastel():
    """3. CONTOUR TEINTÉ ET PASTEL : pas de noir, contours brun chaud, couleurs douces de livre d'images."""
    c = Canvas()
    tunic, pants, hair = (246, 236, 214), (170, 186, 206), (176, 106, 78)
    c.line(6, 9, 6, 24, (200, 160, 110))
    c.rect(12, 23, 3, 6, pants).rect(17, 23, 3, 6, pants)
    c.rect(11, 28, 4, 2, (196, 140, 110)).rect(17, 28, 4, 2, (196, 140, 110))
    c.rect(10, 13, 12, 11, tunic).rect(9, 21, 14, 3, tunic)
    c.rect(10, 19, 12, 1, (200, 150, 120))
    c.rect(7, 14, 3, 7, tunic).rect(22, 14, 3, 7, tunic).rect(7, 21, 3, 2, SKIN).rect(22, 21, 3, 2, SKIN)
    c.ell(16, 8, 6, 5.4, SKIN)
    c.ell(16, 4.6, 6.6, 3.4, hair).rect(10, 4, 2, 5, hair).rect(21, 4, 2, 5, hair)
    c.rect(13, 8, 1, 2, (110, 80, 80)).rect(18, 8, 1, 2, (110, 80, 80))
    c.px(11, 10, (250, 180, 170)).px(20, 10, (250, 180, 170))
    c.rect(23, 23, 1, 6, (210, 220, 236))
    outline_with(c, (140, 96, 76))
    return c


# 4 ------------------------------------------------------------------------------------------------------------
def sombre():
    """4. DARK FANTASY : palette éteinte, cape usée, visage dans l'ombre de la capuche, seuls les yeux et la lame clairs."""
    c = Canvas()
    cape = (62, 58, 60)
    c.rect(9, 12, 14, 16, cape)
    for x in range(9, 23, 2):
        c.px(x, 28, cape)
    c.rect(12, 26, 3, 4, (40, 38, 42)).rect(17, 26, 3, 4, (40, 38, 42))
    c.rect(12, 14, 8, 10, (96, 88, 78))
    c.rect(12, 20, 8, 1, (60, 44, 32))
    c.ell(16, 8, 6.6, 6.4, k(cape, 1.1))
    c.ell(16, 9.4, 4.4, 4.2, (40, 34, 36))
    c.px(14, 9, (220, 200, 160)).px(18, 9, (220, 200, 160))
    c.line(16, 1, 16, 3, k(cape, 1.3))
    c.rect(21, 14, 2, 8, cape).rect(21, 22, 2, 2, (150, 120, 96))
    c.line(22, 24, 22, 30, (190, 196, 206))
    c.line(10, 6, 7, 2, (110, 80, 50)).px(7, 1, (180, 180, 170))  # bout de l'arc
    c.outline()
    return c


# 5 ------------------------------------------------------------------------------------------------------------
def icone():
    """5. ICÔNE ULTRA-LISIBLE : quatre couleurs, gros aplats, lisible même à 16 px (pensé pour la case du jeu)."""
    c = Canvas()
    W_, R, B, S_ = (240, 236, 224), (176, 60, 52), (96, 60, 40), (236, 184, 140)
    c.rect(11, 22, 4, 7, B).rect(17, 22, 4, 7, B)
    c.rect(9, 12, 14, 12, W_)
    c.rect(9, 18, 14, 2, R)
    c.rect(6, 13, 3, 8, W_).rect(23, 13, 3, 8, W_)
    c.rect(6, 21, 3, 2, S_).rect(23, 21, 3, 2, S_)
    c.rect(10, 3, 12, 10, S_)
    c.rect(10, 2, 12, 4, B).rect(10, 2, 2, 7, B).rect(20, 2, 2, 7, B)
    c.rect(13, 7, 2, 2, (30, 24, 30)).rect(18, 7, 2, 2, (30, 24, 30))
    c.rect(24, 10, 2, 11, W_).rect(23, 21, 4, 1, B)
    c.outline()
    return c


# 6 ------------------------------------------------------------------------------------------------------------
def course():
    """6. EN MOUVEMENT : pose de course, penché en avant, cheveux et écharpe au vent, épée tendue derrière."""
    c = Canvas()
    tunic = (226, 218, 196)
    c.line(4, 16, 11, 13, (180, 60, 50)).line(3, 17, 10, 14, (150, 46, 40))  # écharpe au vent
    c.line(11, 22, 8, 28, (90, 80, 72)).line(12, 22, 9, 28, (90, 80, 72))  # jambe arrière
    c.rect(6, 28, 4, 2, (106, 70, 44))
    c.line(18, 22, 22, 27, (90, 80, 72)).line(19, 22, 23, 27, (90, 80, 72))
    c.rect(21, 27, 5, 2, (106, 70, 44))
    for y in range(12, 23):
        c.rect(11 + (22 - y) // 3, y, 9, 1, tunic)
    c.rect(11, 19, 9, 1, (96, 60, 36))
    c.ell(20, 8, 5, 4.8, SKIN)
    c.ell(18, 5, 5.4, 3, HAIR["roux"]).line(12, 4, 15, 6, HAIR["roux"]).line(12, 6, 15, 7, HAIR["roux"])
    c.px(22, 8, EYE).px(24, 9, k(SKIN, 0.7)).px(22, 11, k(SKIN, 0.6))
    c.rect(24, 14, 3, 2, SKIN).line(19, 13, 25, 14, tunic)  # bras qui pousse
    c.line(12, 16, 7, 20, tunic).rect(5, 20, 2, 2, SKIN).line(5, 21, 1, 25, BLADE)  # épée derrière
    c.rect(14, 9, 3, 6, k(LEATHER, 0.8)).px(14, 8, FLETCH).px(16, 8, FLETCH)
    c.outline()
    return c


# 7 ------------------------------------------------------------------------------------------------------------
def manteau():
    """7. LA CLOCHE DE LAINE : grand manteau qui enveloppe tout (silhouette en triangle), tête et épée qui dépassent."""
    c = Canvas()
    coat = (120, 96, 70)
    for y in range(12, 29):
        half = 4 + (y - 12) * 0.55
        c.rect(round(16 - half), y, round(half * 2), 1, coat)
    for y in range(12, 29):
        c.px(16, y, k(coat, 0.75))
    c.rect(9, 28, 15, 1, k(coat, 0.7))
    c.rect(12, 29, 3, 1, (90, 60, 40)).rect(17, 29, 3, 1, (90, 60, 40))
    c.rect(12, 12, 9, 2, k(coat, 1.25))  # col relevé
    c.ell(16, 8, 5, 5, SKIN)
    c.ell(16, 5, 5.6, 2.8, HAIR["noir"])
    c.px(14, 8, EYE).px(18, 8, EYE)
    c.rect(20, 17, 2, 2, SKIN).line(21, 16, 25, 6, BLADE)
    c.line(6, 6, 9, 13, WOOD)
    c.outline()
    return c


# 8 ------------------------------------------------------------------------------------------------------------
def echarpe():
    """8. L'ÉCHARPE : longue écharpe qui cache le bas du visage, seuls les yeux et une mèche ; silhouette en T."""
    c = Canvas()
    scarf, tunic = (170, 64, 58), (196, 186, 160)
    c.rect(12, 22, 3, 7, (80, 72, 64)).rect(17, 22, 3, 7, (80, 72, 64))
    c.rect(11, 28, 4, 2, (100, 66, 42)).rect(17, 28, 4, 2, (100, 66, 42))
    c.rect(11, 13, 10, 11, tunic).rect(6, 13, 20, 3, tunic)  # bras écartés
    c.rect(5, 15, 2, 2, SKIN).rect(25, 15, 2, 2, SKIN)
    c.rect(11, 19, 10, 1, (96, 60, 36))
    c.ell(16, 7, 5, 5, SKIN)
    c.ell(16, 4, 5.4, 2.8, HAIR["blond"]).line(18, 3, 21, 7, HAIR["blond"])
    c.px(14, 7, EYE).px(18, 7, EYE)
    c.rect(10, 9, 12, 5, scarf).rect(10, 9, 12, 1, k(scarf, 1.2))
    c.line(19, 13, 23, 22, scarf).line(20, 13, 24, 22, k(scarf, 0.75))
    c.line(26, 15, 29, 7, BLADE)
    c.outline()
    return c


# 9 ------------------------------------------------------------------------------------------------------------
def de_dos():
    """9. DE DOS, LE REGARD PAR-DESSUS L'ÉPAULE : on voit le carquois et l'arc, l'aventure est devant lui."""
    c = Canvas()
    tunic = (210, 200, 176)
    c.rect(12, 22, 3, 7, (84, 74, 66)).rect(17, 22, 3, 7, (84, 74, 66))
    c.rect(11, 28, 4, 2, (100, 64, 40)).rect(17, 28, 4, 2, (100, 64, 40))
    c.rect(10, 13, 12, 10, tunic).rect(9, 21, 14, 2, tunic).rect(10, 19, 12, 1, (96, 60, 36))
    c.rect(7, 14, 3, 7, tunic).rect(22, 14, 3, 7, tunic)
    c.rect(7, 21, 3, 2, SKIN).rect(22, 21, 3, 2, SKIN)
    c.line(12, 6, 20, 24, WOOD).line(13, 6, 21, 24, k(WOOD, 0.75))  # arc en travers du dos
    c.rect(16, 8, 4, 10, k(LEATHER, 0.85)).rect(16, 8, 4, 1, k(LEATHER, 1.2))
    for x in (16, 17, 18, 19):
        c.px(x, 7, FLETCH)
    c.ell(14, 7, 5.4, 5, HAIR["brun"])
    c.rect(9, 7, 2, 3, SKIN).px(9, 8, EYE)  # profil qui regarde en arrière
    c.line(23, 23, 23, 29, BLADE)
    c.outline()
    return c


# 10 -----------------------------------------------------------------------------------------------------------
def carre():
    """10. CARTOON CARRÉ : tête carrée, grosse mâchoire, nez rond, petits yeux ; trapu, bras épais."""
    c = Canvas()
    tunic = (224, 210, 180)
    c.rect(11, 24, 4, 5, (90, 80, 72)).rect(17, 24, 4, 5, (90, 80, 72))
    c.rect(10, 28, 5, 2, (100, 64, 40)).rect(17, 28, 5, 2, (100, 64, 40))
    c.rect(8, 14, 16, 11, tunic).rect(8, 14, 16, 1, k(tunic, 1.15))
    c.rect(8, 21, 16, 2, (96, 60, 36)).rect(15, 21, 2, 2, (200, 190, 160))
    c.rect(5, 15, 4, 8, SKIN).rect(23, 15, 4, 8, SKIN)
    c.rect(9, 3, 14, 12, SKIN).rect(9, 12, 14, 3, k(SKIN, 0.9))
    c.rect(9, 2, 14, 3, HAIR["noir"]).rect(9, 2, 2, 5, HAIR["noir"])
    c.px(12, 7, EYE).px(19, 7, EYE).rect(11, 6, 3, 1, HAIR["noir"]).rect(18, 6, 3, 1, HAIR["noir"])
    c.ell(16, 9.5, 2, 1.6, k(SKIN, 0.85))
    c.rect(13, 12, 6, 1, k(SKIN, 0.55))
    c.line(27, 22, 27, 11, BLADE).rect(26, 22, 3, 2, (96, 62, 38))
    c.outline()
    return c


# 11 -----------------------------------------------------------------------------------------------------------
def chapeau():
    """11. LE CHAPEAU DE FEUTRE : feutre mou de paysan, longue tunique jusqu'aux genoux, silhouette en A."""
    c = Canvas()
    tunic, hat = (186, 170, 130), (108, 92, 70)
    c.rect(13, 25, 2, 4, (80, 72, 64)).rect(17, 25, 2, 4, (80, 72, 64))
    c.rect(12, 28, 3, 2, (90, 60, 40)).rect(17, 28, 3, 2, (90, 60, 40))
    for y in range(13, 26):
        half = 4 + (y - 13) * 0.35
        c.rect(round(16 - half), y, round(half * 2), 1, tunic)
    c.rect(11, 18, 10, 1, (96, 60, 36))
    c.ell(16, 9, 4.6, 4.4, SKIN)
    c.px(14, 9, EYE).px(18, 9, EYE)
    c.ell(16, 5.5, 9, 1.8, hat).ell(16, 3.6, 4.4, 2.6, hat).line(12, 4, 20, 4, k(hat, 0.75))
    c.rect(21, 18, 2, 2, SKIN).line(22, 20, 22, 27, BLADE)
    c.line(9, 7, 7, 20, WOOD)
    c.outline()
    return c


# 12 -----------------------------------------------------------------------------------------------------------
def cagoule():
    """12. LA COIFFE DE LAINE : cagoule de laine tricotée qui encadre le visage (pas un casque : un bonnet de pauvre)."""
    c = Canvas()
    wool, tunic = (150, 132, 108), (214, 204, 180)
    c.rect(12, 22, 3, 7, (84, 74, 66)).rect(17, 22, 3, 7, (84, 74, 66))
    c.rect(11, 28, 4, 2, (100, 64, 40)).rect(17, 28, 4, 2, (100, 64, 40))
    c.rect(10, 15, 12, 9, tunic).rect(9, 21, 14, 2, tunic).rect(10, 19, 12, 1, (96, 60, 36))
    c.rect(7, 16, 3, 6, tunic).rect(22, 16, 3, 6, tunic).rect(7, 21, 3, 2, SKIN).rect(22, 21, 3, 2, SKIN)
    c.ell(16, 9, 7, 7, wool)
    c.rect(9, 13, 14, 3, wool)  # le col de la coiffe sur les épaules
    for y in range(4, 16, 2):
        for x in range(9 + (y // 2) % 2, 23, 2):
            c.px(x, y, k(wool, 0.84))
    c.ell(16, 9.6, 4, 3.6, SKIN)
    c.px(14, 9, EYE).px(18, 9, EYE).rect(15, 11, 2, 1, k(SKIN, 0.6))
    c.line(24, 21, 27, 12, BLADE)
    c.outline()
    return c


# 13 -----------------------------------------------------------------------------------------------------------
def gravure():
    """13. GRAVURE : monochrome sépia, ombres en hachures, comme une illustration de vieux livre."""
    c = Canvas()
    ink, paper, mid = (64, 44, 30), (236, 218, 180), (180, 150, 110)
    c.rect(12, 22, 3, 7, mid).rect(17, 22, 3, 7, mid)
    c.rect(11, 28, 4, 2, ink).rect(17, 28, 4, 2, ink)
    c.rect(10, 13, 12, 10, paper).rect(9, 21, 14, 2, paper)
    for y in range(13, 23):
        for x in range(18, 22):
            if (x + y) % 2 == 0:
                c.px(x, y, mid)
    c.rect(10, 19, 12, 1, ink)
    c.rect(7, 14, 3, 7, paper).rect(22, 14, 3, 7, mid)
    c.ell(16, 8, 5.6, 5.2, paper)
    for y in range(4, 13):
        if y % 2:
            c.px(20, y, mid).px(21, y, mid)
    c.ell(16, 4.6, 6, 3, ink)
    c.px(13, 8, ink).px(18, 8, ink).rect(15, 11, 2, 1, ink)
    c.line(24, 22, 24, 29, ink).line(6, 8, 6, 22, ink)
    outline_with(c, ink)
    return c


# 14 -----------------------------------------------------------------------------------------------------------
def pointes():
    """14. HÉROS DE JRPG : cheveux en pointes, grands yeux colorés, foulard, épée au poing levé."""
    c = Canvas()
    tunic, hair = (232, 226, 210), (90, 70, 150)
    c.rect(12, 23, 3, 6, (70, 70, 90)).rect(17, 23, 3, 6, (70, 70, 90))
    c.rect(11, 28, 4, 2, (130, 70, 40)).rect(17, 28, 4, 2, (130, 70, 40))
    c.rect(10, 14, 12, 10, tunic).rect(10, 20, 12, 1, (130, 70, 40))
    c.rect(11, 13, 10, 2, (60, 110, 180)).line(20, 14, 23, 17, (60, 110, 180))
    c.rect(7, 15, 3, 7, tunic).rect(7, 21, 3, 2, SKIN)
    c.rect(22, 9, 3, 6, tunic).rect(22, 7, 3, 2, SKIN).line(23, 6, 27, 0, BLADE)
    c.ell(16, 8.4, 5.6, 5, SKIN)
    for x, h in ((9, 4), (11, 6), (13, 7), (16, 8), (19, 7), (21, 6), (23, 4)):
        c.line(x, 6, x + (1 if x > 16 else -1), 6 - h, hair)
    c.ell(16, 5, 6.4, 2.6, hair)
    for ex in (12, 18):
        c.rect(ex, 8, 2, 3, (40, 90, 160)).px(ex, 8, WHITE)
    c.rect(15, 12, 2, 1, k(SKIN, 0.6))
    c.outline()
    return c


# 15 -----------------------------------------------------------------------------------------------------------
def voyageur():
    """15. LE BALUCHON : gros sac à dos d'aventurier (couverture roulée, gourde, poêle) — il part avec tout ce qu'il a."""
    c = Canvas()
    tunic, bag = (220, 210, 186), (140, 110, 70)
    c.rect(7, 9, 18, 14, bag).rect(7, 9, 18, 1, k(bag, 1.2))
    c.ell(16, 7, 9, 2.2, (170, 60, 50)).line(8, 7, 24, 7, k((170, 60, 50), 0.75))  # couverture roulée
    c.ell(25.5, 17, 2, 2.6, (90, 120, 140))  # gourde
    c.ell(6, 15, 2.4, 2.4, (70, 70, 80)).line(4, 13, 2, 10, (70, 70, 80))  # poêle
    c.rect(12, 22, 3, 7, (84, 74, 66)).rect(17, 22, 3, 7, (84, 74, 66))
    c.rect(11, 28, 4, 2, (100, 64, 40)).rect(17, 28, 4, 2, (100, 64, 40))
    c.rect(10, 14, 12, 9, tunic).rect(10, 19, 12, 1, (96, 60, 36))
    c.rect(11, 14, 1, 6, LEATHER).rect(20, 14, 1, 6, LEATHER)  # bretelles
    c.ell(16, 10, 5, 4.6, SKIN)
    c.ell(16, 7, 5.4, 2.4, HAIR["châtain"])
    c.px(14, 10, EYE).px(18, 10, EYE).rect(15, 13, 2, 1, k(SKIN, 0.6))
    c.line(23, 21, 23, 28, BLADE)
    c.outline()
    return c


# 16 -----------------------------------------------------------------------------------------------------------
def nes():
    """16. 8 BITS : trois couleurs et le noir, contour épais, yeux en points — comme une cartouche des années 80."""
    c = Canvas()
    A, B_, C_ = (252, 216, 168), (0, 120, 248), (172, 124, 0)
    for y in range(4, 28, 2):
        pass
    c.rect(10, 4, 12, 4, C_)
    c.rect(10, 8, 12, 6, A)
    c.rect(12, 9, 2, 2, (0, 0, 0)).rect(18, 9, 2, 2, (0, 0, 0))
    c.rect(8, 14, 16, 8, B_)
    c.rect(6, 14, 2, 6, A).rect(24, 14, 2, 6, A)
    c.rect(10, 22, 4, 6, C_).rect(18, 22, 4, 6, C_)
    c.rect(26, 6, 2, 12, (252, 252, 252)).rect(25, 18, 4, 2, C_)
    c.rect(8, 18, 16, 2, C_)
    c.outline()
    from pix import outline_mask
    m = c.a[..., 3] > 0
    c.a[outline_mask(m)] = (0, 0, 0, 255)
    return c


def v9_two():
    cfg = dict(V9_BASE)
    cfg.update(dict(cut="padded", tunic=(190, 176, 140), style="short", pose="guard", brows=True, bracers=True))
    return v9_hero(cfg)


DESIGNS = [
    ("1. Mignon", "2 têtes de haut, yeux immenses", chibi),
    ("2. Élancé, trois-quarts", "3 têtes, corps tourné, épée devant", trois_quarts),
    ("3. Livre d'images", "contour brun, couleurs pastel", pastel),
    ("4. Dark fantasy", "cape usée, visage dans l'ombre", sombre),
    ("5. Icône", "4 couleurs, lisible à 16 px", icone),
    ("6. En mouvement", "pose de course, écharpe au vent", course),
    ("7. Le manteau", "silhouette en triangle", manteau),
    ("8. L'écharpe", "bas du visage caché, en T", echarpe),
    ("9. De dos", "regard par-dessus l'épaule", de_dos),
    ("10. Cartoon carré", "tête carrée, trapu", carre),
    ("11. Le feutre", "chapeau mou, tunique longue", chapeau),
    ("12. La coiffe de laine", "cagoule tricotée", cagoule),
    ("13. Gravure", "sépia, ombres en hachures", gravure),
    ("14. Héros de JRPG", "cheveux en pointes, épée levée", pointes),
    ("15. Le baluchon", "gros sac, poêle, gourde", voyageur),
    ("16. 8 bits", "3 couleurs, contour épais", nes),
]


def main():
    cols, cw, ch = 4, 230, 285
    W = 40 + cols * cw
    rows = (len(DESIGNS) + cols - 1) // cols
    sheet = Image.new("RGB", (W, 90 + rows * ch), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 22), "NOTRE HÉROS, niveau 1 — 16 DESIGNS ORIGINAUX (on choisit, puis on fait les variations)", fill=(255, 243, 200), font=font(14), anchor="mm")
    d.text((W // 2, 44), "Même personnage, même équipement de départ ; chaque case est une autre façon de le dessiner.", fill=(200, 190, 170), font=font(11, False), anchor="mm")
    d.text((W // 2, 60), "Grand : 32 × 32 agrandi ×6 ; petit, en bas à droite : à la taille d'une case du jeu.", fill=(200, 190, 170), font=font(11, False), anchor="mm")
    for i, (name, sub, fn) in enumerate(DESIGNS):
        im = fn().img()
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
        d.text((x, y + big.height + 27), sub, fill=(200, 190, 170), font=font(11, False))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "heros_v10.png")
    sheet.save(out)
    print("art/heros_v10.png", sheet.size)


if __name__ == "__main__":
    main()
