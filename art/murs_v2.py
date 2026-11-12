"""Planche « murs v2 » (Thomas, 2026-11-12 : « génère des nouveaux sprites pour les murs, pense aux tuiles en T ou
en X aux croisements, de la mousse pourquoi pas »). PROPOSITION à valider, rien n'entre en jeu.

Deux pistes sur le même petit plan (L, T, X, bout de mur, porte) :
  A — vue de dessus (comme aujourd'hui), mais en pixels 16 × 16 : un PILIER taillé marque chaque T et chaque X,
      une pierre d'angle chaque coin, un chapeau chaque bout de mur ;
  B — vue 3/4 (comme les meubles) : le dessus du mur (chaperon) et, côté salle, sa face de briques ; les T et X
      sont des piliers dont le chaperon dépasse.
Mousse : dans les joints et au pied des faces, plus fournie dans les coins humides.
En bas : les cachettes proposées (dalle à pression, pan de mur qui coulisse, statue qu'on brise).

`python3 art/murs_v2.py` écrit art/murs_v2.png.
"""
from PIL import Image, ImageDraw, ImageFont

T = 16
S = 4  # agrandissement de la planche

PLAN = [
    "######################",
    "#.........#..........#",
    "#.........#..........#",
    "#.........#.....#....#",
    "#....######.....#....#",
    "#.........#.....#....#",
    "#...............######",
    "#.........#..........#",
    "######.#######.#######",
    "#.........#..........#",
    "#.........#..........#",
    "#.........D..........#",
    "#.........#..........#",
    "######################",
]

C = {
    "mortar": (34, 30, 44), "s0": (84, 86, 112), "s1": (104, 107, 136), "s2": (124, 128, 158), "s3": (150, 154, 184),
    "hi": (182, 186, 214), "sh": (24, 21, 32), "cap": (58, 54, 74), "cap2": (70, 66, 88), "capHi": (98, 94, 120),
    "m0": (46, 74, 30), "m1": (78, 120, 40), "m2": (124, 170, 58),
    "f0": (60, 54, 66), "f1": (70, 63, 76), "f2": (82, 74, 86), "dust": (92, 80, 74), "fl": (44, 39, 50),
    "wood": (120, 78, 40), "wood2": (86, 54, 26), "iron": (60, 62, 78), "gold": (240, 192, 80), "gold2": (168, 124, 28),
    "dark": (12, 10, 16),
}


def h(x, y, k=0):
    """Bruit fixe (toujours le même dessin pour une case)."""
    n = (x * 374761393 + y * 668265263 + k * 2147483647) & 0xFFFFFFFF
    n = (n ^ (n >> 13)) * 1274126177 & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF


def wall(plan, x, y):
    return 0 <= y < len(plan) and 0 <= x < len(plan[0]) and plan[y][x] in "#"


def is_floor(plan, x, y):
    return 0 <= y < len(plan) and 0 <= x < len(plan[0]) and plan[y][x] in ".D"


def floor_tile(img, ox, oy, x, y):
    """Sol : dalles sous la poussière (dans l'esprit du sol B)."""
    px = img.load()
    for j in range(T):
        for i in range(T):
            c = C["f1"]
            if (i + (y % 2) * 8) % 16 == 0 or j == 0:
                c = C["fl"]
            elif h(x * 16 + i // 4, y * 16 + j // 4, 3) < 0.25:
                c = C["dust"]
            elif h(x * 16 + i, y * 16 + j, 5) < 0.08:
                c = C["f2"]
            elif h(x * 16 + i, y * 16 + j, 6) < 0.05:
                c = C["f0"]
            px[ox + i, oy + j] = c


def stone_rect(px, ox, oy, x0, y0, x1, y1, shade, seed):
    """Une pierre : remplissage, arête claire en haut à gauche, ombre en bas à droite."""
    base = [C["s0"], C["s1"], C["s2"], C["s3"]][shade]
    for j in range(y0, y1):
        for i in range(x0, x1):
            c = base
            if j == y0 or i == x0:
                c = C["hi"] if shade >= 2 else C["s3"]
            if j == y1 - 1 or i == x1 - 1:
                c = C["s0"] if shade >= 2 else C["sh"]
            if h(i + seed, j, 9) < 0.06:
                c = C["s0"]
            px[ox + i, oy + j] = c


def moss(px, ox, oy, cells, seed, amount):
    for (i, j) in cells:
        r = h(i + seed * 3, j, 11)
        if r < amount:
            px[ox + i, oy + j] = C["m1"] if r < amount * 0.6 else C["m0"]
            if r < amount * 0.2:
                px[ox + i, oy + j] = C["m2"]


# ---------------------------------------------------------------- piste A : vue de dessus, en pixels

def wall_A(img, ox, oy, plan, x, y):
    px = img.load()
    n, e, s, w = wall(plan, x, y - 1), wall(plan, x + 1, y), wall(plan, x, y + 1), wall(plan, x - 1, y)
    links = n + e + s + w
    for j in range(T):
        for i in range(T):
            px[ox + i, oy + j] = C["mortar"]
    seed = x * 31 + y * 17
    if links >= 3:
        # T ou X : un pilier carré, taillé en pointe de diamant, qui reçoit les pans.
        stone_rect(px, ox, oy, 2, 2, 14, 14, 2, seed)
        for k in range(4):
            px[ox + 4 + k, oy + 4 + k] = C["hi"]
            px[ox + 11 - k, oy + 4 + k] = C["s1"]
            px[ox + 4 + k, oy + 11 - k] = C["s1"]
            px[ox + 11 - k, oy + 11 - k] = C["s0"]
        # les assises des pans viennent mordre dans le pilier
        if n: stone_rect(px, ox, oy, 5, 0, 11, 2, 1, seed + 1)
        if s: stone_rect(px, ox, oy, 5, 14, 11, 16, 1, seed + 2)
        if w: stone_rect(px, ox, oy, 0, 5, 2, 11, 1, seed + 3)
        if e: stone_rect(px, ox, oy, 14, 5, 16, 11, 1, seed + 4)
        if links == 4:
            # X : une rosace gravée au milieu du pilier
            for (i, j) in [(7, 7), (8, 7), (7, 8), (8, 8)]:
                px[ox + i, oy + j] = C["s0"]
            for (i, j) in [(7, 6), (6, 7), (9, 8), (8, 9)]:
                px[ox + i, oy + j] = C["hi"]
    elif links == 2 and (n or s) and (e or w):
        # Coin : une grosse pierre d'angle (harpe).
        stone_rect(px, ox, oy, 1, 1, 15, 15, 3, seed)
        for k in range(1, 15):
            px[ox + (14 if e else 1) - (0 if e else 0), oy + k] = px[ox + (14 if e else 1), oy + k]
    elif links <= 1:
        # Bout de mur : une pierre de chapeau arrondie.
        stone_rect(px, ox, oy, 2, 2, 14, 14, 3, seed)
        for (i, j) in [(2, 2), (13, 2), (2, 13), (13, 13)]:
            px[ox + i, oy + j] = C["mortar"]
    else:
        vertical = n or s
        for r in range(3):
            # trois assises, joints décalés une assise sur deux
            a0, a1 = [(0, 5), (5, 11), (11, 16)][r]
            off = int(3 + 4 * h(x if not vertical else y, r, 1)) + (r % 2) * 5
            cuts = [0, off, min(15, off + 7), 16]
            for k in range(3):
                b0, b1 = cuts[k], cuts[k + 1]
                if b1 - b0 < 2:
                    continue
                shade = 1 + int(h(seed, r * 3 + k, 2) * 2.2)
                if vertical:
                    stone_rect(px, ox, oy, a0, b0, a1, b1, min(3, shade), seed + r * 3 + k)
                else:
                    stone_rect(px, ox, oy, b0, a0, b1, a1, min(3, shade), seed + r * 3 + k)
    # bord clair / ombre côté salle
    for k in range(T):
        if is_floor(plan, x, y - 1): px[ox + k, oy] = C["hi"]
        if is_floor(plan, x, y + 1): px[ox + k, oy + 15] = C["sh"]; px[ox + k, oy + 14] = C["s0"]
        if is_floor(plan, x - 1, y): px[ox, oy + k] = C["sh"]
        if is_floor(plan, x + 1, y): px[ox + 15, oy + k] = C["hi"]
    # mousse : dans les joints, surtout dans les coins et au pied des murs (humidité)
    wet = 0.18 if links >= 2 and not (links == 2 and ((n and s) or (e and w))) else 0.07
    if h(x, y, 40) < 0.45:
        joints = [(i, j) for j in range(T) for i in range(T) if px[ox + i, oy + j] == C["mortar"] or px[ox + i, oy + j] == C["sh"]]
        moss(px, ox, oy, joints, x * 7 + y, wet + 0.25)


# ---------------------------------------------------------------- piste B : vue 3/4

CAP = 6  # hauteur du chaperon (dessus du mur) sur une case qui montre sa face


def wall_B(img, ox, oy, plan, x, y):
    px = img.load()
    n, e, s, w = wall(plan, x, y - 1), wall(plan, x + 1, y), wall(plan, x, y + 1), wall(plan, x - 1, y)
    face = is_floor(plan, x, y + 1)
    links = n + e + s + w
    seed = x * 13 + y * 29
    top = CAP if face else T
    # Chaperon : dalles sombres, rebord clair du côté de la salle.
    for j in range(top):
        for i in range(T):
            c = C["cap"]
            if h(x * 16 + i // 3, y * 16 + j // 3, 21) < 0.3:
                c = C["cap2"]
            if (i + (x % 2) * 5) % 10 == 0 and j < top:
                c = C["mortar"]
            px[ox + i, oy + j] = c
    for k in range(T):
        if is_floor(plan, x, y - 1): px[ox + k, oy] = C["capHi"]
        if is_floor(plan, x - 1, y) and k < top: px[ox, oy + k] = C["capHi"]
        if is_floor(plan, x + 1, y) and k < top: px[ox + 15, oy + k] = C["sh"]
    if face:
        for k in range(T):
            px[ox + k, oy + CAP - 1] = C["capHi"]
        # Face de briques : 3 assises de briques sous le chaperon.
        rows = [(CAP, CAP + 3), (CAP + 3, CAP + 7), (CAP + 7, T)]
        for r, (a0, a1) in enumerate(rows):
            off = int(2 + 5 * h(x, y * 3 + r, 1)) + (r % 2) * 4
            cuts = [0, off, min(15, off + 8), 16]
            for k in range(3):
                b0, b1 = cuts[k], cuts[k + 1]
                if b1 - b0 < 2:
                    continue
                shade = int(h(seed, r * 3 + k, 2) * 3)
                stone_rect(px, ox, oy, b0, a0, b1, a1, min(2, shade), seed + r * 5 + k)
                for i in range(b0, b1):
                    px[ox + i, oy + a0] = C["s2"] if shade else C["s1"]
        for i in range(T):
            px[ox + i, oy + 15] = C["sh"]
        # Mousse au pied de la face et qui coule des joints.
        if h(x, y, 33) < 0.5:
            moss(px, ox, oy, [(i, j) for j in range(12, 16) for i in range(T)], seed, 0.45)
            for i in range(T):
                if h(x * 16 + i, y, 34) < 0.12:
                    for j in range(CAP, CAP + 2 + int(h(i, y, 35) * 5)):
                        px[ox + i, oy + j] = C["m1"] if j % 2 else C["m0"]
    # Pilier aux T et X : un dé de pierre plus clair, en saillie sur le chaperon.
    if links >= 3:
        for j in range(1, min(top, 15)):
            for i in range(3, 13):
                c = C["s2"]
                if j == 1 or i == 3:
                    c = C["hi"]
                if i == 12 or j == min(top, 15) - 1:
                    c = C["s0"]
                px[ox + i, oy + j] = c
        if links == 4:
            px[ox + 7, oy + 5] = px[ox + 8, oy + 5] = C["s0"]
            px[ox + 7, oy + 6] = px[ox + 8, oy + 6] = C["s0"]
    # Mousse sur le chaperon des coins (là où l'eau stagne).
    if links >= 2 and h(x, y, 36) < 0.35:
        moss(px, ox, oy, [(i, j) for j in range(0, min(top, 6)) for i in range(T)], seed + 9, 0.3)


def door(img, ox, oy, view):
    px = img.load()
    for j in range(T):
        for i in range(T):
            c = C["wood"] if (i // 3) % 2 else C["wood2"]
            if j in (3, 12):
                c = C["iron"]
            if i in (0, 15):
                c = C["s1"]
            px[ox + i, oy + j] = c
    px[ox + 11, oy + 8] = C["gold"]
    px[ox + 11, oy + 9] = C["gold2"]


def draw_plan(view):
    W, H = len(PLAN[0]), len(PLAN)
    img = Image.new("RGB", (W * T, H * T), C["dark"])
    for y in range(H):
        for x in range(W):
            ox, oy = x * T, y * T
            c = PLAN[y][x]
            if c in ".D":
                floor_tile(img, ox, oy, x, y)
            if c == "#":
                (wall_A if view == "A" else wall_B)(img, ox, oy, PLAN, x, y)
            if c == "D":
                door(img, ox, oy, view)
    return img


# ---------------------------------------------------------------- cachettes

def swatch(w, h_):
    return Image.new("RGB", (w * T, h_ * T), C["dark"])


def plate(pressed):
    img = swatch(1, 1)
    floor_tile(img, 0, 0, 3, 3)
    px = img.load()
    for j in range(3, 13):
        for i in range(3, 13):
            c = C["f2"] if not pressed else C["f0"]
            if j == 3 or i == 3:
                c = C["fl"] if pressed else C["f2"]
            if j == 12 or i == 12:
                c = C["f2"] if pressed else C["fl"]
            px[i, j] = c
    if not pressed:
        # un seul indice : une fine fente sur un côté
        for i in range(5, 11):
            px[i, 12] = C["dark"]
    else:
        for i in range(4, 12):
            px[i, 4] = C["dark"]
    return img


def sliding(open_):
    img = swatch(3, 2)
    plan = ["###", "#.#" if open_ else "###", "..."]
    plan = ["###", "###", "..."]
    for y in range(2):
        for x in range(3):
            if y == 1 and x in range(3):
                floor_tile(img, x * T, T, x, 1)
    sub = ["###", "..."]
    for x in range(3):
        wall_B(img, x * T, 0, sub, x, 0)
    px = img.load()
    # le pan du milieu : un joint plus net qui trahit la dalle mobile
    for j in range(CAP, T):
        px[T, j] = C["dark"]
        px[2 * T - 1, j] = C["dark"]
    if open_:
        for j in range(CAP, T):
            for i in range(T + 1, 2 * T - 1):
                px[i, j] = C["dark"]
        # le pan glissé de côté (dans le mur de droite), et ce qui brille au fond de la niche
        for (i, j) in [(T + 6, T - 4), (T + 7, T - 4), (T + 8, T - 4), (T + 7, T - 5)]:
            px[i, j] = C["gold"]
        for (i, j) in [(T + 5, T - 3), (T + 6, T - 3), (T + 7, T - 3), (T + 8, T - 3), (T + 9, T - 3)]:
            px[i, j] = C["gold2"]
    return img


STATUE = [
    "......KKKK......",
    ".....KDSSDK.....",
    "....KDSHHSDK....",
    "....KSHddHSK....",
    "....KSdKKdSK....",
    ".....KSddSK.....",
    "...KKDSSSSDKK...",
    "..KDSSSSSSSSDK..",
    "..KSSHSSSSHSSK..",
    ".KDSHHSSSSHHSDK.",
    ".KSSHSSHHSSHSSK.",
    ".KSSSSSHHSSSSSK.",
    "..KSSSSHHSSSSK..",
    "..KDSSSHHSSSDK..",
    "..KSSSSHHSSSSK..",
    "..KDSSSSSSSSDK..",
    "..KSSSSSSSSSSK..",
    "..KDSSSSSSSSDK..",
    "...KSSSSSSSSK...",
    "...KSSSDDSSSK...",
    "...KSSSDDSSSK...",
    "..KKSSSDDSSSKK..",
    ".KHHHHHHHHHHHHK.",
    "KHSSSSSSSSSSSSHK",
    "KDSSSSSSSSSSSSDK",
    "KDDDDDDDDDDDDDDK",
    ".KKKKKKKKKKKKKK.",
]
STATUE_PAL = {"K": C["dark"], "S": C["s2"], "D": C["s0"], "H": C["hi"], "d": C["mortar"]}


def statue(broken):
    img = swatch(1, 2)
    floor_tile(img, 0, T, 5, 5)
    floor_tile(img, 0, 0, 5, 4)
    px = img.load()
    if not broken:
        for j, row in enumerate(STATUE):
            for i, c in enumerate(row):
                if c in STATUE_PAL:
                    px[i, j + 5] = STATUE_PAL[c]
        # une fissure qui sonne creux
        for (i, j) in [(9, 16), (10, 17), (9, 18), (10, 19)]:
            px[i, j + 5] = C["dark"]
    else:
        # socle resté debout, gravats, et ce qui était caché dedans
        for j, row in enumerate(STATUE[22:]):
            for i, c in enumerate(row):
                if c in STATUE_PAL:
                    px[i, j + 27] = STATUE_PAL[c]
        rocks = [(2, 24, 3), (5, 22, 2), (10, 23, 3), (12, 25, 2), (7, 25, 2), (1, 21, 2)]
        for (x0, y0, r) in rocks:
            for j in range(r):
                for i in range(r + 1):
                    px[x0 + i, y0 + j] = C["s2"] if j == 0 else C["s0"]
            px[x0, y0] = C["hi"]
        for (i, j) in [(7, 21), (8, 21), (8, 20), (9, 21)]:
            px[i, j] = C["gold"]
        px[8, 22] = C["gold2"]
    return img


def main():
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 17)
    a = draw_plan("A").resize((len(PLAN[0]) * T * S // 2 * 2 // 2 * 1, len(PLAN) * T * S // 2), Image.NEAREST)
    a = draw_plan("A").resize((len(PLAN[0]) * T * 2, len(PLAN) * T * 2), Image.NEAREST)
    b = draw_plan("B").resize((len(PLAN[0]) * T * 2, len(PLAN) * T * 2), Image.NEAREST)
    # gros plan des jonctions (pièce 4 × 4 autour du X)
    def zoom(view):
        full = draw_plan(view)
        crop = full.crop((8 * T, 6 * T, 13 * T, 11 * T))
        return crop.resize((crop.width * 5, crop.height * 5), Image.NEAREST)
    za, zb = zoom("A"), zoom("B")
    sw = [("Dalle", plate(False)), ("Enfoncée", plate(True)), ("Pan fermé", sliding(False)), ("Pan ouvert", sliding(True)),
          ("Statue", statue(False)), ("Brisée", statue(True))]
    sws = [(t, im.resize((im.width * 5, im.height * 5), Image.NEAREST)) for t, im in sw]
    pad = 24
    W = max(a.width + za.width, b.width + zb.width) + pad * 3
    sw_h = max(im.height for _, im in sws) + 40
    H = 60 + a.height + 50 + b.height + 70 + sw_h + pad
    out = Image.new("RGB", (W, H), (26, 22, 30))
    d = ImageDraw.Draw(out)
    y = 16
    d.text((pad, y), "A — vue de dessus : pilier aux T et X, pierre d'angle, mousse", font=font, fill=(240, 220, 170))
    y += 40
    out.paste(a, (pad, y)); out.paste(za, (pad * 2 + a.width, y))
    y += a.height + 20
    d.text((pad, y), "B — vue 3/4 : chaperon + face de briques, pilier aux T et X", font=font, fill=(240, 220, 170))
    y += 40
    out.paste(b, (pad, y)); out.paste(zb, (pad * 2 + b.width, y))
    y += b.height + 24
    d.text((pad, y), "Cachettes : dalle → pan qui coulisse ; statue fissurée → brisée", font=font, fill=(240, 220, 170))
    y += 40
    x = pad
    for t, im in sws:
        out.paste(im, (x, y))
        d.text((x, y + im.height + 6), t, font=small, fill=(220, 210, 190))
        x += im.width + 30
    out.save("art/murs_v2.png")


if __name__ == "__main__":
    main()
