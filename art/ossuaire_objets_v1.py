"""Section 3, l'OSSUAIRE : planche des OBJETS v1, dans la direction artistique v4 (craie, brume, lune seule lumière)
(Thomas, 2026-11-19, 8 h 48 : « ok continue », après les propositions : objets, escaliers, portes, salle secrète).
PROPOSITION, rien n'est en jeu.

Objets en 3/4 plongeant, contour sombre, posés sur le sol et le mur de la v4 :
- mobilier : sarcophage (fermé, ouvert), gisant, autel (sans cierge : la lune seule éclaire), urnes (petite, moyenne,
  grande, brisée avec ses cendres), os épars (rares, petit décor au sol) ;
- le PUITS DE LUNE vu de près : une margelle basse de craie, la lumière tombe dedans (aucune lune dessinée) ;
- ESCALIERS : descente (marches de craie qui plongent dans la brume) et montée ;
- PORTES : grille de fer noir (fermée, levée) et dalle de pierre qui pivote (fermée, ouverte) ;
- SECRETS : plaque funéraire qui coulisse (fermée, ouverte) et alcôve dont les crânes s'écartent (fermée, ouverte).

  python3 art/ossuaire_objets_v1.py   → art/ossuaire_objets_v1.png
"""
import importlib.util
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pix import font, grid, hash2, outline_mask, up  # noqa: E402

spec = importlib.util.spec_from_file_location("da4", os.path.join(HERE, "ossuaire_da_v4.py"))
da4 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(da4)

T = 16
OUT = (16, 14, 22, 255)
C = {
    "sL": (214, 210, 196), "s": (184, 180, 168), "sD": (138, 134, 128), "sDD": (92, 90, 96),
    "v": (112, 72, 152), "vD": (72, 46, 104), "vL": (150, 110, 190),
    "i": (44, 44, 56), "iL": (96, 98, 114), "iH": (140, 144, 160),
    "b": (222, 212, 186), "bD": (168, 156, 130), "bS": (60, 52, 44),
    "k": (14, 12, 18), "ash": (122, 120, 128), "ashD": (86, 84, 92),
    "c": (98, 106, 132), "cL": (136, 146, 172), "cD": (60, 66, 88),
    "moon": (214, 228, 255),
}


class Sprite:
    def __init__(self, w, h):
        self.a = np.zeros((h, w, 4), np.uint8)

    def r(self, x, y, w, h, c):
        col = C[c] if isinstance(c, str) else c
        self.a[max(0, y):max(0, y + h), max(0, x):max(0, x + w)] = tuple(col[:3]) + (255,)
        return self

    def p(self, x, y, c):
        return self.r(x, y, 1, 1, c)

    def rows(self, x, y, rows, pal):
        for dy, row in enumerate(rows):
            for dx, ch in enumerate(row):
                if ch != ".":
                    self.p(x + dx, y + dy, pal[ch])
        return self

    def done(self, outline=True):
        if outline:
            m = self.a[..., 3] > 0
            self.a[outline_mask(m)] = OUT
        return self

    def img(self):
        return Image.fromarray(self.a, "RGBA")


SKULL = [".###.", "#####", "#o#o#", "##n##", ".jjj."]
SK = {"#": "b", "o": "bS", "n": "bS", "j": "bD"}
SK_CARVED = {"#": "sL", "o": "sDD", "n": "sDD", "j": "sD"}


# ---------------------------------------------------------------- mobilier

def sarcophagus(open_=False):
    s = Sprite(34, 24)
    # face avant
    s.r(1, 11, 32, 11, "sD").r(1, 11, 32, 1, "s").r(1, 20, 32, 2, "sDD")
    for x in (6, 16, 26):
        s.r(x, 13, 2, 7, "sDD")
    if not open_:
        # couvercle à arête, crâne gravé
        s.r(1, 2, 32, 9, "s").r(1, 2, 32, 2, "sL").r(1, 6, 32, 1, "sD").r(1, 10, 32, 1, "sDD")
        s.rows(14, 3, SKULL, SK_CARVED)
    else:
        # caisse ouverte : intérieur noir, os dedans ; couvercle repoussé de travers sur la droite
        s.r(1, 4, 32, 7, "sD").r(3, 5, 28, 6, "k")
        s.rows(6, 5, SKULL, SK).r(12, 8, 10, 1, "bD").r(12, 7, 1, 3, "b").r(21, 7, 1, 3, "b")
        s.r(20, 0, 14, 5, "s").r(20, 0, 14, 1, "sL").r(20, 4, 14, 1, "sDD")
    return s.done()


def gisant():
    s = Sprite(34, 22)
    s.r(1, 10, 32, 11, "sD").r(1, 19, 32, 2, "sDD").r(1, 10, 32, 1, "s")
    s.r(1, 2, 32, 8, "s").r(1, 2, 32, 1, "sL").r(1, 9, 32, 1, "sDD")
    # le chevalier couché : tête à gauche, mains jointes, épée le long du corps, pieds à droite
    s.r(3, 3, 5, 5, "sL").r(4, 4, 1, 1, "sD").r(6, 4, 1, 1, "sD")
    s.r(8, 3, 18, 6, "sL").r(8, 8, 18, 1, "s")
    s.r(14, 4, 3, 3, "s").r(15, 3, 1, 5, "sD")  # mains
    s.r(10, 6, 20, 1, "sD").r(27, 5, 1, 3, "sD")  # épée
    s.r(26, 3, 5, 2, "sL").r(26, 6, 5, 2, "sL")  # pieds
    return s.done()


def altar():
    s = Sprite(50, 24)
    s.r(1, 10, 48, 13, "sD").r(1, 10, 48, 1, "s").r(1, 21, 48, 2, "sDD")
    s.r(1, 3, 48, 7, "s").r(1, 3, 48, 1, "sL").r(1, 9, 48, 1, "sDD")
    # nappe violette qui pend devant, frangée
    s.r(16, 3, 18, 7, "v").r(16, 3, 18, 1, "vL").r(16, 10, 18, 9, "v").r(16, 18, 18, 1, "vD")
    for x in range(16, 34, 2):
        s.p(x, 19, "vD")
    s.rows(22, 12, SKULL, {"#": "vL", "o": "vD", "n": "vD", "j": "vD"})
    # coupe vide (sans flamme)
    s.r(38, 0, 6, 3, "iL").r(39, 3, 4, 1, "i").r(40, 4, 2, 2, "i").r(38, 6, 6, 1, "i")
    s.r(5, 1, 7, 2, "c").r(6, 0, 5, 1, "cL")  # petite urne posée
    return s.done()


def urn(size):
    h = {"s": 10, "m": 13, "l": 16}[size]
    w = {"s": 7, "m": 9, "l": 11}[size]
    s = Sprite(w + 2, h + 2)
    cx = (w + 2) // 2
    body = []
    for y in range(h):
        t = y / h
        half = int(round((w / 2) * (0.55 + 0.45 * np.sin(np.pi * min(1, t * 1.15 + 0.1)))))
        if y < 2:
            half = max(2, w // 3)  # col
        body.append(half)
    for y, half in enumerate(body):
        s.r(cx - half, y + 1, 2 * half, 1, "c")
        s.p(cx - half, y + 1, "cL")
        s.p(cx + half - 1, y + 1, "cD")
    s.r(cx - body[0] - 1, 1, 2 * body[0] + 2, 1, "cL")
    band = int(h * 0.45)
    s.r(cx - body[band], band + 1, 2 * body[band], 1, "v")
    return s.done()


def urn_broken():
    s = Sprite(18, 10)
    s.r(2, 6, 14, 3, "ash").r(4, 5, 9, 1, "ash").r(3, 8, 12, 1, "ashD")
    s.r(1, 3, 4, 3, "c").r(1, 3, 4, 1, "cL").r(12, 2, 5, 4, "c").r(12, 2, 5, 1, "cL").r(13, 4, 3, 1, "v")
    s.r(7, 7, 3, 2, "cD")
    return s.done()


def bones():
    s = Sprite(18, 9)
    s.r(2, 4, 11, 2, "b").r(1, 3, 2, 4, "b").r(12, 3, 2, 4, "b").r(2, 5, 11, 1, "bD")
    s.rows(12, 1, [".##.", "####", "#o##", ".##."], {"#": "b", "o": "bS"})
    return s.done()


# ---------------------------------------------------------------- puits de lune, escaliers

def moon_well():
    s = Sprite(36, 26)
    # margelle basse de craie, en anneau aplati
    for y in range(26):
        for x in range(36):
            dx, dy = (x - 17.5) / 17, (y - 12.5) / 11.5
            r = dx * dx + dy * dy
            if r < 1:
                if r > 0.62:
                    s.p(x, y, "sL" if dy < -0.25 else ("s" if dy < 0.4 else "sD"))
                else:
                    s.p(x, y, "moon" if (x + y) % 2 == 0 or r < 0.4 else "sL")
    for (x, y) in ((12, 9), (20, 13), (16, 16), (23, 8)):
        s.p(x, y, (255, 255, 255))
    return s.done()


def stairs(down=True):
    """Dans une niche de mur : marches de craie ; descente : elles plongent dans la brume ; montée : elles s'élèvent."""
    s = Sprite(16, 16)
    s.r(0, 0, 16, 16, "sDD")
    for k in range(5):
        y = 1 + k * 3
        if down:
            tone = ["sL", "s", "sD", "sDD", "k"][k]
            s.r(2, y, 12, 3, tone).r(2, y + 2, 12, 1, "k" if k > 1 else "sDD")
        else:
            tone = ["k", "sDD", "sD", "s", "sL"][k]
            s.r(2, y, 12, 3, tone).r(2, y, 12, 1, "sL" if k > 2 else "sD")
    if down:
        for (x, y) in ((4, 12), (7, 13), (10, 12), (12, 14), (6, 15)):
            s.r(x, y, 3, 1, "vD")  # brume qui monte du fond
    s.r(0, 0, 2, 16, "sD").r(14, 0, 2, 16, "sD")
    return s.done(False)


# ---------------------------------------------------------------- portes et secrets

def grille(open_=False):
    s = Sprite(16, 16)
    s.r(0, 0, 2, 16, "sD").r(14, 0, 2, 16, "sD")  # jambages
    top = 0
    length = 15 if not open_ else 4
    for x in (3, 6, 9, 12):
        s.r(x, top, 1, length, "i").p(x, top + length - 1, "iH").p(x, top + length, "iL")
    s.r(2, top + 2, 12, 1, "iL").r(2, top + length - 6 if not open_ else top + 3, 12, 1, "iL")
    return s.done(False)


def slab_door(open_=False):
    s = Sprite(16, 16)
    s.r(0, 0, 2, 16, "sD").r(14, 0, 2, 16, "sD")
    if not open_:
        s.r(2, 0, 12, 16, "s").r(2, 0, 12, 1, "sL").r(13, 0, 1, 16, "sDD")
        s.rows(5, 5, SKULL, SK_CARVED)
    else:
        s.r(2, 0, 5, 16, "k").r(9, 0, 5, 16, "k")
        s.r(7, 0, 2, 16, "s").r(7, 0, 1, 16, "sL").r(8, 0, 1, 16, "sDD")  # la dalle tournée sur son axe : vue par la tranche
    return s.done(False)


def tablet_secret(open_=False):
    s = Sprite(16, 16)
    s.r(0, 0, 16, 16, "s")
    for y in (0, 8):
        s.r(0, y, 16, 1, "sD")
    if not open_:
        s.r(3, 2, 10, 12, "c").r(3, 2, 10, 1, "cL").r(12, 2, 1, 12, "cD")
        for y in (5, 8, 11):
            s.r(5, y, 6, 1, "cD")
    else:
        s.r(3, 2, 10, 14, "k")  # le passage
        s.r(11, 2, 5, 12, "c").r(11, 2, 5, 1, "cL")  # la plaque glissée de côté
    return s.done(False)


def alcove_secret(open_=False):
    s = Sprite(34, 16)
    s.r(0, 0, 34, 16, "sL")
    s.r(2, 2, 30, 14, "k")
    xs = range(3, 28, 6)
    for i, x in enumerate(xs):
        shift = 0 if not open_ else (-3 if x < 16 else 3)
        if open_ and 13 <= x <= 19:
            continue
        s.rows(x + shift, 3, SKULL, SK).rows(x + shift + 2, 8, SKULL, SK)
    if open_:
        s.r(14, 2, 6, 14, (6, 5, 8))
    return s.done(False)


# ---------------------------------------------------------------- planche


def backdrop(wt, ht, wall_rows=1):
    """Un morceau de salle v4 sans ombre : une rangée de mur de craie en haut, le sol dessous."""
    W_, H_ = wt * T, ht * T
    xs, ys = grid(W_, H_)
    floor = da4.floor_layer(xs + 40, ys + 23)
    out = floor.copy()
    for Y in range(wall_rows * T):
        for X in range(W_):
            row = Y // 8
            u = X + (row % 2) * 8
            a_, b_ = u % 16, Y % 8
            t = hash2(u // 16, row, 3)
            c = da4.chalk(float(t), 0.6)
            if a_ == 0 or b_ == 0:
                c = da4.JOINT
            out[Y, X] = c
    out[wall_rows * T - 1, :] *= 0.45
    for k in range(6):
        out[wall_rows * T + k, :] *= 0.55 + 0.075 * k
    return Image.fromarray(np.clip(out * np.array((0.86, 0.92, 1.06)), 0, 255).astype(np.uint8), "RGB")


def panel(sprite, wt, ht, at, wall_rows=1, shadow=True):
    bg = backdrop(wt, ht, wall_rows)
    im = sprite.img()
    if shadow:
        sh = Image.new("RGBA", bg.size, (0, 0, 0, 0))
        d = ImageDraw.Draw(sh)
        d.ellipse([at[0] + 2, at[1] + im.height - 4, at[0] + im.width - 2, at[1] + im.height + 2], fill=(0, 0, 0, 90))
        bg.paste(sh, (0, 0), sh)
    bg.paste(im, at, im)
    return bg


def main():
    Z = 4
    items = [
        ("Sarcophage", panel(sarcophagus(), 3, 3, (7, 18))),
        ("… ouvert", panel(sarcophagus(True), 3, 3, (7, 18))),
        ("Gisant", panel(gisant(), 3, 3, (7, 20))),
        ("Autel (sans flamme)", panel(altar(), 4, 3, (7, 18))),
        ("Urnes", None),
        ("Urne brisée", panel(urn_broken(), 2, 3, (7, 28))),
        ("Os épars (rares)", panel(bones(), 2, 3, (7, 28))),
        ("Puits de lune", panel(moon_well(), 3, 3, (6, 18), shadow=False)),
        ("Descente", panel(stairs(True), 3, 3, (16, 0), shadow=False)),
        ("Montée", panel(stairs(False), 3, 3, (16, 0), shadow=False)),
        ("Grille de fer", panel(grille(), 3, 3, (16, 0), shadow=False)),
        ("… levée", panel(grille(True), 3, 3, (16, 0), shadow=False)),
        ("Dalle pivotante", panel(slab_door(), 3, 3, (16, 0), shadow=False)),
        ("… ouverte", panel(slab_door(True), 3, 3, (16, 0), shadow=False)),
        ("Plaque secrète", panel(tablet_secret(), 3, 3, (16, 0), shadow=False)),
        ("… glissée", panel(tablet_secret(True), 3, 3, (16, 0), shadow=False)),
        ("Alcôve secrète", panel(alcove_secret(), 4, 3, (16, 0), shadow=False)),
        ("… crânes écartés", panel(alcove_secret(True), 4, 3, (16, 0), shadow=False)),
    ]
    # urnes : trois tailles sur un même morceau de sol
    bg = backdrop(3, 3)
    for (sz, x) in (("s", 6), ("m", 18), ("l", 32)):
        im = urn(sz).img()
        bg.paste(im, (x, 40 - im.height), im)
    items[4] = ("Urnes (3 tailles)", bg)
    pad = 20
    maxw = 1500
    x, y, rowh = pad, 90, 0
    placed = []
    for name, im in items:
        im = up(im, Z)
        if x + im.width > maxw - pad:
            x, y = pad, y + rowh + 50
            rowh = 0
        placed.append((name, im, x, y))
        x += im.width + pad
        rowh = max(rowh, im.height)
    Hb = y + rowh + 60
    sheet = Image.new("RGB", (maxw, Hb), (14, 12, 18))
    d = ImageDraw.Draw(sheet)
    d.text((maxw // 2, 26), "SECTION 3 · L'OSSUAIRE · objets v1", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((maxw // 2, 54), "Mobilier, puits de lune, escaliers, portes, secrets · posés sur le mur et le sol de la v4 (sans ombre) · ×4", fill=(190, 180, 160), font=font(14, False), anchor="mm")
    for name, im, x, y in placed:
        d.text((x, y - 22), name, fill=(240, 192, 80), font=font(15), anchor="lt")
        sheet.paste(im, (x, y))
    out = os.path.join(HERE, "ossuaire_objets_v1.png")
    sheet.save(out)
    print("art/ossuaire_objets_v1.png", sheet.size)


if __name__ == "__main__":
    main()
