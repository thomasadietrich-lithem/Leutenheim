"""Section 3, l'OSSUAIRE : SOCLE AU CRÂNE ÉNORME (Thomas, 2026-11-19, 21 h 51 : « le squelette déco debout est
déstabilisant ; fais plutôt un socle avec un crâne énorme dessus, et des variantes »). Remplace le squelette assis.

Trois variantes : crâne nu, crâne fendu drapé d'un voile violet, crâne à la bougie (cire coulée, éteinte : la lune seule
éclaire). Un socle de craie à moulure, 18 × 32 pixels (une case, le crâne déborde sur la case du dessus).

  python3 art/ossuaire_socles_v1.py   → art/ossuaire_socles_v1.png (planche)
"""
import importlib.util
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ob1 = load("ossuaire_objets_v1")
Sprite = ob1.Sprite

# Le gros crâne, vu de face (12 × 11) : # os, h reflet, d ombre, o orbite, n nez, t dents.
BIG = [
    "...######...",
    ".##hhh#####.",
    "#hhh########",
    "#h##########",
    "#ooo####ooo#",
    "#ooo#dd#ooo#",
    "#ooo#dd#ooo#",
    "d####nn####d",
    ".d###nn###d.",
    "..tdtdtdtd..",
    "...dddddd...",
]
PAL = {"#": "b", "h": (240, 234, 214), "d": "bD", "o": "k", "n": "bS", "t": "b"}


def plinth(variant):
    s = Sprite(18, 32)
    o = 4  # place au-dessus du crâne (la bougie)
    r = lambda x, y, w, h, c: s.r(x, y + o, w, h, c)  # noqa: E731
    pt = lambda x, y, c: s.p(x, y + o, c)  # noqa: E731
    # socle : chapiteau, fût, base
    r(2, 12, 14, 2, "sL");r(1, 14, 16, 1, "s")
    r(4, 15, 10, 9, "s");r(4, 15, 2, 9, "sL");r(12, 15, 2, 9, "sD")
    r(7, 17, 4, 1, "sD");r(7, 21, 4, 1, "sD")
    r(1, 24, 16, 2, "s");r(1, 24, 16, 1, "sL");r(0, 26, 18, 2, "sD");r(0, 27, 18, 1, "sDD")
    # le crâne
    s.rows(3, 1 + o, BIG, {k: v for k, v in PAL.items()})
    if variant == "fendu":
        for (x, y) in ((8, 1), (8, 2), (9, 3), (9, 4), (8, 5)):
            pt(x, y, "k")
        # voile violet drapé sur le côté droit
        r(11, 2, 3, 2, "vL");r(12, 4, 3, 5, "v");r(13, 9, 2, 5, "vD");r(11, 12, 4, 2, "v")
    elif variant == "bougie":
        r(7, -3, 3, 4, (236, 230, 210));r(7, -3, 1, 4, (250, 246, 232));r(8, -4, 1, 1, "k")
        r(6, 0, 5, 1, (236, 230, 210))
        r(4, 11, 1, 2, (236, 230, 210));r(13, 11, 1, 3, (236, 230, 210))  # cire coulée
    return s.done()


SPRITES = {"socleCrane": plinth("nu"), "socleCraneFendu": plinth("fendu"), "socleCraneBougie": plinth("bougie")}


def main():
    S = 6
    ims = [Image.fromarray(sp.a, "RGBA").resize((18 * S, 32 * S), Image.NEAREST) for sp in SPRITES.values()]
    sheet = Image.new("RGB", (sum(i.width + 20 for i in ims) + 20, 32 * S + 40), (20, 18, 26))
    x = 20
    for im in ims:
        sheet.paste(im, (x, 20), im)
        x += im.width + 20
    sheet.save(os.path.join(HERE, "ossuaire_socles_v1.png"))


if __name__ == "__main__":
    main()
