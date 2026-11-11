"""Mise en page commune des planches à valider : la salle agrandie, puis chaque élément (et ses images d'animation)."""
from PIL import Image, ImageDraw
from pix import up, font


def planche(title, room, pieces, path, S=4, note=None):
    """`room` : image RGBA de la salle ; `pieces` : liste de (étiquette, [images]) — plusieurs images = une animation."""
    big = up(room.convert("RGB"), S)
    boxes = []
    for label, frames in pieces:
        ims = [up(f, 4) for f in frames]
        w = sum(i.width for i in ims) + 8 * (len(ims) - 1)
        bw, bh = max(w + 16, 130, len(label) * 7 + 6), max(i.height for i in ims) + 16
        bg = Image.new("RGB", (bw, bh), (70, 61, 82))
        x = (bw - w) // 2
        for im in ims:
            bg.paste(im, (x, bh - im.height - 8), im)
            x += im.width + 8
        boxes.append((label, bg))
    W = max(big.width + 40, 900)
    rows, row, rw = [], [], 20
    for b in boxes:
        if row and rw + b[1].width > W - 20:
            rows.append(row)
            row, rw = [], 20
        row.append(b)
        rw += b[1].width + 12
    if row:
        rows.append(row)
    H = 50 + big.height + 20 + sum(max(b[1].height for b in r) + 30 for r in rows) + (30 if note else 10)
    sheet = Image.new("RGB", (W, H), (26, 20, 14))
    d = ImageDraw.Draw(sheet)
    d.text((W // 2, 22), title, fill=(255, 243, 200), font=font(15), anchor="mm")
    sheet.paste(big, ((W - big.width) // 2, 44))
    y = 44 + big.height + 20
    for r in rows:
        x = 20
        for label, bg in r:
            sheet.paste(bg, (x, y))
            d.text((x, y + bg.height + 4), label, fill=(220, 210, 190), font=font(11, False))
            x += bg.width + 12
        y += max(b[1].height for b in r) + 30
    if note:
        d.text((20, H - 22), note, fill=(200, 190, 170), font=font(11, False))
    sheet.save(path)
    print(path, sheet.size)
