"""Planche « paperdoll_v1 » (Thomas, 2026-11-13 : « un sprite qui se mette à jour selon l'équipement ; un squelette par
race ; réfléchis déjà au halfelin et à l'elfe »). PROPOSITION, rien n'est en jeu.

Principe : chaque personnage est un empilement de COUCHES de 24 × 24 pixels, dessinées dans cet ordre :
  1. le corps de la race (peau, cheveux, sous-vêtements) — « le squelette » ;
  2. les jambes et les bottes de l'armure ;
  3. le torse de l'armure (et les épaules) ;
  4. la tête : le casque par-dessus les cheveux ;
  5. l'arme dans la main droite (ou les deux mains).
Chaque couche connaît les repères de la race (où sont la tête, le torse, les mains) : une armure se dessine une fois et
s'adapte aux trois races. Un contour sombre est posé à la fin, autour de l'ensemble.

  python3 art/paperdoll_v1.py → art/paperdoll_v1.png
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up  # noqa: E402

N = 24
OUT = (24, 18, 30)
SKIN = {"humain": ((238, 190, 145), (198, 142, 100)), "halfelin": ((240, 196, 150), (200, 146, 104)), "elfe": ((246, 222, 196), (214, 182, 156))}
HAIR = {"humain": ((128, 78, 40), (176, 118, 62)), "halfelin": ((150, 96, 40), (196, 140, 70)), "elfe": ((232, 214, 140), (250, 240, 190))}

# Repères de chaque race : boîtes (x0, y0, x1, y1) inclusives.
RACES = {
    "humain": dict(head=(8, 2, 15, 9), torso=(7, 10, 16, 16), armL=(5, 10, 6, 15), armR=(17, 10, 18, 15), legL=(8, 17, 10, 21), legR=(13, 17, 15, 21), foot=22, ears=False),
    "halfelin": dict(head=(7, 4, 16, 12), torso=(8, 13, 15, 17), armL=(6, 13, 7, 17), armR=(16, 13, 17, 17), legL=(9, 18, 10, 20), legR=(13, 18, 14, 20), foot=21, ears=False),
    "elfe": dict(head=(9, 1, 14, 8), torso=(8, 9, 15, 15), armL=(6, 9, 7, 15), armR=(16, 9, 17, 15), legL=(9, 16, 10, 21), legR=(13, 16, 14, 21), foot=22, ears=True),
}


class Doll:
    def __init__(self):
        self.px = {}

    def put(self, x, y, c):
        if 0 <= x < N and 0 <= y < N:
            self.px[(x, y)] = c

    def rect(self, box, c, shade=None, light=None):
        x0, y0, x1, y1 = box
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                col = c
                if shade and x == x1:
                    col = shade
                if light and x == x0:
                    col = light
                self.put(x, y, col)

    def image(self):
        img = Image.new("RGBA", (N, N), (0, 0, 0, 0))
        for (x, y), c in self.px.items():
            img.putpixel((x, y), c + (255,))
        # Contour : toute case vide qui touche une case pleine devient sombre.
        out = img.copy()
        for y in range(N):
            for x in range(N):
                if img.getpixel((x, y))[3]:
                    continue
                if any(0 <= x + dx < N and 0 <= y + dy < N and img.getpixel((x + dx, y + dy))[3] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                    out.putpixel((x, y), OUT + (255,))
        return out


def body(d, race):
    r = RACES[race]
    skin, skin2 = SKIN[race]
    hair, hair2 = HAIR[race]
    hx0, hy0, hx1, hy1 = r["head"]
    d.rect((hx0, hy0 + 2, hx1, hy1), skin, shade=skin2)
    # cheveux : dessus et côtés
    d.rect((hx0, hy0, hx1, hy0 + 2), hair, light=hair2)
    d.put(hx0, hy0 + 3, hair)
    d.put(hx1, hy0 + 3, hair)
    if race == "elfe":
        for y in range(hy0 + 3, hy1 + 2):
            d.put(hx0 - 1, y, hair2)
            d.put(hx1 + 1, y, hair)
        d.put(hx0 - 2, hy0 + 4, skin)
        d.put(hx1 + 2, hy0 + 4, skin)  # oreilles pointues
        d.put(hx0 - 3, hy0 + 3, skin)
        d.put(hx1 + 3, hy0 + 3, skin)
    if race == "halfelin":
        for x in (hx0 + 1, hx1 - 1):
            d.put(x, hy0 - 1, hair2)  # boucles
    ey = hy0 + 4 + (1 if race == "halfelin" else 0)
    cx = (hx0 + hx1) // 2
    d.put(cx - 2, ey, OUT)
    d.put(cx + 2 if (hx1 - hx0) % 2 else cx + 1, ey, OUT)
    d.put(cx, ey + 2, skin2)
    # chemise, pantalon, mains, pieds nus ou bottes simples
    d.rect(r["torso"], (226, 218, 196), shade=(190, 180, 160))
    for a in (r["armL"], r["armR"]):
        d.rect(a, (226, 218, 196), shade=(190, 180, 160))
        d.put(a[0], a[3] + 1, skin)
        d.put(a[2], a[3] + 1, skin2)
    for leg in (r["legL"], r["legR"]):
        d.rect(leg, (110, 96, 120), shade=(80, 70, 92))
        foot = r["foot"]
        if race == "halfelin":
            d.rect((leg[0] - 1, foot, leg[2] + 1, foot + 1), skin, shade=skin2)  # grands pieds nus
            d.put(leg[0] - 1, foot, hair)
        else:
            d.rect((leg[0], foot, leg[2] + (1 if leg is r["legR"] else 0), foot), (90, 62, 40))


ARMORS = {
    "tunique": dict(main=(242, 238, 226), dark=(196, 190, 176), belt=(150, 98, 48)),
    "cuir": dict(main=(150, 98, 48), dark=(98, 62, 30), belt=(80, 50, 24), strap=(196, 160, 96)),
    "mailles": dict(main=(160, 168, 186), dark=(110, 118, 136), belt=(98, 62, 30), mail=True),
    "plate": dict(main=(196, 204, 222), dark=(126, 134, 160), belt=(84, 90, 112), plate=True, light=(244, 247, 255)),
    "draconique": dict(main=(178, 46, 40), dark=(110, 22, 26), belt=(240, 192, 80), scales=True, light=(240, 120, 60), spikes=(236, 214, 170)),
}


def armor(d, race, kind):
    r = RACES[race]
    a = ARMORS[kind]
    tx0, ty0, tx1, ty1 = r["torso"]
    d.rect(r["torso"], a["main"], shade=a["dark"], light=a.get("light"))
    for arm in (r["armL"], r["armR"]):
        d.rect((arm[0], arm[1], arm[2], arm[3] - (1 if kind in ("tunique", "cuir") else 0)), a["main"], shade=a["dark"])
    by = ty1 - 1
    for x in range(tx0, tx1 + 1):
        d.put(x, by, a["belt"])
    d.put((tx0 + tx1) // 2, by, (240, 192, 80))  # boucle
    if a.get("strap"):
        for i in range(ty1 - ty0):
            d.put(tx0 + 1 + i, ty0 + i, a["strap"])
    if a.get("mail"):
        for y in range(ty0, by):
            for x in range(tx0, tx1 + 1):
                if (x + y) % 2 == 0:
                    d.put(x, y, a["dark"])
    if a.get("plate"):
        for x in range(tx0, tx1 + 1):
            d.put(x, ty0 + 2, a["dark"])
            d.put(x, ty0 + 4, a["dark"])
        for arm in (r["armL"], r["armR"]):  # épaulières
            d.rect((arm[0] - 1, arm[1], arm[2] + 1, arm[1] + 1), a["main"], light=a["light"], shade=a["dark"])
        for leg in (r["legL"], r["legR"]):
            d.rect((leg[0], leg[1], leg[2], leg[3]), a["main"], shade=a["dark"], light=a["light"])
            d.put((leg[0] + leg[2]) // 2, leg[1] + 2, a["light"])  # genouillère
    if a.get("scales"):
        for y in range(ty0, by):
            for x in range(tx0, tx1 + 1):
                if (x + 2 * y) % 4 == 0:
                    d.put(x, y, a["dark"])
                elif (x + 2 * y) % 4 == 2:
                    d.put(x, y, a["light"])
        for arm in (r["armL"], r["armR"]):
            d.rect((arm[0] - 1, arm[1], arm[2] + 1, arm[1] + 1), a["dark"])
            d.put(arm[0] - 1 if arm is r["armL"] else arm[2] + 1, arm[1] - 1, a["spikes"])  # pointes d'épaule
        for leg in (r["legL"], r["legR"]):
            d.rect(leg, a["dark"], shade=(70, 14, 18))
    if kind in ("cuir", "mailles", "draconique", "plate"):
        for leg in (r["legL"], r["legR"]):
            foot = r["foot"]
            if race != "halfelin":
                d.rect((leg[0], foot - 1, leg[2] + (1 if leg is r["legR"] else 0), foot), (70, 46, 28) if kind != "plate" else a["dark"])


HELMETS = ("aucun", "cuir", "maille", "heaume", "poulet")


def helmet(d, race, kind):
    r = RACES[race]
    hx0, hy0, hx1, hy1 = r["head"]
    if kind == "aucun":
        return
    if kind == "cuir":
        d.rect((hx0, hy0 - 1, hx1, hy0 + 2), (150, 98, 48), shade=(98, 62, 30), light=(196, 160, 96))
    elif kind == "maille":
        d.rect((hx0 - 1, hy0 - 1, hx1 + 1, hy0 + 2), (160, 168, 186), shade=(110, 118, 136))
        for y in range(hy0 + 3, hy1 + 1):
            d.put(hx0 - 1, y, (160, 168, 186))
            d.put(hx1 + 1, y, (110, 118, 136))
        for x in range(hx0, hx1 + 1):
            d.put(x, hy1 + 1, (160, 168, 186))
    elif kind == "heaume":
        d.rect((hx0 - 1, hy0 - 1, hx1 + 1, hy1 + 1), (196, 204, 222), shade=(126, 134, 160), light=(244, 247, 255))
        ey = hy0 + 4 + (1 if race == "halfelin" else 0)
        for x in range(hx0, hx1 + 1):
            d.put(x, ey, OUT)  # fente de la visière
        for y in range(ey + 2, hy1 + 1):
            d.put((hx0 + hx1) // 2, y, (126, 134, 160))
        d.put((hx0 + hx1) // 2, hy0 - 2, (208, 58, 68))  # plumet
        d.put((hx0 + hx1) // 2 + 1, hy0 - 3, (208, 58, 68))
    elif kind == "poulet":
        # Le CASQUE POULET (Thomas) : une tête de poule en plumes blanches, crête rouge, bec jaune au front.
        d.rect((hx0 - 1, hy0 - 1, hx1 + 1, hy0 + 3), (246, 242, 230), shade=(201, 194, 174))
        cx = (hx0 + hx1) // 2
        for i, x in enumerate(range(cx - 2, cx + 2)):
            d.put(x, hy0 - 2 - (i % 2), (214, 58, 52))
        d.put(cx, hy0 + 3, (240, 192, 80))
        d.put(cx + 1, hy0 + 3, (200, 140, 30))
        d.put(cx, hy0 + 4, (214, 58, 52))  # barbillon
        d.put(hx0, hy0 + 1, OUT)
        d.put(hx1, hy0 + 1, OUT)  # ses yeux, au-dessus des vôtres


WEAPONS = ("epee_courte", "epee_longue", "lance", "masse")


def weapon(d, race, kind):
    r = RACES[race]
    hand = (r["armR"][0], r["armR"][3] + 1)
    steel, steel2, wood = (224, 230, 236), (132, 142, 156), (122, 82, 48)
    if kind == "epee_courte":
        for y in range(hand[1] - 6, hand[1]):
            d.put(hand[0] + 2, y, steel)
        d.put(hand[0] + 1, hand[1] - 1, (240, 192, 80))
        d.put(hand[0] + 3, hand[1] - 1, (240, 192, 80))
        d.put(hand[0] + 2, hand[1] + 1, wood)
    elif kind == "epee_longue":
        # Deux mains : la lame part en diagonale devant le corps.
        x, y = r["armL"][2] + 1, r["armL"][3] + 1
        for i in range(10):
            d.put(x + i, y - i, steel if i > 2 else wood)
            if i > 2:
                d.put(x + i + 1, y - i, steel2)
        d.put(x + 2, y - 1, (240, 192, 80))
        d.put(x + 3, y - 2, (240, 192, 80))
    elif kind == "lance":
        for y in range(hand[1] - 14, hand[1] + 3):
            d.put(hand[0] + 2, y, wood)
        for y in range(hand[1] - 17, hand[1] - 14):
            d.put(hand[0] + 2, y, steel)
        d.put(hand[0] + 1, hand[1] - 15, steel2)
        d.put(hand[0] + 3, hand[1] - 15, steel2)
    elif kind == "masse":
        for y in range(hand[1] - 3, hand[1] + 2):
            d.put(hand[0] + 2, y, wood)
        d.rect((hand[0] + 1, hand[1] - 6, hand[0] + 3, hand[1] - 4), steel, shade=steel2)
        d.put(hand[0] + 2, hand[1] - 7, steel2)


def doll(race="humain", arm="tunique", helm="aucun", weap="epee_courte"):
    d = Doll()
    body(d, race)
    armor(d, race, arm)
    helmet(d, race, helm)
    weapon(d, race, weap)
    return d.image()


def icon_armor(kind):
    """Icône du sac (32 × 32) : l'armure seule, posée à plat (proposition)."""
    d = Doll()
    a = ARMORS[kind]
    big = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
    r = dict(torso=(10, 9, 21, 22), armL=(5, 9, 9, 19), armR=(22, 9, 26, 19))
    global N
    N0, N = N, 32
    d.rect(r["torso"], a["main"], shade=a["dark"], light=a.get("light"))
    for arm in (r["armL"], r["armR"]):
        d.rect(arm, a["main"], shade=a["dark"])
    for x in range(10, 22):
        d.put(x, 20, a["belt"])
    if a.get("plate"):
        for x in range(10, 22):
            d.put(x, 12, a["dark"])
            d.put(x, 15, a["dark"])
            d.put(x, 18, a["dark"])
        for arm in (r["armL"], r["armR"]):
            d.rect((arm[0] - 1, arm[1], arm[2] + 1, arm[1] + 2), a["main"], light=a["light"], shade=a["dark"])
        for y in range(9, 20):
            d.put(16, y, a["light"])
    if a.get("scales"):
        for y in range(9, 20):
            for x in range(10, 22):
                if (x + 2 * y) % 4 == 0:
                    d.put(x, y, a["dark"])
                elif (x + 2 * y) % 4 == 2:
                    d.put(x, y, a["light"])
        for arm in (r["armL"], r["armR"]):
            d.rect((arm[0] - 1, arm[1], arm[2] + 1, arm[1] + 2), a["dark"])
        d.put(4, 8, a["spikes"]); d.put(3, 7, a["spikes"]); d.put(27, 8, a["spikes"]); d.put(28, 7, a["spikes"])
        d.put(15, 9, (240, 192, 80)); d.put(16, 10, (240, 192, 80))
    img = d.image()
    N = N0
    big.alpha_composite(img)
    return big


def icon_helmet(kind):
    d = Doll()
    global N
    N0, N = N, 16
    head = dict(head=(4, 5, 11, 12))
    RACES["_icone"] = dict(head=head["head"], torso=(0, 0, 0, 0), armL=(0, 0, 0, 0), armR=(0, 0, 0, 0), legL=(0, 0, 0, 0), legR=(0, 0, 0, 0), foot=0)
    if kind == "heaume":
        helmet(d, "_icone", "heaume")
    else:
        helmet(d, "_icone", kind)
        if kind == "poulet":
            d.rect((3, 8, 12, 12), (246, 242, 230), shade=(201, 194, 174))
            d.put(7, 9, (240, 192, 80)); d.put(8, 9, (200, 140, 30)); d.put(7, 10, (214, 58, 52))
    img = d.image()
    N = N0
    return img


def label(dr, xy, text, size=11, col=(220, 210, 190), anchor="mm"):
    dr.text(xy, text, fill=col, font=font(size, False), anchor=anchor)


def main():
    S = 5
    cell = N * S + 12
    LX = 90
    armors = list(ARMORS)
    helmets = list(HELMETS)
    W = LX + cell * len(helmets) + 40 + 380
    H = 1500
    sheet = Image.new("RGB", (W, H), (26, 20, 14))
    dr = ImageDraw.Draw(sheet)
    dr.text((W // 2, 24), "PAPERDOLL v1 — le Guerrier change avec son équipement (proposition, rien en jeu)", fill=(255, 243, 200), font=font(15), anchor="mm")
    # Grille armures × casques (Humain, épée courte).
    y0 = 70
    label(dr, (LX + cell * len(helmets) // 2, y0 - 14), "HUMAIN : armure (lignes) × casque (colonnes), épée courte")
    for j, h in enumerate(helmets):
        label(dr, (LX + j * cell + cell // 2, y0 + 4), h)
    for i, a in enumerate(armors):
        label(dr, (44, y0 + 20 + i * cell + cell // 2), a, anchor="mm")
        for j, h in enumerate(helmets):
            im = up(doll("humain", a, h), S)
            x, y = LX + j * cell + 6, y0 + 20 + i * cell + 6
            sheet.paste((54, 46, 64), (x - 4, y - 4, x + im.width + 4, y + im.height + 4))
            sheet.paste(im, (x, y), im)
    # Armes (Humain en plate, heaume).
    xr = LX + cell * len(helmets) + 40
    label(dr, (xr + 180, y0 - 14), "ARMES (humain, cuir)")
    for k, w in enumerate(WEAPONS):
        im = up(doll("humain", "cuir", "aucun", w), 4)
        x, y = xr + (k % 2) * 190, y0 + 20 + (k // 2) * (im.height + 40)
        sheet.paste((54, 46, 64), (x - 4, y - 4, x + im.width + 4, y + im.height + 4))
        sheet.paste(im, (x, y), im)
        label(dr, (x + im.width // 2, y + im.height + 14), w.replace("_", " "))
    # Couches éclatées.
    yl = y0 + 20 + 2 * (N * 4 + 40) + 10
    label(dr, (xr + 180, yl), "LES COUCHES (dans l'ordre)")
    steps = []
    d = Doll(); body(d, "humain"); steps.append(("1 corps", d.image()))
    d2 = Doll(); body(d2, "humain"); armor(d2, "humain", "plate"); steps.append(("2-3 armure", d2.image()))
    d3 = Doll(); body(d3, "humain"); armor(d3, "humain", "plate"); helmet(d3, "humain", "heaume"); steps.append(("4 casque", d3.image()))
    steps.append(("5 arme", doll("humain", "plate", "heaume", "lance")))
    for k, (t, im) in enumerate(steps):
        im = up(im, 3)
        x, y = xr + (k % 2) * 190, yl + 16 + (k // 2) * (im.height + 34)
        sheet.paste((54, 46, 64), (x - 4, y - 4, x + im.width + 4, y + im.height + 4))
        sheet.paste(im, (x, y), im)
        label(dr, (x + im.width // 2, y + im.height + 12), t)
    # Les trois races.
    yr = y0 + 20 + len(armors) * cell + 30
    label(dr, (W // 2, yr), "UN SQUELETTE PAR RACE : humain, halfelin (plus petit, grosse tête, pieds nus poilus), elfe (élancé, oreilles pointues)")
    combos = [("humain", "tunique", "aucun", "epee_courte"), ("halfelin", "tunique", "aucun", "epee_courte"), ("elfe", "tunique", "aucun", "epee_courte"),
              ("halfelin", "cuir", "cuir", "masse"), ("halfelin", "mailles", "poulet", "epee_courte"), ("halfelin", "draconique", "maille", "lance"),
              ("elfe", "cuir", "aucun", "lance"), ("elfe", "plate", "heaume", "epee_longue"), ("elfe", "draconique", "aucun", "epee_courte")]
    for k, (race, a, h, w) in enumerate(combos):
        im = up(doll(race, a, h, w), S)
        x, y = 90 + (k % 5) * (cell + 40), yr + 20 + (k // 5) * (cell + 50)
        sheet.paste((54, 46, 64), (x - 4, y - 4, x + im.width + 4, y + im.height + 4))
        sheet.paste(im, (x, y), im)
        label(dr, (x + im.width // 2, y + im.height + 14), f"{race}", 10)
        label(dr, (x + im.width // 2, y + im.height + 28), f"{a} · {h}", 10)
    # Nouvelles armures et casques : icônes du sac.
    yi = yr + 20 + 2 * (cell + 50) + 30
    label(dr, (W // 2, yi), "NOUVEAUX OBJETS (icônes du sac) : armure de plate, armure draconique, heaume, casque poulet")
    icons = [("armure de plate", up(icon_armor("plate"), 5)), ("armure draconique", up(icon_armor("draconique"), 5)), ("heaume", up(icon_helmet("heaume"), 8)), ("casque poulet", up(icon_helmet("poulet"), 8))]
    x = 80
    for t, im in icons:
        sheet.paste((54, 46, 64), (x - 6, yi + 20, x + im.width + 6, yi + 32 + im.height))
        sheet.paste(im, (x, yi + 26), im)
        label(dr, (x + im.width // 2, yi + 46 + im.height), t)
        x += im.width + 80
    yn = yi + 26 + 160 + 40
    notes = [
        "Taille : 24 × 24 pixels (le héros actuel fait 16 × 16) : plus de place pour lire l'équipement ; dessiné à 1,3 case comme aujourd'hui.",
        "Chantier si validé : 3 vues (face, profil, dos) × 4 poses (repos, marche, coup, touché) par couche ; une couche par objet équipable.",
        "Armure de plate (rare) : CA 18 ; armure draconique (épique) : CA 18 + résistance au feu ; heaume : +3 CA ; casque poulet (fun) : +1 CA, les poules vous suivent.",
        "Valeurs à décider ; dessins à valider avant tout code.",
    ]
    for k, t in enumerate(notes):
        dr.text((40, yn + k * 20), t, fill=(200, 190, 170), font=font(11, False))
    sheet = sheet.crop((0, 0, W, yn + len(notes) * 20 + 20))
    sheet.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "paperdoll_v1.png"))
    print("art/paperdoll_v1.png", sheet.size)


if __name__ == "__main__":
    main()
