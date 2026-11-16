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
| 2026-11-15_07h45 | 6ff9024 | 23 | 20.8 | 21.2 | 19.7 | 16.7 | 18.8 | 0.94 | 0.27 | section 2 : ses 4 monstres, flèche ricochante, verrou de niveau par section |
| 2026-11-15_08h06 | 3188842 | 19.6 | 18.7 | 19.4 | 20.2 | 16.7 | 19.8 | 0.6 | 0.25 | torches salles S2, alambics, fumée légère, mobs S2 rééquilibrés |
| 2026-11-15_08h12 | 563ad8b | 24 | 23.8 | 20 | 18.7 | 16.7 | 20.4 | 0.94 | 0.26 | salles de couleurs |
| 2026-11-15_08h13 | daae74a | 19.8 | 19.9 | 22.6 | 21.5 | 16.7 | 19.5 | 0.47 | 0.27 | salles de couleurs (re-mesure) |
| 2026-11-15_08h39 | 691cb68 | 20.2 | 18.4 | 19 | 20.2 | 16.7 | 18.6 | 0.88 | 0.12 | angle de mur : embuscade et pas d'opportunité |
| 2026-11-15_08h40 | 691cb68 | 20.9 | 22.2 | 19.6 | 21.3 | 16.7 | 20.2 | 0.58 | 0.26 | angle de mur (re-mesure) |
| 2026-11-15_08h47 | 9f3a5f4 | 19.6 | 20.2 | 18.9 | 18.9 | 16.7 | 24.6 | 0.64 | 0.14 | texte d'arrivée section 2, escaliers champi, décor autour de l'escalier scellé |
| 2026-11-15_08h53 | af2e743 | 23.6 | 23.3 | 19.8 | 18 | 16.7 | 20.9 | 0.6 | 0.41 | creux décoratifs retirés, Fifrelin en salle ordinaire, intouchable une fois par étage |
| 2026-11-15_08h56 | 4c8d6d4 | 23.3 | 24 | 21 | 21.7 | 16.7 | 21.2 | 0.96 | 0.4 | escalier scellé tourné, salle de bain derrière une porte seule |
| 2026-11-15_08h57 | bc95d0c | 31 | 22.9 | 27.5 | 25 | 16.7 | 21.8 | 0.55 | 0.27 | relance |
| 2026-11-15_09h00 | 876f30a | 24.4 | 21.5 | 20.8 | 22.2 | 16.7 | 18.8 | 0.6 | 0.41 | bouton s'équiper du ruban |
| 2026-11-15_09h09 | 4e51b6f | 21.1 | 22.8 | 21.4 | 20.9 | 16.7 | 19.7 | 1.02 | 0.19 | javeline grisée à deux mains, ranger le sac, revivre en essai |
| 2026-11-15_09h09 | 4f0fb7c | 28.4 | 20.3 | 24.9 | 25.7 | 16.7 | 20.9 | 1.15 | 0.22 | relance |
| 2026-11-15_09h13 | fd7080e | 22.8 | 24.3 | 25.3 | 18.8 | 16.7 | 20.9 | 0.66 | 0.17 | correctif sac à ranger |
| 2026-11-15_09h16 | 429d6f5 | 20.7 | 21.3 | 19.4 | 20.1 | 16.7 | 18.2 | 0.49 | 0.29 | reprendre toujours là, revivre pour toutes les parties de la démo |
| 2026-11-15_09h32 | f39bbbb | 18.8 | 20.5 | 19.9 | 20.5 | 16.7 | 19.6 | 0.68 | 0.14 | répertoire d'objets en essai |
| 2026-11-15_12h43 | e15f29e | 20.2 | 18.9 | 19 | 19.6 | 16.7 | 24.8 | 0.9 | 0.17 | escaliers orientés, nichée scellée, coffre doré, triche |
| 2026-11-15_15h54 | ad0d5a7 | 24.2 | 18.7 | 21.1 | 25 | 16.7 | 23.8 | 0.74 | 0.17 | module de statistiques (inactif tant que l'adresse est vide) |
| 2026-11-15_18h56 | 0094081 | 19.9 | 20.8 | 22.5 | 19.8 | 16.7 | 20 | 0.59 | 0.36 | embuscade : celui qui arrive après |
| 2026-11-15_20h20 | 251f4a3 | 20.7 | 19.8 | 19.5 | 18.9 | 16.7 | 19.6 | 0.48 | 0.12 | plus de règle des deux mains |
| 2026-11-15_20h32 | 9888f4c | 19.9 | 19.6 | 19.4 | 24.3 | 16.7 | 21.3 | 0.45 | 0.23 | PNJ qui glissent en s'écartant |
| 2026-11-15_20h38 | bac25fc | 21.6 | 19.5 | 23.5 | 22.8 | 16.7 | 20 | 0.63 | 0.52 | sac ouvert après consommation |
| 2026-11-15_20h49 | 89aa952 | 24.2 | 22 | 17.8 | 24 | 16.7 | 18.7 | 0.81 | 0.15 | amulettes, bibelots uniques |
| 2026-11-15_20h52 | 5626b83 | 22.4 | 24.8 | 25 | 19.4 | 16.7 | 25.6 | 0.53 | 0.15 | amulettes cuivre / argent |
| 2026-11-15_20h53 | f410c10 | 24.7 | 24.5 | 22.9 | 18 | 16.7 | 26.5 | 0.62 | 0.15 | relance (bruit ?) |
| 2026-11-16_09h14 | 3c209c8 | 26.1 | 24 | 24 | 22.3 | 16.7 | 21.7 | 1 | 0.13 | le Carillon (boss de la section 2) |
| 2026-11-16_10h21 | fc04d04 | 29.5 | 24 | 24.8 | 25.8 | 16.7 | 27.6 | 0.71 | 0.34 | étages ouverts en essai, flèches brisées qui filent, potions sur le Carillon |
| 2026-11-16_11h00 | 3ef24e2 | 23.5 | 22.1 | 22.2 | 25 | 16.7 | 25 | 0.95 | 0.27 | Carillon tous les 8 tours, triche Stuff |
| 2026-11-16_14h20 | e7b1ca0 | 22.5 | 22.7 | 22.7 | 23.4 | 16.7 | 26.9 | 0.81 | 0.21 | Carillon : pluie d'encre, chapeau, souches resserrées |
| 2026-11-16_14h27 | ad39755 | 23.9 | 22.2 | 22.6 | 19.4 | 16.7 | 25 | 0.59 | 0.28 | Carillon doux, abri des monstres, mode d'essai |
| 2026-11-16_17h16 | 2c3cecf | 23.5 | 23.5 | 19.7 | 22.2 | 16.7 | 22.3 | 0.87 | 0.36 | torche animée, mélangeur, double toucher, creux ailleurs |
| 2026-11-16_17h21 | 563ebec | 19.9 | 21.4 | 19.1 | 23.5 | 16.7 | 21.8 | 0.62 | 0.12 | salle de bain plus petite |
| 2026-11-16_19h18 | 88f8b1f | 24.2 | 21.5 | 22.9 | 21.5 | 16.7 | 19.5 | 0.69 | 0.35 | étage ouvert après la Tisseuse |
| 2026-11-16_20h23 | f31520f | 25.5 | 27.3 | 24.6 | 25.2 | 16.7 | 27.7 | 0.66 | 0.2 | Héros en calques (race, armure, casque, arme), Halfelin et Elfe jouables, règles d'avantage |
| 2026-11-16_20h24 | f31520f | 26.5 | 25.4 | 25.1 | 25.5 | 16.7 | 26.6 | 0.7 | 0.23 | Héros en calques : second passage (le premier signalait le donjon) |
| 2026-11-16_20h54 | f79659b | 26.9 | 25.2 | 26 | 24.4 | 16.7 | 18 | 0.74 | 0.44 | musique harpe et cordes (v4 C) |
| 2026-11-16_20h57 | f79659b | 29.9 | 31.2 | 30.5 | 32.1 | 16.7 | 24.1 | 0.51 | 0.35 | Paramètres en sous-menus, fiche de race, astuces, flèches de recul, casque de mailles |
| 2026-11-16_21h10 | 636af84 | 24.5 | 23.8 | 24.1 | 22.2 | 16.7 | 20.1 | 0.59 | 0.29 | double toucher pour consommer (après les races) |
| 2026-11-16_21h12 | c3cc86b | 21.5 | 20.3 | 21.2 | 21.4 | 16.7 | 17.8 | 0.65 | 0.4 | PNJ sur la moitié des étages |
| 2026-11-16_21h21 | de7db90 | 26.1 | 27.4 | 20.2 | 22.8 | 16.7 | 18.6 | 0.45 | 0.2 | glissade lisible, poulet plus lent, chambre de neige |
| 2026-11-16_21h29 | 9f0d0a7 | 22.8 | 24.8 | 21 | 23.5 | 16.7 | 24.4 | 0.46 | 0.13 | tapisserie du culte, chambre de neige qui fond |
| 2026-11-16_21h31 | bb56b61 | 22.2 | 27.9 | 26.7 | 25.1 | 16.7 | 21.6 | 0.54 | 0.13 | musique du cœur du boss |
| 2026-11-16_21h35 | 12dbe21 | 26.2 | 26 | 25.4 | 28.8 | 16.7 | 29.5 | 0.53 | 0.11 | succès en pages par race |
| 2026-11-16_21h39 | 80c8b68 | 25.4 | 27.9 | 26.4 | 29 | 16.7 | 26.8 | 0.44 | 0.22 | bombe arcanique |
