"""Araignée v2 : PLUS ANIMÉE (Thomas, 2026-11-14 : « les sprites de l'araignée ne sont pas assez animés »).

Même dessin que la v1 (validée), mais plus d'images :
- repos : 4 images (les pattes tâtent le sol l'une après l'autre, l'abdomen respire, les crochets bougent) ;
- marche : 4 images (pattes en vagues alternées, le corps tangue d'un pixel) ;
- aux aguets (elle vous a vu et attend) : 2 images, les deux pattes de devant levées qui battent l'air ;
- morsure : 2 images (elle se cabre, puis frappe) ;
- À TERRE (renversée par une poussée) : 2 images, sur le dos, les huit pattes qui gigotent en l'air ;
- morte : celle de la v1.

  python3 art/araignee_v2.py         → art/araignee_v2.png (planche)
  python3 art/araignee_v2.py export  → src/render/sprites/araignee.ts
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import up, font  # noqa: E402
from dortoir_v2 import Sprite  # noqa: E402
from araignee_v1 import spider as spider_v1  # noqa: E402


def leg(s, x0, y0, x1, y1, x2, y2, col="sp"):
    """Comme la v1, mais les pixels hors du dessin sont ignorés (une patte levée peut sortir par le haut)."""
    h, w = s.a.shape[:2]

    def dot(x, y, c):
        if 0 <= x < w and 0 <= y < h:
            s.p(x, y, c)
    for (ax, ay, bx, by) in ((x0, y0, x1, y1), (x1, y1, x2, y2)):
        n = max(abs(bx - ax), abs(by - ay), 1)
        for i in range(n + 1):
            dot(round(ax + (bx - ax) * i / n), round(ay + (by - ay) * i / n), col)
    dot(x1, y1, "sp_h")

# Pattes : (attache y, genou x, genou y, pied x, pied y), côté gauche ; le côté droit en miroir (17 - x).
LEGS = ((4, 3, 1, 0, 3), (6, 2, 4, 0, 8), (8, 3, 7, 1, 12), (9, 5, 10, 3, 14))


def body(s, lift=0, breathe=0, fangs="rest", rear=0):
    """Abdomen (haut, tache rouge), céphalothorax (bas, yeux), crochets. `lift` : le corps monte ; `rear` : se cabre."""
    y = -lift - rear
    s.r(7, 2 + y, 4, 5 + breathe, "sp").r(6, 3 + y, 6, 3 + breathe, "sp").r(7, 2 + y, 2, 1, "sp_l")
    s.r(8, 3 + y, 2, 2, "mark")
    s.r(7, 7 + y + breathe, 4, 3, "sp_l").r(7, 7 + y + breathe, 4, 1, "sp_h")
    ey = 8 + y + breathe
    s.p(7, ey, "eye").p(10, ey, "eye").p(8, ey, "eye_h").p(9, ey, "eye")
    fy = 10 + y + breathe
    if fangs == "open":
        s.p(7, fy, "fang").p(10, fy, "fang").p(7, fy + 1, "fang").p(10, fy + 1, "fang")
    elif fangs == "wide":
        s.p(6, fy, "fang").p(11, fy, "fang").p(6, fy + 1, "fang").p(11, fy + 1, "fang")
    elif fangs == "twitch":
        s.p(8, fy, "fang").p(9, fy, "fang").p(8, fy + 1, "fang")
    else:
        s.p(8, fy, "fang").p(9, fy, "fang")
    s.done()


def legs(s, lift=0, raise_l=(0, 0, 0, 0), raise_r=(0, 0, 0, 0), reach_l=(0, 0, 0, 0), reach_r=(0, 0, 0, 0)):
    """Les huit pattes ; `raise_*` lève le pied (pixels), `reach_*` l'avance vers l'extérieur/le haut."""
    for i, (sy, kx, ky, fx, fy) in enumerate(LEGS):
        rl, rr, al, ar = raise_l[i], raise_r[i], reach_l[i], reach_r[i]
        leg(s, 6, sy - lift, kx, ky - rl - lift, fx - al, fy - rl - al, "sp_h")
        leg(s, 11, sy - lift, 17 - kx, ky - rr - lift, 17 - fx + ar, fy - rr - ar, "sp_h")


def frame(kind, phase=0):
    s = Sprite(18, 16)
    if kind == "dead":
        return spider_v1("dead")
    if kind == "prone":
        # Sur le dos : le ventre pâle, les pattes en l'air qui gigotent (deux images).
        s.r(4, 14, 10, 2, "shadow")
        s.r(6, 8, 6, 5, "sp_l").r(7, 7, 4, 1, "sp_l").r(7, 13, 4, 1, "sp").r(8, 9, 2, 2, "mark")
        s.p(8, 12, "fang").p(9, 12, "fang")
        s.done()
        for i, x in enumerate((6, 7, 10, 11)):
            w = (i + phase) % 2
            side = -1 if x < 9 else 1
            leg(s, x, 8, x + side * (2 + w), 5 - w, x + side * (3 - w), 2 + w, "sp_h")
        for i, x in enumerate((6, 11)):
            w = (i + phase + 1) % 2
            side = -1 if x < 9 else 1
            leg(s, x, 11, x + side * 3, 10 - w, x + side * 5, 8 + w, "sp_h")
        return s
    s.r(3, 14, 12, 2, "shadow")
    if kind == "idle":
        # Une patte après l'autre tâte le sol ; l'abdomen gonfle d'un pixel une image sur deux ; crochets qui frémissent.
        rl = [0, 0, 0, 0]
        rr = [0, 0, 0, 0]
        (rl if phase < 2 else rr)[(phase * 3) % 4] = 1
        body(s, breathe=1 if phase in (1, 2) else 0, fangs="twitch" if phase == 3 else "rest")
        legs(s, raise_l=rl, raise_r=rr)
    elif kind == "walk":
        # Démarche en vagues : pattes 1 et 3 d'un côté avec 2 et 4 de l'autre, sur quatre temps ; le corps tangue.
        a = (1, 0, 1, 0)
        b = (0, 1, 0, 1)
        up_l = [a, (0, 0, 0, 0), b, (0, 0, 0, 0)][phase]
        up_r = [b, (0, 0, 0, 0), a, (0, 0, 0, 0)][phase]
        reach = [(1, 0, 1, 0), (0, 0, 0, 0), (0, 1, 0, 1), (0, 0, 0, 0)][phase]
        body(s, lift=1 if phase in (0, 2) else 0)
        legs(s, lift=1 if phase in (0, 2) else 0, raise_l=up_l, raise_r=up_r, reach_l=reach, reach_r=tuple(1 - r if any(reach) else 0 for r in reach))
    elif kind == "alert":
        # Aux aguets : les deux pattes de devant levées, qui battent l'air ; crochets ouverts.
        body(s, rear=1, fangs="open")
        legs(s, raise_l=(3 + phase, 0, 0, 0), raise_r=(3 + (1 - phase), 0, 0, 0), reach_l=(1, 0, 0, 0), reach_r=(1, 0, 0, 0))
    elif kind == "bite":
        if phase == 0:
            # Elle se cabre, crochets écartés.
            body(s, rear=2, fangs="wide")
            legs(s, raise_l=(3, 1, 0, 0), raise_r=(3, 1, 0, 0), reach_l=(1, 0, 0, 0), reach_r=(1, 0, 0, 0))
        else:
            # Elle frappe : le corps plonge, crochets fermés en avant.
            body(s, lift=-1, fangs="open")
            legs(s, lift=-1, reach_l=(0, 1, 1, 0), reach_r=(0, 1, 1, 0))
    return s


FRAMES = {
    "idle0": ("idle", 0), "idle1": ("idle", 1), "idle2": ("idle", 2), "idle3": ("idle", 3),
    "walk0": ("walk", 0), "walk1": ("walk", 1), "walk2": ("walk", 2), "walk3": ("walk", 3),
    "alert0": ("alert", 0), "alert1": ("alert", 1),
    "bite": ("bite", 1), "bite0": ("bite", 0), "bite1": ("bite", 1),
    "prone0": ("prone", 0), "prone1": ("prone", 1),
    "dead": ("dead", 0),
}


def encode(im):
    letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJ"
    palette = {}
    rows = []
    for y in range(im.height):
        row = ""
        for x in range(im.width):
            r, g, b, a = im.getpixel((x, y))
            if a == 0:
                row += "."
                continue
            key = "#%02x%02x%02x" % (r, g, b)
            if key not in palette.values():
                palette[letters[len(palette)]] = key
            row += next(k for k, v in palette.items() if v == key)
        rows.append(row)
    return palette, rows


def export():
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "render", "sprites", "araignee.ts")
    out = ["// FICHIER GÉNÉRÉ par art/araignee_v2.py (export) : ne pas modifier à la main.",
           "/** Araignée v2 (Thomas, 2026-11-14 : « pas assez animée ») : repos ×4, marche ×4, aux aguets ×2, morsure ×2, à terre ×2, morte. */",
           "export const ARAIGNEE: Record<string, { rows: string[]; palette: Record<string, string> }> = {"]
    for name, (kind, phase) in FRAMES.items():
        palette, rows = encode(frame(kind, phase).img())
        out.append(f"  {name}: {{ palette: {json.dumps(palette)}, rows: [")
        out += [f'    "{r}",' for r in rows]
        out.append("  ] },")
    out.append("};")
    open(path, "w").write("\n".join(out) + "\n")
    print("src/render/sprites/araignee.ts", len(FRAMES), "images")


def sheet():
    S = 6
    groups = [("Repos (4)", ["idle0", "idle1", "idle2", "idle3"]), ("Marche (4)", ["walk0", "walk1", "walk2", "walk3"]),
              ("Aux aguets (2) · Morsure (2)", ["alert0", "alert1", "bite0", "bite1"]), ("À terre (2) · Morte", ["prone0", "prone1", "dead"])]
    W = 40 + 4 * 140
    im = Image.new("RGB", (W, 70 + len(groups) * 175), (26, 20, 14))
    d = ImageDraw.Draw(im)
    d.text((W // 2, 24), "ARAIGNÉE v2 — plus animée (même dessin que la v1)", fill=(255, 243, 200), font=font(15), anchor="mm")
    for g, (label, names) in enumerate(groups):
        y = 55 + g * 175
        d.text((24, y), label, fill=(255, 220, 160), font=font(13))
        for i, name in enumerate(names):
            kind, phase = FRAMES[name]
            sp = up(frame(kind, phase).img(), S)
            bg = Image.new("RGB", (126, 126), (70, 61, 82))
            bg.paste(sp, ((126 - sp.width) // 2, 126 - sp.height - 6), sp)
            im.paste(bg, (24 + i * 140, y + 22))
            d.text((24 + i * 140, y + 152), name, fill=(200, 190, 170), font=font(11, False))
    im.save(os.path.join(os.path.dirname(os.path.abspath(__file__)), "araignee_v2.png"))
    print("art/araignee_v2.png", im.size)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        export()
    else:
        sheet()
