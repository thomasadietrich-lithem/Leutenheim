"""Étage du boss de la section 1, v2 (Thomas, 2026-11-11 : « beaucoup beaucoup plus de toile, une salle plus grande,
des couloirs autour ; marcher sur une toile ralentit ; il faut la faire avancer et reculer »).

Plan : antichambre → couloir → ANNEAU de couloirs (2 cases de large) qui fait le tour de la NICHÉE (20 × 14) ; six
brèches relient l'anneau à la salle. Nappes de toile partout (salle et anneau), grande toile centrale tenue par quatre
AMARRES accrochées aux colonnes. Écrit art/boss_v2.png. Lancer depuis la racine du dépôt.
"""
import os, sys, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
from pix import grid, to_img, font, hash2
from dortoir_v2 import Sprite, C, T, walls
from sols_v1 import floor_b
from trainards_v2 import skeleton
from araignee_v1 import giant, spider
from salles_v1 import chest_sprite
from planche import planche
from boss_v1 import cocoon, web_hub, sealed_stairs


def web_cell(seed):
    """Nappe de toile au sol, une case : 3 à 4 fils qui traversent la case et se raccordent aux voisines."""
    s = Sprite(16, 16)
    pts = [(0, 3 + seed % 9), (15, 2 + (seed * 7) % 11), (3 + (seed * 5) % 10, 0), (2 + (seed * 3) % 12, 15)]
    cx, cy = 5 + seed % 6, 5 + (seed * 11) % 6
    for (px, py) in pts:
        n = max(abs(px - cx), abs(py - cy))
        for k in range(n + 1):
            s.p(int(round(cx + (px - cx) * k / n)), int(round(cy + (py - cy) * k / n)), (226, 222, 214, 120))
    for r in (2, 4):
        for k in range(16):
            a = k * math.pi / 8
            s.p(int(round(cx + math.cos(a) * r)), int(round(cy + math.sin(a) * r)), (240, 238, 230, 90))
    return s


def egg_sac():
    """Sac d'œufs collé au sol : grappe d'œufs ronds dans la soie. Il éclot (2 araignées) quand la reine est à mi-vie."""
    s = Sprite(16, 14)
    s.r(2, 12, 12, 2, "shadow")
    for (x, y, r) in ((5, 8, 3), (10, 8, 3), (7.5, 5, 3), (8, 10, 2.5)):
        for yy in range(14):
            for xx in range(16):
                if (xx - x) ** 2 + (yy - y) ** 2 <= r * r:
                    s.p(xx, yy, "silk_l" if xx < x - 1 else "egg" if xx < x + 1.5 else "silk_d")
    s.done()
    return s


def anchor():
    """Amarre : épais faisceau de soie noué autour d'une colonne. À couper pour faire tomber la grande toile."""
    s = Sprite(16, 16)
    s.r(3, 2, 10, 12, (110, 116, 148, 255))
    for y in (4, 7, 10):
        s.r(2, y, 12, 2, "silk")
        s.r(2, y + 1, 12, 1, "silk_d")
    s.done()
    return s


def anchor_bands():
    """Amarre posée SUR la colonne du jeu (le dessin de la colonne est celui des cases) : bandes de soie nouées."""
    s = Sprite(16, 16)
    for y in (3, 7, 11):
        s.r(1, y, 14, 2, "silk")
        s.r(1, y + 1, 14, 1, "silk_d")
    s.p(14, 5, "silk_l").p(15, 6, "silk_l").p(0, 9, "silk_l")
    return s.done()


def giant_frames():
    """Images de la Tisseuse pour le jeu : repos (respire), marche, morsure, renversée (sur le dos, sonnée), morte."""
    base = giant().img()
    W, H = base.size
    def shift(im, dy):
        out = Image.new("RGBA", (W, H))
        out.alpha_composite(im, (0, dy))
        return out
    bite = base.copy()
    d = ImageDraw.Draw(bite)
    d.rectangle([15, 27, 17, 32], fill=(236, 226, 196, 255))
    d.rectangle([22, 27, 24, 32], fill=(236, 226, 196, 255))
    flipped = base.transpose(Image.FLIP_TOP_BOTTOM)
    dead = Image.eval(flipped, lambda v: v)
    a = np.array(dead).astype(float)
    a[..., :3] *= 0.7
    dead = Image.fromarray(a.astype("uint8"), "RGBA")
    return {"idle0": base, "idle1": shift(base, 1), "walk0": shift(base, -1), "walk1": shift(base, 1), "bite": bite,
            "fallen": flipped, "dead": dead}


def export_sprites():
    """Dessins de l'étage du boss pour le jeu (noms = genres de meubles, et images de la Tisseuse)."""
    hub = web_hub().img()
    bones = skeleton().img()
    pad = Image.new("RGBA", (32, 16))
    pad.alpha_composite(bones, (3, 0))
    sprites = {f"tisseuse_{k}": v for k, v in giant_frames().items()}
    sprites.update({f"webN{i}": web_cell(s).img() for i, s in enumerate((5, 38, 71, 13, 52, 90))})
    sprites.update({f"webHub{i}": hub.crop(((i % 3) * 16, (i // 3) * 16, (i % 3) * 16 + 16, (i // 3) * 16 + 16)) for i in range(9)})
    sprites.update({"cocoonA": cocoon(True).img(), "cocoonB": cocoon(False).img(), "eggSac": egg_sac().img(),
                    "anchor": anchor_bands().img(), "sealedStairs": sealed_stairs().img(),
                    "bonesA": pad.crop((0, 0, 16, 16)), "bonesB": pad.crop((16, 0, 32, 16))})
    return sprites


if __name__ == "__main__":
    IW, IH = 35, 20
    W, H = (IW + 2) * T, (IH + 2) * T
    xs, ys = grid(W, H)
    base = walls(IW, IH)
    fl = floor_b(xs, ys)
    def carve(x0, y0, w, h, dark=1.0):
        base[(y0 + 1) * T:(y0 + 1 + h) * T, (x0 + 1) * T:(x0 + 1 + w) * T] = fl[(y0 + 1) * T:(y0 + 1 + h) * T, (x0 + 1) * T:(x0 + 1 + w) * T] * dark
    base[:] = base * 0.55
    carve(0, 7, 5, 5)                                   # antichambre
    carve(5, 9, 2, 1, 0.8)                              # couloir d'accès
    for (x, y, w, h) in ((7, 0, 26, 2), (7, 18, 26, 2), (7, 0, 2, 20), (31, 0, 2, 20)):
        carve(x, y, w, h, 0.5)                          # anneau
    carve(10, 3, 20, 14, 0.62)                          # nichée
    BRECHES = [(9, 5, 1, 2), (9, 13, 1, 2), (30, 8, 1, 2), (17, 2, 2, 1), (14, 17, 2, 1), (24, 17, 2, 1)]
    for b in BRECHES:
        carve(*b, 0.55)
    carve(33, 9, 2, 1, 0.5)                             # alcôve de l'escalier
    room = to_img(np.clip(base, 0, 255)).convert("RGBA")
    d = ImageDraw.Draw(room)

    def put(sp, cx, cy, ox=0, oy=0):
        im = sp.img() if hasattr(sp, "img") else sp
        room.alpha_composite(im, ((cx + 1) * T + ox, (cy + 1) * T + T - im.height + oy))

    def floor_cell(x, y):
        return 10 <= x < 30 and 3 <= y < 17 or (7 <= x < 33 and (y < 2 or y >= 18)) or (0 <= y < 20 and (7 <= x < 9 or 31 <= x < 33)) \
            or any(bx <= x < bx + bw and by <= y < by + bh for (bx, by, bw, bh) in BRECHES)

    PILIERS = [(14, 6), (25, 6), (14, 13), (25, 13)]
    HUB = (18, 8)
    # Nappes de toile : ~60 % de la nichée, ~35 % de l'anneau (bruit : des plaques, pas un semis).
    for y in range(IH):
        for x in range(IW):
            if not floor_cell(x, y) or (x, y) in PILIERS:
                continue
            inroom = 10 <= x < 30 and 3 <= y < 17
            v = hash2(x // 2, y // 2, 7) * 0.6 + hash2(x, y, 3) * 0.4
            if v < (0.62 if inroom else 0.36):
                room.alpha_composite(web_cell(int(hash2(x, y, 9) * 97)).img(), ((x + 1) * T, (y + 1) * T))
    # Amarres : fils de la grande toile aux 4 colonnes.
    hc = ((HUB[0] + 1.5 + 1) * T, (HUB[1] + 1.5 + 1) * T)
    for (px, py) in PILIERS:
        d.line([hc, ((px + 1.5) * T, (py + 1.5) * T)], fill=(240, 236, 226), width=3)
    room.alpha_composite(web_hub().img(), ((HUB[0] + 1) * T, (HUB[1] + 1) * T))
    for (px, py) in PILIERS:
        room.alpha_composite(anchor().img(), ((px + 1) * T, (py + 1) * T))
    # Cocons (proies : elle s'en nourrit pour guérir), sacs d'œufs (éclosent à mi-vie), restes, coffre, escalier.
    for (x, y, b) in ((11, 4, True), (28, 4, False), (11, 15, False), (28, 15, True), (21, 15, False)):
        put(cocoon(b), x, y)
    for (x, y) in ((16, 4), (23, 12)):
        put(egg_sac(), x, y)
    room.alpha_composite(skeleton().img(), (13 * T, 11 * T))
    room.alpha_composite(skeleton().img().transpose(Image.FLIP_LEFT_RIGHT), (27 * T, 2 * T))
    room.alpha_composite(sealed_stairs().img(), (35 * T, 10 * T))
    put(chest_sprite(), 33, 9)
    put(giant(), HUB[0] + 1, HUB[1] + 1, ox=-4, oy=4)
    put(spider("idle", 0), 32, 3)
    # Héros à l'entrée de l'anneau.
    d.ellipse([8 * T + 4, 10 * T + 4, 9 * T - 4, 11 * T - 4], fill=(240, 240, 230), outline=(18, 13, 8))
    # Flèches : elle AVANCE (rouge) puis RECULE (bleu) vers sa toile ou par une brèche dans l'anneau.
    def arrow(pts, col):
        pts = [((x + 1.5) * T, (y + 1.5) * T) for (x, y) in pts]
        for a, b in zip(pts, pts[1:]):
            n = int(math.dist(a, b) // 6)
            for k in range(0, n, 2):
                d.line([(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n),
                        (a[0] + (b[0] - a[0]) * (k + 1) / n, a[1] + (b[1] - a[1]) * (k + 1) / n)], fill=col, width=2)
        (x1, y1), (x2, y2) = pts[-2], pts[-1]
        ang = math.atan2(y2 - y1, x2 - x1)
        d.polygon([(x2, y2), (x2 - 7 * math.cos(ang - 0.5), y2 - 7 * math.sin(ang - 0.5)),
                   (x2 - 7 * math.cos(ang + 0.5), y2 - 7 * math.sin(ang + 0.5))], fill=col)
    arrow([(19, 10), (14, 10), (11, 10)], (230, 70, 50))
    arrow([(20, 9), (26, 9), (29, 9), (31, 9), (31, 4)], (90, 150, 240))
    f = font(9, False)
    d.text((1 * T + 2, 6 * T + 2), "ANTICHAMBRE", fill=(255, 230, 170), font=f)
    d.text((19 * T, 4 * T + 2), "LA NICHÉE", fill=(255, 230, 170), font=f)
    d.text((14 * T, 1 * T + 4), "ANNEAU DE COULOIRS", fill=(255, 230, 170), font=f)
    d.text((11 * T + 4, 9 * T + 2), "avance", fill=(255, 120, 100), font=f)
    d.text((26 * T, 8 * T + 2), "recule", fill=(140, 180, 255), font=f)
    planche("ÉTAGE 5 — LA TISSEUSE (proposition v2) : plus de toile, salle plus grande, couloirs autour", room, [
        ("la Tisseuse (2 × 2 cases)", [giant().img()]),
        ("nappe de toile : ralentit", [web_cell(s).img() for s in (5, 38, 71)]),
        ("amarre de la grande toile", [anchor().img()]),
        ("grande toile (3 × 3)", [web_hub().img()]),
        ("cocon : sa réserve de nourriture", [cocoon(True).img(), cocoon(False).img()]),
        ("sac d'œufs : éclot à mi-vie", [egg_sac().img()]),
        ("escalier scellé", [sealed_stairs().img()]),
    ], "art/boss_v2.png", S=2,
        note="Rouge : elle avance sur ses toiles jusqu'au héros. Bleu : elle recule dans sa toile, ou file par une brèche dans l'anneau et ressort ailleurs.")
