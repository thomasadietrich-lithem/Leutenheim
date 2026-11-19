"""Ossuaire (section 3) : sprites du jeu, d'après les planches validées par Thomas le 2026-11-19 (« ok implémente tout ») :
`art/ossuaire_objets_v1.png` (mobilier) et `art/ossuaire_objets_v2.png` (squelettes, escaliers, grilles, éléments).

    python3 art/export_ossuaire.py   → src/render/sprites/ossuaire.ts
"""
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, name + ".py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


ob1 = load("ossuaire_objets_v1")
ob2 = load("ossuaire_objets_v2")
soc = load("ossuaire_socles_v1")
Sprite, C = ob1.Sprite, ob1.C


def grille(side, open_, locked=False):
    """Grille de fer de porte (16 × 16, transparente entre les barreaux : on voit le sol derrière)."""
    s = Sprite(16, 16)
    I, IL, IH = C["i"], C["iL"], C["iH"]
    if side in ("haut", "bas"):
        length = 15 if not open_ else 4
        y0 = 0 if side == "haut" else 16 - length
        for x in (1, 5, 9, 13):
            s.r(x, y0, 2, length, IH).r(x + 1, y0, 1, length, I)
            s.p(x, y0 + length - 1 if side == "haut" else y0, C["moon"])
        rail = (1, 9) if side == "haut" else (14, 6)
        s.r(0, rail[0], 16, 2, IL).r(0, rail[0] + 1, 16, 1, I)
        if not open_:
            s.r(0, rail[1], 16, 2, IL).r(0, rail[1] + 1, 16, 1, I)
    else:
        n = 16 if not open_ else 3
        s.r(7, 0, 2, n, IH).r(8, 0, 1, n, I)
        for y in range(1, n - 1, 3):
            s.r(5, y, 6, 2, IL).p(5, y, IH).p(10, y + 1, I)
    if locked:
        # chaîne et cadenas doré
        s.r(3, 7, 10, 1, IL)
        s.r(6, 6, 4, 1, (240, 192, 80)).r(5, 8, 6, 3, (240, 192, 80)).r(5, 10, 6, 1, (168, 124, 28)).r(7, 8, 2, 2, (28, 20, 16))
    return s.done(False)


SPRITES = {
    "sarcophage": ob1.sarcophagus(), "sarcophageOuvert": ob1.sarcophagus(True), "gisant": ob1.gisant(), "autelOss": ob1.altar(),
    "urneS": ob1.urn("s"), "urneM": ob1.urn("m"), "urneL": ob1.urn("l"), "urneBrisee": ob1.urn_broken(),
    "skelCouche": ob2.skel_lying(), "skelAssis": ob2.skel_sitting(), "skelRampant": ob2.skel_crawling(), "skelMorceaux": ob2.skel_pieces(),
    "lustreOs": ob2.bone_chandelier(), "pilierCranes": ob2.skull_pillar(), "cercueils": ob2.coffins(), "statueVoilee": ob2.veiled_statue(),
    "fosseGrille": ob2.grate_pit(), "brouetteOss": ob2.barrow(),
    # Socle au crâne énorme (Thomas, 2026-11-19 : remplace le squelette assis).
    **soc.SPRITES,
    "stairsOssDown": ob2.stairs_tile(True), "stairsOssUp": ob2.stairs_tile(False),
    "grilleOss": grille("haut", False), "grilleOssOpen": grille("haut", True), "grilleOssLocked": grille("haut", False, True),
    "grilleOssBas": grille("bas", False), "grilleOssBasOpen": grille("bas", True), "grilleOssBasLocked": grille("bas", False, True),
    "grilleOssCote": grille("côté", False), "grilleOssCoteOpen": grille("côté", True), "grilleOssCoteLocked": grille("côté", False, True),
}

LETTERS = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"


def encode(sp):
    a = sp.a
    pal, rows = {}, []
    for y in range(a.shape[0]):
        row = ""
        for x in range(a.shape[1]):
            r, g, b, al = (int(v) for v in a[y, x])
            if al == 0:
                row += "."
                continue
            key = "#%02x%02x%02x" % (r, g, b)
            if key not in pal:
                pal[key] = LETTERS[len(pal)]
            row += pal[key]
        rows.append(row)
    return {v: k for k, v in pal.items()}, rows


def main():
    out = [
        "// FICHIER GÉNÉRÉ par art/export_ossuaire.py : ne pas modifier à la main.",
        "/** Ossuaire (section 3) : planches art/ossuaire_objets_v1.png et v2, validées le 2026-11-19. */",
        "export const OSSUAIRE: Record<string, { rows: string[]; palette: Record<string, string> }> = {",
    ]
    for name, sp in SPRITES.items():
        pal, rows = encode(sp)
        out.append(f"  {name}: {{ palette: {json.dumps(pal)}, rows: [")
        out += [f'    "{r}",' for r in rows]
        out.append("  ] },")
    out.append("};\n")
    path = os.path.join(HERE, "..", "src", "render", "sprites", "ossuaire.ts")
    open(path, "w").write("\n".join(out))
    print("src/render/sprites/ossuaire.ts", len(SPRITES), "dessins")


if __name__ == "__main__":
    main()
