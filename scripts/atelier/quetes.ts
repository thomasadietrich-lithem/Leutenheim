/**
 * DECK DES QUÊTES (Thomas, 2026-11-13 : « chaque option de dialogue présente un objectif à réaliser ; une zone spéciale
 * par quête ; un fichier où l'on voit chaque quête et objet interactif fun, avec les illustrations »). PROPOSITION v3.
 * Construit par `node scripts/atelier.mjs` → `demo/quetes.html`.
 */
import { allSprites, draw, GLUCK_PALETTE, KRIK_PALETTE, Sprite, spriteCanvas } from "./registry";
import { CONCEPTS } from "./concepts";
import { SCHRAT, SCHRAT_PALETTE } from "../../src/render/sprites/schrat";

const sprites = allSprites();
const find = (group: string, name: string): Sprite | undefined => sprites.find((s) => s.group === group && s.name === name);
const concept = (name: string, frame = 0): Sprite => {
  const c = CONCEPTS.find((k) => k.name === name)!;
  return { group: c.group, name: c.name, rows: c.frames[frame], palette: c.palette };
};

/** Ce qui se dessine pour chaque lettre d'un plan de zone. */
const LEGEND: Record<string, { label: string; sprite?: () => Sprite | undefined; floor?: string }> = {
  "#": { label: "mur", floor: "#2a2533" },
  ".": { label: "sol", floor: "#4a4658" },
  ",": { label: "sol de la zone secrète", floor: "#5a4a42" },
  S: { label: "pan de mur secret (fermé)", sprite: () => concept("Pan de mur secret", 0) },
  O: { label: "pan de mur secret (ouvert)", sprite: () => concept("Pan de mur secret", 1), floor: "#5a4a42" },
  L: { label: "levier", sprite: () => concept("Levier", 0) },
  P: { label: "dalle à pression", sprite: () => concept("Dalle à pression", 0) },
  T: { label: "tapisserie", sprite: () => concept("Tapisserie", 0) },
  B: { label: "tonneau creux", sprite: () => concept("Tonneau creux", 0) },
  p: { label: "paillasse", sprite: () => concept("Paillasse", 0) },
  c: { label: "bougie", sprite: () => concept("Bougie (éteinte / allumée)", 1) },
  C: { label: "cierge éteint", sprite: () => concept("Cierge de chapelle", 0) },
  e: { label: "œuf d'or", sprite: () => concept("Œuf d'or", 0) },
  k: { label: "Kobold endormi", sprite: () => ({ group: "", name: "", rows: SCHRAT.sleep[0], palette: SCHRAT_PALETTE }) },
  K: { label: "Kobold", sprite: () => ({ group: "", name: "", rows: SCHRAT.idleDown[0], palette: SCHRAT_PALETTE }) },
  g: { label: "Gluck", sprite: () => ({ group: "", name: "", rows: SCHRAT.idleDown[0], palette: GLUCK_PALETTE }) },
  r: { label: "Krik", sprite: () => ({ group: "", name: "", rows: SCHRAT.idleDown[0], palette: KRIK_PALETTE }) },
  n: { label: "Sœur Osseuse", sprite: () => find("Personnages", "Sœur Osseuse") },
  m: { label: "Grum", sprite: () => find("Personnages", "Grum, le Kobold fermier (à valider)") },
  f: { label: "poule", sprite: () => find("Personnages", "Le poulet") },
  a: { label: "cageot de pommes", sprite: () => find("Cuisine, prière, torture", "basket") },
  x: { label: "coffre", sprite: () => find("Escaliers et coffres", "chest") },
  t: { label: "table", sprite: () => find("Dortoir", "table") },
  h: { label: "botte de foin", sprite: () => find("Ferme", "hayBale") },
  s: { label: "statue", sprite: () => find("Statues", "statue") },
  A: { label: "autel", sprite: () => find("Cuisine, prière, torture", "altar") },
  w: { label: "banc", sprite: () => find("Cuisine, prière, torture", "pew") },
  d: { label: "porte", floor: "#7a5230" },
  "@": { label: "le héros", sprite: () => find("Héros : Humain Guerrier", "idleDown") },
  "*": { label: "indice sur la carte (étoile dorée)", floor: "#4a4658" },
  X: { label: "coffre d'acier (objet rare, or ×2)", sprite: () => find("Escaliers et coffres", "coffre d'acier") },
  R: { label: "armure", sprite: () => find("Forge et alchimiste", "armorStand") },
  V: { label: "présentoir", sprite: () => find("Pièces secrètes et prison", "display") },
  $: { label: "pile d'or", floor: "#7a6420" },
  Z: { label: "caisses", sprite: () => find("Tonneaux, caisses, toiles", "crateStack") },
  b: { label: "tonneau", sprite: () => find("Tonneaux, caisses, toiles", "barrel") },
  H: { label: "creux du mur (on voit derrière à 3 cases)", sprite: () => find("Pièces secrètes et prison", "wallHoleA"), floor: "#2a2533" },
  "=": { label: "pan de mur qui cède à la fouille", floor: "#3c3444" },
  G: { label: "grille fermée", sprite: () => find("Pièces secrètes et prison", "grille") },
  O: { label: "grille ouverte", sprite: () => find("Pièces secrètes et prison", "grilleOpen") },
  D: { label: "bureau du geôlier et son registre", sprite: () => find("Pièces secrètes et prison", "desk") },
  u: { label: "seau", sprite: () => find("Pièces secrètes et prison", "bucket") },
  q: { label: "Plumeau, le greffier (proposé)", sprite: () => find("Personnages", "Plumeau, le greffier (proposé)") },
  j: { label: "le geôlier (Kobold endormi au bureau)", sprite: () => ({ group: "", name: "", rows: SCHRAT.sleep[0], palette: SCHRAT_PALETTE }) },
};

interface Choice {
  pick: string;
  roll?: string;
  goal: string;
  win: string;
  fail?: string;
}
interface Slide {
  kicker?: string;
  title: string;
  lead?: string;
  bullets?: string[];
  choices?: Choice[];
  zone?: { name: string; map: string[]; how: string[] };
  gallery?: { sprite: () => Sprite | undefined; label: string; note?: string }[];
  status?: string;
}

const SLIDES: Slide[] = [
  {
    kicker: "Cave Roller — proposition du 2026-11-13",
    title: "Quêtes v3 : chaque choix est une mission",
    lead: "Thomas : « chaque option de dialogue doit présenter un objectif à réaliser, pas simplement une réponse ». Et chaque quête ouvre une ZONE SPÉCIALE, cachée dans l'étage.",
    bullets: ["Glisser ou toucher les flèches pour naviguer.", "Les dessins marqués « concept » sont des premiers jets à valider.", "Rien de ce deck n'est encore en jeu, sauf mention « EN JEU »."],
  },
  {
    kicker: "La règle commune",
    title: "Zones spéciales : 6 règles",
    bullets: [
      "1. UNE ZONE PAR QUÊTE : une petite pièce (3 × 3 à 5 × 6) ajoutée à l'étage dès sa création, mais SCELLÉE : on ne la voit pas, la fouille ne la trouve pas, tant que la quête n'est pas donnée.",
      "2. LE PNJ DONNE UN INDICE PRÉCIS, et une étoile dorée s'allume sur la carte à l'entrée (« le tonneau qui sonne creux, dans la cuisine »).",
      "3. ON L'OUVRE PAR UNE ACTION DU JEU, jamais un simple toucher : pousser, frapper, allumer, éteindre, se cacher, fouiller, poser un objet. Les compétences servent (Bousculade, Esquive…).",
      "4. DEDANS, UNE PETITE SCÈNE avec 1 à 3 objets interactifs et au moins deux façons de s'en sortir : en douce, en force, ou malin.",
      "5. CHAQUE CHOIX DU DIALOGUE = UN OBJECTIF DIFFÉRENT dans cette zone ou dans l'étage. Un jet raté ne donne pas « rien » : il change l'objectif (plus dur, plus bruyant, plus drôle).",
      "6. LA ZONE RESTE après la quête : une cache, un lit pour se reposer, un raccourci. Le joueur se souvient de l'avoir ouverte.",
    ],
  },
  {
    kicker: "Les briques",
    title: "Objets interactifs des zones (concepts)",
    lead: "Une dizaine de briques suffisent pour composer toutes les zones. Chacune réagit aux règles déjà en jeu (feu, bruit, lumière, poussée).",
    gallery: CONCEPTS.map((c) => ({ sprite: () => ({ group: c.group, name: c.name, rows: c.frames[0], palette: c.palette, frames: c.frames }), label: c.name, note: c.note })),
  },
  {
    kicker: "Quête 01 — Gluck, le Kobold aux pommes",
    title: "Rencontre 1 : quatre choix, quatre missions",
    status: "EN JEU (2026-11-14) : chaque choix est une mission ; la zone s'ouvre à l'acceptation",
    choices: [
      { pick: "Lui parler gentiment", roll: "Charisme, moyen", goal: "« Mon cellier est derrière le tonneau qui sonne creux, dans la cuisine. Des Kobolds y dorment sur MES pommes. »", win: "POUSSER le tonneau (la Bousculade aide) → le cellier ; réveiller ou pas les deux dormeurs ; rapporter le sac → 3 pommes + Gluck ami.", fail: "Raté : il ne fait pas confiance ; il faut d'abord lui DONNER une pomme, puis la mission est la même." },
      { pick: "Le menacer", roll: "Force, facile", goal: "Il file en semant des pommes : SUIVRE LA PISTE (une pomme toutes les 3 cases) jusqu'à sa planque.", win: "Au bout : le cellier, barricadé. Enfoncer (bruit) ou frapper à la porte (Charisme). Dedans, ses pommes, et Gluck terrorisé : 2 pommes + rancunier.", fail: "Raté : il crie ; un frondeur arrive par la piste de pommes." },
      { pick: "Lui proposer un marché", roll: "Intelligence, moyen", goal: "« La statue de la salle aux colonnes sonne creux. » (EN JEU)", win: "BRISER la statue creuse → un objet plus rare ; revenir : 2 pommes.", fail: "Raté : il vend sa pomme 80 or (EN JEU)." },
      { pick: "Lui voler ses pommes", roll: "Agilité, dur", goal: "Il va faire la sieste dans son cellier. Y ENTRER EN DOUCE (se cacher à côté du tonneau) et prendre le sac sans le réveiller.", win: "Chaque pas à 2 cases de lui : un jet de Discrétion ; le gravier et l'eau font du bruit. Réussi : le sac entier (4 pommes).", fail: "Il se réveille : « AU VOLEUR ! » +10 d'alerte, et les dormeurs du cellier aussi." },
    ],
    zone: {
      name: "Zone : le cellier de Gluck (derrière le tonneau creux de la cuisine)",
      map: ["#########", "#.......#", "#..t....#", "#......B#", "######,,#", "#,,a,a,,#", "#,k,,,a,#", "#,a,c,k,#", "#########"],
      how: ["Entrée : POUSSER le tonneau creux (B) ; il glisse et découvre un escalier de 3 marches.", "Dedans : cageots de pommes (a), une bougie (c) et deux Kobolds endormis (k).", "Après : le cellier reste une cache (2 pommes à chaque nouvel étage où Gluck passe)."],
    },
  },
  {
    kicker: "Quête 01 — Gluck",
    title: "Rencontres 2 à 4 : des missions courtes",
    choices: [
      { pick: "Le commerçant : négocier", roll: "Charisme, moyen", goal: "« Mes prix baissent si tu chasses le Kobold qui vend des pommes moins cher que moi. » Un Kobold marchand à trouver dans l'étage.", win: "Le chasser (sans le tuer : le POUSSER hors de sa salle trois fois) → pommes à 3 or pour toute la partie." },
      { pick: "Le chef d'entreprise : investir", goal: "Il a besoin d'un « local » : DÉGAGER une salle de ses monstres pour y poser son étal.", win: "Salle vide → il s'installe ; à l'étage suivant, il rend la mise ×2 (1 fois sur 5, il a tout perdu)." },
      { pick: "Le philosophe : écouter", goal: "« Va t'asseoir sur le banc de la chapelle et réfléchis 5 tours. »", win: "Se reposer 5 tours sur un banc (sans monstre en vue) → un secret : la dalle à pression de l'étage s'allume." },
    ],
  },
  {
    kicker: "Quête 02 — Sœur Osseuse et la cloche disparue",
    title: "Rencontre 1 : quatre missions dans la chapelle",
    status: "EN JEU (2026-11-14) : chaque choix est une mission ; la zone s'ouvre à l'acceptation",
    choices: [
      { pick: "La consoler", roll: "Charisme, moyen", goal: "« Rallumez mes trois cierges. Les Kobolds les ont soufflés. » Trois cierges (C) dans l'étage : un dans la chapelle, deux dans d'autres salles.", win: "Les allumer (torche allumée à côté, ou feu) → le mur derrière l'autel COULISSE : la sacristie. Protection +1 CA.", fail: "Raté : elle veut d'abord qu'on s'agenouille (passer 3 tours immobile devant l'autel)." },
      { pick: "Lui dire qu'on l'entend sonner, sous le village", roll: "Intelligence, moyen", goal: "« Écoutez le sol. » Trouver la GRILLE au sol d'où monte le son (3 grilles dans l'étage, une seule sonne).", win: "Se tenir sur la bonne grille et attendre 2 tours : on entend la cloche → l'escalier s'allume sur la carte + Clarté.", fail: "Raté : « Des racontars de boulanger. » La mission reste, mais sans indice sur la bonne grille." },
      { pick: "Proposer de punir les Kobolds", roll: "Force, facile", goal: "Trois Kobolds portent des objets volés de la chapelle (un bougeoir, un missel, un goupillon) : les leur reprendre.", win: "Chaque objet rapporté sur l'autel : +1 tour de Malédiction ; les trois → Protection + Chance (EN JEU : punir 3 Kobolds)." },
      { pick: "Fabriquer une cloche de fortune", roll: "Agilité, moyen", goal: "Rassembler 3 morceaux : une marmite (cuisine), une louche (forge), une corde (salle de torture). Les poser sur l'autel.", win: "« CLONC. » Elle pleure de joie : Chance (3 relances).", fail: "Raté : un vacarme, +5 d'alerte, mais on peut recommencer avec les mêmes morceaux." },
    ],
    zone: {
      name: "Zone : la sacristie (derrière l'autel)",
      map: ["###S###", "#,,,,,#", "#,x,C,#", "#,,,,,#", "#######", "#..A..#", "#w.n.w#", "#w...w#", "#.C.C.#", "###d###"],
      how: ["Entrée : allumer les 3 cierges (C) → le pan de mur (S) derrière l'autel (A) coulisse.", "Dedans : le coffre des offrandes (x) et un cierge qui ne s'éteint jamais (lumière permanente).", "Après : la sacristie est un endroit sûr pour se reposer (aucun monstre n'y entre)."],
    },
  },
  {
    kicker: "Quête 03 — Krik, le Kobold qui ne sait plus mentir",
    title: "Rencontre 1 : le dortoir des traîtres",
    status: "EN JEU (2026-11-14) : les quatre missions et le dortoir des traîtres",
    lead: "Thomas : « quand il montre l'endroit où ses camarades dorment, ce n'est pas clair. Rends plutôt accessible une zone spéciale : une petite pièce, avec 3 Kobolds sur des paillasses avec une bougie, derrière un passage secret. »",
    choices: [
      { pick: "Proposer de le protéger", roll: "Charisme, moyen", goal: "« Ils dorment derrière la tapisserie du couloir. Ils me cherchent. » La tapisserie (T) s'allume sur la carte.", win: "Trancher ou soulever la tapisserie → le dortoir secret. SOUFFLER LA BOUGIE : noir complet, ils ne se réveillent plus au bruit ; prendre leurs trois bourses (15 à 30 or). Ou les attaquer endormis (avantage, la surprise).", fail: "Raté : il se méfie et montre la mauvaise tapisserie (un placard vide, une pomme)." },
      { pick: "Lui demander ses caches", roll: "Intelligence, moyen", goal: "« Sous la dalle du milieu, dans leur dortoir. » Il faut entrer et APPUYER sur la dalle (P).", win: "La dalle claque : une niche s'ouvre (or + objet). Mais le clac réveille un dormeur sur deux : jet de Discrétion ou combat.", fail: "Raté : la cache est vide, « je t'avais dit que j'étais malade, pas stupide »." },
      { pick: "Le menacer", roll: "Force, facile", goal: "Il s'enfuit dans le dortoir et réveille tout le monde : TENIR LE PASSAGE.", win: "Les trois Kobolds sortent un par un par la tapisserie : celui qui attend à côté du passage a l'avantage (embuscade). Leur butin tombe.", fail: "Raté : ils sortent tous les trois en même temps (pas d'avantage)." },
      { pick: "Lui apprendre à faire diversion", roll: "Agilité, moyen", goal: "PROTÉGER KRIK 3 tours pendant qu'il vide le dortoir : lancer la fiole de fumée qu'il vous donne au bon moment.", win: "Krik ressort avec le magot : 2 fioles de fumée + une part (10 or).", fail: "Raté : il crie sa trahison ; deux Kobolds réveillés vous chargent." },
    ],
    zone: {
      name: "Zone : le dortoir des traîtres (derrière une tapisserie)",
      map: ["#########", "#,,,,,,,#", "#,p,p,p,#", "#,k,k,k,#", "#,,,c,,,#", "#,,,P,,,#", "####T####", "#...r...#", "#.......#"],
      how: ["Entrée : la tapisserie (T) du couloir, signalée par Krik (r).", "Dedans : trois paillasses (p), trois Kobolds endormis (k), une bougie (c), une dalle à pression (P) qui cache le magot.", "Souffler la bougie : le noir ; les dormeurs n'entendent plus rien, mais le héros ne voit plus qu'à 1 case."],
    },
  },
  {
    kicker: "Quête 03 — Krik",
    title: "Rencontres 2 et 3 : des missions de marchand",
    choices: [
      { pick: "Lui faire mentir aux monstres", goal: "Il a besoin d'un témoin : RAMENER UN KOBOLD VIVANT jusqu'à lui (le pousser, l'attirer).", win: "Krik lui raconte n'importe quoi : tous les monstres de l'étage perdent votre trace, alerte −20." },
      { pick: "Le dénoncer", goal: "Montrer sa cachette à ses anciens camarades : faire venir un Kobold JUSQU'À LUI sans qu'il vous voie (rester caché).", win: "Prime de 20 à 30 or ; Krik s'en souviendra." },
      { pick: "Investir 20 or", goal: "Escorter son coursier, un petit Kobold, jusqu'à l'escalier (il fuit tout ce qui bouge).", win: "À l'étage suivant : 40 or ; perdu une fois sur trois." },
    ],
  },
  {
    kicker: "Quête 05 — Grum, le Kobold fermier (nouvelle)",
    title: "La ferme et la grange",
    status: "EN JEU (2026-11-14) : Grum dans la ferme, trois missions (poule, grange, chapeau)",
    lead: "Dans la FERME (salle spéciale, en jeu). Grum ne parle qu'à ceux qui ne marchent pas dans son pré.",
    choices: [
      { pick: "« Ma poule aux œufs d'or s'est sauvée »", roll: "Charisme, facile", goal: "La retrouver dans l'étage et la RAMENER : elle détale si on approche à découvert ; il faut l'approcher CACHÉ, puis la pousser vers la ferme.", win: "Une poule rentrée → l'ŒUF D'OR (vendu 60 or chez le Colporteur, ou couvé : une poule vous suit et picore les pièges cachés).", fail: "Raté : elle s'est cachée dans un tonneau ; le pousser la fait sortir." },
      { pick: "« Des voleurs de foin dans ma grange »", roll: "Force, moyen", goal: "Pousser la grosse botte de foin (h) qui bouche la grange : deux Kobolds dedans.", win: "Les chasser → la FOURCHE de Grum (arme à deux mains, allonge 2)." },
      { pick: "« Mon épouvantail a perdu son chapeau »", goal: "Lui POSER un casque (n'importe lequel) sur la tête : Jeter un casque sur la case de l'épouvantail.", win: "Grum est ravi : il vous offre le CASQUE POULET (+1 CA, les poules vous suivent)." },
    ],
    zone: {
      name: "Zone : la grange (derrière la botte de foin)",
      map: ["#########", "#,,h,,h,#", "#,K,,,K,#", "#,,,e,,,#", "####h####", "#..f..m.#", "#.......#", "#...@...#"],
      how: ["Entrée : POUSSER la botte de foin (h) qui bouche la porte.", "Dedans : deux Kobolds voleurs de foin (K) et un œuf d'or (e) oublié.", "Après : la grange est un abri : se cacher dans le foin réussit toujours."],
    },
  },
  {
    kicker: "Quête 04 — Fifrelin, le Kobold aux gobelets (EN JEU)",
    title: "Le tripot derrière le rideau",
    choices: [
      { pick: "Observer le jeu des gobelets", roll: "Agilité", goal: "Trouver qui triche : un Kobold complice se cache dans la salle (le repérer en fouillant).", win: "Le complice démasqué → on gagne la mise ×2." },
      { pick: "Analyser les règles", roll: "Intelligence", goal: "Récupérer le « vrai » gobelet : il est dans le coffre de son tripot, derrière un rideau.", win: "Le gobelet truqué en main, on peut le faire perdre à son propre jeu." },
      { pick: "Renverser la table", roll: "Force", goal: "Les deux gardes accourent : tenir la porte du tripot (embrasure).", win: "La caisse du tripot (or) ; Fifrelin part, vexé." },
    ],
  },
  {
    kicker: "Pièces secrètes — EN JEU (2026-11-14)",
    title: "Un mur qui sonne creux",
    status: "EN JEU : 1 étage sur 2 (C) ; salle d'essai : la salle « Pièce secrète ? », à droite de la prison",
    bullets: [
      "OÙ : là où une surface de roche est entourée de murs contre une salle ordinaire, une petite pièce est taillée, MURÉE.",
      "LES MURS : 3 à 7 briques manquantes et petits creux par étage, au hasard. Un seul creux, sur le mur de la pièce secrète, laisse VOIR DERRIÈRE : à 3 cases, on aperçoit quelques cases de l'autre côté (journal : « Par un creux du mur, vous apercevez… une pièce »).",
      "L'OUVRIR : FOUILLER la salle voisine. Réussi, le pan de mur cède. Raté : on peut refouiller cette salle (pas les autres). Avoir entrevu la pièce donne +5 à la fouille.",
      "DEDANS : un COFFRE D'ACIER (un objet RARE à coup sûr, l'or doublé), des piles d'or, et selon le plan : statues, armures, présentoir.",
    ],
  },
  {
    kicker: "Pièces secrètes — les quatre plans (EN JEU, à choisir ou compléter)",
    title: "Trésor muré · Armurerie oubliée",
    zone: {
      name: "1. Le trésor muré (5 × 3) — 2. L'armurerie oubliée (5 × 3), séparés par un mur",
      map: ["#############", "#s,X,s#R,X,R#", "#$,,,$#V,,,$#", "#,,,,,#,,,,,#", "###=H###H=###", "#...........#", "#...@.......#"],
      how: ["Le trésor : deux statues de chevalier gardent le coffre d'acier ; deux piles d'or devant.", "L'armurerie : deux armures, un présentoir (calice et pièces), le coffre d'acier.", "H : le creux qui laisse voir dedans ; = : le pan de mur qui cède quand on fouille la salle."],
    },
  },
  {
    kicker: "Pièces secrètes — les quatre plans (suite)",
    title: "Reliquaire · Cache du contrebandier",
    zone: {
      name: "3. Le reliquaire (5 × 4) — 4. La cache du contrebandier (3 × 3)",
      map: ["###########", "#s,X,s#bXZ#", "#,,V,,#$,,#", "#$,,,$#,,,#", "#,,,,,##=H#", "###H=###..#", "#.........#", "#...@.....#"],
      how: ["Le reliquaire : le présentoir au milieu, deux statues, le coffre au fond.", "La cache du contrebandier : tonneau, caisses, le coffre entre les deux, une pile d'or.", "Idées pour la suite : un squelette d'aventurier muré avec son journal ; une pièce murée par les Kobolds avec un Kobold coincé dedans depuis des années."],
    },
  },
  {
    kicker: "Nouvelle salle à thème — LA PRISON (EN JEU, 2026-11-14)",
    title: "Alcôves, grilles, chaînes",
    status: "EN JEU (dessins à valider : art/secret_prison_v1.png) ; salle d'essai : à droite de la nichée de la Tisseuse",
    zone: {
      name: "La prison (7 × 6 au moins), carreaux sombres",
      map: ["###########", "##,#,#,#,##", "##G#O#G#O##", "#.........#", "#.u.......#", "#.......D.#", "#.@.......#", "###########"],
      how: ["3 à 6 ALCÔVES d'une case contre le mur du fond, séparées par des cloisons ; une GRILLE devant chacune, au moins une ouverte.", "Dans les cellules : des chaînes au mur, de la paille, des os ou un seau. Dans la salle : le BUREAU du geôlier et son registre, une chaise, un seau qui traîne (souvent renversé), des ANNEAUX et des chaînes scellés dans les murs de côté.", "Cache de la salle : or, torche, pomme."],
    },
  },
  {
    kicker: "Quête 06 — PROPOSITION : Plumeau, le greffier enchaîné",
    title: "« Je n'ai fait qu'écrire leurs contrats »",
    lead: "Un vieux greffier de Leutenheim, maigre, lunettes rondes, plume derrière l'oreille, enchaîné dans une alcôve fermée. Les Kobolds l'ont enfermé parce qu'il avait rédigé leurs contrats… et qu'ils n'ont pas aimé les petites lignes. Il sait des choses sur l'étage : il a tout noté dans le REGISTRE du bureau.",
    choices: [
      { pick: "Prendre la clef au geôlier", roll: "Agilité (discrétion), moyen", goal: "Le geôlier (un Kobold) dort sur le bureau, la clef à la ceinture : s'approcher caché et la prendre sans le réveiller.", win: "La grille s'ouvre ; Plumeau, libre, MONTRE LA PIÈCE SECRÈTE de l'étage (« Ils ont muré quelque chose, là. J'ai entendu la truelle. »).", fail: "Le geôlier se réveille et crie : +10 d'alerte, il faut le vaincre ; la clef tombe." },
      { pick: "Forcer la grille", roll: "Force, dur", goal: "Arracher la grille à mains nues (la Bousculade aide). Chaque essai fait du bruit (+5 d'alerte).", win: "CLANG ! La grille cède. Plumeau donne son trésor caché dans la paille (une gemme).", fail: "Raté : la grille tient ; le bruit réveille le geôlier." },
      { pick: "Lire le registre", roll: "Intelligence, moyen", goal: "Le registre du bureau note le mot de passe des gardes ; le dire au geôlier.", win: "« C'est bon, c'est bon… » Le geôlier ouvre lui-même. Plumeau, reconnaissant, rédige un FAUX LAISSEZ-PASSER : un Kobold qui vous voit passe son chemin une fois.", fail: "Raté : le mot était faux ; le geôlier rit et vous enferme… dehors (rien ne se passe, la grille reste close, il faut une autre voie)." },
      { pick: "Le laisser là", goal: "« Revenez quand vous aurez une conscience. » Il note votre nom dans le registre.", win: "À la rencontre suivante (un autre étage), il vous a précédé : les gardes vous attendent (mauvaise surprise, 2 Kobolds)." },
    ],
    zone: {
      name: "La scène : la prison, le geôlier endormi au bureau, Plumeau dans une alcôve fermée",
      map: ["###########", "##,#q#,#,##", "##O#G#G#O##", "#.........#", "#.......jD#", "#.u.......#", "#..@......#", "###########"],
      how: ["Plumeau ne se trouve que dans une prison (1 sur 3, C).", "Le geôlier dort assis au bureau ; le registre se lit en le touchant (un tour).", "Dessin proposé : art/secret_prison_v1.png (plumeau0, plumeau1). À valider avant de coder."],
    },
  },
  {
    kicker: "Objets fun déjà en jeu",
    title: "Les petites scènes qui marchent déjà",
    gallery: [
      { sprite: () => find("Cloche à vache", "bell"), label: "Cloche à vache", note: "CLONC ! +25 d'alerte et le journal se moque." },
      { sprite: () => find("Salle de bain du Kobold", "tub"), label: "Bain du Kobold", note: "Il dort dans sa mousse ; le disque joue. Il bondit, savonneux." },
      { sprite: () => find("Personnages", "Le poulet"), label: "Le poulet", note: "Il panique, défonce la porte, s'écrase : nuage de plumes, cuisse." },
      { sprite: () => find("Ferme", "scarecrow"), label: "La ferme", note: "Le pré clos, les poules qui se promènent." },
      { sprite: () => find("Statues", "statueCracked"), label: "Statue creuse", note: "Gluck en parle : on la brise, un objet plus rare." },
      { sprite: () => find("Autel à la pomme dorée", "full"), label: "Autel à la pomme dorée", note: "Soin complet et bénédiction, une fois." },
      { sprite: () => find("Cuisine, prière, torture", "maiden"), label: "Sarcophage à pointes", note: "Désamorcer ou forcer ; un squelette et son butin." },
      { sprite: () => find("Personnages", "Le Colporteur"), label: "Le Colporteur", note: "6 articles ; il se cache quand un monstre approche." },
      { sprite: () => find("Assiette", "plateFull"), label: "La cuisse sur la table", note: "Dans chaque cuisine, une assiette sur la table." },
    ],
  },
  {
    kicker: "Combat",
    title: "L'avantage, règle centrale (EN JEU depuis cette nuit)",
    bullets: [
      "SURPRISE : contre un monstre qui ne vous a pas remarqué.",
      "À TERRE : la poussée peut renverser (toujours contre un mur) ; il perd son tour, et on le frappe avec l'avantage. Bulle : un tourbillon rouge qui tourne.",
      "EMBRASURE : contre qui se tient dans une porte (et vous non).",
      "EMBUSCADE : vous n'avez pas bougé, l'ennemi débouche d'un angle, d'une porte ou d'une colonne d'où il ne vous voyait pas. Tourner autour d'un poteau, passer une porte et attendre derrière : ça marche, et ça marche aussi pour eux.",
      "JAMAIS LES DEUX CAMPS : si chacun a une raison, elles s'annulent (sauf celui qui est à terre). Jamais deux avantages de suite sur la même cible.",
      "Anneau doré sous un monstre : vous avez l'avantage. Anneau rouge autour de vous : c'est lui.",
    ],
  },
  {
    kicker: "Combat — propositions pour encourager la mobilité",
    title: "Bouger doit payer (à choisir)",
    bullets: [
      "ÉLAN : frapper juste après avoir fait 2 pas en ligne droite : +2 dégâts (une charge). On ne reste pas planté.",
      "REPLI : reculer d'une case sans attaque d'opportunité si l'on n'a pas frappé ce tour (pas besoin du jet de Se dégager) — mais l'ennemi garde l'initiative.",
      "COUP DE BOUCLIER / D'ÉPAULE : pousser coûte un demi-tour si l'on vient de bouger.",
      "LE MUR PUNIT : pousser un ennemi contre un autre ennemi : les deux tombent à terre.",
      "PIÈGES ET TERRAIN : pousser dans une flaque (glisse d'une case de plus), dans le feu, sur un piège caché déjà repéré.",
      "LES MONSTRES AUSSI BOUGENT : un Kobold qui recule derrière une porte pour vous y attendre (ils connaissent la règle d'embuscade).",
    ],
  },
  {
    kicker: "Et maintenant",
    title: "Ce qui est en jeu (2026-11-14)",
    bullets: [
      "FAIT : les briques (tapisserie à trancher, tonneau creux et botte de foin à pousser, mur qui coulisse, bougie à souffler, cierges à rallumer, dalle à pression, grilles, paillasses) ; planche art/zones_v1.png.",
      "FAIT : la zone se taille dans la roche contre une salle quand la quête est donnée, près du PNJ ; son entrée apparaît sur la carte.",
      "FAIT : Krik (dortoir des traîtres : vider, dalle, tenir le passage, diversion), Gluck (cellier : sac, piste de pommes, vol en douce), Sœur Osseuse (cierges et sacristie, grilles, cloche de fortune ; punir reste), Grum (poule d'or, grange, chapeau de l'épouvantail).",
      "FAIT : les rencontres 2 à 4 (missions courtes : rival, coursier, témoin…), Fifrelin et son tripot derrière le rideau.",
      "RESTE : apprendre ces missions aux joueurs automatiques ; les rencontres 2 à 4 de Sœur Osseuse.",
    ],
  },
];

// ---------- Affichage ----------

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = "", text = ""): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text) e.textContent = text;
  return e;
};

function zoneView(map: string[]): HTMLElement {
  const wrap = el("div", "zone");
  const cell = 34;
  const c = document.createElement("canvas");
  const w = Math.max(...map.map((r) => r.length));
  c.width = w * cell;
  c.height = map.length * cell;
  const ctx = c.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  const used = new Set<string>();
  map.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const L = LEGEND[ch] ?? LEGEND["."];
      const floor = L.floor ?? (ch === ch.toLowerCase() && map.some((r) => r.includes(",")) && isInsideZone(map, x, y) ? "#5a4a42" : "#4a4658");
      ctx.fillStyle = ch === "#" ? LEGEND["#"].floor! : floor;
      ctx.fillRect(x * cell, y * cell, cell, cell);
      if (ch !== "#") {
        ctx.strokeStyle = "rgba(0,0,0,0.25)";
        ctx.strokeRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
      }
      const sp = L.sprite?.();
      if (sp) {
        const img = draw(sp.rows, sp.palette, 2);
        const s = Math.min(cell / img.width, cell / img.height) * (img.width > 16 * 2 ? 1 : 1);
        const dw = img.width * s;
        const dh = img.height * s;
        ctx.drawImage(img, x * cell + (cell - dw) / 2, y * cell + (cell - dh), dw, dh);
      }
      if (ch !== "." && ch !== "#" && ch !== ",") used.add(ch);
    });
  });
  wrap.append(c);
  const legend = el("div", "legend");
  for (const ch of used) {
    const L = LEGEND[ch];
    if (!L) continue;
    legend.append(el("span", "", `${ch} : ${L.label}`));
  }
  wrap.append(legend);
  return wrap;
}

function isInsideZone(map: string[], x: number, y: number): boolean {
  // Une case est « dans la zone » si une virgule est sur sa ligne.
  return map[y].includes(",") && x >= 0;
}

const deck = document.getElementById("app")!;
const stage = el("div", "stage");
const nav = el("div", "nav");
const prev = el("button", "", "‹");
const next = el("button", "", "›");
const count = el("span", "count");
const dots = el("div", "dots");
nav.append(prev, count, next);
deck.append(stage, nav, dots);
let index = 0;

function slideView(s: Slide): HTMLElement {
  const sec = el("section", "slide");
  if (s.kicker) sec.append(el("div", "kicker", s.kicker));
  sec.append(el("h1", "", s.title));
  if (s.status) sec.append(el("div", "status", s.status));
  if (s.lead) sec.append(el("p", "lead", s.lead));
  if (s.bullets) {
    const ul = el("ul", "bullets");
    for (const b of s.bullets) ul.append(el("li", "", b));
    sec.append(ul);
  }
  if (s.choices) {
    const list = el("div", "choices");
    for (const c of s.choices) {
      const card = el("div", "choice");
      const head = el("div", "pick", c.pick);
      if (c.roll) head.append(el("span", "roll", c.roll));
      card.append(head, el("div", "goal", "🎯 " + c.goal), el("div", "win", "✔ " + c.win));
      if (c.fail) card.append(el("div", "fail", "✖ " + c.fail));
      list.append(card);
    }
    sec.append(list);
  }
  if (s.zone) {
    const z = el("div", "zonebox");
    z.append(el("h2", "", s.zone.name), zoneView(s.zone.map));
    const ul = el("ul", "how");
    for (const h of s.zone.how) ul.append(el("li", "", h));
    z.append(ul);
    sec.append(z);
  }
  if (s.gallery) {
    const g = el("div", "gallery");
    for (const it of s.gallery) {
      const sp = it.sprite();
      const card = el("div", "gcard");
      if (sp) card.append(spriteCanvas(sp, 4));
      card.append(el("b", "", it.label));
      if (it.note) card.append(el("small", "", it.note));
      g.append(card);
    }
    sec.append(g);
  }
  return sec;
}

function show(i: number): void {
  index = Math.max(0, Math.min(SLIDES.length - 1, i));
  stage.replaceChildren(slideView(SLIDES[index]));
  stage.scrollTop = 0;
  count.textContent = `${index + 1} / ${SLIDES.length}`;
  dots.replaceChildren();
  SLIDES.forEach((s, k) => {
    const d = el("button", k === index ? "on" : "", "");
    d.title = s.title;
    d.onclick = () => show(k);
    dots.append(d);
  });
}
prev.onclick = () => show(index - 1);
next.onclick = () => show(index + 1);
document.addEventListener("keydown", (e) => {
  if (e.key === "ArrowRight") show(index + 1);
  if (e.key === "ArrowLeft") show(index - 1);
});
let touchX: number | null = null;
stage.addEventListener("touchstart", (e) => (touchX = e.touches[0].clientX), { passive: true });
stage.addEventListener("touchend", (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  if (Math.abs(dx) > 60) show(index + (dx < 0 ? 1 : -1));
  touchX = null;
});
show(0);
