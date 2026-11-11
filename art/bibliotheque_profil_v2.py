"""Bibliothèque DE PROFIL, v2 (Thomas, 2026-11-11 : « les bibliothèques de profil sont moches »). Trois propositions,
posées contre le mur de gauche d'un coin d'alchimiste, à côté de la bibliothèque de face (validée) pour comparer.

A « dessus et bout » : on voit le DESSUS du meuble (planches, quelques livres couchés, une bougie) et son BOUT tourné vers
  nous (la face du bas), rien de biais. Le plus sobre, comme les lits et les bancs.
B « rayons en biais » : un dessus étroit et la face des rayons vue en biais, livres debout bien lisibles, montants épais.
C « pas de profil » : contre les murs de côté, on remplace la bibliothèque par une PILE DE LIVRES ET UN LUTRIN (1 case),
  et les vraies bibliothèques restent de face, au mur du fond.
Écrit art/bibliotheque_profil_v2.png. Lancer depuis la racine du dépôt.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from pix import grid, to_img, font, hash2
from dortoir_v2 import Sprite, C, T, walls
from sols_v1 import floor_b
from planche import planche
import forge_alchimie_v1 as fa  # palette (oak, book_…) et bibliothèque de face

BOOKS = ["book_r", "book_b", "book_g", "book_y"]


def side_a():
    """A : dessus (8 × 32) puis bout (8 × 12). Contre le mur de GAUCHE (le dessin se retourne pour la droite)."""
    s = Sprite(12, 44)
    s.r(1, 42, 11, 2, "shadow")
    # Dessus : cadre de chêne, planches, quelques livres couchés et une bougie.
    s.r(0, 0, 10, 32, "oak_l").r(0, 0, 10, 1, "oak_h").r(0, 0, 1, 32, "oak_h").r(9, 0, 1, 32, "oak_d")
    for y in (8, 16, 24):
        s.r(1, y, 8, 1, "oak")
    s.r(2, 3, 6, 2, "book_r").r(2, 3, 6, 1, "page").r(3, 5, 5, 2, "book_b").r(3, 5, 5, 1, "page")
    s.r(2, 19, 5, 2, "book_g").r(2, 19, 5, 1, "page")
    s.r(5, 27, 2, 3, "page").p(5, 26, "flame")
    # Le bord des rayons, côté salle : une rangée de dos de livres très étroite (on devine les livres).
    for y in range(1, 31):
        if y % 8 != 0:
            s.p(10, y, BOOKS[int(hash2(10, y, 901) * 4)])
    s.r(11, 0, 1, 32, "oak_d")
    # Bout tourné vers nous : panneau de chêne, deux traverses.
    s.r(0, 32, 12, 10, "oak").r(0, 32, 12, 1, "oak_h").r(0, 36, 12, 1, "oak_d").r(0, 40, 12, 1, "oak_d").r(1, 33, 1, 8, "oak_l")
    return s.done()


def side_b():
    """B : dessus étroit (4 px) et face des rayons en biais (9 px) : 4 rayons, livres debout, montants épais."""
    s = Sprite(16, 46)
    s.r(1, 44, 15, 2, "shadow")
    s.r(0, 0, 4, 34, "oak_l").r(0, 0, 4, 1, "oak_h")                       # dessus
    s.r(4, 0, 2, 36, "oak").r(14, 2, 2, 42, "oak_d")                       # montants avant et arrière (le bas descend : biais)
    s.r(6, 1, 8, 42, "oak_d")                                              # fond des rayons
    for i in range(4):
        top = 1 + i * 10
        for x in range(6, 14):
            lean = (x - 6) // 4                                            # le rayon s'incline : il descend vers la salle
            h = 6 + int(hash2(x, top, 950 + i) * 3)
            c = BOOKS[int(hash2(x, top, 960 + i) * 4)]
            if hash2(x, top, 970) > 0.88:
                continue
            s.r(x, top + 8 - h + lean, 1, h, c).p(x, top + 8 - h + lean, "page")
        for x in range(4, 16):
            s.p(x, top + 9 + (x - 4) // 4, "oak_l")                        # planche du rayon
    s.r(4, 36, 12, 8, "oak").r(4, 36, 12, 1, "oak_h")                       # socle
    return s.done()


def side_c():
    """C : pas de profil. Lutrin de chêne avec un gros livre, et une pile de livres au pied (1 case)."""
    s = Sprite(16, 22)
    s.r(1, 20, 14, 2, "shadow")
    s.r(2, 14, 7, 6, "book_b").r(2, 14, 7, 1, "page").r(3, 11, 6, 3, "book_r").r(3, 11, 6, 1, "page").r(2, 9, 7, 2, "book_y").r(2, 9, 7, 1, "page")
    s.r(11, 8, 2, 12, "oak").r(9, 18, 6, 2, "oak_d").r(9, 5, 6, 4, "oak_l").r(9, 5, 6, 1, "oak_h")
    s.r(8, 2, 8, 4, "page").r(11, 2, 2, 4, "book_r")
    return s.done()


def mirror(sp):
    out = Sprite(sp.a.shape[1], sp.a.shape[0])
    out.a = sp.a[:, ::-1].copy()
    return out


if __name__ == "__main__":
    C.update({"flame": (255, 200, 90, 255)})
    rooms = []
    for label, make, h in (("A", side_a, 2), ("B", side_b, 2), ("C", side_c, 1)):
        IW, IH = 5, 5
        W, Hh = (IW + 2) * T, (IH + 2) * T
        xs, ys = grid(W, Hh)
        base = walls(IW, IH)
        fl = floor_b(xs, ys)
        base[T:T + IH * T, T:T + IW * T] = fl[T:T + IH * T, T:T + IW * T]
        room = to_img(base).convert("RGBA")
        def put(sp, cx, cy, ox=0, oy=0):
            im = sp.img()
            room.alpha_composite(im, ((cx + 1) * T + ox, (cy + 1) * T + T - im.height + oy))
        put(fa.bookcase_front(), 2, 1, oy=-1)
        sp = make()
        if h == 2:
            put(sp, 0, 3)
            put(mirror(sp), 4, 4, ox=16 - sp.a.shape[1])
        else:
            put(sp, 0, 3)
            put(mirror(sp), 4, 3)
        d = ImageDraw.Draw(room)
        d.text((4, 2), label, fill=(255, 230, 170), font=font(12, False))
        rooms.append(room)
    W = sum(r.width for r in rooms) + 16 * (len(rooms) - 1)
    sheet = Image.new("RGBA", (W, rooms[0].height), (26, 20, 14, 255))
    x = 0
    for r in rooms:
        sheet.alpha_composite(r, (x, 0))
        x += r.width + 16
    planche("BIBLIOTHÈQUE DE PROFIL v2 — trois propositions (A, B, C), à côté de celle de face", sheet, [
        ("A : dessus et bout (2 cases)", [side_a().img(), mirror(side_a()).img()]),
        ("B : rayons en biais (2 cases)", [side_b().img(), mirror(side_b()).img()]),
        ("C : lutrin et pile de livres (1 case)", [side_c().img(), mirror(side_c()).img()]),
    ], "art/bibliotheque_profil_v2.png", S=3,
        note="A : sobre, comme les lits et les bancs. B : on voit les livres, en biais. C : plus de bibliothèque de profil du tout.")
