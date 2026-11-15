# Note — statistiques d'usage de Cave Roller (2026-11-15)

À reprendre dans une autre conversation (demande de Thomas). Dossier du Projet : `claude/statistiques/` ; dépôt : `aws/telemetry/` et `src/telemetry/`.

## Ce que Thomas veut

- Capter des infos d'usage des joueurs (où ils meurent, de quoi, jusqu'où ils vont, les quêtes).
- Sur AWS (son compte, déjà utilisé pour NeuroVision).
- Un seul module qui marche sur la démo en ligne ET sur la future appli Android / iPhone (Capacitor).
- Un déploiement entièrement automatisé (CloudFormation).

## Ce qui est fait (commit du 2026-11-15)

- **Jeu** : `src/telemetry/telemetry.ts` + `src/data/telemetry.ts`. File d'événements gardée sur l'appareil (500 au plus), envoi par lots de 25 toutes les 30 s et à la mise en arrière-plan, `fetch` en `text/plain` (pas de pré-requête CORS), `keepalive`. Accord du joueur : question au premier lancement + réglage dans les Paramètres. Numéros d'appareil et de partie tirés au hasard. Événements : run_start, floor, death, boss_kill, quest, level_up, section, demo_end, revive ; `test: true` pour les essais. Test automatique dans `npm test`.
- **AWS** : `cloudformation.yaml` (vérifié avec cfn-lint) : bucket S3 privé chiffré (événements effacés après 2 ans), rôle minimal, Lambda Node 24 « caveroller-stats » (n'utilise jamais l'IP), Function URL publique avec CORS ouvert et les deux autorisations publiques, 5 appels simultanés au plus, journaux 14 jours, base + table Glue/Athena avec partitions par jour automatiques, groupe de travail Athena (1 Go max par requête), 6 requêtes enregistrées. `deploy.sh` = une commande. `lambda/index.mjs` testé en local (sans AWS).
- **INACTIF** tant que `url` est vide dans `src/data/telemetry.ts` : aucune question, aucun envoi.

## Prochaines étapes

1. Thomas : `bash aws/telemetry/deploy.sh` (AWS CLI connectée), récupérer l'adresse affichée.
2. Coller l'adresse dans `src/data/telemetry.ts`, publier ; vérifier un envoi réel (curl, fichier dans `events/`).
3. Vérifier les prix du moment.
4. Plus tard : un petit tableau de bord (page HTML) qui lit les résultats d'Athena ; d'autres événements si besoin (objets utilisés, temps de jeu, abandons) ; mention dans la politique de confidentialité avant Google Play / App Store.
