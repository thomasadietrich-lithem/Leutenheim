"""Planche « carillon_v2 » (Thomas, 2026-11-16 : « ça fait un peu trop cloche et pas assez champi »). PROPOSITION.

Le Carillon redevient un CHAMPIGNON : il pousse de la voûte, tête en bas (pied fibreux avec son anneau, qui sort du
plafond), son chapeau en cloche n'a plus d'anneaux de bronze mais des STRIES qui rayonnent, un BORD irrégulier et
déchiré, des LAMELLES qui pendent dessous ; seul son son rappelle la cloche. Trois déclinaisons, à choisir :
  A. Coprin : chapeau pâle et strié, bord qui noircit et goutte d'encre (le coprin chevelu).
  B. Amanite : chapeau violet sombre couvert de verrues blanches, lambeaux de voile au bord.
  C. Mycène lumineuse : chapeau bleu-vert translucide qui luit, stries claires, lamelles visibles par transparence.
  python3 art/carillon_v2.py → art/carillon_v2.png
"""
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from carillon_v1 import stump, waves  # noqa: E402
from champi_salles_v1 import S  # noqa: E402
from pix import font, hash2, up  # noqa: E402

GLOW = (110, 236, 210)
GLOW_D = (52, 150, 134)
CLAP = [(236, 246, 160), (196, 214, 96), (128, 156, 56)]
STEM = [(232, 224, 206), (196, 186, 168), (150, 140, 128)]
GILL = [(214, 176, 132), (160, 124, 92), (40, 28, 34)]
STAR = (255, 226, 122)

STYLES = {
    "A": {  # Coprin
        "cap": [(242, 236, 222), (214, 204, 186), (176, 164, 150), (128, 116, 112), (84, 74, 78)],
        "top": (150, 112, 92), "stripe": (150, 138, 128), "edge": (40, 32, 40), "drip": True,
    },
    "B": {  # Amanite violette
        "cap": [(170, 112, 150), (130, 80, 120), (98, 58, 96), (70, 40, 72), (44, 26, 48)],
        "top": (60, 34, 62), "stripe": None, "edge": (226, 214, 200), "warts": True,
    },
    "C": {  # Mycène lumineuse
        "cap": [(178, 250, 230), (120, 220, 196), (76, 170, 156), (46, 120, 116), (28, 76, 80)],
        "top": (36, 92, 92), "stripe": (200, 255, 238), "edge": (120, 230, 206), "translucent": True,
    },
}


def half_width(t):
    if t < 0.16:
        return 11 * math.sqrt(max(0.0, t) / 0.16)
    return 11 + 8 * ((t - 0.16) / 0.84) ** 1.4 + 3 * max(0.0, (t - 0.82) / 0.18) ** 2


def champi_bell(style="A", sway=0.0, ring=False, clapper=True, cracked=False, stunned=False):
    st = STYLES[style]
    cap = st["cap"]
    s = S(48, 62)
    cx, top, base = 24, 12, 44
    # Le PIED qui sort de la voûte (le champignon pousse tête en bas), fibreux, avec son ANNEAU.
    for y in range(0, top + 2):
        w = 3 if y < top - 4 else 4
        for x in range(cx - w, cx + w + 1):
            k = 0 if x < cx - 1 else 1 if x < cx + 2 else 2
            if (x + y * 3) % 7 == 0:
                k = min(2, k + 1)
            s.p(x, y, STEM[k])
    for x in range(cx - 6, cx + 7):  # l'anneau, la petite jupe du pied
        s.p(x, 5, STEM[1] if x < cx + 3 else STEM[2]).p(x, 6, STEM[2] if (x % 2) else STEM[1])
    for x, y in ((cx - 8, 1), (cx - 7, 2), (cx + 8, 0), (cx + 9, 2), (cx - 10, 0)):  # mycélium dans la voûte
        s.p(x, y, STEM[0])
    # Le bord du chapeau : irrégulier, avec des déchirures.
    def edge_y(x):
        e = base + round(1.6 * math.sin(x * 0.85) + 1.2 * math.sin(x * 0.37 + 1.3))
        if hash2(x // 3, 1, 7) > 0.8:
            e -= 2  # une encoche
        return e

    # Le chapeau.
    for y in range(top, base + 4):
        t = min(1.0, (y - top) / (base - top))
        hw = half_width(t)
        off = sway * t * t
        for x in range(48):
            dx = x + 0.5 - (cx + off)
            if abs(dx) > hw or y > edge_y(x):
                continue
            u = dx / max(1, hw)
            k = 1 + (u > 0.3) + (u > 0.72) - (u < -0.5)
            k = max(0, min(4, k))
            c = cap[k]
            # Le sommet plus foncé (le « bouton »).
            if t < 0.2 and abs(u) < 0.6:
                c = st["top"] if hash2(x, y, 3) > 0.35 else cap[min(4, k + 1)]
            # Stries qui rayonnent du sommet vers le bord.
            if st.get("stripe") and t > 0.25 and (abs((u * 7 + 20) % 1 - 0.5) < 0.09):
                c = st["stripe"]
            # Grain de la chair.
            elif hash2(x, y, 41) > 0.9:
                c = cap[min(4, k + 1)]
            s.p(x, y, c)
    # Le bord : noirci (coprin), clair (amanite), lumineux (mycène).
    for x in range(48):
        ey = edge_y(x)
        dx = x + 0.5 - (cx + sway)
        if abs(dx) <= half_width(1.0):
            s.p(x, ey, st["edge"])
            if st.get("drip") and hash2(x, 2, 11) > 0.82:
                s.p(x, ey + 1, st["edge"]).p(x, ey + 2, st["edge"])  # gouttes d'encre
    # Les LAMELLES qui pendent sous le bord.
    hw = half_width(1.0)
    for x in range(48):
        dx = x + 0.5 - (cx + sway)
        if abs(dx) > hw - 2:
            continue
        ey = edge_y(x)
        for y in range(ey + 1, ey + 4):
            s.p(x, y, GILL[2] if (x + 1) % 3 == 0 else GILL[0] if y == ey + 1 else GILL[1])
    # Verrues (amanite).
    if st.get("warts"):
        for i in range(16):
            t = 0.1 + 0.8 * hash2(i, 3, 21)
            y = round(top + t * (base - top))
            x = round(cx + sway * t * t + (hash2(i, 4, 22) * 1.6 - 0.8) * half_width(t))
            s.p(x, y, (236, 226, 214)).p(x + 1, y, (196, 184, 176))
            if hash2(i, 5, 23) > 0.5:
                s.p(x, y - 1, (250, 244, 236))
    # Taches lumineuses (pas sur la mycène : elle luit toute entière).
    if not st.get("translucent"):
        for su, sv in ((-0.45, 0.4), (0.3, 0.55), (-0.2, 0.75), (0.55, 0.8), (0.1, 0.3)):
            y = round(top + sv * (base - top))
            x = round(cx + sway * sv * sv + su * half_width(sv))
            s.p(x, y, GLOW).p(x, y + 1, GLOW_D)
    else:
        for y in range(top + 8, base - 2, 3):
            t = (y - top) / (base - top)
            for su in (-0.55, 0.0, 0.5):
                x = round(cx + sway * t * t + su * half_width(t))
                s.p(x, y, (232, 255, 246))
    # Le battant : une grosse boule de spores, au bout d'une fibre, sous les lamelles.
    bx = round(cx + sway * 1.2)
    if clapper:
        s.line(bx, base + 3, bx, base + 8, STEM[2])
        s.ell(bx + 0.5, base + 11, 4, 4, CLAP[1], shade=CLAP[2], light=CLAP[0])
        s.p(bx - 1, base + 9, (255, 255, 230))
    else:
        for i, ddx in enumerate((-1, 0, 1)):
            s.line(bx, base + 3, bx + ddx * 2, base + 7 + i % 2, STEM[2])
    if ring:
        for side in (-1, 1):
            for k in range(3):
                x = round(cx + sway + side * (hw + 2 + k * 2))
                s.line(x, base - 8 + k, x, base - 4 + k, STAR if k == 0 else GLOW)
    if cracked:
        for (x0, y0), (x1, y1) in (((cx - 6, top + 8), (cx - 4, top + 14)), ((cx - 4, top + 14), (cx - 8, top + 22)), ((cx + 8, top + 18), (cx + 11, top + 26))):
            s.line(x0, y0, x1, y1, (24, 16, 22))
    if stunned:
        for i in range(3):
            a = i * 2.1 + 0.6
            x = round(cx + 9 * math.cos(a))
            y = round(top - 1 + 2 * math.sin(a))
            s.p(x, y, STAR).p(x + 1, y, STAR).p(x, y - 1, STAR).p(x, y + 1, STAR)
    return s.done()


def champi_dead(style="A"):
    """Vaincu : le pied a cédé, le chapeau est tombé de côté, fendu ; le battant a roulé."""
    st = STYLES[style]
    cap = st["cap"]
    s = S(48, 62)
    for y in range(0, 16):
        for x in range(22, 27):
            s.p(x, y, STEM[0] if x < 24 else STEM[2])
    s.line(23, 16, 21, 19, STEM[1]).line(25, 16, 26, 20, STEM[1])
    s.ell(22, 47, 19, 9, cap[1], shade=cap[3], light=cap[0])
    s.ell(22, 44, 8, 4, st["top"])
    for x in range(6, 40, 4):
        s.line(x, 44, x + 1, 52, st["stripe"] or cap[2])
    s.ell(38, 47, 4, 8, GILL[1])
    for y in range(40, 55, 2):
        s.p(37, y, GILL[2])
    s.line(10, 43, 16, 49, (24, 16, 22)).line(16, 49, 13, 53, (24, 16, 22))
    if st.get("drip"):
        for x in (8, 15, 29, 33):
            s.p(x, 56, st["edge"]).p(x, 57, st["edge"])
    s.ell(44.5, 55, 3, 3, CLAP[2], shade=(80, 96, 40))
    return s.done()


def export():
    """Les images du jeu (version A, Thomas : « A fonce ») → src/render/sprites/carillon.ts."""
    from carillon_v1 import stump
    frames = {
        "idle0": champi_bell("A", -1), "idle1": champi_bell("A", 0), "idle2": champi_bell("A", 1),
        "warn0": champi_bell("A", -4), "warn1": champi_bell("A", 4),
        "ring0": champi_bell("A", -3, ring=True), "ring1": champi_bell("A", 3, ring=True),
        "false": champi_bell("A", 0, cracked=True, stunned=True),
        "cracked0": champi_bell("A", -1, cracked=True), "cracked1": champi_bell("A", 1, cracked=True),
        "noclap0": champi_bell("A", -1, clapper=False), "noclap1": champi_bell("A", 1, clapper=False),
        "noclapCracked": champi_bell("A", 0, clapper=False, cracked=True),
        "dead": champi_dead("A"),
        "souche": stump(),
    }
    letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
    palette = {}
    out = {}
    for name, sp in frames.items():
        im = sp.img()
        rows = []
        for y in range(im.height):
            row = ""
            for x in range(im.width):
                r, g, b, a = im.getpixel((x, y))
                if a == 0:
                    row += "."
                    continue
                key = "#%02x%02x%02x" % (r, g, b)
                if key not in palette:
                    palette[key] = letters[len(palette)]
                row += palette[key]
            rows.append(row)
        out[name] = rows
    lines = ["// FICHIER GÉNÉRÉ par art/carillon_v2.py (export) : ne pas modifier à la main.",
             "/** Le Carillon (version A, coprin) et la souche de pierre de sa grotte. */",
             "export const CARILLON_PALETTE: Record<string, string> = {" + ", ".join('"%s": "%s"' % (v, k) for k, v in palette.items()) + "};",
             "export const CARILLON: Record<string, string[]> = {"]
    for name, rows in out.items():
        lines.append("  %s: [%s]," % (name if name != "false" else '"false"', ", ".join('"%s"' % r for r in rows)))
    lines.append("};")
    path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "src", "render", "sprites", "carillon.ts")
    open(path, "w").write("\n".join(lines) + "\n")
    print("carillon.ts", len(palette), "couleurs")


def main():
    W, H = 900, 1010
    sheet = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 22), "LE CARILLON v2 — plus champignon : il pousse de la voûte, tête en bas", fill=(255, 243, 200), font=font(15), anchor="mm")
    names = {"A": "A. Coprin (pâle, strié, bord d'encre)", "B": "B. Amanite (violet, verrues blanches)", "C": "C. Mycène lumineuse (translucide)"}
    for i, style in enumerate("ABC"):
        y = 50 + i * 315
        d.text((30, y), names[style], fill=(255, 243, 200), font=font(13), anchor="lm")
        x = 30
        for label, im in (("repos", champi_bell(style, -1)), ("il sonne", champi_bell(style, 3, ring=True)), ("sonné faux", champi_bell(style, 0, cracked=True, stunned=True)), ("battant cassé", champi_bell(style, 0, clapper=False))):
            a = up(im.img(), 4)
            sheet.paste((70, 61, 82), (x - 4, y + 14, x + a.width + 4, y + 22 + a.height))
            sheet.paste(a, (x, y + 18), a)
            d.text((x + a.width // 2, y + 30 + a.height), label, fill=(210, 200, 180), font=font(11, False), anchor="mm")
            x += a.width + 24
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "carillon_v2.png")
    sheet.save(out)
    print(out)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        export()
    else:
        main()
