"""Section 3, l'Ossuaire : première SALLE SPÉCIALE, le MUSÉE (Thomas, 2026-11-19, 10 h 44 : « design la première salle
spéciale ; en mode musée, un énorme squelette de tricératops sur une estrade ; dalle claire ; cordon rouge ; des supports à
bougie ; un écriteau ; garde la quête associée en todo »). PROPOSITION, rien n'est en jeu.

  python3 art/ossuaire_musee_v1.py   → art/ossuaire_musee_v1.png
"""
import importlib.util
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pix import font, grid, hash2, up  # noqa: E402


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ob1 = load("ossuaire_objets_v1")
ob2 = load("ossuaire_objets_v2")
Sprite, C = ob1.Sprite, ob1.C
line, mini = ob2.line, ob2.mini
T = 16

BONE, BONE_D, BONE_S = (226, 214, 184), (176, 162, 132), (70, 60, 50)
BRASS, BRASS_D, BRASS_L = (196, 150, 62), (130, 94, 34), (240, 200, 110)
RED, RED_D, RED_L = (176, 30, 40), (110, 16, 24), (220, 70, 70)

PLAN = ["#" * 18] + ["#" + "." * 16 + "#" for _ in range(10)] + ["#" * 8 + ".." + "#" * 8]


def pale_floor(a, xs, ys, wall):
    """Dalles claires de musée (grandes dalles de pierre polie, joints fins, quelques veines)."""
    cx, cy = (xs // 16).astype(int), (ys // 16).astype(int)
    lx, ly = xs % 16, ys % 16
    t = hash2(cx, cy, 301)
    base = np.array((196, 192, 182))[None, None, :] * (0.92 + 0.1 * t[..., None])
    vein = (np.abs(((xs * 0.7 + ys * 1.3) % 23) - 11) < 0.5) & (hash2(cx, cy, 302) < 0.4)
    base[vein] = base[vein] * 0.9
    j = (lx == 0) | (ly == 0)
    base[j] = (150, 146, 140)
    hi = (lx == 1) | (ly == 1)
    base[hi & ~j] = np.minimum(base[hi & ~j] * 1.05, 255)
    fl = ~wall
    a[fl] = base[fl]
    # ombre portée du mur du haut
    for k in range(6):
        a[T + k, :][fl[T + k, :]] *= 0.6 + 0.07 * k
    return a


def estrade():
    """Estrade de pierre à deux marches, 10 × 3 cases (160 × 52), vue en 3/4."""
    s = Sprite(162, 54)
    s.r(1, 6, 160, 34, (176, 172, 162)).r(1, 6, 160, 1, (214, 210, 198))  # dessus
    s.r(1, 40, 160, 6, (140, 136, 128)).r(1, 40, 160, 1, (160, 156, 148))  # contremarche haute
    s.r(1, 46, 160, 2, (198, 194, 184))  # marche
    s.r(1, 48, 160, 5, (122, 118, 112))  # contremarche basse
    for x in range(8, 158, 16):
        s.r(x, 41, 1, 5, (116, 112, 106)).r(x + 6, 49, 1, 4, (100, 96, 92))
    # plinthe dorée et plaque au milieu de la marche
    s.r(1, 39, 160, 1, BRASS_D)
    s.r(73, 41, 16, 4, BRASS).r(73, 41, 16, 1, BRASS_L).r(75, 43, 12, 1, BRASS_D)
    return s.done()


# ---- le tricératops v2 (Thomas, 2026-11-19, 10 h 49 : « tu peux faire mieux pour le design du tricératops ») : dessiné
# en formes (collerette PLEINE au bord festonné et rainurée, bec crochu, deux longues cornes de front et une courte sur le
# nez, orbite et fenêtre de la joue, mâchoire dentée ; cou en vertèbres, dos qui monte jusqu'aux hanches, côtes proches et
# lointaines, omoplate, bassin, pattes avant au coude sorti, pattes arrière en colonnes, queue à chevrons ; côté lointain
# plus sombre ; monture de fer et socle), puis ombré (arête claire en haut, sombre en bas) et détouré.
W, H = 190, 100
NEAR, FAR, HOLE, IRON, DARKB = 1, 2, 3, 4, 5

def _tri_labels():
    lab = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(lab)
    P = lambda pts, v: d.polygon([(x, y) for x, y in pts], fill=v)
    L = lambda pts, v, w=2: d.line(pts, fill=v, width=w, joint="curve")
    E = lambda box, v: d.ellipse(box, fill=v)
    o = 12  # le corps, décalé vers l'arrière : la tête fait un tiers de la bête
    # --- monture de fer (derrière)
    L([(98 + o, 96), (98 + o, 72)], IRON, 2); L([(136 + o, 96), (136 + o, 44)], IRON, 2); L([(56, 96), (56, 66)], IRON, 2)
    # --- pattes du côté lointain (plus sombres)
    L([(104 + o, 64), (98 + o, 76), (102 + o, 90)], FAR, 3); P([(96 + o, 89), (108 + o, 89), (109 + o, 94), (95 + o, 94)], FAR)
    L([(134 + o, 44), (142 + o, 66), (134 + o, 86)], FAR, 4); P([(128 + o, 86), (142 + o, 86), (143 + o, 94), (127 + o, 94)], FAR)
    # --- côtes du côté lointain
    for k, x in enumerate(range(86 + o, 128 + o, 4)):
        L([(x + 3, 42 - min(k, 4)), (x + 1, 58), (x + 4, 72 - abs(k - 5))], FAR, 1)
    # --- queue
    tail = [(140 + o, 37), (150 + o, 40), (160 + o, 45), (168 + o, 51), (174 + o, 57)]
    for i, (a, b) in enumerate(zip(tail, tail[1:])):
        L([a, b], NEAR, 4 - i)
    for (x, y) in tail[1:4]:
        L([(x, y + 2), (x - 2, y + 7)], NEAR, 1)
        L([(x, y - 2), (x + 1, y - 5)], NEAR, 1)
    # --- cou et colonne, le dos qui monte jusqu'aux hanches
    spine = [(68, 52), (80, 47), (92 + o, 41), (104 + o, 37), (118 + o, 34), (130 + o, 33), (140 + o, 36)]
    L(spine, NEAR, 3)
    for (x, y) in spine[2:]:
        L([(x, y - 1), (x + 1, y - 6)], NEAR, 2)
    for (x, y) in ((76, 49), (82, 47), (88, 45), (94, 44)):
        E((x - 2.5, y - 2.5, x + 2.5, y + 2.5), NEAR)  # vertèbres du cou
        d.point((x + 3, y), fill=HOLE)
    # --- côtes proches et sternum
    for k, x in enumerate(range(86 + o, 128 + o, 4)):
        top = 42 - min(k, 5)
        bot = 74 - abs(k - 5) * 1.2
        L([(x, top), (x - 2, (top + bot) / 2), (x + 1, bot)], NEAR, 2)
    L([(84 + o, 72), (104 + o, 76), (124 + o, 72)], NEAR, 2)
    # --- omoplate
    P([(86 + o, 42), (95 + o, 40), (101 + o, 62), (95 + o, 66), (90 + o, 63)], NEAR)
    # --- bassin
    P([(118 + o, 33), (144 + o, 32), (146 + o, 37), (120 + o, 40)], NEAR)
    P([(132 + o, 38), (136 + o, 38), (142 + o, 52), (138 + o, 53)], NEAR)
    P([(124 + o, 39), (128 + o, 39), (120 + o, 50), (117 + o, 49)], NEAR)
    E((129 + o, 36, 136 + o, 43), HOLE)
    # --- pattes proches : devant, coude un peu sorti ; derrière, fémur, genou, tibia
    L([(98 + o, 63), (91 + o, 76), (95 + o, 90)], NEAR, 4)
    P([(88 + o, 89), (101 + o, 89), (102 + o, 94), (87 + o, 94)], NEAR)
    L([(132 + o, 41), (139 + o, 64), (131 + o, 86)], NEAR, 5)
    P([(124 + o, 86), (139 + o, 86), (140 + o, 94), (123 + o, 94)], NEAR)
    for (x, y, r) in ((91 + o, 76, 3), (139 + o, 64, 3), (131 + o, 86, 2)):
        E((x - r, y - r, x + r, y + r), NEAR)
    # --- COLLERETTE pleine, bord festonné, rainures
    frill = [(46, 54), (45, 38), (50, 24), (58, 14), (69, 11), (78, 16), (82, 27), (79, 40), (70, 52), (58, 60)]
    P(frill, NEAR)
    for i in range(1, len(frill) - 1):
        (x0, y0), (x1, y1) = frill[i], frill[i + 1]
        for t in (0.0, 0.5):
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            E((x - 2.2, y - 2.2, x + 2.2, y + 2.2), NEAR)
    for (x, y) in ((54, 22), (63, 15), (73, 17), (79, 29)):
        L([(52, 48), (x, y)], DARKB, 1)
    # --- CRÂNE
    face = [(12, 54), (18, 48), (29, 44), (42, 42), (51, 48), (53, 56), (47, 61), (34, 63), (20, 63), (14, 60)]
    P(face, NEAR)
    P([(6, 52), (14, 48), (16, 58), (10, 62), (7, 58)], NEAR)
    P([(6, 54), (8, 54), (9, 60), (7, 60)], DARKB)
    jaw = [(14, 62), (46, 61), (51, 65), (40, 70), (24, 70), (16, 67)]
    P(jaw, NEAR)
    L([(18, 64), (44, 64)], DARKB, 1)
    for x in range(20, 44, 3):
        d.point((x, 63), fill=HOLE)
    E((34, 46, 40, 52), HOLE)
    E((16, 51, 20, 55), HOLE)
    E((44, 55, 49, 59), HOLE)
    P([(46, 59), (52, 61), (50, 67)], NEAR)
    # --- CORNES
    P([(36, 44), (40, 42), (21, 16), (18, 17)], FAR)
    P([(32, 46), (37, 43), (14, 19), (11, 21)], NEAR)
    P([(16, 50), (20, 48), (15, 38), (13, 39)], NEAR)
    # --- socle
    d.rectangle((48, 95, 160, 99), fill=IRON)
    return np.array(lab)

def _tri_colors(lab):
    out = np.zeros(lab.shape + (4,), np.uint8)
    B, BL, BD, BS = (228, 216, 186), (246, 238, 214), (182, 168, 136), (140, 126, 100)
    FARC, FARL = (150, 138, 112), (170, 158, 130)
    near = lab == NEAR
    up = np.roll(lab, 1, 0) != NEAR
    dn = np.roll(lab, -1, 0) != NEAR
    out[near] = B + (255,)
    out[near & dn] = BD + (255,)
    out[near & up] = BL + (255,)
    far = lab == FAR
    out[far] = FARC + (255,)
    out[far & (np.roll(lab, 1, 0) != FAR)] = FARL + (255,)
    out[lab == HOLE] = (52, 42, 34, 255)
    out[lab == DARKB] = BS + (255,)
    out[lab == IRON] = (74, 76, 90, 255)
    # contour sombre
    m = out[..., 3] > 0
    o = np.zeros_like(m)
    o[1:] |= m[:-1]; o[:-1] |= m[1:]; o[:, 1:] |= m[:, :-1]; o[:, :-1] |= m[:, 1:]
    out[o & ~m] = (24, 18, 16, 255)
    return out



def triceratops():
    s = Sprite(W, H)
    s.a = _tri_colors(_tri_labels())
    return s

def post():
    """Potelet de laiton du cordon."""
    s = Sprite(6, 16)
    s.r(2, 1, 2, 12, BRASS).r(2, 1, 1, 12, BRASS_L).r(1, 0, 4, 2, BRASS_L).r(0, 13, 6, 3, BRASS_D).r(1, 13, 4, 1, BRASS)
    return s.done()


def candle_stand():
    """Support à bougie sur pied (candélabre de fer), bougie allumée."""
    s = Sprite(10, 26)
    s.r(4, 8, 2, 15, C["i"]).r(4, 8, 1, 15, C["iL"])
    s.r(1, 23, 8, 2, C["i"]).r(2, 22, 6, 1, C["iL"])
    s.r(2, 7, 6, 2, C["iL"]).r(1, 6, 8, 1, C["iH"])
    s.r(3, 1, 4, 6, (236, 228, 210)).r(6, 1, 1, 6, (196, 188, 170))  # bougie
    s.p(4, 0, (255, 220, 120)).p(5, 0, (255, 248, 210))
    return s.done()


def sign():
    """Écriteau sur pied (pupitre de laiton), texte gravé."""
    s = Sprite(16, 20)
    s.r(1, 1, 14, 9, (60, 40, 30)).r(2, 2, 12, 7, (224, 214, 186))
    for y in (3, 5, 7):
        s.r(3, y, 10 if y != 7 else 6, 1, (90, 70, 50))
    s.r(7, 10, 2, 8, BRASS).r(7, 10, 1, 8, BRASS_L).r(4, 18, 8, 2, BRASS_D)
    return s.done()


def rope(a, x0, y0, x1, y1, sag=4):
    """Cordon rouge qui pend entre deux potelets (pixels du monde)."""
    n = max(abs(x1 - x0), abs(y1 - y0))
    for i in range(n + 1):
        t = i / n
        x = round(x0 + (x1 - x0) * t)
        y = round(y0 + (y1 - y0) * t + sag * math.sin(math.pi * t))
        a[y, x] = RED
        a[y + 1, x] = RED_D
        if i % 6 == 0:
            a[y, x] = RED_L


def room(lit=True):
    a, xs, ys, wall = mini(PLAN)
    a = pale_floor(a, xs, ys, wall)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")

    def put(sp, x, y, shadow=True):
        ob2.paste(img, sp, x, y, shadow)

    # cordon rouge sur potelets tout autour (le rang du fond passe DERRIÈRE le squelette), une ouverture devant l'écriteau
    posts = [(2 * T + 4, 1 * T + 6), (9 * T, 1 * T + 6), (15 * T + 6, 1 * T + 6), (15 * T + 6, 9 * T), (10 * T + 2, 9 * T + 6), (7 * T + 2, 9 * T + 6), (2 * T + 4, 9 * T)]
    loop = list(zip(posts + [posts[0]], (posts + [posts[0]])[1:]))
    back = [seg for seg in loop if seg[0][1] < 2 * T and seg[1][1] < 2 * T]
    front = [seg for seg in loop if seg not in back and seg[0] != (10 * T + 2, 9 * T + 6)]

    def ropes(segs, with_posts):
        nonlocal img
        arr = np.asarray(img).copy()
        for (x0, y0), (x1, y1) in segs:
            rope(arr, x0 + 3, y0 + 2, x1 + 3, y1 + 2)
        img = Image.fromarray(arr, "RGB")
        for (x, y) in with_posts:
            ob2.paste(img, post(), x, y, True)

    ropes(back, posts[:3])
    # estrade au milieu, le tricératops dessus (il la déborde : il est énorme)
    ex, ey = 4 * T, 5 * T + 4
    put(estrade(), ex, ey, False)
    put(triceratops(), ex - 14, ey + 42 - 100, False)
    ropes(front, posts[3:])
    # supports à bougie aux quatre coins, écriteau devant
    for (x, y) in ((1 * T + 3, 1 * T + 2), (16 * T + 3, 1 * T + 2), (1 * T + 3, 9 * T), (16 * T + 3, 9 * T)):
        ob2.paste(img, candle_stand(), x, y, True)
    ob2.paste(img, sign(), 8 * T + 8, 10 * T - 2, True)
    if not lit:
        return img
    # lumière : les bougies (chaudes) et la lune qui tombe sur l'estrade ; le reste dans la pénombre
    a = np.asarray(img).astype(float)
    W, H = img.size
    gx, gy = grid(W, H)
    L = np.full((H, W), 0.38)
    warm = np.zeros((H, W))
    for (x, y) in ((1 * T + 8, 1 * T + 2), (16 * T + 8, 1 * T + 2), (1 * T + 8, 9 * T), (16 * T + 8, 9 * T)):
        d = np.hypot(gx - x, gy - y) / T
        g = np.clip(1 - d / 3.5, 0, 1)
        L = np.maximum(L, 0.38 + g * 0.7)
        warm = np.maximum(warm, g)
    d = np.hypot(gx - 9 * T, (gy - 5.6 * T) / 0.75) / T
    moon = np.clip(1.2 - d / 2.6, 0, 1)
    L = np.maximum(L, 0.38 + moon * 0.75)
    tint = np.ones((H, W, 3))
    tint = tint * (1 - warm[..., None] * 0.25) + np.array((1.25, 1.0, 0.7)) * warm[..., None] * 0.25
    tint = tint * (1 - moon[..., None] * 0.3) + np.array((0.82, 0.92, 1.15)) * moon[..., None] * 0.3
    a = a * L[..., None] * tint
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")


def main():
    S = 3
    big = up(room(), S)
    parts = [("Tricératops (×3)", up(triceratops().img(), 3)), ("Estrade (×3)", up(estrade().img(), 3)),
             ("Potelet, cordon (×5)", up(post().img(), 5)), ("Support à bougie (×5)", up(candle_stand().img(), 5)), ("Écriteau (×5)", up(sign().img(), 5))]
    pad = 24
    Wb = max(big.width + 2 * pad, sum(max(p.width, 200) for _, p in parts) + pad * (len(parts) + 1))
    ph = max(p.height for _, p in parts)
    Hb = 80 + big.height + 60 + ph + 40
    sheet = Image.new("RGB", (Wb, Hb), (14, 12, 18))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 3 · SALLE SPÉCIALE · LE MUSÉE (v1, tricératops v2)", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((Wb // 2, 54), "Dalles claires · squelette de tricératops sur estrade · cordon rouge sur potelets · supports à bougie · écriteau", fill=(190, 180, 160), font=font(14, False), anchor="mm")
    sheet.paste(big, ((Wb - big.width) // 2, 80))
    x, y = pad, 80 + big.height + 50
    for name, im in parts:
        d.text((x, y - 22), name, fill=(240, 192, 80), font=font(15), anchor="lt")
        bg = Image.new("RGB", im.size, (40, 36, 44))
        bg.paste(im, (0, 0), im)
        sheet.paste(bg, (x, y))
        x += max(im.width, 200) + pad
    sheet.save(os.path.join(HERE, "ossuaire_musee_v1.png"))
    print("art/ossuaire_musee_v1.png", sheet.size)


def game_trike():
    """Le tricératops v3 réduit de moitié pour le jeu (6 cases de large), sur son estrade, le cordon rouge devant."""
    spec = importlib.util.spec_from_file_location("t3", os.path.join(HERE, "ossuaire_triceratops_v3.py"))
    t3 = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(t3)
    big = Image.fromarray(t3.build(), "RGBA").crop((0, 4, 204, 106))
    w, h = big.width // 2, big.height // 2
    a = np.array(big.resize((w, h), Image.BOX)).astype(float)
    alpha = a[..., 3] > 110
    rgb = a[..., :3] / np.maximum(a[..., 3:4] / 255, 1e-3)
    pal = np.array([t3.TONES[k] for k in ("hi", "base", "mid", "dark")] + [t3.OUT, (78, 80, 96), (56, 44, 36)], float)
    q = pal[((rgb[..., None, :] - pal[None, None]) ** 2).sum(-1).argmin(-1)]
    W2, H2 = w + 4, h + 16
    out = np.zeros((H2, W2, 4), np.uint8)
    # l'estrade de pierre (deux marches) sous ses pieds
    out[h - 2:h + 6, 1:W2 - 1] = (*C["s"], 255)
    out[h - 2, 1:W2 - 1] = (*C["sL"], 255)
    out[h + 4:h + 6, 1:W2 - 1] = (*C["sD"], 255)
    out[h + 6:h + 10, 0:W2] = (*C["sD"], 255)
    out[h + 6, 0:W2] = (*C["s"], 255)
    out[h + 9, 0:W2] = (*C["sDD"], 255)
    out[h + 1:h + 3, W2 // 2 - 6:W2 // 2 + 6] = (*BRASS, 255)  # plaque de laiton
    m = np.zeros((H2, W2), bool)
    m[:h, 2:2 + w] = alpha
    out[:h, 2:2 + w][alpha] = np.concatenate([q[alpha], np.full((alpha.sum(), 1), 255)], 1).astype(np.uint8)
    # contour de l'animal
    ring = ~m & (np.roll(m, 1, 0) | np.roll(m, -1, 0) | np.roll(m, 1, 1) | np.roll(m, -1, 1))
    ring[h - 2:] = False
    out[ring] = (*t3.OUT, 255)
    # le cordon rouge devant, sur trois potelets de laiton
    for x in (1, W2 // 2, W2 - 3):
        out[h + 8:H2, x:x + 2] = (*BRASS, 255)
        out[h + 8, x:x + 2] = (*BRASS_L, 255)
    for x in range(1, W2 - 2):
        t = (x - 1) % (W2 // 2 - 1) / (W2 // 2 - 1)
        y = h + 10 + round(3 * math.sin(math.pi * t))
        out[y, x] = (*RED, 255)
        out[min(H2 - 1, y + 1), x] = (*RED_D, 255)
    return Image.fromarray(out, "RGBA")


def export():
    """python3 art/ossuaire_musee_v1.py export → src/render/sprites/musee.ts (Thomas, 2026-11-19 : « fonce sur quête »)."""
    from export_jeu_v4 import write
    write("src/render/sprites/musee.ts", "MUSEE",
          "Le musée de l'ossuaire (art/ossuaire_musee_v1.png) : le tricératops sur son estrade avec le cordon, les supports à bougie, l'écriteau.",
          {"expoTrike": game_trike(), "chandelierMusee": candle_stand().img(), "ecriteauMusee": sign().img()})


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "export":
    export()
elif __name__ == "__main__":
    main()
