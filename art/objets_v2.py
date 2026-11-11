"""Planche « objets v2 » (proposition, rien en jeu). Lancer depuis la racine du dépôt.

Retours de Thomas (2026-11-11) : la lance n'est pas pointue, le cimeterre est moche, les tas d'or illisibles
(« garde des piles, sur les trois ») ; nouveautés : gemmes, sacs, potions, pictogrammes des trois voies du Guerrier,
tête du héros pour le bouton du personnage.
Même méthode que objets_v1 : palette de src/ui/icons.ts, contour sombre automatique.
Écrit art/objets_v2.png et art/objets_v2.json.
"""
import importlib.util, json, re
from PIL import Image, ImageDraw, ImageFont

spec = importlib.util.spec_from_file_location("v1", "art/objets_v1.py")
v1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v1)
outline, pad = v1.outline, v1.pad
PAL = dict(v1.PAL)
PAL.update({
    "Q": "#b48ce0",  # améthyste claire
    "J": "#8ef0a0",  # émeraude claire
    "Z": "#d8c8a0",  # toile claire
    "z": "#a08c64",  # toile sombre
    "X": "#ff9a3a",  # feu
    "x": "#c03a1a",
    "F": "#ffd84a",  # jouvence
    "f": "#c89a14",
    "I": "#6ad0ff",  # vitesse
    "i": "#2a7ac8",
})
N = {}

# ---------- Lance : longue pointe en feuille, bien effilée ----------
lance = [
    "........W.......",
    "........W.......",
    ".......WS.......",
    ".......WSD......",
    "......WWSD......",
    "......WSSD......",
    "......WSSDD.....",
    ".....WWSSDD.....",
    ".....WWSSDD.....",
    "......WSSD......",
    ".......SD.......",
    "......gGGg......",
    ".......Bt.......",
]
lance += [".......BT......." if i % 3 else ".......Bt......." for i in range(47)]
lance += ["......bBtb......", ".......DD.......", "........D......."]
N["lance"] = outline(pad(lance, 16, 64))

# ---------- Cimeterre : lame courbe qui s'élargit vers la pointe, garde en croix, poignée et pommeau ----------
def scimitar():
    g = [["."] * 32 for _ in range(32)]
    # Lame : on suit une courbe du talon (bas gauche) vers la pointe (haut droite), largeur croissante, dos sombre.
    import math
    pts = []
    for k in range(0, 61):
        t = k / 60
        x = 8 + 21 * t
        y = 22 - 19 * t + 7 * math.sin(math.pi * t) * 0.9  # bombée vers le bas : le tranchant est convexe
        pts.append((x, y, t))
    for x, y, t in pts:
        width = 2 + round(2.2 * math.sin(math.pi * min(1, t * 1.15)))  # plus large aux deux tiers
        if t > 0.93:
            width = 1
        for w in range(width):
            px, py = round(x - w * 0.55), round(y - w * 0.85)
            if 0 <= px < 32 and 0 <= py < 32:
                g[py][px] = "W" if w == 0 else ("S" if w < width - 1 else "D")
    # La lame part à l'horizontale au talon : la garde est verticale, la poignée file vers la gauche.
    for y in range(19, 26):
        g[y][7] = "G" if 20 <= y <= 24 else "g"
    for x in range(3, 7):
        g[22][x] = "B" if x % 2 else "b"
        g[23][x] = "b" if x % 2 else "B"
    g[22][2] = "G"; g[23][2] = "G"; g[22][1] = "g"; g[23][1] = "g"
    return outline(["".join(r) for r in g])

N["cimeterre"] = scimitar()

# ---------- Or : des piles de pièces (petit, moyen, gros) ----------
def stacks(spec):
    """spec : liste de (x gauche, nombre de pièces). Chaque pièce : un bord clair puis un bord sombre ; le dessus est un ovale clair."""
    g = [["."] * 16 for _ in range(16)]
    base = 14
    for x0, n in spec:
        for k in range(n):
            y = base - 2 * k
            for x in range(x0, x0 + 5):
                g[y][x] = "g"
                g[y - 1][x] = "G" if x < x0 + 4 else "g"
        top = base - 2 * n
        for x in range(x0 + 1, x0 + 4):
            g[top][x] = "Y" if x == x0 + 1 else "G"
    return outline(["".join(r) for r in g])

N["or_petit"] = stacks([(5, 3)])
N["or_moyen"] = stacks([(3, 3), (8, 2)])
N["or_gros"] = stacks([(1, 4), (5, 6), (10, 5)])

# ---------- Gemmes ----------
BRILLIANT = [
    "", "", "",
    ".....1w1122.....",
    "....1ww112223...",
    "...11111122233..",
    "...22222233333..",
    "....222223333...",
    ".....2222333....",
    "......22333.....",
    ".......233......",
    "........3.......",
]
def gem(shape, light, mid, dark, hi="W"):
    rows = [r.replace("1", light).replace("2", mid).replace("3", dark).replace("w", hi) for r in shape]
    return outline(pad(rows))

N["amethyste"] = gem(BRILLIANT, "Q", "P", "p")
N["saphir"] = gem(BRILLIANT, "V", "U", "u")
N["emeraude"] = gem([
    "", "", "", "",
    ".....111122.....",
    "....1w11112.....",
    "...11112222.....",
    "...2222223333...",
    "...2222223333...",
    "....22233333....",
    ".....333333.....",
][:4] + [
    "....11111122....",
    "...1w1111122....",
    "...1122222233...",
    "...2222222333...",
    "...2222223333...",
    "...2222333333...",
    "....33333333....",
], "J", "E", "e")
N["diamant"] = gem(BRILLIANT, "W", "S", "D", "V")

# ---------- Sacs ----------
N["sac_toile"] = outline(pad([
    "", "",
    ".......LL.......",
    "......L..L......",
    "......zZZz......",
    ".....zZZZZz.....",
    "....ZZZZZZZz....",
    "...ZZZzZZZZZz...",
    "...ZZZZZzZZZz...",
    "...ZzZZZZZZZz...",
    "...ZZZZZZzZZz...",
    "...ZZZZZZZZzz...",
    "....zZZZZZzz....",
    ".....zzzzzz.....",
]))
N["sac_cuir"] = outline(pad([
    "", "",
    ".....bbbbbb.....",
    "....b......b....",
    "...TTTTTTTTTTB..",
    "...TBBBBBBBBTb..",
    "...TBBBBBBBBBb..",
    "...TTTTTTTTTTb..",
    "...TBBBBGGBBBb..",
    "...TBBBBGgBBBb..",
    "...TBBBBBBBBBb..",
    "...TBBBBBBBBBb..",
    "...BBBBBBBBBBb..",
    "....bbbbbbbbb...",
]))
N["sac_voyage"] = outline(pad([
    "...RRRRRRRRRR...",
    "..RrRRrRRrRRrR..",
    "...rrrrrrrrrr...",
    "...TTTTTTTTTT...",
    "..TBBBBBBBBBBT..",
    "..TBBTTTTTTBBb..",
    "..TBBTBBBBTBBb..",
    "..TBBTBGGBTBBb..",
    "..TBBTTTTTTBBb..",
    "..TBBBBBBBBBBb..",
    "..TBBBBBBBBBBb..",
    "..TBbbbbbbbbBb..",
    "..TBbBBBBBBbBb..",
    "..TBbbbbbbbbBb..",
    "...BBBBBBBBBb...",
]))

# ---------- Potions : même fiole, liquide de couleur ----------
FLASK = [
    "",
    "......bBb.......",
    "......BBb.......",
    "......cSc.......",
    "......cSc.......",
    ".....cSSSc......",
    "...cc11111cc....",
    "..c1w1111122c...",
    "..c1w1111222c...",
    "..c11111122223c.",
    "..c11111222233c.",
    "..c1111122233c..",
    "...c12222333c...",
    "....cc2233cc....",
    "......cccc......",
]
FLASK = [r[:15] for r in FLASK]
def potion(light, mid, dark):
    return outline(pad([r.replace("1", light).replace("2", mid).replace("3", dark).replace("w", "W") for r in FLASK]))

N["potion_jouvence"] = potion("F", "G", "f")
N["potion_poison"] = potion("A", "E", "e")
N["potion_vitesse"] = potion("I", "U", "i")
N["potion_feu"] = potion("Y", "X", "x")

# ---------- Voies du Guerrier (pictogrammes) ----------
N["voie_bleue"] = outline(pad([  # Second souffle : cœur bleu et croix de soin
    "", "",
    "...UUU...UUU....",
    "..UVVUU.UUUUU...",
    ".UVVUUUUUUUUUu..",
    ".UVUUUUWWUUUUu..",
    ".UUUUUUWWUUUUu..",
    ".UUUUWWWWWWUUu..",
    "..UUUWWWWWWUu...",
    "...UUUUWWUUu....",
    "....UUUWWUu.....",
    ".....UUUUu......",
    "......UUu.......",
    ".......u........",
]))
N["voie_rouge"] = outline(pad([  # Double frappe : deux entailles rouges parallèles
    "",
    "..........RW....",
    ".........RW.....",
    "....RW..RW......",
    "...RW..RW.......",
    "..RW..RW........",
    ".RW..RW.........",
    "RW..RW..........",
    "...RW...........",
    "..RW............",
    "", "",
    "..rrrr..rrrr....",
]))
N["voie_rouge"] = outline(pad([
    "",
    ".............RR.",
    "........RR..RRr.",
    ".......RRr.RRr..",
    "......RRr.RRr...",
    ".....RRr.RRr....",
    "....RRr.RRr.....",
    "...RRr.RRr......",
    "..RRr.RRr.......",
    ".RRr.RRr........",
    "RRr.RRr.........",
    "Rr..Rr..........",
]))
N["voie_verte"] = outline(pad([  # Bousculade : trois chevrons verts qui repoussent
    "", "",
    "..E....E....E...",
    "..EE...EE...EE..",
    "..eEE..eEE..eEE.",
    "...eEE..eEE..eEE",
    "....eEE..eEE..eE",
    "....eEE..eEE..eE",
    "...eEE..eEE..eEE",
    "..eEE..eEE..eEE.",
    "..EE...EE...EE..",
    "..E....E....E...",
]))

# ---------- Tête du héros (bouton du personnage) ----------
def hero_head():
    src = open("src/render/sprites/guerrier.ts", encoding="utf8").read()
    pal = dict(re.findall(r'(\w): "(#[0-9a-f]{6})"', src.split("GUERRIER_PALETTE")[1].split("};")[0]))
    rows = re.findall(r'"([^"]+)"', src.split("idleDown: [")[1].split("]")[0])
    top = next(i for i, r in enumerate(rows) if r.strip("."))
    head = rows[top:top + 9]
    return head, pal

LABELS = {
    "lance": "Lance v2", "cimeterre": "Cimeterre v2",
    "or_petit": "Petite pile", "or_moyen": "Deux piles", "or_gros": "Trois piles",
    "amethyste": "Améthyste 20", "saphir": "Saphir 50", "emeraude": "Émeraude 100", "diamant": "Diamant 200",
    "sac_toile": "Sac en toile\nLv1 · 6×4", "sac_cuir": "Sac de cuir\nLv3 · 7×5", "sac_voyage": "Sac d'aventurier\nLv6 · 8×6",
    "potion_jouvence": "Jouvence\n(jaune)", "potion_poison": "Poison\n(arme, 15 coups)", "potion_vitesse": "Vitesse\n(+1 attaque, 4 t)", "potion_feu": "Feu\n(croix, 5 tours)",
    "voie_bleue": "Voie bleue\nSecond souffle", "voie_rouge": "Voie rouge\nDouble frappe", "voie_verte": "Voie verte\nBousculade",
    "tete": "Bouton\npersonnage",
}

def render(rows, s, pal=PAL):
    w, h = len(rows[0]), len(rows)
    im = Image.new("RGBA", (w * s, h * s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != ".":
                d.rectangle([x * s, y * s, x * s + s - 1, y * s + s - 1], fill=pal[c])
    return im

if __name__ == "__main__":
    head, hpal = hero_head()
    json.dump({"palette": PAL, "icons": N, "head": head, "headPalette": hpal}, open("art/objets_v2.json", "w"), ensure_ascii=False)
    S = 5
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 14)
    fs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
    W, H = 960, 1080
    sheet = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 18), "OBJETS v2 — proposition, rien en jeu", fill=(255, 243, 200), font=f, anchor="mm")

    def box(name, x, y, rows=None, pal=PAL, scale=S):
        rows = rows or N[name]
        im = render(rows, scale, pal)
        bw, bh = max(im.size[0], 80) + 16, im.size[1] + 16
        d.rectangle([x, y, x + bw, y + bh], fill=(36, 28, 20), outline=(74, 62, 42), width=2)
        sheet.paste(im, (x + (bw - im.size[0]) // 2, y + 8), im)
        for k, line in enumerate(LABELS[name].split("\n")):
            d.text((x + bw // 2, y + bh + 10 + k * 13), line, fill=(220, 210, 190), font=fs, anchor="mm")
        return bw

    def row(title, names, y, x0=20, gap=24):
        d.text((x0, y - 20), title, fill=(214, 170, 84), font=fs)
        x = x0
        for n in names:
            x += box(n, x, y) + gap

    row("ARMES CORRIGÉES", ["lance", "cimeterre"], 60)
    row("OR : DES PILES", ["or_petit", "or_moyen", "or_gros"], 60, x0=360)
    row("GEMMES (valeur en or)", ["amethyste", "saphir", "emeraude", "diamant"], 440)
    row("SACS (emplacement « sac »)", ["sac_toile", "sac_cuir", "sac_voyage"], 600)
    row("POTIONS", ["potion_jouvence", "potion_poison", "potion_vitesse", "potion_feu"], 760)
    row("VOIES DU GUERRIER (étage 1 de l'arbre)", ["voie_bleue", "voie_rouge", "voie_verte"], 920)
    d.text((620, 900), "TÊTE (bouton personnage)", fill=(214, 170, 84), font=fs)
    hb = render(head, 6, hpal)
    d.rectangle([620, 920, 620 + hb.size[0] + 16, 920 + hb.size[1] + 16], fill=(36, 28, 20), outline=(74, 62, 42), width=2)
    sheet.paste(hb, (628, 928), hb)
    d.text((780, 950), "« ! » doré quand\nun point est à donner", fill=(220, 210, 190), font=fs)
    sheet.save("art/objets_v2.png")
    print(sheet.size)
