"""Araignée, v1 (Thomas, 2026-11-11 : « Les toiles apparaissent à partir du niveau 3. Design les araignées. Plus rapide,
plus de santé, plus de dommage. Note boss section 1 : araignée géante, toile »).

Araignée : une case, vue de 3/4 plongeante comme le Schrat ; corps noir-violet, abdomen marqué d'une tache rouge, huit
pattes articulées, yeux rouges. Poses : repos (2), marche (2), morsure, morte (sur le dos, pattes repliées).
Araignée géante (boss de la section 1) : 2 × 2 cases, abdomen pâle marqué d'un crâne, crochets, beaucoup d'yeux.
Écrit art/araignee_v1.png. Lancer depuis la racine du dépôt.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw
from pix import up, font
from dortoir_v2 import Sprite, C

C.update({
    "sp_d": (24, 18, 30, 255), "sp": (52, 40, 62, 255), "sp_l": (84, 68, 98, 255), "sp_h": (118, 100, 134, 255),
    "eye": (230, 50, 50, 255), "eye_h": (255, 170, 150, 255), "mark": (180, 40, 46, 255),
    "fang": (220, 214, 196, 255), "bone_p": (204, 196, 176, 255), "bone_s": (150, 140, 124, 255),
})


def leg(s, x0, y0, x1, y1, x2, y2, col="sp"):
    """Une patte : deux segments (cuisse, puis jambe qui descend vers le sol)."""
    for (ax, ay, bx, by) in ((x0, y0, x1, y1), (x1, y1, x2, y2)):
        n = max(abs(bx - ax), abs(by - ay), 1)
        for i in range(n + 1):
            s.p(round(ax + (bx - ax) * i / n), round(ay + (by - ay) * i / n), col)
    s.p(x1, y1, "sp_h")  # genou qui accroche la lumière


def spider(pose="idle", phase=0):
    """Araignée de 18 × 16 (une case, pattes qui débordent un peu). `pose` : idle, walk, bite, dead ; `phase` : 0 ou 1.
    Le corps a son contour sombre ; les pattes sont des traits fins sans contour (sinon elles font une masse)."""
    s = Sprite(18, 16)
    if pose == "dead":
        s.r(6, 9, 6, 4, "sp_l").r(7, 8, 4, 1, "sp_l").r(7, 13, 4, 1, "sp").done()
        for i, x in enumerate((6, 8, 10, 12)):
            leg(s, x, 9, x - 1 + (i % 2) * 2, 6, x + (i % 2), 5, "sp_h")
        s.r(4, 14, 10, 2, "shadow")
        return s
    lift = 1 if pose == "walk" and phase else 0
    # Corps : abdomen rond (haut) avec sa tache rouge, céphalothorax (bas) avec les yeux.
    s.r(7, 2 - lift, 4, 5, "sp").r(6, 3 - lift, 6, 3, "sp").r(7, 2 - lift, 2, 1, "sp_l")
    s.r(8, 3 - lift, 2, 2, "mark")
    s.r(7, 7 - lift, 4, 3, "sp_l").r(7, 7 - lift, 4, 1, "sp_h")
    s.p(7, 8 - lift, "eye").p(10, 8 - lift, "eye").p(8, 8 - lift, "eye_h").p(9, 8 - lift, "eye")
    if pose == "bite":
        s.p(7, 10, "fang").p(10, 10, "fang").p(7, 11, "fang").p(10, 11, "fang")
    else:
        s.p(8, 10 - lift, "fang").p(9, 10 - lift, "fang")
    s.done()
    # Pattes : quatre de chaque côté, genou haut, pied au sol ; elles alternent pendant la marche.
    s.r(3, 14, 12, 2, "shadow")
    for i, (sy, kx, ky, fx, fy) in enumerate(((4, 3, 1, 0, 3), (6, 2, 4, 0, 8), (8, 3, 7, 1, 12), (9, 5, 10, 3, 14))):
        up_l = ((i + phase) % 2) if pose == "walk" else 0
        up_r = (1 - up_l) if pose == "walk" else 0
        leg(s, 6, sy - lift, kx, ky - up_l, fx, fy - up_l, "sp_h")
        leg(s, 11, sy - lift, 17 - kx, ky - up_r, 17 - fx, fy - up_r, "sp_h")
    return s


def giant():
    """Araignée géante (boss) : 32 × 32, abdomen pâle marqué d'un crâne, huit yeux, crochets, pattes épaisses."""
    s = Sprite(40, 34)
    s.r(4, 30, 32, 3, "shadow")
    for i, (dy, reach) in enumerate(((-6, 14), (-1, 17), (4, 17), (9, 14))):
        y = 16 + dy
        for t in range(2):
            leg(s, 16, y + t, 16 - reach // 2, y - 7 + t, 16 - reach, y + 4 + t)
            leg(s, 23, y + t, 23 + reach // 2, y - 7 + t, 23 + reach, y + 4 + t)
    # Abdomen pâle, marqué d'un crâne (il annonce le boss).
    for y in range(0, 16):
        for x in range(11, 29):
            if ((x - 19.5) / 9) ** 2 + ((y - 8) / 8) ** 2 <= 1:
                s.p(x, y, "sp")
    for y in range(3, 13):
        for x in range(14, 26):
            if ((x - 19.5) / 5.5) ** 2 + ((y - 8) / 5) ** 2 <= 1:
                s.p(x, y, "bone_p")
    s.r(16, 6, 2, 2, "sp_d").r(22, 6, 2, 2, "sp_d").p(19, 9, "sp_d").p(20, 9, "sp_d").r(17, 11, 6, 1, "bone_s")
    for x in (17, 19, 21):
        s.p(x, 12, "sp_d")
    # Céphalothorax et yeux (huit).
    s.r(13, 16, 14, 10, "sp_l").r(14, 15, 12, 1, "sp_l").r(14, 16, 12, 1, "sp_h")
    for x, y in ((15, 19), (24, 19), (17, 18), (22, 18), (18, 20), (21, 20), (19, 18), (20, 18)):
        s.p(x, y, "eye")
    s.p(15, 19, "eye_h").p(24, 19, "eye_h")
    # Crochets.
    s.r(16, 26, 2, 4, "fang").r(22, 26, 2, 4, "fang").p(17, 29, "bone_s").p(22, 29, "bone_s")
    return s.done()


if __name__ == "__main__":
    poses = [("repos", spider("idle", 0)), ("repos 2", spider("idle", 1)), ("marche", spider("walk", 0)),
             ("marche 2", spider("walk", 1)), ("morsure", spider("bite")), ("morte", spider("dead"))]
    S = 6
    sheet = Image.new("RGB", (900, 560), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((450, 20), "ARAIGNÉE v1 et ARAIGNÉE GÉANTE (boss section 1) — à valider", fill=(255, 243, 200), font=font(15), anchor="mm")
    x = 20
    for label, sp in poses:
        im = up(sp.img(), S)
        bg = Image.new("RGB", (130, 130), (70, 61, 82))
        bg.paste(im, ((130 - im.width) // 2, 130 - im.height - 6), im)
        sheet.paste(bg, (x, 50))
        d.text((x, 186), label, fill=(220, 210, 190), font=font(12, False))
        x += 145
    g = up(giant().img(), 7)
    bg = Image.new("RGB", (g.width + 20, g.height + 20), (70, 61, 82))
    bg.paste(g, (10, 10), g)
    sheet.paste(bg, (20, 215))
    d.text((g.width + 60, 230), "Araignée géante — boss de l'étage 5", fill=(255, 220, 160), font=font(14))
    notes = [
        "Araignée (dès l'étage 3, près des toiles) — proposé :",
        "  10 PV (Schrat 7), CA 13, +3, morsure 1d6 (Schrat 1d4)",
        "  rapide : 2 pas par tour quand elle fonce",
        "  sa morsure englue 1 tour (1 fois sur 3)",
        "  tisse : une toile apparaît là où elle s'arrête",
        "",
        "Araignée géante — proposé :",
        "  2 × 2 cases, 45 PV, CA 14, +5, 2d6",
        "  sa salle est couverte de toiles",
        "  crache une toile à 4 cases (englue)",
        "  à mi-vie : 2 petites araignées sortent",
        "",
        "Schrats contre araignées (idée) : de temps en",
        "  temps, ils se battent entre eux (on peut",
        "  laisser faire, puis finir le vainqueur).",
    ]
    for i, line in enumerate(notes):
        d.text((g.width + 60, 260 + i * 19), line, fill=(220, 210, 190), font=font(12, False))
    sheet.save("art/araignee_v1.png")
    print(sheet.size)
