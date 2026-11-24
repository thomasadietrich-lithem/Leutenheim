"""Tapisserie du culte v2 (Thomas, 2026-11-24 : « réduis le rideau violet à une case de large ; remplace la lune par un
poulet »). Le culte maudit devient le CULTE DU POULET : une bannière violette d'une case (14 × 24), un poulet d'argent
dans le médaillon ; la même draperie pliée (16 × 12) au pied des coffres.

  python3 art/tapisserie_culte_v2.py          → art/tapisserie_culte_v2.png (planche)
  python3 art/tapisserie_culte_v2.py export   → src/render/sprites/culte.ts
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw  # noqa: E402

from pix import font, up  # noqa: E402
from dortoir_v2 import Sprite, C  # noqa: E402
from export_jeu_v4 import write  # noqa: E402
from tapisserie_culte_v1 import disk, wall_strip  # noqa: E402  (couleurs du v1 chargées)

C.update({"comb": (196, 52, 60, 255), "beak": (226, 176, 64, 255)})

BW, BH = 14, 24
CX, CY = 7, 10


def chicken(s, cx=CX, cy=CY):
    """Le poulet d'argent, de profil vers la gauche (9 × 9 environ) : corps rond, queue relevée, tête, crête, bec, patte."""
    # Corps.
    s.r(cx - 3, cy - 1, 6, 4, "moon").r(cx - 2, cy + 3, 4, 1, "moon").r(cx - 2, cy - 2, 4, 1, "moon")
    # Queue relevée, à droite.
    s.r(cx + 3, cy - 3, 1, 4, "moon").r(cx + 2, cy - 3, 1, 1, "moon").r(cx + 4, cy - 4, 1, 2, "sil")
    # Aile (un trait plus sombre).
    s.r(cx - 1, cy, 3, 1, "sil_d").p(cx + 2, cy + 1, "sil_d")
    # Cou et tête, à gauche.
    s.r(cx - 3, cy - 4, 2, 3, "moon").r(cx - 4, cy - 4, 1, 2, "moon")
    s.p(cx - 3, cy - 4, "pupil")  # œil
    # Crête rouge, bec jaune.
    s.p(cx - 4, cy - 5, "comb").p(cx - 3, cy - 5, "comb").p(cx - 3, cy - 6, "comb")
    s.p(cx - 5, cy - 3, "beak")
    # Pattes.
    s.p(cx - 1, cy + 4, "beak").p(cx + 1, cy + 4, "beak")
    return s


def banner():
    s = Sprite(16, BH)
    # Tringle sur toute la case, embouts.
    s.r(0, 0, 16, 2, "rod2").r(0, 0, 16, 1, "rod2_l").r(0, 0, 1, 3, "sil_d").r(15, 0, 1, 3, "sil_d")
    # Le tissu (12 de large), un pli de chaque côté.
    s.r(2, 2, 12, 18, "vio")
    s.r(2, 2, 1, 18, "vio_l").r(13, 2, 1, 18, "vio_dd").r(4, 2, 1, 18, "vio_d").r(11, 2, 1, 18, "vio_d")
    s.r(3, 3, 10, 1, "sil_d").r(3, 18, 10, 1, "sil_d")
    # Bas en pointe, franges.
    for i in range(12):
        depth = 3 - abs(i - 5.5) // 2
        s.r(2 + i, 20, 1, int(depth), "vio")
    for x in range(3, 13, 2):
        s.p(x, 20 + (1 if (x // 2) % 3 else 2), "sil_d")
    # Médaillon sombre et le poulet.
    disk(s, CX + 1, CY + 1, 5, "vio_dd")
    chicken(s, CX + 1, CY + 1)
    return s.done()


def folded():
    s = Sprite(16, 12)
    s.r(1, 10, 14, 2, (0, 0, 0, 70))
    s.r(2, 7, 13, 3, "vio_d").r(2, 9, 13, 1, "vio_dd").r(3, 8, 11, 1, "sil_d")
    s.r(1, 4, 13, 3, "vio").r(1, 6, 13, 1, "vio_d").r(1, 4, 13, 1, "vio_l")
    s.r(2, 1, 12, 3, "vio").r(2, 1, 12, 1, "vio_l").r(2, 3, 12, 1, "vio_d")
    s.r(1, 5, 13, 1, "sil_d")
    for x in (14, 15):
        s.p(x, 5, "sil_d").p(x, 8, "sil_d")
    # La tête du poulet qui dépasse du pli.
    s.r(8, 2, 2, 2, "moon").p(7, 2, "beak").p(9, 1, "comb").p(8, 1, "comb").p(8, 2, "pupil")
    return s.done()


def main():
    sheet = Image.new("RGB", (520, 300), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((260, 20), "TAPISSERIE DU CULTE v2 — une case, le poulet d'argent", fill=(255, 243, 200), font=font(15), anchor="mm")
    b = up(banner().img(), 8)
    sheet.paste(b, (30, 50), b)
    strip = wall_strip(1)
    strip.alpha_composite(banner().img(), (0, 0))
    st = up(strip, 5)
    sheet.paste(st, (220, 50), st)
    f = up(folded().img(), 8)
    sheet.paste(f, (340, 60), f)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "tapisserie_culte_v2.png")
    sheet.save(out)
    print("art/tapisserie_culte_v2.png", sheet.size)


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "export":
        os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
        write("src/render/sprites/culte.ts", "CULTE",
              "Tapisserie du culte du poulet v2 (art/tapisserie_culte_v2.png, Thomas 2026-11-24) : bannière d'une case et draperie pliée.",
              {"tapisserieCulte": banner().img(), "drapPlie": folded().img()})
    else:
        main()
