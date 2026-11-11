"""Dortoir v3 (Thomas, 2026-11-11, sur la v2 : « Les Schrats, c'est des espèces de gobelins. Faut quelque chose de plus
modeste. Moins propre, bois massif, sans matelas mais paillasse. Des échelles irrégulières. Attention à l'angle : la
caméra n'est ni exactement en face, ni au-dessus. Table ok, bougie : pense à l'animer. Chaise TB. Tapis : le mettre de
travers, en biais ; tapis naze et sale »).

Angle : vue de 3/4 plongeante : on voit autant le dessus des meubles que leur face avant ; les montants de derrière
dépassent derrière la couchette du haut. Sol B (validé). Écrit art/dortoir_v3.png. Lancer depuis la racine du dépôt.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
from pix import hash2, grid, to_img, up, font, outline_mask, fbm
from sols_v1 import floor_b
from dortoir_v2 import Sprite, C, T, OUT, walls, table, chair, chair_fallen, hearth

C.update({
    "oak_d": (52, 32, 16, 255), "oak": (86, 56, 28, 255), "oak_l": (112, 76, 40, 255), "oak_h": (138, 98, 56, 255),
    "hay_d": (120, 98, 52, 255), "hay": (168, 140, 76, 255), "hay_l": (204, 180, 110, 255),
    "rag_d": (62, 58, 52, 255), "rag": (92, 86, 74, 255), "rag_l": (120, 112, 96, 255),
    "dirt": (58, 44, 34, 255),
})


def straw_pallet(s, x0, y0, w, h, seed):
    """Paillasse : un tas de paille irrégulier (bords qui débordent), une vieille couverture grise froissée dessus."""
    for y in range(y0, y0 + h):
        for x in range(x0 - 1, x0 + w + 1):
            edge = x < x0 or x >= x0 + w
            r = hash2(x, y, seed)
            if edge and r > 0.45:
                continue
            c = "hay_l" if r > 0.8 else "hay" if r > 0.3 else "hay_d"
            s.p(x, y, c)
    # Brins qui dépassent en haut.
    for i in range(6):
        x = x0 + int(hash2(i, 9, seed) * w)
        s.p(x, y0 - 1, "hay_l")
    # Couverture froissée sur la moitié droite, plis plus sombres.
    cw = w // 2 + int(hash2(1, 1, seed) * 4)
    cx = x0 + w - cw - 1
    for y in range(y0 + 1, y0 + h):
        for x in range(cx + (y - y0) % 2, x0 + w):
            s.p(x, y, "rag" if hash2(x, y, seed + 1) > 0.25 else "rag_d")
    for x in range(cx + 1, x0 + w, 3):
        s.p(x, y0 + 1, "rag_l")


def bunk_v3(seed=1):
    """Lit superposé de Schrats : bois massif, paillasses, échelle de guingois. 2 cases × 1, déborde de 16 pixels."""
    s = Sprite(36, 34)
    s.r(3, 31, 30, 3, "shadow")
    # Montants de derrière (on les voit dépasser au-dessus de la couchette du haut).
    s.r(3, 0, 3, 8, "oak_d").r(30, 1, 3, 7, "oak_d")
    # Couchette du HAUT : plateau de planches (dessus vu de haut), paillasse, puis la poutre de face.
    s.r(3, 4, 30, 9, "oak")
    for x in range(3, 33, 6):
        s.r(x, 4, 1, 9, "oak_d")
    straw_pallet(s, 5, 5, 26, 7, seed)
    s.r(2, 13, 32, 4, "oak_l").r(2, 13, 32, 1, "oak_h").r(2, 16, 32, 1, "oak_d")
    s.p(9, 14, "oak_d").p(22, 15, "oak_d")  # nœuds du bois
    # Dessous : ombre (on devine l'étage du bas).
    s.r(4, 17, 28, 3, "shadow")
    # Couchette du BAS.
    s.r(3, 19, 30, 6, "oak")
    straw_pallet(s, 5, 19, 26, 6, seed + 7)
    s.r(2, 25, 32, 4, "oak_l").r(2, 25, 32, 1, "oak_h").r(2, 28, 32, 1, "oak_d")
    s.p(14, 26, "oak_d").p(27, 27, "oak_d")
    # Pieds trapus.
    s.r(3, 29, 4, 3, "oak_d").r(29, 29, 4, 3, "oak_d")
    # Montants de devant, épais, un peu inégaux.
    s.r(0, 2, 4, 30, "oak").r(0, 2, 1, 30, "oak_h").r(0, 2, 4, 1, "oak_h")
    s.r(32, 3, 4, 29, "oak").r(32, 3, 1, 29, "oak_h").r(32, 3, 4, 1, "oak_h")
    # Échelle de guingois, posée contre la couchette du haut : deux montants qui ne sont pas parallèles,
    # barreaux à des hauteurs inégales, un barreau cassé.
    for y in range(10, 32):
        for x in (24 + (y - 10) // 8, 30 - (y - 10) // 11):
            s.p(x - 1, y, "oak_d").p(x, y, "hay_l")
    for y, tilt in ((14, 0), (20, 1), (26, 0)):
        for x in range(25 + (y - 10) // 8, 30 - (y - 10) // 11):
            s.p(x, y + (tilt if x > 27 else 0), "hay_l").p(x, y + 1 + (tilt if x > 27 else 0), "oak_d")
    s.p(26, 30, "hay_l").p(27, 30, "hay_l")  # barreau du bas, cassé
    return s.done()


def shabby_rug(angle=-17):
    """Tapis usé et sale, posé de travers : rouge passé, bordure ocre ébréchée, taches, un trou, franges effilochées."""
    w, h = 40, 24
    a = np.zeros((h, w, 4), np.uint8)
    red, red_d, ochre, ochre_d, stain = (122, 58, 50), (92, 40, 36), (150, 118, 60), (110, 84, 44), (60, 40, 30)
    xs, ys = grid(w, h)
    body = np.ones((h, w), bool)
    a[body] = red + (255,)
    border = (xs < 2) | (xs >= w - 2) | (ys < 2) | (ys >= h - 2)
    a[border] = ochre_d + (255,)
    inner = ((xs == 4) | (xs == w - 5)) & (ys >= 4) & (ys < h - 4) | ((ys == 4) | (ys == h - 5)) & (xs >= 4) & (xs < w - 4)
    a[inner] = ochre + (255,)
    # Motif passé au centre.
    cx, cy = w // 2, h // 2
    dia = (np.abs(xs - cx) + np.abs(ys - cy)) == 5
    a[dia] = ochre_d + (255,)
    # Décoloration et taches (bruit).
    fade = fbm(xs, ys, 6, 301, 2)
    a[(fade > 0.62) & ~border] = red_d + (255,)
    blot = fbm(xs, ys, 4, 302, 2) > 0.7
    a[blot] = stain + (255,)
    # Un trou (on voit le sol), bords effilochés, franges.
    hole = ((xs - 29) ** 2 / 9 + (ys - 15) ** 2 / 4) < 1
    a[hole] = 0
    ragged = border & (hash2(xs.astype(int), ys.astype(int), 303) > 0.8)
    a[ragged] = 0
    im = Image.fromarray(a, "RGBA")
    fr = Image.new("RGBA", (w + 6, h), (0, 0, 0, 0))
    fr.alpha_composite(im, (3, 0))
    d = ImageDraw.Draw(fr)
    for y in range(1, h - 1, 2):
        if hash2(y, 1, 304) > 0.3:
            d.point((1, y), (200, 180, 120, 255)); d.point((2, y), (150, 130, 80, 255))
        if hash2(y, 2, 304) > 0.3:
            d.point((w + 4, y), (200, 180, 120, 255)); d.point((w + 3, y), (150, 130, 80, 255))
    return fr.rotate(angle, resample=Image.NEAREST, expand=True)


def candle_frames():
    """Bougie de la table, 3 images qui alternent : la flamme se penche et grandit un peu."""
    frames = []
    for f in range(3):
        s = Sprite(6, 12)
        s.r(2, 5, 2, 7, "sheet_s").r(2, 5, 1, 7, "sheet_w").p(3, 4, "oak_d")
        dx = (0, -1, 1)[f]
        tall = (0, 1, 0)[f]
        s.r(2 + dx, 2 - tall, 2, 2 + tall, "fire").p(2 + dx, 3, "fire_y").p(3 + dx, 1 - tall, "fire_l")
        s.p(2 + dx, 0, "fire_l") if f == 1 else None
        frames.append(s)
    return frames


def table_v3(frame=0):
    """La table validée, avec la bougie animée (image `frame`)."""
    t = table()
    t.a[0:8, 22:26] = 0  # efface l'ancienne bougie
    c = candle_frames()[frame].a
    m = c[..., 3] > 0
    t.a[0:12, 21:27][m[:, :6]] = c[m]
    return t


if __name__ == "__main__":
    IW, IH = 8, 6
    W, H = (IW + 2) * T, (IH + 2) * T
    xs, ys = grid(W, H)
    base = walls(IW, IH)
    fl = floor_b(xs, ys)
    base[T:T + IH * T, T:T + IW * T] = fl[T:T + IH * T, T:T + IW * T]
    base[(IH + 1) * T:, 4 * T:5 * T] = fl[(IH + 1) * T:, 4 * T:5 * T] * 0.7
    room = to_img(base).convert("RGBA")

    def put(sprite, cx, cy, ox=0, oy=0):
        im = sprite.img() if hasattr(sprite, "img") else sprite
        room.alpha_composite(im, (cx * T + ox, cy * T + T - im.height + oy))

    rug = shabby_rug()
    room.alpha_composite(rug, (3 * T - 2, 3 * T - 4))
    room.alpha_composite(hearth().img(), (6 * T, 0))
    put(bunk_v3(1), 1, 1, ox=-2, oy=0)
    put(bunk_v3(2), 3, 1, ox=-2, oy=0)
    put(bunk_v3(3), 1, 4, ox=-2, oy=0)
    put(chair("right"), 6, 4, ox=2, oy=-1)
    put(table_v3(0), 7, 4, ox=-6, oy=-1)
    put(chair("left"), 8, 5, ox=2, oy=-1)
    put(chair_fallen(), 6, 6, ox=0, oy=-1)

    S = 4
    big = up(room.convert("RGB"), S)
    sheet = Image.new("RGB", (big.width + 40, 50 + big.height + 24 + 186), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((sheet.width // 2, 20), "DORTOIR v3 (Schrats) — à valider", fill=(255, 243, 200), font=font(15), anchor="mm")
    sheet.paste(big, (20, 44))
    x, y = 20, 44 + big.height + 24
    pieces = [("lit de Schrats", bunk_v3(1).img()), ("tapis usé, de travers", rug)]
    pieces += [(f"bougie {i + 1}/3", c.img()) for i, c in enumerate(candle_frames())]
    for label, im in pieces:
        im = up(im, 4)
        bw = max(im.width + 12, 70)
        bg = Image.new("RGB", (bw, 150), (70, 61, 82))
        bg.paste(im, ((bw - im.width) // 2, 150 - im.height - 8), im)
        sheet.paste(bg, (x, y))
        d.text((x, y + 156), label, fill=(220, 210, 190), font=font(11, False))
        x += bw + 12
    sheet.save("art/dortoir_v3.png")
    print(sheet.size)
