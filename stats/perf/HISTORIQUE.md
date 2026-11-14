# Mesures de performance (scripts/perf.mjs)

Image moyenne en ms (processeur ×4, 412 × 915, densité 3, salle d'essai) ; plus c'est bas, mieux c'est.

| Date | Commit | Immobile | Marche | Retour | Zoom | Combat | Donjon | Tour | Lumière | Note |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-11-14_12h01 | cbea834 | 42.2 | 24.9 | 27.6 | 38.1 | 21.7 | 30.3 | 3.66 | 0.83 | référence (graine fixe) : après Fifrelin, arène, plumes du pré ; aucune régression mesurée contre ca056b7 (ce matin) |
| 2026-11-14_12h13 | 3cb7340 | 49.3 | 25.8 | 24.9 | 44.7 | 21.5 | 23.6 | 3.77 | 0.7 | mur de succès (médaillons, animation, comptage des événements) |
| 2026-11-14_12h15 | b757110 | 40.4 | 33.1 | 26.3 | 37.3 | 19.9 | 20.4 | 3.58 | 0.6 | records en cartes |
| 2026-11-14_12h34 | 39a5880 | 68.6 | 35.3 | 30.8 | 42.9 | 31.8 | 28.5 | 3.85 | 1.01 | succès et records fusionnés |
| 2026-11-14_12h36 | 636eb3d | 35.3 | 31.5 | 27.1 | 36.8 | 22.8 | 26.7 | 2.7 | 0.93 | menu en jeu allégé, réglage du sang |
| 2026-11-14_12h42 | d293fe9 | 47.7 | 28.8 | 26.6 | 45.2 | 27.2 | 27.7 | 3.29 | 0.74 | succès Portier, Bousculeur, Fuyard ; mur en 6 colonnes |
| 2026-11-14_12h59 | b715373 | 60 | 33 | 28.4 | 38.1 | 25.5 | 23.9 | 4.21 | 1.13 | encyclopédie : portraits |
| 2026-11-14_12h59 | b715373 | 35.5 | 32.1 | 29.6 | 38.5 | 25.9 | 20 | 2.78 | 0.8 | encyclopédie : portraits (2e mesure) |
| 2026-11-14_13h20 | 4088012 | 66.7 | 30.2 | 24.7 | 44.8 | 26.5 | 24.6 | 3.02 | 0.49 | 6 succès + d20 enchanté |
| 2026-11-14_13h21 | ff1f413 | 42.5 | 34.2 | 24.4 | 38.2 | 20.5 | 23.6 | 2.99 | 0.68 | 6 succès + d20 enchanté (2e mesure) |
