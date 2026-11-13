# art/ — dessins de Cave Roller

Tout est dessiné par des scripts Python (pixel par pixel), lancés depuis la racine du dépôt : `python3 art/<script>.py`
écrit la planche `art/<script>.png` ; avec `export`, il écrit aussi le fichier de dessins du jeu (`src/render/sprites/…`).
Ne jamais retoucher à la main un fichier de `src/render/sprites/` : relancer le script.

Pour TOUT VOIR sans rien lancer : le catalogue du matériel (`node scripts/atelier.mjs` → `demo/catalogue.html`, publié
en artefact « Cave Roller — catalogue du matériel »).

## En jeu (planches validées et leur script)

| Sujet | Planche | Script (export vers le jeu) |
|---|---|---|
| Héros, Humain Guerrier | `guerrier_v6.png` | `guerrier_sheet_v6.py` → `export_sprites.py` |
| Kobold | `schrat_v2.png` | `schrat_sheet_v2.py export` |
| Frondeur | `frondeur_v2.png` | `frondeur_v2.py` |
| Araignée, Tisseuse | `araignee_v1.png`, `boss_v2.png` | `export_jeu_v4.py` |
| Salles (dortoir, cuisine, prière, torture, forge, alchimiste) | `dortoir_v3.png`, `cuisine_v2.png`, `priere_v1.png`, `torture_v1.png`, `forge_v1.png`, `alchimiste_v1.png` | `dortoir_v3.py export`, `export_jeu_v4.py` |
| Salle de bain, cloche, ferme | `salle_bain_v1.png`, `cloche_v1.png`, `ferme_v2.png` | `salle_bain_v1.py export`, `cloche_v1.py`, `ferme_export.py` |
| Murs, sols, motifs, rigoles | `murs_v3.png`, `sols_v1.png`, `motifs_sol_v1.png`, `rigoles_v2.png` | `murs_v3.py`, `sols_v1.py`, `motifs_sol_v1.py`, `rigoles_v2.py` |
| Objets (icônes) | `objets_v1.png` à `objets_v4.png`, `armes_v4.png` | recopiés dans `src/ui/icons.ts` |
| Pièges, flammes, trainards | `pieges_v3.png`, `flammes_v1.png`, `trainards_v3.png` | `export_jeu_v4.py`, `flammes_v1.py export` |
| Colporteur, Sœur Osseuse | `marchand_v1.png`, `soeur_v1.png` | `marchand_v1.py export` |
| Logo | `logo_d2.png` | `logo_d2.py` (icon, embleme, titre) |
| Pictos race et classe | `pictos_race_classe_v4.png` | `pictos_race_classe_v4.py export` |

## Propositions en attente de Thomas

| Sujet | Planche | Script |
|---|---|---|
| Paperdoll : le héros change avec son équipement ; halfelin, elfe ; armure de plate, draconique, heaume, casque poulet | `paperdoll_v1.png` | `paperdoll_v1.py` |
| Escaliers : six pistes | `escaliers_v2.png` | `escaliers_v2.py` |
| Briques des zones de quête (pan de mur, levier, dalle, tapisserie, tonneau creux, paillasse, bougie, cierge, œuf d'or) | dans le catalogue, onglet « À venir » | `scripts/atelier/concepts.ts` |

## archive/

Les essais et les versions remplacées (guerrier v1 à v5, Kobold v1, pictos v1 à v3, mobilier v1, roue d'actions…),
gardés pour mémoire ; plus aucun script ne s'en sert. `archive/captures/` : de vieilles captures d'écran.
