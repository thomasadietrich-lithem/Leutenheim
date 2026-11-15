-- Statistiques de Cave Roller dans Athena (console AWS > Athena, région eu-west-3).
-- Remplacer BUCKET par le nom affiché par deploy.sh. À lancer une fois : les deux premières requêtes.

CREATE DATABASE IF NOT EXISTS caveroller;

CREATE EXTERNAL TABLE IF NOT EXISTS caveroller.events (
  e string, t bigint, run string, device string, version string, platform string, build string, lang string,
  received bigint, depth int, level int, turn int, test boolean, hp int, maxhp int, gold int, unhurt boolean,
  cause string, deepest int, bosses int, id string, what string, section int, race string, cls string, sandbox boolean
)
PARTITIONED BY (dt string)
ROW FORMAT SERDE 'org.openx.data.jsonserde.JsonSerDe'
WITH SERDEPROPERTIES ('ignore.malformed.json' = 'true', 'case.insensitive' = 'true')
LOCATION 's3://BUCKET/events/'
TBLPROPERTIES (
  'projection.enabled' = 'true',
  'projection.dt.type' = 'date',
  'projection.dt.format' = 'yyyy-MM-dd',
  'projection.dt.range' = '2026-11-01,NOW',
  'storage.location.template' = 's3://BUCKET/events/dt=${dt}/'
);

-- Parties commencées et joueurs (appareils) différents, par jour (sans les parties d'essai).
SELECT dt, count(*) AS parties, count(DISTINCT device) AS appareils
FROM caveroller.events WHERE e = 'run_start' AND NOT coalesce(test, false)
GROUP BY dt ORDER BY dt DESC;

-- Où meurt-on ? Morts par étage.
SELECT depth, count(*) AS morts FROM caveroller.events
WHERE e = 'death' AND NOT coalesce(test, false) GROUP BY depth ORDER BY depth;

-- De quoi meurt-on ? Les 15 premières causes.
SELECT cause, count(*) AS morts FROM caveroller.events
WHERE e = 'death' AND NOT coalesce(test, false) GROUP BY cause ORDER BY morts DESC LIMIT 15;

-- L'entonnoir : part des parties qui atteignent chaque étage.
WITH runs AS (SELECT DISTINCT run FROM caveroller.events WHERE e = 'run_start' AND NOT coalesce(test, false)),
     reach AS (SELECT run, max(depth) AS deepest FROM caveroller.events WHERE e = 'floor' GROUP BY run)
SELECT d AS etage, round(100.0 * count_if(coalesce(reach.deepest, 1) >= d) / count(*), 1) AS pourcent
FROM runs LEFT JOIN reach USING (run) CROSS JOIN UNNEST(sequence(1, 10)) AS s(d)
GROUP BY d ORDER BY d;

-- La Tisseuse : combien de victoires, à quel niveau, en combien de tours.
SELECT count(*) AS victoires, avg(level) AS niveau_moyen, avg(turn) AS tours_moyens
FROM caveroller.events WHERE e = 'boss_kill' AND NOT coalesce(test, false);

-- Les quêtes : données, réussies, ratées.
SELECT id, what, count(*) AS fois FROM caveroller.events
WHERE e = 'quest' AND NOT coalesce(test, false) GROUP BY id, what ORDER BY id, what;
