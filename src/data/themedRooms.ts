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
    id: "dortoir",
    name: "Dortoir",
    loot: [
      { item: "or", min: 8, max: 16, weight: 3 },
      { item: "pomme", min: 1, max: 2, weight: 2 },
      { item: "sac_cuir", min: 1, max: 1, weight: 1, minDepth: 5 }, // pas avant la fin de la section 1 (Thomas)
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
  // Quêtes v3, zones spéciales (2026-11-14) : la tapisserie de l'entrée (dans le mur ; « Low » : mur du bas), tranchée ;
  // paillasse, bougie (allumée, soufflée), dalle à pression (levée, enfoncée).
  tapestry: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  tapestryCut: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  tapestryLow: { blocks: false, w: 1, h: 1, burns: false, wall: true },
  tapestryLowCut: { blocks: false, w: 1, h: 1, burns: false, wall: true },
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
  bonesA: { blocks: false, w: 1, h: 1, burns: false, flat: true },
  // Sac d'œufs écrasé : coquilles et flaque verdâtre (planche art/objets_v4.png).
  eggSmash: { blocks: false, w: 1, h: 1, burns: false, flat: true },
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
export function isFlat(kind: string): boolean {
  return !!FURNITURE_KINDS[kind]?.flat;
}
