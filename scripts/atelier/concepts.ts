/**
 * Concepts (2026-11-13) : les « briques » des ZONES SPÉCIALES de quête, dessinées à 16 × 16 en premier jet, pour en
 * parler (rien n'est en jeu). Palette commune ; plusieurs images = deux états (fermé / ouvert, éteint / allumé).
 */
const P: Record<string, string> = {
  K: "#120d08", W: "#f4f7ff", S: "#c3cbe0", D: "#7f88a6", d: "#4e5570", G: "#f0c050", g: "#a87c1c", B: "#9a6a34", b: "#5a3817",
  T: "#b9824a", t: "#7a5230", R: "#d03a44", r: "#8e1f28", Y: "#ffe27a", O: "#e8782a", Z: "#d8c8a0", z: "#a08c64", E: "#5cc860",
  e: "#2e7a38", N: "#06050a", F: "#ffd84a", P: "#7a5aa0", p: "#4a3266", H: "#3a4058", L: "#e6dcc0",
};

export interface Concept {
  name: string;
  group: string;
  note: string;
  frames: string[][];
  palette: Record<string, string>;
}

export const CONCEPTS: Concept[] = [
  {
    name: "Pan de mur secret",
    group: "Passages secrets",
    note: "Un mur comme les autres ; un indice (Krik, une fouille réussie) le fait luire. Une action l'ouvre : il coulisse dans le sol avec un grondement (+2 d'alerte).",
    palette: P,
    frames: [
      ["KKKKKKKKKKKKKKKK", "KDSSDKDSSSDKDSDK", "KdDDdKdDDDdKdDdK", "KKKKKKKKKKKKKKKK", "KSDKDSSSDKDSSDKK", "KDdKdDDDdKdDDdKK", "KKKKKKKKKKKKKKKK", "KDSSDKDSSSDKDSDK", "KdDDdKdDDDdKdDdK", "KKKKKKKKKKKKKKKK", "KSDKDSSSDKDSSDKK", "KDdKdDDDdKdDDdKK", "KKKKKKKKKKKKKKKK", "KDSSDKDSSSDKDSDK", "KdDDdKdDDDdKdDdK", "KKKKKKKKKKKKKKKK"],
      ["KKKKKKKKKKKKKKKK", "KDSDKNNNNNNKDSDK", "KdDdKNNNNNNKdDdK", "KKKKKNNNNNNKKKKK", "KSDKKNNNNNNKSDKK", "KDdKKNNNNNNKDdKK", "KKKKKNNNNNNKKKKK", "KDSDKNNNNNNKDSDK", "KdDdKNNNNNNKdDdK", "KKKKKNNNNNNKKKKK", "KSDKKNNNNNNKSDKK", "KDdKKNNNNNNKDdKK", "KKKKKNNNNNNKKKKK", "KDSDKddddddKDSDK", "KdDdKDSDSDSKdDdK", "KKKKKKKKKKKKKKKK"],
    ],
  },
  {
    name: "Levier",
    group: "Passages secrets",
    note: "Sur un mur. Le toucher : clac, le levier bascule ; il ouvre un pan de mur, une grille, ou… lâche un piège.",
    palette: P,
    frames: [
      ["................", "................", "..........KK....", ".........KGGK...", "........KGGK....", ".......KBBK.....", "......KBBK......", ".....KBBK.......", "....KKDDKK......", "...KSDDDDSK.....", "...KDdddDDK.....", "...KDdKKdDK.....", "...KSDDDDSK.....", "....KKKKKK......", "................", "................"],
      ["................", "................", "................", "................", "................", "................", "................", "....KKDDKK......", "...KSDDDDSK.....", "...KDdddDDKBBK..", "...KDdKKdDKBBBK.", "...KSDDDDSKKBGGK", "....KKKKKK..KGGK", ".............KK.", "................", "................"],
    ],
  },
  {
    name: "Dalle à pression",
    group: "Passages secrets",
    note: "Une dalle à peine plus claire. Marcher dessus (ou y pousser un monstre) : clac, quelque chose s'ouvre ailleurs.",
    palette: P,
    frames: [
      ["................", "................", "................", "...KKKKKKKKKK...", "...KSSSSSSSSK...", "...KSDDDDDDdK...", "...KSDDDDDDdK...", "...KSDDDDDDdK...", "...KSDDDDDDdK...", "...KSDDDDDDdK...", "...KSDDDDDDdK...", "...KdddddddddK..", "...KKKKKKKKKK...", "................", "................", "................"],
      ["................", "................", "................", "...KKKKKKKKKK...", "...KNNNNNNNNK...", "...KdDDDDDDdK...", "...KdDDDDDDdK...", "...KdDDDDDDdK...", "...KdDDDDDDdK...", "...KdDDDDDDdK...", "...KdDDDDDDdK...", "...KdddddddddK..", "...KKKKKKKKKK...", "................", "................", "................"],
    ],
  },
  {
    name: "Tapisserie",
    group: "Passages secrets",
    note: "Une vieille tapisserie au mur ; derrière, un passage. La trancher (un coup) ou la soulever (fouille).",
    palette: P,
    frames: [
      ["..KKKKKKKKKKKK..", ".KGgggggggggggK.", "..KRRRRRRRRRRK..", "..KRrRRYRRRrRK..", "..KRRRYYYRRRRK..", "..KRRYYOYYRRRK..", "..KRRRYYYRRRRK..", "..KRrRRYRRRrRK..", "..KRRRRRRRRRRK..", "..KRRrRRRRrRRK..", "..KRRRRRRRRRRK..", "..KrRrRrRrRrRK..", "..KKKKKKKKKKKK..", "..K.K.K.K.K.K...", "................", "................"],
      ["..KKKKKKKKKKKK..", ".KGgggggggggggK.", "..KRRRKNNNKRRK..", "..KRrRKNNNKRRK..", "..KRRKNNNNNKRK..", "..KRRKNNNNNKRK..", "..KRKNNNNNNNKK..", "..KRKNNNNNNNKK..", "..KKNNNNNNNNNK..", "..KKNNNNNNNNNK..", "..KRKNNNNNNNKK..", "..KrKNNNNNNNKK..", "..KKKKKKKKKKKK..", "................", "................", "................"],
    ],
  },
  {
    name: "Tonneau creux",
    group: "Passages secrets",
    note: "Dans une cuisine : un tonneau qui sonne creux. Le POUSSER (Bousculade !) découvre l'entrée du cellier de Gluck.",
    palette: P,
    frames: [
      ["................", "....KKKKKKKK....", "...KTTTTTTTTK...", "..KBTTtTTtTTBK..", "..KKKKKKKKKKKK..", "..KBBTBBBBTBBK..", "..KBBTBBBBTBBK..", "..KDDDDDDDDDDK..", "..KBBTBBBBTBBK..", "..KBBTBBBBTBBK..", "..KBBTBBBBTBBK..", "..KDDDDDDDDDDK..", "..KbBTBBBBTBbK..", "...KbbbbbbbbK...", "....KKKKKKKK....", "................"],
      ["................", "..........KKKKKK", ".........KTTTTTK", "........KBKKKKKK", "....KKKKKBBTBBBK", "...KNNNNKDDDDDDK", "..KNNNNNNKBBTBBK", "..KNNNNNNKBBTBBK", "..KNNNNNNKDDDDDK", "..KNNdNNNKbbbbK.", "..KNdNNNNNKKKK..", "...KNNNNNNK.....", "....KKKKKK......", "................", "................", "................"],
    ],
  },
  {
    name: "Paillasse",
    group: "Zone : dortoir secret de Krik",
    note: "Trois paillasses, trois Kobolds qui ronflent, une bougie au milieu. Souffler la bougie : le noir complet, on passe sans les réveiller.",
    palette: P,
    frames: [
      ["................", "................", "................", "................", "...KKKKKKKKKK...", "..KZZzZZZzZZZK..", ".KZzZZZzZZzZZzK.", ".KZZZzZZZZZzZZK.", ".KzZZZZzZZZZZZK.", ".KZZzZZZZzZZzZK.", "..KzzzzzzzzzzK..", "...KKKKKKKKKK...", "................", "................", "................", "................"],
    ],
  },
  {
    name: "Bougie (éteinte / allumée)",
    group: "Zone : dortoir secret de Krik",
    note: "Allumer ou souffler une bougie : la lumière change ce que voient les monstres… et le héros.",
    palette: P,
    frames: [
      ["................", "................", "................", "................", "................", "................", ".......K........", ".......K........", "......KLK.......", "......KLK.......", "......KLK.......", "......KLK.......", ".....KKKKK......", "....KDDDDDK.....", ".....KKKKK......", "................"],
      ["................", "................", ".......Y........", "......YFY.......", "......FOF.......", ".......O........", ".......K........", "......KLK.......", "......KLK.......", "......KLK.......", "......KLK.......", "......KLK.......", ".....KKKKK......", "....KDDDDDK.....", ".....KKKKK......", "................"],
    ],
  },
  {
    name: "Cierge de chapelle",
    group: "Zone : sacristie de Sœur Osseuse",
    note: "Trois cierges à rallumer dans la chapelle (feu, torche) : le mur derrière l'autel s'ouvre sur la sacristie.",
    palette: P,
    frames: [
      ["................", "................", "................", "......K.........", ".....KWK........", ".....KWK........", ".....KWK........", ".....KWK........", ".....KWK........", ".....KWK........", "....KKKKK.......", "....KGgGK.......", ".....KgK........", "....KGGGK.......", "...KKKKKKK......", "................"],
      ["......Y.........", ".....YFY........", ".....FOF........", "......O.........", ".....KWK........", ".....KWK........", ".....KWK........", ".....KWK........", ".....KWK........", ".....KWK........", "....KKKKK.......", "....KGgGK.......", ".....KgK........", "....KGGGK.......", "...KKKKKKK......", "................"],
    ],
  },
  {
    name: "Œuf d'or",
    group: "Zone : la grange de Grum",
    note: "Pondu par une poule du pré… qui s'est enfuie dans l'étage. L'approcher caché, sinon elle détale.",
    palette: P,
    frames: [
      ["................", "................", "................", "................", "......KKKK......", ".....KYFFGK.....", "....KYFFFFGK....", "....KFFFFFGK....", "...KYFFFFFFGK...", "...KFFFFFFFgK...", "...KFFFFFFGgK...", "....KGFFFGgK....", "....KKggggKK....", "......KKKK......", "................", "................"],
    ],
  },
  {
    name: "Squelette à butin",
    group: "Trainards",
    note: "Déjà validé sur la planche trainards_v3 : un aventurier malchanceux ; le fouiller donne un peu d'or ou un objet.",
    palette: P,
    frames: [
      ["................", "................", "................", "......KKK.......", ".....KWWWK......", ".....KWKWK......", "......KWK.......", "....KK.K.KK.....", "...KWKWKWKWK....", "....KWWWWWK.....", "...KWK.K.KWK....", ".......K........", "......KWK.......", ".....KW.WK......", "....KW...WK.....", "................"],
    ],
  },
];
