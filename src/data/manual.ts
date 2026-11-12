/**
 * Le manuel du menu (Thomas, 2026-11-12 : « un onglet manuel, avec pour l'instant l'explication des caractéristiques,
 * et des avantages / désavantages »). Chaque entrée : un titre et quelques lignes courtes. Traduit par `en.ts`.
 */
export interface ManualEntry {
  title: string;
  lines: string[];
}

export interface ManualSection {
  title: string;
  intro?: string;
  entries: ManualEntry[];
}

export const MANUAL: ManualSection[] = [
  {
    title: "Caractéristiques",
    intro: "À chaque niveau, un point à placer dans l'une d'elles (hors combat).",
    entries: [
      { title: "Vie", lines: ["+4 points de vie maximum par point."] },
      {
        title: "Force",
        lines: ["+1 dégât au corps à corps par point.", "Aide à pousser, à enfoncer une porte et à déchirer une toile."],
      },
      {
        title: "Agilité",
        lines: [
          "+1 au tir par point.",
          "+1 classe d'armure tous les 2 points.",
          "Aide à se dégager, à crocheter une serrure et à éviter un piège.",
        ],
      },
      { title: "Intelligence", lines: ["La magie. Pas encore en jeu."] },
      { title: "Charisme", lines: ["Les quêtes et les marchands. Pas encore en jeu."] },
    ],
  },
  {
    title: "Avantage et désavantage",
    intro: "Une action se joue au d20 : le dé, plus un bonus, doit atteindre un seuil.",
    entries: [
      {
        title: "Avantage",
        lines: [
          "On lance deux d20 et on garde le meilleur.",
          "Contre un monstre qui ne vous a pas remarqué, ou pris dans une porte.",
          "Jamais deux fois de suite contre la même cible.",
        ],
      },
      {
        title: "Désavantage",
        lines: [
          "On lance deux d20 et on garde le pire.",
          "Tirer avec un ennemi au contact, ou sur une cible qu'on ne voit pas.",
          "Une pierre de fronde contre un héros abrité derrière une colonne ou un meuble.",
        ],
      },
      { title: "Les deux à la fois", lines: ["Ils s'annulent : un seul d20."] },
    ],
  },
];
