"""Monstres de la section 3 (Ossuaire), v1 — PREMIER JET (Thomas, 2026-11-19 : « Fait un draft des mobs »).

Les quatre familles de claude/MONSTRES_S3.md : RAT D'OSSUAIRE, SQUELETTE, ACOLYTE DE LA LUNE PÂLE, GISANT ÉVEILLÉ.
Même format que la section 2 (16 × 16, lignes de lettres, palette, contour « O » ajouté par G.done()).
Premier jet : les poses clés seulement (face, profil, attaque, états propres) ; les autres états viendront après validation.

  python3 art/mobs_oss_v1.py          → art/mobs_oss_v1.png
  python3 art/mobs_oss_v1.py export   → src/render/sprites/mobsOss.ts (Thomas, 2026-11-19 : « Ok fonce »)
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from pix import font, up
from mobs_champi_v1 import G, flip, img

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = "#14121a"

# ---------------------------------------------------------------- palettes
RAT = {"O": OUT, "F": "#6a5e58", "f": "#443a38", "h": "#948678", "P": "#c48a8a", "E": "#ff5a4a", "A": "#b83a2a", "a": "#6a8a3a",
       "M": "#bfe0ff"}
SKEL = {"O": OUT, "W": "#e8e0c8", "w": "#b4a888", "d": "#786c56", "E": "#0c0a10", "R": "#9a6a44", "r": "#5a3a28",
        "M": "#bfe0ff", "m": "#6f8fb8"}
ACO = {"O": OUT, "V": "#4a4a6e", "v": "#2a2a44", "L": "#c8d4e8", "K": "#0c0a10", "M": "#bfe0ff", "m": "#6f8fb8",
       "S": "#c4ccd4", "s": "#5a3a28", "H": "#d8c8b0"}
GIS = {"O": OUT, "T": "#8c8c96", "t": "#5c5c68", "U": "#bcbcc6", "X": "#34343e", "M": "#bfe0ff", "m": "#6f8fb8"}


def g(rows):
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), rows
    return G(rows).done()


# ---------------------------------------------------------------- 1. RAT D'OSSUAIRE
E16 = "................"
RAT_SIDE = [E16] * 8 + [
    "..........hP....",
    ".....ffFFhh.....",
    "...fFFFFFFFhF...",
    "..fFFFFFFFFFFE..",
    "PPfFFFFFFFFFFFFP",
    "...ffFFFFFFFf...",
    "....f.f...f.f...",
    E16]
RAT_SIDE_B = [E16] * 8 + [
    "..........hP....",
    ".....ffFFhh.....",
    "...fFFFFFFFhF...",
    "P.fFFFFFFFFFFE..",
    ".PfFFFFFFFFFFFFP",
    "...ffFFFFFFFf...",
    "...f...f.f...f..",
    E16]
RAT_DOWN = [E16] * 8 + [
    "....hP....Ph....",
    "....hFFFFFFh....",
    "...FFEFFFFEFF...",
    "...FFFFFFFFFF...",
    "....fFFPPFFf....",
    "....f.ffff.f....",
    "........P.......",
    E16]
RAT_ATK = [E16] * 7 + [
    "...........hP...",
    "......ffFFhh....",
    "....fFFFFFFFhF..",
    "...fFFFFFFFFFFE.",
    "PPfFFFFFFFFFFFFW",
    "..ffFFFFFFFFf.W.",
    "..f...f...f.f...",
    E16, E16]
RAT_ATK = [r.replace("W", "h") for r in RAT_ATK]
RAT_EAT = [E16] * 8 + [
    "........hP......",
    "...ffFFhh.......",
    ".fFFFFFFFhF.....",
    "fFFFFFFFFFFE.a..",
    "PfFFFFFFFFFFFAA.",
    ".ffFFFFFFFf.AAA.",
    "..f.f...f.f.....",
    E16]
RAT_FLEE = [E16] * 8 + [
    "....hP..........",
    ".....hhFFff.....",
    "...FhFFFFFFFf...",
    "..EFFFFFFFFFFf.M",
    "PFFFFFFFFFFFFfPM",
    "...fFFFFFFFff..M",
    "..f.f...f.f.....",
    E16]
RAT_DEAD = [E16] * 10 + [
    "................",
    "...f.f...f.f....",
    "..fFFFFFFFFFf...",
    "PPfFhFFFFFFFFE..",
    "...ffffffffff...",
    E16]

# ---------------------------------------------------------------- 2. SQUELETTE
SK_DOWN = [
    E16,
    "......WWWW......",
    ".....WWWWWw.....",
    ".....WEWWEw.....",
    ".....WWdWWw.....",
    "......wddw......",
    ".......dd.......",
    "...WWwWWWWwW....",
    "...W.WdWWdW.W...",
    "...W.wWddWw.W...",
    "..RW..WddW..W...",
    "..R...dWWd......",
    "..R..WwddwW.....",
    "..r..W....W.....",
    ".....W....W.....",
    "....WW....WW...."]
SK_SIDE = [
    E16,
    ".......WWWW.....",
    "......WWWWWW....",
    "......wWWEWW....",
    "......wWWWWWW...",
    ".......wddWd....",
    ".......dd.......",
    "......WWW.......",
    ".....WdWdWW.....",
    ".....wWdWw.W....",
    "......WddW..WR..",
    ".......dW...rR..",
    "......WddW...R..",
    "......W..W...R..",
    "......W...W.....",
    ".....WW...WW...."]
SK_SIDE_B = [
    E16,
    ".......WWWW.....",
    "......WWWWWW....",
    "......wWWEWW....",
    "......wWWWWWW...",
    ".......wddWd....",
    ".......dd.......",
    "......WWW.......",
    ".....WdWdWW.....",
    ".....wWdWw.W....",
    "......WddW..WR..",
    ".......dW...rR..",
    "......WddW...R..",
    ".......WW....R..",
    ".......W.W......",
    "......WW.WW....."]
SK_ATK = [
    "...........R....",
    ".......WWWWR....",
    "......WWWWWR....",
    "......wWWEWRW...",
    "......wWWWWrWW..",
    ".......wddWWd...",
    ".......dd.W.....",
    "......WWWW......",
    ".....WdWdW......",
    ".....wWdWw......",
    "......WddW......",
    ".......dW.......",
    "......WddW......",
    "......W..W......",
    ".....W....W.....",
    "....WW....WW...."]
SK_UP = [
    E16,
    "......WWWW......",
    ".....wWWWWW.....",
    ".....wWWWWW.....",
    ".....wwWWWw.....",
    "......wwww......",
    ".......dd.......",
    "...WWwWWWWwW....",
    "...W.dWdWdW.W...",
    "...W.dWdWdW.W..R",
    "...W..WdW...W..R",
    ".......d.......R",
    ".....WwddwW....r",
    ".....W....W.....",
    ".....W....W.....",
    "....WW....WW...."]
SK_PILE = [E16] * 10 + [
    "........W.W.....",
    "......WWWW.W....",
    "....WWEWWEdW.W..",
    "...WWWWdWWWWdW..",
    "..dWdWWdWdWWdWR.",
    E16]
SK_RISE = [E16] * 3 + [
    ".....M....M.....",
    "..M...WWWW...M..",
    ".....WWWWWw.....",
    ".....WEWWEw.....",
    "..M..WWdWWw..M..",
    "......wddw......",
    "...M...dd...M...",
    ".....WwWWwW.....",
    "....WWdWWdWW....",
    "...WWWdWWdWWW.M.",
    "..dWdWWdWdWWdWR.",
    ".M....M...M.....",
    E16]
SK_DEAD = [E16] * 11 + [
    "........W.W.....",
    "....d.WW.WW.W...",
    "...wd..dWdW.dW..",
    "..dWdWdWdWWdWdR.",
    E16]

# ---------------------------------------------------------------- 3. ACOLYTE DE LA LUNE PÂLE
AC_DOWN = [
    E16,
    E16,
    "......VVVV......",
    ".....VVVVVV.....",
    "....VVKKKKVV....",
    "....VVKMKMVV....",
    "....VVKKKKVV.SS.",
    "....vVVLLVVv..S.",
    "...vVVVLLVVVvHs.",
    "..HvVVVLLVVVv.s.",
    "...vVVVLLVVVv.s.",
    "...vVVVLLVVVv...",
    "..vVVVVLLVVVVv..",
    "..vVVVVLLVVVVv..",
    "..vvVVVVVVVVvv..",
    "...vvvvvvvvvv..."]
AC_SIDE = [
    E16,
    E16,
    "......VVVV......",
    ".....VVVVVV.....",
    ".....VVVVKKV....",
    ".....VVVVKMK....",
    ".....vVVVKKV....",
    ".....vVVVVV.SS..",
    "....vVVVVVVH.S..",
    "....vVVVVVVs....",
    "....vVVVVLLs....",
    "....vVVVVLL.....",
    "...vVVVVVLLV....",
    "...vVVVVVVVVV...",
    "...vvVVVVVVVv...",
    "....vvvvvvvv...."]
AC_ATK = [
    E16,
    E16,
    "......VVVV......",
    ".....VVVVVV.....",
    ".....VVVVKKV....",
    ".....VVVVKMK....",
    ".....vVVVKKV....",
    ".....vVVVVVVH...",
    "....vVVVVVVVsSS.",
    "....vVVVVVV..s.S",
    "....vVVVVLL....S",
    "....vVVVVLL...S.",
    "...vVVVVVLLV....",
    "...vVVVVVVVVV...",
    "...vvVVVVVVVv...",
    "....vvvvvvvv...."]
AC_CHANT = [
    "...m...MM...m...",
    "......mMMm......",
    "..H...VVVV...H..",
    "..HV.VVVVVV.VH..",
    "...VVVKKKKVVV...",
    "....VVKMKMVV....",
    "....VVKKKKVV....",
    "....vVVLLVVv....",
    "...vVVVLLVVVv...",
    "...vVVVLLVVVv...",
    "...vVVVLLVVVv...",
    "...vVVVLLVVVv...",
    "..vVVVVLLVVVVv..",
    "..vVVVVLLVVVVv..",
    "..vvVVVVVVVVvv..",
    "...vvvvvvvvvv..."]
AC_CHANT2 = [
    ".m....mMMm....m.",
    "...m..MMMM..m...",
    "..H...mVVm...H..",
    "..HV.VVVVVV.VH..",
    "...VVVKKKKVVV...",
    "....VVKMKMVV....",
    "....VVKKKKVV....",
    "....vVVLLVVv....",
    "...vVVVLLVVVv...",
    "...vVVVLLVVVv...",
    "...vVVVLLVVVv...",
    "...vVVVLLVVVv...",
    "..vVVVVLLVVVVv..",
    "..vVVVVLLVVVVv..",
    "..vvVVVVVVVVvv..",
    "...vvvvvvvvvv..."]
AC_DAZED = [
    "....L.....L.....",
    "......L.L.......",
    "......VVVV......",
    ".....VVVVVV.....",
    "....VVKKKKVV....",
    "....VVKKKKVV....",
    "....VVKKKKVV....",
    "....vVVLLVVv....",
    "...vVVVLLVVVv...",
    "..HvVVVLLVVVvH..",
    "...vVVVLLVVVv...",
    "...vVVVLLVVVv...",
    "..vVVVVLLVVVVv..",
    "..vVVVVLLVVVVv..",
    "..vvVVVVVVVVvv..",
    "...vvvvvvvvvv..."]
AC_DEAD = [E16] * 10 + [
    "................",
    "..........SS....",
    "...vVVVVVVVsS...",
    ".HvVVVLLLLVVVVV.",
    "..vvvvvvvvvvvvv.",
    E16]

# ---------------------------------------------------------------- 4. GISANT ÉVEILLÉ
GI_DOWN = [
    "......UUUU......",
    ".....UTTTTt.....",
    ".....TXXXXt.....",
    ".....TMXXMt.....",
    ".....TTTTTt.....",
    "...UUTTTTTttt...",
    "..UTTTTUTTTttt..",
    "..TT.TTUTTt.tt..",
    "..TT.TUUUTt.tt..",
    "..UU.TTUTTt.tt..",
    ".....TTUTTt.....",
    ".....TTUTtt.....",
    ".....TT.Utt.....",
    ".....TT..tt.....",
    ".....TT..tt.....",
    "....UTT..ttt...."]
GI_SIDE = [
    "......UUUU......",
    ".....UTTTTU.....",
    ".....TTTXXX.....",
    ".....TTTXMX.....",
    ".....tTTTTT.....",
    "....UTTTTTt.....",
    "...UTTTTTTtt....",
    "...TTUTTTTt.....",
    "...TTUTTTTUUUUU.",
    "...ttUTTTTt.....",
    ".....TTTTTt.....",
    ".....TTTTtt.....",
    ".....TT.tt......",
    ".....TT.tt......",
    ".....TT..tt.....",
    "....TTT..ttt...."]
GI_ATK = [
    "......UUUU....U.",
    ".....UTTTTU..U..",
    ".....TTTXXX.U...",
    ".....TTTXMXU....",
    ".....tTTTTUT....",
    "....UTTTTTTt....",
    "...UTTTTTTtt....",
    "...TTTTTTTt.....",
    "...TTTTTTTt.....",
    "...ttTTTTTt.....",
    ".....TTTTTt.....",
    ".....TTTTtt.....",
    ".....TT.tt......",
    "....TT...tt.....",
    "...TT.....tt....",
    "..TTT.....ttt..."]
GI_LYING = [E16] * 6 + [
    ".UUt..UUUUUUt...",
    "UTTtTTTTTTTTTtt.",
    "TXXtTTTUUUUUUUUU",
    "UTTtTTTTTTTTTtt.",
    ".tt...tttttt....",
    E16, E16, E16, E16, E16]
GI_WAKE = [E16] * 6 + [
    ".UUt..UUUUUUt...",
    "UTTtTTTTTTTTTtt.",
    "TMMtTTTUUUUUUUUU",
    "UTTtTTTTTTTTTtt.",
    ".tt...tttttt....",
    E16, E16, E16, E16, E16]
GI_SIT = [E16] * 3 + [
    "...UUUU.........",
    "..UTTTTt........",
    "..TXMXXt........",
    "..TTTTTt........",
    ".UTTTTTttt......",
    "UTTTUTTtttt.....",
    "TTTTUTTTTTTTTtt.",
    "TTTUUUUUUUUUUUUU",
    "UTTTTTTTTTTTTtt.",
    ".tt...tttttt....",
    E16, E16, E16]
GI_CRACK = [r.replace("T", "T") for r in GI_DOWN]
GI_CRACK = [list(r) for r in GI_CRACK]
for (x, y) in ((6, 6), (7, 7), (6, 8), (8, 9), (9, 10), (4, 7), (12, 8), (11, 9)):
    if GI_CRACK[y][x] != ".":
        GI_CRACK[y][x] = "X"
GI_CRACK = ["".join(r) for r in GI_CRACK]

MOBS = [
    ("RAT D'OSSUAIRE — 7 PV, en meute, fuit la lune, mange la nourriture au sol", RAT, [
        ("face", RAT_DOWN), ("profil", RAT_SIDE), ("marche", RAT_SIDE_B), ("morsure", RAT_ATK),
        ("mange !", RAT_EAT), ("fuit la lune", RAT_FLEE), ("mort", RAT_DEAD)]),
    ("SQUELETTE — 18 PV, épée rouillée, se relève dans la lune", SKEL, [
        ("face", SK_DOWN), ("profil", SK_SIDE), ("marche", SK_SIDE_B), ("dos", SK_UP), ("coup d'épée", SK_ATK),
        ("tas d'os", SK_PILE), ("se relève", SK_RISE), ("crâne brisé", SK_DEAD)]),
    ("ACOLYTE DE LA LUNE PÂLE — 16 PV, faucille, chante pour relever les morts", ACO, [
        ("face", AC_DOWN), ("profil", AC_SIDE), ("faucille", AC_ATK), ("chante", AC_CHANT), ("chante", AC_CHANT2),
        ("sonné", AC_DAZED), ("mort", AC_DEAD)]),
    ("GISANT ÉVEILLÉ — 40 PV, pierre, lent, se lève quand la lune le touche", GIS, [
        ("couché", GI_LYING), ("lune : réveil", GI_WAKE), ("se redresse", GI_SIT), ("face", GI_DOWN),
        ("profil", GI_SIDE), ("coup", GI_ATK), ("fêlé", GI_CRACK)]),
]


def tile(rows, pal, S, bgc):
    sp = up(img(g(rows), pal), S)
    bg = Image.new("RGB", (16 * S + 6, 16 * S + 6), bgc)
    bg.paste(sp, (3, 3), sp)
    return bg


def sheet():
    if not any(t.startswith("SQUELETTE ARCHER") for t, _, _ in MOBS):
        MOBS.insert(2, ("SQUELETTE ARCHER — 14 PV, tire de loin, garde ses distances", {**SKEL, "s": "#d8d0b8"}, [
            ("face", with_bow(SK_DOWN, "Down")), ("profil", with_bow(SK_SIDE, "Side")), ("marche", with_bow(SK_SIDE_B, "Side")), ("tir", with_bow(SK_SIDE, "Atk")), ("tas d'os", SK_PILE)]))
        MOBS.insert(3, ("CRÂNE LUNAIRE — 12 PV, se charge puis tire un rayon sur toute la ligne", CRANE, [
            ("face", CR_DOWN), ("profil", CR_SIDE), ("dos", CR_UP), ("se charge", CR_CHARGE), ("rayon !", CR_CHARGE2), ("mort", CR_DEAD)]))
    S = 5
    cell = 16 * S + 6 + 8
    n = max(len(f) for _, _, f in MOBS)
    W = 20 + n * cell + 20 + 2 * cell + 20
    H = 60 + len(MOBS) * (cell + 46) + 10
    sh = Image.new("RGB", (W, H), (20, 18, 24))
    d = ImageDraw.Draw(sh)
    d.text((W // 2, 24), "MONSTRES SECTION 3 — premier jet (poses clés) · à droite : dans l'ombre / dans la lune",
           fill=(232, 236, 250), font=font(15), anchor="mm")
    y = 56
    for title, pal, frames in MOBS:
        d.text((20, y), title, fill=(191, 224, 255), font=font(13))
        y += 22
        x = 20
        for lab, rows in frames:
            d.text((x, y), lab, fill=(180, 176, 190), font=font(10, False))
            sh.paste(tile(rows, pal, S, (58, 56, 66)), (x, y + 14))
            x += cell
        # en situation : ombre et lune (même sprite, deux éclairages)
        x = 20 + n * cell + 20
        main = frames[1][1] if title.startswith(("RAT", "ACO")) else frames[0][1] if title.startswith("SQU") else frames[3][1]
        for lab, k, bgc, tint in (("ombre", 0.45, (22, 22, 30), (70, 80, 110)), ("lune", 1.0, (120, 130, 150), (225, 235, 255))):
            sp = img(g(main), pal)
            px = sp.load()
            for yy in range(16):
                for xx in range(16):
                    r, gg, b, a = px[xx, yy]
                    if a:
                        px[xx, yy] = (int((r * k + tint[0] * (1 - k)) * (0.6 + 0.4 * k) if k < 1 else min(255, r * 0.85 + tint[0] * 0.15)),
                                      int((gg * k + tint[1] * (1 - k)) * (0.6 + 0.4 * k) if k < 1 else min(255, gg * 0.85 + tint[1] * 0.15)),
                                      int((b * k + tint[2] * (1 - k)) * (0.6 + 0.4 * k) if k < 1 else min(255, b * 0.85 + tint[2] * 0.15)), a)
            spu = up(sp, S)
            bg = Image.new("RGB", (16 * S + 6, 16 * S + 6), bgc)
            bg.paste(spu, (3, 3), spu)
            d.text((x, y), lab, fill=(180, 176, 190), font=font(10, False))
            sh.paste(bg, (x, y + 14))
            x += cell
        y += cell + 24
    return sh


# ---------------------------------------------------------------- jeu : tous les états (mêmes noms que la section 2)
def shift(rows, dx, dy):
    b = [["."] * 16 for _ in range(16)]
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != "." and 0 <= x + dx < 16 and 0 <= y + dy < 16:
                b[y + dy][x + dx] = c
    return ["".join(r) for r in b]


def recol(rows, table):
    return ["".join(table.get(c, c) for c in r) for r in rows]


SK_LIE = [E16] * 9 + [
    "................",
    "..WW......W.....",
    ".WEWdWwWdWWddW..",
    ".WWWdWdWdWw..WW.",
    "..ww..wWdW...W..",
    E16, E16]
RAT_SLEEP = [E16] * 10 + [
    "................",
    ".....ffFFhP.....",
    "...PfFFFFFFFf...",
    "..P.fFFFFFFFFf..",
    "....ffffffffff..",
    E16]
GI_RUBBLE = [r.replace("U", "T") for r in GI_LYING]
GI_RUBBLE = [list(r) for r in GI_RUBBLE]
for (x, y) in ((3, 8), (7, 7), (8, 9), (11, 8), (12, 9)):
    if GI_RUBBLE[y][x] != ".":
        GI_RUBBLE[y][x] = "X"
GI_RUBBLE = ["".join(r) for r in GI_RUBBLE]


def full_set(down, side, side_b, up, atk_side, sleep, dead, prone, extra=None):
    f = {}
    for v, a, b, atk in (("Down", down, shift(down, 0, -1), shift(down, 0, 1)), ("Side", side, side_b, atk_side), ("Up", up, shift(up, 0, -1), shift(up, 0, -1))):
        f[f"idle{v}0"], f[f"idle{v}1"] = a, shift(a, 0, 1) if v != "Side" else a
        f[f"walk{v}0"], f[f"walk{v}1"] = a, b
        f[f"attack{v}0"], f[f"attack{v}1"] = a, atk
    f["idleSide1"] = side_b if side_b != side else shift(side, 0, 1)
    f["hurt"] = shift(side, -1, 0)
    f["sleep"], f["dead"] = sleep, dead
    f["prone0"], f["prone1"] = prone, shift(prone, 1, 0)
    f.update(extra or {})
    return {k: g(v) for k, v in f.items()}


def game_sets():
    rat_up = recol(RAT_DOWN, {"E": "F", "P": "f"})
    rat_up[14] = "........P......."
    ac_up = recol(AC_DOWN, {"K": "V", "M": "V", "L": "V", "H": "."})
    gi_up = recol(GI_DOWN, {"X": "T", "M": "T"})
    return {
        "rat": (full_set(RAT_DOWN, RAT_SIDE, RAT_SIDE_B, rat_up, RAT_ATK, RAT_SLEEP, RAT_DEAD, RAT_DEAD,
                         {"eat0": RAT_EAT, "eat1": shift(RAT_EAT, 0, 1)}), RAT),
        "squelette": (full_set(SK_DOWN, SK_SIDE, SK_SIDE_B, SK_UP, SK_ATK, SK_LIE, SK_DEAD, SK_PILE,
                               {"rise0": SK_RISE, "rise1": shift(SK_RISE, 0, -1)}), SKEL),
        "acolyte": (full_set(AC_DOWN, AC_SIDE, shift(AC_SIDE, 0, -1), ac_up, AC_ATK, AC_DEAD, AC_DEAD, shift(AC_DEAD, 0, 0),
                             {"chant0": AC_CHANT, "chant1": AC_CHANT2, "dazed": AC_DAZED}), ACO),
        "gisantEveille": (full_set(GI_DOWN, GI_SIDE, shift(GI_SIDE, 0, -1), gi_up, GI_ATK, GI_LYING, GI_RUBBLE, GI_LYING,
                                   {"wake0": GI_WAKE, "wake1": GI_SIT, "cracked": GI_CRACK}), GIS),
    }


# Crâne lunaire (Thomas, 2026-11-19 : « un mob qui charge et tire un rayon ») : un crâne dans une flamme pâle, qui flotte.
CRANE = {"O": OUT, "W": "#e8e0c8", "w": "#b4a888", "d": "#786c56", "E": "#0c0a10", "M": "#bfe0ff", "m": "#6f8fb8", "L": "#ffffff"}
CR_DOWN = [
    E16,
    "......m..m......",
    ".....mMm.Mm.....",
    "....mMMmmMMm....",
    "....mWWWWWWm....",
    "...mWWWWWWWWm...",
    "...mWEEWWEEWm...",
    "...mWEMWWEMWm...",
    "....WWWddWWw....",
    "....wWWddWWw....",
    ".....wdWdWd.....",
    ".....mwdwdm.....",
    "......mMMm......",
    ".......mm.......",
    E16,
    E16]
CR_SIDE = [
    E16,
    ".....m..m.......",
    "....mMm.Mm......",
    "...mMMmmMMm.....",
    "...mWWWWWWWm....",
    "..mWWWWWWWWWm...",
    "..mWWWWWWEEWm...",
    "..mWWWWWWEMWWm..",
    "...wWWWWWWWdWm..",
    "...wWWWWWWWWw...",
    "....wwWWdWdW....",
    ".....mwwdwd.....",
    "......mMMm......",
    ".......mm.......",
    E16,
    E16]
CR_UP = [r.replace("E", "W").replace("d", "W") for r in CR_DOWN]
CR_CHARGE = [r.replace("E", "M").replace("m", "M") for r in CR_DOWN]
CR_CHARGE2 = [r.replace("E", "L").replace("M", "L") for r in CR_DOWN]
CR_DEAD = [E16] * 11 + [
    "................",
    "....wWWWWWw.....",
    "...wWEWWEWWd....",
    "...dwWWddWwdd...",
    E16]


def with_bow(rows, view):
    """Squelette archer : l'épée retirée, un arc de bois (et sa corde) à la place."""
    a = [list(r.replace("R", ".").replace("r", ".")) for r in rows]
    pts = {"Down": [(3, 7, "R"), (2, 8, "R"), (2, 9, "R"), (2, 10, "R"), (2, 11, "R"), (3, 12, "R"), (3, 8, "s"), (3, 9, "s"), (3, 10, "s"), (3, 11, "s")],
           "Side": [(12, 7, "R"), (13, 8, "R"), (13, 9, "R"), (13, 10, "R"), (13, 11, "R"), (12, 12, "R"), (12, 8, "s"), (12, 9, "s"), (12, 10, "s"), (12, 11, "s")],
           "Atk": [(12, 6, "R"), (13, 7, "R"), (14, 8, "R"), (14, 9, "R"), (13, 10, "R"), (12, 11, "R"), (11, 8, "s"), (10, 8, "r"), (11, 9, "r"), (12, 9, "r"), (13, 9, "r"), (15, 9, "W")]}[view]
    for x, y, c in pts:
        a[y][x] = c
    return ["".join(r) for r in a]


def archer_set():
    sk = game_sets()["squelette"][0]
    return {
        "idleDown0": with_bow(SK_DOWN, "Down"), "idleSide0": with_bow(SK_SIDE, "Side"), "idleUp0": SK_UP,
        "walkSide1": with_bow(SK_SIDE_B, "Side"), "attackSide1": with_bow(SK_SIDE, "Atk"), "attackDown1": with_bow(SK_DOWN, "Down"),
    }, sk


def export():
    import json
    out = ["// FICHIER GÉNÉRÉ par art/mobs_oss_v1.py export : ne pas modifier à la main.",
           "/** Monstres de la section 3 (planche art/mobs_oss_v1.png) : rat d'ossuaire, squelette, acolyte, gisant éveillé. */",
           "export const MOBS_OSS: Record<string, { palette: Record<string, string>; frames: Record<string, readonly string[]> }> = {"]
    sets = game_sets()
    arch, sk = archer_set()
    # L'archer : les états du squelette (tas d'os, couché, mort…), ses poses à l'arc par-dessus.
    base = {"idleDown0": arch["idleDown0"], "idleSide0": arch["idleSide0"], "idleUp0": SK_UP, "walkSide1": arch["walkSide1"], "attackSide1": arch["attackSide1"]}
    full = full_set(base["idleDown0"], base["idleSide0"], base["walkSide1"], [r.replace("R", ".").replace("r", ".") for r in SK_UP], base["attackSide1"], SK_LIE, SK_DEAD, SK_PILE,
                    {"rise0": SK_RISE, "rise1": shift(SK_RISE, 0, -1)})
    sets["squeletteArcher"] = (full, {**SKEL, "s": "#d8d0b8"})
    # Le Conservateur du musée (Thomas, 2026-11-19 : « fonce sur quête ») : un squelette sans épée, monocle et nœud papillon.
    cons = [list(r.replace("R", ".").replace("r", ".")) for r in SK_DOWN]
    cons[3][9] = "M"
    cons[4][10] = "m"
    for x in (7, 8):
        cons[7][x] = "R"
    cons[7][6] = "R"
    cons[7][9] = "R"
    cons = ["".join(r) for r in cons]
    sets["conservateur"] = ({"idleDown0": g(cons), "idleDown1": g(shift(cons, 0, 1))}, {**SKEL, "R": "#b02838"})
    sets["craneLunaire"] = (full_set(CR_DOWN, CR_SIDE, shift(CR_SIDE, 0, -1), CR_UP, shift(CR_SIDE, 1, 0), CR_DOWN, CR_DEAD, CR_DEAD,
                                     {"charge0": CR_CHARGE, "charge1": CR_CHARGE2}), CRANE)
    for key, (frames, pal) in sets.items():
        out.append(f"  {key}: {{ palette: {json.dumps(pal)}, frames: {{")
        for n, rows in frames.items():
            out.append(f"    {n}: {json.dumps(rows)},")
        out.append("  } },")
    out.append("};")
    open(os.path.join(HERE, "..", "src", "render", "sprites", "mobsOss.ts"), "w").write("\n".join(out) + "\n")


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "export":
    export()
    print("export ok")
elif __name__ == "__main__":
    sheet().save(os.path.join(HERE, "mobs_oss_v1.png"))
    print("ok")
