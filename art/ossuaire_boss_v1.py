"""Section 3, l'Ossuaire : BOSS, LA GRANDE PRÊTRESSE ET SON COLOSSE (Thomas, 2026-11-19, 13 h 20-13 h 29 : piste C,
« Ok »). Planche à valider, rien n'est en jeu.

Phase 1 : la Grande Prêtresse (2 cases de haut) déplace le puits de lune (annoncé), chante pour les morts, se fait sonner
si on la frappe pendant le chant ; cierges à éteindre. Phase 2 (à mi-vie) : elle monte chanter dans la lumière, les os de
la salle forment le COLOSSE (3 × 3) : deux bras, un crâne qui tire un rayon, la cage de côtes avec le cœur de lune (le seul
point qui le tue) ; un morceau cassé resté dans la lune se ressoude.

  python3 art/ossuaire_boss_v1.py   → art/ossuaire_boss_v1.png
"""
import importlib.util
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from pix import font, grid, up  # noqa: E402


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ob1 = load("ossuaire_objets_v1")
ob2 = load("ossuaire_objets_v2")
Sprite, C = ob1.Sprite, ob1.C
line, skull_face = ob2.line, ob2.skull_face
T = 16

ROBE, ROBE_D, ROBE_L = (92, 58, 132), (54, 34, 82), (132, 96, 176)
SILV, SILV_D, SILV_L = (178, 188, 206), (108, 116, 134), (238, 244, 252)
BONE, BONE_D, BONE_S = (226, 214, 184), (172, 158, 128), (92, 80, 64)
MOON, MOON_L, MOON_D = (191, 224, 255), (255, 255, 255), (111, 143, 184)
DARK = (14, 12, 18)


# ---------------------------------------------------------------- la Grande Prêtresse (24 × 34)
def priestess(state="idle", f=0):
    """state : idle, chant, call (elle appelle la lune), dazed, rise (monte dans le puits), dead."""
    s = Sprite(24, 34)
    if state == "dead":
        s.r(1, 26, 22, 6, ROBE).r(1, 26, 22, 1, ROBE_L).r(1, 31, 22, 1, ROBE_D)
        s.r(2, 24, 7, 6, BONE).r(3, 26, 2, 2, DARK).r(6, 26, 2, 2, DARK)  # masque tombé
        s.r(9, 23, 10, 2, SILV).r(9, 23, 10, 1, SILV_L)  # haute coiffe couchée
        line(s, 14, 31, 23, 27, SILV_D)
        return s.done()
    bob = (0, -1)[f % 2] if state in ("idle", "chant") else 0
    lift = -6 if state == "rise" else 0
    oy = bob + lift
    # robe longue en cloche, bordée d'argent, qui traîne au sol
    for y in range(14, 33):
        w = 4 + (y - 14) * 0.45
        x0, x1 = round(12 - w), round(12 + w)
        s.r(x0, y + oy, x1 - x0, 1, ROBE)
        s.p(x0, y + oy, ROBE_L).p(x1 - 1, y + oy, ROBE_D)
    s.r(4, 32 + oy, 16, 1, SILV)
    s.r(11, 15 + oy, 2, 17, SILV_D)  # étole d'argent
    for y in (18, 22, 26):
        s.r(10, y + oy, 4, 1, SILV_L)
    # haute coiffe pointue (mitre de craie), sans lune dessinée : un anneau pâle derrière la tête
    if state != "dazed":
        for k, a in enumerate(range(0, 360, 20)):
            x = 12 + 7 * math.cos(math.radians(a))
            y = 7 + 7 * math.sin(math.radians(a))
            s.p(round(x), round(y + oy), MOON if k % 2 else MOON_D)
    s.r(9, 0 + oy, 6, 4, SILV).r(10, -1 + oy, 4, 1, SILV_L).r(9, 0 + oy, 1, 4, SILV_L).r(14, 0 + oy, 1, 4, SILV_D)
    # visage : masque d'os, orbites qui luisent
    s.r(8, 4 + oy, 8, 9, BONE).r(8, 4 + oy, 8, 1, (240, 232, 210)).r(15, 4 + oy, 1, 9, BONE_D)
    eye = MOON_L if state == "chant" else MOON if state != "dazed" else BONE_S
    s.r(9, 7 + oy, 2, 2, DARK).r(13, 7 + oy, 2, 2, DARK)
    s.p(9, 7 + oy, eye).p(13, 7 + oy, eye)
    s.r(11, 10 + oy, 2, 1, BONE_S).r(10, 12 + oy, 4, 1, BONE_S)
    s.r(6, 12 + oy, 12, 3, ROBE_D)  # col
    # bras et mains d'os
    if state == "chant":
        line(s, 6, 15 + oy, 2, 6 + oy, ROBE), line(s, 7, 15 + oy, 3, 6 + oy, ROBE_D)
        line(s, 17, 15 + oy, 21, 6 + oy, ROBE), line(s, 16, 15 + oy, 20, 6 + oy, ROBE_D)
        s.r(1, 3 + oy, 3, 3, BONE).r(20, 3 + oy, 3, 3, BONE)
        for k in range(3):
            s.p(2 + (k + f) % 3 * 9, 0 + k, MOON_L if (k + f) % 2 else MOON)
    elif state == "call":
        line(s, 6, 16 + oy, 0, 14 + oy, ROBE), line(s, 17, 16 + oy, 23, 14 + oy, ROBE)
        s.r(0, 12 + oy, 2, 3, BONE).r(22, 12 + oy, 2, 3, BONE)
        s.r(0, 10 + oy, 2, 2, MOON).r(22, 10 + oy, 2, 2, MOON)
    elif state == "dazed":
        line(s, 6, 16, 4, 24, ROBE), line(s, 17, 16, 19, 24, ROBE)
        s.r(3, 24, 3, 2, BONE).r(18, 24, 3, 2, BONE)
        for x, y in ((5, 1), (12, -1), (19, 1)):
            s.p(x, max(0, y + 1), SILV_L)
    else:
        line(s, 6, 16 + oy, 5, 24 + oy, ROBE), line(s, 17, 16 + oy, 18, 24 + oy, ROBE)
        s.r(4, 24 + oy, 3, 2, BONE).r(17, 24 + oy, 3, 2, BONE)
        # bâton d'argent à orbe pâle
        line(s, 20, 4 + oy, 20, 32 + oy, SILV_D), line(s, 21, 4 + oy, 21, 32 + oy, SILV)
        s.r(19, 1 + oy, 4, 4, MOON).r(20, 1 + oy, 2, 1, MOON_L)
    return s.done()


# ---------------------------------------------------------------- le Colosse d'ossuaire (48 × 52)
def colossus(arm_l=True, arm_r=True, head=True, heart_open=False, charge=False, fallen=False):
    s = Sprite(48, 52)
    if fallen:
        for k in range(26):
            x = 4 + (k * 7) % 40
            y = 40 + (k * 5) % 10
            line(s, x, y, x + 5, y + (k % 3) - 1, BONE if k % 2 else BONE_D)
        skull_face(s, 20, 38)
        skull_face(s, 30, 42)
        s.r(14, 44, 6, 3, BONE).r(26, 47, 8, 2, BONE_D)
        return s.done()
    # jambes : colonnes de fémurs serrés
    for x0 in (13, 28):
        for k in range(3):
            line(s, x0 + k * 2, 34, x0 + k * 2, 49, BONE if k != 1 else BONE_D)
        s.r(x0 - 1, 49, 8, 3, BONE_D).r(x0 - 1, 49, 8, 1, BONE)
        skull_face(s, x0, 40)  # genou de crâne
    # bassin
    s.r(12, 30, 24, 5, BONE).r(12, 30, 24, 1, (240, 232, 210)).r(12, 34, 24, 1, BONE_D)
    s.r(21, 31, 6, 3, BONE_S)
    # cage de côtes et cœur de lune
    for k in range(6):
        y = 15 + k * 3
        line(s, 23, y, 12 + k // 2, y + 2, BONE)
        line(s, 24, y, 35 - k // 2, y + 2, BONE)
    line(s, 23, 13, 23, 30, BONE_D), line(s, 24, 13, 24, 30, BONE)
    cr = 4 if heart_open else 3
    for y in range(-cr, cr + 1):
        for x in range(-cr, cr + 1):
            if x * x + y * y <= cr * cr:
                s.p(24 + x, 22 + y, MOON_L if x * x + y * y < 2 else MOON if x * x + y * y < cr * cr - 2 else MOON_D)
    # épaules : deux crânes
    skull_face(s, 8, 11)
    skull_face(s, 35, 11)
    s.r(13, 12, 22, 3, BONE).r(13, 12, 22, 1, (240, 232, 210))
    # bras : fémurs, poings en grappe de crânes
    if arm_l:
        line(s, 9, 16, 5, 30, BONE), line(s, 10, 16, 6, 30, BONE_D)
        line(s, 5, 30, 6, 38, BONE), line(s, 6, 30, 7, 38, BONE_D)
        skull_face(s, 2, 37), skull_face(s, 6, 40)
    else:
        s.r(8, 16, 3, 2, BONE_S)
    if arm_r:
        line(s, 38, 16, 42, 30, BONE), line(s, 37, 16, 41, 30, BONE_D)
        line(s, 42, 30, 41, 38, BONE), line(s, 41, 30, 40, 38, BONE_D)
        skull_face(s, 40, 37), skull_face(s, 36, 40)
    else:
        s.r(37, 16, 3, 2, BONE_S)
    # tête : un grand crâne (7 × 8 « pixels » de crâne agrandi), orbites de lune
    if head:
        s.r(18, 0, 12, 10, BONE).r(18, 0, 12, 1, (240, 232, 210)).r(29, 0, 1, 10, BONE_D)
        s.r(20, 3, 3, 3, DARK).r(25, 3, 3, 3, DARK)
        e = MOON_L if charge else MOON
        s.p(21, 4, e).p(26, 4, e)
        if charge:
            s.r(20, 3, 3, 3, MOON).r(25, 3, 3, 3, MOON).p(21, 4, MOON_L).p(26, 4, MOON_L)
        s.r(23, 6, 2, 2, BONE_S)
        for x in range(20, 28, 2):
            s.p(x, 9, BONE_S)
        s.r(19, 10, 10, 2, BONE_D)
    else:
        s.r(22, 9, 4, 3, BONE_S)
    return s.done()


# ---------------------------------------------------------------- la salle de la Lune (20 × 15)
PLAN = ["#" * 22] + ["#" + "." * 20 + "#" for _ in range(14)] + ["#" * 10 + ".." + "#" * 10]


def socle():
    """Le socle vide : un grand bloc de craie, deux chaînes brisées qui pendent, des maillons au sol."""
    s = Sprite(40, 30)
    s.r(4, 10, 32, 18, "sD").r(4, 10, 32, 2, "sL").r(4, 26, 32, 2, "sDD").r(6, 12, 28, 1, "s")
    s.r(10, 4, 20, 6, "s").r(10, 4, 20, 1, "sL")  # gradin
    for x0 in (12, 26):
        for y in range(0, 10, 2):
            s.r(x0 + (y // 2) % 2, y, 2, 1, "iL").p(x0 + (y // 2) % 2, y + 1, "i")
    for x, y in ((6, 28), (30, 28), (34, 27)):
        s.r(x, y, 2, 1, "iL")
    return s.done()


def candle():
    s = Sprite(8, 18)
    s.r(2, 13, 4, 4, "iL").r(1, 16, 6, 2, "i")
    s.r(2, 4, 4, 9, (126, 90, 168)).r(5, 4, 1, 9, (90, 60, 130))
    s.p(3, 2, (255, 220, 120)).p(3, 3, (255, 248, 210)).p(4, 3, (255, 200, 90))
    return s.done()


def arena(phase=1):
    a, xs, ys, wall = ob2.mini(PLAN)
    img = Image.fromarray(np.clip(a, 0, 255).astype(np.uint8), "RGB")
    put = lambda sp, x, y, sh=True: ob2.paste(img, sp, x, y, sh)  # noqa: E731
    put(socle(), 9 * T - 4, 1 * T - 6)
    # gisants en cercle autour du centre
    for k in range(6):
        ang = math.pi * (0.15 + k / 5 * 0.7)
        cx = 11 * T + math.cos(ang) * 7.5 * T
        cy = 8 * T + math.sin(ang) * 5 * T
        put(ob1.gisant(), round(cx) - 16, round(cy) - 8)
    for (x, y) in ((2 * T, 2 * T), (19 * T, 2 * T), (2 * T, 13 * T), (19 * T, 13 * T), (6 * T, 4 * T), (15 * T, 4 * T)):
        put(candle(), x, y - 4)
    if phase == 1:
        put(priestess("call"), 11 * T - 12, 7 * T - 20)
    else:
        put(colossus(arm_r=False, charge=True), 11 * T - 24, 8 * T - 40)
        put(priestess("chant", 1), 11 * T - 12, 3 * T - 16)
    # lumière : le puits (au centre en phase 1, sous la Prêtresse qui chante en phase 2), et la case annoncée (cerclée)
    A = np.asarray(img).astype(float)
    W, H = img.size
    gx, gy = grid(W, H)
    L = np.full((H, W), 0.32)
    wells = [(11 * T, 8 * T)] if phase == 1 else [(11 * T, 4 * T)]
    for (x, y) in wells:
        d = np.hypot(gx - x, (gy - y) / 0.8) / T
        L = np.maximum(L, 0.32 + np.clip(1.4 - d / 3.6, 0, 1) * 1.1)
    warm = np.zeros((H, W))
    for (x, y) in ((2 * T, 2 * T), (19 * T, 2 * T), (2 * T, 13 * T), (19 * T, 13 * T), (6 * T, 4 * T), (15 * T, 4 * T)):
        g = np.clip(1 - np.hypot(gx - x - 4, gy - y) / T / 2.2, 0, 1)
        L = np.maximum(L, 0.32 + g * 0.6)
        warm = np.maximum(warm, g)
    tint = np.ones((H, W, 3)) * (1 - warm[..., None] * 0.3) + np.array((1.25, 1.0, 0.7)) * warm[..., None] * 0.3
    A = A * L[..., None] * tint
    out = Image.fromarray(np.clip(A, 0, 255).astype(np.uint8), "RGB")
    d = ImageDraw.Draw(out)
    if phase == 1:
        # le puits annoncé : il va glisser vers la droite (cercle pointillé + flèche)
        x, y = 16 * T, 10 * T
        for k in range(0, 360, 20):
            d.point((x + 2.6 * T * math.cos(math.radians(k)), y + 2.1 * T * math.sin(math.radians(k))), fill=(220, 236, 255))
        d.line((12 * T + 10, 8 * T + 8, x - 2 * T, y - 4), fill=(220, 236, 255))
    else:
        # le rayon chargé du crâne : la ligne s'allume vers le bas
        for k in range(1, 7):
            d.rectangle((11 * T - 8, 8 * T + k * T - 8, 11 * T + 8, 8 * T + k * T + 6), outline=(220, 240, 255))
    return out


def row(sheet, d, y, title, items, scale, pad=24, cell=None):
    d.text((pad, y), title, fill=(255, 215, 94), font=font(16), anchor="lt")
    x = pad
    y += 26
    hmax = 0
    for name, sp in items:
        im = up(sp.img(), scale)
        w = max(im.width, cell or 0)
        d.text((x, y), name, fill=(190, 184, 200), font=font(12, False), anchor="lt")
        bg = Image.new("RGB", (im.width + 8, im.height + 8), (44, 40, 52))
        bg.paste(im, (4, 4), im)
        sheet.paste(bg, (x, y + 16))
        x += w + 18
        hmax = max(hmax, im.height + 8)
    return y + 16 + hmax + 30


def main():
    A1, A2 = up(arena(1), 2), up(arena(2), 2)
    Wb = A1.width * 2 + 72
    sheet = Image.new("RGB", (Wb, 2200), (14, 12, 18))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 3 · BOSS (v1) · LA GRANDE PRÊTRESSE ET SON COLOSSE", fill=(255, 243, 200), font=font(24), anchor="mm")
    d.text((Wb // 2, 56), "Étage 15, la salle de la Lune : socle vide aux chaînes brisées, gisants en cercle, cierges violets, un puits de lune qu'elle déplace",
           fill=(190, 180, 160), font=font(14, False), anchor="mm")
    y = 84
    d.text((24, y), "Phase 1 : elle appelle la lune (le puits va glisser dans le cercle)", fill=(255, 215, 94), font=font(14), anchor="lt")
    d.text((A1.width + 48, y), "Phase 2 : elle chante dans le puits ; le Colosse charge son rayon", fill=(255, 215, 94), font=font(14), anchor="lt")
    sheet.paste(A1, (24, y + 26))
    sheet.paste(A2, (A1.width + 48, y + 26))
    y += 26 + A1.height + 36
    y = row(sheet, d, y, "LA GRANDE PRÊTRESSE (×4) — 2 cases de haut", [
        ("repos", priestess("idle", 0)), ("repos", priestess("idle", 1)), ("appelle la lune", priestess("call")),
        ("chante", priestess("chant", 0)), ("chante", priestess("chant", 1)), ("sonnée", priestess("dazed")),
        ("monte dans le puits", priestess("rise")), ("morte", priestess("dead"))], 4, cell=120)
    y = row(sheet, d, y, "LE COLOSSE D'OSSUAIRE (×3) — 3 × 3 cases ; seul le cœur de lune (dans la cage) le tue", [
        ("entier", colossus()), ("rayon chargé", colossus(charge=True)), ("bras gauche cassé", colossus(arm_l=False)),
        ("bras cassés", colossus(arm_l=False, arm_r=False)), ("crâne cassé", colossus(head=False)),
        ("cœur à nu", colossus(arm_l=False, arm_r=False, head=False, heart_open=True)), ("effondré", colossus(fallen=True))], 3, cell=150)
    y = row(sheet, d, y, "DÉCOR (×3)", [("socle vide, chaînes brisées", socle()), ("cierge violet", candle()), ("gisant", ob1.gisant())], 3, cell=230)
    notes = [
        "PHASE 1 · LA PRÊTRESSE (C) : ~90 PV. Tous les 5 tours, elle APPELLE LA LUNE : un cercle se trace, le puits y glisse au tour suivant ;",
        "  les gisants et tas d'os qu'il touche se lèvent. Tous les 4 tours, elle CHANTE (annoncé) : les morts reprennent des PV ; frappée pendant, elle est SONNÉE.",
        "  6 CIERGES VIOLETS : chacun éteint (coup, flèche, potion de gel) rétrécit la lumière du puits ; tous éteints, le puits ne relève plus personne.",
        "PHASE 2 · LE COLOSSE (à mi-vie de la Prêtresse) : elle monte chanter dans le puits, hors d'atteinte du corps à corps (les flèches la touchent).",
        "  Les os de la salle forment le Colosse : BRAS (coups au contact, 2 cases d'allonge), CRÂNE (rayon chargé, comme le crâne lunaire),",
        "  CAGE : le CŒUR DE LUNE, seul point qui le tue, à nu une fois les deux bras OU le crâne cassés. Un morceau cassé resté DANS LA LUNE se ressoude en 4 tours.",
        "  Le Colosse tombé, elle redescend, épuisée : on l'achève. Fin : le socle vide, « Elle sonne encore plus bas. » (la section 4).",
    ]
    for i, t in enumerate(notes):
        d.text((24, y + i * 22), t, fill=(200, 196, 210), font=font(13, False), anchor="lt")
    sheet = sheet.crop((0, 0, Wb, y + len(notes) * 22 + 24))
    sheet.save(os.path.join(HERE, "ossuaire_boss_v1.png"))
    print("art/ossuaire_boss_v1.png", sheet.size)


def export():
    """python3 art/ossuaire_boss_v1.py export → src/render/sprites/pretresse.ts (Thomas, 2026-11-19 : « fonce sur boss »)."""
    from export_jeu_v4 import write
    sp = {f"pr_{st}{f}": priestess(st, f).img() for st in ("idle", "chant") for f in (0, 1)}
    sp.update({"pr_call": priestess("call").img(), "pr_dazed": priestess("dazed").img(), "pr_rise": priestess("rise").img(), "pr_dead": priestess("dead").img()})
    for l in (0, 1):
        for r in (0, 1):
            for h in (0, 1):
                sp[f"co_{l}{r}{h}"] = colossus(arm_l=bool(l), arm_r=bool(r), head=bool(h), heart_open=(not l and not r) or not h).img()
    sp["co_charge"] = colossus(charge=True).img()
    sp["co_fallen"] = colossus(fallen=True).img()
    sp["socle"] = socle().img()
    sp["ciergeViolet"] = candle().img()
    off = candle()
    off.a[0:4] = 0
    sp["ciergeVioletOff"] = off.img()
    write("src/render/sprites/pretresse.ts", "PRETRESSE",
          "Boss de la section 3 (art/ossuaire_boss_v1.png, validée le 2026-11-19) : la Grande Prêtresse, le Colosse (bras gauche, droit, crâne : 1 = là), le socle, les cierges violets.",
          sp)


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "export":
    export()
elif __name__ == "__main__":
    main()
