import { Dice } from "../core/dice";

/** Ce que le héros peut porter sur lui, à part du sac. */
export type Slot = "amulet" | "hat" | "artifact" | "armor" | "melee" | "ranged" | "bag";
export const SLOTS: { slot: Slot; label: string }[] = [
  { slot: "amulet", label: "Amulette" },
  { slot: "hat", label: "Heaume" },
  { slot: "artifact", label: "Artefact" },
  { slot: "armor", label: "Armure" },
  { slot: "melee", label: "Corps à corps" },
  { slot: "ranged", label: "Distance" },
  { slot: "bag", label: "Sac" },
];

/** Classe d'armure sans armure. */
export const UNARMORED_AC = 10;

/** Une fiche d'objet. Les statistiques d'attaque sont portées par l'arme, pas par le personnage. */
export interface ItemDef {
  id: string;
  name: string;
  /** Les six premiers sont aussi des emplacements d'équipement ; munitions et clefs restent dans le sac. */
  kind: Slot | "ammo" | "key" | "gold" | "use" | "gem" | "quest";
  /** Une phrase de description, affichée sur la fiche de l'objet. */
  description: string;
  /** Place occupée dans le sac, en cases (largeur × hauteur). */
  w: number;
  h: number;
  /** Nombre maximal d'exemplaires dans une même case (1 = ne s'empile pas). */
  maxStack: number;
  /** Armes : bonus au d20 et dés de dégâts. */
  attackBonus?: number;
  damage?: Dice;
  /** Armures : classe d'armure une fois portée (10 sans armure). */
  armorClass?: number;
  /**
   * Armures : dégâts retirés à chaque coup reçu d'un monstre (jamais moins de 1). PROGRESSION (Thomas, 2026-11-27 :
   * « une armure principale par section pour être limite, et une pour être serein » ; « il ne doit jamais être logique de
   * choisir une armure plus légère ») : section 1 cuir (limite) / cloutée (serein) ; section 2 cloutée / cotte de mailles ;
   * section 3 cotte de mailles / harnois (−4, Thomas 2026-11-27 : l'écart y était le plus faible), l'obsidienne au-dessus.
   */
  reduction?: number; // amorti MOYEN : chaque coup, un tirage de reduction − 1 à reduction + 1
  /** Casques : classe d'armure ajoutée à celle de l'armure. */
  acBonus?: number;
  /** Armes à distance : portée en cases et munition consommée. */
  range?: number;
  ammo?: string;
  /** Rareté : dit à quel point l'objet est difficile à trouver (Thomas, 2026-11-11). Sans rareté : objet de départ. */
  rarity?: Rarity | "epic";
  /** Bonus de Charisme quand on le porte (nœud papillon). */
  charisma?: number;
  /** Amulettes (Thomas, 2026-11-15 : « un chiffre, toujours actif ») : PV max, Force, Agilité, jet d'attaque en plus. */
  bonusHp?: number;
  bonusForce?: number;
  bonusAgility?: number;
  bonusHit?: number;
  /** Chapelet d'argent (Sœur Clavicule) : classe d'armure en plus contre les morts (squelettes, gisants, crânes). */
  undeadAc?: number;
  /** Niveau du héros nécessaire pour équiper ou utiliser l'objet (Thomas : « le niveau du héros »). */
  level?: number;
  /** Armes de corps à corps : lente (une attaque prend 1,5 tour) ou rapide (¾ de tour). */
  speed?: "slow" | "fast";
  /** Armes de corps à corps : portée en cases (1 par défaut ; la lance frappe à 2). */
  reach?: number;
  /** Munitions : poison laissé dans la plaie (dégâts par tour, nombre de tours). */
  poison?: { damage: number; turns: number };
  /** Munitions : la flèche ricoche sur un deuxième monstre proche après un coup qui porte. */
  ricochet?: boolean;
  /** Flèche de recul : quand elle touche, la cible recule de tant de cases. */
  knockback?: number;
  /** Flèche enflammée : le feu prend sur la case où elle touche ou tombe. */
  ignites?: boolean;
  /** Objets à utiliser : PV rendus, ou tours de lumière (torche). */
  heal?: number;
  lightTurns?: number;
  /** Gemmes : leur valeur, versée dans la bourse en les ramassant. */
  value?: number;
  /** Sacs : nombre de cases (colonnes × rangées). */
  bagCols?: number;
  bagRows?: number;
  /** Potions : ce qu'elles font (voir `src/core/game.ts`, `resolveUse`). */
  potion?: "youth" | "poison" | "haste" | "fire" | "smoke" | "fog" | "urchin" | "stone" | "discord" | "grow" | "slip" | "frost" | "night";
  /** Bombe arcanique (Thomas, 2026-11-16) : elle se lance, puis explose quelques tours plus tard. */
  bomb?: boolean;
  /** Grenade sainte : elle éclate à l'impact en lumière jaune : bénit le héros, blesse les monstres (les morts deux fois). */
  holy?: boolean;
  /** Potion lancée (feu) : portée en cases ; il faut viser une case. */
  throwRange?: number;
  /** Potion qu'il est risqué de boire (Thomas, 2026-11-14) : on demande « Êtes-vous sûr ? » et l'on dit pourquoi. */
  drinkWarning?: string;
  /** Munitions : famille d'arme qui les tire (« fleche » pour l'arc ; « jet » : se lance à la main, sans arc). */
  ammoFamily?: string;
  /** Le projectile au singulier, pour le journal (« La javeline se brise. »). RÈGLE (Thomas, 2026-11-18) : toute
   *  nouvelle munition ou arme de jet donne ici son nom ; sans lui, le journal dit « La flèche ». */
  single?: string;
  /** Armes lourdes : un d20 naturel à partir de ce nombre SONNE la cible (elle perd son prochain tour). */
  stunOn?: number;
}

export type Rarity = "common" | "uncommon" | "rare";
export const RARITY_LABELS: Record<Rarity, string> = { common: "Commun", uncommon: "Peu commun", rare: "Rare" };

/**
 * La rareté se montre par une PASTILLE de couleur, plus par un mot (Thomas, 2026-11-12) : gris commun, vert peu commun,
 * bleu rare ; violet (épique) et doré (légendaire) sont prêts pour les objets à venir. Clair, foncé (le bord).
 */
export const RARITY_COLORS: Record<Rarity | "epic" | "legendary", [string, string]> = {
  common: ["#a8a8b0", "#5a5a64"],
  uncommon: ["#5cc860", "#2e7a38"],
  rare: ["#4a9ae0", "#22508a"],
  epic: ["#b07ae8", "#5a3290"],
  legendary: ["#f0c050", "#8a6418"],
};

export const ITEMS = {
  epee: {
    id: "epee",
    name: "Épée courte",
    kind: "melee",
    description: "Une lame courte et droite, sans garde ni fioriture. Fiable.",
    w: 1,
    h: 2,
    maxStack: 1,
    attackBonus: 4,
    damage: { count: 1, sides: 6, bonus: 2 },
  },
  // L'équipement du Halfelin (Thomas, 2026-11-16 : « une serpe plutôt qu'une épée courte, un lance-pierre plutôt
  // qu'un arc, et des pierres »).
  serpe: {
    id: "serpe",
    name: "Serpe",
    kind: "melee",
    description: "Une serpe de jardinier, courbe et bien affûtée. Elle a coupé plus de ronces que de Kobolds.",
    w: 1,
    h: 1,
    maxStack: 1,
    attackBonus: 4,
    damage: { count: 1, sides: 6, bonus: 1 },
  },
  lance_pierre: {
    id: "lance_pierre",
    name: "Lance-pierre",
    kind: "ranged",
    description: "Une fourche de noisetier et une lanière de cuir. Il lance des pierres ; les pierres, on en trouve partout.",
    w: 1,
    h: 1,
    maxStack: 1,
    attackBonus: 3,
    range: 7,
    ammo: "pierre",
  },
  pierre: {
    id: "pierre",
    single: "La pierre",
    name: "Pierres",
    kind: "ammo",
    description: "Des galets bien ronds, pour le lance-pierre.",
    w: 1,
    h: 1,
    maxStack: 20,
    rarity: "common",
    ammoFamily: "pierre",
    damage: { count: 1, sides: 4, bonus: 1 },
  },
  dague: {
    id: "dague",
    name: "Dague",
    kind: "melee",
    description: "Courte et vive, faite pour les coups en traître.",
    w: 1,
    h: 1,
    maxStack: 1,
    attackBonus: 5,
    damage: { count: 1, sides: 4, bonus: 2 },
  },
  baton: {
    id: "baton",
    name: "Bâton",
    kind: "melee",
    description: "Un bâton de marche. Mieux que rien.",
    w: 1,
    h: 2,
    maxStack: 1,
    attackBonus: 2,
    damage: { count: 1, sides: 4, bonus: 0 },
  },
  arc_court: {
    id: "arc_court",
    name: "Arc court",
    kind: "ranged",
    description: "Un arc de chasse en bois nu.",
    w: 1,
    h: 2,
    maxStack: 1,
    // Règle de Thomas (2026-11-11) : l'arc donne le jet (d20 + bonus) et la portée ; la FLÈCHE donne les dégâts.
    attackBonus: 3,
    range: 9,
    ammo: "fleche",
  },
  arc_puissant: {
    id: "arc_puissant",
    name: "Arc puissant",
    kind: "ranged",
    description: "Un arc recourbé aux bouts de corne. Il porte loin, et la flèche part droit.",
    w: 1,
    h: 2,
    maxStack: 1,
    rarity: "uncommon",
    level: 5,
    attackBonus: 5,
    range: 11,
    ammo: "fleche",
  },
  // L'arc de la section 2 (Thomas, 2026-11-17) (C).
  arc_corne: {
    id: "arc_corne",
    name: "Arc de corne",
    kind: "ranged",
    description: "Des branches d'ivoire pâle, une poignée de mousse qui luit. Il porte plus loin que tout autre arc, et vise juste.",
    w: 1,
    h: 2,
    maxStack: 1,
    rarity: "rare",
    level: 7,
    attackBonus: 7,
    range: 12,
    ammo: "fleche",
  },
  fleche: {
    id: "fleche",
    single: "La flèche",
    name: "Flèches",
    kind: "ammo",
    description: "Munitions pour l'arc.",
    w: 1,
    h: 1,
    maxStack: 20,
    rarity: "common",
    ammoFamily: "fleche",
    damage: { count: 1, sides: 6, bonus: 0 },
  },
  javeline: {
    id: "javeline",
    single: "La javeline",
    name: "Javelines",
    kind: "ammo",
    description: "Se lance à la main, sans arc. Aussi précise qu'une flèche, et frappe plus fort ; se ramasse.",
    w: 1,
    h: 2,
    maxStack: 8,
    rarity: "uncommon",
    level: 3,
    ammoFamily: "jet",
    // Thomas (2026-11-16) : « même précision que les flèches » : le bonus de l'arc court.
    attackBonus: 3,
    range: 6,
    damage: { count: 1, sides: 8, bonus: 2 },
  },
  fleche_poison: {
    id: "fleche_poison",
    single: "La flèche empoisonnée",
    name: "Flèches empoisonnées",
    kind: "ammo",
    description: "La pointe luit d'un enduit verdâtre. La plaie brûle encore plusieurs tours.",
    w: 1,
    h: 1,
    maxStack: 20,
    rarity: "uncommon",
    level: 4,
    ammoFamily: "fleche",
    damage: { count: 1, sides: 6, bonus: 0 },
    poison: { damage: 1, turns: 4 },
  },
  // Flèche de recul (Thomas, 2026-11-16 : « une flèche bleue qui recule de 3 cases une personne touchée ») : l'Elfe en a
  // cinq au départ. Rareté, niveau et butin : C.
  fleche_recul: {
    id: "fleche_recul",
    single: "La flèche de recul",
    name: "Flèches de recul",
    kind: "ammo",
    description: "Une flèche bleue à la pointe ronde et lourde. Quand elle touche, la cible recule de trois cases.",
    w: 1,
    h: 1,
    maxStack: 20,
    rarity: "uncommon",
    ammoFamily: "fleche",
    damage: { count: 1, sides: 6, bonus: 0 },
    knockback: 3,
  },
  // SECTION 3 (Thomas, 2026-11-19 : « flèches d'obsidienne 1d8, commune et fréquente ; on ne doit plus trop se balader en
  // section 3 avec des flèches de base » ; « et des flèches enflammées »).
  fleche_obsidienne: {
    id: "fleche_obsidienne",
    single: "La flèche d'obsidienne",
    name: "Flèches d'obsidienne",
    kind: "ammo",
    description: "Une pointe de verre noir taillé, plus lourde et plus coupante que l'acier. On en trouve partout dans l'ossuaire.",
    w: 1,
    h: 1,
    maxStack: 20,
    rarity: "common",
    ammoFamily: "fleche",
    damage: { count: 1, sides: 8, bonus: 0 },
  },
  fleche_feu: {
    id: "fleche_feu",
    single: "La flèche enflammée",
    name: "Flèches enflammées",
    kind: "ammo",
    description: "Un chiffon huilé noué sous la pointe, qui s'allume au tir. Là où elle touche (ou tombe), le feu prend.",
    w: 1,
    h: 1,
    maxStack: 20,
    rarity: "uncommon",
    level: 10,
    ammoFamily: "fleche",
    damage: { count: 1, sides: 6, bonus: 0 },
    ignites: true,
  },
  // Flèche ricochante (Thomas, 2026-11-15 : « niveau 6, rare ») : après un coup qui porte, elle repart vers un autre
  // monstre en vue à 4 cases ou moins de la cible (nouveau jet, mêmes dégâts) (C).
  fleche_ricochet: {
    id: "fleche_ricochet",
    single: "La flèche ricochante",
    name: "Flèches ricochantes",
    kind: "ammo",
    description: "Une pointe d'acier bleuté, lourde et coupante des deux côtés. Quand elle touche, elle rebondit sur un autre ennemi proche.",
    w: 1,
    h: 1,
    maxStack: 20,
    rarity: "rare",
    level: 6,
    ammoFamily: "fleche",
    damage: { count: 1, sides: 6, bonus: 0 },
    ricochet: true,
  },
  // Truc fun du poulet (Thomas, 2026-11-13) : ce qu'il reste de lui après le mur du fond.
  // Thomas (2026-11-13) : un Kobold mort dans les flammes laisse une escalope.
  escalope: { id: "escalope", name: "Escalope de Kobold", kind: "use", description: "Bien grillée, un peu écailleuse. Rend 5 PV.", w: 1, h: 1, maxStack: 3, rarity: "common", heal: 5 },
  cuisse_poulet: { id: "cuisse_poulet", name: "Cuisse de poulet", kind: "use", description: "Encore tiède. Rend 8 PV.", w: 1, h: 1, maxStack: 3, rarity: "common", heal: 8 },
  // La piste de pommes de Gluck (Thomas, 2026-11-21) : des pommes pourries, presque rien.
  pomme_pourrie: { id: "pomme_pourrie", name: "Pomme pourrie", kind: "use", description: "Brune, molle, un ver à la fenêtre. Ça se mange… à peine. Rend 1 PV.", w: 1, h: 1, maxStack: 5, rarity: "common", heal: 1 },
  // Section 3 (Thomas, 2026-11-19 : « un nouvel aliment pour 11 PV ») : la tourte du fossoyeur, commune dès l'étage 11.
  tourte_fossoyeur: { id: "tourte_fossoyeur", name: "Tourte du fossoyeur", kind: "use", description: "Une tourte épaisse, marquée d'une croix sur la croûte. Les fossoyeurs en emportent pour les longues nuits. Rend 11 PV.", w: 1, h: 1, maxStack: 3, rarity: "common", heal: 11 },
  // Section 2 : les morilles de Morillon (sa quête). Elles soignent (C).
  carotte_magique: { id: "carotte_magique", name: "Carotte magique", kind: "use", description: "Le nez d'un bonhomme de neige, dans une pièce secrète. Froide, croquante, elle brille un peu. Rend 12 PV.", w: 1, h: 1, maxStack: 1, rarity: "rare", heal: 12 },
  morille: { id: "morille", name: "Morille", kind: "use", description: "Une morille de Morillon, alvéolée et parfumée. Rend 9 PV.", w: 1, h: 1, maxStack: 5, rarity: "common", heal: 9 },
  // L'Elfe part avec deux pains elfiques (Thomas, 2026-11-17 : « du Lembas +3, ×2 » ; nom propre au jeu).
  pain_elfique: { id: "pain_elfique", name: "Pain elfique", kind: "use", description: "Une galette dorée, enveloppée dans une feuille qui ne fane pas. Une bouchée suffit. Rend 3 PV.", w: 1, h: 1, maxStack: 5, rarity: "common", heal: 3 },
  // L'omelette du trou aux poulets (Thomas, 2026-11-24 : « si on fouille le trou, on trouve une omelette »).
  omelette: { id: "omelette", name: "Omelette", kind: "use", description: "Trois œufs, une chute, et beaucoup de chance : elle est encore chaude. Rend 12 PV.", w: 1, h: 1, maxStack: 1, rarity: "uncommon", heal: 12 },
  pomme: { id: "pomme", name: "Pomme", kind: "use", description: "Croquante. Rend 5 PV.", w: 1, h: 1, maxStack: 5, rarity: "common", heal: 5 },
  torche: {
    id: "torche",
    name: "Torche",
    kind: "use",
    description: "Utilisée, elle se range sous l'arc et éclaire autour de vous pendant 300 tours (sa jauge baisse). On peut l'éteindre et la rallumer. Mais on vous voit venir.",
    w: 1,
    h: 1,
    maxStack: 3,
    rarity: "common",
    // Triplée (Thomas, 2026-11-13 : « triple la durée ; utiliser plutôt que consommer ; un emplacement sous l'arc »).
    lightTurns: 300,
  },
  epee_longue: {
    id: "epee_longue",
    name: "Épée longue",
    kind: "melee",
    description: "Lourde et longue. Chaque coup prend du temps, mais il porte, et peut assommer.",
    w: 1,
    h: 3,
    maxStack: 1,
    rarity: "uncommon",
    level: 2,
    speed: "slow",
    attackBonus: 4,
    damage: { count: 2, sides: 8, bonus: 2 },
    stunOn: 18,
  },
  couteau_boucher: {
    id: "couteau_boucher",
    name: "Couteau de boucher",
    kind: "melee",
    description: "Une lame large et lourde du bout, faite pour trancher la viande. Vive en main.",
    w: 1,
    h: 1,
    maxStack: 1,
    rarity: "common",
    level: 2,
    speed: "fast",
    attackBonus: 3,
    damage: { count: 1, sides: 4, bonus: 1 },
  },
  lance: {
    id: "lance",
    name: "Lance",
    kind: "melee",
    description: "Frappe à deux cases : on touche l'ennemi avant qu'il n'arrive au contact.",
    w: 1,
    h: 4,
    maxStack: 1,
    rarity: "uncommon",
    level: 2,
    reach: 2,
    attackBonus: 4,
    damage: { count: 1, sides: 10, bonus: 2 },
  },
  // Masse d'arme (Thomas, 2026-11-13) : une main, lourde ; elle assomme sur les beaux coups.
  // Revue (Thomas, 2026-11-17 : « reconsidère le niveau de la masse et son efficacité ») : elle faisait moins de dégâts
  // que l'épée courte de départ. Niveau 3, +4, 1d8+2 : entre l'épée courte et la lance, et elle assomme (C).
  masse: {
    id: "masse",
    name: "Masse d'arme",
    kind: "melee",
    description: "Une tête de fer à ailettes au bout d'un manche de chêne. Elle cabosse les armures et assomme : sur un 17 ou plus au dé, l'ennemi touché perd son prochain tour.",
    w: 1,
    h: 2,
    maxStack: 1,
    rarity: "uncommon",
    level: 3,
    attackBonus: 4,
    damage: { count: 1, sides: 8, bonus: 2 },
    stunOn: 17,
  },
  // Récompense du Conservateur (musée de l'ossuaire, Thomas 2026-11-19) (C).
  massue_os: {
    id: "massue_os",
    name: "Massue de tricératops",
    kind: "melee",
    description: "Un fémur de tricératops, lourd comme une poutre, que le Conservateur a fait monter en massue. Elle assomme sur un 16 ou plus au dé, et brise le crâne des morts.",
    w: 1,
    h: 2,
    maxStack: 1,
    rarity: "rare",
    level: 10,
    attackBonus: 6,
    damage: { count: 1, sides: 10, bonus: 5 },
    stunOn: 16,
  },
  corne_triceratops: { id: "corne_triceratops", name: "Corne de tricératops", kind: "quest", description: "La corne du nez du tricératops du musée, volée par le culte. Le Conservateur la cherche partout.", w: 1, h: 1, maxStack: 1 },
  // Section 3 : l'obsidienne (Thomas, 2026-11-19 : « implémente armure, hache et casque d'obsidienne ») (C).
  hache_obsidienne: {
    id: "hache_obsidienne",
    name: "Hache d'obsidienne",
    kind: "melee",
    description: "Une lame de verre noir taillée en croissant, ligaturée sur un manche de frêne. Elle tranche net, os compris.",
    w: 1,
    h: 2,
    maxStack: 1,
    rarity: "uncommon",
    level: 11,
    attackBonus: 6,
    damage: { count: 2, sides: 6, bonus: 5 },
  },
  armure_obsidienne: {
    id: "armure_obsidienne",
    name: "Armure d'obsidienne",
    kind: "armor",
    description: "Des plaques de verre noir serties dans du fer, aux reflets violets. Plus dure que l'acier, et pourtant plus légère.",
    w: 2,
    h: 2,
    maxStack: 1,
    rarity: "rare",
    level: 11,
    armorClass: 18,
    reduction: 4,
  },
  casque_obsidienne: {
    id: "casque_obsidienne",
    name: "Casque d'obsidienne",
    kind: "hat",
    description: "Une coiffe d'écailles de verre noir, cousues serré. Elle couvre toute la tête sauf le visage.",
    w: 1,
    h: 1,
    maxStack: 1,
    rarity: "uncommon",
    level: 11,
    acBonus: 3,
  },
  // Section 2 (Thomas, 2026-11-17 : « propose deux armes cohérentes, niveaux 7 et 8 ») (C).
  marteau_guerre: {
    id: "marteau_guerre",
    name: "Marteau de guerre",
    kind: "melee",
    description: "Une tête d'acier carrée au bout d'un manche cerclé. Lent, mais chaque coup sonne, et assomme sur un 17 ou plus au dé.",
    w: 1,
    h: 3,
    maxStack: 1,
    rarity: "uncommon",
    level: 7,
    speed: "slow",
    attackBonus: 5,
    damage: { count: 2, sides: 10, bonus: 4 },
    stunOn: 17,
  },
  epee_batarde: {
    id: "epee_batarde",
    name: "Épée bâtarde",
    kind: "melee",
    description: "Plus large que l'épée longue, et pourtant vive en main. Une lame de maître, forgée pour les profondeurs.",
    w: 1,
    h: 3,
    maxStack: 1,
    rarity: "rare",
    level: 8,
    attackBonus: 6,
    damage: { count: 1, sides: 10, bonus: 5 },
  },
  cimeterre: {
    id: "cimeterre",
    name: "Cimeterre",
    kind: "melee",
    description: "Une lame courbe qui danse. Rapide et cruelle.",
    w: 2,
    h: 2,
    maxStack: 1,
    rarity: "rare",
    level: 5,
    speed: "fast",
    attackBonus: 5,
    damage: { count: 1, sides: 6, bonus: 3 },
  },
  armure_cloutee: {
    id: "armure_cloutee",
    name: "Cuir clouté",
    kind: "armor",
    description: "Du cuir épais renforcé de rivets d'acier. Solide : elle amortit un peu chaque coup.",
    w: 2,
    h: 2,
    maxStack: 1,
    rarity: "uncommon",
    level: 2,
    armorClass: 14,
    reduction: 1,
  },
  // Casques (Thomas, 2026-11-11 ; planche art/objets_v4.png) : ils s'ajoutent à l'armure.
  casque_cuir: {
    id: "casque_cuir",
    name: "Casque de cuir",
    kind: "hat",
    description: "Une calotte de cuir bouilli, cousue, avec deux protège-oreilles. Mieux que rien.",
    w: 1,
    h: 1,
    maxStack: 1,
    rarity: "common",
    level: 1,
    acBonus: 1,
  },
  casque_maille: {
    id: "casque_maille",
    name: "Casque de maille",
    kind: "hat",
    description: "Un camail d'anneaux d'acier qui couvre la tête et la nuque, le visage dégagé.",
    w: 1,
    h: 1,
    maxStack: 1,
    rarity: "uncommon",
    // Thomas, 2026-11-15 : niveau 6 (3 avant).
    level: 6,
    acBonus: 2,
  },
  clef_argent: { id: "clef_argent", name: "Clef d'argent", kind: "key", description: "Ouvre le coffre d'argent de la salle à énigme où on l'a trouvée. Ne sert plus à l'étage suivant.", w: 1, h: 1, maxStack: 3 },
  clef: { id: "clef", name: "Clef", kind: "key", description: "Ouvre une salle fermée de l'étage où on l'a trouvée, sans bruit. Ne sert qu'une fois.", w: 1, h: 1, maxStack: 5 },
  or: { id: "or", name: "Bourse d'or", kind: "gold", description: "Un petit sac de cuir fermé par une cordelette. Son or rejoint votre bourse dès que vous marchez dessus.", w: 1, h: 1, maxStack: 9999 },
  tunique: {
    id: "tunique",
    name: "Tunique",
    kind: "armor",
    description: "Une tunique blanche, serrée par une ceinture de cuir.",
    w: 2,
    h: 2,
    maxStack: 1,
    armorClass: 12,
  },
  harnois: {
    id: "harnois",
    name: "Harnois",
    kind: "armor",
    description: "Des plaques d'acier qui couvrent tout le corps. Presque rien ne passe, et ce qui passe est bien amorti.",
    w: 2,
    h: 2,
    maxStack: 1,
    rarity: "rare",
    // Thomas, 2026-11-15 : niveau 10 (5 avant).
    level: 10,
    armorClass: 17,
    reduction: 4,
  },
  cotte_mailles: {
    id: "cotte_mailles",
    name: "Cotte de mailles",
    kind: "armor",
    description: "Des anneaux de fer rivetés. Lourde et sûre : les coups qui passent perdent de leur mordant.",
    w: 2,
    h: 2,
    maxStack: 1,
    rarity: "uncommon",
    // Thomas, 2026-11-15 : niveau 6 (3 avant).
    level: 6,
    armorClass: 16,
    reduction: 2,
  },
  armure_cuir: {
    id: "armure_cuir",
    name: "Armure de cuir",
    kind: "armor",
    description: "Du cuir bouilli, souple et silencieux.",
    w: 2,
    h: 2,
    maxStack: 1,
    rarity: "common",
    armorClass: 13,
  },
  // ---- Gemmes (Thomas, 2026-11-11) : ramassées, elles vont dans la bourse pour leur valeur. ----
  amethyste: { id: "amethyste", name: "Améthyste", kind: "gem", description: "Une pierre violette, taillée en brillant.", w: 1, h: 1, maxStack: 99, rarity: "uncommon", value: 20 },
  saphir: { id: "saphir", name: "Saphir", kind: "gem", description: "Un bleu profond qui accroche la moindre lueur.", w: 1, h: 1, maxStack: 99, rarity: "rare", value: 50 },
  emeraude: { id: "emeraude", name: "Émeraude", kind: "gem", description: "Taillée à degrés, d'un vert très pur.", w: 1, h: 1, maxStack: 99, rarity: "rare", value: 100 },
  diamant: { id: "diamant", name: "Diamant", kind: "gem", description: "Il brille même dans le noir. Ou presque.", w: 1, h: 1, maxStack: 99, rarity: "rare", value: 200 },
  // ---- Sacs (emplacement « sac ») : la toile au départ, puis plus grand. ----
  sac_toile: { id: "sac_toile", name: "Sac en toile", kind: "bag", description: "Un sac de toile grossière. 6 × 4 cases.", w: 2, h: 2, maxStack: 1, level: 1, bagCols: 6, bagRows: 4 },
  sac_cuir: { id: "sac_cuir", name: "Sac de cuir", kind: "bag", description: "Un sac à rabat, solide. 7 × 5 cases.", w: 2, h: 2, maxStack: 1, rarity: "uncommon", level: 3, bagCols: 7, bagRows: 5 },
  sac_voyage: { id: "sac_voyage", name: "Sac d'aventurier", kind: "bag", description: "Un grand sac à dos, couverture roulée dessus. 8 × 5 cases.", w: 2, h: 2, maxStack: 1, rarity: "rare", level: 6, bagCols: 8, bagRows: 5 },
  // ---- Potions ----
  potion_jouvence: { id: "potion_jouvence", name: "Potion de jouvence", kind: "use", description: "Jaune et pétillante. Rend tous vos points à répartir, plus un. La voie choisie, elle, ne change pas.", w: 1, h: 1, maxStack: 3, rarity: "rare", potion: "youth" },
  potion_poison: { id: "potion_poison", name: "Potion de poison", kind: "use", description: "Enduire : vos 15 prochains coups qui portent empoisonnent. Lancer : un nuage empoisonné en croix.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "poison", throwRange: 5 },
  potion_vitesse: { id: "potion_vitesse", name: "Potion de vitesse", kind: "use", description: "Pendant 4 tours, chaque attaque au corps à corps frappe deux fois.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "haste" },
  potion_feu: { id: "potion_feu", name: "Potion de feu", kind: "use", description: "À lancer : la case visée et ses quatre voisines brûlent pendant 5 tours.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "fire", throwRange: 5 },
  potion_fumee: { id: "potion_fumee", name: "Fiole de fumée", kind: "use", description: "À lancer : un nuage gris ; les monstres tout près (2 cases) perdent votre trace et restent un tour hébétés. Un cadeau de Krik.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "smoke", throwRange: 5 },
  potion_brouillard: { id: "potion_brouillard", name: "Potion de brouillard", kind: "use", description: "Noire et épaisse. À lancer : une nappe de brouillard en losange, cinq cases de large. Personne n'y voit : de quoi fuir.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "fog", throwRange: 5 },
  potion_oursin: { id: "potion_oursin", name: "Potion d'oursin", kind: "use", description: "Brune et piquante. Pendant 40 tours, 15 % des dégâts reçus au contact reviennent à l'attaquant.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "urchin" },
  // ---- Bibelots (emplacement « artefact », Thomas 2026-11-12) ----
  oeil_chauve_souris: { id: "oeil_chauve_souris", name: "Œil de chauve-souris", kind: "artifact", description: "Desséché, il palpite encore. Vous devinez l'ombre des monstres hors de vue : à 10 cases, et à 3 à travers un mur ou une porte.", w: 1, h: 1, maxStack: 1, rarity: "rare" },
  // Outils de voleur (Thomas, 2026-11-13) : le crochetage réussit à coup sûr (portes et sarcophages).
  outils_voleur: { id: "outils_voleur", name: "Outils de voleur", kind: "artifact", description: "Une trousse de crochets et de tensionneurs. Portée en artefact, toute serrure cède : le crochetage réussit à coup sûr.", w: 1, h: 1, maxStack: 1, rarity: "rare" },
  // D20 enchanté (Thomas, 2026-11-14) : une fois par étage, un échec critique devient un coup critique.
  d20_enchante: { id: "d20_enchante", name: "D20 enchanté", kind: "artifact", description: "Un dé d'améthyste qui luit faiblement. Porté en artefact : une fois par étage, votre 1 naturel devient un 20, un coup critique.", w: 1, h: 1, maxStack: 1, rarity: "rare" },
  flute_pan: { id: "flute_pan", name: "Flûte de pan", kind: "artifact", description: "Quelques roseaux liés. En combat, de temps en temps, un air doux endort l'ennemi le plus proche.", w: 1, h: 1, maxStack: 1, rarity: "uncommon" },
  // Thomas, 2026-11-13 : potions de pierre et de discorde.
  potion_pierre: { id: "potion_pierre", name: "Potion de pierre", kind: "use", description: "Grise et lourde. Bue : vous devenez statue 10 tours ; les monstres perdent votre trace et ne vous blessent plus, mais vous ne pouvez rien faire. Lancée : le monstre touché est pétrifié 10 tours, et sert d'abri pour se cacher.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "stone", throwRange: 5, drinkWarning: "Vous serez une statue pendant 10 tours, sans pouvoir rien faire." },
  potion_gel: { id: "potion_gel", name: "Potion de gel", kind: "use", description: "Bleu pâle, froide à travers le verre. Lancée, elle gèle une croix de cinq cases : les monstres pris restent figés 3 tours et le feu s'éteint. Bue, un souffle glacé gèle tout ce qui vous touche.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "frost", throwRange: 5 },
  potion_discorde: { id: "potion_discorde", name: "Potion de discorde", kind: "use", description: "Rose et pétillante. À lancer : les monstres de la case et des quatre voisines se battent entre eux.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "discord", throwRange: 5 },
  // Thomas, 2026-11-13 : potion d'agrandissement (« comme dans BG3 ») et potion glissante.
  potion_geant: { id: "potion_geant", name: "Potion de géant", kind: "use", description: "Violette et bouillonnante. Bue : vous doublez de taille 8 tours, vos coups font deux fois plus mal, mais vous ne passez plus les portes. Lancée : c'est le monstre touché qui grandit (le boss aussi).", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "grow", throwRange: 5, drinkWarning: "Pendant 8 tours, vous ne passerez plus les portes." },
  // Grenade sainte (Thomas, 2026-11-19 : « grenade sainte, avec une croix dessus, explosion lumineuse jaune, bénit les
  // alliés, endommage les ennemis »). Valeurs (C).
  grenade_sainte: { id: "grenade_sainte", name: "Grenade sainte", kind: "use", description: "Une grenade de laiton doré marquée d'une croix. À lancer : elle éclate aussitôt en une lumière jaune sur 2 cases autour. Les monstres pris dedans brûlent (2d6+2, deux fois plus pour les morts) ; vous, vous êtes béni (+1 attaque et +1 classe d'armure pendant 20 tours, et quelques PV).", w: 1, h: 1, maxStack: 3, rarity: "uncommon", holy: true, throwRange: 5 },
  bombe_arcanique: { id: "bombe_arcanique", name: "Bombe arcanique", kind: "use", description: "Une sphère de laiton qui bourdonne, des runes violettes au flanc. À lancer : elle explose 3 tours plus tard, en croix jusqu'à 4 cases (2d6 à qui s'y trouve, vous compris), fait sauter les portes et laisse un nuage gris.", w: 1, h: 1, maxStack: 3, rarity: "rare", bomb: true, throwRange: 5 },
  potion_glissante: { id: "potion_glissante", name: "Potion glissante", kind: "use", description: "Huileuse et dorée. À lancer : le monstre touché devient glissant pour toujours. Chaque coup qu'il reçoit le fait glisser jusqu'au mur, où il rebondit et se cogne.", w: 1, h: 1, maxStack: 3, rarity: "uncommon", potion: "slip", throwRange: 5 },
  // Thomas, 2026-11-13 : « nœud papillon kobold, +8 charisme, très rare » (rareté épique, violette).
  // Amulettes (Thomas, 2026-11-15 ; planche art/amulettes_v1.png) : pendentif de cuivre, une pierre de couleur ; « II » en
  // section 2, pendentif d'argent (Thomas, 2026-11-15).
  amulette_vitalite: { id: "amulette_vitalite", name: "Amulette de vitalité", kind: "amulet", description: "Un pendentif de cuivre, une pierre rouge qui bat doucement. +4 PV max.", w: 1, h: 1, maxStack: 1, rarity: "uncommon", level: 1, bonusHp: 4 },
  amulette_force: { id: "amulette_force", name: "Amulette de force", kind: "amulet", description: "Un pendentif de cuivre, une pierre orange, chaude au toucher. +1 en Force.", w: 1, h: 1, maxStack: 1, rarity: "uncommon", level: 2, bonusForce: 1 },
  amulette_agilite: { id: "amulette_agilite", name: "Amulette d'agilité", kind: "amulet", description: "Un pendentif de cuivre, une pierre verte, légère comme une plume. +2 en Agilité.", w: 1, h: 1, maxStack: 1, rarity: "uncommon", level: 2, bonusAgility: 2 },
  // Sœur Clavicule (section 3, 2026-11-19) : la potion de nuit et le chapelet d'argent (récompenses de ses demandes).
  potion_nuit: { id: "potion_nuit", name: "Potion de nuit", kind: "use", description: "Noire, avec des reflets d'étoiles. Bue : 10 tours, la lune ne vous touche plus (ni vous, ni les cases autour de vous) : les morts n'y voient rien et ne s'y relèvent pas. Lancée : la même nuit sur la case et autour.", w: 1, h: 1, maxStack: 3, rarity: "rare", potion: "night", throwRange: 5 },
  chapelet_argent: { id: "chapelet_argent", name: "Chapelet d'argent", kind: "amulet", description: "Le chapelet de Sœur Clavicule, des perles d'argent sur un fil usé. +2 classe d'armure contre les morts (squelettes, gisants, crânes).", w: 1, h: 1, maxStack: 1, rarity: "rare", level: 10, undeadAc: 2 },
  amulette_precision: { id: "amulette_precision", name: "Amulette de précision", kind: "amulet", description: "Un pendentif de cuivre, une pierre bleue, claire comme un œil. +1 au jet d'attaque, au contact et au tir.", w: 1, h: 1, maxStack: 1, rarity: "rare", level: 4, bonusHit: 1 },
  amulette_vitalite_2: { id: "amulette_vitalite_2", name: "Amulette de vitalité II", kind: "amulet", description: "Le pendentif d'argent à la pierre rouge, deux éclats sur la chaîne. +8 PV max.", w: 1, h: 1, maxStack: 1, rarity: "rare", level: 6, bonusHp: 8 },
  amulette_force_2: { id: "amulette_force_2", name: "Amulette de force II", kind: "amulet", description: "Le pendentif d'argent à la pierre orange, deux éclats sur la chaîne. +2 en Force.", w: 1, h: 1, maxStack: 1, rarity: "rare", level: 6, bonusForce: 2 },
  amulette_agilite_2: { id: "amulette_agilite_2", name: "Amulette d'agilité II", kind: "amulet", description: "Le pendentif d'argent à la pierre verte, deux éclats sur la chaîne. +4 en Agilité.", w: 1, h: 1, maxStack: 1, rarity: "rare", level: 6, bonusAgility: 4 },
  amulette_precision_2: { id: "amulette_precision_2", name: "Amulette de précision II", kind: "amulet", description: "Le pendentif d'argent à la pierre bleue, deux éclats sur la chaîne. +2 au jet d'attaque, au contact et au tir.", w: 1, h: 1, maxStack: 1, rarity: "rare", level: 6, bonusHit: 2 },
  noeud_papillon: { id: "noeud_papillon", name: "Nœud papillon de Kobold", kind: "amulet", description: "Rouge à pois blancs, un peu froissé. Très chic. +8 en Charisme.", w: 1, h: 1, maxStack: 1, rarity: "epic", charisma: 8 },
  // ---- Objets de quête (2026-11-12) : ils n'apparaissent qu'une fois la tâche donnée, et se rapportent au PNJ. ----
  // Section 2 (Thomas, 2026-11-18) : les objets du hall d'exposition, de la salle de concert, et de la prison (Plumeau).
  grand_poulet_or: { id: "grand_poulet_or", name: "Grand Poulet d'Or", kind: "quest", description: "Le chef-d'œuvre volé du hall d'exposition : un poulet d'or massif, l'air vexé. À rapporter à Vernis.", w: 1, h: 1, maxStack: 1 },
  partition: { id: "partition", name: "Partition du Maestro", kind: "quest", description: "« Symphonie pour cloche et champignons ». Les notes sont un peu moisies. À rapporter au Maestro.", w: 1, h: 1, maxStack: 1 },
  cle_geolier: { id: "cle_geolier", name: "Clef du geôlier", kind: "quest", description: "Une grosse clef rouillée. Elle ouvre les fers de Plumeau.", w: 1, h: 1, maxStack: 1 },
  ticket_expo: { id: "ticket_expo", name: "Ticket d'exposition", kind: "artifact", description: "Un ticket doré signé par Vernis. Porté en artefact : chez le Colporteur, un article gratuit par étage.", w: 1, h: 1, maxStack: 1, rarity: "rare" },
  pinceau_magique: { id: "pinceau_magique", name: "Pinceau magique", kind: "artifact", description: "Ses poils ne sèchent jamais. Porté en artefact : une fois par étage, peignez un faux mur sur une case de couloir ; les monstres ne le passent pas et ne voient pas à travers pendant 10 tours.", w: 1, h: 1, maxStack: 1, rarity: "rare" },
  diapason: { id: "diapason", name: "Diapason", kind: "artifact", description: "Il chante un la parfait. Porté en artefact : une fois par étage, faites-le vibrer : les pièges cachés et les passages secrets à 5 cases se révèlent.", w: 1, h: 1, maxStack: 1, rarity: "rare" },
  pomme_doree_expo: { id: "pomme_doree_expo", name: "Pomme dorée", kind: "gem", description: "Une pomme dorée de l'exposition, volée sous sa cloche.", w: 1, h: 1, maxStack: 99, rarity: "rare", value: 60 },
  canard: { id: "canard", name: "Canard de bain", kind: "gem", description: "Le canard du Kobold du bain. Il couine. Un collectionneur en donnerait cher.", w: 1, h: 1, maxStack: 99, rarity: "rare", value: 40 },
  sac_pommes: { id: "sac_pommes", name: "Sac de pommes de Gluck", kind: "quest", description: "Un sac de toile plein de pommes. À rapporter à Gluck.", w: 1, h: 1, maxStack: 1 },
  magot_krik: { id: "magot_krik", name: "Magot de Krik", kind: "quest", description: "Un coffret lourd qui tinte. À rapporter à Krik… ou pas.", w: 1, h: 1, maxStack: 1 },
  // Quêtes v3 (2026-11-14) : la cloche de fortune de Sœur Osseuse, la poule de Grum, et leurs récompenses.
  marmite: { id: "marmite", name: "Marmite", kind: "quest", description: "Une marmite cabossée. Avec une louche dedans, ça sonne presque.", w: 1, h: 1, maxStack: 1 },
  louche: { id: "louche", name: "Louche", kind: "quest", description: "Une grande louche de fer. Le battant idéal.", w: 1, h: 1, maxStack: 1 },
  corde: { id: "corde", name: "Corde", kind: "quest", description: "Une corde de chanvre, un peu tachée. On ne demande pas de quoi.", w: 1, h: 1, maxStack: 1 },
  gobelet: { id: "gobelet", name: "Gobelet truqué", kind: "quest", description: "Un gobelet de cuivre à double fond. La bille n'y est jamais. À rapporter à Fifrelin.", w: 1, h: 1, maxStack: 1 },
  poule_or: { id: "poule_or", name: "Poule aux œufs d'or", kind: "quest", description: "Cocotte, la poule de Grum. Elle pond de l'or, et elle panique.", w: 1, h: 1, maxStack: 1 },
  oeuf_or: { id: "oeuf_or", name: "Œuf d'or", kind: "gem", description: "Pondu par Cocotte. Lourd, froid, en or massif.", w: 1, h: 1, maxStack: 99, rarity: "rare", value: 60 },
  fourche: {
    id: "fourche",
    name: "Fourche de Grum",
    kind: "melee",
    description: "Une fourche de fermier, solide. Pique à deux cases, comme une lance.",
    w: 1,
    h: 4,
    maxStack: 1,
    rarity: "uncommon",
    level: 1,
    reach: 2,
    attackBonus: 3,
    damage: { count: 1, sides: 8, bonus: 1 },
  },
  casque_poulet: {
    id: "casque_poulet",
    name: "Casque poulet",
    kind: "hat",
    description: "Un casque en forme de poulet, crête comprise. Fait main par Grum. Étonnamment solide.",
    w: 1,
    h: 1,
    maxStack: 1,
    rarity: "uncommon",
    level: 1,
    acBonus: 1,
  },
  robe: { id: "robe", name: "Robe", kind: "armor", description: "Une robe d'étude. Elle ne protège guère.", w: 2, h: 2, maxStack: 1, armorClass: 11 },
} satisfies Record<string, ItemDef>;

export type ItemId = keyof typeof ITEMS;

/** Sans arme de mêlée équipée, on se bat à mains nues. */
export const UNARMED = { attackBonus: 2, damage: { count: 1, sides: 2, bonus: 0 } as Dice };

/** Le genre d'un objet, en clair, pour sa fiche. */
export const KIND_LABELS: Record<ItemDef["kind"], string> = {
  melee: "Arme de corps à corps",
  ranged: "Arme à distance",
  armor: "Armure",
  hat: "Heaume",
  artifact: "Artefact",
  amulet: "Amulette",
  ammo: "Munition",
  key: "Objet utile",
  gold: "Monnaie",
  use: "À utiliser",
  gem: "Pierre précieuse",
  bag: "Sac",
  quest: "Objet de quête",
};
