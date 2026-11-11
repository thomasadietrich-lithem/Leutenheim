"""Planche « objets v3 » (proposition, rien en jeu). Lancer depuis la racine du dépôt.

Retours de Thomas (2026-11-11, 13 h) : potions et cimeterre à refaire ; sac en toile avec cordelette et rab de tissu
en haut ; le gros tas d'or a deux colonnes collées, améliorer l'or ; l'émeraude garde la forme des diamants ;
feu à redessiner ; gouttes de sang (rouges ; vertes pour les Schrats) au sol et sur les murs, sans gore ;
pictogrammes des statuts (petits, sous les jauges) et bulles au-dessus des monstres.
Écrit art/objets_v3.png et art/objets_v3.json.
"""
import importlib.util, json, math
from PIL import Image, ImageDraw, ImageFont

spec = importlib.util.spec_from_file_location("v2", "art/objets_v2.py")
v2 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v2)
outline, pad, render = v2.v1.outline, v2.v1.pad, v2.render
PAL = dict(v2.PAL)
PAL.update({
    "1": "#7a0e14", "2": "#b0202a", "3": "#e04048",   # sang rouge : sombre, moyen, reflet
    "4": "#2a5a12", "5": "#4f8e1e", "6": "#8ccc3a",   # sang vert (Schrats)
    "7": "#5a2a10",  # cuivre sombre (pièces)
    "8": "#3a3a50",  # pierre du mur (fond des démonstrations)
})
N = {}

# ---------- Cimeterre v3 : lame de sabre qui part vers le haut puis se courbe vers la droite ----------
def scimitar():
    g = [["."] * 32 for _ in range(32)]
    P0, P1, P2 = (11, 20), (13, 3), (30, 5)
    def bez(t):
        x = (1 - t) ** 2 * P0[0] + 2 * (1 - t) * t * P1[0] + t * t * P2[0]
        y = (1 - t) ** 2 * P0[1] + 2 * (1 - t) * t * P1[1] + t * t * P2[1]
        return x, y
    for k in range(0, 240):
        t = k / 239
        x, y = bez(t)
        x2, y2 = bez(min(1, t + 0.01))
        tx, ty = x2 - x, y2 - y
        n = math.hypot(tx, ty) or 1
        nx, ny = ty / n, -tx / n  # normale vers l'extérieur de la courbe (en haut à gauche)
        width = 2.2 + 1.6 * math.sin(math.pi * min(1, t * 1.25))
        if t > 0.9:
            width *= (1 - t) / 0.1
        for w in [i * 0.5 for i in range(int(width * 2) + 1)]:
            px, py = round(x + nx * (1.2 - w)), round(y + ny * (1.2 - w))
            if not (0 <= px < 32 and 0 <= py < 32):
                continue
            c = "W" if w < 0.8 else ("S" if w < width - 0.9 else "D")
            if g[py][px] in ".D" or c == "W":
                g[py][px] = c
    # Garde : courte barre dorée aux quillons recourbés, perpendiculaire au départ de la lame.
    for x in range(7, 16):
        g[21][x] = "G"
    g[22][7] = "g"; g[22][15] = "g"; g[20][6] = "g"; g[20][16] = "g"
    # Poignée de cuir tressé, puis pommeau rond doré.
    for y in range(22, 28):
        g[y][10] = "b" if y % 2 else "B"
        g[y][11] = "B" if y % 2 else "b"
    for x, y in [(10, 28), (11, 28), (9, 29), (10, 29), (11, 29), (12, 29), (10, 30), (11, 30)]:
        g[y][x] = "G" if (x, y) != (12, 29) else "g"
    return outline(["".join(r) for r in g])

N["cimeterre"] = scimitar()

# ---------- Potions : une silhouette par potion ----------
N["potion_jouvence"] = outline(pad([   # fiole ronde, liquide doré, étincelle
    "",
    ".......bB.......",
    ".......Bb.......",
    "......cSSc......",
    ".......cS.......",
    ".....cSSSSc..W..",
    "....cFFFFFFc.Y..",
    "...cFWFFFFGGc...",
    "...cFWFFFGGGc...",
    "...cFFFFGGGfc...",
    "...cFFFGGGffc...",
    "....cFGGGffc....",
    ".....cGGffc.....",
    "......cccc......",
]))
N["potion_poison"] = outline(pad([      # flacon carré, étiquette crâne
    "",
    "......bBBb......",
    "......BbbB......",
    ".....cSSSSc.....",
    "......cSSc......",
    "....cSSSSSSc....",
    "....cAAAAAAc....",
    "....cAWLLLEc....",
    "....cAWLKLEc....",
    "....cAALLLEc....",
    "....cAALKLEc....",
    "....cAEEEEec....",
    "....cEEEEeec....",
    "....cccccccc....",
]))
N["potion_vitesse"] = outline(pad([     # fiole fine et haute, bleue, petite aile
    ".......bB.......",
    ".......Bb.......",
    "......cSSc......",
    "......cSSc......",
    "......cIIc......",
    ".....cIWIIc.....",
    ".....cIWIUc.SS..",
    ".....cIIUUcSSW..",
    ".....cIIUUc.SS..",
    ".....cIUUic.....",
    ".....cIUUic.....",
    ".....cUUiic.....",
    ".....cUUiic.....",
    "......cccc......",
]))
N["potion_feu"] = outline(pad([         # fiole ronde au long col, flamme peinte
    "",
    ".......bB.......",
    ".......Bb.......",
    ".......cS.......",
    ".......cS.......",
    "......cSSc......",
    "....ccXXXXcc....",
    "...cXWXXYXXxc...",
    "...cXWXYYYXxc...",
    "...cXXYYWYXxc...",
    "...cXXXYYXxxc...",
    "....cXXXXxxc....",
    ".....ccxxcc.....",
]))

# ---------- Sac en toile : panse, cordelette nouée, rab de tissu au-dessus ----------
N["sac_toile"] = outline(pad([
    "",
    "......z..z......",
    ".....zZzzZz.....",
    "......zZZz......",
    ".......LL.......",
    "......LzzLL.....",
    ".....zZZZZz.L...",
    "....ZZZZZZZz....",
    "...ZZZzZZZZZz...",
    "...ZZZZZzZZZz...",
    "...ZzZZZZZZZz...",
    "...ZZZZZZzZZz...",
    "...ZZZZZZZZzz...",
    "....zZZZZZzz....",
    ".....zzzzzz.....",
]))

# ---------- Or : piles de pièces bien séparées, tranche striée, dessus ovale ----------
def stacks(spec, loose=()):
    g = [["."] * 16 for _ in range(16)]
    base = 14
    for x0, n in spec:
        for k in range(n):
            y = base - 2 * k
            for x in range(x0, x0 + 4):
                g[y][x] = "g" if x < x0 + 3 else "7"
                g[y - 1][x] = "G" if x < x0 + 3 else "g"
        top = base - 2 * n
        g[top][x0] = "g"; g[top][x0 + 1] = "Y"; g[top][x0 + 2] = "G"; g[top][x0 + 3] = "g"
    for x, y in loose:
        g[y][x] = "Y"; g[y][x + 1] = "G"; g[y + 1][x] = "g"; g[y + 1][x + 1] = "7"
    return outline(["".join(r) for r in g])

N["or_petit"] = stacks([(6, 3)], loose=[(11, 13)])
N["or_moyen"] = stacks([(3, 4), (9, 3)])
N["or_gros"] = stacks([(0, 4), (5, 6), (11, 5)])

# ---------- Émeraude : même taille de brillant que les autres pierres ----------
N["emeraude"] = v2.gem(v2.BRILLIANT, "J", "E", "e")

# ---------- Feu : trois images de flammes pour une case ----------
def flame(phase):
    """Une grande langue de feu au centre, deux petites de côté, en goutte renversée, qui ondulent ; quelques braises."""
    g = [["."] * 16 for _ in range(16)]
    tongues = [(8, 13 - (phase % 2), 3.4), (4, 8 + (phase % 3), 2.2), (12, 9 - (phase % 2), 2.2)]
    for cx, h, maxw in tongues:
        top = 15 - h
        for y in range(top, 16):
            rel = (y - top) / h
            half = maxw * math.sqrt(rel) * (1 - 0.3 * rel ** 4)
            sway = math.sin((y + phase * 2) * 0.9) * 0.8 * (1 - rel)
            for x in range(16):
                dd = abs(x - (cx + sway))
                if dd > half:
                    continue
                c = "Y" if dd <= half * 0.3 and rel > 0.45 else ("X" if dd <= half * 0.65 and rel > 0.2 else "x")
                order = ".xXY"
                if order.index(c) > order.index(g[y][x]):
                    g[y][x] = c
    for x, y in [(2 + phase * 3 % 11, 2 + phase % 3), (13 - phase * 2 % 9, 4 - phase % 2)]:
        if g[y][x] == ".":
            g[y][x] = "Y"
    return ["".join(r) for r in g]

N["feu_1"], N["feu_2"], N["feu_3"] = flame(0), flame(1), flame(2)

# ---------- Sang : petites projections au sol et sur un mur (rouge ; vert pour les Schrats) ----------
def splat(dark, mid, light, kind):
    if kind == "sol1":
        rows = ["", "", "", "", "",
                ".....m..........",
                "...mmM.....m....",
                "....mMMm........",
                "...mMLMMm..m....",
                "....mMMMm.......",
                ".m...mMm........",
                ".........m......"]
    elif kind == "sol2":
        rows = ["", "", "", "", "", "",
                "........m.......",
                "..m...mmMm..m...",
                "......mMLMm.....",
                ".....mmMMMm..m..",
                "...m...mmm......",
                "......m........."]
    else:  # mur : des gouttes qui coulent un peu
        rows = ["", "",
                "....m....m......",
                "...mMm..mMm.....",
                "...mLMm.mMm..m..",
                "....mMm..m...M..",
                ".....M...m...m..",
                ".....m.......m..",
                ".....m..........",
                "......"]
    return pad([r.replace("m", dark).replace("M", mid).replace("L", light) for r in rows])

for name, cols in (("rouge", ("1", "2", "3")), ("vert", ("4", "5", "6"))):
    for kind in ("sol1", "sol2", "mur"):
        N[f"sang_{name}_{kind}"] = splat(*cols, kind)

# ---------- Statuts : petits pictogrammes (sous les jauges ; bulles au-dessus des monstres) ----------
STATUS = {
    "poison": [  # goutte verte
        "", "", "",
        ".......A........",
        "......AAE.......",
        ".....AAEEE......",
        "....AWAEEEe.....",
        "....AWEEEEe.....",
        "....AEEEEee.....",
        ".....EEEee......",
        "......eee.......",
    ],
    "feu": [
        "", "",
        ".......X........",
        "......XX....X...",
        "......XXX..XX...",
        ".....XXYXXXX....",
        "....XXYYYXXX....",
        "....XYYWYYXX....",
        "....XYYWYYX.....",
        ".....XYYYX......",
        "......xxx.......",
    ],
    "ralenti": [  # escargot bleu
        "", "", "", "",
        "........UUU.....",
        ".......UVVUU....",
        "......UVUUVU....",
        "..V...UVUVUU....",
        "..VU..UUVUUu....",
        "...UUUUUUUUu....",
        "....uuuuuuu.....",
    ],
    "sonne": [  # étoiles dorées
        "", "",
        "...G.......G....",
        "..GYG.....GYG...",
        "...G.......G....",
        "", "",
        ".......G........",
        "......GYG.......",
        ".......G........",
    ],
    "cache": [  # œil fermé
        "", "", "", "", "",
        "....LLLLLLLL....",
        "...L........L...",
        "..L.L..L..L..L..",
        "....L..L..L.....",
    ],
    "accelere": [  # éclair bleu clair
        "", "",
        "........VV......",
        ".......VV.......",
        "......VV........",
        ".....VVVVVV.....",
        ".........VV.....",
        "........VV......",
        ".......VV.......",
        "......V.........",
    ],
    "arme_poison": [  # lame verte
        "", "",
        "...........AW...",
        "..........AWE...",
        ".........AWE....",
        "........AWE.....",
        ".......AWE......",
        "...G..AWE.......",
        "....GGWE........",
        "....bGG.........",
        "...b..G.........",
    ],
    "rempart": [  # bouclier bleu
        "", "",
        "....UUUUUUU.....",
        "....UVVUUUu.....",
        "....UVUWUUu.....",
        "....UUWWWUu.....",
        "....UUUWUUu.....",
        ".....UUUUu......",
        "......UUu.......",
        ".......u........",
    ],
    "torche": [
        "", "",
        ".........Y......",
        "........XYX.....",
        "........XYX.....",
        ".........X......",
        "........b.......",
        ".......b........",
        "......b.........",
        ".....b..........",
    ],
}
for k, rows in STATUS.items():
    N["statut_" + k] = outline(pad(rows))

LABELS = {
    "cimeterre": "Cimeterre v3", "potion_jouvence": "Jouvence", "potion_poison": "Poison", "potion_vitesse": "Vitesse",
    "potion_feu": "Feu", "sac_toile": "Sac en toile v2", "or_petit": "Petite pile", "or_moyen": "Deux piles",
    "or_gros": "Trois piles", "emeraude": "Émeraude v2",
}

if __name__ == "__main__":
    json.dump({"palette": PAL, "icons": N}, open("art/objets_v3.json", "w"), ensure_ascii=False)
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 14)
    fs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
    W, H = 1120, 720
    sheet = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 18), "OBJETS v3 — proposition, rien en jeu", fill=(255, 243, 200), font=f, anchor="mm")

    def box(rows, x, y, label, s=5, bg=(36, 28, 20)):
        im = render(rows, s, PAL)
        bw, bh = max(im.size[0], 80) + 16, im.size[1] + 16
        d.rectangle([x, y, x + bw, y + bh], fill=bg, outline=(74, 62, 42), width=2)
        sheet.paste(im, (x + (bw - im.size[0]) // 2, y + 8), im)
        for k, line in enumerate(label.split("\n")):
            d.text((x + bw // 2, y + bh + 10 + k * 13), line, fill=(220, 210, 190), font=fs, anchor="mm")
        return bw

    d.text((20, 40), "CIMETERRE, POTIONS, SAC, OR, ÉMERAUDE", fill=(214, 170, 84), font=fs)
    x = 20
    x += box(N["cimeterre"], x, 60, "Cimeterre v3", 5) + 20
    for n in ("potion_jouvence", "potion_poison", "potion_vitesse", "potion_feu"):
        x += box(N[n], x, 60, LABELS[n]) + 14
    x = 220
    for n in ("sac_toile", "or_petit", "or_moyen", "or_gros", "emeraude"):
        x += box(N[n], x, 220, LABELS[n]) + 14

    # Feu et sang, sur de vraies dalles (case de sol violet-gris, mur de pierre).
    floor = (70, 61, 82)
    d.text((20, 380), "FEU (3 images qui alternent)", fill=(214, 170, 84), font=fs)
    x = 20
    for i in (1, 2, 3):
        x += box(N[f"feu_{i}"], x, 400, f"image {i}", 5, floor) + 14
    d.text((360, 380), "SANG : sol (2 formes) et mur ; rouge, vert pour les Schrats", fill=(214, 170, 84), font=fs)
    x = 360
    for name in ("rouge", "vert"):
        for kind in ("sol1", "sol2", "mur"):
            bg = (58, 58, 80) if kind == "mur" else floor
            x += box(N[f"sang_{name}_{kind}"], x, 400, f"{name} {kind}", 3, bg) + 10

    d.text((20, 560), "STATUTS (petits, sous les jauges ; en bulle au-dessus des monstres)", fill=(214, 170, 84), font=fs)
    names = [("poison", "Empoisonné"), ("feu", "En feu"), ("ralenti", "Ralenti"), ("sonne", "Sonné"), ("cache", "Caché"),
             ("accelere", "Accéléré"), ("arme_poison", "Arme emp."), ("rempart", "Dernier\nrempart"), ("torche", "Torche")]
    x = 20
    for k, label in names:
        x += box(N["statut_" + k], x, 580, label, 4) + 8
    sheet.save("art/objets_v3.png")
    print(sheet.size)
