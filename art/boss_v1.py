"""Étage du boss de la section 1, v1 (Thomas, 2026-11-11 : « Fais une proposition d'étage boss »).

Plan proposé : arrivée → antichambre (calme, torche) → couloir → la NICHÉE (grande salle sombre, couverte de toiles,
colonnes, cocons, restes d'aventuriers) où attend l'Araignée géante ; l'escalier est derrière elle, scellé par une toile
tant qu'elle vit. Écrit art/boss_v1.png. Lancer depuis la racine du dépôt.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
from pix import grid, to_img, up, font, hash2
from dortoir_v2 import Sprite, C, T, walls
from sols_v1 import floor_b
from trainards_v2 import skeleton, cobweb
from araignee_v1 import giant, spider
from salles_v1 import chest_sprite
from planche import planche

C.update({"silk": (226, 222, 214, 255), "silk_d": (168, 160, 150, 255), "silk_l": (246, 244, 236, 255), "egg": (198, 190, 170, 255)})


def cocoon(big=False):
    """Cocon de soie accroché au sol par des fils : il éclot (2 petites araignées) quand la reine est à mi-vie."""
    s = Sprite(14, 18)
    s.r(2, 16, 10, 2, "shadow")
    h = 14 if big else 11
    for y in range(18 - h - 2, 16):
        t = (y - (18 - h - 2)) / h
        hw = 5.2 * math.sin(math.pi * min(1, t * 0.95 + 0.05))
        for x in range(14):
            if abs(x - 6.5) <= hw:
                s.p(x, y, "silk_l" if x < 5 else "silk_d" if x > 9 else "silk")
    for y in range(18 - h, 15, 3):
        s.r(3, y, 8, 1, "silk_d")
    s.done()
    s.p(0, 16, "silk_d").p(13, 15, "silk_d")
    return s


def web_hub():
    """Grande toile au sol au centre de la nichée (3 × 3 cases) : rayons et spirale."""
    W = 48
    s = Sprite(W, W)
    c = (W - 1) / 2
    for a in range(12):
        ang = a * math.pi / 6
        for r in range(2, 23):
            s.p(int(round(c + math.cos(ang) * r)), int(round(c + math.sin(ang) * r)), (220, 218, 210, 150))
    for r in range(4, 23, 3):
        for k in range(int(2 * math.pi * r)):
            ang = k / r
            s.p(int(round(c + math.cos(ang) * r)), int(round(c + math.sin(ang) * r)), (200, 198, 190, 110))
    return s


def sealed_stairs():
    """Escalier qui descend, scellé par une épaisse toile tant que la reine vit."""
    s = Sprite(16, 16)
    s.r(0, 0, 16, 16, (20, 16, 24, 255))
    for y in (4, 8, 12):
        s.r(1, y, 14, 2, (70, 74, 96, 255))
    for i in range(16):
        s.p(i, i, "silk").p(15 - i, i, "silk").p(i, 8, "silk_d").p(8, i, "silk_d")
    for r in (3, 6):
        for k in range(24):
            ang = k * math.pi / 12
            s.p(int(round(8 + math.cos(ang) * r)), int(round(8 + math.sin(ang) * r)), "silk_l")
    return s


if __name__ == "__main__":
    # Plan : antichambre 5 × 5 à gauche, couloir, nichée 13 × 10 à droite.
    IW, IH = 22, 12
    W, H = (IW + 2) * T, (IH + 2) * T
    xs, ys = grid(W, H)
    base = walls(IW, IH)
    fl = floor_b(xs, ys)
    def carve(x0, y0, w, h, dark=1.0):
        base[(y0 + 1) * T:(y0 + 1 + h) * T, (x0 + 1) * T:(x0 + 1 + w) * T] = fl[(y0 + 1) * T:(y0 + 1 + h) * T, (x0 + 1) * T:(x0 + 1 + w) * T] * dark
    base[:] = base * 0.55
    carve(0, 4, 5, 5)                       # antichambre
    carve(5, 6, 3, 1, 0.8)                  # couloir
    carve(8, 1, 14, 11, 0.62)               # nichée (sombre)
    room = to_img(np.clip(base, 0, 255)).convert("RGBA")

    def put(sp, cx, cy, ox=0, oy=0):
        im = sp.img() if hasattr(sp, "img") else sp
        room.alpha_composite(im, ((cx + 1) * T + ox, (cy + 1) * T + T - im.height + oy))

    # Antichambre : torche, une cache, et un message gravé.
    d = ImageDraw.Draw(room)
    d.rectangle([(1 + 2) * T + 5, 4 * T + 10, (1 + 2) * T + 10, 4 * T + 16], fill=(255, 150, 60))
    # Nichée : toiles dans les coins, grande toile centrale, colonnes, cocons, restes, coffre, escalier scellé.
    room.alpha_composite(cobweb().img(), (9 * T, 2 * T))
    room.alpha_composite(cobweb().img().transpose(Image.FLIP_LEFT_RIGHT), (22 * T, 2 * T))
    room.alpha_composite(cobweb().img().transpose(Image.FLIP_TOP_BOTTOM), (9 * T, 12 * T))
    room.alpha_composite(cobweb().img().transpose(Image.ROTATE_180), (22 * T, 12 * T))
    room.alpha_composite(web_hub().img(), (14 * T, 5 * T))
    for (x, y) in ((11, 3), (19, 3), (11, 9), (19, 9)):
        d.rectangle([(x + 1) * T + 2, (y + 1) * T + 2, (x + 2) * T - 3, (y + 2) * T - 3], fill=(110, 116, 148), outline=(18, 13, 8))
    for (x, y, b) in ((9, 5, True), (12, 10, False), (20, 6, True), (17, 1, False)):
        put(cocoon(b), x, y)
    room.alpha_composite(skeleton().img(), (10 * T, 8 * T))
    room.alpha_composite(skeleton().img().transpose(Image.FLIP_LEFT_RIGHT), (17 * T, 11 * T + 4))
    room.alpha_composite(sealed_stairs().img(), (22 * T, 7 * T))
    put(chest_sprite(), 21, 9)
    put(giant(), 15, 6, ox=-4, oy=4)
    put(spider("idle", 0), 18, 8)
    # Héros à l'entrée de la nichée (repère d'échelle).
    d.ellipse([9 * T + 4, 7 * T + 4, 10 * T - 4, 8 * T - 4], fill=(240, 240, 230), outline=(18, 13, 8))
    # Légendes.
    f = font(9, False)
    d.text((1 * T + 4, 3 * T + 2), "ANTICHAMBRE", fill=(255, 230, 170), font=f)
    d.text((14 * T, 1 * T + 2), "LA NICHÉE", fill=(255, 230, 170), font=f)
    planche("ÉTAGE 5 — BOSS DE LA SECTION 1 : LA TISSEUSE (proposition v1)", room, [
        ("la Tisseuse (araignée géante, 2 × 2 cases)", [giant().img()]),
        ("cocon : il éclot à mi-vie (2 araignées)", [cocoon(True).img(), cocoon(False).img()]),
        ("grande toile centrale (3 × 3)", [web_hub().img()]),
        ("escalier scellé tant qu'elle vit", [sealed_stairs().img()]),
    ], "art/boss_v1.png", S=3,
        note="Antichambre (torche, repos permis) → couloir → Nichée sombre, colonnes, cocons, restes d'aventuriers, coffre du boss, escalier scellé.")
