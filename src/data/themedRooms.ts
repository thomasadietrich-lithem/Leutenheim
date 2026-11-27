import { ItemId } from "./items";

/**
 * Salles à thème. Les cinq premiers essais (garde-manger, ossuaire, bibliothèque, dortoir, forge, mobilier v1) ont été
 * retirés le 2026-11-11 (Thomas : « l'identité n'est pas assez forte ») ; on les refait une par une. D'abord le
 * DORTOIR des Schrats (planche art/dortoir_v3.png) : lits superposés contre le mur du haut, cheminée, table et chaises,
 * parfois une chaise renversée, un tapis usé posé de travers.
 */
export interface ThemedRoomDef {
  id: string;
  name: string;
  /** Butin de la cache : objet, quantité de min à max, poids. `or` : la quantité grandit avec l'étage. */
  loot: { item: ItemId; min: number; max: number; weight: number; minDepth?: number }[];
}

export const THEMED_ROOMS: ThemedRoomDef[] = [
  // Forge v1 et alchimiste v1 (planches validées le 2026-11-11 : « Ok ») ; butins des caches (C).
  {
    id: "forge",
    name: "Forge",
    loot: [
      { item: "or", min: 8, max: 16, weight: 3 },
      { item: "fleche", min: 3, max: 6, weight: 2 },
      { item: "couteau_boucher", min: 1, max: 1, weight: 1, minDepth: 2 },
    ],
  },
  // La ferme (Thomas, 2026-11-13, planches ferme_v1 / ferme_v2) : butin des caches (C).
  {
    id: "ferme",
    name: "Ferme",
    loot: [
      { item: "or", min: 6, max: 14, weight: 2 },
      { item: "cuisse_poulet", min: 1, max: 2, weight: 3 },
      { item: "pomme", min: 1, max: 3, weight: 2 },
    ],
  },
  {
    id: "alchimiste",
    name: "Alchimiste",
    loot: [
      { item: "or", min: 8, max: 16, weight: 2 },
      { item: "potion_poison", min: 1, max: 1, weight: 2 },
      { item: "potion_feu", min: 1, max: 1, weight: 2 },
      { item: "potion_vitesse", min: 1, max: 1, weight: 1 },
    ],
  },
  // Cuisine v2, salle de prière v1, salle de torture v1 (planches validées le 2026-11-11 : « Ok fonce ») ; butins (C).
  {
    id: "cuisine",
    name: "Cuisine",
    loot: [
      { item: "pomme", min: 2, max: 4, weight: 3 },
      { item: "or", min: 6, max: 12, weight: 2 },
      { item: "potion_vitesse", min: 1, max: 1, weight: 1 },
    ],
  },
  {
    id: "priere",
    name: "Salle de prière",
    loot: [
      { item: "or", min: 10, max: 18, weight: 3 },
      { item: "amethyste", min: 1, max: 1, weight: 2 },
      { item: "potion_jouvence", min: 1, max: 1, weight: 1, minDepth: 3 },
    ],
  },
  {
    id: "torture",
    name: "Salle de torture",
    loot: [
      { item: "or", min: 8, max: 16, weight: 3 },
      { item: "potion_poison", min: 1, max: 1, weight: 2 },
      { item: "fleche_poison", min: 2, max: 4, weight: 1 },
    ],
  },
  {
    id: "prison",
    name: "Prison",
    loot: [
      { item: "or", min: 6, max: 14, weight: 3 },
      { item: "torche", min: 1, max: 1, weight: 2 },
      { item: "pomme", min: 1, max: 2, weight: 1 },
    ],
  },
  {
    id: "dortoir",
    name: "Dortoir",
    loot: [
      { item: "or", min: 8, max: 16, weight: 3 },
      { item: "pomme", min: 1, max: 2, weight: 2 },
      { item: "sac_cuir", min: 1, max: 1, weight: 1, minDepth: 5 }, // pas avant la fin de la section 1 (Thomas)
    ],
  },
  // Section 2 (Thomas, 2026-11-14 ; planche art/champi_salles_v1.png) : la champignonnière de morilles (avec la quête de
  // Morillon) et l'atelier de sculpture. Butins des caches (C).
  {
    id: "morilles",
    name: "Champignonnière de morilles",
    loot: [
      { item: "or", min: 10, max: 18, weight: 2 },
      { item: "pomme", min: 1, max: 3, weight: 2 },
      { item: "cuisse_poulet", min: 1, max: 1, weight: 1 },
    ],
  },
  {
    id: "expo",
    name: "Hall d'exposition",
    loot: [
      { item: "or", min: 14, max: 24, weight: 3 },
      { item: "amethyste", min: 1, max: 1, weight: 1 },
    ],
  },
  {
    id: "concert",
    name: "Salle de concert",
    loot: [
      { item: "or", min: 12, max: 22, weight: 3 },
      { item: "pomme", min: 1, max: 2, weight: 1 },
    ],
  },
  {
    id: "sculpture",
    name: "Atelier de sculpture",
    loot: [
      { item: "or", min: 12, max: 22, weight: 3 },
      { item: "fleche", min: 3, max: 6, weight: 1 },
    ],
  },
];

/**
 * Meubles : ceux qui bloquent leur(s) case(s), leur taille en cases, s'ils brûlent. Les chaises debout, le tapis et les
 * cendres ne bloquent pas. Un meuble qui brûle met le feu à ses voisins (à une case) et laisse un tas de cendres.
 */
export const FURNITURE_KINDS: Record<string, { blocks: boolean; w: number; h: number; burns: boolean; flat?: boolean; wall?: boolean }> = {
  bunkA: { blocks: true, w: 2, h: 1, burns: true },
  bunkB: { blocks: true, w: 2, h: 1, burns: true },
  table: { blocks: true, w: 2, h: 1, burns: true },
  tableApple: { blocks: true, w: 2, h: 1, burns: true },
  chairR: { blocks: false, w: 1, h: 1, burns: true },
  chairL: { blocks: false, w: 1, h: 1, burns: true },
  chairFallen: { blocks: true, w: 1, h: 1, burns: true },
  rug: { blocks: false, w: 3, h: 2, burns: true, flat: true },
  rugB: { blocks: false, w: 3, h: 2, burns: true, flat: true },
  ashes1: { blocks: false, w: 1, h: 1, burns: false },
  ashes2: { blocks: false, w: 2, h: 1, burns: false },
  // Trainards (planche art/trainards_v3.png, validée) : tonneau, caisse, deux caisses empilées. On se cache derrière.
  barrel: { blocks: true, w: 1, h: 1, burns: true },
  // Feu de camp des Kobolds (Thomas, 2026-11-26 : « les monstres vivent ») : ils dorment autour, en section 1.
  feuCamp: { blocks: true, w: 1, h: 1, burns: false },
  // Nuit du 27-28/11 (art/nuit_v1.png) : cimetière intérieur, salle d'embaumement, bal macabre (section 3), cuisine aux
  // spores (section 2).
  tombeCroix: { blocks: true, w: 1, h: 1, burns: false },
  tombeDalle: { blocks: true, w: 1, h: 1, burns: false },
  tombeFraiche: { blocks: true, w: 1, h: 1, burns: false },
  tombeCreusee: { blocks: true, w: 1, h: 1, burns: false },
  pelleFichee: { blocks: true, w: 1, h: 1, burns: true },
  brouetteOs: { blocks: true, w: 2, h: 1, burns: true },
  tableEmbaume: { blocks: true, w: 2, h: 1, burns: false },
  etagereBocaux: { blocks: true, w: 2, h: 1, burns: true },
  sarcoDebout: { blocks: true, w: 1, h: 1, burns: false },
  sarcoDeboutOuvert: { blocks: true, w: 1, h: 1, burns: false },
  sechoirBandelettes: { blocks: true, w: 1, h: 1, burns: true },
  orgueBal: { blocks: true, w: 2, h: 1, burns: true },
  marmiteSpores: { blocks: true, w: 1, h: 1, burns: false },
  etagereChampi: { blocks: true, w: 2, h: 1, burns: true },
  tableChampi: { blocks: true, w: 2, h: 1, burns: true },
  crate: { blocks: true, w: 1, h: 1, burns: true },
  crateStack: { blocks: true, w: 1, h: 1, burns: true },
  // Cloche d'alarme sur son support de bois (Thomas, 2026-11-12) : la sonner fait monter l'alerte, et on se moque de vous.
  bell: { blocks: true, w: 1, h: 1, burns: true },
  // Salle de bain du Kobold (Thomas, 2026-11-13 ; planche art/salle_bain_v1.png).
  tub: { blocks: true, w: 2, h: 1, burns: false },
  lowTable: { blocks: true, w: 1, h: 1, burns: true },
  gramophone: { blocks: true, w: 1, h: 1, burns: true },
  towelRack: { blocks: true, w: 1, h: 1, burns: true },
  bathMat: { blocks: false, w: 1, h: 1, burns: true },
  /** Statue de pierre (Thomas, 2026-11-12) : bloque, on se cache derrière ; une creuse cache un trésor (voir Gluck). */
  statue: { blocks: true, w: 1, h: 1, burns: false },
  statueBroken: { blocks: false, w: 1, h: 1, burns: false },
  // Toiles d'araignée (dès l'étage 3), dans un coin de salle sans torche : TL = coin en haut à gauche, etc. Elles collent.
  webTL: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  webTR: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  webBL: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  webBR: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  // CUISINE v2 : étagère de 2 cases et jambon au crochet (contre le mur du fond), plan de travail, barrique sur chevalet,
  // sac de céréales ; rigole et évacuation peintes dans le carrelage.
  shelf2: { blocks: true, w: 2, h: 1, burns: true },
  ham: { blocks: true, w: 1, h: 1, burns: false },
  counter: { blocks: true, w: 2, h: 1, burns: true },
  barrique: { blocks: true, w: 2, h: 1, burns: true },
  grainSack: { blocks: true, w: 1, h: 1, burns: true },
  // Panier à fruits (Thomas, 2026-11-11) : ne bloque pas ; ses 2 à 3 pommes se ramassent (le dessin suit leur nombre).
  basket: { blocks: false, w: 1, h: 1, burns: true },
  // FERME (planches ferme_v1 / ferme_v2) : le pré de terre battue (il bloque : on n'y entre pas, mais on voit par-dessus),
  // la clôture pleine, la houe et la fourche contre le mur, la botte de paille, l'épouvantail.
  soil: { blocks: true, w: 1, h: 1, burns: false, flat: true },
  soil2: { blocks: true, w: 1, h: 1, burns: false, flat: true },
  fenceH: { blocks: true, w: 1, h: 1, burns: true },
  fenceV: { blocks: true, w: 1, h: 1, burns: true },
  fencePost: { blocks: true, w: 1, h: 1, burns: true },
  fenceCornerL: { blocks: true, w: 1, h: 1, burns: true },
  fenceCornerR: { blocks: true, w: 1, h: 1, burns: true },
  hoe: { blocks: true, w: 1, h: 1, burns: true },
  fork: { blocks: true, w: 1, h: 1, burns: true },
  hayBale: { blocks: true, w: 1, h: 1, burns: true },
  scarecrow: { blocks: true, w: 1, h: 1, burns: true },
  // Statues de décor (planches ferme_v1 / ferme_v2).
  statueApple: { blocks: true, w: 1, h: 1, burns: false },
  statueKnight: { blocks: true, w: 1, h: 1, burns: false },
  statueHen: { blocks: true, w: 1, h: 1, burns: false },
  statueNun: { blocks: true, w: 1, h: 1, burns: false },
  // Assiette avec une cuisse de poulet (cuisine, Thomas 2026-11-13).
  plate: { blocks: false, w: 1, h: 1, burns: false },
  gutterH: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  drain: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  // SALLE DE PRIÈRE v1 : bancs (2 cases), autel (3 cases, le pupitre au milieu), candélabres (0 à 3 bougies), tapis de
  // velours sur l'allée (3 morceaux), vitraux dans le mur du fond (sur la case de mur).
  pew: { blocks: true, w: 2, h: 1, burns: true },
  pewBroken: { blocks: true, w: 2, h: 1, burns: true },
  altar: { blocks: true, w: 3, h: 1, burns: false },
  candelBare: { blocks: true, w: 1, h: 1, burns: false },
  candelA: { blocks: true, w: 1, h: 1, burns: false },
  candelB: { blocks: true, w: 1, h: 1, burns: false },
  candelC: { blocks: true, w: 1, h: 1, burns: false },
  runnerA: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  runnerB: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  runnerC: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  vitrail0: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  // Les salles spéciales (Thomas, 2026-11-26 ; planche art/salles_speciales_v1.png).
  puitsVoeux: { blocks: true, w: 1, h: 1, burns: false },
  autelPoulet: { blocks: true, w: 1, h: 1, burns: false },
  autelPouletVide: { blocks: true, w: 1, h: 1, burns: false },
  miroir: { blocks: true, w: 1, h: 1, burns: false },
  miroirBrise: { blocks: true, w: 1, h: 1, burns: false },
  champiFestin: { blocks: true, w: 1, h: 1, burns: false },
  champiFestinMange: { blocks: true, w: 1, h: 1, burns: false },
  tableCarte: { blocks: true, w: 1, h: 1, burns: true },
  tableCarteLue: { blocks: true, w: 1, h: 1, burns: true },
  ciergeCrypte: { blocks: true, w: 1, h: 1, burns: false },
  ciergeCrypteAllume: { blocks: true, w: 1, h: 1, burns: false },
  // Le trou aux poulets (Thomas, 2026-11-24) : on n'y marche pas ; dessiné par le moteur de rendu (un trou de terre).
  trouPoulets: { blocks: true, w: 1, h: 1, burns: false, flat: true },
  // La tombe du héros précédent (Thomas, 2026-11-24) : avec son objet, puis vide.
  tombeHeros: { blocks: true, w: 1, h: 1, burns: false },
  tombeHerosVide: { blocks: true, w: 1, h: 1, burns: false },
  // Affiches parchemin du culte du poulet (Thomas, 2026-11-24) : sur le mur du haut d'une salle ; on les lit au toucher.
  afficheAvis: { blocks: false, w: 1, h: 1, burns: true, wall: true },
  afficheTexte: { blocks: false, w: 1, h: 1, burns: true, wall: true },
  afficheDechiree: { blocks: false, w: 1, h: 1, burns: true, wall: true },
  // Quêtes v3, zones spéciales (2026-11-14) : la tapisserie de l'entrée (dans le mur ; « Low » : mur du bas), tranchée ;
  // paillasse, bougie (allumée, soufflée), dalle à pression (levée, enfoncée).
  tapestry: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  tapestryCut: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  tapestryLow: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  tapestryLowCut: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  // Pièces secrètes et prison v1 (Thomas, 2026-11-14 ; art/secret_prison_v1.png).
  wallGapA: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  wallGapB: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  wallHoleA: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  // Section 2, la champignonnière (Thomas, 2026-11-14 ; planches art/champi_v3 à v5) : champignons (une dalle chacun ;
  // grappe et géant bloquent, on se cache derrière), groupes de petits lumineux, éboulis de terre (infranchissable,
  // dessiné avec le sol), terre meuble (on y marche), rideau de mycélium (le mur qui cache une salle secrète).
  champiGrappe: { blocks: true, w: 1, h: 1, burns: true },
  champiGeant: { blocks: true, w: 1, h: 1, burns: true },
  champiCorail: { blocks: false, w: 1, h: 1, burns: true },
  lueursB1: { blocks: false, w: 1, h: 1, burns: true },
  // Grotte du Carillon (boss de la section 2) : une souche de pierre, l'abri contre son onde.
  souche: { blocks: true, w: 1, h: 1, burns: false },
  lueursB2: { blocks: false, w: 1, h: 1, burns: true },
  lueursB3: { blocks: false, w: 1, h: 1, burns: true },
  lueursG1: { blocks: false, w: 1, h: 1, burns: true },
  lueursG2: { blocks: false, w: 1, h: 1, burns: true },
  lueursG3: { blocks: false, w: 1, h: 1, burns: true },
  lueursP1: { blocks: false, w: 1, h: 1, burns: true },
  lueursP2: { blocks: false, w: 1, h: 1, burns: true },
  lueursP3: { blocks: false, w: 1, h: 1, burns: true },
  eboulis: { blocks: true, w: 1, h: 1, burns: false, flat: true },
  // Champignonnière de morilles (planche art/champi_salles_v1.png) : rangs de terre battue où poussent les morilles
  // (on n'y marche pas, on voit par-dessus), caillebotis (on marche dessus), étagères à pots (2 cases, une par
  // orientation : fond, bas, gauche, droite), sacs d'engrais (1 à 3), arrosoirs, outils, brouette.
  morelRowA: { blocks: true, w: 1, h: 1, burns: false, flat: true },
  morelRowB: { blocks: true, w: 1, h: 1, burns: false, flat: true },
  morelRowC: { blocks: true, w: 1, h: 1, burns: false, flat: true },
  morelRowEmpty: { blocks: true, w: 1, h: 1, burns: false, flat: true },
  // Arrosés (quête de Morillon) : la terre a foncé.
  morelRowAWet: { blocks: true, w: 1, h: 1, burns: false, flat: true },
  morelRowBWet: { blocks: true, w: 1, h: 1, burns: false, flat: true },
  morelRowCWet: { blocks: true, w: 1, h: 1, burns: false, flat: true },
  caill0: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  caill1: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  caill2: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  potShelf: { blocks: true, w: 2, h: 1, burns: true },
  potShelfBack: { blocks: true, w: 2, h: 1, burns: true },
  potShelfL: { blocks: true, w: 1, h: 2, burns: true },
  potShelfR: { blocks: true, w: 1, h: 2, burns: true },
  engrais1: { blocks: true, w: 1, h: 1, burns: true },
  engrais2: { blocks: true, w: 1, h: 1, burns: true },
  engrais3: { blocks: true, w: 1, h: 1, burns: true },
  arrosoir: { blocks: false, w: 1, h: 1, burns: false },
  arrosoirTombe: { blocks: false, w: 1, h: 1, burns: false },
  outils: { blocks: true, w: 1, h: 1, burns: true },
  brouette: { blocks: true, w: 2, h: 1, burns: true },
  // Atelier de sculpture : l'immense champignon de pierre dans ses échafaudages (3 × 3), la grue, les gravats (1 à 3),
  // les étagères de matériel (mêmes orientations que les étagères à pots), les pioches rouillées, le plan sur son tréteau.
  champiPierre: { blocks: true, w: 3, h: 3, burns: false },
  // HALL D'EXPOSITION (section 2, planche art/expo_v1.png validée le 2026-11-18) : sculptures sur socle (poulets,
  // pommes), le socle vide du Grand Poulet d'Or (on y monte pour la quête), tabourets, chandeliers, tableaux au mur, pommes
  // dorées sous cloche et leur écriteau, tapis bleu.
  // Trainards, suite (2026-11-18) : le squelette à butin (couché, 2 cases, on marche dessus), la botte de paille, la grille
  // ronde au sol (plate, décor).
  skeleton: { blocks: false, w: 2, h: 1, burns: false },
  // Section 2 : vesses-de-loup (sommeil, querelle) ; on marche dessus ou on tire dessus : elles crèvent.
  vesseSommeil: { blocks: false, w: 1, h: 1, burns: true },
  vesseQuerelle: { blocks: false, w: 1, h: 1, burns: true },
  hayBaleT: { blocks: true, w: 1, h: 1, burns: true },
  floorGrate: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  expoPoulet0: { blocks: true, w: 1, h: 1, burns: false },
  expoPoulet1: { blocks: true, w: 1, h: 1, burns: false },
  expoPoulet2: { blocks: true, w: 1, h: 1, burns: false },
  expoPomme0: { blocks: true, w: 1, h: 1, burns: false },
  expoPomme1: { blocks: true, w: 1, h: 1, burns: false },
  expoSocle: { blocks: false, w: 1, h: 1, burns: false },
  tabouret: { blocks: false, w: 1, h: 1, burns: true },
  chandelierExpo: { blocks: true, w: 1, h: 1, burns: false },
  tableauPoulet: { blocks: false, w: 2, h: 1, burns: true, wall: true },
  tableauPomme: { blocks: false, w: 2, h: 1, burns: true, wall: true },
  pommeCloche: { blocks: true, w: 1, h: 1, burns: false },
  clocheVide: { blocks: true, w: 1, h: 1, burns: false },
  ecriteauExpo: { blocks: true, w: 1, h: 1, burns: true },
  rugBleu: { blocks: false, w: 3, h: 2, burns: true, flat: true },
  // SALLE DE CONCERT (section 2, planche art/concert_v1.png) : l'estrade et ses rideaux rouges (4 × 2), le pupitre du chef,
  // le piano droit, la harpe, le tambour, les chaises du public (vues de dos, tournées vers la scène).
  estrade: { blocks: true, w: 4, h: 2, burns: true },
  pupitreChef: { blocks: true, w: 1, h: 1, burns: true },
  piano: { blocks: true, w: 2, h: 1, burns: true },
  harpe: { blocks: true, w: 1, h: 1, burns: true },
  tambour: { blocks: true, w: 1, h: 1, burns: true },
  chaiseDos: { blocks: false, w: 1, h: 1, burns: true },
  grue: { blocks: true, w: 2, h: 1, burns: true },
  gravats1: { blocks: true, w: 1, h: 1, burns: false },
  gravats2: { blocks: true, w: 1, h: 1, burns: false },
  gravats3: { blocks: true, w: 1, h: 1, burns: false },
  toolShelfS: { blocks: true, w: 2, h: 1, burns: true },
  toolShelfSBack: { blocks: true, w: 2, h: 1, burns: true },
  toolShelfSL: { blocks: true, w: 1, h: 2, burns: true },
  toolShelfSR: { blocks: true, w: 1, h: 2, burns: true },
  pioches: { blocks: true, w: 1, h: 1, burns: false },
  piocheSol: { blocks: false, w: 1, h: 1, burns: false },
  planChampi: { blocks: true, w: 2, h: 1, burns: true },
  // Alambic des pièces secrètes (Thomas, 2026-11-15 ; planche art/alambic_v1.png) : on le touche, une fiole de sa potion
  // se remplit et tombe à côté ; il reste vide.
  alambic: { blocks: true, w: 1, h: 1, burns: false },
  // La chambre de neige (Thomas, 2026-11-16) : le bonhomme de neige (bloque) et les congères (décor au sol).
  bonhomme: { blocks: true, w: 1, h: 1, burns: false },
  // Tapisserie du culte (Thomas, 2026-11-16 ; une case et un poulet depuis le 2026-11-24) : au mur du fond de la salle de prière, et pliée
  // au pied du coffre d'une salle au trésor.
  tapisserieCulte: { blocks: false, w: 1, h: 1, burns: true, wall: true },
  drapPlie: { blocks: false, w: 1, h: 1, burns: true },
  congereA: { blocks: false, w: 1, h: 1, burns: false },
  congereB: { blocks: false, w: 1, h: 1, burns: false },
  igloo: { blocks: true, w: 1, h: 1, burns: false },
  tasNeige: { blocks: false, w: 1, h: 1, burns: false },
  bonhommeFondu: { blocks: false, w: 1, h: 1, burns: false },
  terre: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  mycCurtain: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  wallHoleB: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  wallRing: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  wallChains: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  display: { blocks: true, w: 1, h: 1, burns: false },
  grille: { blocks: true, w: 1, h: 1, burns: false },
  grilleOpen: { blocks: false, w: 1, h: 1, burns: false },
  bucket: { blocks: false, w: 1, h: 1, burns: true },
  bucketTipped: { blocks: false, w: 1, h: 1, burns: true },
  desk: { blocks: true, w: 2, h: 1, burns: true },
  plumesA: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  plumesB: { blocks: false, w: 1, h: 1, burns: true, flat: true },
  tapestrySideL: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  tapestrySideLCut: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  tapestrySideR: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  tapestrySideRCut: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  curtainLow: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  curtainLowOpen: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  curtainSideL: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  curtainSideLOpen: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  curtainSideR: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  curtainSideROpen: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  pallet: { blocks: false, w: 1, h: 1, burns: true },
  // Quêtes v3 : tonneau creux et botte de foin qui bouchent une entrée (dans le mur) ; cierges ; grilles ; épouvantail coiffé.
  barrelWall: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  curtain: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  curtainOpen: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  hayWall: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  cierge: { blocks: true, w: 1, h: 1, burns: false },
  // OSSUAIRE (section 3 ; planches art/ossuaire_objets_v1.png et v2, validées le 2026-11-19). Les alcôves et les
  // plaques sont peintes dans le mur, les pierres tombales et la brume dans le sol, les puits de lune sont de la lumière.
  ossAlcove: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  ossTablet: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  ossTomb: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  moonWell: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  sarcophage: { blocks: true, w: 2, h: 1, burns: false },
  sarcophageOuvert: { blocks: true, w: 2, h: 1, burns: false },
  gisant: { blocks: true, w: 2, h: 1, burns: false },
  autelOss: { blocks: true, w: 3, h: 1, burns: false },
  urneS: { blocks: true, w: 1, h: 1, burns: false },
  urneM: { blocks: true, w: 1, h: 1, burns: false },
  urneL: { blocks: true, w: 1, h: 1, burns: false },
  urneBrisee: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  skelCouche: { blocks: false, w: 2, h: 1, burns: false, flat: true },
  skelRampant: { blocks: false, w: 2, h: 1, burns: false, flat: true },
  skelMorceaux: { blocks: false, w: 2, h: 1, burns: false, flat: true },
  skelAssis: { blocks: false, w: 1, h: 1, burns: false },
  socleCrane: { blocks: true, w: 1, h: 1, burns: false },
  socleCraneFendu: { blocks: true, w: 1, h: 1, burns: false },
  socleCraneBougie: { blocks: true, w: 1, h: 1, burns: false },
  lustreOs: { blocks: false, w: 2, h: 1, burns: false },
  pilierCranes: { blocks: true, w: 1, h: 1, burns: false },
  cercueils: { blocks: true, w: 1, h: 1, burns: true },
  statueVoilee: { blocks: true, w: 1, h: 1, burns: false },
  fosseGrille: { blocks: false, w: 2, h: 2, burns: false, flat: true },
  brouetteOss: { blocks: true, w: 2, h: 1, burns: true },
  // La chapelle des os (planche art/ossuaire_chapelle_v1.png, validée le 2026-11-19).
  bancOs: { blocks: true, w: 2, h: 1, burns: false },
  bancOsCasse: { blocks: true, w: 2, h: 1, burns: false },
  autelChapelle: { blocks: true, w: 3, h: 1, burns: false },
  chandelierArgent: { blocks: true, w: 1, h: 1, burns: false },
  benitier: { blocks: true, w: 1, h: 1, burns: false },
  ciergeLit: { blocks: true, w: 1, h: 1, burns: false },
  grate: { blocks: false, w: 1, h: 1, burns: false },
  grateGlint: { blocks: false, w: 1, h: 1, burns: false },
  scarecrowHat: { blocks: true, w: 1, h: 1, burns: true },
  // Salle d'essai (Thomas, 2026-11-14) : le héros proposé n° 2 (planche héros v9), debout à côté du héros actuel.
  heroV9: { blocks: true, w: 1, h: 1, burns: false },
  candle: { blocks: true, w: 1, h: 1, burns: false },
  candleOut: { blocks: true, w: 1, h: 1, burns: false },
  pressurePlate: { blocks: false, w: 1, h: 1, burns: false },
  pressurePlateDown: { blocks: false, w: 1, h: 1, burns: false },
  vitrail1: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  // SALLE DE TORTURE v1 : table à chaînes (2 cases), râtelier, planche au mur, corde à crochet (mur du fond),
  // sarcophage à pointes (fermé, puis ouvert) ; rigole de sang et grille. Les cordes pendent en grappe, immobiles (3 dessins).
  rackTable: { blocks: true, w: 2, h: 1, burns: true },
  toolRack: { blocks: true, w: 1, h: 1, burns: true },
  wallBoard: { blocks: true, w: 1, h: 1, burns: true },
  ropeA: { blocks: true, w: 1, h: 1, burns: true },
  ropeB: { blocks: true, w: 1, h: 1, burns: true },
  ropeC: { blocks: true, w: 1, h: 1, burns: true },
  maiden: { blocks: true, w: 1, h: 1, burns: false },
  maidenOpen: { blocks: true, w: 1, h: 1, burns: false },
  bloodGutterV: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  bloodDrain: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  // FORGE v1 : enclume, armure rouillée sur support (2 dessins), charbon (3 tailles), forge et soufflet (2 cases, braises
  // animées), épée rouillée au sol, râtelier d'armes, étagère murale à outils, établi (2 cases), meule à aiguiser.
  anvil: { blocks: true, w: 1, h: 1, burns: false },
  armorStand: { blocks: true, w: 1, h: 1, burns: true },
  armorStandB: { blocks: true, w: 1, h: 1, burns: true },
  coalS: { blocks: false, w: 1, h: 1, burns: true },
  coalM: { blocks: true, w: 1, h: 1, burns: true },
  coalL: { blocks: true, w: 1, h: 1, burns: true },
  forge: { blocks: true, w: 2, h: 1, burns: false },
  rustySword: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  weaponRack: { blocks: true, w: 1, h: 1, burns: true },
  toolShelf: { blocks: true, w: 1, h: 1, burns: true },
  workbench: { blocks: true, w: 2, h: 1, burns: true },
  grindstone: { blocks: true, w: 1, h: 1, burns: true },
  // ALCHIMISTE v1 : chaudron sur le feu (animé), étagère de verrerie, ours empaillé, herbes qui sèchent (mur du fond),
  // plante en pot, bibliothèque de face (2 cases, mur du fond) ou de profil (2 cases de haut, mur de gauche / de droite),
  // grimoire sur pied (lueur animée).
  cauldron: { blocks: true, w: 1, h: 1, burns: false },
  glassShelf: { blocks: true, w: 1, h: 1, burns: true },
  stuffedBear: { blocks: true, w: 1, h: 1, burns: true },
  herbs: { blocks: true, w: 1, h: 1, burns: true },
  pottedPlant: { blocks: true, w: 1, h: 1, burns: true },
  bookcase: { blocks: true, w: 2, h: 1, burns: true },
  bookcaseL: { blocks: true, w: 1, h: 2, burns: true },
  bookcaseR: { blocks: true, w: 1, h: 2, burns: true },
  grimoire: { blocks: true, w: 1, h: 1, burns: true },
  // ÉTAGE DU BOSS (la Tisseuse, planche art/boss_v2.png) : nappes de toile (6 dessins, elles ralentissent et brûlent de
  // proche en proche), grande toile centrale (9 cases), cocons (sa nourriture) et sacs d'œufs (ils éclosent), à crever d'un
  // coup ; amarres nouées aux colonnes, à couper ; escalier scellé par la toile ; restes d'aventurier (2 cases, plats).
  ...Object.fromEntries([0, 1, 2, 3, 4, 5].map((i) => [`webN${i}`, { blocks: false, w: 1, h: 1, burns: true, flat: true }])),
  ...Object.fromEntries([0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => [`webHub${i}`, { blocks: false, w: 1, h: 1, burns: true, flat: true }])),
  cocoonA: { blocks: true, w: 1, h: 1, burns: true },
  cocoonB: { blocks: true, w: 1, h: 1, burns: true },
  eggSac: { blocks: true, w: 1, h: 1, burns: true },
  anchor: { blocks: false, w: 1, h: 1, burns: false },
  sealedStairs: { blocks: true, w: 1, h: 1, burns: false },
  // Boss de la section 3 (planche art/ossuaire_boss_v1.png) : le socle vide, les cierges violets (allumés, éteints).
  socle: { blocks: true, w: 3, h: 1, burns: false },
  // Le musée de l'ossuaire (planche art/ossuaire_musee_v1.png).
  expoTrike: { blocks: true, w: 7, h: 2, burns: false },
  chandelierMusee: { blocks: true, w: 1, h: 1, burns: false },
  ecriteauMusee: { blocks: true, w: 1, h: 1, burns: false },
  ciergeViolet: { blocks: true, w: 1, h: 1, burns: false },
  ciergeVioletOff: { blocks: true, w: 1, h: 1, burns: false },
  bonesA: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  // Sac d'œufs écrasé : coquilles et flaque verdâtre (planche art/objets_v4.png).
  eggSmash: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  // Salles à énigme (planche art/salles_enigme_v1.png, Thomas 2026-11-21).
  cible: { blocks: true, w: 1, h: 1, burns: true },
  cibleBleue: { blocks: true, w: 1, h: 1, burns: true },
  cibleBleueTombee: { blocks: false, w: 1, h: 1, burns: true },
  cibleNoireD: { blocks: true, w: 1, h: 1, burns: false },
  cibleNoireG: { blocks: true, w: 1, h: 1, burns: false },
  cibleNoireH: { blocks: true, w: 1, h: 1, burns: false },
  cibleNoireB: { blocks: true, w: 1, h: 1, burns: false },
  barriere: { blocks: true, w: 1, h: 1, burns: true },
  racines: { blocks: true, w: 1, h: 1, burns: true },
  herse: { blocks: true, w: 1, h: 1, burns: false },
  herseUp: { blocks: false, w: 1, h: 1, burns: false },
  dalleGeant: { blocks: false, w: 2, h: 2, burns: false, flat: true },
  gardien: { blocks: true, w: 1, h: 1, burns: false },
  // Eau profonde : on ne la traverse pas ; la potion de gel la rend praticable (dessinée par le renderer).
  eauProfonde: { blocks: true, w: 1, h: 1, burns: false, flat: true },
  piste: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  ligneTir: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  bonesB: { blocks: false, w: 1, h: 1, burns: false, flat: true },
};

/** Rigoles v2 (art/rigoles_v2.png ; Thomas : « moins régulières, jusqu'aux évacuations ») : morceaux plats qui se raccordent
 * par le milieu des bords. `gut_` eau (cuisine), `bgut_` sang (torture) ; suffixe = côtés reliés (N, E, S, W), « a »/« b »
 * pour les deux variantes des droits ; `gutDrain_X` / `bgutDrain_X` : la grille, la rigole y entrant par le côté X. */
export const GUTTER_STRAIGHT: Record<string, string[]> = { NS: ["NSa", "NSb"], EW: ["EWa", "EWb"] };
for (const pre of ["gut", "bgut"]) {
  for (const m of ["NSa", "NSb", "EWa", "EWb", "NE", "NW", "SE", "SW", "N", "E", "S", "W"]) FURNITURE_KINDS[`${pre}_${m}`] = { blocks: false, w: 1, h: 1, burns: false, flat: true };
  for (const d of "NESW") FURNITURE_KINDS[`${pre}Drain_${d}`] = { blocks: false, w: 1, h: 1, burns: false, flat: true };
}

/** Meuble peint avec le sol (tapis, toile, rigole) : il prend exactement la lumière de sa case. */
/** Les potions qu'un alambic peut distiller (une couleur chacune). */
export const ALEMBIC_POTIONS = ["potion_feu", "potion_poison", "potion_vitesse", "potion_jouvence", "potion_brouillard", "potion_oursin", "potion_pierre", "potion_discorde", "potion_geant", "potion_glissante"] as const;

export function isFlat(kind: string): boolean {
  return !!FURNITURE_KINDS[kind]?.flat;
}
