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
  /** Précision de base du héros, ajoutée à toutes ses attaques, au contact et à distance (Thomas, 2026-11-24 : « ajoute +1 »). */
  heroHitBonus: 1,
  /** Séries de ratés du héros : à partir de ce nombre d'attaques manquées d'affilée, les suivantes sont aidées… */
  missStreakStart: 3,
  /** …de ce bonus au d20 par raté au-delà (3, puis 6, puis 9…), jusqu'au premier coup qui porte. */
  missStreakBonus: 3,
  /** Distance maximale parcourue par une flèche ratée au-delà de sa cible. */
  arrowOvershoot: 1,
  /** Une flèche ratée qui se brise file jusqu'à tant de cases derrière la cible (et peut rebondir sur un mur). */
  brokenArrowOvershoot: 4,
  /** Se cacher (roue d'actions) : d20 + bonus de discrétion contre cette difficulté (9 : 60 % de réussite sans bonus). */
  hideDc: 9,
  /** L'XP d'un monstre vaincu est multipliée par ceci (Thomas, 2026-11-12, soir : « divise par deux l'XP ramassée »). */
  xpGainFactor: 0.5,
  /** XP d'une tâche de quête rendue au PNJ (Thomas, 2026-11-13 ; C). */
  questXp: 4,
  /** Caché, puis repos : on sort de l'ombre au bout de tant de tours de repos (Thomas, 2026-11-13 ; C). */
  hideRestTurns: 4,
  /** Un Kobold sous le tiers de ses PV prend la fuite une fois sur trois, pendant tant de tours (Thomas ; C). */
  koboldFleeChance: 0.35,
  /** Chez le Colporteur, chaque point de Charisme baisse les prix d'achat (Thomas, 2026-11-16 ; taux et plafond C). */
  charismaDiscount: 0.02,
  charismaDiscountMax: 0.3,
  koboldFleeTurns: 4,
  /** Fuite : jusqu'où (en pas) le fuyard cherche la case la plus éloignée du héros ; il passe les portes. */
  fleeLookAhead: 8,
  /** Potion de brouillard (Thomas, 2026-11-13, dessin) : losange de rayon 2 (rangées de 1, 3, 5, 3, 1 cases), durée en tours (C). */
  fogArm: 2,
  fogTurns: 8,
  /** Deux monstres côte à côte dans le brouillard : chance par tour qu'ils se battent (C). */
  fogBrawlChance: 0.25,
  /** Potion de pierre (Thomas, 2026-11-13) : bue, statue tant de tours ; lancée, le monstre pétrifié tant de tours. */
  stoneTurns: 10,
  petrifyTurns: 10,
  /** Potion d'oursin : part des dégâts reçus au contact renvoyée (Thomas : 15 %), durée en tours (C). */
  urchinReflect: 0.15,
  urchinTurns: 40,
  /** Flûte de pan (bibelot) : chance par tour de combat d'endormir l'ennemi le plus proche à tant de cases (C). */
  fluteChance: 0.08,
  fluteRange: 4,
  /** Œil de chauve-souris (bibelot) : ombres des monstres à 10 cases en vue dégagée, 3 à travers un mur (Thomas). */
  batRange: 10,
  batWallRange: 3,
  /** Salle de bain du Kobold (Thomas, 2026-11-13 ; valeurs C) : tours savonneux (désavantage), coup de serviette qui
   * aveugle, alerte au plouf et à la fuite, distance où l'on entend le tourne-disque. */
  soapyTurns: 2,
  towelBlindChance: 0.3,
  bathAlarm: 3,
  bathFleeAlarm: 10,
  bathMusicRange: 7,
  /** Après une cachette réussie, les monstres qui le traquaient restent sur place tant de tours (Thomas, 2026-11-12 :
   * « les Kobolds archers essayent de s'approcher si on se cache »). */
  hideLostTurns: 6,
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
  /** Moins d'or partout (Thomas, 2026-11-16 : « réduis la quantité d'or qu'on ramasse à toutes les étapes ») : tas,
   *  coffres, caches, pièces secrètes, monstres (pas les récompenses des PNJ). (C) */
  // Encore moins (Thomas, 2026-11-25 : « réduis la quantité d'or aussi ») : 0,6 → 0,45.
  goldFactor: 0.45,
  secretGoldMin: 6,
  secretGoldMax: 16,
  secretGoldPerDepth: 2,
  secretArrowsMin: 2,
  secretArrowsMax: 5,
  /** Sols spéciaux (planche art/sols_v1.png validée le 2026-11-11) : plaques de gravier et flaques par étage. */
  groundsInDungeon: true,
  gravelPatches: [0, 2] as [number, number],
  /** Le gravier augmente avec la profondeur : +1 plaque (et des plaques plus grandes) tous les tant d'étages, au plus `gravelPatchesMax`. */
  gravelGrowth: 2,
  /** Autel à la pomme dorée (Thomas, 2026-11-12) : bénédiction de +1 au jet d'attaque et +1 CA pendant tant de tours (C). */
  /** Querelles (Thomas, 2026-11-12) : deux monstres bloqués l'un par l'autre depuis tant de tours se battent (C). */
  feudBlockedTurns: 2,
  /** Un monstre touché par la pierre d'un frondeur se retourne contre lui une fois sur tant (C). */
  feudShotChance: 0.5,
  blessBonus: 1,
  blessTurns: 150,
  /** Statues (Thomas, 2026-11-12) : un étage sur trois en a une (décor) ; la creuse (avec Gluck) se brise, d20 + force
   *  contre `statueDc`, chaque coup fait `statueAlarm` d'alerte. (C) */
  statueChance: 1 / 3,
  statueDc: 12,
  statueAlarm: 5,
  /** Potion de poison jetée (cassée) : un petit nuage sur sa case, tant de tours (C). */
  brokenPoisonGasTurns: 3,
  /** Potion de poison LANCÉE : un nuage en croix, tant de tours (C). */
  thrownPoisonGasTurns: 4,
  gravelPatchesMax: 6,
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
  /** Un monstre éveillé mais distrait accourt au bruit d'un combat à tant de cases, s'il le voit. */
  combatHearRadius: 3,
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
  /** Section 2 : la champignonnière de morilles (chance), puis l'atelier de sculpture (C). */
  themedRoomChancesS2: [0.85, 0.6, 0.35] as number[],
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
  /** Le bras du Colosse qui touche repousse le héros de tant de cases, et le jette à terre. */
  colossusSweep: 2,
  /** Niche secrète : chance que l'alcôve s'ouvre sur un passage menant à une petite salle au coffre. */
  nichePassageChance: 0.33,
  /** Bibelots (artefacts) qui peuvent sortir dans une partie, au plus (butin, coffres, caches, Colporteur). */
  artifactsPerRun: 2,
  /** Salles spéciales : ce que coûte un vœu, la bénédiction de l'autel (tours), le jet de discrétion du festin. */
  wellCost: 10,
  altarBlessTurns: 40,
  feastStealthDc: 12,
  /** Le Guerrier (armure qui cliquette) réveille les dormeurs à tant de cases. */
  warriorWakeRange: 2,
  /** Brouillard : tours pendant lesquels un monstre qui a perdu le héros cherche sur place, sans le remarquer. */
  fogLostTurns: 2,
  /** Toiles d'araignée : à partir de cet étage, chance qu'une salle sans torche en ait, et nombre de coins tissés. */
  websFromDepth: 3,
  // ---- Étage du boss de la section 1 : la Tisseuse (src/world/bossFloor.ts, src/core/boss.ts ; valeurs C) ----
  /** Dernier étage de la démo : descendre son escalier termine la partie. 10 jusqu'au 2026-11-21 ; puis Thomas : « ouvre
   *  le 10 » : après le Carillon, l'escalier mène à l'Ossuaire (section 3), la démo finit sous la Grande Prêtresse. */
  demoLastDepth: 15,
  /** APERÇU DE LA SECTION 3, L'OSSUAIRE (Thomas, 2026-11-19 : « ok implémente tout ») : en partie d'essai seulement,
   *  l'escalier de l'étage 10 et le téléporteur mènent jusqu'ici ; la vraie démo finit toujours à l'étage 10. */
  previewLastDepth: 15,
  /** Ossuaire : puits de lune par étage (la seule lumière), leur portée ; alcôves d'ossuaire au plus par salle. */
  moonWells: [2, 4] as [number, number],
  moonRadius: 5,
  /** Monstres de l'ossuaire (claude/MONSTRES_S3.md, C) : tours hors de la lune avant que le gisant se recouche ; portée et
   *  soin du chant de l'acolyte. */
  effigyRestTurns: 3,
  /** La chapelle des os (salle spéciale de la section 3) : chance par étage (C). */
  chapelChance: 0.6,
  /** Le musée (salle spéciale de la section 3) : chance par étage (C). */
  museumChance: 0.9,
  /** Potion de gel (Thomas, 2026-11-19, C) : tours de gel, et le givre au sol. */
  freezeTurns: 3,
  /** Eau gelée par la potion de gel : tours avant le dégel (C). */
  iceTurns: 12,
  /** Un boss gèle moins longtemps (2 tours). */
  bossFreezeTurns: 2,
  /** Grenade sainte (C) : rayon, dégâts (doublés contre les morts), bénédiction et soin du héros. */
  holyRadius: 2,
  holyDamage: { count: 2, sides: 6, bonus: 2 },
  holyBlessTurns: 20,
  holyHeal: { count: 1, sides: 6, bonus: 0 },
  chantRange: 4,
  chantHeal: 4,
  ossAlcovesPerRoom: 2,
  /** Coffre doré de la fin du boss (Thomas, 2026-11-14) : or (C). */
  goldChestGold: [80, 140] as [number, number],
  /** Étages des boss (un par section, le dernier de la section). */
  bossDepths: [5, 10, 15],
  /** Provisions par étage (Thomas, 2026-11-19), tirées à part : chance de la 1re, de la 2e (`foodRations`). */
  // Plus de nourriture (Thomas, 2026-11-24 : « augmenter la fréquence de soin donné »), avant [0.55, 0.15] ; puis
  // « beaucoup trop de soin, retire 60 % de ce qu'on a ajouté » (2026-11-25) : [0.8, 0.35] → [0.65, 0.23].
  foodRationChances: [0.65, 0.23],
  /** Ce que donnent les provisions, par section (tiré au hasard dans la liste ; un doublon pèse double). */
  foodRationTable: [
    ["pomme", "pomme", "cuisse_poulet"],
    ["morille", "cuisse_poulet", "pomme"],
    ["tourte_fossoyeur", "tourte_fossoyeur", "cuisse_poulet"],
  ],
  /** Boss de la section 3 (C) : la Prêtresse appelle la lune tous les N tours (annoncé), chante tous les N tours ;
   *  rayon du puits selon les cierges encore allumés ; le Colosse : tours dans la lune pour qu'un morceau se ressoude. */
  // Plus dure (Thomas, 2026-11-19 : « le boss 3 est beaucoup beaucoup trop simple »).
  /** Pièges : part des PV max du héros perdue, par section (Thomas, 2026-11-21). */
  trapHeroShare: [[0.05, 0.1], [0.1, 0.15], [0.15, 0.2]] as [number, number][],
  // Adoucie (Thomas, 2026-11-21 : « le combat est beaucoup trop difficile ; réduis le nombre d'invocations ») :
  // lune tous les 5 tours, chant tous les 6, 2 squelettes relevés au plus, éclair tous les 3 tours.
  priestessCallEvery: 5,
  /** Bénédiction de Sœur Clavicule (jet de Charisme réussi) : tours bénis. */
  claviculeBlessTurns: 80,
  priestessChantEvery: 6,
  priestessChantHeal: 5,
  priestessWellRadius: [1, 2, 2, 3, 3, 4, 4],
  colossusRegrowTurns: 3,
  /** Chaque chant relève un squelette au pied du socle, tant que la salle en compte moins que ça. */
  priestessRaiseMax: 2,
  /** Dans le puits : un éclair de lune sur le héros tous les N tours (jet +8, 2d6+2). */
  priestessBoltEvery: 3,
  /** Le Carillon (boss de la section 2, Thomas, 2026-11-16) : il sonne tous les tant de tours ; l'onde fait tant de
   *  dégâts (le double au contact de sa lèvre) ; sonné faux, il reste sonné tant de tours. (C) */
  carillonEvery: 8,
  carillonWaveDamage: { count: 1, sides: 6, bonus: 0 },
  carillonFalseTurns: 2,
  /** Pluie d'encre (Thomas, 2026-11-16) : gouttes marquées par tour, dégâts d'une goutte. (C) */
  carillonInkDrops: 3,
  /** Trajet repris (bouton avance rapide) : il s'arrête quand un monstre alerté arrive à tant de cases. (C) */
  waryStopRange: 3,
  /** Salle de bain du Kobold (Thomas, 2026-11-16 : « plus petite ») : 20 cases au plus, sinon un cabinet taillé. */
  bathMaxArea: 20,
  /** Chambre de neige (pièce secrète très rare, Thomas 2026-11-16) : sa part des pièces secrètes. (C) */
  snowRoomChance: 0.08,
  /** Flaques laissées par la neige fondue. (C) */
  snowMeltPuddles: 4,
  /** Bombe arcanique (Thomas, 2026-11-16) : tours avant l'explosion, longueur des bras de la croix, dégâts. (C) */
  bombDelay: 3,
  bombArm: 4,
  bombDamage: { count: 2, sides: 6, bonus: 0 },
  carillonInkDropsHard: 4,
  /** Encre en zones (Thomas, 2026-11-17 : « des zones plutôt que des cercles aléatoires ») : une zone tous les tant
   *  de tours (doux, dur) ; sans battant, une COULÉE au pied du chapeau tous les tant de tours, sur cette largeur. (C) */
  carillonInkEvery: 3,
  carillonInkEveryHard: 3,
  /** L'encre tombe tant de tours après avoir été annoncée (2 : le temps de se mettre à l'abri ; Thomas, 2026-11-17). */
  carillonInkWarn: 2,
  /** Fidèles du Carillon : tours à côté du battant tombé pour le remettre (C). */
  carillonRepairTurns: 4,
  carillonDripEvery: 4,
  carillonDripReach: 2,
  /** Les monstres de la grotte s'écartent tant de tours avant l'onde (2 : le héros a le temps de se placer). (C) */
  carillonCowerLead: 2,
  /** Carillon, suite (Thomas, 2026-11-17 : « go » sur les propositions) (C) : PHASES (sous 2/3 des PV, zones de 4 cases
   *  au lieu de 3 ; sous 1/3, une onde tous les 6 tours) ; SOUCHES qui se fêlent quand elles arrêtent l'onde et
   *  tombent au 2e coup ; (l'ÉCHO a été retiré le 2026-11-17) ; GLAS : sous
   *  10 % des PV, trois ondes rapprochées (tous les 2 tours), puis il s'affaisse 3 tours (CA −2). */
  carillonZoneReach: [3, 4],
  carillonEveryLate: 6,
  carillonStumpHits: 2,
  carillonKnellAt: 0.1,
  carillonKnellRings: 3,
  carillonKnellFallen: 3,
  /** Crachat d'encre (2026-11-18, remplace le coup de chapeau) : tous les tant de tours, jet, dégâts (C). */
  carillonSpitEvery: 2,
  carillonSpitBonus: 5,
  carillonSpitDamage: { count: 1, sides: 8, bonus: 1 },
  /** Le battant, à l'abri sous le chapeau hors de l'avertissement : sa classe d'armure (seul un 20 naturel passe). */
  carillonClapperGuard: 40,
  /** Désamorcer un piège (Thomas, 2026-11-17) : d20 + agilité (+ crochetage) contre tant ; raté de 5 ou plus, il part. (C) */
  disarmDc: 12,
  /** Un équipement d'une section passée, dans le butin : son poids (1 pour celui de la section en cours). (C) */
  pastSectionGearWeight: 0.25,
  /** Fouiller dans un couloir (Thomas, 2026-11-17) : les cases de couloir à tant de cases du héros. (C) */
  corridorSearchReach: 5,
  /** Pièges de couloir (Thomas, 2026-11-17 : « à condition qu'il y ait un autre accès ») : dès l'étage 2, chance d'en
   *  poser un par étage, puis un deuxième dès l'étage 4. (C) */
  corridorTrapMinDepth: 2,
  corridorTrapChance: 0.35,
  corridorTrapSecondDepth: 6,
  carillonInkDamage: { count: 1, sides: 6, bonus: 0 },
  /** Elle recule après ce nombre de morsures, ou dès qu'elle a perdu tant de PV depuis qu'elle s'est avancée. */
  bossBitesBeforeRetreat: 2,
  bossRetreatDamage: 20,
  /** Un cocon mangé lui rend tant de PV ; elle reste tant de tours tapie avant de revenir. */
  bossCocoonHeal: 6,
  bossLurkTurns: 1,
  /**
   * Thomas, 2026-11-14 : « améliore sa mobilité, et la vitesse d'agro ». Sur sa toile, 3 cases par tour (2 ailleurs).
   * Elle sent le héros sur une toile, ou à 5 cases ; une fois réveillée, elle le suit tant qu'il est à 8 cases et pas caché.
   */
  /** Pièce secrète (Thomas, 2026-11-14 : « 0 à 1 par étage ») : chance par étage (C), or des piles au sol (C), portée
   *  du creux qui laisse voir dedans (Thomas : « à moins de 3 cases »), bonus de fouille quand on l'a entrevue (C). */
  secretRoomChance: 0.5,
  secretGold: [8, 16] as [number, number],
  secretPeekRange: 3,
  secretGlimpseBonus: 5,
  /** Pièce secrète : assombrissement du sol, de l'entrée au fond (Thomas, 2026-11-14 : « avec un dégradé »). */
  secretShade: [0.3, 0.72] as [number, number],
  /** Grille de prison : forcer, d20 + force contre ce nombre (C) ; alerte à chaque essai (C). */
  grilleDc: 12,
  grilleAlarm: 3,
  /** Briques manquantes et petits creux dans les murs, par étage (C). */
  wallMarks: [3, 7] as [number, number],
  /** Le poulet qui court : les cases à cette distance de lui se voient, même dans le noir (Thomas, 2026-11-14). */
  chickenGlowRadius: 1,
  /** Rayon de la lueur autour du PNJ qui a donné la quête en cours (Thomas, 2026-11-14). */
  questNpcLight: 4,
  /** À la mort de la Tisseuse, ses petits s'éloignent de ce nombre de pas avant de fuir dans la fumée (Thomas, 2026-11-14). */
  bossBroodFleeSteps: 3,
  bossWebSteps: 3,
  bossGroundSteps: 2,
  bossSenseRange: 5,
  /** La Tisseuse bloquée crache sa toile jusqu'à tant de cases. */
  bossSpitRange: 7,
  bossChaseRange: 8,
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
  /** Un squelette à butin sur cet étage (C). */
  skeletonChance: 0.5,
  /** On entend un monstre sur le gravier ou dans l'eau jusqu'à cette distance (C). */
  gravelHearing: 8,
  /** Section 2 (2026-11-18, C) : champignons refermés après un bruit (tours) ; explosion de spores (dégâts, alerte) ;
   *  vesses-de-loup par étage. */
  mushHushTurns: 3,
  /** Niche secrète derrière une dalle à pression : un étage sur trois ; alerte du grondement (C). */
  nicheChance: 0.33,
  nicheAlarm: 2,
  sporeBlastDamage: { count: 1, sides: 6, bonus: 0 },
  sporeBlastAlarm: 5,
  puffballsPerFloor: [2, 4] as [number, number],
  /** UN TRUC FUN PAR SECTION (Thomas, 2026-11-12) : sur un des étages 1 à `funMaxFloor` de chaque section, tiré au
   *  début de la partie, la cloche d'alarme OU la porte du Kobold qui compte (une chance sur deux). */
  funMaxFloor: 3,
  /** Le poulet fou en plus du truc fun (Thomas, 2026-11-24 : « augmente la fréquence ») : chance par étage (sections 1 et 2). */
  /** Feu de camp (section 1) : chance par étage qu'une bande de Kobolds endormis dorme autour d'un feu. */
  campfireChance: 0.8,
  chickenExtraChance: 0.35,
  /** Le trou aux poulets (une fois par section, sections 1 et 2) : tours de course avant la chute une fois vus. */
  chickenRingTurns: 4,
  /** Porte du Kobold qui compte (Thomas, 2026-11-12) : il dit son nombre une fois par tour (« 17… 17… 17… », un à la
   *  fois) quand le héros est à tant de cases ou moins ; son nombre de départ ; le doigt dans l'œil fait tant de dégâts. */
  counterHearing: 5,
  counterStart: 13,
  counterPoke: 1,
  /** Cloche d'alarme : la sonner ajoute tant d'alerte (un palier, C). */
  bellAlarm: 25,
  /** Agilité (Thomas, 2026-11-11) : +1 CA d'esquive tous les `agilityPerDodge` points ; un piège sous les pieds du héros
   * s'évite sur d20 + agilité contre `trapDodgeDc` (un 20 l'évite toujours, un 1 jamais). */
  agilityPerDodge: 2,
  trapDodgeDc: 18,
  /** Pousser (roue d'actions) : d20 + bonus de force contre cette difficulté. Le monstre recule d'une case et perd un tour… */
  pushDc: 10,
  /** …et s'il heurte un mur, une colonne ou une porte fermée, il encaisse en plus ces dégâts. */
  pushSlamDamage: { count: 1, sides: 6, bonus: 0 },
  /** Pièges : chance qu'une salle (hors départ et salles à thème) en ait un. Sortes et effets : `src/data/traps.ts`. */
  trapRoomChance: 0.12,
  /** …et en plus à chaque étage au-delà du premier (crescendo, Thomas 2026-11-13), jusqu'à `trapRoomChanceMax` (C). */
  trapRoomChancePerDepth: 0.03,
  trapRoomChanceMax: 0.3,
  /** Pièges CACHÉS (Thomas, 2026-11-13 : « invisibles en crescendo, détectés en recherche ») : part des pièges cachés par
   *  étage (étage 1, 2, 3…, le dernier chiffre vaut ensuite) ; un piège caché ne se voit pas, le héros ne le contourne
   *  pas ; une fouille réussie de la salle le révèle, ou il se révèle en partant (C). */
  // Crescendo DOUX (Thomas, 2026-11-14) : 10 % à l'étage 1, +8 % par étage, 60 % au plus.
  trapHiddenByDepth: [0.1, 0.18, 0.26, 0.34, 0.42, 0.5, 0.55, 0.6],
  /** Crescendo par SECTION (Thomas, 2026-11-14 : « augmente la fréquence des pièges visibles et invisibles plus on avance
   *  dans les sections ») : à chaque section passée, la chance d'un piège par salle (et son plafond) monte de
   *  `trapRoomChancePerSection`, et la part des cachés de `trapHiddenPerSection`, jusqu'à `trapHiddenMax` (C). */
  trapRoomChancePerSection: 0.1,
  trapHiddenPerSection: 0.1,
  trapHiddenMax: 0.8,
  /** Sarcophage à pointes (salle de torture) : difficulté pour désamorcer (agilité) ou forcer (force), pointe si raté, bruit si forcé. */
  maidenDc: 11,
  maidenSpike: { count: 1, sides: 4, bonus: 0 },
  alarmMaiden: 5,
  /** Repos (roue d'actions) : nombre de tours passés sur place, une seule fois par étage. */
  restTurns: 20,
  /** Part des points de vie manquants rendue par un repos mené à son terme. */
  restHealShare: 0.5,
  /** Repos à partir de la section 2 : part de la vie manquante rendue, étage par étage (6, 7, 8, 9, 10). */
  restHealShareDeep: [0.5, 0.42, 0.36, 0.3, 0.3],
  /** Poussées réussies qu'il faut pour arracher le battant du Carillon. */
  carillonClapperPushes: 3,
  /** Nombre d'étages d'une section (région à thème). */
  floorsPerSection: 5,
  /** Chance qu'une clef traîne quelque part sur l'étage. Elle ouvre une porte verrouillée, sans jet ni bruit. */
  keyChance: 0.35,
  /**
   * Expérience à réunir pour passer au niveau suivant (Thomas, 2026-11-11 : « à peu près un niveau par étage »).
   * XP des monstres divisée par deux (Thomas, 2026-11-12) : Kobold 1 à 3, frondeur 2 à 3, araignée 2 à 4, Tisseuse 15.
   * Seuils relevés d'environ ×1,5 (Thomas, 2026-11-12 : « augmente l'XP requise »). Mesuré sur 300 parties avec un
   * joueur qui tue la moitié des monstres : 4,7 / 5,5 / 8,3 / 9,3 XP aux étages 1 à 4 ; il arrive niveau
   * 1,3 / 2,1 / 3,0 / 3,9 aux étages 2 à 5 (avant : 1,7 / 2,7 / 3,9 / 5,1). Au-delà du tableau, +2 par niveau.
   */
  xpLevels: [6, 8, 10, 12, 14, 16, 18],
  xpLevelStep: 2,
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
  // Affaibli (Thomas, 2026-11-20) : 3, 5, 7… au lieu de 4, 7, 10…
  secondWindHeal: [3, 5, 7, 9, 11, 13],
  /** Cri de guerre (voie rouge, Rang II) : portée, PV max d'un ennemi « faible », sa chance de fuir. */
  warCryRadius: 3,
  /** Pinceau magique : tours que dure le faux mur ; diapason : portée en cases (2026-11-18, C). */
  fakeWallTurns: 10,
  /** Voler le canard du Kobold du bain (caché) : d20 + discrétion contre cette difficulté (C). */
  duckStealDc: 10,
  diapasonReach: 5,
  warCryWeakHp: 10,
  warCryFleeChance: 0.5,
  /** Potion de géant (Thomas, 2026-11-13) : durée en tours. */
  growTurns: 8,
  /** Poussée (Thomas, 2026-11-13) : chance de renverser l'ennemi (toujours contre un mur), et en plus par rang de Bousculade. */
  pushProneChance: 0.35,
  pushProneBonus: 0.2,
  /** Araignées contre Kobolds (Thomas, 2026-11-13) : au plus tant de bagarres montrées par étage, chance par tour, portée. */
  speciesBrawlsPerFloor: 1,
  speciesBrawlChance: 0.25,
  speciesBrawlRange: 5,
  /** Potion glissante : nombre de cases glissées après un coup, rebonds au plus, dégâts contre le mur. */
  slipDistance: 4,
  slipBounces: 2,
  slipWallDamage: { count: 1, sides: 4, bonus: 0 },
  /** La Tisseuse et les potions (Thomas, 2026-11-13) : pétrifiée moins longtemps ; la discorde la fait se mordre. */
  bossPetrifyTurns: 2,
  bossDiscordDamage: { count: 1, sides: 8, bonus: 0 },
  /** Double frappe : fois par étage = rang + ce bonus (2, 3, 4 ; équilibrage du 2026-11-13). */
  doubleStrikeBonus: 1,
  /** Potions : poison sur l'arme (coups qui portent), vitesse (tours), feu (tours, dégâts par tour, portée). */
  weaponPoisonHits: 15,
  hasteTurns: 4,
  fireTurns: 5,
  /**
   * Niveau le plus haut par section (Thomas, 2026-11-12 : « une fois le niveau 5 atteint, bloque l'XP… ça évite le farm
   * avant le boss ») : 5 tant que le boss de la section 1 vit, 10 après, etc.
   */
  levelCapPerSection: 5,
  /** Flèche ricochante : distance du rebond, depuis la première cible (C). */
  ricochetRange: 4,
  /** Fumée légère (halo d'un nuage, son dernier tour ; Thomas, 2026-11-15) : chance d'empoisonner par tour (C). */
  thinGasPoisonChance: 0.5,
  /** Un coup critique du héros projette le monstre d'une case (Thomas, 2026-11-12). */
  critKnockback: true,
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
  /** Section 2 : la mousse des pavés propage le feu à une case voisine (chance par tour d'une case en feu), qui brûle
   *  tant de tours ; une case ne prend feu qu'une fois par la mousse (Thomas, 2026-11-14 : « un peu, pas beaucoup » ; C). */
  mossFireChance: 0.12,
  mossFireTurns: 3,
  fastAttackTurns: 0.75,
};
