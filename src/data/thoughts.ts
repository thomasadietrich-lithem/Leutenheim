/**
 * PENSÉES DU HÉROS (Thomas, 2026-11-26 : « le héros réagit ») : en entrant pour la première fois dans une salle qui
 * contient l'un de ces meubles, il pense tout haut (une bulle au-dessus de sa tête). Une pensée à la fois, et pas plus
 * d'une toutes les `THOUGHT_GAP_MS`. Dans l'ordre : la première qui convient l'emporte.
 */
export const THOUGHTS: readonly { kinds: readonly string[]; text: string }[] = [
  { kinds: ["feuCamp"], text: "Un feu… et des ronflements." },
  { kinds: ["trouPoulets", "statueHen", "expoPoulet", "tableauPoulet", "autelPoulet"], text: "Ça sent le poulet…" },
  { kinds: ["puitsVoeux"], text: "Un puits à vœux. Il me reste de la monnaie ?" },
  { kinds: ["miroir"], text: "Mon reflet me regarde de travers." },
  { kinds: ["champiFestin"], text: "Un festin… et on ne m'a pas invité." },
  { kinds: ["tableCarte"], text: "Une carte ! Enfin un peu d'ordre." },
  { kinds: ["ciergeCrypte"], text: "Des cierges éteints. Brr." },
  { kinds: ["tombeHeros"], text: "Je le connaissais, celui-là…" },
  { kinds: ["tub"], text: "Quelqu'un prend un bain ?" },
  { kinds: ["forge", "anvil"], text: "Ça sent le charbon et le fer." },
  { kinds: ["piano", "harpe", "tambour"], text: "Des instruments… ici ?" },
  { kinds: ["alambic"], text: "Ça bouillonne là-dedans." },
  { kinds: ["skeleton"], text: "Lui, il n'a pas eu de chance." },
  { kinds: ["webTL", "webTR", "webBL", "webBR"], text: "Des toiles… je n'aime pas ça." },
  { kinds: ["morelRowA", "morelRowB", "morelRowC"], text: "Ça sent l'humus." },
  { kinds: ["bunkA", "bunkB"], text: "Des lits. On dort, ici." },
];

/** Pensée quand des monstres endormis sont en vue (et qu'aucun meuble n'a déjà inspiré le héros). */
export const THOUGHT_SLEEPERS = "Chut… ils dorment.";
/** Après un combat gagné à l'arme de corps à corps. */
export const THOUGHT_WIPE = "*essuie sa lame*";
/** Écart minimal entre deux pensées. */
export const THOUGHT_GAP_MS = 20000;
