"""Pictogrammes de la roue d'actions, dans le style des icônes du jeu (16x16, palette de src/ui/icons.ts)."""
from PIL import Image, ImageDraw, ImageFont
PALETTE = {"K":"#120d08","W":"#f4f7ff","S":"#c3cbe0","D":"#7f88a6","G":"#f0c050","g":"#a87c1c","B":"#9a6a34","b":"#5a3817","R":"#d03a44","r":"#8e1f28","L":"#e6dcc0","C":"#6e7594","c":"#a4abc8","T":"#b9824a","t":"#7a5230","P":"#7a5aa0","p":"#4a3266","H":"#3a4058","U":"#4a8fd0","u":"#2a5a94","V":"#9fd0f4"}
ICONS = {
 "search": [  # loupe : monture dorée, verre bleuté à reflet, manche de bois
  "....KKKKK.......",
  "..KKGGGGGKK.....",
  ".KGGKKKKKGgK....",
  ".KGKVVVVUKgK....",
  "KGKVWWVVUUKgK...",
  "KGKVWVVVUUKgK...",
  "KGKVVVVUUUKgK...",
  "KGKVVVUUUuKgK...",
  "KGKUUUUUuuKgK...",
  ".KGKUUUuuKgK....",
  ".KGgKKKKKggKK...",
  "..KKgggggKKTTK..",
  "....KKKKKKTTBK..",
  "..........KBTBK.",
  "...........KBbbK",
  "............KKK.",
 ],
 "hide": [  # ninja simplifié : cagoule sombre, bandeau rouge noué, deux yeux
  "................",
  "....KKKKKKKK....",
  "...KHHHHHHHHK...",
  "..KHCCHHHHHHHK..",
  "..KHCHHHHHHHHK..",
  "..KRRRRRRRRRRKK.",
  "..KrrrrrrrrrrKRK",
  "..KLLLLLLLLLLKRK",
  "..KLWKLLLLWKLKrK",
  "..KLLLLLLLLLLK.K",
  "..KHHHHHHHHHHK..",
  "..KHHHHHHHHHHK..",
  "...KHHHHHHHHK...",
  "....KHHHHHHK....",
  ".....KKKKKK.....",
  "................",
 ],
 "disengage": [  # flèche dorée qui bondit par-dessus deux cases
  "................",
  "....KKKKKK......",
  "..KKGGGGGGKK....",
  ".KGGGGGGGGGGK...",
  ".KGGGKKKKGGGGK..",
  "KGGGK....KGGGK..",
  "KGGGK....KGGGK..",
  "KGGGK..KKKGGGKKK",
  "KGGGK..KGGGGGGGK",
  "KGGGK...KGGGGGK.",
  "KgggK....KgggK..",
  "KKKKK.....KgK...",
  "...........K....",
  "................",
  "KLLLK.KLLLK.....",
  "KKKKK.KKKKK.....",
 ],
 "item": [  # fiole : bouchon de liège, verre, liquide rouge
  "................",
  "......KKKK......",
  "......KTTK......",
  ".....KKKKKK.....",
  ".....KWVVVK.....",
  "......KVVK......",
  "......KVVK......",
  ".....KVVVVK.....",
  "....KVWVVVVK....",
  "...KVWVVVVVVK...",
  "...KRRRRRRRRK...",
  "..KRWRRRRRRRrK..",
  "..KRWRRRRRRrrK..",
  "..KRRRRRRRrrrK..",
  "...KRRRRrrrrK...",
  "....KKKKKKKK....",
 ],
 "rest": [  # feu de camp : flammes sur deux bûches croisées
  ".......K........",
  "......KRK.......",
  "......KRRK......",
  ".....KRRRK..K...",
  ".....KRGRRKKRK..",
  "....KRRGGRRKRK..",
  "...KRRGGGGRRRK..",
  "...KRGGWWGGRRK..",
  "...KRGWWWWGRK...",
  "....KRGWWGRK....",
  "..KKKKKKKKKKKK..",
  ".KTTTTTTTTTTTBK.",
  ".KBBBBbBBBBBBbK.",
  "..KKKKKKKKKKKK..",
  ".KSK........KSK.",
  ".KKK........KKK.",
 ],
 "actions": [  # bouton du bas : la roue elle-même (cinq pastilles autour d'un centre doré)
  "......KKKK......",
  "......KLLK......",
  "......KLLK......",
  ".KKKK.KKKK.KKKK.",
  ".KLLK......KLLK.",
  ".KLLK.KKKK.KLLK.",
  ".KKKK.KGGK.KKKK.",
  "......KGGK......",
  "......KKKK......",
  "................",
  "...KKKK..KKKK...",
  "...KLLK..KLLK...",
  "...KLLK..KLLK...",
  "...KKKK..KKKK...",
  "................",
  "................",
 ],
}
for n, rows in ICONS.items():
    assert len(rows) == 16 and all(len(r) == 16 for r in rows), (n, [len(r) for r in rows])
    assert all(c == "." or c in PALETTE for r in rows for c in r), n

def render(name, scale, grey=False):
    im = Image.new("RGBA", (16 * scale, 16 * scale), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for y, row in enumerate(ICONS[name]):
        for x, c in enumerate(row):
            if c == ".": continue
            h = PALETTE[c].lstrip("#"); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
            if grey and c != "K":
                v = int((r * 3 + g * 5 + b * 2) / 10 * 0.6); r = g = b = v
            d.rectangle([x * scale, y * scale, (x + 1) * scale - 1, (y + 1) * scale - 1], fill=(r, g, b, 255))
    return im

if __name__ == "__main__":
    LABELS = [("search", "FOUILLER"), ("disengage", "SE DEGAGER"), ("item", "OBJET"), ("rest", "REPOS"), ("hide", "SE CACHER"), ("actions", "BOUTON DU BAS")]
    S = 12; pad = 26; cell = 16 * S + pad * 2
    sheet = Image.new("RGB", (cell * 3, (cell + 110) * 2), (26, 20, 14)); d = ImageDraw.Draw(sheet)
    f = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf", 22)
    for i, (n, lab) in enumerate(LABELS):
        ox = (i % 3) * cell; oy = (i // 3) * (cell + 110)
        d.rectangle([ox + 10, oy + 10, ox + cell - 10, oy + cell - 10], fill=(40, 30, 20), outline=(214, 170, 84), width=4)
        sheet.paste(render(n, S), (ox + pad, oy + pad), render(n, S))
        # taille réelle sur un bouton (2 px par point), actif puis grisé
        for k, g in enumerate((False, True)):
            bx = ox + 60 + k * 70; by = oy + cell + 4
            d.rectangle([bx, by, bx + 47, by + 47], fill=(40, 30, 20), outline=(214, 170, 84) if not g else (110, 104, 96), width=2)
            sheet.paste(render(n, 2, g), (bx + 8, by + 8), render(n, 2, g))
        d.text((ox + cell / 2, oy + cell + 76), lab, fill=(255, 243, 200), font=f, anchor="mm")
    sheet.save("art/pictos_roue_v1.png"); print(sheet.size)
