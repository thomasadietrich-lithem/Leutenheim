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
  /** Sols spéciaux (planche art/sols_v1.png validée le 2026-11-11) : plaques de gravier et flaques par étage. */
  groundsInDungeon: true,
  gravelPatches: [0, 2] as [number, number],
  /** Motifs gravés au sol (rosace, rose des vents, runes, croix, spirale) : de tant à tant par étage (décor). */
  motifsPerFloor: [0, 2] as [number, number],
  gravelSize: [3, 8] as [number, number],
  puddles: [0, 3] as [number, number],
  puddleSize: [1, 4] as [number, number],
  /** Un pas sur le gravier : les monstres à tant de cases ou moins l'entendent (réveillés, ils foncent), +1 d'alerte. */
  gravelRadius: 5,
  gravelAlarm: 1,
  /** Le bruit d'un combat réveille les dormeurs à tant de cases ou moins. */
  combatWakeRadius: 4,
  /** Le héros contourne le gravier si le détour ne coûte pas plus de tant de pas. */
  gravelDetour: 6,
  /** Dortoir des Schrats (2026-11-11) : chance qu'un étage en ait un (au plus un), dans une salle d'au moins 6 × 5. */
  themedRoomsInDungeon: true,
  dortoirChance: 0.5,
  /** Lits superposés (contre le mur du haut), chaises autour de la table. */
  bunksMin: 2,
  bunksMax: 4,
  chairsMin: 1,
  chairsMax: 3,
  fallenChairChance: 0.5,
  /** Salles à thème par étage : chance d'en avoir une, puis (si oui) une deuxième, d'un autre thème (C). */
  themedRoomChances: [0.7, 0.35] as number[],
  /** Coffres du dortoir (0 à 2) et chance qu'une pomme soit dans l'assiette de la table. */
  dortoirChests: [0, 2] as [number, number],
  tableAppleChance: 0.5,
  /** Chance qu'une salle à thème cache quelque chose (au pied d'un meuble, butin du thème). */
  themedSecretChance: 0.75,
  /** Tapis : marcher dessus étouffe les pas (chance d'être remarqué multipliée par tant) ; il brûle tout entier. */
  rugNotice: 0.5,
  /**
   * Regard des monstres (Thomas, 2026-11-11 : « l'angle de vue doit correspondre au ? et au ! ») : un monstre éveillé
   * ne remarque le héros que dans l'éventail devant lui (demi-ouverture en radians, ≈ 46°), ou à son contact.
   * Endormi, il n'a pas d'éventail : il n'entend que de près (tant de cases).
   */
  gazeHalfAngle: 0.8,
  asleepHearing: 3,
  /** Toiles d'araignée : à partir de cet étage, chance qu'une salle sans torche en ait, et nombre de coins tissés. */
  websFromDepth: 3,
  // ---- Étage du boss de la section 1 : la Tisseuse (src/world/bossFloor.ts, src/core/boss.ts ; valeurs C) ----
  /** Étages des boss (un par section, le dernier de la section). */
  bossDepths: [5],
  /** Elle recule après ce nombre de morsures, ou dès qu'elle a perdu tant de PV depuis qu'elle s'est avancée. */
  bossBitesBeforeRetreat: 2,
  bossRetreatDamage: 10,
  /** Un cocon mangé lui rend tant de PV ; elle reste tant de tours tapie avant de revenir. */
  bossCocoonHeal: 6,
  bossLurkTurns: 2,
  /** Sur sa toile, tant de cases par tour (1 ailleurs). Ce qu'elle sent : le héros sur une toile, ou à cette distance. */
  bossWebSteps: 2,
  bossSenseRange: 2,
  /** Grande toile effondrée (amarres coupées, ou brûlée) : elle tombe sur le dos, sonnée tant de tours. */
  bossFallTurns: 3,
  /** Un leurre (flèche plantée dans une toile) l'attire tant de tours. */
  bossLureTurns: 10,
  /** Le feu lui fait tant de fois plus mal. */
  bossFireFactor: 2,
  /** Une nappe de toile brûle tant de tours, et enflamme ses voisines au tour suivant. */
  webFireTurns: 2,
  /** …mais au plus à tant de cases de toile de la flamme d'origine, et une nappe voisine sur deux (2026-11-11 : le feu
   * ne doit pas ravager toute la nichée). */
  webFireReach: 3,
  webFireSpreadChance: 0.5,
  webRoomChance: 0.35,
  webCorners: [1, 2] as [number, number],
  /** Entrer dans une toile : d20 + bonus de force contre cette difficulté, sinon englué un tour. La toile se déchire. */
  webEscapeDc: 12,
  /** Une salle tissée abrite souvent une araignée (ou deux). */
  spiderInWebRoomChance: 0.6,
  /** Trainards (tonneaux, caisses) : nombre par étage, dans les salles ordinaires, contre un mur. */
  clutterPerFloor: [1, 4] as [number, number],
  /** Agilité (Thomas, 2026-11-11) : +1 CA d'esquive tous les `agilityPerDodge` points ; un piège sous les pieds du héros
   * s'évite sur d20 + agilité contre `trapDodgeDc` (un 20 l'évite toujours, un 1 jamais). */
  agilityPerDodge: 2,
  trapDodgeDc: 18,
  /** Pousser (roue d'actions) : d20 + bonus de force contre cette difficulté. Le monstre recule d'une case et perd un tour… */
  pushDc: 10,
  /** …et s'il heurte un mur, une colonne ou une porte fermée, il encaisse en plus ces dégâts. */
  pushSlamDamage: { count: 1, sides: 6, bonus: 0 },
  /** Pièges (visibles pour l'instant) : chance qu'une salle (hors départ et salles à thème) en ait un. Sortes et effets : `src/data/traps.ts`. */
  trapRoomChance: 0.15,
  /** Sarcophage à pointes (salle de torture) : difficulté pour désamorcer (agilité) ou forcer (force), pointe si raté, bruit si forcé. */
  maidenDc: 11,
  maidenSpike: { count: 1, sides: 4, bonus: 0 },
  alarmMaiden: 5,
  /** Repos (roue d'actions) : nombre de tours passés sur place, une seule fois par étage. */
  restTurns: 20,
  /** Part des points de vie manquants rendue par un repos mené à son terme. */
  restHealShare: 0.5,
  /** Nombre d'étages d'une section (région à thème). */
  floorsPerSection: 5,
  /** Chance qu'une clef traîne quelque part sur l'étage. Elle ouvre une porte verrouillée, sans jet ni bruit. */
  keyChance: 0.35,
  /**
   * Expérience à réunir pour passer au niveau suivant (Thomas, 2026-11-11 : « à peu près un niveau par étage »).
   * Réglée sur l'expérience que rapporte un étage nettoyé (mesuré : 10, 12, 22, 24 XP aux étages 1 à 4, la Tisseuse 30) :
   * chaque niveau demande à peu près ce que donne l'étage où l'on se trouve. Au-delà du tableau, +6 par niveau.
   */
  xpLevels: [9, 11, 18, 20, 26, 30, 34],
  xpLevelStep: 6,
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
  /** Torche posée au sol : petite lueur. */
  groundTorchRadius: 3,
  /** Vitesse d'attaque : durée d'une attaque lente et d'une attaque rapide, en tours (C). */
  slowAttackTurns: 1.5,
  // ---- Points, voies et potions (2026-11-11) : valeurs proposées par Claude, validées par « Ok. Tout ». ----
  /** Un point en Vie : PV max en plus. */
  hpPerVie: 4,
  /** Second souffle (voie bleue) : PV rendus aux rangs 1, 2, 3. Double frappe : autant de fois par étage que son rang. */
  secondWindHeal: [5, 8, 12],
  /** Potions : poison sur l'arme (coups qui portent), vitesse (tours), feu (tours, dégâts par tour, portée). */
  weaponPoisonHits: 15,
  hasteTurns: 4,
  fireTurns: 5,
  /** Après avoir quitté les flammes, on brûle encore tant de tours (C). */
  burnAfter: 2,
  // ---- Niveau d'alerte (ex-« Tocsin », 2026-11-11) : le donjon se réveille si l'on s'attarde ou si l'on fait du bruit. Valeurs (C). ----
  /** L'alerte monte d'un point tous les tant de tours passés sur l'étage. */
  alarmTurnsPerPoint: 12,
  /** Bruit : porte enfoncée (réussie ou non), chaque coup échangé, un monstre qui remarque le héros. */
  alarmBreak: 15,
  alarmCombat: 1,
  alarmNoticed: 3,
  /** Seuils des paliers : agité, alerte, traque (sur 100). */
  alarmStages: [25, 50, 75],
  /** Agité : un promeneur arrive tous les tant de tours, et l'étage peut compter tant de monstres de plus. */
  agitatedRespawnTurns: 30,
  agitatedExtraPopulation: 1,
  /** Alerte : un promeneur tous les tant de tours, et tant de monstres de plus (Thomas : « trop de mobs » à 50). */
  alertRespawnTurns: 20,
  alertExtraPopulation: 2,
  /** Traqueurs (arrivent par l'entrée de l'étage) : mis de côté par Thomas le 2026-11-11, à 0 pour l'instant. */
  trackersAlert: 0,
  trackersHunt: 0,
  /** Taches de sang gardées par étage, au plus. */
  bloodMax: 150,
  fireDamage: { count: 1, sides: 4, bonus: 0 },
  fastAttackTurns: 0.75,
};
