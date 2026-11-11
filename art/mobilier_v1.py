"""Mobilier des 5 salles de fouille, v1 (Thomas, 2026-11-11 : « Oui implémente. Mais pour l'instant, pas de règles particulières »).

Vu légèrement du dessus, comme le coffre. 16×16, contour sombre automatique, palette de src/ui/icons.ts.
Garde-manger : tonneau, caisse, sac de grain. Ossuaire : tas d'os, sarcophage. Bibliothèque : étagère, pupitre.
Dortoir : paillasse, malle. Forge : enclume, établi, râtelier d'armes.
Écrit art/mobilier_v1.png et art/mobilier_v1.json. Lancer depuis la racine du dépôt.
"""
import importlib.util, json
from PIL import Image, ImageDraw, ImageFont

spec = importlib.util.spec_from_file_location("v3", "art/objets_v3.py")
v3 = importlib.util.module_from_spec(spec)
spec.loader.exec_module(v3)
outline, pad, render = v3.outline, v3.pad, v3.render
PAL = dict(v3.PAL)
N = {}

N["tonneau"] = outline(pad([
    "",
    ".....tTTTTt.....",
    "....tBbBBbBt....",
    "...tBbBBbBBbt...",
    "...TBbBBbBBbT...",
    "...DDDDDDDDDD...",
    "...TBBbBBbBBT...",
    "...TBBbBBbBBT...",
    "...TBBbBBbBBT...",
    "...TBBbBBbBBT...",
    "...DDDDDDDDDD...",
    "...TBBbBBbBBT...",
    "....tBbBBbBt....",
    ".....tttttt.....",
]))
N["caisse"] = outline(pad([
    "", "",
    "..TTTTTTTTTTTT..",
    "..TBBBBBBBBBBt..",
    "..TBtBBBBBBtBt..",
    "..TBBtBBBBtBBt..",
    "..TBBBtBBtBBBt..",
    "..TBBBBttBBBBt..",
    "..TBBBtBBtBBBt..",
    "..TBBtBBBBtBBt..",
    "..TBtBBBBBBtBt..",
    "..TBBBBBBBBBBt..",
    "..tttttttttttt..",
]))
N["sac_grain"] = outline(pad([
    "", "",
    "......zLz.......",
    ".....zZZZz......",
    "....ZZZZZZz.....",
    "...ZZGZZZZZz....",
    "...ZZZZGZZZz....",
    "..ZZZZZZZZZZz...",
    "..ZZZZZZZZZZz...",
    "..ZzZZZZZZZzz...",
    "...ZZZZZZZZz.G..",
    "....zzzzzzz.G.G.",
]))
N["os"] = outline(pad([
    "", "",
    ".....WWWWWW.....",
    "....WSSSSSSW....",
    "...WSSSSSSSSW...",
    "...WSKKSSKKSW...",
    "...WSKKSSKKSW...",
    "....WSSKKSSW....",
    ".....WSSSSW.....",
    "..WW.WLSLSW.WW..",
    "..WSSWWWWWWSSW..",
    "...WSSSSSSSSW...",
    "..WW........WW..",
]))
N["sarcophage"] = outline(pad([
    "",
    "....DDDDDDDD....",
    "...DSSSSSSSSD...",
    "...DScccccccD...",
    "...DScSSSSScD...",
    "...DScSccScD....",
    "...DScSSSSScD...",
    "...DScSccScD....",
    "...DScSSSSScD...",
    "...DScSSSSScD...",
    "...DScccccccD...",
    "...DSSSSSSSSD...",
    "....DDDDDDDD....",
]))
N["etagere"] = outline(pad([
    "",
    "..TTTTTTTTTTTT..",
    "..TRrUuEeRrPpT..",
    "..TRrUuEeRrPpT..",
    "..tttttttttttt..",
    "..TUuPpGgRrEeT..",
    "..TUuPpGgRrEeT..",
    "..tttttttttttt..",
    "..TEeRr..UuGgT..",
    "..TEeRr..UuGgT..",
    "..tttttttttttt..",
    "..T..........T..",
]))
N["pupitre"] = outline(pad([
    "", "",
    "....LLLLLLLL....",
    "...LLLcLLcLLL...",
    "...LcLLLLLcLL...",
    "...LLLcLLLLLL...",
    "....TTTTTTTT....",
    ".......Bt.......",
    ".......Bt.......",
    ".......Bt.......",
    ".....TTBtTT.....",
]))
N["paillasse"] = outline(pad([
    "", "", "",
    "..ZZZZZZZZZZZZ..",
    "..ZLLLZZzZZzZz..",
    "..ZLLLZzZZzZZz..",
    "..ZZZZZZzZZzZz..",
    "..ZzZZzZZzZZZz..",
    "..ZZzZZzZZzZZz..",
    "..zzzzzzzzzzzz..",
]))
N["malle"] = outline(pad([
    "", "",
    "...TTTTTTTTTT...",
    "..TBBBBBBBBBBt..",
    "..DDDDDDDDDDDD..",
    "..TBBBBGGBBBBt..",
    "..TBBBBGgBBBBt..",
    "..TBBBBBBBBBBt..",
    "..DDDDDDDDDDDD..",
    "..TBBBBBBBBBBt..",
    "..tttttttttttt..",
]))
N["enclume"] = outline(pad([
    "", "", "",
    "..SSSSSSSSSS....",
    ".SDDDDDDDDDDSSS.",
    "..DDDDDDDDDDDD..",
    "....DDDDDDD.....",
    ".....CCCCC......",
    ".....CCCCC......",
    "....bBBBBBb.....",
    "...bBBBBBBBb....",
]))
N["etabli"] = outline(pad([
    "", "",
    ".TTTTTTTTTTTTTT.",
    ".TBBBBBBBBBBBBt.",
    ".TBDDb..SSBBBBt.",
    ".TBDDb..SSBBcBt.",
    ".TBBBBBBBBBBBBt.",
    ".tttttttttttttt.",
    ".Tt..........Tt.",
    ".Tt..........Tt.",
    ".Tt..........Tt.",
]))
N["ratelier"] = outline(pad([
    "",
    "...W...W...S....",
    "...W...W..SWS...",
    "...W...W...W....",
    "...W...W...W....",
    "..TTTTTTTTTTTT..",
    "...S...W...W....",
    "...S...W...W....",
    "..bTb.bTb..B....",
    "...B...B...B....",
    "..TTTTTTTTTTTT..",
    "..T..........T..",
]))

ROOMS = [
    ("Garde-manger", ["tonneau", "caisse", "sac_grain"]),
    ("Ossuaire", ["os", "sarcophage"]),
    ("Bibliothèque", ["etagere", "pupitre"]),
    ("Dortoir", ["paillasse", "malle"]),
    ("Forge", ["enclume", "etabli", "ratelier"]),
]

if __name__ == "__main__":
    json.dump({"palette": PAL, "icons": N}, open("art/mobilier_v1.json", "w"), ensure_ascii=False)
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 14)
    fs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf", 11)
    W, H = 900, 30 + len(ROOMS) * 130
    sheet = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 16), "MOBILIER v1 — salles de fouille (à valider)", fill=(255, 243, 200), font=f, anchor="mm")
    for i, (room, kinds) in enumerate(ROOMS):
        y = 40 + i * 130
        d.text((20, y + 40), room.upper(), fill=(214, 170, 84), font=fs)
        x = 160
        for k in kinds:
            im = render(N[k], 5, PAL)
            d.rectangle([x, y, x + 96, y + 96], fill=(70, 61, 82), outline=(58, 50, 68), width=2)
            sheet.paste(im, (x + 8, y + 8), im)
            d.text((x + 48, y + 108), k.replace("_", " "), fill=(220, 210, 190), font=fs, anchor="mm")
            x += 120
    sheet.save("art/mobilier_v1.png")
    print(sheet.size)


def export_ts():
    """Écrit src/render/sprites/furniture.ts (dessins du mobilier pour le jeu)."""
    lines = ["// FICHIER GÉNÉRÉ par art/mobilier_v1.py (export_ts) : ne pas modifier à la main.",
             "/** Mobilier des salles de fouille, 16×16, planche v1 (2026-11-11). */",
             "export const FURNITURE_PALETTE: Record<string, string> = " + json.dumps(PAL) + ";",
             "export const FURNITURE: Record<string, readonly string[]> = {"]
    for k, rows in N.items():
        lines.append(f"  {k}: [")
        lines += [f'    "{r}",' for r in rows]
        lines.append("  ],")
    lines.append("};")
    open("src/render/sprites/furniture.ts", "w").write("\n".join(lines) + "\n")


if __name__ == "__main__":
    export_ts()
