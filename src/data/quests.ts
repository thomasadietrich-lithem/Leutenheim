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
  | "grum_poule"
  | "grum_foin"
  | "grum_chapeau";

export interface QuestTaskDef {
  npc: "gluck" | "soeur" | "krik" | "grum";
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
    goal: "Faire diversion devant le dortoir",
    back: "Revoir Krik",
    waiting: "« Lance la fumée sur eux quand ils sortent ! Moi, je me glisse dedans. »",
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
}
