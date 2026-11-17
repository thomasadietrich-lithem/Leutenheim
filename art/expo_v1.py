"""Hall d'exposition (section 2), planche v1 à valider (Thomas, 2026-11-17 : « propose ; ok pour la quête »).

    python3 art/expo_v1.py   → art/expo_v1.png

Contenu : dalle claire, tapis bleu, socle et cinq sculptures (poulet qui picore, qui crie, en vol ; pomme croquée,
pomme géante), tabouret, chandelier, deux tableaux (poulet, pomme), pomme dorée sous cloche et son écriteau, le socle
vide du Grand Poulet d'Or, Vernis le Kobold conservateur, et les icônes du ticket d'exposition et du pinceau magique.
Même contour sombre et même angle 3/4 que les autres salles.
"""
from PIL import Image, ImageDraw, ImageFont

PAL = {
    "K": (26, 18, 12), "O": (24, 18, 30),
    # pierre claire du sol et des socles
    "1": (214, 206, 186), "2": (190, 180, 160), "3": (160, 150, 132), "4": (122, 112, 98),
    # marbre des sculptures
    "W": (244, 240, 230), "w": (212, 206, 196), "x": (170, 164, 156),
    # bois
    "B": (154, 106, 52), "b": (96, 62, 28), "T": (185, 130, 74),
    # bleu du tapis
    "U": (60, 96, 170), "u": (36, 62, 120), "V": (98, 140, 210),
    # or
    "G": (240, 192, 80), "g": (168, 124, 28), "Y": (255, 226, 122),
    # rouge, vert (tableaux)
    "R": (208, 58, 68), "r": (142, 31, 40), "E": (92, 200, 96), "e": (46, 122, 56),
    # verre
    "C": (200, 230, 240), "c": (150, 190, 210),
    # flamme
    "F": (255, 216, 74), "f": (232, 120, 42),
    # Kobold conservateur
    "A": (176, 188, 150), "a": (112, 124, 90), "L": (222, 220, 146), "P": (110, 70, 150), "p": (70, 44, 104), "M": (224, 230, 236),
    # ticket
    "Z": (236, 222, 176), "z": (180, 160, 110),
}

S = {}

S["dalle"] = [
    "1111111211111112",
    "1111111211111112",
    "1111121211111112",
    "1111111211111112",
    "1111111211111112",
    "1211111211112112",
    "1111111211111112",
    "2222222222222222",
    "1111211111111211",
    "1111211111111211",
    "1111211121111211",
    "1111211111111211",
    "1111211111111211",
    "1111211111121211",
    "1111211111111211",
    "2222222222222222",
]

# Tapis bleu 3 × 2 cases, comme le rouge : bordure dorée, frange, un coin élimé.
tapis = []
for y in range(32):
    row = ""
    for x in range(48):
        if y in (0, 31) or x in (0, 47):
            c = "g" if (x + y) % 2 else "G"
        elif y in (1, 30) or x in (1, 46):
            c = "u"
        elif y in (3, 28) or x in (3, 44):
            c = "G"
        elif (x - 24) ** 2 / 64 + (y - 16) ** 2 / 25 < 1 and (x + y) % 3 == 0:
            c = "V"
        elif (x * 3 + y * 5) % 11 == 0:
            c = "u"
        else:
            c = "U"
        if x > 40 and y > 25 and (x - 40) + (y - 25) > 10:
            c = "."
        row += c
    tapis.append(row)
S["tapis bleu"] = tapis

SOCLE = [
    "..KKKKKKKKKKKK..",
    ".K111111111112K.",
    ".K122222222223K.",
    "..K2222222223K..",
    "..K2222222223K..",
    "..K2222222223K..",
    ".K333333333334K.",
    ".KKKKKKKKKKKKKK.",
]


def on_socle(top):
    return top + SOCLE


S["poulet picore"] = on_socle([
    "................",
    "................",
    "................",
    "......KKK.......",
    ".....KWWWK......",
    "....KWWKWK......",
    "...KwwKWWK......",
    "....KK.KWWKKK...",
    "......KWWWWWWK..",
    ".....KWWWWwWWK..",
    ".....KWwWWWwK...",
    "......KKwwwK....",
    ".......K..K.....",
    ".......K..K.....",
])
S["poulet qui crie"] = on_socle([
    "......KK........",
    ".....KWWK.......",
    "....KWWWK.......",
    "...KWKWWK.....K.",
    "..KwK.KWK....KWK",
    "...KKwKWK...KWWK",
    "......KWWKKKWWK.",
    ".....KWWWWWWWWK.",
    "....KWWWwWWWWK..",
    "....KWwWWWWwK...",
    ".....KKwwwwK....",
    ".......K..K.....",
    ".......K..K.....",
    "................",
])
S["poulet en vol"] = on_socle([
    "K.............K.",
    "KWK..........KWK",
    "KWWK...KK...KWWK",
    ".KWWK.KWWK.KWWK.",
    ".KWWWKWKWKKWWWK.",
    "..KWWWWWWWWWWK..",
    "...KwWWWWWWwK...",
    "....KwWWWWwK....",
    ".....KwwwwK.....",
    "......KxxK......",
    ".......KK.......",
    ".......Kx.......",
    ".......Kx.......",
    ".......KK.......",
])
S["pomme croquée"] = on_socle([
    "................",
    "........K.......",
    ".......Kx.......",
    "......KxKKK.....",
    "....KKWWKwWK....",
    "...KWWWWKKWK....",
    "..KWWWWK...K....",
    "..KWWWWK........",
    "..KWWWWK...K....",
    "..KWWwWWKKWK....",
    "...KWWwwWWK.....",
    "....KKwwwKK.....",
    "......KKK.......",
    "................",
])
S["pomme géante"] = on_socle([
    ".......KK.......",
    "......KxK.KKK...",
    "...KKKKxKKwwK...",
    "..KWWWWKWWKK....",
    ".KWWWWWWWWWWK...",
    "KWWWWWWWWWWWWK..",
    "KWWwWWWWWWWWWK..",
    "KWWwWWWWWWWWwK..",
    "KWWWWWWWWWWWwK..",
    "KWWWWWWWWWWwwK..",
    ".KWWWWWWWWwwK...",
    "..KwWWWWWwwK....",
    "...KKwwwwKK.....",
    ".....KKKK.......",
])
S["socle vide (Grand Poulet d'Or)"] = on_socle(["................"] * 12 + ["....K......K....", "...KxK....KxK..."])

S["tabouret"] = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "....KKKKKKKK....",
    "...KTTTTTTTTK...",
    "...KBBBBBBBBK...",
    "....KbKKKKbK....",
    "....KbK..KbK....",
    "....KbKKKKbK....",
    "....KbBBBBbK....",
    "....KbK..KbK....",
    "...KbbK..KbbK...",
    "...KKK....KKK...",
    "................",
]

S["chandelier"] = [
    "...F....F....F..",
    "..FfF..FfF..FfF.",
    "...K....K....K..",
    "..KWK..KWK..KWK.",
    "..KWK..KWK..KWK.",
    "..KGK..KGK..KGK.",
    "..KgGGGGgGGGGgK.",
    "...KKKKKGKKKKK..",
    ".......KGK......",
    ".......KgK......",
    ".......KGK......",
    ".......KgK......",
    ".......KGK......",
    "......KGgGK.....",
    ".....KgGGGgK....",
    ".....KKKKKKK....",
]


def frame(inner):
    w = len(inner[0])
    out = ["K" + "G" * (w + 2) + "K", "KG" + "g" * w + "GK"]
    for r in inner:
        out.append("KGg" + r[: w - 2] + "gGK")
    out.append("KG" + "g" * w + "GK")
    out.append("K" + "G" * (w + 2) + "K")
    return out


S["tableau : poulet"] = frame([
    "uuuuuuuuuuuuuuuuuuuuuuuuuu",
    "uuuuuuuuuuuuuuuKKuuuuuuuuu",
    "uuuuuuuuuuuuuuKWRKuuuuuuuu",
    "uuuuuuuuuuuuuKWWKWKuuuuuuu",
    "uuuuuuuuuuuuKWWWWWKFuuuuuu",
    "uuuuuuuKKKKKWWWWWKuuuuuuuu",
    "uuuuuuKWWWWWWWWWKuuuuuuuuu",
    "uuuuuuKWWwWWWWWWKuuuuuuuuu",
    "uuuuuuuKWWwwWWWKuuuuuuuuuu",
    "eeeeeeeeKKKKKKKeeeeeeeeeee",
    "eeeEeeeeeeKeKeeeeeeEeeeeee",
    "eeeeeeeEeeeeeeeeeeeeeeEeee",
])
S["tableau : pomme"] = frame([
    "pppppppppppppppppppppppppp",
    "ppppppppppppKbKpppppppppppp"[:26],
    "pppppppppppKbKKEEpppppppppp"[:26],
    "pppppppppKKRRbRRKKppppppppp"[:26],
    "ppppppppKRRRRRRRRRKpppppppp"[:26],
    "pppppppKRRWRRRRRRRRKppppppp"[:26],
    "pppppppKRWRRRRRRRRRKppppppp"[:26],
    "pppppppKRRRRRRRRRrRKppppppp"[:26],
    "ppppppppKRRRRRRRrrKpppppppp"[:26],
    "pppppppppKKrrrrrKKppppppppp"[:26],
    "TTTTTTTTTTTKKKKKTTTTTTTTTTT"[:26],
    "bbbbbbbbbbbbbbbbbbbbbbbbbbb"[:26],
])

S["pomme dorée sous cloche"] = [
    ".....KKKKKK.....",
    "....KCCCCCcK....",
    "...KC......cK...",
    "..KC...Kb...cK..",
    "..KC..KKbK..cK..",
    "..KC.KGGGGK.cK..",
    "..KCKGYGGGgKcK..",
    "..KCKGYGGGgKcK..",
    "..KCKGGGGggKcK..",
    "..KC.KggggK.cK..",
    "..KC..KKKK..cK..",
    "..KcCCCCCCCCcK..",
    ".KKKKKKKKKKKKKK.",
    ".K111111111112K.",
    ".K333333333334K.",
    ".KKKKKKKKKKKKKK.",
]
S["écriteau"] = [
    "................",
    "................",
    "................",
    "................",
    "..KKKKKKKKKKKK..",
    ".KGGGGGGGGGGGgK.",
    ".KGgKgKKgKgKGgK.",
    ".KGgggggggggGgK.",
    ".KGgKKgKgKKgGgK.",
    ".KgggggggggggGK.",
    "..KKKKKKKKKKKK..",
    "......KbbK......",
    "......KbbK......",
    "......KbbK......",
    ".....KbbbbK.....",
    ".....KKKKKK.....",
]

S["Vernis, Kobold conservateur"] = [
    "................",
    "................",
    "...O........O...",
    "..OLOOOOOOOOLO..",
    "...OLaAAAAaLO...",
    "..OaAAAAAAGGGO..",
    "..OAYKAAAGMKGO..",
    "..OAAAAAAAGGGO..",
    "...OaALLLLAagO..",
    "...OaLKLLKLaOg..",
    "....OaTLLTaO....",
    "...OAPpRRpPAO...",
    "..OAPpPRRPpPAO..",
    "..OaOPpPPpPOaO..",
    "...OOAAOOAAOO...",
    "....OaaOOaaO....",
]

S["ticket d'exposition (icône)"] = [
    "................",
    "................",
    "................",
    ".KKKKKKKKKKKKKK.",
    ".KZZZZKzKZZZZZK.",
    ".KZRRZKzKZzzzZK.",
    ".KZRERZ.ZZZZZZK.",
    ".KZRRRZKzKzzzZK.",
    ".KZRRRZKzKZZZZK.",
    ".KZZRZZ.ZzzzzZK.",
    ".KZZZZKzKZZZZZK.",
    ".KKKKKKKKKKKKKK.",
    "................",
    "................",
    "................",
    "................",
]
S["pinceau magique (icône)"] = [
    "............KKK.",
    "...........KbBK.",
    "..........KbBK..",
    ".........KbBK...",
    "........KbBK....",
    ".......KbBK.....",
    "......KbBK......",
    ".....KGgK.......",
    "....KGgGK.......",
    "...KxxxK........",
    "..KxPPxK........",
    "..KPPpK...Y.....",
    ".KPPpK...YFY....",
    ".KPpK.....Y.....",
    "..KK............",
    "................",
]


def render():
    scale = 6
    names = list(S)
    pad = 24
    col_w = 48 * scale + pad
    cols = 4
    cells = []
    for n in names:
        rows = S[n]
        cells.append((n, rows))
    heights = [len(r) * scale for _, r in cells]
    row_h = max(heights) + 40
    nrows = (len(cells) + cols - 1) // cols
    img = Image.new("RGB", (cols * col_w + pad, nrows * row_h + pad), (20, 17, 24))
    d = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("DejaVuSans.ttf", 16)
    except OSError:
        font = ImageFont.load_default()
    for i, (n, rows) in enumerate(cells):
        cx = pad + (i % cols) * col_w
        cy = pad + (i // cols) * row_h
        # fond de dalles claires pour juger les objets posés
        w = len(rows[0])
        for ty in range(0, len(rows), 16):
            for tx in range(0, w, 16):
                for y, r in enumerate(S["dalle"]):
                    for x, ch in enumerate(r):
                        if tx + x < w and ty + y < len(rows):
                            c = tuple(int(v * 0.55) for v in PAL[ch])
                            d.rectangle([cx + (tx + x) * scale, cy + (ty + y) * scale, cx + (tx + x + 1) * scale - 1, cy + (ty + y + 1) * scale - 1], fill=c)
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch == ".":
                    continue
                d.rectangle([cx + x * scale, cy + y * scale, cx + (x + 1) * scale - 1, cy + (y + 1) * scale - 1], fill=PAL[ch])
        d.text((cx, cy + len(rows) * scale + 6), n, fill=(230, 220, 190), font=font)
    img.save("art/expo_v1.png")
    print(img.size)


if __name__ == "__main__":
    render()
