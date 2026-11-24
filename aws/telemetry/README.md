# Statistiques anonymes de Cave Roller (AWS)

Le jeu (navigateur, et plus tard l'appli Android / iPhone) envoie de petits événements anonymes à une Lambda, qui les range dans S3. On les lit avec Athena. **Tout s'installe en une commande avec CloudFormation.**

```
jeu ──(lots d'événements)──▶ Lambda « caveroller-stats » (adresse publique) ──▶ S3 (un fichier par lot, rangé par jour) ──▶ Athena (requêtes enregistrées)
```

## Fichiers

- `cloudformation.yaml` : le modèle complet (bucket, rôle, Lambda, adresse publique, garde-fous, base et table Athena, groupe de travail, 6 requêtes enregistrées). Vérifié avec `cfn-lint`.
- `deploy.sh` : lance le déploiement et affiche l'adresse.
- `lambda/index.mjs` : le code de la Lambda, lisible et testable seul (le modèle en contient une copie en CommonJS).
- `athena.sql` : les mêmes requêtes, à copier à la main si besoin.

## Installer (une fois), mettre à jour (à chaque changement)

Il faut l'AWS CLI installée et connectée au compte (`aws configure`).

```
bash aws/telemetry/deploy.sh
```

Région Paris (`eu-west-3`), pile CloudFormation « caveroller-stats ». Le script affiche l'adresse publique : la coller dans `src/data/telemetry.ts` (champ `url`), publier le jeu. Les joueurs voient alors la question « Statistiques anonymes » au premier lancement.

Relancer le script applique les changements du modèle ; rien n'est effacé. Supprimer la pile garde le bucket et ses données (`DeletionPolicy: Retain`).

## Ce qui part

Seulement si le joueur a dit oui (question au premier lancement, puis Paramètres > « Statistiques anonymes »).

- Avec chaque lot : un numéro d'appareil tiré au hasard, la version du jeu, la plateforme (web, android, ios), démo ou publique, la langue.
- Les événements, chacun avec le numéro de la partie (tiré au hasard) :
  - `run_start` : race, classe ;
  - `floor` : étage atteint, niveau, tour, PV, or, sans une égratignure ;
  - `death` : étage, cause, niveau, tour, or, étage le plus profond ;
  - `boss_kill` : étage, niveau, tour, PV restants ;
  - `quest` : quelle tâche, donnée / réussie / ratée / perdue ;
  - `level_up`, `section` (arrivée dans une section), `demo_end`, `revive`.
- `test: true` marque la salle d'essai et la partie d'essai (les requêtes les écartent).

Rien de personnel : pas de nom, pas d'adresse IP (la Lambda ne la lit pas), pas de cookie. Les événements s'effacent seuls au bout de 2 ans (`RetentionDays`), les résultats d'Athena au bout de 30 jours.

## Garde-fous

- 5 appels en même temps au plus (`MaxConcurrency`) : la facture ne peut pas s'emballer si quelqu'un abuse de l'adresse.
- Lots de 50 événements et 64 Ko au plus ; seuls les nombres et les textes courts sont gardés.
- Athena : 1 Go lu au plus par requête.
- Journaux de la Lambda gardés 14 jours.

## Lire

Console AWS > Athena (région Paris) > groupe de travail « caveroller » > Requêtes enregistrées :
1. parties et appareils par jour ; 2. morts par étage ; 3. causes de mort ; 4. entonnoir des étages ; 5. la Tisseuse ; 6. quêtes.

## Côté jeu

`src/telemetry/telemetry.ts` (le module) et `src/data/telemetry.ts` (l'adresse et les réglages). Sans réseau, les événements attendent sur l'appareil (500 au plus) et repartent plus tard ; un envoi raté ne gêne jamais la partie. Le même code marche dans l'appli Capacitor (Android : origine `https://localhost`, iPhone : `capacitor://localhost` ; la Lambda accepte toutes les origines).

## À vérifier au premier déploiement

- Que l'adresse répond : `curl -X POST <adresse> -d '{"events":[{"e":"test","run":"x","t":1}]}'` doit répondre 204, et un fichier apparaître dans `events/` du bucket.
- Les prix du moment (Lambda, S3, Athena) : à faible volume, quelques centimes par mois au plus.

## Coupe-circuit et alertes (2026-11-24)

- Compte : uniquement le compte dédié LTH (profil `lth`). `deploy.sh` vérifie le numéro du compte et s'arrête s'il ne correspond pas.
- Coupe-circuit : plus de 300 appels en 5 minutes (`MaxPer5Min`) ou 20 000 en un jour (`MaxPerDay`) → une alarme ferme l'adresse toute seule (zéro appel autorisé). Les joueurs gardent leurs événements sur l'appareil. Rouvrir : `bash aws/telemetry/rouvrir.sh`, après avoir compris la cause.
- Alertes par courriel (fermeture, budget à 50 % et 100 % de `MonthlyBudgetUsd`, 5 $ par défaut) : `ALERT_EMAIL=adresse bash aws/telemetry/deploy.sh`. L'adresse n'est jamais écrite dans le dépôt. Sans adresse : coupe-circuit actif, mais ni courriel ni budget.
- Vérifié avec `cfn-lint` (réglage par défaut). PAS ENCORE DÉPLOYÉ ni essayé en vrai.
- Le jeu envoie vers AWS et ne lit jamais rien en retour : rien ne peut être poussé aux joueurs par ce canal.

## Tableau de bord (2026-11-24)

- `dashboard/index.html` : page seule, sans bibliothèque extérieure, qui lit `data.json` posé à côté. Filtres : période, version, race, plateforme.
- Chaque nuit (3 h 15 UTC), la fonction « caveroller-stats-bilan » relit les événements des 180 derniers jours et écrit `data.json` dans un bucket privé : une ligne par partie, les numéros d'appareil remplacés par j1, j2... Son code est dans `cloudformation.yaml` ; essai sans AWS : `node aws/telemetry/test-bilan.mjs`.
- Mise en ligne : `bash aws/telemetry/deploy.sh --tableau` demande un mot de passe (12 caractères au moins, jamais écrit dans le dépôt). La page est alors servie en HTTPS par CloudFront, utilisateur `lth`. Sans mot de passe, rien n'est en ligne. La page ne donne aucun accès au compte : elle ne lit qu'un fichier de totaux.
- `node aws/telemetry/dashboard/exemple.mjs` refabrique des DONNÉES D'EXEMPLE pour travailler la page (bandeau jaune) ; elles ne sont jamais envoyées sur AWS.
- Vérifié : cfn-lint, calcul essayé sans AWS, page essayée avec le résultat du calcul. PAS ENCORE DÉPLOYÉ : la mise en ligne et le mot de passe n'ont jamais été essayés en vrai.

## Joueurs et étiquettes (2026-11-24)

- Code joueur : cinq signes tirés du numéro d'appareil (`playerCode` dans `src/telemetry/telemetry.ts`, même calcul dans la fonction « caveroller-stats-bilan »). Affiché dans les Paramètres du jeu quand le joueur a accepté les statistiques. `data.json` contient ce code, jamais le numéro d'appareil.
- Étiquettes : `powershell -ExecutionPolicy Bypass -File etiquettes.ps1` ouvre le Bloc-notes (une ligne « CODE = Prénom »), puis envoie `tags.json` dans le bucket du tableau de bord (derrière le mot de passe). Décision de Thomas : les prénoms sont gardés sur AWS, « entorse acceptable à ce stade du dev ». Le jeu, lui, n'envoie toujours aucun nom.
- Tableau de bord : filtre « Joueur » et carte « Joueurs » (parties, morts, meilleur étage, dernière partie).

## Organisation sur le PC de Thomas et sécurité (2026-11-24, après l'audit)

- Dossier du PC : `Bureau\Claude\LTH Studio\Cave Roller`. À la racine, seulement `Cave Roller - AWS.cmd` (un menu) et `LISEZ-MOI.txt` ; tout le reste dans `systeme\` (`menu.ps1`, `installer.ps1`, `cloudformation.yaml`, `dashboard\`). Ne pas ajouter de fichier à la racine.
- `menu.ps1` : chaque action qui touche au compte commence par `aws logout` puis `aws login` (navigateur : mot de passe + code MFA) et finit par `aws logout`. Aucun accès AWS ne reste sur le PC entre deux usages.
- Étiquettes : saisies dans le tableau de bord (carte « Joueurs »), enregistrées par la fonction « caveroller-stats-etiquettes », joignable seulement par CloudFront, derrière le mot de passe ; elle n'écrit que `tags.json`. `etiquettes.ps1` reste dans le dépôt en secours, il n'est plus déposé sur le PC.
- Audit complet : `claude/statistiques/AUDIT_SECURITE.md` dans le Projet.

