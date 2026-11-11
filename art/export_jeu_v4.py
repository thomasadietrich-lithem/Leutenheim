"""Exporte vers le jeu les dessins validés le 2026-11-11 : l'araignée (art/araignee_v1.png), la toile d'araignée et
les trainards (tonneau, caisse, caisses empilées ; art/trainards_v3.png). Lancer depuis la racine du dépôt :
    python3 art/export_jeu_v4.py
Écrit src/render/sprites/araignee.ts, trainards.ts et pieges.ts (pièges v3, validés « Ok fonce ») (lignes de lettres + une palette par dessin).
"""
import os, sys, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np
from PIL import Image
from araignee_v1 import spider
from trainards_v3 import barrel_v3, crate_v3, crate_stack_v3, cobweb
from pieges_v3 import spikes, pit, needle, gas
import cuisine_v2 as cu
import salles_v1 as sa
import forge_alchimie_v1 as fa
from pix import hexrgb


def flat(draw):
    """Petit dessin plat de 16 × 16 (rigole, évacuation) peint avec le sol."""
    a = np.zeros((16, 16, 4), np.uint8)
    def px(x, y, c):
        if 0 <= x < 16 and 0 <= y < 16:
            a[y, x] = hexrgb(c) + (255,)
    draw(px)
    return Image.fromarray(a, "RGBA")


def gutter_h(px):
    for x in range(16):
        px(x, 7, "#a8a6b2"); px(x, 8, "#2a2632"); px(x, 9, "#3a2228")


def drain(px, red=False):
    for y in range(16):
        for x in range(16):
            d = ((x - 8) / 5.2) ** 2 + ((y - 8) / 4.2) ** 2
            if d <= 0.62:
                px(x, y, ("#3a0e12" if red else "#141018") if x % 2 else "#5a5f74")
            elif d <= 1.0:
                px(x, y, "#8a90a8" if y < 8 else "#4e5570")


def blood_gutter_v(px):
    for y in range(16):
        px(7, y, "#7a7488"); px(8, y, "#5a1418"); px(9, y, "#5a1418")
        if y % 5 == 0:
            px(8, y, "#8a2228")

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
    write("src/render/sprites/pieges.ts", "PIEGES",
          "Pièges v3 (art/pieges_v3.png, validée le 2026-11-11) : armé / déclenché ; 18 pixels de large (1 de débord de chaque côté), le gaz a 6 pixels de vapeur au-dessus.",
          {"spikes": spikes().img(), "spikesSprung": spikes("sprung").img(), "pit": pit().img(), "pitSprung": pit("sprung").img(),
           "needle": needle().img(), "needleSprung": needle("sprung").img(),
           "gas0": gas("armed", 0).img(), "gas1": gas("armed", 1).img(), "gas2": gas("armed", 2).img(), "gasSprung": gas("sprung").img()})
    runner = sa.runner(1, 3).img()
    write("src/render/sprites/salles.ts", "SALLES",
          "Cuisine v2, salle de prière v1, salle de torture v1 (planches validées le 2026-11-11 : « Ok fonce »). Les noms finissant par 0, 1, 2 sont les images d'une animation.",
          {"shelf2": cu.shelf2().img(), **{f"basket{n}": cu.fruit_basket(n).img() for n in range(4)}, "counter": cu.counter().img(), "grainSack": cu.grain_sack().img(),
           **{f"ham{i}": cu.wall_hook(i).img() for i in range(3)}, **{f"barrique{i}": cu.barrique(i).img() for i in range(3)},
           "gutterH": flat(gutter_h), "drain": flat(drain), "bloodGutterV": flat(blood_gutter_v), "bloodDrain": flat(lambda p: drain(p, True)),
           "pew": sa.pew().img(), "pewBroken": sa.pew(True).img(), "altar": sa.altar().img(), "candelBare": sa.candelabrum(0, 0).img(),
           **{f"candel{n}{i}": sa.candelabrum("ABC".index(n) + 1, i).img() for n in "ABC" for i in range(3)},
           "runnerA": runner.crop((0, 0, 16, 16)), "runnerB": runner.crop((0, 16, 16, 32)), "runnerC": runner.crop((0, 32, 16, 48)),
           "vitrail0": sa.stained_glass(0).img(), "vitrail1": sa.stained_glass(1).img(),
           "rackTable": sa.rack_table().img(), "toolRack": sa.tool_rack().img(), "wallBoard": sa.wall_board().img(),
           "ropeA": sa.rope_cluster(0).img(), "ropeB": sa.rope_cluster(1).img(), "ropeC": sa.rope_cluster(2).img(), "maiden": sa.maiden("closed").img(), "maidenOpen": sa.maiden("open").img()})
    write("src/render/sprites/atelier.ts", "ATELIERS",
          "Forge v1 et alchimiste v1 (planches validées le 2026-11-11 : « Ok »). Les noms finissant par 0, 1, 2 sont les images d'une animation.",
          {"anvil": fa.anvil().img(), "armorStand": fa.armor_stand().img(), "armorStandB": fa.armor_stand(1).img(),
           "coalS": fa.coal(0).img(), "coalM": fa.coal(1).img(), "coalL": fa.coal(2).img(),
           **{f"forge{i}": fa.forge(i).img() for i in range(3)}, "rustySword": fa.rusty_sword().img(),
           "weaponRack": fa.weapon_rack().img(), "toolShelf": fa.tool_shelf().img(), "workbench": fa.workbench().img(),
           "grindstone": fa.grindstone().img(),
           **{f"cauldron{i}": fa.cauldron(i).img() for i in range(3)}, "glassShelf": fa.glass_shelf().img(),
           "stuffedBear": fa.stuffed_bear().img(), "herbs": fa.herbs().img(), "pottedPlant": fa.potted_plant().img(),
           "bookcase": fa.bookcase_front().img(), "bookcaseL": fa.bookcase_side("right").img(), "bookcaseR": fa.bookcase_side("left").img(),
           "grimoire0": fa.grimoire_stand(0).img(), "grimoire1": fa.grimoire_stand(1).img(), "grimoire2": fa.grimoire_stand(0).img()})
