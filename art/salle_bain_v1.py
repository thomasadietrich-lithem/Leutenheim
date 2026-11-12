"""Salle de bain du Kobold (Thomas, 2026-11-13, « truc fun ») : une petite salle carrelée noir et blanc, un Kobold endormi
dans une baignoire pleine de mousse, une table basse avec des bougies, un tourne-disque qui joue de la musique.
Vue 3/4 comme les autres meubles (ce qui est haut déborde sur la case du dessus), même contour sombre.
`python3 art/salle_bain_v1.py` écrit art/salle_bain_v1.png (planche à valider)."""
import os
import sys

import numpy as np
from PIL import Image

sys.path.insert(0, os.path.dirname(__file__))
from pix import hash2, grid, to_img, hexrgb  # noqa: E402
from dortoir_v2 import Sprite, C, T, walls  # noqa: E402
from planche import planche  # noqa: E402

# Couleurs en plus (émail, mousse, laiton, Kobold, disque).
for k, v in {
    "enamel": "#e8ecf4", "enamel_s": "#b4bccc", "enamel_d": "#7e8698",
    "foam": "#ffffff", "foam_s": "#d6e4f4", "foam_b": "#a8c8ec",
    "brass": "#d6aa54", "brass_d": "#a87c1c", "brass_l": "#f2d27a",
    "scale": "#9cb63e", "scale_d": "#5c7426", "belly": "#dedc92", "horn": "#e6dcc0",
    "vinyl": "#1a1820", "vinyl_l": "#3a3644", "label": "#c83a44",
    "teak": "#6a3e1c", "teak_l": "#8e5a2a", "teak_d": "#40240e",
    "duck": "#ffd84a", "duck_d": "#c89a14", "beak": "#e8782a",
    "note": "#ffe08a", "zzz": "#c8d8ff",
    "wax": "#f4ead0", "wax_s": "#c8b890",
}.items():
    C[k] = hexrgb(v) + (255,)


def checker_floor(xs, ys):
    """Carrelage noir et blanc (carreaux d'une demi-case), joints, usure et quelques carreaux fêlés."""
    cell = 8
    cx, cy = (xs // cell).astype(int), (ys // cell).astype(int)
    lx, ly = xs % cell, ys % cell
    white = ((cx + cy) % 2 == 0)
    tint = 0.94 + 0.08 * hash2(cx, cy, 77)
    out = np.where(white[..., None], np.array(hexrgb("#d8d4cc"), float), np.array(hexrgb("#2a2630"), float))
    out = out * tint[..., None]
    out[(lx == 1) | (ly == 1)] *= 1.06
    joint = (lx == 0) | (ly == 0)
    out[joint] = hexrgb("#55505e")
    # Fêlures sur quelques carreaux blancs.
    crack = white & (hash2(cx, cy, 91) > 0.86) & (np.abs(lx - ly) < 1)
    out[crack] = hexrgb("#8a8490")
    # Un peu de crasse et d'eau près du mur.
    grime = hash2(xs // 2, ys // 2, 13) > 0.93
    out[grime] *= 0.82
    return out


def tub(frame=0, kobold=True):
    """Baignoire à pattes de lion, 2 cases de large : émail blanc, bord épais, mousse qui déborde, le Kobold endormi
    (grosse tête appuyée sur une serviette, cornes, museau, œil fermé), un canard ; `frame` : les bulles bougent."""
    s = Sprite(34, 28)
    s.r(3, 25, 28, 2, "shadow")
    # Pattes dorées.
    for x in (5, 26):
        s.r(x, 22, 3, 4, "brass").p(x, 25, "brass_d").p(x + 2, 25, "brass_d").p(x + 1, 22, "brass_l")
    # Cuve : flanc arrondi.
    s.r(2, 12, 30, 11, "enamel")
    s.r(1, 13, 1, 8, "enamel_s").r(32, 13, 1, 8, "enamel_d")
    s.r(2, 20, 30, 3, "enamel_s").r(3, 23, 28, 1, "enamel_d")
    s.r(4, 14, 5, 1, "foam")
    s.r(28, 14, 2, 7, "enamel_d")
    # Bord supérieur, et l'eau mousseuse dedans.
    s.r(1, 9, 32, 4, "enamel").r(1, 9, 32, 1, "foam").r(1, 12, 32, 1, "enamel_s")
    s.r(3, 8, 28, 3, "foam_s")
    if kobold:
        # Serviette roulée sous la nuque.
        s.r(1, 6, 7, 4, "red").r(1, 6, 7, 1, "red_l").r(1, 9, 7, 1, "red_d")
        # La tête du Kobold, penchée en arrière : cornes, crâne, œil fermé, museau, narine, sourire.
        s.r(4, 3, 9, 7, "scale")
        s.r(4, 9, 9, 1, "scale_d").r(4, 3, 1, 6, "scale_d")
        s.r(12, 5, 5, 4, "belly").r(12, 8, 5, 1, "scale_d").p(16, 5, "scale_d")  # museau
        s.p(15, 6, "vinyl")  # narine
        s.r(8, 5, 3, 1, "vinyl").p(8, 4, "scale_d").p(10, 4, "scale_d")  # paupière fermée
        s.r(12, 8, 3, 1, "belly")  # sourire
        s.r(5, 1, 2, 2, "horn").p(4, 0, "horn").r(9, 1, 2, 2, "horn").p(10, 0, "horn")  # cornes
        s.p(6, 2, "straw_d").p(10, 2, "straw_d")
        # Un bras posé sur le bord, la griffe pendante.
        s.r(15, 9, 6, 2, "scale").r(15, 10, 6, 1, "scale_d").r(20, 11, 2, 2, "scale").p(21, 12, "scale_d")
    # Grosse mousse (devant le cou et dans toute la cuve), qui déborde sur le flanc.
    blobs = [(9, 9, 4), (14, 7, 3), (19, 7, 4), (23, 8, 5), (28, 7, 4), (25, 10, 3), (12, 10, 3), (30, 10, 3)]
    for i, (bx, by, r) in enumerate(blobs):
        dy = 1 if (i + frame) % 3 == 0 else 0
        y = by - dy
        s.r(bx - r // 2, y - r // 2 + 1, r, r - 1, "foam").r(bx - r // 2 + 1, y - r // 2, r - 2, r + 1, "foam")
        s.r(bx - r // 2 + 1, y + r // 2, r - 2, 1, "foam_s").p(bx + r // 2 - 1, y, "foam_b")
    for (bx, by) in [(8, 13), (20, 14), (27, 13)]:
        s.r(bx, by, 2, 2 + (frame + bx) % 2, "foam").p(bx, by + 1, "foam_s")
    # Canard en caoutchouc sur la mousse.
    s.r(25, 3, 5, 3, "duck").r(28, 1, 3, 3, "duck").p(31, 2, "beak").p(29, 2, "vinyl").r(25, 5, 5, 1, "duck_d")
    # Petites bulles qui montent.
    for k, (bx, by) in enumerate([(19, 3), (22, 1), (16, 4)]):
        if (k + frame) % 3 != 2:
            s.p(bx, by - (frame % 2), "foam_b")
    return s.done()


def zzz(frame=0):
    """Les « Z » du dormeur, de plus en plus grands, qui montent (3 images)."""
    s = Sprite(14, 14)
    for i, (x, y, w) in enumerate([(0, 10, 3), (4, 5, 4), (8, 0, 5)][: frame + 1]):
        s.r(x, y, w, 1, "zzz").r(x, y + w - 1, w, 1, "zzz")
        for k in range(1, w - 1):
            s.p(x + w - 1 - k, y + k, "zzz")
    return s.done()


def low_table(frame=0):
    """Table basse (1 case), trois bougies de hauteurs différentes qui vacillent (3 images), cire coulée."""
    s = Sprite(16, 20)
    s.r(1, 18, 14, 2, "shadow")
    s.r(1, 12, 14, 3, "teak_l").r(1, 12, 14, 1, "wood_h").r(1, 14, 14, 1, "teak")
    s.r(2, 15, 2, 4, "teak_d").r(12, 15, 2, 4, "teak_d")
    for i, (x, h) in enumerate([(3, 6), (7, 4), (11, 5)]):
        top = 12 - h
        s.r(x, top, 2, h, "wax").r(x + 1, top, 1, h, "wax_s")
        s.p(x, top + h - 1, "wax_s")
        flick = (i + frame) % 3
        s.p(x, top - 1, "fire_y")
        s.p(x + (1 if flick == 1 else 0), top - 2, "fire" if flick != 2 else "fire_l")
        if flick == 0:
            s.p(x, top - 3, "ember")
    return s.done()


def gramophone(frame=0):
    """Tourne-disque à pavillon de laiton sur un petit meuble de bois (1 case, dépasse d'une demi-case) ; le disque
    tourne (reflet qui avance) et des croches dorées s'échappent du pavillon (3 images)."""
    s = Sprite(18, 30)
    s.r(2, 28, 14, 2, "shadow")
    # Meuble.
    s.r(2, 18, 14, 10, "teak_l").r(2, 18, 14, 1, "wood_h").r(3, 21, 12, 6, "teak").r(8, 23, 2, 1, "brass")
    # Plateau et disque.
    s.r(3, 15, 12, 3, "teak_d")
    s.r(4, 14, 10, 3, "vinyl").r(8, 15, 2, 1, "label")
    s.p(4 + (frame * 3) % 9, 14, "vinyl_l").p(5 + (frame * 3 + 4) % 8, 16, "vinyl_l")
    # Bras.
    s.r(13, 12, 1, 3, "iron_l").p(12, 14, "iron")
    # Pavillon de laiton qui s'évase vers le haut à gauche.
    s.r(11, 9, 2, 6, "brass_d")
    for i, (x, y, w, h) in enumerate([(9, 7, 4, 3), (6, 4, 6, 4), (3, 1, 8, 4)]):
        s.r(x, y, w, h, "brass").r(x, y, w, 1, "brass_l").r(x + w - 1, y, 1, h, "brass_d")
    s.r(4, 2, 5, 2, "brass_d")  # l'intérieur du pavillon
    return s.done()


def notes(frame=0):
    """Croches qui sortent du pavillon et montent en dansant (3 images) : une tête ronde, une hampe, un crochet."""
    s = Sprite(16, 16)
    for k, (x, y) in enumerate([(1, 9), (6, 5), (11, 0)]):
        if k > frame:
            continue
        s.r(x, y + 4, 3, 2, "note").r(x + 2, y, 1, 5, "note").p(x + 3, y + 1, "note").p(x + 4, y + 2, "note")
    return s.done()


def bath_mat():
    """Tapis de bain (à plat) : bleu, frange claire."""
    s = Sprite(16, 10)
    s.r(1, 1, 14, 8, "blue").r(1, 1, 14, 1, "blue_l").r(1, 8, 14, 1, "blue_d")
    for x in range(2, 15, 2):
        s.p(x, 0, "sheet_s").p(x, 9, "sheet_s")
    return s.done(outline=False)


def towel_rack(variant="full"):
    """Porte-serviettes contre le mur : barre de laiton ; « full » : la serviette rayée, la dague et la petite cotte du
    Kobold pendues ; « gear » : il a pris la serviette ; « empty » : plus rien (il a été vaincu)."""
    s = Sprite(16, 24)
    s.r(1, 24 - 2, 14, 2, "shadow")
    s.r(2, 3, 1, 19, "brass_d").r(13, 3, 1, 19, "brass_d").r(2, 3, 12, 1, "brass").r(2, 21, 12, 1, "brass_d")
    if variant == "full":
        s.r(4, 4, 6, 12, "sheet_w").r(4, 8, 6, 2, "red").r(4, 13, 6, 1, "red").r(9, 4, 1, 12, "sheet_s")
    if variant in ("full", "gear"):
        # La petite cotte de mailles et la dague, pendues au crochet de droite.
        s.r(10, 4, 3, 6, "stone_l").p(11, 5, "stone").p(10, 7, "stone").p(12, 8, "stone").r(10, 9, 3, 1, "stone_d")
        s.r(11, 11, 1, 5, "iron_l").r(10, 11, 3, 1, "brass").p(11, 16, "iron")
    return s.done()


EXPORT = {
    **{f"tub{f}": lambda f=f: tub(f) for f in range(3)},
    **{f"tubOut{f}": lambda f=f: tub(f, kobold=False) for f in range(3)},
    **{f"zzz{f}": lambda f=f: zzz(f) for f in range(3)},
    **{f"lowTable{f}": lambda f=f: low_table(f) for f in range(3)},
    **{f"gramophone{f}": lambda f=f: gramophone(f) for f in range(3)},
    **{f"notes{f}": lambda f=f: notes(f) for f in range(3)},
    "rackFull": lambda: towel_rack("full"),
    "rackGear": lambda: towel_rack("gear"),
    "rackEmpty": lambda: towel_rack("empty"),
    "bathMat": bath_mat,
}


def export():
    """Écrit src/render/sprites/bain.ts : lignes de lettres + une palette par dessin."""
    letters = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
    out = "// FICHIER GÉNÉRÉ par art/salle_bain_v1.py export : ne pas modifier à la main.\n"
    out += "/** Salle de bain du Kobold (planche art/salle_bain_v1.png, Thomas 2026-11-13). Noms finissant par 0, 1, 2 : animation. */\n"
    out += "export const BAIN: Record<string, { rows: string[]; palette: Record<string, string> }> = {\n"
    for name, make in EXPORT.items():
        a = make().a
        pal, rows = {}, []
        for y in range(a.shape[0]):
            row = ""
            for x in range(a.shape[1]):
                r, g, b, al = (int(v) for v in a[y, x])
                if al == 0:
                    row += "."
                    continue
                col = "#%02x%02x%02x" % (r, g, b)
                if col not in pal:
                    pal[col] = letters[len(pal)]
                row += pal[col]
            rows.append(row)
        palette = {v: k for k, v in pal.items()}
        out += f"  {name}: {{ palette: " + str(palette).replace("'", '"') + ", rows: [\n" + "".join(f'    "{r}",\n' for r in rows) + "  ] },\n"
    out += "};\n"
    open(os.path.join(os.path.dirname(__file__), "..", "src", "render", "sprites", "bain.ts"), "w").write(out)


if __name__ == "__main__" and len(sys.argv) > 1 and sys.argv[1] == "export":
    export()
elif __name__ == "__main__":
    IW, IH = 5, 4
    W, H = (IW + 2) * T, (IH + 2) * T
    xs, ys = grid(W, H)
    base = walls(IW, IH)
    fl = checker_floor(xs, ys)
    base[T:T + IH * T, T:T + IW * T] = fl[T:T + IH * T, T:T + IW * T]
    base[(IH + 1) * T:, 3 * T:4 * T] = fl[(IH + 1) * T:, 3 * T:4 * T] * 0.7  # l'entrée

    def room_img(frame):
        room = to_img(base).convert("RGBA")

        def put(sp, cx, cy, ox=0, oy=0):
            im = sp.img() if hasattr(sp, "img") else sp
            room.alpha_composite(im, (cx * T + ox, cy * T + T - im.height + oy))

        put(bath_mat(), 2, 3, oy=-3)
        put(towel_rack(), 4, 1, oy=-2)
        put(tub(frame), 1, 2, ox=-1, oy=-1)
        put(zzz(frame), 1, 1, ox=6, oy=-13)
        put(low_table(frame), 3, 3, oy=-1)
        put(gramophone(frame), 5, 2, ox=-1, oy=-1)
        put(notes(frame), 4, 1, ox=8, oy=-6)
        return room

    rooms = [room_img(f) for f in range(3)]
    planche(
        "SALLE DE BAIN DU KOBOLD v1 — à valider (5 × 4 cases)",
        rooms[0],
        [
            ("Baignoire (Kobold endormi, mousse) ×3", [tub(f).img() for f in range(3)]),
            ("Zzz ×3", [zzz(f).img() for f in range(3)]),
            ("Table basse, bougies ×3", [low_table(f).img() for f in range(3)]),
            ("Tourne-disque ×3", [gramophone(f).img() for f in range(3)]),
            ("Notes ×3", [notes(f).img() for f in range(3)]),
            ("Tapis de bain", [bath_mat().img()]),
            ("Porte-serviettes : plein, sans serviette, vide", [towel_rack(v).img() for v in ("full", "gear", "empty")]),
            ("Baignoire vide (il est sorti) ×3", [tub(f, kobold=False).img() for f in range(3)]),
            ("Salle, image 2 / 3", [rooms[1], rooms[2]]),
        ],
        os.path.join(os.path.dirname(__file__), "salle_bain_v1.png"),
        note="Carrelage noir et blanc ; le Kobold dort (Zzz) ; bougies et disque animés ; musique douce en jeu (à faire).",
    )
