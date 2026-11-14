"""Planche « guerrier_v7 » (Thomas, 2026-11-14 : « garde la grille pour le guerrier humain, mais génère plutôt une
nouvelle proposition de guerrier, 16 options, sans les déclinaisons avec équipement »). PROPOSITION.

Seize HUMAINS GUERRIERS différents, tous sur le squelette de la grille paperdoll (24 × 24, mêmes repères : l'équipement
se posera ensuite par-dessus), en tenue de départ (épée courte) : coiffure, barbe, carrure, visage, couleurs, détails
(cape, écharpe, bandeau, cicatrice…). Le but : un héros moins générique, reconnaissable d'un coup d'œil.
  python3 art/guerrier_v7.py → art/guerrier_v7.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

import paperdoll_v1 as pd  # noqa: E402
from pix import font, up  # noqa: E402

R = pd.RACES["humain"]
HX0, HY0, HX1, HY1 = R["head"]
TX0, TY0, TX1, TY1 = R["torso"]
OUT = pd.OUT

HAIRS = {
    "brun": ((128, 78, 40), (176, 118, 62)),
    "noir": ((40, 32, 40), (80, 66, 78)),
    "roux": ((170, 70, 30), (226, 120, 54)),
    "blond": ((206, 170, 80), (244, 216, 130)),
    "gris": ((130, 130, 140), (190, 190, 200)),
    "châtain": ((96, 60, 34), (140, 92, 52)),
}
SKINS = {
    "clair": ((238, 190, 145), (198, 142, 100)),
    "mat": ((200, 150, 104), (160, 112, 74)),
    "foncé": ((134, 90, 60), (100, 64, 42)),
    "pâle": ((246, 214, 182), (212, 176, 146)),
}


def base(d, skin, shirt, pants, boots=(90, 62, 40)):
    s, s2 = SKINS[skin]
    d.rect((HX0, HY0 + 2, HX1, HY1), s, shade=s2)
    d.rect(R["torso"], shirt[0], shade=shirt[1])
    for a in (R["armL"], R["armR"]):
        d.rect(a, shirt[0], shade=shirt[1])
        d.put(a[0], a[3] + 1, s)
        d.put(a[2], a[3] + 1, s2)
    for leg in (R["legL"], R["legR"]):
        d.rect(leg, pants[0], shade=pants[1])
        d.rect((leg[0], R["foot"] - 1, leg[2] + (1 if leg is R["legR"] else 0), R["foot"]), boots)
    return s, s2


def eyes(d, s, style="points", col=OUT):
    ey = HY0 + 4
    cx = (HX0 + HX1) // 2
    if style == "points":
        d.put(cx - 2, ey, col)
        d.put(cx + 1, ey, col)
        if s[0] < 160:  # peau foncée : le blanc de l'œil, pour qu'on le voie
            d.put(cx - 3, ey, (244, 247, 255)); d.put(cx + 2, ey, (244, 247, 255))
    elif style == "froncés":
        d.put(cx - 2, ey, col); d.put(cx + 1, ey, col)
        if s[0] < 160:
            d.put(cx - 3, ey, (244, 247, 255)); d.put(cx + 2, ey, (244, 247, 255))
        d.put(cx - 3, ey - 1, col); d.put(cx + 2, ey - 1, col)
    elif style == "bandeau":  # bandeau sur l'œil
        d.put(cx + 1, ey, col)
        for x in range(HX0, HX1 + 1):
            d.put(x, ey - 1 if x > cx else ey - 2 + (x - HX0) // 3, (40, 32, 40))
        d.put(cx - 2, ey, (40, 32, 40)); d.put(cx - 3, ey, (40, 32, 40))
    elif style == "grands":
        for dx in (-2, 1):
            d.put(cx + dx, ey, (244, 247, 255)); d.put(cx + dx + (1 if dx < 0 else 0), ey, OUT)


def hair(d, kind, col):
    h, h2 = col
    if kind == "court":
        d.rect((HX0, HY0, HX1, HY0 + 1), h, light=h2)
        d.put(HX0, HY0 + 2, h); d.put(HX1, HY0 + 2, h)
    elif kind == "long":
        d.rect((HX0 - 1, HY0, HX1 + 1, HY0 + 1), h, light=h2)
        for y in range(HY0 + 2, HY1 + 3):
            d.put(HX0 - 1, y, h); d.put(HX1 + 1, y, h)
    elif kind == "queue":
        d.rect((HX0, HY0, HX1, HY0 + 1), h, light=h2)
        for y in range(HY0 + 2, HY0 + 7):
            d.put(HX1 + 1, y, h)
        d.put(HX1 + 2, HY0 + 6, h)
    elif kind == "crête":
        for y in range(HY0 - 3, HY0 + 1):
            d.put((HX0 + HX1) // 2, y, h); d.put((HX0 + HX1) // 2 + 1, y, h2)
    elif kind == "rasé":
        for x in range(HX0, HX1 + 1):
            d.put(x, HY0 + 2, h2)
    elif kind == "boucles":
        for x in range(HX0 - 1, HX1 + 2, 2):
            d.put(x, HY0 - 1, h2)
        d.rect((HX0 - 1, HY0, HX1 + 1, HY0 + 2), h, light=h2)
        d.put(HX0 - 1, HY0 + 3, h); d.put(HX1 + 1, HY0 + 3, h)
    elif kind == "tresses":
        d.rect((HX0, HY0, HX1, HY0 + 1), h, light=h2)
        for y in range(HY0 + 2, HY1 + 5):
            d.put(HX0 - 1, y, h if y % 2 else h2); d.put(HX1 + 1, y, h if y % 2 else h2)
    elif kind == "chignon":
        d.rect((HX0, HY0, HX1, HY0 + 1), h, light=h2)
        d.rect(((HX0 + HX1) // 2 - 1, HY0 - 3, (HX0 + HX1) // 2 + 1, HY0 - 1), h, light=h2)
    elif kind == "mèche":
        d.rect((HX0, HY0, HX1, HY0 + 1), h, light=h2)
        for i in range(4):
            d.put(HX0 + i, HY0 + 2 + i // 2, h)


def beard(d, kind, col):
    h, h2 = col
    cy = HY1
    if kind == "barbe":
        d.rect((HX0, cy - 2, HX1, cy + 1), h, light=h2)
        d.put((HX0 + HX1) // 2, cy - 1, (150, 80, 70))  # bouche
    elif kind == "moustache":
        for x in range(HX0 + 2, HX1 - 1):
            d.put(x, cy - 2, h)
        d.put(HX0 + 1, cy - 1, h); d.put(HX1 - 1, cy - 1, h)
    elif kind == "bouc":
        d.rect(((HX0 + HX1) // 2 - 1, cy - 1, (HX0 + HX1) // 2 + 1, cy + 1), h, light=h2)
    elif kind == "favoris":
        for y in range(HY0 + 3, cy + 1):
            d.put(HX0, y, h); d.put(HX1, y, h)


def extra(d, kind):
    cx = (HX0 + HX1) // 2
    if kind == "cape":
        for y in range(TY0, R["foot"]):
            d.put(TX0 - 2, y, (150, 40, 40)); d.put(TX1 + 2, y, (110, 22, 26))
        d.put(TX0 - 1, TY0, (150, 40, 40)); d.put(TX1 + 1, TY0, (110, 22, 26))
    elif kind == "écharpe":
        for x in range(TX0, TX1 + 1):
            d.put(x, TY0, (74, 143, 208))
        d.put(TX1 - 1, TY0 + 1, (74, 143, 208)); d.put(TX1 - 1, TY0 + 2, (42, 90, 148))
    elif kind == "bandeau":
        for x in range(HX0, HX1 + 1):
            d.put(x, HY0 + 2, (208, 58, 68))
        d.put(HX1 + 1, HY0 + 3, (208, 58, 68)); d.put(HX1 + 2, HY0 + 4, (142, 31, 40))
    elif kind == "cicatrice":
        d.put(cx - 2, HY0 + 3, (190, 80, 80)); d.put(cx - 2, HY0 + 5, (190, 80, 80)); d.put(cx - 3, HY0 + 6, (190, 80, 80))
    elif kind == "épaulière":
        d.rect((R["armL"][0] - 1, R["armL"][1], R["armL"][2] + 1, R["armL"][1] + 1), (122, 82, 48), light=(185, 130, 74))
    elif kind == "ceinture":
        for x in range(TX0, TX1 + 1):
            d.put(x, TY1 - 1, (240, 192, 80) if x == cx else (80, 50, 24))
        for x in range(TX0, TX1 + 1):
            d.put(x, TY1, (80, 50, 24))
    elif kind == "sacoche":
        d.rect((TX1 - 1, TY1 - 2, TX1 + 1, TY1), (150, 98, 48), shade=(98, 62, 30))
        for i in range(TY1 - TY0 - 2):
            d.put(TX0 + i, TY0 + i, (98, 62, 30))
    elif kind == "plume":
        d.put(HX1, HY0 - 1, (240, 192, 80)); d.put(HX1 + 1, HY0 - 2, (240, 192, 80)); d.put(HX1 + 1, HY0 - 3, (244, 216, 130))


def sword(d):
    hand = (R["armR"][0], R["armR"][3] + 1)
    for y in range(hand[1] - 6, hand[1]):
        d.put(hand[0] + 2, y, (224, 230, 236))
    d.put(hand[0] + 1, hand[1] - 1, (132, 142, 156)); d.put(hand[0] + 3, hand[1] - 1, (132, 142, 156))
    d.put(hand[0] + 2, hand[1] + 1, (122, 82, 48))


W = ((242, 238, 226), (196, 190, 176))
OPTIONS = [
    ("1. Le recrue", dict(skin="clair", shirt=W, pants=((110, 96, 120), (80, 70, 92)), hair=("court", "brun"), eyes="points")),
    ("2. Le balafré", dict(skin="mat", shirt=((150, 98, 48), (98, 62, 30)), pants=((70, 60, 50), (50, 42, 36)), hair=("rasé", "noir"), beard=("favoris", "noir"), eyes="froncés", extra=["cicatrice", "ceinture"])),
    ("3. La rousse", dict(skin="pâle", shirt=((74, 143, 208), (42, 90, 148)), pants=((110, 96, 120), (80, 70, 92)), hair=("queue", "roux"), eyes="grands", extra=["ceinture"])),
    ("4. Le vétéran", dict(skin="clair", shirt=((120, 120, 130), (90, 90, 100)), pants=((70, 60, 50), (50, 42, 36)), hair=("court", "gris"), beard=("barbe", "gris"), eyes="froncés", extra=["épaulière"])),
    ("5. Le mercenaire", dict(skin="foncé", shirt=((150, 40, 40), (110, 22, 26)), pants=((50, 42, 36), (36, 30, 26)), hair=("tresses", "noir"), eyes="points", extra=["ceinture"])),
    ("6. Le chevalier errant", dict(skin="clair", shirt=W, pants=((74, 143, 208), (42, 90, 148)), hair=("mèche", "blond"), eyes="points", extra=["cape"])),
    ("7. Le pirate", dict(skin="mat", shirt=((226, 218, 196), (190, 180, 160)), pants=((150, 40, 40), (110, 22, 26)), hair=("long", "noir"), beard=("moustache", "noir"), eyes="bandeau", extra=["bandeau"])),
    ("8. La bagarreuse", dict(skin="foncé", shirt=((92, 200, 96), (46, 122, 56)), pants=((70, 60, 50), (50, 42, 36)), hair=("chignon", "noir"), eyes="froncés", extra=["ceinture"])),
    ("9. Le paysan", dict(skin="clair", shirt=((226, 200, 140), (190, 160, 100)), pants=((122, 82, 48), (90, 56, 23)), hair=("boucles", "châtain"), eyes="grands", extra=["sacoche"])),
    ("10. Le barbare", dict(skin="mat", shirt=((185, 130, 74), (122, 82, 48)), pants=((70, 60, 50), (50, 42, 36)), hair=("long", "roux"), beard=("barbe", "roux"), eyes="froncés", extra=["épaulière"])),
    ("11. Le cadet", dict(skin="pâle", shirt=((208, 58, 68), (142, 31, 40)), pants=((242, 238, 226), (196, 190, 176)), hair=("court", "blond"), eyes="grands", extra=["plume"])),
    ("12. La pisteuse", dict(skin="clair", shirt=((60, 110, 70), (40, 80, 50)), pants=((96, 80, 60), (70, 58, 44)), hair=("tresses", "châtain"), eyes="points", extra=["écharpe", "sacoche"])),
    ("13. Le moine-soldat", dict(skin="foncé", shirt=((226, 200, 140), (190, 160, 100)), pants=((226, 200, 140), (190, 160, 100)), hair=("rasé", "noir"), eyes="points", extra=["ceinture", "écharpe"])),
    ("14. Le duelliste", dict(skin="pâle", shirt=((40, 32, 40), (24, 18, 30)), pants=((40, 32, 40), (24, 18, 30)), hair=("court", "noir"), beard=("bouc", "noir"), eyes="points", extra=["cape", "plume"])),
    ("15. Le forgeron", dict(skin="mat", shirt=((120, 120, 130), (90, 90, 100)), pants=((96, 80, 60), (70, 58, 44)), hair=("crête", "brun"), beard=("favoris", "brun"), eyes="froncés", extra=["épaulière", "ceinture"])),
    ("16. Le héros du village", dict(skin="clair", shirt=((242, 238, 226), (196, 190, 176)), pants=((110, 96, 120), (80, 70, 92)), hair=("boucles", "brun"), eyes="grands", extra=["écharpe", "ceinture"])),
]


def make(o):
    d = pd.Doll()
    s, s2 = base(d, o["skin"], o["shirt"], o["pants"])
    extra_list = o.get("extra", [])
    if "cape" in extra_list:
        extra(d, "cape")
    hk, hc = o["hair"]
    hair(d, hk, HAIRS[hc])
    eyes(d, s, o.get("eyes", "points"))
    if o.get("beard"):
        bk, bc = o["beard"]
        beard(d, bk, HAIRS[bc])
    for e in extra_list:
        if e != "cape":
            extra(d, e)
    sword(d)
    return d.image()


def main():
    S = 6
    cell = 24 * S + 20
    cols = 4
    W_ = 40 + cols * (cell + 20)
    H = 80 + 4 * (cell + 46) + 40
    sheet = Image.new("RGB", (W_, H), (26, 20, 14))
    dr = ImageDraw.Draw(sheet)
    dr.text((W_ // 2, 24), "GUERRIER HUMAIN v7 — 16 propositions (squelette de la grille paperdoll, tenue de départ)", fill=(255, 243, 200), font=font(14), anchor="mm")
    dr.text((W_ // 2, 46), "Coiffure, visage, barbe, couleurs, petits détails ; l'équipement se posera ensuite par-dessus.", fill=(200, 190, 170), font=font(11, False), anchor="mm")
    for i, (name, o) in enumerate(OPTIONS):
        im = up(make(o), S)
        x = 40 + (i % cols) * (cell + 20)
        y = 70 + (i // cols) * (cell + 46)
        sheet.paste((54, 46, 64), (x, y, x + cell, y + cell))
        sheet.paste(im, (x + 10, y + 10), im)
        small = up(make(o), 2)  # à la taille du jeu (environ)
        sheet.paste(small, (x + cell - small.width - 4, y + cell - small.height - 4), small)
        dr.text((x + cell // 2, y + cell + 14), name, fill=(220, 210, 190), font=font(12, False), anchor="mm")
    sheet.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "guerrier_v7.png"))
    print("art/guerrier_v7.png", sheet.size)


if __name__ == "__main__":
    main()
