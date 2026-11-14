"""Section 2 (champignonnière) : exporte les dessins retenus vers le jeu (Thomas, 2026-11-14 : « crée la SECTION 2 dans
la salle d'essai »). Champignons de la planche v3 (grappe verte, géant bleu, corail, groupes de petits lumineux), porte
« grille rouillée » de la v4 (fermée, ouverte, verrouillée), rideau de mycélium (salle secrète) de la v4.

  python3 art/champi_export.py   → src/render/sprites/champi.ts
"""
import math
import os
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import champi_v3 as V3  # noqa: E402
import champi_v4 as V4  # noqa: E402
from dortoir_v2 import Sprite  # noqa: E402
from export_jeu_v4 import write  # noqa: E402


def curtain():
    """Rideau de mycélium : un amas de filaments blancs qui noie la case de mur (14 × 16), quelques spores lumineuses."""
    s = Sprite(14, 16)
    rng = np.random.default_rng(41)
    for j in range(16):
        for i in range(14):
            d = math.hypot((i - 6.5) / 1.1, j - 7.5)
            if d < 7.5 and (rng.random() < 0.95 - d / 9 or ((i + j * 2) % 5 == 0 and d < 6)):
                s.p(i, j, V4.MYC if rng.random() < 0.6 else V4.MYC_D)
    for (x, y) in ((3, 4), (10, 9), (6, 12)):
        s.p(x, y, (190, 255, 236, 255))
    return s


sprites = {
    "champiGrappe": V3.green_cluster().img(),
    "champiGeant": V3.blue_giant().img(),
    "champiCorail": V3.coral().img(),
}
for k, letter in (("b", "B"), ("g", "G"), ("p", "P")):
    for n, shape in enumerate(("escalier", "rond", "touffe"), 1):
        sprites[f"lueurs{letter}{n}"] = V3.group(shape, k).img()
sprites["porteGrille"] = V4.door_grate("closed").img()
sprites["porteGrilleOpen"] = V4.door_grate("open").img()
sprites["porteGrilleLocked"] = V4.door_grate("locked").img()
sprites["mycCurtain"] = curtain().img()
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
write("src/render/sprites/champi.ts", "CHAMPI",
      "Section 2, la champignonnière (art/champi_v3.png, art/champi_v4.png) : champignons, petits lumineux en groupes, porte grille rouillée, rideau de mycélium.", sprites)
