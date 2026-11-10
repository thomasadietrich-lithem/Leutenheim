# Leutenheim

Roguelike 2D mobile, vue du dessus, tour par tour, étages générés aléatoirement.

## Commandes

```
npm install      # une seule fois
npm test         # vérifie les types et lance les simulations
npm run build    # génère demo/index.html (ouvrir dans un navigateur)
```

## Organisation

```
src/core/    règles du jeu, tours, aléatoire à graine
src/world/   carte, génération d'étage, recherche de chemin
src/data/    réglages et contenu (aucune logique)
src/render/  affichage Canvas
src/input/   tactile, souris, clavier
tests/       simulations sans affichage
demo/        build jouable en un seul fichier
```
