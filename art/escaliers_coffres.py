"""Proposition v1 : escaliers (descendant, montant) et coffre (fermé, ouvert), en pixels 16x16, à valider avec Thomas."""
from PIL import Image, ImageDraw, ImageFont

PAL = {"K": "#120d08", "N": "#06050a", "H": "#2a2e40", "C": "#4e5570", "D": "#7f88a6", "c": "#a4abc8", "S": "#c3cbe0",
       "W": "#f4f7ff", "B": "#9a6a34", "b": "#5a3817", "T": "#b9824a", "t": "#7a5230", "G": "#f0c050", "g": "#a87c1c",
       "s": "#0c0a12", "R": "#d03a44", "r": "#8e1f28"}

SPRITES = {
 # Escalier qui descend : des marches de pierre qui s'enfoncent dans le noir, de plus en plus étroites et sombres.
 "stairs_down": [
  "KKKKKKKKKKKKKKKK",
  "KCHNNNNNNNNNNHCK",
  "KCHNNNNNNNNNNHCK",
  "KCHHKKKKKKKKHHCK",
  "KCHHHHHHHHHHHHCK",
  "KCHKKKKKKKKKKHCK",
  "KCHCCCCCCCCCCHCK",
  "KCHCCCCCCCCCCHCK",
  "KCKKKKKKKKKKKKCK",
  "KCDDDDDDDDDDDDCK",
  "KCDDDDDDDDDDDDCK",
  "KKKKKKKKKKKKKKKK",
  "KcccccccccccccDK",
  "KcSSSSSSSSSSScDK",
  "KDDDDDDDDDDDDDDK",
  "KKKKKKKKKKKKKKKK",
 ],
 # Escalier qui monte : des marches claires qui s'élèvent vers le haut de la case, la plus haute la plus éclairée.
 "stairs_up": [
  "................",
  "...KKKKKKKKKK...",
  "...KWWWWWWWWK...",
  "...KSSSSSSSSK...",
  "..KKKKKKKKKKKK..",
  "..KSSSSSSSSSSK..",
  "..KccccccccccK..",
  ".KKKKKKKKKKKKKK.",
  ".KccccccccccccK.",
  ".KDDDDDDDDDDDDK.",
  "KKKKKKKKKKKKKKKK",
  "KDDDDDDDDDDDDDDK",
  "KCCCCCCCCCCCCCCK",
  "KKKKKKKKKKKKKKKK",
  "................",
  "................",
 ],
 # Coffre fermé, vu un peu du dessus : couvercle de bois clair, deux bandes d'acier, moraillon doré.
 "chest": [
  "................",
  "................",
  "...KKKKKKKKKK...",
  "..KTTSTTTTSTTK..",
  "..KTBSBBBBSBTK..",
  "..KBBSBBBBSBBK..",
  "..KKKKKGGKKKKK..",
  "..KtBSBGGBSBtK..",
  "..KBBSBgGBSBBK..",
  "..KBBSBBBBSBBK..",
  "..KbbSbbbbSbbK..",
  "..KKKKKKKKKKKK..",
  "...ss......ss...",
  "................",
  "................",
  "................",
 ],
  # Piège à pointes (proposition, en jeu en attendant validation) : plaque d'acier sombre hérissée de pointes, taches rouges.
 "trap": [
  "................",
  "................",
  "..KKKKKKKKKKKK..",
  "..KHHHHHHHHHHK..",
  "..KHSKHHHHSKHK..",
  "..KHDKHrHHDKHK..",
  "..KHHHHSKHHHHK..",
  "..KHHHHDKHHHHK..",
  "..KHSKHHHHSKHK..",
  "..KHDKHHHrDKHK..",
  "..KHHHHSKHHHHK..",
  "..KHrHHDKHHHHK..",
  "..KHHHHHHHHHHK..",
  "..KKKKKKKKKKKK..",
  "................",
  "................",
 ],
 # Coffre ouvert et vide : le couvercle relevé montre son envers sombre, l'intérieur est noir.
 "chest_open": [
  "................",
  "...KKKKKKKKKK...",
  "..KbbSbbbbSbbK..",
  "..KbtSttttStbK..",
  "..KKKKKKKKKKKK..",
  "..KNNNNNNNNNNK..",
  "..KNNNNNNNNNNK..",
  "..KKKKKKKKKKKK..",
  "..KtBSBBBBSBtK..",
  "..KBBSBBBBSBBK..",
  "..KBBSBBBBSBBK..",
  "..KbbSbbbbSbbK..",
  "..KKKKKKKKKKKK..",
  "...ss......ss...",
  "................",
  "................",
 ],
}
for n, rows in SPRITES.items():
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), n
    assert all(ch == "." or ch in PAL for r in rows for ch in r), n

FLOOR = (70, 61, 82)
FLOOR_EDGE = (58, 50, 68)

def render(name, scale):
    im = Image.new("RGB", (16 * scale, 16 * scale), FLOOR)
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 16 * scale - 1, 16 * scale - 1], outline=FLOOR_EDGE, width=max(1, scale // 4))
    for y, row in enumerate(SPRITES[name]):
        for x, ch in enumerate(row):
            if ch == ".": continue
            d.rectangle([x * scale, y * scale, (x + 1) * scale - 1, (y + 1) * scale - 1], fill=PAL[ch])
    return im

def current(kind, size):
    """Le dessin actuel du jeu, refait à l'identique pour la comparaison."""
    im = Image.new("RGB", (size, size), FLOOR); d = ImageDraw.Draw(im); t = size
    if kind == "stairs_down":
        for i in range(3): d.rectangle([t*.15, t*(.2+i*.22), t*.15+t*(.3+i*.2), t*(.2+i*.22)+t*.14], fill="#e0b040")
    elif kind == "stairs_up":
        for i in range(3):
            w = t*(.7-i*.2); d.rectangle([t*.85-w, t*(.64-i*.22), t*.85, t*(.64-i*.22)+t*.14], fill="#b9c0dc")
    else:
        d.rectangle([t*.18, t*.3, t*.82, t*.76], fill="#3a2410")
        if kind == "chest":
            d.rectangle([t*.22, t*.34, t*.78, t*.72], fill="#7a4e22")
            d.rectangle([t*.18, t*.47, t*.82, t*.53], fill="#f0c050"); d.rectangle([t*.45, t*.44, t*.55, t*.58], fill="#f0c050")
        else:
            d.rectangle([t*.22, t*.34, t*.78, t*.54], fill="#1c1410")
    return im

if __name__ == "__main__":
    S = 10; cell = 16 * S
    names = [("stairs_down", "ESCALIER QUI DESCEND"), ("stairs_up", "ESCALIER QUI MONTE"), ("chest", "COFFRE FERME"), ("chest_open", "COFFRE OUVERT")]
    W = 30 + len(names) * (cell + 30); H = 520
    sheet = Image.new("RGB", (W, H), (26, 20, 14)); d = ImageDraw.Draw(sheet)
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 15)
    for i, (n, label) in enumerate(names):
        x = 30 + i * (cell + 30)
        d.text((x + cell / 2, 22), label, fill=(255, 243, 200), font=f, anchor="mm")
        sheet.paste(render(n, S), (x, 40))
        # taille réelle en jeu (environ 48 px) : proposé puis actuel
        sheet.paste(render(n, 3), (x + 10, 40 + cell + 40))
        sheet.paste(current(n, 48), (x + cell - 58, 40 + cell + 40))
        d.text((x + 34, 40 + cell + 100), "nouveau", fill=(200, 200, 200), font=f, anchor="mm")
        d.text((x + cell - 34, 40 + cell + 100), "actuel", fill=(150, 150, 150), font=f, anchor="mm")
        # actuel en grand pour comparer
        sheet.paste(current(n, cell // 2), (x + cell // 4, 40 + cell + 125))
        d.text((x + cell / 2, 40 + cell + 125 + cell // 2 + 14), "ACTUEL (agrandi)", fill=(150, 150, 150), font=f, anchor="mm")
    sheet.save("art/escaliers_coffres_v1.png"); print(sheet.size)


def export_decor(path="src/render/sprites/decor.ts"):
    """Écrit les dessins validés (Thomas, 2026-11-11) dans le jeu. Lancer : python3 art/escaliers_coffres.py export"""
    keys = {"stairs_down": "stairsDown", "stairs_up": "stairsUp", "chest": "chest", "chest_open": "chestOpen", "trap": "trap"}
    out = ["// FICHIER GÉNÉRÉ par art/escaliers_coffres.py (export_decor) : ne pas modifier à la main.",
           "/** Escaliers et coffres en pixels 16×16, validés par Thomas le 2026-11-11 (planche v1). */",
           "export const DECOR_PALETTE: Record<string, string> = " + str(PAL).replace("'", '"') + ";",
           "export const DECOR = {"]
    for n, rows in SPRITES.items():
        out.append(f"  {keys[n]}: [")
        out += [f'    "{r}",' for r in rows]
        out.append("  ],")
    out.append("} as const;")
    open(path, "w", encoding="utf8").write("\n".join(out) + "\n")

if __name__ == "__main__" and len(__import__("sys").argv) > 1 and __import__("sys").argv[1] == "export":
    export_decor()
