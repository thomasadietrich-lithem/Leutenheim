"""Section 2, la CHAMPIGNONNIÈRE : ambiance v5 (Thomas, 2026-11-14, sur la v4 : « grille rouillée » pour les portes ;
« j'aime le rideau de mycélium pour les salles secrètes » ; « la terre était mieux avant : réessaie juste ça et les
briques autour des éboulis » ; « il n'y a pas de bois pourri, juste des pierres déplacées aux endroits des éboulements
sur les murs »).

- La terre revient à celle de la v3 (sans les briques posées dessus).
- Aux brèches : les PIERRES DU MUR elles-mêmes sont déplacées (décalées, de travers), quelques-unes manquent et laissent
  voir la terre derrière, et quelques pierres du mur sont tombées juste devant. Mêmes couleurs que le mur, plus rien de brun.
- Le reste des murs garde l'usure de la v4. En bas : la porte (grille rouillée) et le rideau de mycélium retenus.

  python3 art/champi_v5.py   → art/champi_v5.png
"""
import os
import sys

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import champi_v3 as V3  # noqa: E402
import champi_v4 as V4  # noqa: E402
from pix import font, hash2, outline_mask, up  # noqa: E402

T = 16
JOINT = np.array((22, 16, 20))
EARTH_BEHIND = np.array((112, 84, 70))


def displaced_stones(a, xs, ys, wallmask, mound):
    """Les pierres du mur près de la brèche : découpées en pierres de 5 × 3, chacune poussée de 1 à 2 pixels vers la
    brèche ou de travers ; joints élargis ; les plus proches manquent (la terre derrière) ; quelques-unes tombées devant."""
    rng = np.random.default_rng(51)
    H, W = a.shape[:2]
    E = np.zeros((H, W), bool)
    for (cx, cy) in V3.cells("E"):
        E[cy * T:(cy + 1) * T, cx * T:(cx + 1) * T] = True
    dE = ndimage.distance_transform_edt(~E)
    src = a.copy()
    zone = wallmask & (dE < 14)
    # Pierres : blocs décalés d'une rangée sur l'autre, comme un appareil de briques.
    by = (ys // 3).astype(int)
    bx = ((xs + (by % 2) * 2) // 5).astype(int)
    blocks = {}
    zy, zx = np.nonzero(zone)
    for y, x in zip(zy, zx):
        blocks.setdefault((by[y, x], bx[y, x]), []).append((y, x))
    # Le fond de la zone : joints sombres, terre visible dans les trous.
    a[zone] = JOINT
    fallen = []
    for key, pix in blocks.items():
        ys_, xs_ = np.array([p[0] for p in pix]), np.array([p[1] for p in pix])
        d = dE[ys_, xs_].mean()
        r = hash2(np.array(key[0]), np.array(key[1]), 52).item()
        if d < 4 + 4 * r:
            # Pierre partie : on voit la terre derrière ; elle est tombée un peu plus loin, devant le mur.
            a[ys_, xs_] = EARTH_BEHIND
            if r < 0.5:
                bright = src[ys_, xs_].sum(axis=1)
                fallen.append((int(xs_.mean()), int(ys_.mean()), src[ys_[np.argmax(bright)], xs_[np.argmax(bright)]] * 0.85))
            continue
        # Pierre déplacée : poussée de 0 à 2 pixels, d'autant plus qu'elle est près de la brèche.
        push = int(round((1 - d / 14) * 3 * (0.5 + r)))
        dx, dy = (push if r < 0.5 else -push), (1 if r > 0.75 and push else 0)
        for y, x in zip(ys_, xs_):
            ty, tx = y + dy, x + dx
            if 0 <= ty < H and 0 <= tx < W and zone[ty, tx]:
                a[ty, tx] = src[y, x]
        # Bord éclairé en haut de la pierre, ombre dessous : on sent qu'elle sort du rang.
        top = ys_ == ys_.min()
        for y, x in zip(ys_[top], xs_[top]):
            if 0 <= y + dy < H and 0 <= x + dx < W and zone[y + dy, x + dx]:
                a[y + dy, x + dx] = np.minimum(255, src[y, x] * 1.25)
    # Pierres tombées devant la brèche, sur le sol (pas sur le dessus de l'éboulis), de la couleur du mur.
    floor_ok = (~wallmask) & ~ndimage.binary_dilation(mound, iterations=2) & (dE < 30)
    fy, fx = np.nonzero(floor_ok)
    for k in range(min(len(fallen), 14)):
        i = rng.integers(0, len(fx))
        X, Y = int(fx[i]), int(fy[i])
        w, h = int(rng.integers(5, 8)), int(rng.integers(3, 5))
        col = fallen[k % len(fallen)][2]
        tilt = int(rng.integers(-1, 2))
        for j in range(h):
            for i2 in range(w):
                x, y = X + i2, Y + j + (tilt * i2) // w
                if 0 <= x < W and 0 <= y < H and not wallmask[y, x]:
                    a[y, x] = col * (1.25 if j == 0 else 0.7 if j == h - 1 else 1.0)
        for i2 in range(w):
            x, y = X + i2, Y + h + (tilt * i2) // w
            if 0 <= x < W and 0 <= y < H and not wallmask[y, x]:
                a[y, x] = JOINT


def main():
    V3.PRE_HOOK = lambda a, xs, ys, wm: V4.worn_walls(a, xs, ys, wm)
    V3.HOOK = displaced_stones
    V3.FALLEN_BRICKS = False
    S = 4
    r = up(V3.room(), S)
    pad = 24
    Wb = r.width + 2 * pad
    door = [V4.wall_vignette(V4.paste_cell(V4.door_grate(st)), ["...", "#D#", "..."]) for st in ("closed", "open", "locked")]
    camo = V4.wall_vignette(V4.camo_mycelium, ["#####", ".....", "##S##", ".....", "....."])
    Hb = 80 + r.height + 30 + 260
    sheet = Image.new("RGB", (Wb, Hb), (22, 18, 14))
    d = ImageDraw.Draw(sheet)
    d.text((Wb // 2, 26), "SECTION 2 · LA CHAMPIGNONNIÈRE · ambiance v5 (option C)", fill=(255, 243, 200), font=font(22), anchor="mm")
    d.text((Wb // 2, 52), "Terre de la v3 · aux brèches, les pierres du mur déplacées, manquantes, tombées devant",
           fill=(190, 180, 160), font=font(13, False), anchor="mm")
    sheet.paste(r, (pad, 72))
    y = 72 + r.height + 24
    d.text((pad, y), "Retenus : porte « grille rouillée » (fermée, ouverte, verrouillée) · salle secrète « rideau de mycélium »", fill=(240, 192, 80), font=font(16), anchor="lt")
    y += 28
    x = pad
    for v in door:
        im = up(V4.dark(v, 0.85), 4)
        sheet.paste(im, (x, y))
        x += im.width + 8
    im = up(V4.dark(camo, 0.8), 2)
    sheet.paste(im, (x + 40, y))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "champi_v5.png")
    sheet = sheet.crop((0, 0, Wb, y + max(3 * T * 4, 5 * T * 2) + 20))
    sheet.save(out)
    print("art/champi_v5.png", sheet.size)


if __name__ == "__main__":
    main()
