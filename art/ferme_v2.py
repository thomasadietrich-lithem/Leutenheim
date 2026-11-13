"""Planche « ferme_v2 » (Thomas, 2026-11-13, retours sur la v1) : clôture verticale revue, statue de la POMME (à la place
du Kobold au trognon), la botte de paille déjà validée (`trainards_v3.hay_bale`, d'après son inspiration), des caisses
en bois dans la ferme.  python3 art/ferme_v2.py → art/ferme_v2.png"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

import ferme_v1 as v1  # noqa: E402
from trainards_v3 import crate_stack_v3, crate_v3, hay_bale  # noqa: E402

# Clôture vue de haut, dans un pan vertical : les deux lisses filent de haut en bas, un poteau (plus haut, on voit son
# chapeau et sa face) tous les deux pas de clôture ; ici, la case avec le poteau, et la case de lisses seules.
FENCE_V_POST = [
    "....KKKKKKK.....",
    "...KWWWWWWBK....",
    "...KWBBBBBbK....",
    "...KKKKKKKKK....",
    "....KWK.KWK.....",
    "...KKBKKKBKK....",
    "...KWWWWWWBK....",
    "...KbbbbbbbK....",
    "...KKBKKKBKK....",
    "....KWK.KWK.....",
    "....KbK.KbK.....",
    "....KWK.KWK.....",
    "...KKBKKKBKK....",
    "...KWWWWWWBK....",
    "...KbbbbbbbK....",
    "...KKBKKKBKK....",
]
# Clôture PLEINE dans un pan vertical (Thomas, 2026-11-13 : « clôture pleine verticale ») : chaque case a ses deux
# montants et ses traverses, d'un bout à l'autre ; on ne passe nulle part.
FENCE_V_RAIL = FENCE_V_POST

# La statue de la POMME : une grosse pomme de pierre bien ronde, sa queue et sa feuille à gauche, sur un socle gravé
# (pas de bouchée : rien qui rappelle un logo connu).
STATUE_APPLE = [
    "................",
    "................",
    "....KKK.KK......",
    "...KhssKdK......",
    "....KKsKdK......",
    "......KKdKK.....",
    "..KKKKKKKKKKKK..",
    ".KshhhKssKhsssK.",
    "KshhhhssssssssdK",
    "KshhsssssssssssK",
    "KshhsssssssssssK",
    "KshssssssssssssK",
    "KshssssssssssssK",
    "KssssssssssssdsK",
    "KssssssssssssddK",
    ".KssssssssssddK.",
    ".KdsssssssssddK.",
    "..KdssssssssdK..",
    "...KKddKKddKK...",
    ".KhhhhhhhhhhhhK.",
    "KhssssssssssssdK",
    "KdssxsxxsxsxssdK",
    "KdssssssssssssdK",
    "KdssssssssssssdK",
    "KddddddddddddddK",
    ".KKKKKKKKKKKKKK.",
    "................",
]


def main():
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
    W, H = 1200, 1180
    out = Image.new("RGB", (W, H), (13, 10, 8))
    d = ImageDraw.Draw(out)
    S = v1.S
    hay = hay_bale().img()
    crate = crate_v3().img()
    stack = crate_stack_v3().img()

    def put_img(img, x, y, label, scale=S):
        big = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
        out.paste(big, (x, y + 32 * scale - big.height), big)
        d.text((x, y + 32 * scale + 8), label, fill=(240, 230, 200), font=font)

    d.text((20, 14), "FERME v2 — tes retours : clôture verticale, statue pomme, botte de paille validée, caisses", fill=(240, 192, 80), font=bold)
    x = 20
    for img, lab in [
        (v1.sprite(FENCE_V_POST), "clôture verticale :\nposte"),
        (v1.sprite(FENCE_V_RAIL), "clôture verticale :\nlisses"),
        (hay, "botte de paille\n(trainards v3, validée)"),
        (crate, "caisse en bois"),
        (stack, "caisses empilées"),
        (v1.sprite(STATUE_APPLE), "statue de la pomme"),
    ]:
        put_img(img, x, 50, lab)
        x += 16 * S + 90

    # La maquette refaite.
    d.text((20, 330), "LA SALLE (maquette v2)", fill=(240, 192, 80), font=bold)
    sc = 3
    T = 16 * sc
    ox, oy = 20, 370
    cols, rows_ = 11, 9
    for j in range(rows_):
        for i in range(cols):
            c = (64, 58, 74) if (i + j) % 2 else (70, 64, 80)
            d.rectangle([ox + i * T, oy + j * T, ox + i * T + T - 1, oy + j * T + T - 1], fill=c, outline=(50, 46, 60))
    d.rectangle([ox - 8, oy - 8, ox + cols * T + 7, oy + rows_ * T + 7], outline=(120, 124, 150), width=8)

    def at(img, i, j, dx=0):
        big = img.resize((img.width * sc, img.height * sc), Image.NEAREST)
        out.paste(big, (ox + i * T + dx * sc, oy + (j + 1) * T - big.height), big)

    fx, fy, fw, fh = 2, 2, 6, 4
    for j in range(fy, fy + fh):
        for i in range(fx, fx + fw):
            at(v1.sprite(v1.SOIL if (i * 3 + j) % 4 else v1.SPROUT), i, j)
    for j in range(fy - 1, fy + fh + 1):
        for i in (fx - 1, fx + fw):
            if j in (fy - 1, fy + fh):
                continue
            at(v1.sprite(FENCE_V_POST if (j - fy) % 2 == 0 else FENCE_V_RAIL), i, j)
    for i in range(fx - 1, fx + fw + 1):
        corner = i in (fx - 1, fx + fw)
        at(v1.sprite(v1.FENCE_POST if corner else v1.FENCE_H), i, fy - 1)
        if i == fx + 2:
            continue  # l'ouverture
        at(v1.sprite(v1.FENCE_POST if corner or i in (fx + 1, fx + 3) else v1.FENCE_H), i, fy + fh)
    at(v1.sprite(v1.SCARECROW), fx + 3, fy + 1)
    at(hay, fx, fy + 3)
    at(hay, fx + 5, fy)
    at(v1.sprite(v1.CHICKEN), fx + 1, fy + 1)
    at(v1.sprite(v1.CHICKEN), fx + 4, fy + 2)
    at(v1.sprite(v1.HOE), 0, 1)
    at(v1.sprite(v1.FORK), 10, 1)
    at(stack, 10, 7)
    at(crate, 0, 7)
    at(hay, 9, 8)
    at(v1.sprite(v1.CHICKEN), 6, 8)
    d.text((ox + cols * T + 30, oy + 10), "• clôture : lisses qui filent du haut\n  en bas sur les côtés, un poteau\n  tous les deux pas\n• botte de paille de la v3 (ta\n  proposition), dedans et dehors\n• caisses en bois dans les coins\n• le reste comme la v1 (houe,\n  fourche, épouvantail, poulets)", fill=(220, 214, 190), font=font)
    out.save("art/ferme_v2.png")


if __name__ == "__main__":
    main()
