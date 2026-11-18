"""Ossuaire (section 3) : mobilier des salles bâties (Thomas, 2026-11-18, plans validés) → src/render/sprites/ossuaire.ts.

    python3 art/export_ossuaire.py   (écrit aussi art/ossuaire_mobilier_v1.png, aperçu ×6)

Niche à crânes (dans un mur vu de face), sarcophage de pierre, gisant (un chevalier couché sur sa dalle).
"""
import json
from PIL import Image

PAL = {
    "a": "#120d08",  # contour
    "b": "#1e1a24",  # fond de niche
    "c": "#e2d8be",  # os clair
    "d": "#aa9e84",  # os ombre
    "e": "#787480",  # pierre claire
    "f": "#58545e",  # pierre
    "g": "#3e3a44",  # pierre sombre
    "h": "#9a96a2",  # pierre éclairée
}

SPRITES = {
    "nicheCranes": [
        "..............",
        "..............",
        "..aaaaaaaaaa..",
        ".agggggggggga.",
        ".agbbbbbbbbga.",
        ".agbcccbcccga.",
        ".agbcacbcacga.",
        ".agbdcdbdcdga.",
        ".agbbbbbbbbga.",
        ".agbbcccbbbga.",
        ".agbbcacbbbga.",
        ".agbbdcdbbbga.",
        ".aeeeeeeeeeea.",
        ".affffffffffa.",
        "..aaaaaaaaaa..",
        "..............",
        "..............",
    ],
    "sarcophage": [
        "...aaaaaa...",
        "..ahhhhhha..",
        ".ahheeeehha.",
        ".aheeeeeeha.",
        ".aheefgeeha.",
        ".aheeggeeha.",
        ".aheefgeeha.",
        ".aheeeeeeha.",
        ".aheeeeeeha.",
        ".aheeeeeeha.",
        ".ahhhhhhhha.",
        ".affffffffa.",
        ".agggggggga.",
        ".agggggggga.",
        "..aaaaaaaa..",
    ],
    "gisant": [
        "..aaaaaaaa..",
        ".affffffffa.",
        ".afhhcchhfa.",
        ".afhcddchfa.",
        ".afhhcchhfa.",
        ".afheeeehfa.",
        ".afeheeheefa"[:12],
        ".afeeheheefa"[:12],
        ".afeeehheefa"[:12],
        ".afeeeeeeefa"[:12],
        ".afeeheeheefa"[:12],
        ".afhhffhhhfa"[:12],
        ".affffffffa.",
        ".agggggggga.",
        "..aaaaaaaa..",
    ],
}


def main():
    for k, rows in SPRITES.items():
        assert len({len(r) for r in rows}) == 1, k
    lines = [
        "// FICHIER GÉNÉRÉ par art/export_ossuaire.py : ne pas modifier à la main.",
        "/** Ossuaire (section 3) : mobilier des salles bâties (plans art/ossuaire_salles_v1.png, validés le 2026-11-18). */",
        "export const OSSUAIRE: Record<string, { rows: string[]; palette: Record<string, string> }> = {",
    ]
    for k, rows in SPRITES.items():
        used = {ch for r in rows for ch in r if ch != "."}
        pal = {c: PAL[c] for c in sorted(used)}
        lines.append(f"  {k}: {{ palette: {json.dumps(pal)}, rows: [")
        lines += [f'    "{r}",' for r in rows]
        lines.append("  ] },")
    lines.append("};\n")
    open("src/render/sprites/ossuaire.ts", "w").write("\n".join(lines))
    img = Image.new("RGB", (3 * 20 * 6, 20 * 6), (150, 142, 124))
    for i, rows in enumerate(SPRITES.values()):
        for y, r in enumerate(rows):
            for x, ch in enumerate(r):
                if ch != ".":
                    c = tuple(int(PAL[ch][j:j + 2], 16) for j in (1, 3, 5))
                    img.paste(c, ((i * 20 + 2 + x) * 6, (2 + y) * 6, (i * 20 + 3 + x) * 6, (3 + y) * 6))
    img.save("art/ossuaire_mobilier_v1.png")


if __name__ == "__main__":
    main()
