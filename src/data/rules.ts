/** Règles chiffrées du jeu, hors fiches de créatures. */
export const RULES = {
  /** Crocheter une serrure : d20 + bonus de classe contre cette difficulté. Silencieux. */
  lockpickDc: 12,
  /** Enfoncer une porte : d20 + bonus de classe contre cette difficulté. Bruyant, réussite ou non. */
  breakDc: 8,
  /** Le bruit d'une porte enfoncée alerte les monstres jusqu'à cette distance (en cases). */
  noiseRadius: 10,
  /** Un monstre remarque plus facilement un héros éclairé par une torche, moins facilement dans le noir. */
  noticeInLight: 1.5,
  noticeInDark: 0.6,
  /** Un monstre endormi remarque moins bien le héros ; un monstre qui se promène, mieux. */
  noticeAsleep: 0.5,
  noticeAwake: 1.5,
  /** Flèche qui touche : chance de la retrouver intacte sur la case de la cible. */
  arrowKeepOnHit: 0.6,
  /** Flèche qui rate : elle file dans le décor ; chance qu'elle ne se casse pas. */
  arrowKeepOnMiss: 0.5,
  /** Flèche tirée sur le décor (sol, mur, porte) : chance qu'elle ne se casse pas. */
  arrowKeepOnScenery: 0.5,
  /** Une flèche qui heurte un obstacle rebondit d'une à deux cases en arrière avant de tomber. */
  arrowBounceMin: 1,
  arrowBounceMax: 2,
  /** Une flèche brisée reste visible au sol ce nombre de tours, et s'efface sur les derniers. */
  brokenArrowTurns: 8,
  brokenArrowFadeTurns: 4,
  /** Tir sur une cible engagée dans un couloir d'une case de large : bonus au d20 (la flèche n'a guère où passer à côté). */
  narrowShotBonus: 3,
  /** Séries de ratés du héros : à partir de ce nombre d'attaques manquées d'affilée, les suivantes sont aidées… */
  missStreakStart: 3,
  /** …de ce bonus au d20 par raté au-delà (3, puis 6, puis 9…), jusqu'au premier coup qui porte. */
  missStreakBonus: 3,
  /** Distance maximale parcourue par une flèche ratée au-delà de sa cible. */
  arrowOvershoot: 4,
  /** Se cacher (roue d'actions) : d20 + bonus de discrétion contre cette difficulté (9 : 60 % de réussite sans bonus). */
  hideDc: 9,
  /** Se dégager (roue d'actions) : le héros saute à tant de cases, en ligne droite… */
  jumpDistance: 2,
  /** …s'il réussit d20 + bonus d'agilité contre cette difficulté ; raté, il reste sur place et le tour est perdu. */
  disengageDc: 10,
  /** Fouiller une salle : tours passés sur place, puis d20 + bonus de fouille contre cette difficulté. Une fouille par salle. */
  searchTurns: 5,
  searchDc: 8,
  /** Chance qu'une salle cache un secret : 0 pour une salle vide, tant par genre d'élément présent (colonnes, cheminée…), plafonnée. */
  secretChancePerElement: 0.2,
  secretChanceMax: 0.6,
  /** Une cache contient de l'or (de min à max, plus un bonus par étage) ou, sinon, quelques flèches. */
  secretGoldChance: 0.6,
  secretGoldMin: 6,
  secretGoldMax: 16,
  secretGoldPerDepth: 2,
  secretArrowsMin: 2,
  secretArrowsMax: 5,
  /** Pousser (roue d'actions) : d20 + bonus de force contre cette difficulté. Le monstre recule d'une case et perd un tour… */
  pushDc: 10,
  /** …et s'il heurte un mur, une colonne ou une porte fermée, il encaisse en plus ces dégâts. */
  pushSlamDamage: { count: 1, sides: 6, bonus: 0 },
  /** Pièges (visibles pour l'instant) : chance qu'une salle (hors départ) en ait un, et dégâts à qui marche dessus. */
  trapRoomChance: 0.15,
  trapDamage: { count: 1, sides: 4, bonus: 1 },
  /** Repos (roue d'actions) : nombre de tours passés sur place, une seule fois par étage. */
  restTurns: 20,
  /** Part des points de vie manquants rendue par un repos mené à son terme. */
  restHealShare: 0.5,
  /** Nombre d'étages d'une section (région à thème). */
  floorsPerSection: 5,
  /** Chance qu'une clef traîne quelque part sur l'étage. Elle ouvre une porte verrouillée, sans jet ni bruit. */
  keyChance: 0.35,
  /**
   * Expérience à réunir pour passer au niveau suivant (Thomas, 2026-11-11 : « une croissance ; au début on passe
   * rapidement »). Niveau 1 → 2 : `xpFirst` ; chaque niveau demande `xpStep` de plus que le précédent, et ce supplément
   * grandit lui-même de `xpStepGrowth`. Avec 6 / 6 / 2 : 6, 12, 20, 30, 42, 56, 72… (C)
   */
  xpFirst: 6,
  xpStep: 6,
  xpStepGrowth: 2,
  /** Points de vie gagnés à chaque niveau. */
  hpPerLevel: 3,
  /** Or contenu dans un coffre : de `min` à `max`, plus un bonus par étage. */
  chestGoldMin: 8,
  chestGoldMax: 20,
  chestGoldPerDepth: 3,
  /** Repeuplement : tous les tant de tours, si l'étage compte moins de monstres qu'à l'origine, un promeneur arrive. */
  respawnTurns: 40,
  /** Il apparaît hors de vue, au moins à cette distance du héros (en cases). */
  respawnDistance: 8,
  /** Coin de mur « logique » : deux pans vus qui se rejoindraient à moins de tant de cases font apparaître leur coin. */
  cornerReach: 4,
  /** Nombre de pas sur lesquels on « devine » les passages au-delà de ce qu'on voit. */
  senseDepth: 3,
  /** Butin au sol : chance qu'une salle (hors départ) contienne un objet (C). */
  lootRoomChance: 0.3,
  /**
   * Butin au sol activé dans le donjon (dessins art/objets_v1.png validés par Thomas le 2026-11-11).
   */
  lootEnabled: true,
  /** Torche portée : rayon de lumière autour du héros. */
  torchRadius: 6,
  /** Vitesse d'attaque : durée d'une attaque lente et d'une attaque rapide, en tours (C). */
  slowAttackTurns: 1.5,
  // ---- Points, voies et potions (2026-11-11) : valeurs proposées par Claude, validées par « Ok. Tout ». ----
  /** Un point en Vie : PV max en plus. */
  hpPerVie: 4,
  /** Second souffle (voie bleue) : PV rendus. */
  secondWindHeal: 10,
  /** Double frappe (voie rouge) : utilisations par étage. */
  doubleStrikesPerFloor: 3,
  /** Bousculade (voie verte) : distance de poussée et tours de ralentissement. */
  shoveDistance: 3,
  slowTurns: 3,
  /** Impact (voie verte) : dégâts contre un mur ; Charge : dégâts en plus ; Rage : dégâts en plus. */
  impactDamage: { count: 2, sides: 6, bonus: 0 },
  chargeDamage: { count: 1, sides: 6, bonus: 0 },
  rageBonus: 2,
  /** Pas de côté (voie verte) : bonus pour se dégager et longueur du saut. */
  sidestepBonus: 3,
  sidestepDistance: 3,
  /** Potions : poison sur l'arme (coups qui portent), vitesse (tours), feu (tours, dégâts par tour, portée). */
  weaponPoisonHits: 15,
  hasteTurns: 4,
  fireTurns: 5,
  /** Après avoir quitté les flammes, on brûle encore tant de tours (C). */
  burnAfter: 2,
  // ---- Tocsin (2026-11-11) : le donjon se réveille si l'on s'attarde ou si l'on fait du bruit. Valeurs (C). ----
  /** L'alerte monte d'un point tous les tant de tours passés sur l'étage. */
  alarmTurnsPerPoint: 8,
  /** Bruit : porte enfoncée (réussie ou non), chaque coup échangé, un monstre qui remarque le héros. */
  alarmBreak: 15,
  alarmCombat: 1,
  alarmNoticed: 4,
  /** Seuils des paliers : agité, alerte, hallali (sur 100). */
  alarmStages: [25, 50, 75],
  /** Agité : un promeneur arrive tous les tant de tours, et l'étage peut compter tant de monstres de plus. */
  agitatedRespawnTurns: 20,
  agitatedExtraPopulation: 2,
  /** Alerte et hallali : traqueurs qui arrivent par l'entrée de l'étage et foncent sur le héros. */
  trackersAlert: 2,
  trackersHallali: 3,
  /** Taches de sang gardées par étage, au plus. */
  bloodMax: 150,
  fireDamage: { count: 1, sides: 4, bonus: 0 },
  fastAttackTurns: 0.75,
};
