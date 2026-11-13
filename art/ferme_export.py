"""Exporte les dessins validés de la ferme (planches ferme_v1 / ferme_v2) vers src/render/sprites/ferme.ts.
python3 art/ferme_export.py"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ferme_v1 as v1  # noqa: E402
import ferme_v2 as v2  # noqa: E402
from trainards_v3 import hay_bale  # noqa: E402

LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def encode(img):
    img = img.convert("RGBA")
    px = img.load()
    pal, rows = {}, []
    for y in range(img.height):
        row = ""
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a < 128:
                row += "."
                continue
            hexc = "#%02x%02x%02x" % (r, g, b)
            if hexc not in pal:
                pal[hexc] = LETTERS[len(pal)]
            row += pal[hexc]
        rows.append(row)
    return {"palette": {v: k for k, v in pal.items()}, "rows": rows}


def main():
    out = {
        "soil": encode(v1.sprite(v1.SOIL)),
        "soil2": encode(v1.sprite(v1.SPROUT)),
        "fenceH": encode(v1.sprite(v1.FENCE_H)),
        "fenceV": encode(v1.sprite(v2.FENCE_V3)),
        "fenceCornerL": encode(v1.sprite(v2.FENCE_CORNER_L)),
        "fenceCornerR": encode(v1.sprite(v2.FENCE_CORNER_R)),
        "fencePost": encode(v1.sprite(v1.FENCE_POST)),
        "hoe": encode(v1.sprite(v1.HOE)),
        "fork": encode(v1.sprite(v1.FORK)),
        "hayBale": encode(hay_bale().img()),
        "scarecrow": encode(v1.sprite(v1.SCARECROW)),
        "statueApple": encode(v1.sprite(v2.STATUE_APPLE)),
        "statueKnight": encode(v1.sprite(v1.STATUE_KNIGHT)),
        "statueHen": encode(v1.sprite(v1.STATUE_HEN)),
        "statueNun": encode(v1.sprite(v1.STATUE_NUN)),
    }
    farmer = encode(v1.sprite(v1.FARMER, v1.SCHRAT_PAL))
    ts = "// Fichier généré par art/ferme_export.py (planches art/ferme_v1.png et ferme_v2.png). Ne pas modifier à la main.\n\n"
    ts += "export const FERME: Record<string, { palette: Record<string, string>; rows: string[] }> = " + json.dumps(out, indent=2) + ";\n\n"
    ts += "/** Le Kobold fermier (16 × 16, de face). */\nexport const FERMIER = " + json.dumps(farmer, indent=2) + ";\n"
    open("src/render/sprites/ferme.ts", "w").write(ts)


if __name__ == "__main__":
    main()
