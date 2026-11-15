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
    """v2 TOUT EN VERRE (Thomas, 2026-11-15 : « l'alambic dépasse sur le mur ; fais plutôt un design à base de verre ») :
    compact (18 × 18, il ne monte presque plus sur la case du dessus) : une lampe à huile sous un trépied de fer, le
    ballon de verre rond plein de la potion, un fin tube de verre qui descend vers une petite fiole posée à droite.
    Vide : ballon et fiole vides, lampe éteinte. `potion` : l'id de la potion (couleur du liquide)."""
    s = S(18, 18)
    liquid = POTIONS.get(potion)
    lit = potion is not None
    # La lampe à huile (laiton) et sa flamme bleue.
    s.r(3, 15, 5, 2, "cu").r(3, 15, 5, 1, "cu_h").r(7, 15, 1, 2, "cu_d")
    s.p(5, 14, "cu_d")
    if lit:
        s.p(5, 13, (120, 190, 255)).p(5, 12 - phase % 2, (200, 230, 255)).p(4 + phase % 2, 13, (90, 150, 240))
    # Le trépied de fer : deux pieds et l'anneau.
    for (x0, y0, x1, y1) in ((1, 16, 3, 11), (9, 16, 8, 11)):
        n = max(abs(x1 - x0), abs(y1 - y0))
        for i in range(n + 1):
            s.p(round(x0 + (x1 - x0) * i / n), round(y0 + (y1 - y0) * i / n), (70, 70, 80))
    s.r(2, 11, 8, 1, (90, 90, 104))
    # Le ballon de verre, rond, sur l'anneau.
    for y in range(18):
        for x in range(18):
            dx, dy = (x + 0.5 - 6) / 3.6, (y + 0.5 - 7.5) / 3.4
            if dx * dx + dy * dy <= 1:
                full = liquid and y >= 7
                c = shade(liquid, 0.8 if dx > 0.3 else 1.0) if full else ("glass_d" if dx > 0.4 else "glass")
                s.p(x, y, c)
    s.p(4, 6, "hi").p(4, 5, "hi")
    # Le col et son bouchon.
    s.r(5, 2, 2, 3, "glass").p(6, 2, "glass_d").r(5, 1, 2, 1, "cork")
    # Le tube de verre qui descend vers la fiole.
    for x, y in ((7, 3), (8, 3), (9, 4), (10, 5), (11, 6), (12, 7), (13, 8), (13, 9)):
        s.p(x, y, "glass_d" if (x + y) % 3 == 0 else "glass")
    # La petite fiole qui recueille, posée au sol à droite.
    s.r(12, 10, 3, 1, "cork")
    for y in range(11, 17):
        w = 1 if y < 13 else 2
        for x in range(13 - w + 1, 14 + w):
            c = "glass_d" if x == 14 + w - 1 else "glass"
            if liquid and y >= 14 - (1 if lit else 0):
                c = shade(liquid, 0.85 if x >= 14 else 1.0)
            s.p(x, y, c)
    if liquid:
        # Une goutte qui tombe du tube, des bulles dans le ballon.
        if phase % 2 == 0:
            s.p(13, 10, shade(liquid, 1.3))
        for k, (x, y) in enumerate(((6, 9), (7, 8), (5, 10))):
            if (k + phase) % 3 != 2:
                s.p(x, y - (phase % 2), shade(liquid, 1.45))
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
        write("src/render/sprites/alambic.ts", "ALAMBIC", "Alambic des pièces secrètes v2, tout en verre (art/alambic_v2.png, 2026-11-15) : une version par potion (2 images), vide.", sprites)
    else:
        W, H = 12 * 16, 4 * 16
        xs, ys = grid(W, H)
        room = Image.new("RGBA", (W, H), (40, 34, 46, 255))
        for i, pid in enumerate(POTIONS):
            im = alembic(pid).img()
            room.alpha_composite(im, ((i % 6) * 32 + 4, (i // 6) * 32 + 32 - im.height + 2 if False else (i // 6) * 32))
        planche("ALAMBIC v2 — tout en verre, compact : une couleur par potion ; vide (fiole tirée)", room, [
            ("feu / poison / vitesse / jouvence", [alembic(p).img() for p in ("potion_feu", "potion_poison", "potion_vitesse", "potion_jouvence")]),
            ("brouillard / oursin / pierre / discorde", [alembic(p).img() for p in ("potion_brouillard", "potion_oursin", "potion_pierre", "potion_discorde")]),
            ("géant / glissante / fumée / vide", [alembic(p).img() for p in ("potion_geant", "potion_glissante", "potion_fumee")] + [alembic(None).img()]),
            ("bulles et braises (2 images)", [alembic("potion_feu", 0).img(), alembic("potion_feu", 1).img()]),
        ], "art/alambic_v2.png", S=3)
