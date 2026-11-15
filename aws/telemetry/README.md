# Statistiques anonymes de Cave Roller (AWS)

Le jeu (navigateur, et plus tard l'appli Android / iPhone) envoie de petits événements anonymes à une Lambda, qui les range dans S3. On les lit avec Athena.

```
jeu ──(lots d'événements)──▶ Lambda « caveroller-stats » (adresse publique) ──▶ S3 (un fichier par lot, rangé par jour) ──▶ Athena (SQL)
```

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

Rien de personnel : pas de nom, pas d'adresse IP (la Lambda ne la lit pas), pas de cookie. Les fichiers s'effacent seuls au bout de 2 ans.

## Installer (une fois)

Il faut l'AWS CLI installée et connectée au compte (`aws configure`), puis `zip`.

```
bash aws/telemetry/deploy.sh
```

Le script crée le bucket, le rôle, la Lambda (région Paris, `eu-west-3`) et son adresse publique, puis l'affiche. Coller cette adresse dans `src/data/telemetry.ts` (champ `url`) : dès la publication suivante, le jeu pose la question aux joueurs et envoie.

Relancer le script met la Lambda à jour (rien n'est effacé).

## Garde-fous

- 5 appels en même temps au plus (la facture ne peut pas s'emballer si quelqu'un abuse de l'adresse).
- Lots de 50 événements et 64 Ko au plus ; seuls les nombres et les textes courts sont gardés.

## Lire

Console AWS > Athena (région Paris) : copier `athena.sql`, remplacer `BUCKET` par le nom du bucket, lancer les deux premières requêtes une fois (base et table), puis les autres quand on veut : parties par jour, morts par étage, causes de mort, entonnoir des étages, victoires contre la Tisseuse, quêtes.

## Côté jeu

`src/telemetry/telemetry.ts` (le module) et `src/data/telemetry.ts` (l'adresse et les réglages). Sans réseau, les événements attendent sur l'appareil (500 au plus) et repartent plus tard ; un envoi raté ne gêne jamais la partie. Le même code marche dans l'appli Capacitor (Android : origine `https://localhost`, iPhone : `capacitor://localhost` ; la Lambda accepte toutes les origines).
