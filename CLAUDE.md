# Leutenheim — consignes pour Claude

Roguelike 2D mobile (TypeScript + Canvas, empaqueté plus tard avec Capacitor).

- La source de vérité du projet est `claude/DIRECTEUR.md` dans le Projet claude.ai « Développement Mobile ». Le lire avant d'agir, le réécrire après chaque changement réel.
- La logique (`src/core`, `src/world`) n'importe jamais `src/render` ni `src/input`, et n'utilise jamais `Math.random` : tout l'aléatoire passe par `src/core/rng.ts`.
- Le contenu (réglages d'étage, plus tard monstres, classes, objets) vit dans `src/data`.
- `npm test` : vérification des types + simulations sans affichage. Doit passer avant tout push.
- `npm run build` : produit `demo/index.html`, fichier unique jouable dans un navigateur.
- Thomas ne code pas en TypeScript : expliquer en français simple, sans jargon inutile.
