"""Grille de sprites du Schrat, v2 (proposition, pas en jeu). Lancer depuis la racine du dépôt.

Demande de Thomas (2026-11-11) sur la v1 : « plutôt du vert jaune reptilien, qui porte une petite cotte de maille ».
Reprend les poses de la v1 (art/schrat_sheet_v1.py) : nouvelles couleurs, et le torse passe en mailles
(anneaux gris en damier) ; les bras restent en écailles, le pagne de cuir dépasse dessous.
"""
import importlib.util
from PIL import Image, ImageDraw, ImageFont

spec = importlib.util.spec_from_file_location("v1", "art/schrat_sheet_v1.py")
v1 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v1)

PAL = dict(v1.PAL)
PAL.update({
    "A": (156, 182, 62),   # écailles vert-jaune
    "a": (92, 116, 38),    # écailles sombres
    "L": (222, 220, 146),  # ventre et museau
    "Y": (236, 140, 40),   # œil orange (ressort sur le vert)
    "C": (176, 184, 194),  # mailles claires
    "c": (100, 106, 120),  # mailles sombres
})

# Rangées du torse pour chaque vue (index dans la grille 16x16) et colonne minimale (pour ne pas toucher la queue).
TORSO = {"face": ((11, 12), 0), "profil": ((10, 11), 5), "dos": ((11, 12), 0)}

def mail(g, rows, xmin=0):
    """Remplace l'intérieur du torse par des mailles : les pixels du bord restent en écailles (les bras)."""
    o = [r[:] for r in g]
    for y in rows:
        xs = [x for x in range(xmin, 16) if g[y][x] in "AaL"]
        if len(xs) < 3:
            continue
        for x in xs[1:-1]:
            o[y][x] = "C" if (x + y) % 2 else "c"
    return o

def frames():
    out = []
    for i, (label, g) in enumerate(v1.FRAMES):
        if i < 18:
            view = ("face", "profil", "dos")[i // 6]
            rows, xmin = TORSO[view]
            # La pose « coup » de profil est avancée d'une case.
            if view == "profil" and i == 11:
                xmin += 1
            g = mail(g, rows, xmin)
        elif label == "touché":
            g = v1.hurt(mail(v1.profile(), *TORSO["profil"]))
        elif label == "endormi":
            g = mail(g, (13,), 4)
        elif label == "mort":
            g = mail(g, (12,), 3)
        out.append((label, g))
    return out

if __name__ == "__main__" and "export" not in __import__("sys").argv:
    FR = frames()
    S = 6
    cell = 16 * S + 12
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 13)
    fs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
    W = 140 + 6 * cell
    H = 40 + 4 * (cell + 34) + 120
    sheet = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 18), "SCHRAT — GRILLE v2 : vert-jaune, cotte de mailles (rien en jeu)", fill=(255, 243, 200), font=f, anchor="mm")
    for i, (label, g) in enumerate(FR):
        row, col = (i // 6, i % 6) if i < 18 else (3, i - 18)
        x = 140 + col * cell
        y = 40 + row * (cell + 34)
        if col == 0:
            d.text((10, y + cell // 2), v1.ROW_TITLES[row], fill=(214, 170, 84), font=fs, anchor="lm")
        d.rectangle([x, y, x + cell - 6, y + cell - 6], fill=(70, 61, 82))
        im = v1.render(g, S, PAL)
        sheet.paste(im, (x + 3, y + 3), im)
        d.text((x + (cell - 6) // 2, y + cell + 6), f"{i + 1}. {label}", fill=(220, 210, 190), font=fs, anchor="mm")
    y0 = 40 + 4 * (cell + 34) + 10
    d.text((10, y0 + 8), "EN JEU (x3)", fill=(214, 170, 84), font=fs, anchor="lm")
    T = 48
    hero_rows, hero_pal = v1.hero_idle()
    for k in range(5):
        d.rectangle([140 + k * T, y0 + 30, 140 + (k + 1) * T - 1, y0 + 30 + T - 1], fill=(70, 61, 82), outline=(58, 50, 68))
    size = round(T * 1.3)
    hero = v1.render(hero_rows, 1, hero_pal).resize((size, size), Image.NEAREST)
    sheet.paste(hero, (140 + T // 2 - size // 2, y0 + 30 + T // 2 - size // 2 - 6), hero)
    for k, g in ((2, FR[6][1]), (4, FR[0][1])):
        sch = v1.render(g, 1, PAL).resize((size, size), Image.NEAREST)
        sheet.paste(sch, (140 + k * T + T // 2 - size // 2, y0 + 30 + T // 2 - size // 2 - 6), sch)
    d.text((140 + 2 * T, y0 + 30 + T + 14), "héros / Schrat (profil) / Schrat (face)", fill=(200, 190, 170), font=fs, anchor="mm")
    sheet.save("art/schrat_v2.png")
    print(sheet.size)

def export():
    """Écrit src/render/sprites/schrat.ts (planche v2 validée par Thomas le 2026-11-11). Ne pas retoucher le fichier produit."""
    import sys
    FR = [["".join(r) for r in g] for _, g in frames()]
    sets = {}
    for view, base in (("Down", 0), ("Side", 6), ("Up", 12)):
        sets[f"idle{view}"] = [FR[base], FR[base + 1]]
        sets[f"walk{view}"] = [FR[base + 2], FR[base + 3]]
        sets[f"stab{view}"] = [FR[base + 4], FR[base + 5]]
    sets["hurt"] = [FR[18]]
    sets["sleep"] = [FR[19]]
    sets["dead"] = [FR[20]]
    used = sorted({c for fs in sets.values() for f in fs for r in f for c in r if c != "."})
    out = ["// Fichier généré par art/schrat_sheet_v2.py export (planche validée : art/schrat_v2.png). Ne pas modifier à la main.", "",
           "export const SCHRAT_PALETTE: Record<string, string> = {"]
    out += ['  %s: "#%02x%02x%02x",' % ((c,) + tuple(PAL[c])) for c in used]
    out += ["};", "", "/** Images 16×16 du Schrat ; les vues de profil regardent vers la droite. */", "export const SCHRAT = {"]
    for k, fs in sets.items():
        out.append(f"  {k}: [")
        for f in fs:
            out.append("    [")
            out += [f'      "{r}",' for r in f]
            out.append("    ],")
        out.append("  ],")
    out += ["} as const;", ""]
    open("src/render/sprites/schrat.ts", "w", encoding="utf8").write("\n".join(out))
    print(len(used), "couleurs")

import sys as _sys
if len(_sys.argv) > 1 and _sys.argv[1] == "export":
    export()
