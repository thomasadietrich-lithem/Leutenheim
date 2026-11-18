"""Exporte les salles du Hall d'exposition et de la salle de concert (section 2) vers le jeu.

    python3 art/export_salles_s2.py

Écrit `src/render/sprites/expo.ts` (meubles du hall, Vernis), `src/render/sprites/concert.ts` (meubles de la salle de
concert) et `src/render/sprites/iconsS2.ts` (icônes : ticket, pinceau, partition, diapason, Grand Poulet d'Or), chacune
avec sa palette. Fichiers générés : ne pas les modifier à la main.
"""
import importlib.util
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)


def load(name):
    spec = importlib.util.spec_from_file_location(name, os.path.join(HERE, f"{name}.py"))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


expo = load("expo_v1")
concert = load("concert_v1")


def hexc(rgb):
    return "#%02x%02x%02x" % rgb


def entry(rows, pal):
    used = sorted({c for r in rows for c in r if c != "."})
    return {"palette": {c: hexc(pal[c]) for c in used}, "rows": rows}


def write(path, const, doc, items):
    out = ["// FICHIER GÉNÉRÉ par art/export_salles_s2.py : ne pas modifier à la main.", f"/** {doc} */",
           f"export const {const}: Record<string, {{ rows: string[]; palette: Record<string, string> }}> = {{"]
    for k, (rows, pal) in items.items():
        e = entry(rows, pal)
        out.append(f"  {k}: {{ palette: {json.dumps(e['palette'], ensure_ascii=False)}, rows: [")
        out += [f"    {json.dumps(r)}," for r in e["rows"]]
        out.append("  ] },")
    out.append("};")
    with open(os.path.join(HERE, "..", path), "w") as f:
        f.write("\n".join(out) + "\n")


E = expo.S
EP = expo.PAL
write("src/render/sprites/expo.ts", "EXPO", "Hall d'exposition (section 2, planche art/expo_v1.png, validée le 2026-11-18).", {
    "rugBleu": (E["tapis bleu"], EP),
    "expoPoulet0": (E["poulet picore"], EP),
    "expoPoulet1": (E["poulet qui crie"], EP),
    "expoPoulet2": (E["poulet en vol"], EP),
    "expoPomme0": (E["pomme croquée"], EP),
    "expoPomme1": (E["pomme géante"], EP),
    "expoSocle": (E["socle vide (Grand Poulet d'Or)"], EP),
    "tabouret": (E["tabouret"], EP),
    "chandelierExpo": (E["chandelier"], EP),
    "tableauPoulet": (E["tableau : poulet"], EP),
    "tableauPomme": (E["tableau : pomme"], EP),
    "pommeCloche": (E["pomme dorée sous cloche"], EP),
    "clocheVide": ([r.replace("G", "C").replace("g", "c").replace("Y", "C") if 2 <= i <= 10 else r for i, r in enumerate(E["pomme dorée sous cloche"])], EP),
    "ecriteauExpo": (E["écriteau"], EP),
    "vernis": (E["Vernis, Kobold conservateur"], EP),
})
C = concert.S
CP = concert.PAL
write("src/render/sprites/concert.ts", "CONCERT", "Salle de concert (section 2, planche art/concert_v1.png).", {
    "estrade": (C["estrade"], CP),
    "piano": (C["piano"], CP),
    "harpe": (C["harpe"], CP),
    "tambour": (C["tambour"], CP),
    "chaiseDos": (C["chaiseDos"], CP),
    "pupitreChef": (C["pupitreChef"], CP),
})
write("src/render/sprites/iconsS2.ts", "ICONS_S2", "Icônes des objets du hall et de la salle de concert (section 2).", {
    "ticket_expo": (E["ticket d'exposition (icône)"], EP),
    "pinceau_magique": (E["pinceau magique (icône)"], EP),
    "partition": (C["partition (icône)"], CP),
    "diapason": (C["diapason (icône)"], CP),
    "grand_poulet_or": (C["Grand Poulet d'Or (icône)"], CP),
})
print("ok")
