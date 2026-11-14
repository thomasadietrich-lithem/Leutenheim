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
| 2026-11-14_13h29 | 90f864c | 49 | 26.3 | 23 | 37.8 | 23.4 | 19.5 | 2.74 | 0.55 | mur de succès sur 4 colonnes |
| 2026-11-14_13h34 | c10ea45 | 49.3 | 31.4 | 24.1 | 53.8 | 23.4 | 23.1 | 3.1 | 0.7 | largeur du mur de succès |
| 2026-11-14_13h35 | 8116da1 | 48 | 31.6 | 25.3 | 41.4 | 28.5 | 20.7 | 3.6 | 0.59 | largeur du mur (2e mesure) |
| 2026-11-14_14h36 | 5bcfc53 | 49.7 | 25.6 | 28 | 48.1 | 25.1 | 26.3 | 4.07 | 0.83 | tonneau creux redessiné |
| 2026-11-14_16h01 | 5b7c44e | 50.3 | 27.4 | 26.9 | 44.5 | 22.7 | 20.8 | 3.6 | 0.72 | clef inutile |
| 2026-11-14_16h09 | d0035cb | 35 | 31.9 | 22.1 | 46.2 | 21.6 | 21.5 | 3.85 | 0.62 | flèches : bouton Équiper |
| 2026-11-14_19h05 | 31b747c | 26.2 | 26 | 27.3 | 29.3 | 16.7 | 22.2 | 0.35 | 0.23 | salle d'essai section 2 (champignonnière) |
| 2026-11-14_19h17 | 813c81e | 31 | 31.7 | 32.4 | 30.5 | 16.7 | 28.2 | 0.64 | 0.68 | section 2 : lumière lente, éboulis contre les murs, zigzags |
| 2026-11-14_19h17 | 774cc22 | 33.8 | 30.7 | 30.3 | 34.7 | 16.7 | 24.6 | 1.04 | 0.42 | 2e mesure |
| 2026-11-14_19h23 | 1535e81 | 27.2 | 28.2 | 31.2 | 27.7 | 16.7 | 20.7 | 0.46 | 0.4 | section 2 : éboulis à travers les murs |
| 2026-11-14_19h37 | 2dddb54 | 29.5 | 24.5 | 23.2 | 24.6 | 16.7 | 18.7 | 0.6 | 0.2 | section 2 : sol B pavés ronds |
| 2026-11-14_19h46 | 81e93fd | 29.7 | 25.2 | 25.6 | 25.8 | 16.7 | 20.1 | 0.62 | 0.53 | section 2 : salles sol B et sol D |
| 2026-11-14_19h56 | e4f33d9 | 30.1 | 27.8 | 29.7 | 29.5 | 16.7 | 19.6 | 0.44 | 0.37 | torche lancée, mousse qui propage le feu |
| 2026-11-14_20h27 | 71795c7 | 29 | 28.4 | 28 | 29.7 | 16.7 | 31 | 0.81 | 0.4 | section 2 dans le donjon, coffre doré, partie d'essai |
| 2026-11-14_20h31 | d788645 | 29.4 | 25.4 | 27.4 | 28.3 | 16.7 | 23.7 | 0.7 | 0.19 | escalier de la Tisseuse scellé |
| 2026-11-14_21h03 | 96985a7 | 22.4 | 20.9 | 20.9 | 22.9 | 16.7 | 25.2 | 0.82 | 0.32 | section 2 : pièges propres, escaliers en niche, vue refaite après porte |
| 2026-11-14_21h23 | b3bc343 | 24.5 | 22.8 | 20.7 | 22 | 16.7 | 22.1 | 0.8 | 0.33 | salles à thème section 2 (morilles, sculpture), Morillon, montée de niveau dorée |
