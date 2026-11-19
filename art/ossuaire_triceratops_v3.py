import math, sys
import numpy as np
from PIL import Image, ImageDraw

W, H = 204, 112
TONES = {"hi": (250, 243, 222), "base": (228, 215, 184), "mid": (198, 183, 150), "dark": (152, 136, 106)}
OUT = (38, 28, 22)


def bez(p0, p1, p2, n=40):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t * t * p2[0], (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t * t * p2[1]) for t in [i / n for i in range(n + 1)]]


class Canvas:
    def __init__(self):
        self.rgb = np.zeros((H, W, 3), float)
        self.a = np.zeros((H, W), bool)

    def layer(self, draw, far=False, outline=True, tone=None):
        m = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(m)
        draw(d)
        mask = np.array(m) > 0
        def sh(dx, dy):
            r = np.zeros_like(mask)
            ys, yd = (slice(0, H - dy), slice(dy, H)) if dy >= 0 else (slice(-dy, H), slice(0, H + dy))
            xs, xd = (slice(0, W - dx), slice(dx, W)) if dx >= 0 else (slice(-dx, W), slice(0, W + dx))
            r[yd, xd] = mask[ys, xs]
            return r
        k = 0.7 if far else 1.0
        col = np.zeros((H, W, 3))
        col[mask] = TONES["base"]
        br2 = mask & ~sh(-2, -2)
        col[br2] = TONES["mid"]
        br1 = mask & ~sh(-1, -1)
        col[br1] = TONES["dark"]
        tl = mask & ~sh(1, 1)
        col[tl & ~br1] = TONES["hi"]
        # os poreux : quelques points
        yy, xx = np.nonzero(mask)
        for y, x in zip(yy, xx):
            h = (x * 73856093 ^ y * 19349663) & 1023
            if h < 22 and not tl[y, x] and not br1[y, x]:
                col[y, x] = TONES["mid"]
        if tone is not None:
            col[mask] = tone
        col *= k
        if outline:
            ring = ~mask & (sh(1, 0) | sh(-1, 0) | sh(0, 1) | sh(0, -1))
            self.rgb[ring] = OUT
            self.a |= ring
        self.rgb[mask] = col[mask]
        self.a |= mask
        return mask

    def image(self):
        out = np.zeros((H, W, 4), np.uint8)
        out[..., :3] = np.clip(self.rgb, 0, 255)
        out[..., 3] = self.a * 255
        return out


def tube(d, pts, w0, w1):
    """Os en tube qui s'affine : des disques le long du chemin."""
    n = len(pts)
    for i, (x, y) in enumerate(pts):
        r = (w0 + (w1 - w0) * i / max(1, n - 1)) / 2
        d.ellipse((x - r, y - r, x + r, y + r), fill=255)


def limb(d, a, b, c, w0, w1, w2):
    tube(d, bez(a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), b, 20), w0, w1)
    tube(d, bez(b, ((b[0] + c[0]) / 2, (b[1] + c[1]) / 2), c, 20), w1, w2)
    r = w1 / 2 + 1
    d.ellipse((b[0] - r, b[1] - r, b[0] + r, b[1] + r), fill=255)


def build():
    cv = Canvas()
    IRON = (78, 80, 96)
    # monture de fer (derrière tout)
    cv.layer(lambda d: [d.line(seg, fill=255, width=2) for seg in (((62, 106), (62, 86)), ((112, 106), (112, 86)), ((164, 106), (164, 60)))], tone=IRON, outline=False)
    cv.layer(lambda d: [d.line(((52, 86), (72, 86)), fill=255, width=2)], tone=IRON, outline=False)

    # ---- côté lointain : pattes, côtes, corne
    cv.layer(lambda d: limb(d, (118, 74), (110, 88), (116, 100), 6, 5, 4), far=True)
    cv.layer(lambda d: d.polygon([(110, 99), (124, 99), (125, 104), (109, 104)], fill=255), far=True)
    cv.layer(lambda d: limb(d, (172, 52), (178, 78), (171, 96), 8, 6, 5), far=True)
    cv.layer(lambda d: d.polygon([(164, 95), (180, 95), (181, 104), (163, 104)], fill=255), far=True)
    def far_ribs(d):
        for k, x in enumerate(range(108, 158, 5)):
            top = 56 - min(k, 5) * 1.6
            bot = 92 - abs(k - 5) * 1.6
            tube(d, bez((x + 3, top), (x - 2, (top + bot) / 2), (x + 3, bot), 16), 2, 1.5)
    cv.layer(far_ribs, far=True)
    cv.layer(lambda d: tube(d, bez((56, 54), (36, 30), (18, 16), 40), 7, 1.5), far=True)  # corne lointaine

    # ---- queue, colonne et épines
    tail = [(174, 46), (186, 50), (196, 58), (203, 68)]
    cv.layer(lambda d: tube(d, [p for a, b in zip(tail, tail[1:]) for p in bez(a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 1), b, 10)], 6, 2))
    def chevrons(d):
        for (x, y) in ((180, 48), (188, 52), (195, 58)):
            d.line(((x, y + 3), (x - 2, y + 9)), fill=255, width=2)
    cv.layer(chevrons)
    back = [(98, 62), (112, 54), (128, 48), (146, 44), (162, 42), (174, 46)]
    cv.layer(lambda d: tube(d, [p for a, b in zip(back, back[1:]) for p in bez(a, ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 2), b, 10)], 6, 6))
    def spines(d):
        for x in range(104, 176, 6):
            y = 62 - (x - 98) * 0.28 if x < 162 else 42 + (x - 162) * 0.35
            h = 6 + (5 if 146 <= x <= 168 else 2)
            d.line(((x, y - 1), (x + 1, y - h)), fill=255, width=2)
    cv.layer(spines)

    # ---- bassin
    cv.layer(lambda d: d.polygon([(144, 40), (176, 38), (182, 44), (170, 48), (148, 48)], fill=255))
    cv.layer(lambda d: tube(d, bez((168, 48), (176, 58), (184, 66), 14), 5, 3))  # ischion
    cv.layer(lambda d: tube(d, bez((152, 48), (148, 56), (140, 62), 14), 5, 4))  # pubis

    # ---- côtes proches (cage profonde) et ventre
    def ribs(d):
        for k, x in enumerate(range(106, 158, 5)):
            top = 58 - min(k, 5) * 1.6
            bot = 94 - abs(k - 5) * 1.6
            tube(d, bez((x, top), (x - 5, (top + bot) / 2), (x + 1, bot), 18), 3, 2)
    cv.layer(ribs)
    cv.layer(lambda d: tube(d, bez((104, 92), (128, 98), (154, 90), 30), 2, 2), tone=TONES["mid"])

    # ---- omoplate (grande lame sur les côtes de devant)
    cv.layer(lambda d: d.polygon([(100, 56), (112, 54), (118, 80), (112, 86), (104, 82)], fill=255))

    # ---- pattes proches
    cv.layer(lambda d: limb(d, (166, 50), (172, 78), (164, 96), 10, 7, 6))  # fémur, genou, tibia
    cv.layer(lambda d: [d.polygon([(156, 95), (172, 95), (174, 102), (154, 102)], fill=255)])
    cv.layer(lambda d: [tube(d, bez((156 + k * 5, 101), (154 + k * 5, 104), (152 + k * 5, 106), 6), 3, 2) for k in range(4)])  # orteils
    cv.layer(lambda d: limb(d, (112, 78), (102, 90), (108, 101), 8, 6, 5))  # humérus, coude sorti, avant-bras
    cv.layer(lambda d: [d.polygon([(100, 100), (116, 100), (117, 105), (99, 105)], fill=255)])
    cv.layer(lambda d: [tube(d, bez((100 + k * 4, 104), (99 + k * 4, 106), (98 + k * 4, 107), 4), 3, 2) for k in range(5)])

    # ---- cou (vertèbres sous la collerette)
    def neck(d):
        for (x, y) in ((76, 76), (84, 72), (92, 67), (99, 63)):
            d.rounded_rectangle((x - 4, y - 3, x + 4, y + 3), radius=2, fill=255)
    cv.layer(neck)

    # ---- COLLERETTE : bouclier plein, bord d'époccipitaux (petites dents), crête de l'écaille
    frill = [(62, 78), (58, 62), (60, 46), (66, 32), (76, 22), (88, 17), (100, 20), (106, 30), (106, 44), (100, 58), (90, 70), (76, 80)]
    def frill_d(d):
        d.polygon(frill, fill=255)
        for i in range(2, len(frill) - 2):
            (x0, y0), (x1, y1) = frill[i], frill[i + 1]
            for t in (0.25, 0.75):
                x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
                nx, ny = (y1 - y0), -(x1 - x0)
                n = math.hypot(nx, ny) or 1
                nx, ny = nx / n, ny / n
                # la normale vers l'extérieur
                if (x - 84) * nx + (y - 50) * ny < 0:
                    nx, ny = -nx, -ny
                d.polygon([(x - 2 * ny, y + 2 * nx), (x + 2 * ny, y - 2 * nx), (x + 4 * nx, y + 4 * ny)], fill=255)
    fm = cv.layer(frill_d)
    # crête (le bord épaissi de l'écaille) et petites fosses
    ridge = bez((64, 72), (78, 40), (100, 26), 40)
    for (x, y) in ridge:
        xi, yi = int(x), int(y)
        if fm[yi, xi]:
            cv.rgb[yi, xi] = TONES["mid"]
            if fm[yi - 1, xi + 1]:
                cv.rgb[yi - 1, xi + 1] = TONES["hi"]
    for (x, y) in ((86, 36), (94, 44), (80, 52)):
        cv.rgb[y:y + 2, x:x + 3] = TONES["dark"]

    # ---- CRÂNE : face, bec, mâchoire
    face = [(12, 72), (16, 64), (26, 58), (38, 54), (52, 52), (64, 56), (70, 66), (66, 78), (52, 82), (36, 84), (22, 82), (14, 78)]
    cv.layer(lambda d: d.polygon(face, fill=255))
    cv.layer(lambda d: d.polygon([(6, 70), (10, 64), (16, 64), (18, 74), (14, 82), (8, 80), (5, 75)], fill=255))  # bec (rostral)
    cv.layer(lambda d: d.polygon([(16, 82), (58, 80), (68, 86), (58, 92), (32, 94), (20, 90)], fill=255))  # mâchoire
    cv.layer(lambda d: d.polygon([(12, 84), (18, 82), (20, 90), (15, 90)], fill=255))  # prédentaire
    cv.layer(lambda d: d.polygon([(58, 74), (68, 76), (64, 90)], fill=255))  # corne de la joue (jugal)
    # creux : orbite, narine, fenêtre ; ligne des dents ; bout du bec sombre
    def holes(d):
        d.ellipse((46, 58, 55, 66), fill=255)
        d.ellipse((18, 66, 25, 71), fill=255)
        d.ellipse((58, 66, 63, 71), fill=255)
    cv.layer(holes, tone=(56, 44, 36), outline=False)
    for x in range(22, 58, 3):
        cv.rgb[83, x] = (70, 58, 46)
        cv.rgb[84, x:x + 2] = TONES["hi"]
    cv.rgb[70:79, 6:8] = (110, 96, 74)
    cv.rgb[59, 47:54] = TONES["hi"]  # lèvre claire de l'orbite

    # ---- CORNES : la longue de devant (de l'orbite vers l'avant), la courte du nez
    cv.layer(lambda d: tube(d, bez((52, 56), (34, 34), (12, 22), 50), 8, 1.5))
    cv.layer(lambda d: tube(d, bez((24, 62), (22, 54), (17, 48), 20), 6, 2))

    # ---- socle
    cv.layer(lambda d: d.rectangle((50, 106, 192, 111), fill=255), tone=(70, 72, 86))
    return cv.image()


if __name__ == "__main__":
    img = Image.fromarray(build(), "RGBA")
    bg = Image.new("RGBA", img.size, (196, 192, 182, 255))
    bg.alpha_composite(img)
    bg.resize((W * 5, H * 5), Image.NEAREST).save("/tmp/dbg/trike3.png")
