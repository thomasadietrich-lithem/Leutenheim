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
    """Rideau de mycélium : un amas de filaments blancs qui noie la case de mur (14 × 16), quelques spores lumineuses.
    v2 (Thomas, 2026-11-15 : « contraste davantage les passages secrets de la section 2 ») : plus dense et plus blanc,
    des veines bleu-vert lumineuses qui rayonnent, des spores qui brillent ; il se détache des pierres sombres."""
    s = Sprite(14, 16)
    rng = np.random.default_rng(41)
    WHITE, MID, DIM = (246, 250, 244, 255), (214, 224, 222, 255), (150, 168, 170, 255)
    GLOW, GLOW_D = (120, 250, 220, 255), (60, 170, 150, 255)
    for j in range(16):
        for i in range(14):
            d = math.hypot((i - 6.5) / 1.05, (j - 7.5) / 1.05)
            if d < 7.6 and (rng.random() < 1.05 - d / 9 or ((i + j * 2) % 4 == 0 and d < 7)):
                s.p(i, j, WHITE if d < 3.5 or rng.random() < 0.45 else (MID if rng.random() < 0.7 else DIM))
    # Veines lumineuses qui partent du centre.
    for ang in (0.4, 1.6, 2.7, 3.9, 5.2):
        for t in range(2, 7):
            x = int(round(6.5 + math.cos(ang) * t))
            y = int(round(7.5 + math.sin(ang) * t))
            if 0 <= x < 14 and 0 <= y < 16:
                s.p(x, y, GLOW if t % 2 == 0 else GLOW_D)
    for (x, y) in ((3, 4), (10, 9), (6, 12), (9, 3), (4, 10), (7, 7)):
        s.p(x, y, (200, 255, 240, 255))
    return s.done()


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
