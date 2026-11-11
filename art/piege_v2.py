"""Piège à pointes, v2 (Thomas, 2026-11-11 : « Le piège gagnerait en design : pas pile carré, mais un peu débordant et
irrégulier par rapport aux carreaux autour. Chaque pièce aurait une taille un peu différente. Mais on doit comprendre
qu'il n'excède pas un carreau »).

Le piège est fait de plaques de fer de tailles différentes (découpe au hasard), séparées par des fentes d'où sortent
des pointes. Sa silhouette est irrégulière et déborde d'au plus un pixel sur les joints du sol : on voit qu'il tient
dans UNE case. Trois variantes (le jeu en choisira une selon la case). Écrit art/piege_v2.png.
"""
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image, ImageDraw
from pix import hash2, grid, to_img, up, font, outline_mask
from sols_v1 import floor_b

PAL = {
    "plate": [(86, 90, 110), (100, 104, 126), (74, 78, 96)],
    "edge": (132, 138, 162), "seam": (20, 18, 28), "spike": (214, 220, 236), "spike_d": (120, 126, 148),
    "rivet": (160, 166, 188), "rust": (110, 64, 44), "blood": (120, 30, 36), "out": (18, 13, 8),
}


def trap(seed):
    """Un piège de 18 × 18 pixels (la case fait 16 : au plus 1 pixel de débord de chaque côté). Trois ou quatre plaques
    de fer de tailles différentes, jointes par une fente fine ; sur chaque plaque, des pointes bien visibles."""
    S = 18
    a = np.zeros((S, S, 4), np.uint8)
    rnd = lambda i: float(hash2(i, seed, 501))
    plates = [(1, 1, 17, 17)]
    for i in range(2 + int(rnd(0) * 2)):
        plates.sort(key=lambda p: -(p[2] - p[0]) * (p[3] - p[1]))
        x0, y0, x1, y1 = plates.pop(0)
        if (x1 - x0) >= (y1 - y0):
            cut = x0 + 5 + int(rnd(i + 1) * max(1, x1 - x0 - 10))
            plates += [(x0, y0, cut, y1), (cut, y0, x1, y1)]
        else:
            cut = y0 + 5 + int(rnd(i + 1) * max(1, y1 - y0 - 10))
            plates += [(x0, y0, x1, cut), (x0, cut, x1, y1)]
    spikes = []
    for k, (x0, y0, x1, y1) in enumerate(plates):
        # Chaque plaque a son propre débord : un bord peut sortir d'un pixel, un autre rentrer d'un pixel.
        j = [int(round(rnd(20 + k * 4 + n) * 2 - 1)) for n in range(4)]
        x0, y0, x1, y1 = max(0, x0 + j[0]), max(0, y0 + j[1]), min(S, x1 + j[2]), min(S, y1 + j[3])
        col = PAL["plate"][k % 3]
        a[y0:y1, x0:x1, :3] = col
        a[y0:y1, x0:x1, 3] = 255
        a[y0, x0:x1, :3] = PAL["edge"]
        a[y0:y1, x0, :3] = PAL["edge"]
        a[y1 - 1, x0:x1, :3] = PAL["seam"]
        a[y0:y1, x1 - 1, :3] = PAL["seam"]
        # Pointes sur une grille de 4 pixels, décalée selon la plaque.
        for py in range(y0 + 2, y1 - 2, 4):
            for px in range(x0 + 2 + (k % 2) * 2, x1 - 2, 4):
                spikes.append((px, py))
    # Silhouette irrégulière : on ronge quelques pixels du bord.
    m = a[..., 3] > 0
    edge = outline_mask(~m) & m
    for y, x in np.argwhere(edge):
        if hash2(int(x), int(y), seed + 7) > 0.7:
            a[y, x, 3] = 0
    # Les pointes : pointe blanche, flanc gris, ombre sombre en bas à droite.
    for px, py in spikes:
        if a[py, px, 3] == 0 or a[py + 1, px + 1, 3] == 0:
            continue
        a[py, px, :3] = PAL["spike"]
        a[py + 1, px, :3] = PAL["spike_d"]
        a[py + 1, px + 1, :3] = PAL["seam"]
    # Une vieille tache de sang.
    bx, by = 4 + int(rnd(99) * 8), 5 + int(rnd(98) * 8)
    for dx, dy in ((0, 0), (1, 0), (1, 1)):
        if a[by + dy, bx + dx, 3] and not (a[by + dy, bx + dx, :3] == PAL["spike"]).all():
            a[by + dy, bx + dx, :3] = PAL["blood"]
    m = a[..., 3] > 0
    o = outline_mask(m)
    a[o, :3] = PAL["out"]
    a[o, 3] = 255
    return Image.fromarray(a, "RGBA")


if __name__ == "__main__":
    T = 16
    W, H = 7 * T, 3 * T
    xs, ys = grid(W, H)
    floor = to_img(floor_b(xs, ys)).convert("RGBA")
    old = Image.open("art/piege_pousser_v1.png") if False else None
    for i, seed in enumerate((1, 2, 3)):
        im = trap(seed)
        floor.alpha_composite(im, ((1 + 2 * i) * T - 1, 1 * T - 1))
    S = 5
    big = up(floor.convert("RGB"), S)
    sheet = Image.new("RGB", (big.width + 40, 60 + big.height + 210), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((sheet.width // 2, 20), "PIÈGE v2 — 3 variantes, sur le sol B (à valider)", fill=(255, 243, 200), font=font(15), anchor="mm")
    sheet.paste(big, (20, 44))
    # Repères : les joints des cases autour, pour voir le léger débord.
    x = 20
    y = 44 + big.height + 20
    for seed in (1, 2, 3):
        im = up(trap(seed), 9)
        bg = Image.new("RGB", (im.width + 20, im.height + 20), (70, 61, 82))
        dd = ImageDraw.Draw(bg)
        o = 10 + 9  # la case de 16 commence à 1 pixel du bord du dessin
        dd.rectangle([o, o, o + 16 * 9 - 1, o + 16 * 9 - 1], outline=(214, 170, 84))
        bg.paste(im, (10, 10), im)
        sheet.paste(bg, (x, y - 10)) if bg.height + y - 10 < sheet.height else None
        x += bg.width + 16
    d.text((20, sheet.height - 18), "cadre doré = la case : le piège ne déborde que d'un pixel par endroits", fill=(220, 210, 190), font=font(11, False))
    sheet.save("art/piege_v2.png")
    print(sheet.size)
