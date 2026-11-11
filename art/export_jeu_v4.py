"""Exporte vers le jeu les dessins validés le 2026-11-11 : l'araignée (art/araignee_v1.png), la toile d'araignée et
les trainards (tonneau, caisse, caisses empilées ; art/trainards_v3.png). Lancer depuis la racine du dépôt :
    python3 art/export_jeu_v4.py
Écrit src/render/sprites/araignee.ts et src/render/sprites/trainards.ts (lignes de lettres + une palette par dessin).
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from araignee_v1 import spider
from trainards_v3 import barrel_v3, crate_v3, crate_stack_v3, cobweb

LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def encode(im):
    a = np.array(im.convert("RGBA"))
    pal, rows = {}, []
    for y in range(a.shape[0]):
        row = ""
        for x in range(a.shape[1]):
            r, g, b, al = a[y, x]
            if al < 40:
                row += "."
                continue
            key = "#%02x%02x%02x" % (r, g, b) if al >= 250 else "rgba(%d,%d,%d,%.2f)" % (r, g, b, al / 255)
            if key not in pal:
                pal[key] = LETTERS[len(pal)]
            row += pal[key]
        rows.append(row)
    return {v: k for k, v in pal.items()}, rows


def write(path, const, doc, sprites):
    out = [f"// FICHIER GÉNÉRÉ par art/export_jeu_v4.py : ne pas modifier à la main.", f"/** {doc} */",
           f"export const {const}: Record<string, {{ rows: string[]; palette: Record<string, string> }}> = {{"]
    for name, im in sprites.items():
        palette, rows = encode(im)
        out.append(f"  {name}: {{ palette: {json.dumps(palette)}, rows: [")
        out += [f'    "{r}",' for r in rows]
        out.append("  ] },")
    out.append("};")
    open(path, "w").write("\n".join(out) + "\n")
    print(path, {k: v.size for k, v in sprites.items()})


if __name__ == "__main__":
    write("src/render/sprites/araignee.ts", "ARAIGNEE",
          "Araignée (planche art/araignee_v1.png, validée le 2026-11-11) : repos, marche, morsure, morte. Vue de 3/4, une seule face.",
          {"idle0": spider("idle", 0).img(), "idle1": spider("idle", 1).img(), "walk0": spider("walk", 0).img(),
           "walk1": spider("walk", 1).img(), "bite": spider("bite").img(), "dead": spider("dead").img()})
    web = cobweb().img()
    write("src/render/sprites/trainards.ts", "TRAINARDS",
          "Trainards (art/trainards_v3.png, validée) : tonneau, caisse, caisses empilées, et la toile d'araignée des quatre coins.",
          {"barrel": barrel_v3().img(), "crate": crate_v3().img(), "crateStack": crate_stack_v3().img(),
           "webTL": web, "webTR": web.transpose(Image.FLIP_LEFT_RIGHT), "webBL": web.transpose(Image.FLIP_TOP_BOTTOM),
           "webBR": web.transpose(Image.ROTATE_180)})
