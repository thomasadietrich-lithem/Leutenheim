"""Planche « objets v1 » (proposition, rien en jeu). Lancer depuis la racine du dépôt.

Nouveaux objets demandés par Thomas (2026-11-11) : pomme, torche, flèche empoisonnée, épée longue, lance,
cimeterre, armure de cuir cloutée, tas d'or petit / moyen / gros ; trois propositions de bourse ;
pictogramme d'étage. Même style que src/ui/icons.ts : palette commune, contour sombre ajouté automatiquement.
Tailles dans le sac : 1 case = 16 px ; épée longue 1x3, lance 1x4, cimeterre et armure 2x2.
Écrit art/objets_v1.png et art/objets_v1.json (lignes de lettres, pour la maquette d'inventaire).
"""
import json, math, re
from PIL import Image, ImageDraw, ImageFont

SRC = open("src/ui/icons.ts", encoding="utf8").read()
PAL = {k: v for k, v in re.findall(r'(\w): "(#[0-9a-f]{6})"', SRC.split("export const PALETTE")[1].split("};")[0])}
PAL.update({"O": "#e8782a", "Y": "#ffe27a", "A": "#b8e05a", "a": "#5e8a2a", "n": "#3c2814"})

def icon(name):
    """Une icône existante de icons.ts."""
    block = SRC.split(f"  {name}: [")[1].split("]")[0]
    return re.findall(r'"([^"]+)"', block)

def outline(rows):
    w, h = len(rows[0]), len(rows)
    g = [list(r) for r in rows]
    o = [r[:] for r in g]
    for y in range(h):
        for x in range(w):
            if g[y][x] == ".":
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < w and 0 <= ny < h and g[ny][nx] not in ".K":
                        o[y][x] = "K"
                        break
    return ["".join(r) for r in o]

def pad(rows, w=16, h=16):
    rows = [r.ljust(w, ".")[:w] for r in rows]
    return rows + ["." * w] * (h - len(rows))

N = {}

N["pomme"] = outline(pad([
    "................",
    "........b.......",
    "........b.EE....",
    ".......bEEEe....",
    "....RRRbRRe.....",
    "...RWWRRRRRR....",
    "..RWWRRRRRRRr...",
    "..RWRRRRRRRRr...",
    "..RRRRRRRRRRr...",
    "..RRRRRRRRRrr...",
    "..RRRRRRRRRrr...",
    "...RRRRRRRrr....",
    "...rRRRRRrrr....",
    "....rrr.rrr.....",
    "................",
]))

N["torche"] = outline(pad([
    "..........Y.....",
    ".........OYO....",
    "........OYWYO...",
    "........OYWYO...",
    ".........OYO....",
    "........LnLn....",
    ".......nLnL.....",
    "......TB........",
    ".....TB.........",
    "....TB..........",
    "...TB...........",
    "..TB............",
    ".tB.............",
    ".t..............",
]))

poison = [r.replace("W", "A").replace("S", "a") for r in icon("fleche")]
poison[5] = poison[5][:13] + "A.."
poison[6] = poison[6][:13] + "a.."
N["fleche_poison"] = outline([r.replace("K", ".") for r in poison])

def blade(length, guard, grip):
    rows = [".......WD......."]
    rows += [".......WSD......" if i % 5 == 2 else "......WWSD......" for i in range(length)]
    rows[1] = "......WWD......."
    rows += [guard, guard.replace("D", "C").replace("S", "c")]
    rows += ["......BbB......." if i % 2 else "......bBb......." for i in range(grip)]
    rows += [".....GGgg.......", "......gg........"]
    return rows

N["epee_longue"] = outline(pad(blade(34, "..SSSSSSSSSD....", 6), 16, 48))

lance = ["........S.......", ".......SWD......", "......SWWSD.....", "......WWSSD.....", ".....SWWSSD.....",
         ".....WWSSDD.....", "......WSSD......", "......WSD.......", ".......D........", "......bGg.......", "......GgG......."]
lance += [".......B........" if i % 3 else ".......T........" for i in range(49)]
lance += ["......bBb.......", "......SDD.......", ".......D........"]
N["lance"] = outline(pad(lance, 16, 64))

def scimitar():
    g = [["."] * 32 for _ in range(32)]
    # Lame courbe : un arc de cercle du talon à la pointe, plus large vers la pointe.
    cx, cy, r = 30, 28, 22
    for k in range(0, 101):
        t = math.radians(180 + 90 * k / 100)
        x, y = cx + r * math.cos(t), cy + r * math.sin(t)
        width = 2 + (1 if 35 < k < 85 else 0)
        for w in range(width):
            px, py = round(x + w * 0.7), round(y + w * 0.7)
            if 0 <= px < 32 and 0 <= py < 32:
                g[py][px] = "W" if w == 0 else ("S" if w == 1 else "D")
    # La pointe remonte un peu.
    g[6][29] = "W"; g[5][30] = "W"
    for x, y, c in [(5, 26, "g"), (6, 25, "G"), (7, 24, "G"), (8, 25, "G"), (9, 26, "g"), (4, 27, "g"),
                    (5, 28, "B"), (4, 29, "b"), (3, 30, "B"), (2, 31, "G")]:
        g[y][x] = c
    return outline(["".join(r) for r in g])

N["cimeterre"] = scimitar()

stud = [list(r) for r in icon("armure_cuir")]
for y, row in enumerate(stud):
    for x, c in enumerate(row):
        if c in "TB":
            row[x] = {"T": "t", "B": "B"}[c] if (x // 3 + y // 3) % 2 else {"T": "T", "B": "t"}[c]
        if c in "TB" and x % 4 == 1 and y % 4 == 1:
            row[x] = "c"
N["armure_cloutee"] = ["".join(r) for r in stud]

N["or_petit"] = outline(pad([
    "", "", "", "", "", "", "", "",
    "................",
    "......GGg.......",
    ".....GYGGg......",
    ".....GGGgg..GGg.",
    "......ggg..GYGGg",
    "...........GGGgg",
    "............ggg.",
]))
N["or_moyen"] = outline(pad([
    "", "", "", "", "",
    "......GGGg......",
    ".....GYGGgg.....",
    ".....gggggg.....",
    ".....GYGGgg.....",
    ".....gggggg.....",
    "..GGgGYGGggGGg..",
    ".GYGggggggGYGGg.",
    ".GGGgGYGGggGGgg.",
    "..gggggggggggg..",
]))
N["or_gros"] = outline(pad([
    "", "",
    ".......GGg......",
    "......GYGGg.....",
    ".....GGYGGgg....",
    "....GGYGGGGgg...",
    "...GGYGGGGGGgg..",
    "...GYGGGGGGGGg..",
    "..GGYGGGGGGGGgg.",
    "..GYGGGGGGGGGgg.",
    ".GGYGGGGGGGGGGgg",
    ".GYGGGGGGGGGGGgg",
    "..ggggggggggggg.",
    ".GGg.......GYGg.",
    "..gg........gg..",
]))

N["bourse_A"] = outline(pad([
    "................",
    "......B..B......",
    ".....BTB.TB.....",
    "......BTTB......",
    ".......GG.......",
    "......bLLb......",
    ".....TBBBBB.....",
    "....TTBBBBBb....",
    "...TTBBBBBBBb...",
    "...TBBBBGGBBb...",
    "...TBBBGYGGBb...",
    "...TBBBBGgBBb...",
    "...BBBBBBBBbb...",
    "....bBBBBBbb....",
    ".....bbbbbb.....",
]))
N["bourse_B"] = outline(pad([
    "................",
    "....GG....GG....",
    "....Gg....Gg....",
    "...GYGGGGGGGg...",
    "...gggggggggg...",
    "..TTTTTTTTTTTB..",
    "..TBBBBBBBBBBb..",
    "..TBBBBBBBBBBb..",
    "..TBBBBBBBBBBb..",
    "..TBBBBBBBBBBb..",
    "..TBBBBBBBBBBb..",
    "...BBBBBBBBBb...",
    "....bbbbbbbb....",
]))
N["bourse_C"] = outline(pad([
    "................",
    ".......LL.......",
    "......L..L......",
    ".......LL.......",
    "......bBBb......",
    ".....TTBBBB.....",
    "....TTBBBBBb....",
    "...TTBBGGGBBb...",
    "...TBBGYGGgBb...",
    "...TBBGGGGgBb...",
    "...TBBGGGggBb...",
    "...TBBBgggBBb...",
    "...BBBBBBBBbb...",
    "....bBBBBBbb....",
    ".....bbbbbb.....",
]))
N["etage"] = outline(pad([
    "", "",
    "..DDDDDDDDDDDD..",
    "..DHHHHHHHHHHc..",
    "..DCCCCCCCCCHc..",
    "..DHHHHHHHHCHc..",
    "..DCCCCCCCHCHc..",
    "..DHHHHHHCHCHc..",
    "..DCCCCCHCHCHc..",
    "..DHHHHCHCHCHc..",
    "..DCCCHCHCHCHc..",
    "..DHHCHCHCHCHc..",
    "..Dcccccccccc...",
]))

DEC = open("src/render/sprites/decor.ts", encoding="utf8").read()
DPAL = dict(re.findall(r'"(\w)": "(#[0-9a-f]{6})"', DEC.split("DECOR_PALETTE")[1].split("};")[0]))
STAIRS = re.findall(r'"([^"]+)"', DEC.split("stairsDown: [")[1].split("]")[0])
del N["etage"]

LABELS = {
    "pomme": "Pomme (commun)\n+5 PV", "torche": "Torche (commun)\n100 tours", "fleche_poison": "Flèche emp.\n(peu commun, Lv4)",
    "or_petit": "Petit tas d'or\n(commun)", "or_moyen": "Tas moyen\n(peu commun)", "or_gros": "Gros tas\n(rare)",
    "epee_longue": "Épée longue\nLv2, lente", "lance": "Lance\nLv2, lente, +1 case", "cimeterre": "Cimeterre\nLv5, rapide",
    "armure_cloutee": "Cuir clouté\nLv5, rare",
    "bourse_A": "Bourse A\ncordon, pièce", "bourse_B": "Bourse B\nà fermoir", "bourse_C": "Bourse C\npièce cousue",
    "etage": "Picto étage", "or": "bourse actuelle",
}

def render(rows, s, pal=None):
    pal = pal or PAL
    w, h = len(rows[0]), len(rows)
    im = Image.new("RGBA", (w * s, h * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ".":
                d.rectangle([x * s, y * s, x * s + s - 1, y * s + s - 1], fill=pal[c])
    return im

if __name__ == "__main__":
    json.dump({"palette": PAL, "icons": N}, open("art/objets_v1.json", "w"), ensure_ascii=False)
    S = 5
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 14)
    fs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
    W, H = 900, 800
    sheet = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 18), "OBJETS v1 — proposition, rien en jeu", fill=(255, 243, 200), font=f, anchor="mm")

    def box(name, x, y, rows=None):
        rows = rows or N[name]
        im = render(rows, S)
        bw, bh = im.size[0] + 16, im.size[1] + 16
        d.rectangle([x, y, x + bw, y + bh], fill=(36, 28, 20), outline=(74, 62, 42), width=2)
        sheet.paste(im, (x + 8, y + 8), im)
        for k, line in enumerate(LABELS[name].split("\n")):
            d.text((x + bw // 2, y + bh + 10 + k * 13), line, fill=(220, 210, 190), font=fs, anchor="mm")
        return bw

    d.text((20, 50), "OBJETS DE 1 CASE", fill=(214, 170, 84), font=fs)
    x = 20
    for n in ("pomme", "torche", "fleche_poison", "or_petit", "or_moyen", "or_gros"):
        x += box(n, x, 70) + 40
    d.text((20, 210), "ARMES ET ARMURE (taille dans le sac)", fill=(214, 170, 84), font=fs)
    x = 20
    for n in ("epee_longue", "lance", "cimeterre", "armure_cloutee"):
        x += box(n, x, 230) + 50
    d.text((20, 630), "BOURSE (actuelle, puis trois propositions)", fill=(214, 170, 84), font=fs)
    x = 20
    LABELS["or"] = "Actuelle"
    x += box("or", x, 650, icon("or")) + 40
    for n in ("bourse_A", "bourse_B", "bourse_C"):
        x += box(n, x, 650) + 40
    # Le picto d'étage dans la barre du haut, à côté du menu.
    y0 = 480
    d.text((560, y0 - 20), "ÉTAGE EN HAUT À DROITE (picto = escalier du jeu)", fill=(214, 170, 84), font=fs)
    bar = (560, y0, 880, y0 + 44)
    d.rectangle(bar, fill=(20, 15, 10))
    d.rectangle([566, y0 + 8, 700, y0 + 18], fill=(150, 30, 40)); d.text((633, y0 + 13), "PV 12/12", fill=(255, 255, 255), font=fs, anchor="mm")
    d.rectangle([566, y0 + 24, 700, y0 + 32], fill=(60, 90, 150))
    st = render(STAIRS, 2, DPAL)
    sheet.paste(st, (712, y0 + 6), st)
    vt = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 22)
    d.text((748, y0 + 22), "3", fill=(240, 192, 80), font=vt, anchor="lm")
    d.rectangle([826, y0 + 4, 862, y0 + 40], fill=(36, 28, 20), outline=(74, 62, 42), width=2)
    menu = render(icon("menu"), 2)
    sheet.paste(menu, (828, y0 + 6), menu)
    d.text((720, y0 + 60), "jauges · escalier + numéro · menu", fill=(200, 190, 170), font=fs, anchor="mm")
    sheet.save("art/objets_v1.png")
    print(sheet.size)
