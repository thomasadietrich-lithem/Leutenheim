import { Dice } from "../core/dice";

export interface MonsterDef {
  id: string;
  name: string;
  family: string;
  /** Une ou deux phrases pour l'encyclopédie (jamais de chiffres de défense : le joueur les découvre en jouant). */
  description: string;
  hp: number;
  armorClass: number;
  attackBonus: number;
  damage: Dice;
  vision: number;
  /** Expérience gagnée en le vainquant : un nombre tiré entre ces deux bornes. */
  xpMin: number;
  xpMax: number;
  /** Chance qu'il laisse tomber de l'or, et combien au plus. */
  goldChance: number;
  goldMax: number;
  /** Chance par tour de remarquer le héros quand il est en vue. */
  noticeChance: number;
  color: string;
  /** Couleur du sang (le Schrat saigne vert). */
  /** Couleur du sang (Thomas, 2026-11-12) : jaune pour les Kobolds, noir pour les araignées. */
  blood?: "red" | "green" | "yellow" | "black";
  /** Pas par tour quand il fonce sur le héros (l'araignée en fait deux). */
  chaseSteps?: number;
  /** Chance qu'une morsure qui porte englue le héros (il perd son prochain déplacement). */
  webBite?: number;
  /** Morsure qui empoisonne parfois : chance, PV perdus par tour, nombre de tours. */
  poisonBite?: { chance: number; damage: number; turns: number };
  /** Taille en cases (2 : elle occupe un carré de 2 × 2 ; sa case `x, y` est celle du haut à gauche). */
  size?: number;
  /** Tireur (Kobold frondeur) : sa fronde (portée, bonus au d20, dégâts) et la distance qu'il cherche à garder. */
  sling?: { range: number; attackBonus: number; damage: Dice; keep: number };
  /** Boss : ne se pousse pas, ne se repeuple pas ; son comportement est à part (`src/core/boss.ts`). */
  boss?: boolean;
  // ---- Section 2 (Thomas, 2026-11-15 : « retire les mobs de la section 1 dans la section 2 » ; `claude/MONSTRES_S2.md`) ----
  /** Lent : il ne joue qu'un tour sur deux (le myconide). */
  slow?: boolean;
  /** Aveugle : il ne voit pas, il SENT les pas du héros à cette distance, à travers les murs ; immobile, on le perd. */
  tremorSense?: number;
  /** À sa mort, il éclate : un nuage de spores (empoisonné) sur sa case et ses 4 voisines, pendant ces tours (sporelin). */
  burstGas?: number;
  /** Insensible aux spores et au gaz (le Kobold cueilleur et son masque). */
  sporeProof?: boolean;
  /** Il siffle l'alerte en remarquant le héros, une fois : ce nombre de points d'alerte (le Kobold cueilleur). */
  alarmOnNotice?: number;
  /** Il se relève une fois après sa mort, à moitié de ses PV, sauf s'il meurt en feu (le Kobold envahi). */
  risesOnce?: boolean;
  /** Le feu lui fait deux fois plus mal (le myconide, sec à l'intérieur). */
  fireWeak?: boolean;
  /** À sa mort, il laisse tomber sa hotte : des morilles (le Kobold cueilleur). */
  dropsMorels?: [number, number];
  /** Ne bouge ni n'agit jamais, ne se pousse pas (le battant du Carillon). */
  inert?: boolean;
  // ---- Section 3, l'Ossuaire (Thomas, 2026-11-19 : « Ok fonce » ; `claude/MONSTRES_S3.md`) ----
  /** Un mort (squelette, gisant) : le chant de l'acolyte le soigne ; insensible au poison. */
  undead?: boolean;
  /** Rongeur : il dévore la nourriture laissée au sol à côté de lui (le rat d'ossuaire). */
  eatsFood?: boolean;
  /** Il n'entre pas dans la lumière d'un puits de lune (le rat d'ossuaire). */
  shunsMoon?: boolean;
  /** Abattu, il s'effondre en tas d'os ; dans la lune, il se relève après ces tours, à moitié de ses PV (le squelette). */
  bonePile?: number;
  /** Os creux ou pierre : les projectiles ne font que la moitié des dégâts. */
  arrowResist?: boolean;
  /** Les armes qui assomment (masse, marteau, épée longue) : dégâts en plus, ou doublés (« double »). */
  blunt?: number | "double";
  /** Il chante pour les morts, un tour sur trois, annoncé le tour d'avant (l'acolyte). */
  chanter?: boolean;
  /** Rayon (le crâne lunaire) : il se charge un tour, aligné avec le héros, puis tire sur toute la ligne. */
  beam?: { range: number; damage: Dice };
  /** Gisant du décor : couché, il ne se lève que quand la lune le touche ; 3 tours hors de la lune, il se recouche. */
  effigy?: boolean;
}

export const MONSTERS = {
  schrat: {
    id: "schrat",
    name: "Kobold",
    family: "kobolds",
    description: "Petit pillard écailleux à cornes des premières galeries. Il dort volontiers, mais une fois réveillé il ne lâche plus sa proie.",
    hp: 7,
    armorClass: 12,
    attackBonus: 2,
    damage: { count: 1, sides: 4, bonus: 0 },
    vision: 6,
    xpMin: 1,
    xpMax: 3,
    goldChance: 0.35,
    goldMax: 4,
    noticeChance: 0.4,
    color: "#d9763a",
    blood: "yellow",
  },
  // LE REFLET (salle des miroirs, Thomas 2026-11-26) : il sort du miroir avec les armes, l'armure et la moitié des PV du
  // héros (posés à sa sortie ; ces valeurs-ci ne servent qu'à la fiche). Vaincu, il laisse un objet rare.
  reflet: {
    id: "reflet",
    name: "Votre reflet",
    family: "culte",
    description: "Vous, mais de l'autre côté du miroir : mêmes armes, même armure, la moitié de vos forces. Il sourit quand vous ne souriez pas.",
    hp: 10,
    armorClass: 12,
    attackBonus: 4,
    damage: { count: 1, sides: 6, bonus: 0 },
    vision: 10,
    xpMin: 6,
    xpMax: 6,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 1,
    color: "#9ab8d8",
    blood: "black",
  },
  // KOBOLD FRONDEUR (Thomas, 2026-11-11 : « Kobold frondeur ok » ; planche art/frondeur_v1.png). Valeurs (C).
  frondeur: {
    id: "frondeur",
    name: "Kobold frondeur",
    family: "kobolds",
    description: "Un Kobold en jaque de cuir, fronde à la main. Il garde ses distances, tire de loin et recule derrière les colonnes quand on l'approche.",
    hp: 6,
    armorClass: 12,
    attackBonus: 1,
    damage: { count: 1, sides: 3, bonus: 0 },
    vision: 7,
    xpMin: 2,
    xpMax: 3,
    goldChance: 0.35,
    goldMax: 4,
    noticeChance: 0.45,
    color: "#a87c4a",
    blood: "yellow",
    sling: { range: 6, attackBonus: 3, damage: { count: 1, sides: 4, bonus: 0 }, keep: 3 },
  },
  araignee: {
    id: "araignee",
    name: "Araignée",
    family: "araignées",
    description: "Elle guette dans les coins sombres, près de ses toiles. Très vive quand elle fond sur sa proie, et sa morsure colle.",
    // Validée par Thomas le 2026-11-11 (planche art/araignee_v1.png) : plus rapide, plus de santé, plus de dégâts que le Schrat.
    hp: 10,
    armorClass: 13,
    attackBonus: 3,
    damage: { count: 1, sides: 6, bonus: 0 },
    vision: 6,
    xpMin: 2,
    xpMax: 4,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 0.45,
    color: "#5a4466",
    blood: "black",
    chaseSteps: 2,
    // 1 fois sur 4 (Thomas, 2026-11-13, d'après les joueurs automatiques : 1 sur 3 en faisait un mur aux étages 3-4).
    webBite: 1 / 4,
  },
  // ---------- SECTION 2, LA CHAMPIGNONNIÈRE (planche art/mobs_champi_v1.png ; comportements claude/MONSTRES_S2.md, C) ----------
  // Équilibrés pour un héros de niveau 5 et plus (Thomas, 2026-11-15 : « en section 2, on est déjà niveau 5 ») : du
  // sporelin (le plus faible, un peu plus solide qu'une araignée) au myconide (le plus dur).
  myconide: {
    id: "myconide",
    name: "Myconide",
    family: "champignons",
    description: "Un grand champignon qui marche, aveugle. Il sent vos pas à travers la pierre : qui s'arrête, il le perd. Lent, mais il frappe fort, et le feu le dévore. Blessé, il ne lâche plus sa proie, et il s'emballe quand il est à moitié mort.",
    hp: 24,
    armorClass: 14,
    attackBonus: 8,
    damage: { count: 2, sides: 6, bonus: 3 },
    vision: 0,
    xpMin: 5,
    xpMax: 7,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 0.6,
    color: "#6e5a86",
    blood: "green",
    slow: true,
    tremorSense: 6,
    fireWeak: true,
  },
  sporelin: {
    id: "sporelin",
    name: "Sporelin",
    family: "champignons",
    description: "Une vesse-de-loup sur pattes, qui sautille vers vous en bande. Tué, il éclate en un nuage de spores qui empoisonne tout autour : mieux vaut l'abattre de loin.",
    hp: 8,
    armorClass: 12,
    attackBonus: 4,
    damage: { count: 1, sides: 4, bonus: 2 },
    vision: 5,
    xpMin: 2,
    xpMax: 3,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 0.5,
    color: "#bcae70",
    blood: "green",
    chaseSteps: 2,
    burstGas: 3,
  },
  cueilleur: {
    id: "cueilleur",
    name: "Kobold cueilleur",
    family: "kobolds",
    description: "Un Kobold masqué, la hotte au dos et la serpette à la main. Les spores ne lui font rien ; en vous voyant, il siffle l'alerte. Sa hotte est pleine de morilles.",
    hp: 13,
    armorClass: 14,
    attackBonus: 5,
    damage: { count: 1, sides: 6, bonus: 2 },
    vision: 6,
    xpMin: 3,
    xpMax: 5,
    goldChance: 0.35,
    goldMax: 6,
    noticeChance: 0.45,
    color: "#8a6a44",
    blood: "yellow",
    sporeProof: true,
    alarmOnNotice: 10,
    dropsMorels: [1, 2],
  },
  envahi: {
    id: "envahi",
    name: "Kobold envahi",
    family: "kobolds",
    description: "Un Kobold gris, l'œil voilé : un champignon lui pousse sur le crâne. Abattu, il se relève une fois, à moins d'avoir brûlé, ou qu'on l'achève à terre.",
    hp: 14,
    armorClass: 13,
    attackBonus: 5,
    damage: { count: 1, sides: 6, bonus: 2 },
    vision: 5,
    xpMin: 3,
    xpMax: 4,
    goldChance: 0.2,
    goldMax: 4,
    noticeChance: 0.25,
    color: "#7f9a84",
    blood: "green",
    risesOnce: true,
  },
  // ---------- SECTION 3, L'OSSUAIRE DE LA LUNE PÂLE (planche art/mobs_oss_v1.png ; claude/MONSTRES_S3.md, C) ----------
  // Pensés pour un héros de niveau 10 et plus. La règle qui les relie : la lune réveille les morts, l'ombre les endort.
  rat: {
    id: "rat",
    name: "Rat d'ossuaire",
    family: "rats",
    description: "Un gros rat gris aux yeux rouges, nourri d'on ne sait quoi entre les os. Ils chassent en bande, vite, et dévorent tout ce qui se mange au sol. La lumière de la lune leur fait peur : ils n'y entrent pas.",
    hp: 7,
    armorClass: 12,
    attackBonus: 6,
    damage: { count: 1, sides: 4, bonus: 4 },
    vision: 5,
    xpMin: 2,
    xpMax: 3,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 0.5,
    color: "#6a5e58",
    blood: "red",
    chaseSteps: 2,
    eatsFood: true,
    shunsMoon: true,
  },
  squelette: {
    id: "squelette",
    name: "Squelette",
    family: "morts",
    description: "Un mort de l'ossuaire, l'épée rouillée à la main. Abattu, il s'effondre en tas d'os ; si la lune touche le tas, il se relève. Dans l'ombre, il reste à terre. Une masse, un coup critique ou le feu lui brisent le crâne pour de bon ; les flèches passent entre ses côtes.",
    hp: 18,
    armorClass: 14,
    attackBonus: 7,
    damage: { count: 1, sides: 8, bonus: 5 },
    vision: 6,
    xpMin: 4,
    xpMax: 5,
    goldChance: 0.25,
    goldMax: 6,
    noticeChance: 0.35,
    color: "#e8e0c8",
    blood: "black",
    undead: true,
    bonePile: 3,
    arrowResist: true,
    blunt: 2,
  },
  // Le tireur de la section (Thomas, 2026-11-19 : « on a quelque chose qui tire dans cette section ? ») : comme le
  // frondeur, il garde ses distances et tire ; c'est un squelette (tas d'os, lune, crâne brisé).
  squeletteArcher: {
    id: "squeletteArcher",
    name: "Squelette archer",
    family: "morts",
    description: "Un squelette à l'arc, qui garde ses distances et tire de loin. Comme les autres, il tombe en tas d'os et la lune le relève ; les flèches passent entre ses côtes, la masse le brise.",
    hp: 14,
    armorClass: 13,
    attackBonus: 5,
    damage: { count: 1, sides: 4, bonus: 4 },
    vision: 8,
    xpMin: 4,
    xpMax: 5,
    goldChance: 0.25,
    goldMax: 6,
    noticeChance: 0.45,
    color: "#d8d0b8",
    blood: "black",
    undead: true,
    bonePile: 3,
    arrowResist: true,
    blunt: 2,
    sling: { range: 7, attackBonus: 7, damage: { count: 1, sides: 8, bonus: 4 }, keep: 3 },
  },
  // Thomas, 2026-11-19 : « un mob qui charge et tire un rayon de quelque chose » : un crâne qui flotte dans une flamme pâle.
  craneLunaire: {
    id: "craneLunaire",
    name: "Crâne lunaire",
    family: "morts",
    description: "Un crâne qui flotte dans une flamme pâle. Quand il vous voit en ligne droite, il se charge : la ligne s'allume. Au tour suivant, un rayon de lune part sur toute la ligne et brûle ce qui s'y trouve. Sortez de la ligne !",
    hp: 12,
    armorClass: 13,
    attackBonus: 4,
    damage: { count: 1, sides: 4, bonus: 3 },
    vision: 8,
    xpMin: 4,
    xpMax: 6,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 0.5,
    color: "#bfe0ff",
    blood: "black",
    undead: true,
    beam: { range: 6, damage: { count: 2, sides: 6, bonus: 3 } },
  },
  acolyte: {
    id: "acolyte",
    name: "Acolyte de la Lune pâle",
    family: "culte",
    description: "Un fidèle encapuchonné, une faucille à la main, les yeux pâles comme la lune. Un tour sur trois, il entonne un chant : les morts autour de lui reprennent des forces, et un tas d'os se relève. Frappé pendant qu'il chante, il se tait, sonné.",
    hp: 16,
    armorClass: 12,
    attackBonus: 6,
    damage: { count: 1, sides: 6, bonus: 4 },
    vision: 7,
    xpMin: 5,
    xpMax: 6,
    goldChance: 0.4,
    goldMax: 8,
    noticeChance: 0.45,
    color: "#4a4a6e",
    blood: "red",
    chanter: true,
  },
  gisantEveille: {
    id: "gisantEveille",
    name: "Gisant éveillé",
    family: "morts",
    description: "Un chevalier de pierre couché sur sa dalle, comme les autres gisants… jusqu'à ce que la lune le touche. Il se lève alors, lent et lourd. La pierre ne craint ni le poison ni les flèches, mais la masse la fend. Trois tours hors de la lune, il se recouche.",
    hp: 40,
    armorClass: 17,
    // Thomas, 2026-11-19 : « les statues me one shot » : +8 et 2d6+4 → +7 et 2d6+2 (C).
    attackBonus: 7,
    damage: { count: 2, sides: 6, bonus: 4 },
    vision: 6,
    xpMin: 9,
    xpMax: 11,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 1,
    color: "#8c8c96",
    blood: "black",
    slow: true,
    undead: true,
    arrowResist: true,
    blunt: "double",
    effigy: true,
  },
  // Les FIDÈLES DU CARILLON (Thomas, 2026-11-17 : « B c'est bien, essayons ») : moines-champignons du culte de la Lune
  // pâle, à la place des Kobolds envahis dans sa grotte. Battant cassé : ils vont le réparer (3 tours à côté). (C)
  fidele: {
    id: "fidele",
    name: "Fidèle du Carillon",
    family: "champignons",
    description: "Un moine-champignon en robe violette, la lune pâle brodée sur le cœur. Il sert le Carillon : si son battant tombe, il court le remettre en place. Arrêtez-le avant.",
    hp: 16,
    armorClass: 13,
    attackBonus: 5,
    damage: { count: 1, sides: 6, bonus: 3 },
    vision: 6,
    xpMin: 3,
    xpMax: 5,
    goldChance: 0.3,
    goldMax: 5,
    noticeChance: 0.3,
    color: "#8a5ac0",
    blood: "green",
  },
  // BOSS DE LA SECTION 1 (étage 5 ; planche art/boss_v2.png, Thomas : « implémente », 2026-11-11). Valeurs (C).
  tisseuse: {
    id: "tisseuse",
    name: "la Tisseuse",
    family: "araignées",
    description: "Reine des araignées, grosse comme un chariot, l'abdomen marqué d'un crâne. Elle sent chaque vibration de sa toile, avance pour mordre puis recule dans l'ombre.",
    // Rééquilibrée le 2026-11-11 (proposée à 45 PV, +5, 2d6 : un héros niveau 5 qui fonce perdait toujours).
    // Thomas, 2026-11-14 : « double le nombre de points de vie de la Tisseuse » (36 → 72).
    hp: 72,
    armorClass: 13,
    attackBonus: 4,
    damage: { count: 1, sides: 8, bonus: 1 },
    vision: 2,
    xpMin: 15,
    xpMax: 15,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 1,
    color: "#d8d2c0",
    blood: "black",
    poisonBite: { chance: 1 / 4, damage: 1, turns: 3 },
    size: 2,
    boss: true,
  },
  // BOSS DE LA SECTION 2 (étage 10 ; planches art/carillon_v1.png et carillon_v2.png, version A « coprin » ; Thomas,
  // 2026-11-16 : « A fonce »). Valeurs (C) : voir claude/BOSS_CARILLON.md.
  carillon: {
    id: "carillon",
    name: "le Carillon",
    family: "champignons",
    description: "Un coprin géant qui pousse de la voûte, tête en bas, le chapeau en forme de cloche. C'est lui qui sonnait. Tous les huit tours, son battant de spores frappe : l'onde jette à terre qui n'est pas à l'abri. Entre deux, il fait pleuvoir de l'encre sur des cases marquées d'une ombre, et il crache de l'encre sur qui il voit, de près comme de loin : derrière une souche, on est à l'abri de tout.",
    hp: 120,
    armorClass: 12,
    attackBonus: 5,
    damage: { count: 1, sides: 8, bonus: 1 },
    vision: 12,
    xpMin: 30,
    xpMax: 30,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 1,
    color: "#e6dcc8",
    blood: "green",
    size: 3,
    boss: true,
    sporeProof: true,
  },
  // BOSS DE LA SECTION 3 (étage 15 ; planche art/ossuaire_boss_v1.png ; Thomas, 2026-11-19 : piste C, « fonce sur
  // boss »). Valeurs (C).
  pretresse: {
    id: "pretresse",
    name: "la Grande Prêtresse",
    family: "culte",
    description: "La Grande Prêtresse de la Lune pâle, masque d'os et mitre de craie. Elle déplace le puits de lune (un cercle s'allume là où il va glisser) : les gisants qu'il touche se lèvent. Elle chante pour ses morts : frappez-la pendant le chant. Chaque cierge violet éteint rétrécit la lune. À mi-vie, elle monte chanter dans le puits et les os de la salle se lèvent en Colosse.",
    hp: 110,
    armorClass: 15,
    attackBonus: 8,
    damage: { count: 1, sides: 10, bonus: 5 },
    vision: 10,
    xpMin: 40,
    xpMax: 40,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 1,
    color: "#5c3a84",
    blood: "red",
    boss: true,
  },
  colosse: {
    id: "colosse",
    name: "le Colosse d'ossuaire",
    family: "morts",
    description: "Tous les os de la salle de la Lune, levés en un géant. Ses bras frappent, son crâne tire un rayon de lune. Le cœur de lune, dans sa cage, est le seul point qui le tue : il se montre quand les deux bras, ou le crâne, sont cassés. Un morceau cassé qui reste dans la lune se ressoude.",
    hp: 55,
    armorClass: 12,
    attackBonus: 0,
    damage: { count: 1, sides: 1, bonus: 0 },
    vision: 10,
    xpMin: 12,
    xpMax: 12,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 1,
    color: "#e2d6b8",
    blood: "black",
    size: 3,
    undead: true,
  },
  brasColosse: {
    id: "brasColosse",
    name: "un bras du Colosse",
    family: "morts",
    description: "Un bras du Colosse, fait de fémurs, le poing en grappe de crânes. Il frappe qui passe à côté. Cassé, il se ressoude si le Colosse reste dans la lune.",
    hp: 26,
    armorClass: 13,
    attackBonus: 8,
    damage: { count: 1, sides: 10, bonus: 5 },
    vision: 3,
    xpMin: 2,
    xpMax: 2,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 1,
    color: "#e2d6b8",
    blood: "black",
    undead: true,
    blunt: 2,
  },
  craneColosse: {
    id: "craneColosse",
    name: "le crâne du Colosse",
    family: "morts",
    description: "Le grand crâne du Colosse, aux orbites de lune. Aligné avec vous, il se charge, puis tire un rayon de lune sur toute la ligne. Cassé, le cœur du Colosse est à nu.",
    hp: 30,
    armorClass: 13,
    attackBonus: 0,
    damage: { count: 1, sides: 1, bonus: 0 },
    vision: 10,
    xpMin: 3,
    xpMax: 3,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 1,
    color: "#e2d6b8",
    blood: "black",
    undead: true,
    blunt: 2,
    beam: { range: 8, damage: { count: 2, sides: 6, bonus: 4 } },
  },
  /** Le battant du Carillon : une boule de spores pendue sous son chapeau ; on la casse pour le faire taire. */
  battant: {
    id: "battant",
    name: "le battant",
    family: "champignons",
    description: "La grosse boule de spores qui pend sous le chapeau du Carillon et le fait sonner. Il ne s'atteint que quand la cloche se balance, juste avant l'onde (sinon, seul un coup parfait passe). Cassée (flèches, javelines, coups, ou une poussée), il ne sonne plus, mais son chapeau se met à fondre.",
    hp: 20,
    armorClass: 14,
    attackBonus: 0,
    damage: { count: 1, sides: 1, bonus: 0 },
    vision: 0,
    xpMin: 2,
    xpMax: 2,
    goldChance: 0,
    goldMax: 0,
    noticeChance: 0,
    color: "#c4d660",
    blood: "green",
    sporeProof: true,
    inert: true,
  },
} satisfies Record<string, MonsterDef>;

export type MonsterId = keyof typeof MONSTERS;

/** Une ligne de table d'apparition : quel monstre, à quelle fréquence, en groupe de combien. */
export interface SpawnEntry {
  monster: MonsterId;
  weight: number;
  packMin: number;
  packMax: number;
}

export interface FloorSpawns {
  /** Chance qu'une salle (hors salle de départ) contienne un groupe. */
  roomChance: number;
  /** Chance qu'un groupe dorme. Les autres se promènent d'une salle à l'autre. */
  sleepChance: number;
  entries: SpawnEntry[];
}

/** Table d'apparition selon la profondeur. Pour l'instant : les Schrats, en meutes qui grossissent. */
export function spawnsForDepth(depth: number): FloorSpawns {
  // Section 3, l'Ossuaire (claude/MONSTRES_S3.md, C) : 11 rats et squelettes ; 12 + acolyte ; 13 + gisants (sortis du
  // décor, voir `Game`) ; 14 meutes plus grosses.
  if (depth > 10) {
    const k = Math.min(depth - 10, 4) - 1;
    return {
      // Thomas, 2026-11-19 : « étages 11 / 12, je passe à travers » : plus de salles peuplées, des meutes plus grosses,
      // moins de dormeurs, et des archers dès l'étage 12 (C).
      roomChance: [0.72, 0.76, 0.78, 0.82][k],
      sleepChance: [0.3, 0.25, 0.25, 0.2][k],
      entries: [
        { monster: "rat", weight: [1, 0.9, 0.8, 0.7][k], packMin: k >= 3 ? 3 : 2, packMax: [4, 4, 5, 5][k] },
        { monster: "squelette", weight: [0.9, 1, 1, 1][k], packMin: k >= 1 ? 2 : 1, packMax: k >= 1 ? 3 : 2 },
        ...(k >= 1 ? [{ monster: "craneLunaire" as const, weight: [0, 0.4, 0.5, 0.6][k], packMin: 1, packMax: k >= 3 ? 2 : 1 }] : []),
        ...(k >= 1 ? [{ monster: "squeletteArcher" as const, weight: [0, 0.5, 0.6, 0.7][k], packMin: 1, packMax: k >= 3 ? 2 : 1 }] : []),
        ...(k >= 1 ? [{ monster: "acolyte" as const, weight: [0, 0.4, 0.5, 0.6][k], packMin: 1, packMax: 1 }] : []),
        ...(k >= 3 ? [{ monster: "gisantEveille" as const, weight: 0.3, packMin: 1, packMax: 2 }] : []),
      ],
    };
  }
  // Section 2, la champignonnière (Thomas, 2026-11-15 : « retire les mobs de la section 1 dans la section 2 ») : plus de
  // Kobolds, de frondeurs ni d'araignées ; ses quatre monstres à elle (C).
  if (depth > 5) {
    // CRESCENDO (Thomas, 2026-11-15 : « les mobs faciles au début ; à la fin, les faciles et les difficiles », comme en
    // section 1) : étage 6 sporelins et envahis seuls ; 7 + cueilleur ; 8 + myconide ; 9 et 10 meutes plus grosses (C).
    const d = depth - 5;
    // PENTE RÉGULIÈRE (Thomas, 2026-11-19 : « plus on avance dans une section, plus on rencontre ses mobs difficiles » ;
    // l'étage 6 tuait plus que les étages 7, 8 et 9 réunis) : l'étage 6 s'adoucit (peu d'envahis), puis les faciles se
    // raréfient et les difficiles prennent la place ; plus de salles peuplées aux étages 8 et 9. Aucun PV n'est changé.
    const k = Math.min(d, 4) - 1;
    return {
      roomChance: [0.36, 0.47, 0.64, 0.78][k],
      sleepChance: [0.7, 0.5, 0.35, 0.2][k],
      entries: [
        { monster: "sporelin", weight: [1, 0.9, 0.7, 0.5][k], packMin: 1, packMax: Math.min(1 + d, 4) },
        { monster: "envahi", weight: [0.4, 0.8, 0.9, 1][k], packMin: d >= 4 ? 2 : 1, packMax: d >= 3 ? 3 : d >= 2 ? 2 : 1 },
        ...(d >= 2 ? [{ monster: "cueilleur" as const, weight: [0, 0.45, 0.6, 0.7][k], packMin: 1, packMax: d >= 4 ? 2 : 1 }] : []),
        ...(d >= 3 ? [{ monster: "myconide" as const, weight: [0, 0, 0.6, 1.1][k], packMin: 1, packMax: d >= 4 ? 3 : 2 }] : []),
      ],
    };
  }
  return {
    roomChance: Math.min(0.3 + depth * 0.05, 0.7),
    // Étages du haut : presque tout le monde dort. Plus on descend, plus ça se promène.
    // Étage 1 plus doux (Thomas, 2026-11-13) : 80 % de dormeurs (65 % avant), puis −10 % par étage depuis 65 %.
    sleepChance: depth === 1 ? 0.8 : Math.max(0.2, 0.65 - (depth - 1) * 0.1),
    entries: [
      // Meutes de Kobolds : 1 aux étages 1-2, 2 aux étages 3-4, 3 à l'étage 5… (2026-11-11 : un cran plus doux qu'avant,
      // la chute de l'étage 3 à l'étage 4 était trop raide).
      { monster: "schrat", weight: 1, packMin: 1, packMax: Math.min(1 + Math.floor((depth - 1) / 2), 4) },
      // Les araignées arrivent à l'étage 3, avec les toiles (Thomas) ; elles chassent seules ou à deux.
      // Kobold frondeur (2026-11-11) : dès l'étage 2, seul.
      ...(depth >= 2 ? [{ monster: "frondeur" as const, weight: 0.35, packMin: 1, packMax: 1 }] : []),
      // (2026-11-11) : seules aux étages 3-4, jusqu'à deux ensuite.
      ...(depth >= 3 ? [{ monster: "araignee" as const, weight: 0.25, packMin: 1, packMax: depth >= 5 ? 2 : 1 }] : []),
    ],
  };
}
