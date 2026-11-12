"""Cloche d'alarme sur son support de bois (Thomas, 2026-11-12 : « si le joueur l'actionne, le niveau d'alerte
augmente ; commentaire qui se moque de lui »). 16 × 26, vue 3/4 ; 3 images : au repos, penchée à gauche, à droite.
`python3 art/cloche_v1.py` écrit art/cloche_v1.png ; `python3 art/cloche_v1.py export` écrit src/render/sprites/cloche.ts."""
import sys
from PIL import Image

PAL = {"K": "#120d08", "W": "#8a6238", "w": "#5a3a1c", "d": "#3a2410", "B": "#d89a3a", "b": "#a86a22", "c": "#6e4416",
       "Y": "#ffe08a", "R": "#c8b088", "r": "#8a7656", "I": "#5a5f74"}


def frame(tilt):
    g = [["."] * 16 for _ in range(26)]

    def put(x, y, c):
        if 0 <= x < 16 and 0 <= y < 26:
            g[y][x] = c
    # poutre du haut et chapeau
    for x in range(1, 15):
        put(x, 2, "K"); put(x, 3, "W"); put(x, 4, "w"); put(x, 5, "K")
    for x in range(0, 16):
        put(x, 1, "K") if 0 < x < 15 else None
    put(0, 2, "K"); put(15, 2, "K"); put(0, 3, "K"); put(15, 3, "K"); put(0, 4, "K"); put(15, 4, "K")
    # montants
    for y in range(5, 23):
        for x, c in ((1, "K"), (2, "W"), (3, "w"), (4, "K"), (11, "K"), (12, "W"), (13, "w"), (14, "K")):
            put(x, y, c)
    # pieds
    for x in range(0, 6):
        put(x, 22, "K"); put(x, 23, "W" if 0 < x < 5 else "K"); put(x, 24, "d" if 0 < x < 5 else "K"); put(x, 25, "K")
    for x in range(10, 16):
        put(x, 22, "K"); put(x, 23, "W" if 10 < x < 15 else "K"); put(x, 24, "d" if 10 < x < 15 else "K"); put(x, 25, "K")
    # crochet de fer
    put(7, 6, "I"); put(8, 6, "I")
    # la cloche (décalée en bas selon l'inclinaison)
    widths = [4, 6, 6, 6, 6, 8, 8, 8, 10]
    shape = [(8 - wd // 2, wd) for wd in widths]  # (gauche, largeur) par rangée, centré sur la poutre
    top = 7
    for r, (l, wdt) in enumerate(shape):
        shift = round(tilt * r / 8)
        y = top + r
        for x in range(l + shift, l + shift + wdt):
            c = "B"
            if x == l + shift + 1:
                c = "Y"
            if x >= l + shift + wdt - 2:
                c = "b"
            put(x, y, c)
        put(l + shift - 1, y, "K"); put(l + shift + wdt, y, "K")
    put(7, 6, "K") if tilt else None
    for x in range(5, 11):
        put(x, top - 1, "K")
    # lèvre de la cloche
    shift = round(tilt * 9 / 8)
    for x in range(2 + shift, 14 + shift):
        put(x, top + 9, "K" if x in (2 + shift, 13 + shift) else "c")
    for x in range(3 + shift, 13 + shift):
        put(x, top + 10, "K")
    # battant et corde (on la tire)
    bx = 7 + round(tilt * 1.2)
    put(bx, top + 10, "I"); put(bx, top + 11, "K")
    for y in range(top + 12, top + 15):
        put(bx + (1 if tilt > 0 and y > top + 12 else -1 if tilt < 0 and y > top + 12 else 0), y, "R")
    put(bx, top + 15, "r")
    return ["".join(r) for r in g]


FRAMES = {"bell": frame(0), "bell1": frame(-2), "bell2": frame(2)}

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        out = "// FICHIER GÉNÉRÉ par art/cloche_v1.py : ne pas modifier à la main.\n"
        out += "/** Cloche d'alarme sur son support (art/cloche_v1.png) : au repos, puis penchée à gauche et à droite quand elle sonne. */\n"
        out += "const PALETTE: Record<string, string> = " + repr(PAL).replace("'", '"') + ";\n\n"
        out += "export const CLOCHE: Record<string, { palette: Record<string, string>; rows: string[] }> = {\n"
        for k, rows in FRAMES.items():
            out += f"  {k}: {{ palette: PALETTE, rows: [\n" + "".join(f'    "{r}",\n' for r in rows) + "  ] },\n"
        out += "};\n"
        open("src/render/sprites/cloche.ts", "w").write(out)
    else:
        S = 12
        img = Image.new("RGB", (3 * 18 * S, 28 * S), "#2a2430")
        for n, rows in enumerate(FRAMES.values()):
            for y, r in enumerate(rows):
                for x, c in enumerate(r):
                    if c in PAL:
                        col = tuple(int(PAL[c][k:k + 2], 16) for k in (1, 3, 5))
                        for yy in range(S):
                            for xx in range(S):
                                img.putpixel((S + n * 18 * S + x * S + xx, S + y * S + yy), col)
        img.save("art/cloche_v1.png")
