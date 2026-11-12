"""Roue d'actions : 4 propositions de design (Thomas, 2026-11-12 : « propose des nouveaux designs pour la roue »),
dessinées sur une vraie capture du jeu, avec les vrais pictogrammes. python3 art/roue_v1.py → art/roue_v1.png"""
import math
import re
from PIL import Image, ImageDraw, ImageFont, ImageFilter

SRC = open("src/ui/icons.ts").read()
PAL = dict(re.findall(r'"?(\w)"?: "(#[0-9a-f]{6})"', SRC.split("export const PALETTE")[1].split("};")[0]))
UI = SRC.split("const UI_ICONS = {")[1]


def icon(name, size):
    block = UI.split(f"  {name}: [")[1].split("],")[0]
    rows = re.findall(r'"([^"]*)"', block)
    im = Image.new("RGBA", (len(rows[0]), len(rows)), (0, 0, 0, 0))
    for y, r in enumerate(rows):
        for x, c in enumerate(r):
            if c != "." and c in PAL:
                im.putpixel((x, y), tuple(int(PAL[c][i:i + 2], 16) for i in (1, 3, 5)) + (255,))
    return im.resize((size, size), Image.NEAREST)


ACTIONS = [("search", "Fouiller", "5 tours, d20 + Fouille", True), ("push", "Pousser", "d20 + Force", True),
           ("disengage", "Se dégager", "d20 + Agilité", False), ("item", "Objet", "bientôt", False),
           ("rest", "Repos", "20 tours · ½ PV", True), ("hide", "Se cacher", "d20 + Discrétion", False)]
F = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf"
GOLD = (240, 192, 80); BTN = (58, 44, 30); BTN_HI = (110, 86, 52); BTN_LO = (26, 18, 12); DIM = (150, 140, 120); CREAM = (240, 230, 200)
S = 2  # la capture est à l'échelle 2
HERO = (174 * S, (272 + 50) * S)  # case du héros (le canevas commence 50 px sous le haut)
FRAME = (50 * S, 594 * S)


def base():
    im = Image.open("/tmp/dbg/wheel_base.png").convert("RGB").crop((0, 0, 720, 1520))
    return im


def dim_map(im, alpha=110):
    ov = Image.new("RGBA", im.size, (8, 6, 12, 0))
    d = ImageDraw.Draw(ov)
    d.rectangle([0, FRAME[0], im.width, FRAME[1]], fill=(8, 6, 12, alpha))
    return Image.alpha_composite(im.convert("RGBA"), ov)


def bevel(d, box, fill=BTN, on=True):
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=fill if on else (40, 34, 30))
    d.line([(x0, y0), (x1, y0)], fill=BTN_HI if on else (60, 54, 50), width=4)
    d.line([(x0, y0), (x0, y1)], fill=BTN_HI if on else (60, 54, 50), width=4)
    d.line([(x0, y1), (x1, y1)], fill=BTN_LO, width=4)
    d.line([(x1, y0), (x1, y1)], fill=BTN_LO, width=4)


def paste_icon(im, name, cx, cy, size, on=True):
    ic = icon(name, size)
    if not on:
        g = ic.convert("LA").convert("RGBA")
        g.putalpha(ic.getchannel("A").point(lambda a: a * 0.55))
        ic = g
    im.alpha_composite(ic, (int(cx - size / 2), int(cy - size / 2)))


def A():
    """A — Couronne de médaillons ronds, avec le nom sous chaque action."""
    im = dim_map(base())
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(F, 22)
    R = 160
    cx, cy = HERO
    d.ellipse([cx - R - 70, cy - R - 70, cx + R + 70, cy + R + 70], outline=(110, 86, 52, 120), width=3)
    for i, (n, label, _, on) in enumerate(ACTIONS):
        a = math.radians(-90 + i * 60)
        x, y = cx + R * math.cos(a), cy + R * math.sin(a)
        r = 52
        d.ellipse([x - r - 4, y - r - 4, x + r + 4, y + r + 4], fill=BTN_LO)
        d.ellipse([x - r, y - r, x + r, y + r], fill=BTN if on else (40, 34, 30), outline=GOLD if on else (80, 74, 66), width=4)
        paste_icon(im, n, x, y - 6, 64, on)
        tw = d.textlength(label, font=f)
        d.rectangle([x - tw / 2 - 6, y + r - 2, x + tw / 2 + 6, y + r + 26], fill=(20, 14, 10))
        d.text((x - tw / 2, y + r), label, font=f, fill=CREAM if on else DIM)
    return im


def B():
    """B — Arc au-dessus de la barre du bas, à portée du pouce ; la carte reste visible."""
    im = base().convert("RGBA")
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(F, 20)
    cx, cy = 360, FRAME[1] + 130
    R = 300
    d.arc([cx - R - 70, cy - R - 70, cx + R + 70, cy + R + 70], 196, 344, fill=(110, 86, 52, 255), width=4)
    d.arc([cx - R - 64, cy - R - 64, cx + R + 64, cy + R + 64], 196, 344, fill=(14, 10, 8, 225), width=128)
    d.arc([cx - R + 66, cy - R + 66, cx + R - 66, cy + R - 66], 196, 344, fill=(110, 86, 52, 255), width=4)
    for i, (n, label, _, on) in enumerate(ACTIONS):
        a = math.radians(202 + i * 27.2)
        x, y = cx + R * math.cos(a), cy + R * math.sin(a)
        s = 50
        bevel(d, [x - s, y - s, x + s, y + s], on=on)
        paste_icon(im, n, x, y - 8, 64, on)
        tw = d.textlength(label, font=f)
        d.text((x - tw / 2, y + s - 26), label, font=f, fill=CREAM if on else DIM)
    return im


def C():
    """C — Barre d'actions qui monte au-dessus du dé : grandes touches en ligne, nom dessous."""
    im = base().convert("RGBA")
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(F, 19)
    top = FRAME[1] - 170
    d.rectangle([12, top, 708, FRAME[1] - 6], fill=(14, 10, 8, 235), outline=(110, 86, 52, 255), width=4)
    w = (696 - 12 * 7) / 6
    for i, (n, label, _, on) in enumerate(ACTIONS):
        x0 = 24 + i * (w + 12)
        bevel(d, [x0, top + 14, x0 + w, top + 14 + w], on=on)
        paste_icon(im, n, x0 + w / 2, top + 14 + w / 2, 72, on)
        tw = d.textlength(label, font=f)
        d.text((x0 + w / 2 - tw / 2, top + 24 + w), label, font=f, fill=CREAM if on else DIM)
    return im


def D():
    """D — Plaque de parchemin au milieu : 2 × 3 grandes actions, nom et une ligne d'aide."""
    im = dim_map(base(), 150)
    d = ImageDraw.Draw(im)
    f = ImageFont.truetype(F, 24)
    f2 = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 17)
    x0, y0, x1, y1 = 40, 300, 680, 1000
    d.rectangle([x0, y0, x1, y1], fill=(228, 212, 170), outline=(90, 60, 30), width=8)
    d.rectangle([x0 + 10, y0 + 10, x1 - 10, y1 - 10], outline=(160, 120, 70), width=3)
    title = "ACTIONS"
    ft = ImageFont.truetype(F, 30)
    d.text(((x0 + x1) / 2 - d.textlength(title, font=ft) / 2, y0 + 22), title, font=ft, fill=(90, 50, 20))
    cw, ch = (x1 - x0 - 60) / 2, 200
    for i, (n, label, help_, on) in enumerate(ACTIONS):
        col, row = i % 2, i // 2
        bx = x0 + 20 + col * (cw + 20)
        by = y0 + 80 + row * (ch + 10)
        d.rectangle([bx, by, bx + cw, by + ch - 10], fill=(242, 230, 196) if on else (200, 190, 165), outline=(140, 100, 60), width=3)
        d.rectangle([bx + 14, by + 18, bx + 110, by + 114], fill=BTN if on else (90, 84, 76))
        paste_icon(im, n, bx + 62, by + 66, 76, on)
        d.text((bx + 124, by + 30), label, font=f, fill=(60, 34, 14) if on else (120, 110, 96))
        d.text((bx + 124, by + 70), help_, font=f2, fill=(90, 70, 50) if on else (130, 120, 104))
        if not on:
            d.text((bx + 124, by + 100), "impossible ici", font=f2, fill=(150, 60, 50))
    return im


def plate():
    designs = [("A", "Couronne de médaillons\nnom sous chaque action", A()), ("B", "Arc à portée du pouce,\nla carte reste visible", B()),
               ("C", "Barre d'actions au-dessus\ndu dé, grandes touches", C()), ("D", "Plaque au milieu : nom\net une ligne d'aide", D())]
    W, H = 380, 800
    out = Image.new("RGB", (4 * (W + 20) + 20, H + 150), (26, 20, 16))
    dr = ImageDraw.Draw(out)
    ft = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 22)
    fs = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 16)
    dr.text((20, 12), "Roue d'actions — 4 propositions (vrais pictogrammes, sur une capture du jeu ; grisé = impossible ici)", font=ft, fill=GOLD)
    for i, (k, note, im) in enumerate(designs):
        x = 20 + i * (W + 20)
        small = im.convert("RGB").resize((W, int(im.height * W / im.width)), Image.LANCZOS)
        out.paste(small.crop((0, 0, W, H)), (x, 50))
        dr.text((x, H + 58), k, font=ft, fill=(255, 222, 120))
        dr.multiline_text((x + 30, H + 60), note, font=fs, fill=(230, 220, 192), spacing=4)
    out.save("art/roue_v1.png")


plate()
