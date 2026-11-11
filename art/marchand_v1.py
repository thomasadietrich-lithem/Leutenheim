"""Le Colporteur, marchand itinérant louche v1 (Thomas, 2026-11-11 : « un marchand itinérant louche, qui se promène,
avec 4 articles, qui peut racheter des objets, une bulle de conversation au-dessus de lui ; invisible dès que des mobs
passent à proximité, mais on peut le deviner »). Planche à valider : art/marchand_v1.png. Lancer depuis la racine.
16 × 20 pixels comme le héros (1,3 case), contour sombre du jeu.
"""
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from pix import font, hexrgb

PAL = {
    "K": "#18121e",  # contour
    "H": "#4a3a5a", "h": "#6a5880",  # capuche et cape, violet passé
    "C": "#5a6a3a",  # pièce rapiécée, vert
    "F": "#1e1622",  # ombre du visage
    "Y": "#f4e04a",  # yeux qui brillent
    "N": "#c89a7a", "n": "#946a52",  # nez crochu, mains
    "T": "#e8debe",  # dents du sourire
    "P": "#8a6038", "p": "#5a3e22",  # gros sac à dos
    "R": "#c4a060",  # sangle
    "S": "#9aa2b4", "s": "#5e6476",  # marmite
    "L": "#ffd75e", "l": "#b07a1a",  # lanterne
    "G": "#e8b83a",  # pièce d'or
    "B": "#3a2a1e",  # bottes
    "W": "#8a6a44",  # bâton
}

FRONT = [
    "....KKK...KKK...",
    "...KSSsK.KLlK...",
    "..KSSSSsKKLLK...",
    "..KpPPPPPPPPpK..",
    "..KPPKKKKKKPPK..",
    "..KPKhhhhhhKPK..",
    "..KPKhHHHHhKPK..",
    "..KKhHFFFFHhKK..",
    "...KhFYFFYFhK...",
    "...KhFFNNFFhK...",
    "...KHhFTTFhHK...",
    "..KHHHhhhhHHHK..",
    ".KHHCHHRHHHHHHK.",
    ".KhHHHHHRHHCHhK.",
    ".KNKHHHHHRHHKNK.",
    "..KKHHHHHHHHKK..",
    "...KHHhHHhHHK...",
    "...KHHhHHhHHK...",
    "...KBBK..KBBK...",
    "...KKKK..KKKK...",
]
SIDE = [  # de profil, voûté, appuyé sur son bâton ; le sac déborde dans le dos (à gauche)
    "..KKK...........",
    ".KSSsK.KKK......",
    ".KSSSsKLlK......",
    "KpPPPPKLLK......",
    "KPPPPPPKKKK.....",
    "KPPPPPKhhhhK....",
    "KPPPPKhHHHhhK...",
    "KPPPPKHHFFFhK...",
    "KpPPPKHHFYFNK...",
    "KPPPPKHHFFNNNK..",
    ".KPPPKHHFTFK.K..",
    ".KpPKHHHhhhK.KW.",
    "..KKHHRHHHHHKNKW",
    "...KHHHRHHHHKK.W",
    "...KHHHHRHHHK..W",
    "...KHCHHHHHHK..W",
    "...KHHhHHHhK...W",
    "...KHHhHHHhK...W",
    "...KBBK.KBBK...W",
    "...KKKK.KKKK...K",
]
BACK = [  # de dos : on ne voit que le sac, la marmite et la lanterne
    "....KKK...KKK...",
    "...KSSsK.KLlK...",
    "..KSSSSsKKLLK...",
    "..KpPPPPPPPPpK..",
    ".KPPPPPPPPPPPPK.",
    ".KPPRPPPPPPRPPK.",
    ".KPPRPPGPPPRPPK.",
    ".KpPRPPPPPPRPpK.",
    ".KPPRPPPPPPRPPK.",
    ".KPPRPPPPPPRPPK.",
    ".KpPPPPPPPPPPpK.",
    "..KPPPPPPPPPPK..",
    ".KHHKKKKKKKKHHK.",
    ".KhHHHHHHHHHHhK.",
    ".KnKHHHHHHHHKnK.",
    "..KKHHHHHHHHKK..",
    "...KHHhHHhHHK...",
    "...KHHhHHhHHK...",
    "...KBBK..KBBK...",
    "...KKKK..KKKK...",
]
BUBBLE = [  # bulle au-dessus de lui : une pièce d'or
    ".KKKKKKKKKK.",
    "K##########K",
    "K####GG####K",
    "K###GGGG###K",
    "K###GlGG###K",
    "K####GG####K",
    "K##########K",
    ".KKKK##KKKK.",
    ".....K#K....",
    "......K.....",
]
PAL["#"] = "#fff3c8"
for rows in (FRONT, SIDE, BACK):
    assert all(len(r) == 16 for r in rows) and len(rows) == 20, [len(r) for r in rows]


def img(rows, alpha=255):
    im = Image.new("RGBA", (len(rows[0]), len(rows)))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ".":
                im.putpixel((x, y), hexrgb(PAL[c]) + (alpha,))
    return im


def guessed(rows, t):
    """Caché (des monstres sont proches) : presque transparent, seul un frémissement du contour le trahit."""
    im = Image.new("RGBA", (16, 20))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c == ".":
                continue
            if c == "K" and (x * 3 + y * 5 + t) % 7 == 0:
                im.putpixel((x, y), (190, 210, 255, 150))
            elif c == "Y":
                im.putpixel((x, y), hexrgb(PAL["Y"]) + (90,))
            else:
                im.putpixel((x, y), hexrgb(PAL[c]) + (28,))
    return im


ICONS = open(os.path.join(os.path.dirname(__file__), "..", "src", "ui", "icons.ts")).read()
_line = ICONS[ICONS.index("export const PALETTE"):]
IPAL = {k: v for k, v in re.findall(r'"?([A-Za-z0-9])"?: "(#[0-9a-f]{6})"', _line[:_line.index("\n")])}


def icon(name):
    i = ICONS.index(f"  {name}: [")
    rows = [r for r in re.findall(r'"([^"]+)"', ICONS[i:ICONS.index("],", i)]) if len(r) >= 8]
    im = Image.new("RGBA", (max(len(r) for r in rows), len(rows)))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != "." and c in IPAL:
                im.putpixel((x, y), hexrgb(IPAL[c]) + (255,))
    return im


def floor_tile(S):
    t = Image.new("RGB", (16 * S, 16 * S), (58, 52, 64))
    d = ImageDraw.Draw(t)
    d.rectangle([0, 0, 16 * S - 1, 16 * S - 1], outline=(46, 40, 52), width=S)
    return t


if __name__ == "__main__":
    S = 6
    W, H = 900, 760
    sheet = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    gold, txt, dim = (255, 215, 94), (255, 243, 200), (200, 190, 170)
    d.text((W // 2, 18), "LE COLPORTEUR — marchand itinérant louche v1, à valider", fill=txt, font=font(15), anchor="mm")

    # 1. Le personnage : face, profil, dos, puis « deviné » (caché près des monstres).
    d.text((20, 44), "1. Face, profil, dos — et caché quand des monstres approchent (on le devine)", fill=gold, font=font(12))
    poses = [("Face", img(FRONT)), ("Profil", img(SIDE)), ("Dos", img(BACK)), ("Caché", guessed(FRONT, 0)), ("Caché (image 2)", guessed(FRONT, 3))]
    for k, (name, im) in enumerate(poses):
        x, y = 20 + k * 170, 66
        bg = Image.new("RGB", (16 * S + 24, 20 * S + 24), (58, 52, 64))
        bg.paste(im.resize((16 * S, 20 * S), Image.NEAREST), (12, 12), im.resize((16 * S, 20 * S), Image.NEAREST))
        sheet.paste(bg, (x, y))
        d.text((x + (16 * S + 24) // 2, y + 20 * S + 38), name, fill=dim, font=font(12, False), anchor="mm")

    # 2. En jeu : sur deux cases de sol, avec sa bulle (une pièce d'or) au-dessus de la tête.
    d.text((20, 254), "2. En jeu : sa bulle au-dessus de la tête (toucher le marchand ouvre la boutique)", fill=gold, font=font(12))
    S2 = 4
    scene = Image.new("RGB", (16 * S2 * 5, 16 * S2 * 3), (58, 52, 64))
    for gx in range(5):
        for gy in range(3):
            scene.paste(floor_tile(S2), (gx * 16 * S2, gy * 16 * S2))
    m = img(FRONT).resize((16 * S2, 20 * S2), Image.NEAREST)
    scene.paste(m, (2 * 16 * S2, int(1.75 * 16 * S2) - 4 * S2 * 2 + 4), m)
    b = img(BUBBLE).resize((12 * S2, 10 * S2), Image.NEAREST)
    scene.paste(b, (2 * 16 * S2 + 2 * S2, 2), b)
    sheet.paste(scene, (20, 276))

    # 3. La boutique : 4 articles, onglets Acheter / Vendre.
    x0, y0 = 380, 266
    d.rectangle([x0, y0, x0 + 500, y0 + 236], fill=(36, 28, 20), outline=(138, 116, 80), width=3)
    d.text((x0 + 250, y0 + 18), "LE COLPORTEUR", fill=gold, font=font(16), anchor="mm")
    d.text((x0 + 250, y0 + 40), "« Pas d'questions, pas d'soucis… »", fill=dim, font=font(12, False), anchor="mm")
    for k, (lab, on) in enumerate((("ACHETER", True), ("VENDRE", False))):
        tx = x0 + 120 + k * 150
        d.rectangle([tx, y0 + 54, tx + 120, y0 + 78], fill=(74, 56, 20) if on else (36, 28, 20), outline=(255, 215, 94) if on else (90, 74, 50), width=2)
        d.text((tx + 60, y0 + 66), lab, fill=txt if on else dim, font=font(13), anchor="mm")
    wares = [("potion_feu", "Potion de feu", 30), ("javeline", "Javelines ×3", 24), ("casque_maille", "Casque de maille", 60), ("pomme", "Pomme", 6)]
    for k, (ic, name, price) in enumerate(wares):
        cx = x0 + 18 + k * 120
        d.rectangle([cx, y0 + 92, cx + 104, y0 + 196], fill=(46, 36, 24), outline=(90, 74, 50), width=2)
        icn = icon(ic).resize((64, 64), Image.NEAREST)
        sheet.paste(icn, (cx + 20, y0 + 100), icn)
        d.text((cx + 52, y0 + 176), name, fill=txt, font=font(10, False), anchor="mm")
        gi = icon("or_petit") if "  or_petit: [" in ICONS else None
        d.text((cx + 52, y0 + 190), f"{price} or", fill=gold, font=font(11), anchor="mm")
    d.text((x0 + 250, y0 + 220), "Bourse : 74 or · toucher un article pour le détail, puis « Acheter »", fill=dim, font=font(11, False), anchor="mm")

    # 4. Règles proposées.
    rules = [
        "RÈGLES PROPOSÉES (à valider) :",
        "- Il apparaît sur 1 étage sur 3 environ (jamais à l'étage du boss) et se promène de salle en salle, lentement.",
        "- Les monstres l'ignorent. Dès qu'un monstre passe à 4 cases ou moins, il se cache : presque transparent, seul",
        "  son contour frémit et ses yeux luisent — on le devine. Il réapparaît quand plus aucun monstre n'est près.",
        "- On le touche pour ouvrir la boutique (pas pendant un combat, pas quand il est caché). Sa bulle (pièce d'or)",
        "  n'apparaît que quand il est visible et à 6 cases ou moins du héros.",
        "- 4 articles tirés au hasard selon l'étage (un consommable, une arme ou une armure, des munitions, un peu rare).",
        "- VENDRE : il rachète tout objet du sac pour 40 % de sa valeur (or et gemmes non) ; prix « louches » : ±20 % au hasard.",
        "- Rien ne s'achète à crédit ; une fois ses 4 articles vendus, il garde la bulle mais ne fait plus que racheter.",
        "- Le Charisme (plus tard) baissera ses prix.",
    ]
    for i, r in enumerate(rules):
        d.text((20, 530 + i * 21), r, fill=gold if i == 0 else txt, font=font(12, i == 0))
    sheet.save("art/marchand_v1.png")
    print("ok")
