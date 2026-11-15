"""Alambic des pièces secrètes, v1 (Thomas, 2026-11-15 : « remplace certains coffres dans les salles secrètes par un
alambic avec une couleur correspondant à sa potion ; en cliquant dessus, une fiole se remplit, et ramassage à côté ;
dans la salle alambic, pupitre grimoire, toile »).

Vue 3/4 comme les meubles : un petit fourneau de briques aux braises rouges, la cucurbite de cuivre (la cuve) dessus, son
chapiteau en dôme, le col de cygne qui descend vers la droite jusqu'au ballon de verre, plein du liquide de la potion ;
quelques bulles. Vide : le ballon est vide, les braises éteintes. Une version par potion.

  python3 art/alambic_v1.py          → art/alambic_v1.png (planche)
  python3 art/alambic_v1.py export   → src/render/sprites/alambic.ts
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from pix import outline_mask, grid, to_img
from planche import planche

OUT = (18, 13, 8, 255)
C = {
    "brick": (122, 62, 46), "brick_d": (84, 40, 32), "joint": (52, 30, 26), "ember": (255, 140, 60), "ember_d": (200, 70, 30),
    "cu_h": (240, 176, 120), "cu": (196, 118, 66), "cu_d": (130, 72, 40), "cu_dd": (86, 46, 28),
    "glass": (200, 226, 236), "glass_d": (130, 160, 176), "hi": (255, 255, 255), "cork": (150, 106, 64), "ash": (70, 64, 62),
}
POTIONS = {
    "potion_feu": (232, 120, 42), "potion_poison": (96, 200, 96), "potion_vitesse": (74, 143, 208), "potion_jouvence": (255, 220, 100),
    "potion_brouillard": (44, 40, 56), "potion_oursin": (128, 86, 50), "potion_pierre": (150, 150, 162), "potion_discorde": (240, 138, 184),
    "potion_geant": (150, 90, 210), "potion_glissante": (166, 196, 110), "potion_fumee": (184, 184, 196),
}


def shade(c, k):
    return tuple(max(0, min(255, int(v * k))) for v in c)


class S:
    def __init__(self, w, h):
        self.a = np.zeros((h, w, 4), np.uint8)

    def p(self, x, y, c):
        if 0 <= x < self.a.shape[1] and 0 <= y < self.a.shape[0]:
            v = C[c] if isinstance(c, str) else c
            self.a[y, x] = (*v[:3], 255)
        return self

    def r(self, x, y, w, h, c):
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.p(xx, yy, c)
        return self

    def ell(self, cx, cy, rx, ry, c, shade_c=None, light=None):
        for y in range(self.a.shape[0]):
            for x in range(self.a.shape[1]):
                dx, dy = (x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry
                if dx * dx + dy * dy <= 1:
                    k = c
                    if shade_c and dx + dy > 0.6:
                        k = shade_c
                    if light and dx + dy < -0.7:
                        k = light
                    self.p(x, y, k)
        return self

    def done(self):
        m = self.a[..., 3] > 0
        o = outline_mask(m) & ~m
        self.a[o] = OUT
        return self

    def img(self):
        return Image.fromarray(self.a, "RGBA")


def alembic(potion=None, phase=0):
    """`potion` : l'id de la potion (couleur du liquide) ; None : vide, braises éteintes. 22 × 30."""
    s = S(22, 30)
    lit = potion is not None
    # Le fourneau de briques (bas, 4 rangées), sa bouche aux braises.
    s.r(2, 21, 12, 8, "brick")
    for y in (23, 26):
        s.r(2, y, 12, 1, "joint")
    for y, off in ((21, 0), (24, 3), (27, 1)):
        for x in range(2 + off, 14, 5):
            s.p(x, y, "joint").p(x, y + 1, "joint")
    s.r(2, 28, 12, 1, "brick_d").r(13, 21, 1, 8, "brick_d")
    s.r(5, 25, 6, 3, "joint")
    if lit:
        for x in range(5, 11):
            s.p(x, 26, "ember" if (x + phase) % 2 else "ember_d").p(x, 27, "ember_d")
        s.p(6 + phase % 3, 25, "ember")
    else:
        s.r(5, 26, 6, 2, "ash")
    # La cucurbite de cuivre, posée sur le fourneau.
    s.ell(8, 17, 6.2, 5, "cu", "cu_d", "cu_h")
    s.r(3, 20, 11, 1, "cu_dd")
    # Le chapiteau (dôme) et son col.
    s.ell(8, 10, 3.6, 3.2, "cu", "cu_d", "cu_h")
    s.r(7, 12, 3, 2, "cu_d")
    s.r(8, 6, 1, 2, "cu_dd").p(8, 5, "cu")
    # Le col de cygne : de la tête du dôme, il file à droite et descend vers le ballon.
    for i, (x, y) in enumerate(((11, 9), (12, 9), (13, 9), (14, 10), (15, 11), (16, 12), (16, 13), (17, 14), (17, 15))):
        s.p(x, y, "cu" if i % 3 else "cu_h").p(x, y + 1, "cu_dd")
    # Le ballon de verre (à droite, posé au sol), plein de la potion.
    liquid = POTIONS.get(potion)
    s.ell(17.5, 24, 3.8, 4.2, "glass", "glass_d")
    s.r(16, 17, 3, 3, "glass").r(16, 16, 3, 1, "cork")
    if liquid:
        for y in range(23, 29):
            for x in range(14, 22):
                if s.a[y, x, 3] and tuple(s.a[y, x, :3]) in (C["glass"], C["glass_d"]):
                    s.p(x, y, shade(liquid, 0.75 if x > 18 else 1.0))
        s.p(15, 23, shade(liquid, 1.25))
        # Des bulles qui montent dans le ballon.
        for k, (x, y) in enumerate(((17, 25), (18, 23), (16, 26))):
            if (k + phase) % 3 != 2:
                s.p(x, y - (phase % 2), shade(liquid, 1.5))
    s.p(16, 21, "hi").p(16, 22, "hi")
    return s.done()


def potion_keys():
    return {k: "Alambic" + k.split("_")[1].capitalize() for k in POTIONS}


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        from export_jeu_v4 import write
        sprites = {}
        for pid, name in potion_keys().items():
            for ph in range(2):
                sprites[f"{name[0].lower() + name[1:]}{ph}"] = alembic(pid, ph).img()
        sprites["alambicVide"] = alembic(None).img()
        write("src/render/sprites/alambic.ts", "ALAMBIC", "Alambic des pièces secrètes (art/alambic_v1.png, 2026-11-15) : une version par potion (2 images), vide.", sprites)
    else:
        W, H = 12 * 16, 4 * 16
        xs, ys = grid(W, H)
        room = Image.new("RGBA", (W, H), (40, 34, 46, 255))
        for i, pid in enumerate(POTIONS):
            im = alembic(pid).img()
            room.alpha_composite(im, ((i % 6) * 32 + 4, (i // 6) * 32 + 32 - im.height + 2 if False else (i // 6) * 32))
        planche("ALAMBIC v1 — une couleur par potion ; vide (fiole tirée)", room, [
            ("feu / poison / vitesse / jouvence", [alembic(p).img() for p in ("potion_feu", "potion_poison", "potion_vitesse", "potion_jouvence")]),
            ("brouillard / oursin / pierre / discorde", [alembic(p).img() for p in ("potion_brouillard", "potion_oursin", "potion_pierre", "potion_discorde")]),
            ("géant / glissante / fumée / vide", [alembic(p).img() for p in ("potion_geant", "potion_glissante", "potion_fumee")] + [alembic(None).img()]),
            ("bulles et braises (2 images)", [alembic("potion_feu", 0).img(), alembic("potion_feu", 1).img()]),
        ], "art/alambic_v1.png", S=3)
