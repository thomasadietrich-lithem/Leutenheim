/**
 * Contenu de l'encyclopédie (Thomas, 2026-11-13 : « l'encyclopédie n'est pas complète ; vérifie-la à chaque
 * publication »). Le test « encyclopédie complète » (tests/sim.test.ts) échoue si un objet, un monstre, un personnage,
 * un piège ou un état du jeu n'y figure pas. Tout nouveau contenu doit donc avoir sa fiche ici (et sa traduction).
 */
import type { ItemDef } from "./items";
import type { TrapKind } from "./traps";

/** Rubriques des objets : chaque genre d'objet doit être rangé dans une rubrique. */
export const CODEX_ITEM_GROUPS: [string, ItemDef["kind"][]][] = [
  ["Armes de corps à corps", ["melee"]],
  ["Armes à distance et munitions", ["ranged", "ammo"]],
  ["Armures", ["armor"]],
  ["Heaumes", ["hat"]],
  ["Amulettes", ["amulet"]],
  ["Artefacts et bibelots", ["artifact"]],
  ["Sacs", ["bag"]],
  ["Potions et vivres", ["use"]],
  ["Pierres précieuses et or", ["gem", "gold"]],
  ["Divers", ["key", "quest"]],
];

/** Personnages (non hostiles) : découverts quand on les voit. `id` : celui de la partie (PNJ de quête) ou un nom à part. */
export const CODEX_PEOPLE: { id: string; name: string; color: string; description: string }[] = [
  { id: "gluck", name: "Gluck", color: "#e6dcc0", description: "Un Kobold déserteur, pâle et peureux, qui ne pense qu'aux pommes. Selon ce qu'on lui dit, il vend, donne, investit… ou confie une tâche." },
  { id: "soeur", name: "Sœur Osseuse", color: "#f4f7ff", description: "Une nonne squelette très digne, qui ignore qu'elle est morte. Les Kobolds lui ont volé sa cloche, celle qui réveillait Leutenheim. Elle bénit, ou maudit." },
  { id: "krik", name: "Krik", color: "#b48ce0", description: "Un Kobold qui ne peut plus mentir depuis une expérience ratée. Il a trahi ses camarades et vend leur butin." },
  { id: "grum", name: "Grum", color: "#f0d678", description: "Le Kobold fermier, chapeau de paille et salopette. Il garde sa ferme et ne parle qu'à ceux qui ne marchent pas dans son pré. Sa poule pond de l'or." },
  { id: "colporteur", name: "Le Colporteur", color: "#7a5aa0", description: "Un marchand voûté, un par section. Il achète et vend, et disparaît quand le donjon s'agite trop." },
  { id: "compteur", name: "Le Kobold qui compte", color: "#9cb63e", description: "Derrière une porte percée d'un trou, il répète son nombre. Ne regardez pas par le trou." },
  { id: "poulet", name: "Le poulet", color: "#f6f2e6", description: "Un poulet, seul, dans le donjon. Il ne faut pas lui parler : il panique, détale, et fonce droit dans la porte qu'aucune serrure ni aucun coup n'ouvre." },
  { id: "bain", name: "Le Kobold du bain", color: "#a8c8ec", description: "Il dort dans sa baignoire, en musique. Réveillé, il se bat à la serviette, puis s'enfuit en criant." },
];

/** Pièges : chacun a sa fiche (toujours visible). */
export const CODEX_TRAPS: Record<TrapKind, string> = {
  spikes: "Des pointes jaillissent de la dalle. Un bond d'Agilité permet parfois de l'éviter. Certains pièges sont cachés, de plus en plus en descendant : une fouille réussie de la salle les révèle.",
  pit: "La dalle cède : on tombe, on se blesse, et il faut un tour pour remonter.",
  needle: "Une aiguille empoisonnée : une piqûre, puis le poison pendant quelques tours.",
  gas: "Un nuage vert s'échappe de la grille : qui s'y tient est empoisonné.",
};

/** États (pictos en haut à gauche, bulles au-dessus des monstres) : chaque picto d'état a sa fiche. */
export const CODEX_STATES: { id: string; name: string; description: string }[] = [
  { id: "poison", name: "Empoisonné", description: "On perd des PV à chaque tour, pendant quelques tours." },
  { id: "feu", name: "En feu", description: "1d4 dégâts par tour. Sortir des flammes, ou marcher dans l'eau." },
  { id: "ralenti", name: "Englué ou ralenti", description: "Le prochain pas sert à se dégager ; un monstre ralenti ne joue qu'un tour sur deux." },
  { id: "sonne", name: "Sonné", description: "Le monstre perd son prochain tour." },
  { id: "cache", name: "Caché", description: "Les monstres ne vous remarquent qu'au contact. Première attaque avec l'avantage." },
  { id: "torche", name: "Torche allumée", description: "Vous éclairez autour de vous, mais on vous voit venir." },
  { id: "arme_poison", name: "Arme empoisonnée", description: "Vos coups qui portent empoisonnent." },
  { id: "beni", name: "Béni", description: "La pomme dorée de l'autel : +1 à l'attaque et +1 classe d'armure." },
  { id: "protection", name: "Protection", description: "La bénédiction de Sœur Osseuse : +1 classe d'armure." },
  { id: "clarte", name: "Clarté", description: "Le poison dure moitié moins longtemps, sur l'étage." },
  { id: "malediction", name: "Malédiction des Kobolds", description: "+2 dégâts contre les Kobolds, sur l'étage." },
  { id: "chance", name: "Chance", description: "Vos prochains 1 au dé sont relancés." },
  { id: "oursin", name: "Oursin", description: "Une part des dégâts reçus au contact revient à l'attaquant." },
  { id: "a_terre", name: "À terre", description: "Renversé par une poussée : il perd son tour à se relever, et on le frappe avec l'avantage." },
  { id: "geant", name: "Géant", description: "Potion de géant : deux fois plus grand quelques tours ; les coups font deux fois plus mal, mais on ne passe plus les portes. Marche aussi sur les monstres, le boss compris." },
  { id: "glissant", name: "Glissant", description: "Potion glissante : pour toujours. Chaque coup reçu fait glisser jusqu'au mur, où l'on rebondit et se cogne." },
  { id: "accelere", name: "Accéléré", description: "Chaque attaque au contact frappe deux fois." },
  { id: "pierre", name: "Statue ou pétrifié", description: "Potion de pierre : bue, rien ne vous blesse mais vous ne pouvez rien faire ; lancée, le monstre ne bouge plus et sert d'abri." },
  { id: "rempart", name: "Dernier rempart", description: "Un coup qui vous tuerait vous laisse debout." },
];
