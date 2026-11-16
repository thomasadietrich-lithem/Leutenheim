"""La chambre de neige v1 (Thomas, 2026-11-16 : « dans une salle secrète, plein de neige, un bonhomme de neige avec une
écharpe et une carotte magique +12 PV qui se décroche du nez »). Premier jet, déjà en jeu (à valider sur la planche).

- bonhomme de neige (16 × 27) : deux boules, yeux de charbon, écharpe rouge rayée dont un pan pend, bras de branches,
  la CAROTTE MAGIQUE au nez (quelques étincelles) ; et le même sans carotte ;
- congères (16 × 8, au sol) : deux formes.

  python3 art/neige_v1.py          → art/neige_v1.png
  python3 art/neige_v1.py export   → src/render/sprites/neige.ts
"""
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up  # noqa: E402
from dortoir_v2 import Sprite, C  # noqa: E402
from export_jeu_v4 import write  # noqa: E402

C.update({
    "sn": (238, 243, 250, 255), "sn_s": (196, 208, 224, 255), "sn_d": (150, 164, 188, 255), "sn_h": (255, 255, 255, 255),
    "coal": (26, 24, 34, 255), "car": (232, 120, 42, 255), "car_d": (176, 74, 16, 255), "car_l": (255, 176, 96, 255),
    "leaf": (92, 170, 70, 255), "scarf": (200, 48, 58, 255), "scarf_d": (138, 26, 34, 255), "scarf_l": (240, 200, 200, 255),
    "twig": (106, 74, 42, 255), "spark": (255, 236, 150, 255),
})


def ball(s, cx, cy, r):
    h, w = s.a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d = (xx - cx) ** 2 + (yy - cy) ** 2
    s.a[d <= r * r] = C["sn"]
    # Ombre en bas à gauche, reflet en haut à droite.
    s.a[(d <= r * r) & ((xx - cx + 0.4 * r) ** 2 + (yy - cy - 0.5 * r) ** 2 <= (0.75 * r) ** 2) & ((yy - cy) > 0.25 * r)] = C["sn_s"]
    s.a[(d <= r * r) & ((d > (r - 1) ** 2)) & (yy > cy)] = C["sn_d"]
    s.p(int(cx + r * 0.35), int(cy - r * 0.5), "sn_h")


def snowman(carrot=True):
    s = Sprite(18, 27)
    # Bras de branches (derrière le corps).
    for i in range(5):
        s.p(1 + i, 13 - i // 2, "twig").p(16 - i, 13 - i // 2, "twig")
    s.p(1, 10, "twig").p(16, 10, "twig")
    ball(s, 9, 19, 7)
    ball(s, 9, 8, 5)
    # Boutons de charbon.
    for y in (16, 19, 22):
        s.p(9, y, "coal")
    # Yeux.
    s.p(7, 7, "coal").p(11, 7, "coal")
    # Bouche en petits charbons.
    for x, y in ((7, 10), (8, 11), (10, 11), (11, 10)):
        s.p(x, y, "coal")
    # Écharpe : un tour au cou, un pan qui pend sur le côté, rayures claires.
    s.r(4, 12, 10, 2, "scarf").r(4, 13, 10, 1, "scarf_d")
    for x in (6, 9, 12):
        s.p(x, 12, "scarf_l")
    s.r(11, 14, 2, 5, "scarf").r(12, 14, 1, 5, "scarf_d").p(11, 16, "scarf_l").p(11, 19, "scarf").p(12, 19, "scarf_d")
    if carrot:
        # La carotte magique, pointée vers la droite, quelques étincelles.
        s.r(10, 8, 3, 2, "car").r(13, 8, 2, 1, "car").p(15, 8, "car_d").r(10, 9, 3, 1, "car_d").p(11, 8, "car_l")
        s.p(16, 6, "spark").p(14, 6, "spark").p(17, 9, "spark")
    else:
        s.p(10, 8, "sn_s")
    return s.done()


def drift(kind):
    s = Sprite(16, 8)
    h, w = s.a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    if kind == "A":
        m = ((xx - 7) / 7.5) ** 2 + ((yy - 7) / 5.5) ** 2 <= 1
    else:
        m = (((xx - 4) / 4.5) ** 2 + ((yy - 7) / 4.0) ** 2 <= 1) | (((xx - 11) / 5.0) ** 2 + ((yy - 7) / 5.5) ** 2 <= 1)
    s.a[m] = C["sn"]
    s.a[m & (yy >= 6)] = C["sn_s"]
    s.a[m & (yy >= 7)] = C["sn_d"]
    s.p(6, 3 if kind == "A" else 2, "sn_h")
    return s.done(outline=False)


def igloo():
    """Igloo (22 × 17, décor d'un coin) : un dôme de blocs de neige, l'entrée sombre en bas à droite."""
    s = Sprite(22, 17)
    h, w = s.a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    dome = ((xx - 10.5) / 10.5) ** 2 + ((yy - 16) / 15.5) ** 2 <= 1
    s.a[dome] = C["sn"]
    s.a[dome & ((((xx - 10.5) / 10.5) ** 2 + ((yy - 16) / 15.5) ** 2) > 0.72)] = C["sn_s"]
    # Joints des blocs : rangées, et briques décalées.
    for y in (4, 8, 12):
        for x in range(w):
            if dome[y, x]:
                s.a[y, x] = C["sn_d"]
    for row, y0 in enumerate((0, 4, 8, 12)):
        for x in range(2 + (row % 2) * 3, w, 6):
            for y in range(y0 + 1, min(y0 + 4, h)):
                if dome[y, x]:
                    s.a[y, x] = C["sn_d"]
    # L'entrée : une arche sombre, un petit tunnel devant.
    door = ((xx - 15) / 3.2) ** 2 + ((yy - 16.5) / 5) ** 2 <= 1
    s.a[door] = (40, 48, 70, 255)
    s.r(13, 15, 5, 2, "sn_s")
    s.a[door & (yy >= 14)] = (24, 28, 44, 255)
    s.p(6, 3, "sn_h").p(7, 3, "sn_h")
    return s.done()


def heap():
    """Tas de neige (14 × 10) : plus haut qu'une congère."""
    s = Sprite(14, 10)
    h, w = s.a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    m = (((xx - 6) / 6.5) ** 2 + ((yy - 9.5) / 8) ** 2 <= 1) | (((xx - 10) / 3.5) ** 2 + ((yy - 9.5) / 5) ** 2 <= 1)
    s.a[m] = C["sn"]
    s.a[m & (xx < 5) & (yy > 4)] = C["sn_s"]
    s.a[m & (yy >= 8)] = C["sn_s"]
    s.a[m & (yy >= 9)] = C["sn_d"]
    s.p(7, 2, "sn_h").p(8, 3, "sn_h")
    return s.done()


def melted():
    """Le bonhomme fondu (16 × 8, au sol) : une flaque, l'écharpe, deux charbons, une branche."""
    s = Sprite(16, 8)
    h, w = s.a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    pool = ((xx - 7.5) / 7.5) ** 2 + ((yy - 5) / 3) ** 2 <= 1
    s.a[pool] = (96, 130, 168, 200)
    s.a[pool & (yy <= 3)] = (130, 166, 200, 200)
    s.r(3, 4, 7, 1, "scarf").r(9, 5, 2, 1, "scarf_d").p(5, 4, "scarf_l")
    s.p(11, 3, "coal").p(4, 6, "coal").p(12, 6, "coal")
    s.r(1, 2, 3, 1, "twig").p(0, 1, "twig")
    return s.done(outline=False)


SPRITES = {
    "bonhomme": lambda: snowman(True),
    "bonhommeNu": lambda: snowman(False),
    "congereA": lambda: drift("A"),
    "congereB": lambda: drift("B"),
    "igloo": igloo,
    "tasNeige": heap,
    "bonhommeFondu": melted,
}


def main():
    names = list(SPRITES)
    sheet = Image.new("RGB", (40 + len(names) * 150, 260), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((sheet.width // 2, 22), "CHAMBRE DE NEIGE v1 — bonhomme de neige, carotte magique, congères", fill=(255, 243, 200), font=font(15), anchor="mm")
    for i, n in enumerate(names):
        im = up(SPRITES[n]().img(), 6)
        x = 20 + i * 150
        bg = Image.new("RGB", (140, 190), (200, 212, 228))
        bg.paste(im, ((140 - im.width) // 2, 180 - im.height), im)
        sheet.paste(bg, (x, 45))
        d.text((x, 240), n, fill=(220, 210, 190), font=font(12, False))
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "neige_v1.png")
    sheet.save(out)
    print("art/neige_v1.png", sheet.size)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        sprites = {n: f().img() for n, f in SPRITES.items()}
        os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
        write("src/render/sprites/neige.ts", "NEIGE",
              "Chambre de neige v1 (art/neige_v1.png) : bonhomme de neige (avec et sans carotte), congères.", sprites)
    else:
        main()
