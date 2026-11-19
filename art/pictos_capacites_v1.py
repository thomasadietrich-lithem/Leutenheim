"""Pictogrammes des capacités et structure du menu d'actions, v1 (Thomas, 2026-11-19, 15 h 32 : « revois les pictogrammes
des capacités ; propose une structure du menu plus intuitive pour distinguer les actions, compétences et autres »).
PROPOSITION à valider, rien n'est en jeu.

  1. Un picto par capacité (16 × 16, palette des icônes du jeu), un dessin qui dit ce que fait le pouvoir.
     ACTIF (on l'utilise : bouton) = cadre de la couleur de la voie et billes de charges ; PASSIF (toujours là) = médaillon
     rond sans cadre, mot « passif ».
  2. Le menu : trois familles bien séparées, chacune sa couleur et son bouton dans la barre du bas.
     ACTIONS (bronze : ce que tout héros sait faire), POUVOIRS (couleur de la voie : ce que la voie donne, avec charges),
     OBJET (vert : le raccourci du sac).

  python3 art/pictos_capacites_v1.py   → art/pictos_capacites_v1.png
"""
import os
import re
import sys

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pix import font, up  # noqa: E402

SRC = open(os.path.join(HERE, "..", "src", "ui", "icons.ts")).read()
PAL = {k: v for k, v in re.findall(r'"?(\w)"?: "(#[0-9a-f]{6})"', SRC[SRC.index("export const PALETTE"):SRC.index("};", SRC.index("export const PALETTE"))])}


def icon_rows(name):
    i = SRC.index(f"  {name}: [")
    j = SRC.index("],", i)
    return re.findall(r'"([^"]+)"', SRC[i:j])


# ---------------------------------------------------------------- les 14 pictos (K contour)
ICONS = {
    # ---- voie rouge (Fureur)
    "double_frappe": [
        "................",
        ".........KK.....",
        "........KWWK....",
        ".......KWWK..KK.",
        "......KWWK..KWWK",
        ".....KWWK..KWWK.",
        "....KWWK..KWWK..",
        "...KWWK..KWWK...",
        "..KRRK..KWWK....",
        ".KRRK..KWWK.....",
        "KRRK..KRRK......",
        ".KK..KRRK.......",
        "....KRRK........",
        ".....KK.........",
        "................",
        "................",
    ],
    "coup_puissant": [
        "........Y.......",
        "...Y...YFY...Y..",
        "....Y..YFY..Y...",
        ".....YYFFFYY....",
        "..YYYFFWWFFYYY..",
        ".....YYFFFYY....",
        "....Y.KSSKY.....",
        "...Y..KSWK.Y....",
        "......KSWK......",
        "......KSWK......",
        "......KSWK......",
        ".....KGGGGK.....",
        "......KBBK......",
        "......KBBK......",
        "......KGGK......",
        ".......KK.......",
    ],
    "enchainement": [
        "................",
        "...........KKK..",
        "..........KWWWK.",
        ".K.......KWKWKWK",
        "KRK......KWWWWWK",
        "KRRK.....KWKKKWK",
        "KRRRK.....KWWWK.",
        "KRRRRRRRK.KWWWK.",
        "KRRRRRRRRK.KKK..",
        "KRRRRRRRK..W....",
        "KRRRK.......W...",
        "KRRK......W..W..",
        "KRK........W....",
        ".K..............",
        "................",
        "................",
    ],
    "rage": [
        "......K.....K...",
        ".....KXK...KXK..",
        "....KXOXK.KXOK..",
        "...KXOOOXKXOOK..",
        "..KXOOxOOOOOxXK.",
        "..KXOxxxOOOxxXK.",
        ".KXOOKKxOOxKKOXK",
        ".KXOOOKxOOxKOOXK",
        ".KXOOOOOOOOOOOXK",
        ".KXOOOKKKKKKOOXK",
        "..KXOKrrrrrrKOK.",
        "..KXOOKKKKKKOXK.",
        "...KXOOOOOOOXK..",
        "....KKXXXXXKK...",
        "......KKKKK.....",
        "................",
    ],
    "tourbillon": [
        "....KKKKKKK.....",
        "...KRRRRRRRK....",
        "..KRK.....KRK...",
        ".KRK.......KRK..",
        ".KRK...KK...KK..",
        "KRK...KWWK......",
        "KRK..KWWK....K..",
        "KRK.KWWK....KRK.",
        ".K.KWWK....KRRRK",
        "..KSSK......KRK.",
        ".KGGK.......KRK.",
        "KBBK.......KRK..",
        "KBK.......KRK...",
        ".K...KKKKKRK....",
        "....KRRRRRK.....",
        ".....KKKKK......",
    ],
    "charge": [
        "................",
        "................",
        "..........KK....",
        ".........KWWK...",
        "RRRR....KWWWWK..",
        "........KWWWWWKK",
        ".RRRRRR.KWWWWWWK",
        "........KWWWWWK.",
        "RRRR...KTTWWWK..",
        "......KTTTTTK...",
        ".RRRRRKTTTTK....",
        "......KBBBK.....",
        "RRRR..KBBK......",
        "......KKK.......",
        "................",
        "................",
    ],
    "cri_guerre": [
        "................",
        "....KKKKK.......",
        "...KSSSSSK...R..",
        "..KSDDDDDSK...R.",
        "..KSKKSKKSK.R..R",
        "..KSKWSKWSK..R.R",
        "..KSSSSSSSK.R..R",
        "..KSDKKKDSK..R.R",
        "..KSKrrrKSK.R..R",
        "..KSKrrrKSK..R.R",
        "..KSDKKKDSK.R..R",
        "...KSSSSSK...R.R",
        "....KSSSK...R..R",
        ".....KKK.....R..",
        "................",
        "................",
    ],
    # ---- voie bleue (Ténacité)
    "second_souffle": [
        "................",
        "..KKK...KKK.....",
        ".KUUUK.KUUUK....",
        "KUVVUUKUUUUUK...",
        "KUVUUUUUUUUUK...",
        "KUUUUUUUUUUUK...",
        ".KUUUUUUUUUK....",
        "..KUUUUUUUK.WWW.",
        "...KUUUUUK.W...W",
        "....KUUUK..W..W.",
        ".....KUK....WW..",
        "......K..WWW....",
        ".........W...W..",
        "..........WWW...",
        "................",
        "................",
    ],
    "peau_dure": [
        "..KKKKKKKKKKKK..",
        ".KSSSSSSSSSSSSK.",
        ".KSUUUKUUUUKUSK.",
        ".KSUUKUUUUKUUSK.",
        ".KSKKKKKKKKKKSK.",
        ".KSUUUKUUUUKUSK.",
        ".KSUUKUUUUKUUSK.",
        ".KSKKKKKKKKKKSK.",
        "..KSUUKUUUKUSK..",
        "..KSUKUUUKUUSK..",
        "...KSKKKKKKSK...",
        "....KSUUUUSK....",
        ".....KSUUSK.....",
        "......KSSK......",
        ".......KK.......",
        "................",
    ],
    "esquive": [
        "................",
        "..........KKK...",
        ".........KWWWK..",
        ".........KWWWK..",
        "..V.......KWK...",
        ".V..V....KUUUK..",
        "V..V..V.KUUUUUK.",
        "..V..V.KUUKUUK..",
        ".V..V...KUKUK...",
        "V..V..V.KUUUK...",
        "..V..V...KUKUK..",
        ".V..V...KUK.KUK.",
        "V..V...KUK...KUK",
        "......KKK.....KK",
        "................",
        "................",
    ],
    "dernier_rempart": [
        "..KKKKKKKKKKKK..",
        ".KSSSSSSSSSSSSK.",
        ".KSUUUUKUUUUUSK.",
        ".KSUUUUUKUUUUSK.",
        ".KSUUUUKUUUUUSK.",
        ".KSUUUUUKUUUUSK.",
        ".KSUUUUKKUUUUSK.",
        "..KSUUUKUKUUSK..",
        "..KSUUKUUUUUSK..",
        "...KSUKUUUUSK...",
        "....KSUUUUSK....",
        ".....KSUUSK..R..",
        "......KSSK..RRR.",
        ".......KK...RRR.",
        ".............R..",
        "................",
    ],
    "riposte": [
        "................",
        "KK...........KK.",
        "KWK.........KWK.",
        ".KWK.......KWK..",
        "..KWK.....KWK...",
        "...KWK...KWK....",
        "....KWK.KWK.....",
        ".....KWKWK......",
        "......KWK...UU..",
        ".....KGKGK....U.",
        "....KGK.KGK...U.",
        "...KBK...KBK.U..",
        "..KBK.....KUUU..",
        "..KK.......KUU..",
        "............U...",
        "................",
    ],
    "garde": [
        "R.....KKKK.....R",
        ".R...KSSSSK...R.",
        "..R.KSUUUUSK.R..",
        "...KSUUUUUUSK...",
        "..KSUUUWWUUUSK..",
        "..KSUUWWWWUUSK..",
        "..KSUUUWWUUUSK..",
        "..KSUUUWWUUUSK..",
        "...KSUUUUUUSK...",
        "....KSUUUUSK....",
        ".....KSUUSK.....",
        "......KSSK......",
        ".......KK.......",
        "................",
        "................",
        "................",
    ],
    "encaisseur": [
        "................",
        "................",
        "..KKKKKKKKKKKK..",
        ".KDDDDDDDDDDDDK.",
        "KDSSSSSSSSSSSSDK",
        "KDDDDDDDDDDDDDK.",
        ".KKKDDDDDDDKKK..",
        "....KDDDDDK.....",
        "....KDDDDDK.....",
        "...KDDDDDDDK....",
        "..KDDDDDDDDDK...",
        "..KKKKKKKKKKK...",
        "................",
        "...U..U..U..U...",
        "..U..U..U..U....",
        "................",
    ],
}
NAMES = {
    "double_frappe": "Double frappe", "coup_puissant": "Coup puissant", "enchainement": "Bousculade", "rage": "Rage",
    "tourbillon": "Tourbillon", "charge": "Charge", "cri_guerre": "Cri de guerre",
    "second_souffle": "Second souffle", "peau_dure": "Peau dure", "esquive": "Esquive", "dernier_rempart": "Dernier rempart",
    "riposte": "Riposte", "garde": "Garde", "encaisseur": "Encaisseur",
}
ACTIVE = {"double_frappe", "tourbillon", "charge", "cri_guerre", "second_souffle"}
RED = ["double_frappe", "coup_puissant", "enchainement", "rage", "tourbillon", "charge", "cri_guerre"]
BLUE = ["second_souffle", "peau_dure", "esquive", "dernier_rempart", "riposte", "garde", "encaisseur"]
VOIE = {"red": (208, 58, 68), "blue": (74, 143, 208)}
BRONZE = (176, 120, 58)
GREEN = (96, 170, 80)
BG = (24, 18, 14)
PANEL = (44, 34, 26)


def img(rows, pal=PAL):
    im = Image.new("RGBA", (len(rows[0]), len(rows)))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != "." and c in pal:
                h = pal[c]
                im.putpixel((x, y), (int(h[1:3], 16), int(h[3:5], 16), int(h[5:7], 16), 255))
    return im


def tile(d, sheet, x, y, rows, color, active, label, sub=None, charges=None, S=4, w=None):
    """Une case de bouton : cadre biseauté de la couleur de la famille (actif), ou médaillon rond (passif)."""
    w = w or 16 * S + 24
    h = 16 * S + 44
    if active:
        d.rectangle((x, y, x + w, y + h), fill=PANEL, outline=color, width=3)
        d.line((x + 3, y + 3, x + w - 3, y + 3), fill=tuple(min(255, c + 60) for c in color))
    else:
        d.rectangle((x, y, x + w, y + h), fill=BG)
        cx, cy = x + w // 2, y + 8 + 8 * S
        d.ellipse((cx - 9 * S, cy - 9 * S, cx + 9 * S, cy + 9 * S), fill=(36, 30, 26), outline=tuple(c // 2 + 40 for c in color), width=2)
    im = up(img(rows), S)
    sheet.paste(im, (x + (w - im.width) // 2, y + 8), im)
    d.text((x + w // 2, y + h - 22), label, fill=(240, 226, 190), font=font(13), anchor="mm")
    if sub:
        d.text((x + w // 2, y + h - 8), sub, fill=(160, 150, 130), font=font(10, False), anchor="mm")
    if charges is not None:
        n, full = charges
        for k in range(n):
            px = x + w - 10 - k * 10
            d.ellipse((px - 4, y + 6, px + 4, y + 14), fill=(255, 215, 94) if k < full else (60, 50, 40), outline=(20, 14, 10))


def main():
    S = 4
    cw = 150
    Wb = 40 + 7 * cw + 160
    sheet = Image.new("RGB", (Wb, 1900), (14, 11, 9))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 28), "CAPACITÉS ET MENU (v1, proposition)", fill=(255, 243, 200), font=font(24), anchor="mm")
    d.text((Wb // 2, 56), "Un picto qui dit ce que fait le pouvoir · ACTIF = cadre de la voie et billes de charges · PASSIF = médaillon, toujours là",
           fill=(190, 180, 160), font=font(13, False), anchor="mm")
    y = 90
    for title, ids, voie in (("VOIE ROUGE — FUREUR", RED, "red"), ("VOIE BLEUE — TÉNACITÉ", BLUE, "blue")):
        d.text((40, y), title, fill=VOIE[voie], font=font(17))
        y += 28
        x = 40
        for k in ids:
            act = k in ACTIVE
            tile(d, sheet, x, y, ICONS[k], VOIE[voie], act, NAMES[k], "actif" if act else "passif", (3, 2) if act else None, S, cw - 10)
            x += cw
        y += 16 * S + 44 + 34
    # ---------------- avant / après : la barre du bas et les deux barres qui s'ouvrent
    d.text((40, y), "LE MENU : AUJOURD'HUI", fill=(255, 215, 94), font=font(17))
    y += 28
    d.text((40, y), "La barre d'actions mélange tout : les actions de base, le raccourci d'objet, et les pouvoirs de la voie (une rangée au-dessus) ;",
           fill=(200, 190, 170), font=font(13, False))
    d.text((40, y + 18), "le pouvoir principal a son bouton à part dans la barre du bas. Même cadre brun partout : on ne sait pas ce qui se recharge par étage.",
           fill=(200, 190, 170), font=font(13, False))
    y += 50
    cur = [("wait", "Attendre"), ("aim", "Tir"), ("actions", "Actions"), ("power", "Pouvoir"), ("hero", "Héros")]
    x = 40
    for key, lab in cur:
        d.rectangle((x, y, x + 120, y + 56), fill=PANEL, outline=(120, 90, 50), width=2)
        d.text((x + 60, y + 28), lab, fill=(220, 200, 160), font=font(14), anchor="mm")
        x += 128
    y += 90

    d.text((40, y), "LE MENU : PROPOSÉ — trois familles, trois couleurs, trois boutons", fill=(255, 215, 94), font=font(17))
    y += 30
    fam = [("Attendre", (120, 110, 100), "sablier", None), ("Tir", (150, 130, 100), "flèches ×20", None), ("ACTIONS", BRONZE, "bronze", None),
           ("POUVOIRS", VOIE["red"], "couleur de la voie", (5, 3)), ("OBJET", GREEN, "le raccourci", None), ("Héros", (150, 130, 100), "fiche", None)]
    x = 40
    for lab, col, sub, ch in fam:
        d.rectangle((x, y, x + 116, y + 64), fill=PANEL, outline=col, width=4 if lab.isupper() else 2)
        d.text((x + 58, y + 26), lab, fill=(240, 226, 190), font=font(15), anchor="mm")
        d.text((x + 58, y + 48), sub, fill=(170, 160, 140), font=font(10, False), anchor="mm")
        if ch:
            for k in range(ch[0]):
                px = x + 112 - 8 - k * 10
                d.ellipse((px - 4, y + 4, px + 4, y + 12), fill=(255, 215, 94) if k < ch[1] else (60, 50, 40), outline=(20, 14, 10))
        x += 124
    y += 96
    # barre ACTIONS
    d.text((40, y), "ACTIONS (bronze) : ce que tout héros sait faire, toujours dans le même ordre ; « Désarmer » n'apparaît qu'à côté d'un piège",
           fill=BRONZE, font=font(14))
    y += 24
    x = 40
    for k, lab in (("loupe", "Fouiller"), ("cacher", "Se cacher"), ("pousser", "Pousser"), ("degager", "Dégager"), ("repos", "Repos"), ("desarmer", "Désarmer")):
        name = {"loupe": "search", "pousser": "push", "degager": "disengage", "repos": "rest", "cacher": "hide", "desarmer": "disarm"}[k]
        try:
            rows = icon_rows(name)
        except ValueError:
            rows = None
        d.rectangle((x, y, x + 110, y + 92), fill=PANEL, outline=BRONZE, width=3)
        if rows:
            im = up(img(rows), 3)
            sheet.paste(im, (x + 55 - im.width // 2, y + 8), im)
        else:
            d.text((x + 55, y + 34), "(picto actuel)", fill=(120, 110, 100), font=font(10, False), anchor="mm")
        d.text((x + 55, y + 76), lab, fill=(240, 226, 190), font=font(13), anchor="mm")
        x += 118
    y += 124
    d.text((40, y), "POUVOIRS (couleur de la voie) : le pouvoir principal en premier, puis ceux du Rang II ; billes = charges de l'étage ; grisé = épuisé",
           fill=VOIE["red"], font=font(14))
    y += 24
    x = 40
    for k, ch in (("double_frappe", (5, 3)), ("tourbillon", (2, 2)), ("charge", (3, 1)), ("cri_guerre", (1, 0))):
        tile(d, sheet, x, y, ICONS[k], VOIE["red"] if ch[1] else (90, 80, 76), True, NAMES[k], f"{ch[1]} / {ch[0]} cet étage", ch, 3, 140)
        x += 150
    d.text((x + 10, y + 20), "Les passifs (Coup puissant, Rage…)", fill=(170, 160, 140), font=font(12, False))
    d.text((x + 10, y + 38), "ne sont PAS dans cette barre :", fill=(170, 160, 140), font=font(12, False))
    d.text((x + 10, y + 56), "ils restent sur la fiche du héros,", fill=(170, 160, 140), font=font(12, False))
    d.text((x + 10, y + 74), "en médaillons.", fill=(170, 160, 140), font=font(12, False))
    y += 16 * 3 + 44 + 40
    notes = [
        "OBJET (vert) : le raccourci du sac quitte la barre d'actions et prend un bouton à lui dans la barre du bas (icône de l'objet et ×N).",
        "FICHE DU HÉROS, onglet Personnage : chaque carte de pouvoir reçoit son picto ; ACTIF ou PASSIF écrit sous le nom ; cadre de la voie pour les actifs.",
        "Couleurs : bronze = actions (pas de charge), rouge ou bleu = pouvoirs de la voie (charges par étage), vert = objet (quantité), gris = indisponible.",
        "Ce qui disparaît : la rangée de pouvoirs collée au-dessus de la barre d'actions, et le bouton « Pouvoir » seul (remplacé par POUVOIRS).",
    ]
    for i, t in enumerate(notes):
        d.text((40, y + i * 22), t, fill=(200, 196, 210), font=font(13, False))
    sheet = sheet.crop((0, 0, Wb, y + len(notes) * 22 + 20))
    sheet.save(os.path.join(HERE, "pictos_capacites_v1.png"))
    print("art/pictos_capacites_v1.png", sheet.size)


if __name__ == "__main__":
    main()
