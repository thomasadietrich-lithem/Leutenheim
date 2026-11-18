/**
 * SECTION 3, L'OSSUAIRE DE LA LUNE PÂLE : les PLANS DE SALLES (planche `art/ossuaire_salles_v1.png`, validée par Thomas le
 * 2026-11-18 : « valide, ça et des salles normales »). Des formes bâties par le culte (croix, rotonde, galerie, nef,
 * chapelle, cloître, puits), ni les rectangles de la section 1 ni les grottes de la section 2. Chaque étage de la section
 * en pose quelques-unes (`RULES.ossuairePlans`) parmi des salles ordinaires.
 *
 * Le bord du plan est le mur de la salle. Légende : # mur, . sol, n niche à crânes (dans le mur ; les os restent aux
 * murs, jamais en tas au sol), o colonne, L puits de lune (sol pour l'instant), s sarcophage, g gisant, c cierge,
 * a autel (3 cases, centré sur le a), + entrée possible (les couloirs n'arrivent que par là).
 */
export interface RoomPlan {
  id: string;
  rows: string[];
}

export const OSSUAIRE_PLANS: RoomPlan[] = [
  { id: "croix", rows: [
    "#####+#####",
    "####...####",
    "###n...n###",
    "####.s.####",
    "#n.......n#",
    "+...cLc...+",
    "#n.......n#",
    "####.s.####",
    "###n...n###",
    "####...####",
    "#####+#####",
  ] },
  { id: "rotonde", rows: [
    "####+####",
    "##n...n##",
    "#.......#",
    "#n.o.o.n#",
    "+...L...+",
    "#n.o.o.n#",
    "#.......#",
    "##n...n##",
    "####+####",
  ] },
  { id: "galerie", rows: [
    "#n###n###n###n#",
    "#s#.#s#.#s#.#s#",
    "+.............+",
    "#s#.#s#.#s#.#s#",
    "#n###n###n###n#",
  ] },
  { id: "nef", rows: [
    "#####n#n#####",
    "##....a....##",
    "#n.o.....o.n#",
    "#.....L.....#",
    "#n.o.....o.n#",
    "#...g...g...#",
    "#n.o.....o.n#",
    "#...........#",
    "######+######",
  ] },
  { id: "chapelle", rows: [
    "####n###n####",
    "###...a...###",
    "##n...c...n##",
    "#...........#",
    "#.##.....##.#",
    "#.n#..L..#n.#",
    "####.....####",
    "#...........#",
    "######+######",
  ] },
  { id: "cloitre", rows: [
    "#n###+###n#",
    "#.........#",
    "#.#n###n#.#",
    "#.#.....#.#",
    "+...gLg...+",
    "#.#.....#.#",
    "#.#n###n#.#",
    "#.........#",
    "#n###+###n#",
  ] },
  { id: "puits", rows: [
    "##n#+#n##",
    "#c.....c#",
    "n..ooo..n",
    "+..oLo..+",
    "n..o.o..n",
    "#c.....c#",
    "##n###n##",
  ] },
];
