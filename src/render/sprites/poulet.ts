/**
 * Le poulet (truc fun, Thomas 2026-11-13) : vu de profil, tourné vers la gauche. Deux images : il picore sur place, il
 * court (pattes écartées, penché en avant). 16 × 16 pixels, dessiné plus petit qu'un Kobold.
 */
export const POULET_PALETTE: Record<string, string> = {
  K: "#1a120c",
  W: "#f6f2e6",
  S: "#c9c2ae",
  R: "#d8303a",
  Y: "#f0b830",
  O: "#e07a2a",
};

export const POULET: { idle: readonly string[]; run: readonly string[] } = {
  idle: [
    "................",
    "......RR........",
    ".....RRRK.......",
    ".....KWWWK......",
    "....KWWKWWK.....",
    "...YYKWWWWK.....",
    "....KKWWWWK.....",
    "......KWWWWKKK..",
    ".....KWWWWWWWSK.",
    "....KWWWWWWWWSK.",
    "....KWWSWWWWSK..",
    "....KSWWSSWSSK..",
    ".....KSSSSSSK...",
    ".......K..K.....",
    ".......O..O.....",
    "......OO.OO.....",
  ],
  run: [
    "................",
    ".......RR.......",
    "......RRRK......",
    "......KWWWK.....",
    ".....KWWKWWK....",
    "....YYKWWWWK....",
    ".....KKWWWWKK...",
    ".......KWWWWWKKK",
    "......KWWWWWWWSK",
    ".....KWWWWWWWWSK",
    ".....KWWSWWWWSK.",
    ".....KSWWSSWSSK.",
    "......KSSSSSSK..",
    "......K.....K...",
    ".....O.......O..",
    "....OO.......OO.",
  ],
};
