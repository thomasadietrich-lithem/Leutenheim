"""Planche « ferme_v1 » (Thomas, 2026-11-13) : la salle de la ferme, le Kobold fermier et 4 statues.
À valider sur image avant d'entrer dans le jeu.  python3 art/ferme_v1.py → art/ferme_v1.png"""
from PIL import Image, ImageDraw, ImageFont

S = 6  # agrandissement de la planche

PAL = {
    ".": None,
    "K": (18, 13, 8), "k": (40, 30, 22),
    # terre battue
    "e": (86, 60, 38), "E": (110, 80, 50), "f": (62, 42, 26),
    # bois
    "B": (154, 104, 54), "b": (100, 64, 30), "W": (190, 140, 80),
    # métal
    "S": (176, 182, 200), "D": (110, 116, 140), "H": (220, 224, 236),
    # foin
    "Y": (232, 196, 92), "y": (186, 146, 52), "Z": (250, 226, 140), "r": (150, 60, 40),
    # tissu épouvantail
    "R": (176, 54, 48), "U": (70, 96, 150), "u": (44, 62, 104), "T": (226, 214, 178),
    # pierre des statues
    "s": (124, 128, 158), "d": (84, 86, 112), "h": (182, 186, 214), "x": (34, 30, 44),
    # poulet
    "w": (246, 242, 230), "c": (201, 194, 174), "o": (224, 122, 42), "j": (240, 184, 48), "q": (216, 48, 58),
}


def sprite(rows, pal=PAL):
    h, w = len(rows), len(rows[0])
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    px = img.load()
    for y, row in enumerate(rows):
        assert len(row) == w, (row, w)
        for x, ch in enumerate(row):
            c = pal.get(ch)
            if c:
                px[x, y] = c + (255,)
    return img


SOIL = [
    "eeEeeeeEeeeeeEee",
    "fffffffffffffffff"[:16],
    "eEeeeeEeeeeEeeee",
    "eeeeEeeeeeeeeEee",
    "ffffffffffffffff",
    "eeEeeeeeEeeeeeeE",
    "eeeeeEeeeeeEeeee",
    "ffffffffffffffff",
    "EeeeeeeeEeeeeEee",
    "eeeEeeeeeeeeeeee",
    "ffffffffffffffff",
    "eeeeeeEeeeeeEeee",
    "eEeeeeeeeeEeeeee",
    "ffffffffffffffff",
    "eeeeEeeeeeeeeeEe",
    "eeeeeeeeEeeeeeee",
]
SPROUT = [r for r in SOIL]
SPROUT = [
    "eeEeeeeEeeeeeEee",
    "ffffffffffffffff",
    "eEeeeAeeeeeEeeee".replace("A", "e"),
    "eeeeEeeeeeeeeEee",
    "ffffffffffffffff",
    "eeEeeeeeEeeeeeeE",
    "eeeeeEeeeeeEeeee",
    "ffffffffffffffff",
    "EeeeeeeeEeeeeEee",
    "eeeEeeeeeeeeeeee",
    "ffffffffffffffff",
    "eeeeeeEeeeeeEeee",
    "eEeeeeeeeeEeeeee",
    "ffffffffffffffff",
    "eeeeEeeeeeeeeeEe",
    "eeeeeeeeEeeeeeee",
]

FENCE_H = [
    "................",
    "................",
    "................",
    "................",
    "..KK........KK..",
    ".KWBK......KWBK.",
    "KKBBKKKKKKKKBBKK",
    "KWWWWWWWWWWWWWWK",
    "KbbbbbbbbbbbbbbK",
    "KKBBKKKKKKKKBBKK",
    ".KBbK......KBbK.",
    "KKBBKKKKKKKKBBKK",
    "KWWWWWWWWWWWWWWK",
    "KbbbbbbbbbbbbbbK",
    "KKBbKKKKKKKKBbKK",
    ".KKK........KKK.",
]
FENCE_V = [
    "......KKK.......",
    ".....KWBBK......",
    ".....KWBbK......",
    ".....KWBbK......",
    ".....KBBbK......",
    ".....KWBbK......",
    ".....KWBbK......",
    ".....KBBbK......",
    ".....KWBbK......",
    ".....KWBbK......",
    ".....KBBbK......",
    ".....KWBbK......",
    ".....KWBbK......",
    ".....KBBbK......",
    ".....KWBbK......",
    "......KKK.......",
]
FENCE_POST = [
    "................",
    "................",
    "................",
    "......KKKK......",
    ".....KWWBBK.....",
    ".....KWBBbK.....",
    ".....KWBBbK.....",
    ".....KBBBbK.....",
    ".....KWBBbK.....",
    ".....KWBBbK.....",
    ".....KBBBbK.....",
    ".....KWBBbK.....",
    ".....KWBBbK.....",
    ".....KBBbbK.....",
    "......KKKK......",
    "................",
]

HOE = [
    "........KKKKK...",
    ".......KSHHSDK..",
    "........KKSDK...",
    "..........KK....",
    ".........KWBK...",
    ".........KBbK...",
    "........KWBK....",
    "........KBbK....",
    ".......KWBK.....",
    ".......KBbK.....",
    "......KWBK......",
    "......KBbK......",
    ".....KWBK.......",
    ".....KBbK.......",
    "....KWBK........",
    "....KBbK........",
    "...KWBK.........",
    "...KBbK.........",
    "...KKK..........",
    "................",
    "................",
    "................",
    "................",
    "................",
]
FORK = [
    "..K..K..K.......",
    ".KSKKSKKSK......",
    ".KSKKSKKSK......",
    ".KSKKSKKSK......",
    ".KSSSSSSSK......",
    "..KDSSSDK.......",
    "....KBK.........",
    "....KWbK........",
    ".....KBK........",
    ".....KWbK.......",
    "......KBK.......",
    "......KWbK......",
    ".......KBK......",
    ".......KWbK.....",
    "........KBK.....",
    "........KWbK....",
    ".........KBK....",
    ".........KWbK...",
    "..........KBK...",
    "..........KKK...",
    "................",
    "................",
    "................",
    "................",
]

HAY = [
    "................",
    "................",
    "................",
    "..KKKKKKKKKKKK..",
    ".KZYYZYYYZYYYYK.",
    "KZYYYYZYYYYZYYyK",
    "KYYZYYYYYZYYYYyK",
    "KrrrrrrrrrrrrrrK",
    "KYYYYZYYYYYZYYyK",
    "KYZYYYYYZYYYYYyK",
    "KYYYYYZYYYYYZYyK",
    "KrrrrrrrrrrrrrrK",
    "KyYYYYYYYYYYYYyK",
    "KyyyyyyyyyyyyyyK",
    ".KKKKKKKKKKKKKK.",
    "................",
]
HAY_PILE = [
    "................",
    "................",
    "................",
    "................",
    "................",
    ".......K.K......",
    ".....KKZKYKK....",
    "....KZYYZYYZK...",
    "...KYYZYYYYYYK..",
    "..KZYYYYZYYZYYK.",
    "..KYYZYYYYYYYyK.",
    ".KZYYYYYZYYYYYyK",
    ".KYYYZYYYYYZYyyK",
    ".KyYYYYYYYYYyyyK",
    "..KKKKKKKKKKKKK.",
    "................",
]

SCARECROW = [
    "......KKKK......",
    ".....KYYYYK.....",
    "...KKYYYYYYKK...",
    "..KYYYYYYYYYYK..",
    "....KTTTTTTK....",
    "....KTKTTKTK....",
    "....KTTTTTTK....",
    "....KTKKKKTK....",
    ".....KTTTTK.....",
    ".KKKKKRRRRKKKKK.",
    "KYBBBRRRRRRBBBYK",
    "KYKKKRRUURRKKKYK",
    ".K..KRRUURRK..K.",
    "....KRRUURRK....",
    "....KUUUUUUK....",
    "....KUKUUKUK....",
    "....KUK..KUK....",
    ".....KKBBKK.....",
    "......KWbK......",
    "......KBbK......",
    "......KWbK......",
    "......KBbK......",
    ".....KKBbKK.....",
    "....KkkkkkkK....",
]

CHICKEN = [
    "................",
    "......qq........",
    ".....qqqK.......",
    ".....KwwwK......",
    "....KwwKwwK.....",
    "...jjKwwwwK.....",
    "....KKwwwwK.....",
    "......KwwwwKKK..",
    ".....KwwwwwwwcK.",
    "....KwwwwwwwwcK.",
    "....KwwcwwwwcK..",
    "....KcwwccwccK..",
    ".....KccccccK...",
    ".......K..K.....",
    ".......o..o.....",
    "......oo.oo.....",
]

# Kobold fermier : la tête du Schrat, chapeau de paille, salopette bleue, brin de paille au bec.
SCHRAT_PAL = {
    ".": None, "A": (156, 182, 62), "a": (92, 116, 38), "C": (176, 184, 194), "H": (120, 74, 38), "K": (24, 18, 30),
    "L": (222, 220, 146), "O": (24, 18, 30), "T": (232, 222, 190), "Y": (236, 140, 40), "b": (98, 62, 30),
    "Z": (240, 214, 120), "z": (190, 150, 60), "U": (78, 104, 160), "u": (48, 66, 110), "G": (240, 192, 80),
}
FARMER = [
    "....OOOOOOOO....",
    "...OZZZZZZZZO...",
    ".OOZzZZZZZZzZOO.",
    "OZZZZZZZZZZZZZZO",
    "OOOOOOOOOOOOOOOO",
    "..OaAAAAAAAAaO..",
    "..OAYKAAAAKYAO..",
    "..OAAAAAAAAAAO..",
    "...OaALLLLAaO...",
    "...OaLKLLKLaOZ..",
    "....OaTLLTaOZ...",
    "...OAUUUUUUAO...",
    "..OAUGUUUUGUAO..",
    "..OaOUUUUUUObO..",
    "...OOAAOOAAOO...",
    "....OaaOOaaO....",
]

# Statues (pierre, 16 × 27, comme la statue du jeu).
STATUE_KOBOLD = [
    "............KK..",
    "...........KhsK.",
    "..K......K.KsdK.",
    ".KhK....KhK.KK..",
    "..KsKKKKsK..Ks..",
    "...KshhhsK.Ks...",
    "..KshxshxsKs....",
    "..KshhhhhhsK....",
    "...KdhxxhdK.....",
    "....KdsssK......",
    "...KsshhssK.....",
    "..KsshhhhssK....",
    "..KdshhhhsdK....",
    "..KssshhsssK....",
    "...KsssssssK....",
    "...KdsK.KsdK....",
    "...KssK.KssK....",
    "..KKddK.KddKK...",
    ".KhhhhhhhhhhhK..",
    "KhssssssssssshK.",
    "KdsssxxxsssssdK.",
    "KdssxsssxssssdK.",
    "KdssssxxsssssdK.",
    "KdsssssssssssdK.",
    "KdddddddddddddK.",
    ".KKKKKKKKKKKKK..",
    "................",
]
STATUE_KNIGHT = [
    "................",
    "................",
    "................",
    "................",
    "....KKKKKKKK....",
    "...KsdddddsK....",
    "..KshhssshhsK...",
    ".KsshhsssshssK..",
    ".KsshssssshssK..",
    ".KdsshhhhhssdK..",
    "..KsssshhssK....",
    "..KdssshhsdK.KK.",
    "..KssssssssK.Ks.",
    "...KsssssssK.Ks.",
    "...KdsssssdK.Ks.",
    "...KssK.KssK.Ks.",
    "...KssK.KssK.Ks.",
    "..KKddK.KddKKKhK",
    ".KhhhhhhhhhhhKdK",
    "KhssssssssssshKK",
    "KdssssssssssssdK",
    "KdsssssssssKKKsK",
    "KdssssssssKhshK.",
    "KdssssssssKsxsK.",
    "KdddddddddKdddK.",
    ".KKKKKKKKKKKKK..",
    "................",
]
STATUE_HEN = [
    "................",
    "................",
    "......KK........",
    ".....KhhK.......",
    "....KhhhhK......",
    "....KhxhsK......",
    "..KKshhhsK......",
    ".KddKshssK......",
    "..KKshhhsK......",
    "....KshhhsKKKK..",
    "...KshhhhhsshsK.",
    "..KshhhhhhhhssK.",
    "..KshhhshhhhssK.",
    "..KshhssshhhsdK.",
    "..KdshhhhhhssdK.",
    "...KdsssssssdK..",
    "....KKdsssdKK...",
    ".....KdK.KdK....",
    ".KKKKKKKKKKKKKK.",
    "KhhhhhhhhhhhhhhK",
    "KhssssssssssssdK",
    "KdssxsxssxsxssdK",
    "KdsssssssssssssK",
    "KdssssssssssssdK",
    "KddddddddddddddK",
    ".KKKKKKKKKKKKKK.",
    "................",
]
STATUE_NUN = [
    "......KKKK......",
    ".....KdssdK.....",
    "....KdshhsdK....",
    "...KdshxxhsdK...",
    "...KdshhhhsdK...",
    "...KdsxhhxsdK...",
    "...KddshhsddK...",
    "..KdddsssssddK..",
    "..KddsshhssddK..",
    ".KdddshhhhsdddK.",
    ".KddsshKKhssddK.",
    ".KddsshKKhssddK.",
    ".KdddshhhhsdddK.",
    ".KddddsshsddddK.",
    "..KdddssssdddK..",
    "..KddddsssddddK.",
    "..KdddddsddddK..",
    "..KddddddddddK..",
    "..KKddddddddKK..",
    ".KhhhhhhhhhhhhK.",
    "KhssssssssssssdK",
    "KdssssssssssssdK",
    "KdssssxxxssssdK.",
    "KdssssssssssssdK",
    "KddddddddddddddK",
    ".KKKKKKKKKKKKKK.",
    "................",
]


def main():
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 15)
    bold = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 20)
    W, H = 1200, 1640
    out = Image.new("RGB", (W, H), (13, 10, 8))
    d = ImageDraw.Draw(out)

    def put(rows, x, y, label, pal=PAL, scale=S):
        img = sprite(rows, pal)
        big = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
        out.paste(big, (x, y), big)
        d.text((x, y + big.height + 6), label, fill=(240, 230, 200), font=font)

    d.text((20, 14), "LA FERME — matériel, enclos, foin, épouvantail", fill=(240, 192, 80), font=bold)
    x, y = 20, 50
    for rows, lab in [(SOIL, "terre battue"), (SPROUT, "terre (variante)"), (FENCE_H, "clôture (côté)"), (FENCE_V, "clôture (montant)"), (FENCE_POST, "poteau d'angle")]:
        put(rows, x, y, lab)
        x += 16 * S + 40
    x, y = 20, 210
    for rows, lab in [(HOE, "houe"), (FORK, "fourche"), (HAY, "botte de foin"), (HAY_PILE, "tas de foin"), (SCARECROW, "épouvantail"), (CHICKEN, "poulet")]:
        put(rows, x, y, lab)
        x += 16 * S + 40

    # La scène : un enclos de terre battue 6 × 4 dans une salle de dalles.
    d.text((20, 420), "LA SALLE (maquette) : enclos 6 × 4 = 24 cases, 1 épouvantail, 2 foins, 2 poulets dedans, 1 dehors", fill=(240, 192, 80), font=bold)
    sc = 3
    T = 16 * sc
    ox, oy = 20, 460
    cols, rows_ = 11, 8
    floor = (64, 58, 74)
    for j in range(rows_):
        for i in range(cols):
            c = floor if (i + j) % 2 else (70, 64, 80)
            d.rectangle([ox + i * T, oy + j * T, ox + i * T + T - 1, oy + j * T + T - 1], fill=c, outline=(50, 46, 60))
    d.rectangle([ox - 8, oy - 8, ox + cols * T + 7, oy + rows_ * T + 7], outline=(120, 124, 150), width=8)

    def at(rows_s, i, j, pal=PAL):
        img = sprite(rows_s, pal)
        big = img.resize((img.width * sc, img.height * sc), Image.NEAREST)
        out.paste(big, (ox + i * T, oy + (j + 1) * T - big.height), big)

    fx, fy, fw, fh = 2, 2, 6, 4
    for j in range(fy, fy + fh):
        for i in range(fx, fx + fw):
            at(SOIL if (i * 3 + j) % 4 else SPROUT, i, j)
    for i in range(fx - 1, fx + fw + 1):
        at(FENCE_H if fx - 1 < i < fx + fw else FENCE_POST, i, fy - 1)
        at(FENCE_H if fx - 1 < i < fx + fw and i != fx + 2 else FENCE_POST, i, fy + fh)
    for j in range(fy, fy + fh):
        at(FENCE_V, fx - 1, j)
        at(FENCE_V, fx + fw, j)
    at(SCARECROW, fx + 3, fy + 1)
    at(HAY, fx, fy + 3)
    at(HAY_PILE, fx + 5, fy)
    at(CHICKEN, fx + 1, fy + 1)
    at(CHICKEN, fx + 4, fy + 2)
    at(HOE, 0, 1)
    at(FORK, 10, 1)
    at(HAY, 10, 6)
    at(CHICKEN, 9, 7)
    d.text((ox + cols * T + 30, oy + 10), "• enclos : 16 à 30 cases de terre\n  battue, clôture tout autour, une\n  ouverture (on y entre)\n• foin ×2 à 4, dedans et dehors\n• 1 à 3 poulets qui se promènent\n  DANS l'enclos (on ne les dérange pas)\n• 1 épouvantail au milieu\n• houe et fourche contre les murs\n• 1 poulet DEHORS : on le touche,\n  il panique et va se viander\n  contre un mur (plumes, cuisse)", fill=(220, 214, 190), font=font)

    # Le Kobold fermier.
    d.text((20, 880), "LE KOBOLD FERMIER (PNJ) — chapeau de paille, salopette, brin de paille", fill=(240, 192, 80), font=bold)
    put(FARMER, 20, 920, "fermier (face)", SCHRAT_PAL, 8)

    # Les statues.
    d.text((20, 1110), "4 STATUES (décor ; pierre, comme la statue actuelle)", fill=(240, 192, 80), font=bold)
    x = 20
    for rows, lab in [(STATUE_KOBOLD, "A · Kobold héroïque (trognon\n     de pomme brandi)"), (STATUE_KNIGHT, "B · chevalier sans tête\n     (casque au pied)"), (STATUE_HEN, "C · la poule (hommage)"), (STATUE_NUN, "D · nonne en prière")]:
        put(rows, x, 1150, lab)
        x += 16 * S + 170
    out.save("art/ferme_v1.png")


if __name__ == "__main__":
    main()
