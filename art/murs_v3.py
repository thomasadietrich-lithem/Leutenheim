"""Planche « murs v3 », piste A retenue par Thomas (2026-11-12) : vue de dessus, PAS de piliers ; les T et les X
s'épousent (les assises se croisent en harpe) ; tuiles d'EXTRÉMITÉ à côté des portes et en bout de mur ; moins de
répétition, plus de continuité.

Principe : les briques ne sont pas dessinées case par case mais sur tout le mur. Chaque assise (3 par épaisseur de
mur) est une longue rangée de briques de longueurs tirées au hasard (fixe pour une position donnée) ; une brique
peut donc chevaucher deux cases, et deux cases ne sont jamais pareilles. Aux angles, aux T et aux X, on décide
seulement QUELLE assise passe dessus, en alternant (harpe). La mousse suit des taches continues, pas les cases.

`python3 art/murs_v3.py` écrit art/murs_v3.png.
"""
from PIL import Image, ImageDraw, ImageFont

T = 16
PLAN = [
    "########################",
    "#..........#...........#",
    "#..........#...........#",
    "#..........D.....#.....#",
    "#..........#.....#.....#",
    "#####D######.....#.....#",
    "#..........#.....#######",
    "#......................#",
    "#..........#...........#",
    "#####.##########D#######",
    "#..........#...........#",
    "#..........#...........#",
    "#..........D...........#",
    "#..........#...........#",
    "########################",
]

COL = {
    "mortar": (66, 62, 78), "hi": (176, 180, 208), "sh": (22, 19, 30),
    "m0": (44, 70, 30), "m1": (74, 112, 40), "m2": (118, 160, 56),
    "f1": (70, 63, 76), "fl": (50, 45, 58), "dust": (86, 76, 72), "f2": (80, 72, 86),
    "wood": (120, 78, 40), "wood2": (86, 54, 26), "iron": (60, 62, 78), "gold": (240, 192, 80), "dark": (12, 10, 16),
}


def hsh(*a):
    n = 2166136261
    for v in a:
        n = ((n ^ (v & 0xFFFFFFFF)) * 16777619) & 0xFFFFFFFF
    n ^= n >> 13
    n = (n * 1274126177) & 0xFFFFFFFF
    return ((n ^ (n >> 16)) & 0xFFFF) / 0xFFFF


def band(k):
    return 0 if k < 5 else 1 if k < 11 else 2


class Walls:
    def __init__(self, plan):
        self.plan = plan
        self.w, self.h = len(plan[0]), len(plan)
        self.cache = {}

    def wall(self, x, y):
        return 0 <= y < self.h and 0 <= x < self.w and self.plan[y][x] == "#"

    def door(self, x, y):
        return 0 <= y < self.h and 0 <= x < self.w and self.plan[y][x] == "D"

    def floor(self, x, y):
        return 0 <= y < self.h and 0 <= x < self.w and self.plan[y][x] in ".D"

    def breaks(self, axis, line, course):
        """Coupures d'une assise : position (en pixels du monde) où une brique finit."""
        key = (axis, line, course)
        if key not in self.cache:
            cuts, p, i = [], -int(12 * hsh(line, course, 7)), 0
            limit = (self.w if axis == "h" else self.h) * T + 16
            while p < limit:
                p += 6 + int(7 * hsh(line, course, i, 3))
                cuts.append(p)
                i += 1
            self.cache[key] = cuts
        return self.cache[key]

    def brick(self, axis, line, course, pos):
        """Numéro de la brique qui couvre ce pixel d'une assise."""
        import bisect
        k = bisect.bisect_right(self.breaks(axis, line, course), pos)
        return (axis, line, course, k)

    def owner(self, x, y, i, j):
        """Pour le pixel (i, j) de la case (x, y) : quelle brique ? None = pas de mur."""
        W = self.wall
        n, e, s, w = W(x, y - 1), W(x + 1, y), W(x, y + 1), W(x - 1, y)
        X, Y = x * T + i, y * T + j
        H = lambda: self.brick("h", y, band(j), X)
        V = lambda: self.brick("v", x, band(i), Y)
        links = n + e + s + w
        horiz = (e or w) and not (n or s)
        vert = (n or s) and not (e or w)
        # Extrémité : bout de mur, ou mur qui touche une porte. Les assises s'arrêtent sur des pierres de harpe
        # (longue, courte, longue), taillées plus claires, sans brique coupée.
        if links <= 1 or horiz or vert:
            if horiz or (links == 1 and (e or w)) or (links == 0):
                end_e = not e
                end_w = not w
                rb = band(j)
                depth = 9 if rb % 2 == 0 else 5
                if end_e and i >= T - depth:
                    return ("jamb", x, y, rb, "e")
                if end_w and i < depth:
                    return ("jamb", x, y, rb, "w")
                return H()
            cb = band(i)
            depth = 9 if cb % 2 == 0 else 5
            if not s and j >= T - depth:
                return ("jamb", x, y, cb, "s")
            if not n and j < depth:
                return ("jamb", x, y, cb, "n")
            return V()
        rb, cb = band(j), band(i)
        if links == 2:
            # Angle : on retourne la case pour la ramener à « vers l'est et vers le sud ». Les assises font des
            # « L » emboîtés ; au coin de chaque L, la brique appartient une fois sur deux à chaque pan (harpe).
            fi = i if e else T - 1 - i
            fj = j if s else T - 1 - j
            r, c = band(fj), band(fi)
            k = min(r, c)
            if r == c:
                return H() if (k + x + y) % 2 == 0 else V()
            return H() if r < c else V()
        if links == 3:
            # T : le pan qui continue reste entier ; la branche vient mordre dedans, une assise sur deux.
            if not (n and s):  # pan horizontal qui continue, branche au sud ou au nord
                stem_side = s
                fj = j if stem_side else T - 1 - j
                r, c = band(fj), band(i)
                deep = (x + y) % 2
                if r == 2 and c == 1:
                    return V()
                if r == 1 and c == 1 and deep:
                    return V()
                return H()
            stem_side = e
            fi = i if stem_side else T - 1 - i
            r, c = band(j), band(fi)
            deep = (x + y) % 2
            if c == 2 and r == 1:
                return H()
            if c == 1 and r == 1 and deep:
                return H()
            return V()
        # X : l'assise du milieu de l'un des deux murs passe tout droit, l'autre mur vient buter dessus en harpe.
        through_v = (x + y) % 2 == 0
        if through_v:
            if cb == 1:
                return V()
            if rb == 1:
                return H()
            return H() if (rb + cb) % 4 == 0 else V()
        if rb == 1:
            return H()
        if cb == 1:
            return V()
        return V() if (rb + cb) % 4 == 0 else H()


def stone_color(bid):
    t = hsh(*[hash(p) & 0xFFFF if isinstance(p, str) else p for p in bid])
    if bid[0] == "jamb":
        base = (132, 136, 166)
        t = 0.5 + t * 0.4
    else:
        base = (100, 104, 134)
    k = 0.82 + 0.34 * t
    return tuple(min(255, int(c * k)) for c in base)


def smooth_noise(X, Y, scale, seed):
    """Bruit lissé (taches continues d'une case à l'autre)."""
    gx, gy = X / scale, Y / scale
    x0, y0 = int(gx // 1), int(gy // 1)
    fx, fy = gx - x0, gy - y0
    fx, fy = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy)
    a = hsh(x0, y0, seed); b = hsh(x0 + 1, y0, seed); c = hsh(x0, y0 + 1, seed); d = hsh(x0 + 1, y0 + 1, seed)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def render(plan, moss=True, grid=False):
    m = Walls(plan)
    W, H = m.w * T, m.h * T
    img = Image.new("RGB", (W, H), COL["dark"])
    px = img.load()
    ids = [[None] * W for _ in range(H)]
    for y in range(m.h):
        for x in range(m.w):
            for j in range(T):
                for i in range(T):
                    X, Y = x * T + i, y * T + j
                    if m.wall(x, y):
                        ids[Y][X] = m.owner(x, y, i, j)
                    elif m.floor(x, y):
                        # sol B simplifié
                        c = COL["f1"]
                        if (i + (y % 2) * 8) % 16 == 0 or j == 0:
                            c = COL["fl"]
                        elif smooth_noise(X, Y, 5, 4) > 0.62:
                            c = COL["dust"]
                        elif hsh(X, Y, 5) < 0.06:
                            c = COL["f2"]
                        px[X, Y] = c
    for Y in range(H):
        for X in range(W):
            b = ids[Y][X]
            if b is None:
                continue
            left = ids[Y][X - 1] if X > 0 else None
            up = ids[Y - 1][X] if Y > 0 else None
            right = ids[Y][X + 1] if X < W - 1 else None
            down = ids[Y + 1][X] if Y < H - 1 else None
            if (left is not None and left != b) or (up is not None and up != b):
                px[X, Y] = COL["mortar"]
                continue
            c = stone_color(b)
            if left is None or up is None or ids[Y][X - 1] != b or ids[Y - 1][X] != b:
                pass
            # arête claire en haut à gauche de la pierre, ombre en bas à droite
            if (X > 1 and ids[Y][X - 2] != b and left == b) or (Y > 1 and ids[Y - 2][X] != b and up == b):
                c = tuple(min(255, int(v * 1.18)) for v in c)
            if (right is not None and right != b) or (down is not None and down != b):
                c = tuple(int(v * 0.72) for v in c)
            if hsh(X, Y, 9) < 0.05:
                c = tuple(int(v * 0.85) for v in c)
            px[X, Y] = c
    # bords côté salle (comme aujourd'hui : clair en haut et à droite, ombre en bas et à gauche)
    for y in range(m.h):
        for x in range(m.w):
            if not m.wall(x, y):
                continue
            for k in range(T):
                if m.floor(x, y - 1): px[x * T + k, y * T] = COL["hi"]
                if m.floor(x + 1, y): px[x * T + 15, y * T + k] = COL["hi"]
                if m.floor(x, y + 1): px[x * T + k, y * T + 15] = COL["sh"]
                if m.floor(x - 1, y): px[x * T, y * T + k] = COL["sh"]
    # mousse : taches continues, surtout dans les joints et au pied des murs
    if moss:
        for Y in range(H):
            for X in range(W):
                b = ids[Y][X]
                if b is None:
                    continue
                n = smooth_noise(X, Y, 9, 21)
                near_floor = any(m.floor((X + dx) // T, (Y + dy) // T) for dx, dy in ((0, 3), (0, -3), (3, 0), (-3, 0)))
                thr = 0.74 - (0.06 if near_floor else 0)
                if n > thr:
                    r = hsh(X, Y, 22)
                    joint = px[X, Y] == COL["mortar"]
                    if joint or r < (n - thr) * 4:
                        px[X, Y] = COL["m1"] if r < 0.55 else COL["m0"] if r < 0.85 else COL["m2"]
    # portes
    for y in range(m.h):
        for x in range(m.w):
            if not m.door(x, y):
                continue
            vertical = m.wall(x, y - 1) and m.wall(x, y + 1)
            for j in range(T):
                for i in range(T):
                    a, b = (j, i) if vertical else (i, j)
                    c = COL["wood"] if (a // 3) % 2 else COL["wood2"]
                    if b in (3, 12):
                        c = COL["iron"]
                    px[x * T + i, y * T + j] = c
    if grid:
        for Y in range(H):
            for X in range(W):
                if (X % T == 0 or Y % T == 0) and ids[Y][X] is not None and (X + Y) % 2 == 0:
                    px[X, Y] = (255, 90, 90)
    return img


def strip(n):
    """Un long mur droit, pour montrer qu'aucune case ne se répète."""
    return ["#" * n, "." * n]


def main():
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 17)
    plan = render(PLAN)
    big = plan.resize((plan.width * 2, plan.height * 2), Image.NEAREST)

    def crop(cx, cy, w=3, h=3, s=5):
        c = plan.crop(((cx - 1) * T, (cy - 1) * T, (cx - 1 + w) * T, (cy - 1 + h) * T))
        return c.resize((c.width * s, c.height * s), Image.NEAREST)

    zooms = [("X", crop(11, 9)), ("T", crop(11, 5)), ("Angle", crop(17, 6)), ("À côté d'une porte", crop(11, 3))]
    wall_strip = render(["." * 14] + strip(14))
    grid_strip = render(["." * 14] + strip(14), grid=True)
    ws = wall_strip.resize((wall_strip.width * 3, wall_strip.height * 3), Image.NEAREST)
    gs = grid_strip.resize((grid_strip.width * 3, grid_strip.height * 3), Image.NEAREST)

    pad = 24
    zw = sum(z.width for _, z in zooms) + pad * (len(zooms) - 1)
    Wd = max(big.width, zw, ws.width) + pad * 2
    Hd = 50 + big.height + 60 + max(z.height for _, z in zooms) + 40 + 50 + ws.height + gs.height + 40 + pad
    out = Image.new("RGB", (Wd, Hd), (26, 22, 30))
    d = ImageDraw.Draw(out)
    y = 14
    d.text((pad, y), "Murs v3 : joints gris foncé, assises croisées, extrémités", font=font, fill=(240, 220, 170))
    y += 40
    out.paste(big, (pad, y))
    y += big.height + 20
    x = pad
    for t, z in zooms:
        d.text((x, y), t, font=small, fill=(220, 210, 190))
        out.paste(z, (x, y + 24))
        x += z.width + pad
    y += max(z.height for _, z in zooms) + 44
    d.text((pad, y), "Continuité : les briques chevauchent les cases, aucune case ne se répète (en rouge : le bord des cases)", font=small, fill=(220, 210, 190))
    y += 28
    out.paste(ws, (pad, y))
    y += ws.height + 6
    out.paste(gs, (pad, y))
    out.save("art/murs_v3.png")


if __name__ == "__main__":
    main()
