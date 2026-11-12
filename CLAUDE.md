# Leutenheim — consignes pour Claude

Roguelike 2D mobile (TypeScript + Canvas, empaqueté plus tard avec Capacitor).

- La source de vérité du projet est `claude/DIRECTEUR.md` dans le Projet claude.ai « Développement Mobile ». Le lire avant d'agir, le réécrire après chaque changement réel. Il ne garde que l'état actuel, une ligne par décision : le garder court. L'historique détaillé est dans `claude/DIRECTEUR_ARCHIVE.md` (figé, à n'ouvrir qu'en cas de besoin).
- La logique (`src/core`, `src/world`) n'importe jamais `src/render` ni `src/input`, et n'utilise jamais `Math.random` : tout l'aléatoire passe par `src/core/rng.ts`.
- Le contenu (réglages d'étage, plus tard monstres, classes, objets) vit dans `src/data`.
- Bilingue français / anglais : les textes s'écrivent en français dans le code ; tout nouveau texte visible reçoit sa traduction dans `src/i18n/en.ts` (ou `src/i18n/ignore.json` s'il n'est pas du texte). Le test « i18n » échoue sinon.
- `npm test` : vérification des types + simulations sans affichage. Doit passer avant tout push.
- `npm run build` : produit `demo/index.html`, fichier unique jouable dans un navigateur.
- Thomas ne code pas en TypeScript : expliquer en français simple, sans jargon inutile.
