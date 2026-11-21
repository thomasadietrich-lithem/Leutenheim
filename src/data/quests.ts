/**
 * Tâches des quêtes (Thomas, 2026-11-12 : « une logique de task dans les quêtes, pas juste un dialogue ; les quêtes
 * génèrent des objectifs en fonction des choix de dialogue ; les objectifs ne sont pas accessibles avant la quête ;
 * retourner chez la personne qui t'a donné la quête »).
 *
 * Un choix de dialogue réussi peut donner UNE tâche. Le PNJ reste alors sur l'étage et attend le héros. Une seule tâche
 * à la fois ; descendre sans être revenu la fait rater. Le bandeau sous les jauges montre l'objectif.
 *
 * - kill : vaincre des Kobolds de l'étage (Kobolds et frondeurs) ;
 * - fetch : rapporter un objet qui n'apparaît sur l'étage qu'une fois la tâche donnée ;
 * - statue : briser la statue creuse de l'étage.
 */
import type { ItemId } from "./items";

export type QuestTaskId =
  | "gluck_sac"
  | "gluck_statue"
  | "gluck_piste"
  | "gluck_vol"
  | "soeur_kobolds"
  | "soeur_cierges"
  | "soeur_grille"
  | "soeur_cloche"
  | "krik_magot"
  | "krik_traqueurs"
  | "krik_dortoir"
  | "krik_passage"
  | "krik_diversion"
  | "gluck_rival"
  | "gluck_local"
  | "gluck_banc"
  | "krik_temoin"
  | "krik_denonce"
  | "krik_coursier"
  | "grum_poule"
  | "grum_foin"
  | "grum_chapeau"
  | "morillon_arrosage"
  | "vernis_poulet"
  | "vernis_socle"
  | "maestro_partition"
  | "plumeau_clef"
  | "clavicule_cranes"
  | "osselet_corne"
  | "clavicule_cierges";

export interface QuestTaskDef {
  npc: "gluck" | "soeur" | "krik" | "grum" | "fifrelin" | "morillon" | "vernis" | "maestro" | "plumeau" | "clavicule" | "osselet";
  /** Quête « kill » : ce qui compte (les Kobolds par défaut ; les squelettes brisés pour Sœur Clavicule). */
  targets?: "squelettes";
  /** kill : vaincre ; fetch : rapporter ; statue : briser ; smoke : enfumer ; enter : entrer dans la zone ; count : un
   * compteur tenu par la partie (cierges, tours sur la grille, chapeau) ; collect : rapporter plusieurs objets. */
  kind: "kill" | "fetch" | "statue" | "smoke" | "enter" | "count" | "collect";
  /** collect : les objets à rapporter. */
  items?: ItemId[];
  /** kill : combien de Kobolds (au plus ceux de l'étage). */
  count?: number;
  /** Quêtes v3 : la tâche se joue dans la ZONE SPÉCIALE de la quête (seuls ses Kobolds comptent). */
  zone?: boolean;
  /** fetch : l'objet à rapporter. */
  item?: ItemId;
  /** Le bandeau pendant la tâche ({0} : où on en est, {1} : le total). */
  goal: string;
  /** Le bandeau quand c'est fait : revenir voir le PNJ. */
  back: string;
  /** Ce que dit le PNJ si on revient trop tôt. */
  waiting: string;
  /** Ce qu'il dit quand on revient, la tâche faite (avant de partir dans un « Pouf ! »). */
  thanks: string[];
  /** Le journal, si on descend sans être revenu. */
  failed: string;
}

export const QUEST_TASKS: Record<QuestTaskId, QuestTaskDef> = {
  gluck_sac: {
    npc: "gluck",
    kind: "fetch",
    item: "sac_pommes",
    zone: true,
    goal: "Retrouver le sac de Gluck",
    back: "Rendre le sac à Gluck",
    waiting: "« Mon sac est quelque part sur l'étage. Je t'attends ici. Je ne bouge pas. Promis. »",
    thanks: ["« MON SAC ! Tu l'as rapporté ! »", "« On partage : trois pour toi. Bon… deux. Allez, trois. »", "(Il laisse 3 pommes.)"],
    failed: "Quelque part au-dessus, Gluck attend toujours son sac de pommes.",
  },
  gluck_statue: {
    npc: "gluck",
    kind: "statue",
    goal: "Briser la statue creuse",
    back: "Revoir Gluck",
    waiting: "« La statue ! Un bon coup, et hop ! Moi, je surveille. »",
    thanks: ["« Alors ? Il y avait quoi ? … Garde tout. Les cailloux, ça me fait peur. »", "« Une pomme pour le travail, une pour le courage. »", "(Il laisse 2 pommes.)"],
    failed: "Gluck ne saura jamais ce que cachait la statue.",
  },
  // ---- Quêtes v3 (Thomas, 2026-11-13/14 : « chaque option de dialogue présente un objectif à réaliser ») ----
  gluck_piste: {
    npc: "gluck",
    kind: "enter",
    zone: true,
    goal: "Suivre la piste de pommes",
    back: "Parler à Gluck, dans son cellier",
    waiting: "« N-ne me fais pas mal ! Je… je t'attends. Ici. Caché. »",
    thanks: ["« Tu m'as trouvé. Évidemment. Les pommes… quelle idée de semer des pommes. »", "« Prends-en deux. Et va-t'en. S'il te plaît. »", "(Il laisse 2 pommes.)"],
    failed: "Gluck tremble encore dans son cellier.",
  },
  gluck_vol: {
    npc: "gluck",
    kind: "fetch",
    item: "sac_pommes",
    zone: true,
    goal: "Voler le sac de Gluck sans le réveiller",
    back: "Filer avec le sac",
    waiting: "(Il dort, la joue sur son sac. Surtout, ne pas le réveiller.)",
    thanks: ["(Le sac est à vous : 4 pommes.)"],
    failed: "Gluck se réveille un jour, et son sac n'est plus là. Il saura.",
  },
  soeur_cierges: {
    npc: "soeur",
    kind: "count",
    count: 3,
    goal: "Rallumer les cierges {0}/{1}",
    back: "Revoir Sœur Osseuse",
    waiting: "« Trois cierges. Les Kobolds les ont soufflés. Il vous faut une flamme : une torche fera l'affaire. »",
    thanks: ["« La lumière revient. Et derrière l'autel, le mur a bougé ? … La sacristie ! Je l'avais oubliée. »", "« Allez en paix, mon enfant. »", "(Protection : +1 classe d'armure pendant 150 tours.)"],
    failed: "Les cierges de Sœur Osseuse restent éteints.",
  },
  soeur_grille: {
    npc: "soeur",
    kind: "count",
    count: 2,
    goal: "Écouter sur la bonne grille {0}/{1}",
    back: "Revoir Sœur Osseuse",
    waiting: "« Trois grilles dans le sol. Une seule chante. Tenez-vous dessus, et écoutez. Longtemps. Deux tours, au moins. »",
    thanks: ["« Vous l'avez entendue ? Ma cloche. En bas. »", "« Alors allez-y. Je vous montre le chemin. »", "(L'escalier apparaît sur la carte. Clarté : le poison vous ronge deux fois moins longtemps, sur cet étage.)"],
    failed: "La cloche sonne encore, quelque part sous vos pieds.",
  },
  soeur_cloche: {
    npc: "soeur",
    kind: "collect",
    items: ["marmite", "louche", "corde"],
    goal: "Rapporter marmite, louche et corde {0}/{1}",
    back: "Revoir Sœur Osseuse",
    waiting: "« Une marmite, une louche, une corde. Avec ça, je vous fais une cloche. Presque. »",
    thanks: ["Elle pend la marmite, accroche la louche au bout de la corde. CLONC.", "« … Elle sonne faux. Elle est PARFAITE. »", "(Chance : vos 3 prochains 1 au dé seront relancés.)"],
    failed: "Sœur Osseuse n'aura pas sa cloche de fortune.",
  },
  // ---- Rencontres 2 à 4 (Thomas, 2026-11-14 : « continue les rencontres ») ----
  gluck_rival: {
    npc: "gluck",
    kind: "count",
    count: 3,
    goal: "Chasser le Kobold marchand {0}/{1}",
    back: "Revoir Gluck",
    waiting: "« Il vend des pommes moins cher que moi ! Pousse-le hors de sa salle. Trois fois. Sans le tuer : c'est un collègue. »",
    thanks: ["« Il est parti ? Ha ! La concurrence, c'est terminé. »", "« Pour toi, désormais : la pomme à 3 pièces. Pour toujours. Enfin, pour cette partie. »"],
    failed: "Le Kobold marchand vend toujours ses pommes moins cher.",
  },
  gluck_local: {
    npc: "gluck",
    kind: "count",
    goal: "Libérer une salle pour l'étal de Gluck {0}/{1}",
    back: "Revoir Gluck",
    waiting: "« Il me faut un local. Celle-là, sur la carte. Sans locataires, si possible. »",
    thanks: ["« Un local ! Avec vue sur le donjon ! »", "« Premier bénéfice : pour toi. »", "(Il laisse de l'or et deux pommes.)"],
    failed: "Gluck n'aura jamais son étal.",
  },
  gluck_banc: {
    npc: "gluck",
    kind: "count",
    count: 5,
    goal: "Réfléchir à côté d'un banc {0}/{1}",
    back: "Revoir Gluck",
    waiting: "« Va t'asseoir près d'un banc. Réfléchis. Cinq tours. Sans monstre en vue, sinon ça ne compte pas. »",
    thanks: ["« Alors ? Tu as compris ? … Moi non plus. Mais ça fait du bien. »", "(Les pièges cachés de l'étage se montrent. Chance : vos 3 prochains 1 au dé seront relancés.)"],
    failed: "La réflexion de Gluck restera inachevée.",
  },
  krik_temoin: {
    npc: "krik",
    kind: "count",
    count: 1,
    goal: "Amener un Kobold jusqu'à Krik",
    back: "Revoir Krik",
    waiting: "« Il me faut un témoin. Un Kobold, vivant, ici, à côté de moi. Pousse-le, attire-le. »",
    thanks: ["Krik se tourne vers le Kobold : « L'aventurier ? Parti. Très loin. Il a peur de vous. »", "« … Ils m'ont cru ! »", "(Les monstres perdent votre trace ; l'étage se calme.)"],
    failed: "Krik n'a pas eu son témoin.",
  },
  krik_denonce: {
    npc: "krik",
    kind: "count",
    count: 1,
    goal: "Amener un Kobold jusqu'à Krik, caché",
    back: "Toucher la prime",
    waiting: "« Tu veux me dénoncer ? … Alors fais venir un de mes camarades ici. Sans qu'il te voie. Je ne peux pas t'en empêcher. »",
    thanks: ["« HÉ ! IL EST LÀ ! » crie le Kobold. Krik détale.", "Une bourse tombe à vos pieds : « La prime. Merci, l'humain. »"],
    failed: "Krik court toujours.",
  },
  krik_coursier: {
    npc: "krik",
    kind: "count",
    count: 1,
    goal: "Escorter le coursier jusqu'à l'escalier",
    back: "Revoir Krik",
    waiting: "« Mon coursier porte ta mise jusqu'à l'escalier. Il a peur de tout : reste près de lui, il n'avance qu'avec toi. »",
    thanks: ["« Il est passé ! Ta mise t'attend à l'étage suivant. Doublée. Je le pense vraiment. »"],
    failed: "Le coursier de Krik s'est perdu, avec votre mise.",
  },
  grum_poule: {
    npc: "grum",
    kind: "fetch",
    item: "poule_or",
    goal: "Ramener la poule aux œufs d'or",
    back: "Rendre la poule à Grum",
    waiting: "« Elle a peur de tout. Approche-la sans te montrer, et attrape-la. »",
    thanks: ["« MA POULE ! Ma Cocotte d'or ! »", "« Tiens, son dernier œuf. Il est en or. Vraiment en or. »", "(Il laisse un œuf d'or.)"],
    failed: "Quelque part, une poule d'or caquète toute seule.",
  },
  grum_foin: {
    npc: "grum",
    kind: "kill",
    count: 2,
    zone: true,
    goal: "Chasser les voleurs de foin {0}/{1}",
    back: "Revoir Grum",
    waiting: "« Ils sont dans ma grange, derrière la grosse botte. Pousse-la. »",
    thanks: ["« Ma grange ! Mon foin ! »", "« Prends ma fourche. Elle pique plus loin que ton épée. »", "(Il laisse sa fourche.)"],
    failed: "Les voleurs de foin dorment toujours dans la grange de Grum.",
  },
  grum_chapeau: {
    npc: "grum",
    kind: "count",
    count: 1,
    goal: "Coiffer l'épouvantail d'un casque",
    back: "Revoir Grum",
    waiting: "« Un casque. N'importe lequel. Pose-le-lui sur la tête. Il a froid, le pauvre. »",
    thanks: ["« Il est beau ! Il fait peur ! Enfin… il fait quelque chose. »", "« Tiens. Celui-là, je l'ai fait moi-même. »", "(Il laisse un casque poulet.)"],
    failed: "L'épouvantail de Grum a toujours froid.",
  },
  // Section 2 : Morillon, le Kobold cueilleur (Thomas, 2026-11-14). On longe ses rangs avec son arrosoir.
  morillon_arrosage: {
    npc: "morillon",
    kind: "count",
    goal: "Arroser les rangs de morilles {0}/{1}",
    back: "Revoir Morillon",
    waiting: "« Longe-les tous, hein. Une morille qui a soif, ça boude. »",
    thanks: [
      "« Regarde-les boire… On les entend presque. »",
      "« Tiens, des morilles. Mange-les, ne les vends pas : ça porte malheur. »",
      "(Il laisse 3 morilles.)",
    ],
    failed: "Les rangs de Morillon ont toujours soif.",
  },
  // Section 2 (Thomas, 2026-11-17/18) : Vernis, le Kobold conservateur du hall d'exposition. « Le chef-d'œuvre volé ».
  vernis_poulet: {
    npc: "vernis",
    kind: "fetch",
    item: "grand_poulet_or",
    goal: "Retrouver le Grand Poulet d'Or",
    back: "Rendre le Poulet à Vernis",
    waiting: "« Il brille. Il est lourd. Il a l'air vexé. Vous ne pouvez pas le rater. »",
    thanks: ["« Mon poulet ! Remis sur son socle, enfin. »", "« Voici un ticket d'exposition. Le Colporteur le respecte. Enfin, il le craint. »", "(Il laisse un ticket d'exposition.)"],
    failed: "Le socle du Grand Poulet d'Or reste vide.",
  },
  vernis_socle: {
    npc: "vernis",
    kind: "count",
    count: 3,
    goal: "Poser sur le socle vide {0}/{1}",
    back: "Revoir Vernis",
    waiting: "« Immobile. Digne. Comme un poulet de marbre. Trois tours sur le socle, sans bouger. »",
    thanks: ["« Magnifique ! Le public a cru à un chef-d'œuvre. »", "« Prenez ce pinceau. Il peint des choses qui n'existent pas. Comme vous. »", "(Il laisse un pinceau magique.)"],
    failed: "Le socle vide attend toujours sa statue.",
  },
  // Section 2 (Thomas, 2026-11-18) : le Maestro, chef d'orchestre de la salle de concert. « Retrouver la partition ».
  maestro_partition: {
    npc: "maestro",
    kind: "fetch",
    item: "partition",
    goal: "Retrouver la partition du Maestro",
    back: "Rendre la partition au Maestro",
    waiting: "« Sans partition, l'orchestre joue faux. Enfin, plus faux. »",
    thanks: ["« Ma symphonie ! Pour cloche et champignons ! »", "« Tenez, mon diapason. Il chante juste, lui. »", "(Il laisse un diapason.)"],
    failed: "Le Maestro dirige un orchestre qui joue sans partition.",
  },
  // Section 1, prison (quête 06, Thomas, 2026-11-18 : « oui ») : Plumeau, le greffier enchaîné.
  plumeau_clef: {
    npc: "plumeau",
    kind: "fetch",
    item: "cle_geolier",
    goal: "Trouver la clef du geôlier",
    back: "Libérer Plumeau",
    waiting: "« Le geôlier l'a laissée traîner. Il laisse tout traîner. Même moi. »",
    thanks: ["(La clef tourne. Les fers tombent.)", "« Libre ! Tenez, j'ai recopié le plan de l'étage. Les greffiers recopient tout. »", "(Il vous montre le plan de l'étage, et laisse un peu d'or.)"],
    failed: "Plumeau reste enchaîné à son mur.",
  },
  // Section 3, la chapelle des os (Thomas, 2026-11-19 : « Ok ») : Sœur Clavicule.
  osselet_corne: {
    npc: "osselet",
    kind: "fetch",
    item: "corne_triceratops",
    goal: "Retrouver la corne du tricératops",
    back: "Rendre la corne à Maître Osselet",
    waiting: "« Un culte qui vole des cornes. On aura tout vu. Cherchez une salle qui brille. »",
    thanks: ["« Ma corne ! Tricératops, de nouveau. »", "« Tenez : un fémur de la réserve, monté en massue. Les morts n'aiment pas les os plus gros qu'eux. »", "(Il vous donne une massue de tricératops.)"],
    failed: "Le tricératops du musée reste un bicératops.",
  },
  clavicule_cranes: {
    npc: "clavicule",
    kind: "kill",
    targets: "squelettes",
    count: 5,
    goal: "Briser des crânes {0}/{1}",
    back: "Revoir Sœur Clavicule",
    waiting: "« Brisez-leur le crâne : une masse, un coup bien placé, ou le feu. Sinon la lune les relève. »",
    thanks: ["« Je les entends se taire, un à un. »", "« Dormez, mes frères. » (Elle trace un signe sur votre front.)", "(Bénédiction du repos : sur cet étage, les squelettes abattus ne se relèvent plus.)"],
    failed: "Les morts de l'étage continuent de se relever.",
  },
  clavicule_cierges: {
    npc: "clavicule",
    kind: "count",
    count: 3,
    goal: "Rallumer les cierges d'argent {0}/{1}",
    back: "Revoir Sœur Clavicule",
    waiting: "« Trois cierges d'argent, soufflés par le culte. Une torche suffit pour les rallumer. »",
    thanks: ["« La chapelle sent de nouveau la cire. Merci. »", "« Prenez ceci : une goutte de nuit. Là où vous la versez, la lune ne voit plus rien. »", "(Elle vous donne une potion de nuit.)"],
    failed: "Les cierges d'argent restent froids.",
  },
  soeur_kobolds: {
    npc: "soeur",
    kind: "kill",
    count: 3,
    goal: "Punir des Kobolds {0}/{1}",
    back: "Revoir Sœur Osseuse",
    waiting: "« Je compte. Vous, vous frappez. »",
    thanks: [
      "« J'ai entendu leurs cris d'ici. C'était… édifiant. »",
      "« Allez en paix, mon enfant. Et avec un peu de chance. »",
      "(Protection : +1 classe d'armure pendant 150 tours. Chance : vos 3 prochains 1 au dé seront relancés.)",
    ],
    failed: "Sœur Osseuse attendait le récit de votre croisade. Elle ne l'aura pas.",
  },
  krik_magot: {
    npc: "krik",
    kind: "fetch",
    item: "magot_krik",
    zone: true,
    goal: "Retrouver le magot de Krik",
    back: "Rendre le magot à Krik",
    waiting: "« Le magot est là où je l'ai dit. Je ne mens pas : je ne peux pas. »",
    thanks: ["« Tout est là ! Même la pièce tordue. »", "« Moitié-moitié. Ta moitié est plus grosse. C'est vrai, je l'ai mesurée. »", "(Il laisse de l'or et un objet.)"],
    failed: "Vous gardez le magot de Krik : +{0} or. Quelque part, un Kobold qui ne sait pas mentir raconte partout que vous êtes un voleur.",
  },
  krik_traqueurs: {
    npc: "krik",
    kind: "kill",
    count: 2,
    goal: "Chasser les traqueurs {0}/{1}",
    back: "Revoir Krik",
    waiting: "« Ils sont encore là. Je les entends. C'est vrai. »",
    thanks: [
      "« Ils sont partis ? Vraiment ? … Je te crois. Je n'ai pas le choix, mais je te crois. »",
      "« Mes camarades dorment là, là et là. »",
      "(Les repaires des Kobolds de l'étage apparaissent sur la carte. Il laisse une pomme et un objet.)",
    ],
    failed: "Krik a dû fuir seul. Il racontera que vous l'avez abandonné. C'est vrai.",
  },
  // Quêtes v3 (Thomas, 2026-11-13/14 : « chaque option de dialogue présente un objectif à réaliser ») : le dortoir des
  // traîtres, derrière une tapisserie.
  krik_dortoir: {
    npc: "krik",
    kind: "kill",
    count: 3,
    zone: true,
    goal: "Vider le dortoir des traîtres {0}/{1}",
    back: "Revoir Krik",
    waiting: "« Ils dorment derrière la tapisserie. Souffle la bougie : dans le noir, ils n'entendent plus rien. C'est vrai. »",
    thanks: ["« Plus personne ne me cherche ? … Tu as fait ça pour moi ? »", "« Tiens. Ce n'est pas volé. Enfin, pas par moi. »", "(Il laisse de l'or et un objet.)"],
    failed: "Krik est resté seul avec ses traîtres derrière la tapisserie.",
  },
  krik_passage: {
    npc: "krik",
    kind: "kill",
    count: 3,
    zone: true,
    goal: "Tenir le passage {0}/{1}",
    back: "Revoir Krik",
    waiting: "« Ils sortent par la tapisserie. Un par un. Attends-les à côté : ils ne te verront qu'au dernier moment. »",
    thanks: ["« Tu les as tous eus ? … Je ne t'ai jamais menacé, hein. C'était une blague. Une vraie. »", "(Il laisse ce qu'ils avaient sur eux.)"],
    failed: "Krik a filé sans demander son reste.",
  },
  krik_diversion: {
    npc: "krik",
    kind: "smoke",
    zone: true,
    // Plus clair (Thomas, 2026-11-21 : « faire diversion, c'est pas clair ») : on dit QUOI faire et OÙ.
    goal: "Lancer une fiole de fumée sur la tapisserie",
    back: "Revoir Krik",
    waiting: "« La fiole de fumée ! Lance-la sur la tapisserie rouge, ou sur un traître qui en sort. Pendant qu'ils toussent, je me glisse dedans. »",
    thanks: ["« Ça a marché ! Ils toussaient tellement qu'ils ne m'ont pas vu. »", "« Le magot ! Ta part, et des fioles. Volées, évidemment. »", "(Il laisse de l'or et 2 fioles de fumée.)"],
    failed: "Krik attend toujours sa diversion.",
  },
};

/** Ce que garde la partie d'une tâche en cours. */
export interface QuestTask {
  id: QuestTaskId;
  /** L'étage où elle a été donnée (et où le PNJ attend). */
  depth: number;
  /** Où on en est, et combien il en faut. */
  got: number;
  need: number;
  /** Cloche de fortune : le jet était raté, elle fera un vacarme au moment de la monter. */
  noisy?: boolean;
  /** Morillon : on lui a bien parlé (il ajoute de l'or). */
  charmed?: boolean;
  /** Rencontres 2 à 4 : le monstre visé (le concurrent de Gluck), ou la salle à libérer (son numéro). */
  target?: number;
  /** Les zones que la quête montre sur la carte : elles brillent tant qu'elle dure (Thomas, 2026-11-17). */
  glow?: { x: number; y: number; w: number; h: number }[];
}
