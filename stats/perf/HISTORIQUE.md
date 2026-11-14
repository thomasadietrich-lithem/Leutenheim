# Mesures de performance (scripts/perf.mjs)

Image moyenne en ms (processeur ×4, 412 × 915, densité 3, salle d'essai) ; plus c'est bas, mieux c'est.

| Date | Commit | Immobile | Marche | Retour | Zoom | Combat | Donjon | Tour | Lumière | Note |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-14_12h01 | cbea834 | 42.2 | 24.9 | 27.6 | 38.1 | 21.7 | 30.3 | 3.66 | 0.83 | référence (graine fixe) : après Fifrelin, arène, plumes du pré ; aucune régression mesurée contre ca056b7 (ce matin) |
| 2026-11-14_12h13 | 3cb7340 | 49.3 | 25.8 | 24.9 | 44.7 | 21.5 | 23.6 | 3.77 | 0.7 | mur de succès (médaillons, animation, comptage des événements) |
| 2026-11-14_12h15 | b757110 | 40.4 | 33.1 | 26.3 | 37.3 | 19.9 | 20.4 | 3.58 | 0.6 | records en cartes |
