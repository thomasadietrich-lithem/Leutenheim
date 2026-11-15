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
