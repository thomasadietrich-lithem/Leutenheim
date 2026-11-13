"""Pictos de race et de classe v1 (Thomas, 2026-11-11 : « un picto sympa par classe et race »), pour les cartes de
l'écran « Nouvelle partie ». 16 × 16, palette et contour des icônes du jeu (`src/ui/icons.ts`). Écrit
art/pictos_race_classe_v1.png. Lancer depuis la racine du dépôt.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from pix import font

SRC = open(os.path.join(os.path.dirname(__file__), "..", "src", "ui", "icons.ts")).read()
line = SRC[SRC.index("export const PALETTE"):]
PAL = {k: v for k, v in re.findall(r'"?([A-Za-z0-9])"?: "(#[0-9a-f]{6})"', line[:line.index("\n")])}
PAL["s"] = "#eebe91"  # peau (celle de la tête du héros)
PAL["q"] = "#c68e64"  # ombre de la peau


def fit(rows):
    return [(r + "." * 16)[:16] for r in rows] + ["." * 16] * (16 - len(rows))


PICTOS = {
    # RACES : un visage chacune.
    "humain": fit([
        "................",
        ".....KKKKKK.....",
        "....KBBBBBBK....",
        "...KBBBBBBBBK...",
        "...KBssssssBK...",
        "...KssssssssK...",
        "...KsKssssKsK...",
        "...KssssssssK...",
        "....KsqrrqsK....",
        ".....KssssK.....",
        "......KKKK......",
        "....KUUUUUUK....",
        "...KUUUUUUUUK...",
        "...KUUuUUuUUK...",
    ]),
    "halfelin": fit([
        "................",
        "...K.KK.KK.K....",
        "..KbKbbKbbKbK...",
        "..KbbbbbbbbbK...",
        "..KbssssssbbK...",
        "..KssssssssbK...",
        "..KsKssssKssK...",
        "..Ks3ssss3ssK...",
        "...KssrrrssK....",
        "....KsssssK.....",
        ".....KKKKK......",
        "....KEEEEEEK....",
        "...KEEGEEEEEK...",
        "...KEEEEEEEEK...",
    ]),
    "elfe": fit([
        "................",
        ".....KKKKKK.....",
        "....KFFFFFFK....",
        "...KFFFFFFFFK...",
        "K..KFssssssFK..K",
        "KsKKssssssssKKsK",
        ".KsKsKssssKsKsK.",
        "..KKssssssssKK..",
        "...KFsqrrqsFK...",
        "...KFKssssKFK...",
        "...KF.KKKK.FK...",
        "...KF.KeeK.FK...",
        "....K.KeeK.K....",
    ]),
    # CLASSES : un objet chacune.
    "guerrier": fit([
        "............KK..",
        "...........KWSK.",
        "..........KWSK..",
        ".........KWSK...",
        "..KKKK..KWSK....",
        ".KCccCKKWSK.....",
        "KCcGGcCWSK......",
        "KcGRRGcSK.......",
        "KcGRRGKbK.......",
        "KCcGGcKKbK......",
        ".KCccCK..KbK....",
        "..KKKK....KK....",
    ]),
    "assassin": fit([
        "................",
        ".....KKKKKK.....",
        "....KppppppK....",
        "...KppPPPPppK...",
        "..KppPKKKKPppK..",
        "..KpPKYKKYKPpK..",
        "..KpPKKKKKKPpK..",
        "..KppPKKKKPppK..",
        "...KpppPPpppK...",
        "...KppppppppK.K.",
        "..KpppppppppKWK.",
        "..KppppppppKWSK.",
        "...KKKKKKKKKSK..",
        "..........KbK...",
        ".........KbK....",
    ]),
    "magicien": fit([
        ".......KK.......",
        "......KUUK......",
        ".....KUUUK......",
        ".....KUYUUK.....",
        "....KUUUUUK.....",
        "....KUUUUUUK....",
        "...KUUUYUUUK....",
        "...KUUUUUUUUK...",
        ".KKuuuuuuuuuuKK.",
        "KuuuuuuuuuuuuuuK",
        ".KKKKKKKKKKKKKK.",
        "......KQQK......",
        ".....KQYYQK.....",
        "......KQQK......",
    ]),
}


def render(rows, S=7):
    im = Image.new("RGB", (16 * S, 16 * S), (70, 61, 82))
    d = ImageDraw.Draw(im)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ".":
                d.rectangle([x * S, y * S, x * S + S - 1, y * S + S - 1], fill=PAL[c])
    return im


if __name__ == "__main__":
    names = {"humain": "Humain", "halfelin": "Halfelin", "elfe": "Elfe", "guerrier": "Guerrier", "assassin": "Assassin", "magicien": "Magicien"}
    W = 20 + 3 * 132
    sheet = Image.new("RGB", (W, 360), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 16), "RACES ET CLASSES — pictos v1, à valider", fill=(255, 243, 200), font=font(13), anchor="mm")
    for k, key in enumerate(PICTOS):
        x = 20 + (k % 3) * 132
        y = 40 + (k // 3) * 160
        sheet.paste(render(PICTOS[key]), (x, y))
        d.text((x, y + 116), names[key], fill=(220, 210, 190), font=font(12, False))
    sheet.save("art/pictos_race_classe_v1.png")
    print("ok")
