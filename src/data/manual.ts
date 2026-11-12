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
  {
    title: "Attaque d'opportunité",
    intro: "S'éloigner d'un monstre qui vous a repéré lui offre un coup gratuit, et votre déplacement s'arrête.",
    entries: [
      { title: "Passer une porte", lines: ["En y entrant ou en en sortant : pas de coup."] },
      { title: "Se dégager", lines: ["Dans la barre d'actions : un saut de deux cases, sans coup. Il faut réussir un jet d'Agilité."] },
    ],
  },
  {
    title: "Cloches et alerte",
    intro: "Chaque étage a son niveau d'alerte : la cloche en haut de l'écran. Le temps et le bruit le font monter.",
    entries: [
      { title: "Le bruit", lines: ["Une porte enfoncée, le gravier, l'eau, les coups échangés."] },
      { title: "Les paliers", lines: ["La cloche sonne à chaque palier.", "Agité, puis Alerte : des renforts arrivent, de plus en plus vite.", "Traque : tout l'étage sait où vous êtes."] },
      { title: "La cloche d'alarme", lines: ["Sur certains étages, une cloche sur son support. La sonner : l'alerte grimpe d'un palier et les monstres alentour accourent."] },
      { title: "Toucher la cloche du haut", lines: ["Elle dit ce que fait le palier en cours."] },
    ],
  },
];
