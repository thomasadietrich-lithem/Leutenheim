/**
 * L'assiette de la cuisine (Thomas, 2026-11-13 : « la cuisse de poulet dans la cuisine, sur une assiette ») : pleine (une
 * cuisse dessus) ou vide. 16 × 16 pixels, posée au sol comme le panier à fruits.
 */
const PALETTE = { a: "#120d08", w: "#e8e2d2", s: "#b6ae9a", d: "#7a7262", t: "#b9824a", u: "#7a5230", b: "#f4f7ff" };

export const ASSIETTE: Record<string, { palette: Record<string, string>; rows: string[] }> = {
  plateFull: {
    palette: PALETTE,
    rows: [
      "................",
      "................",
      "................",
      "................",
      "................",
      ".......aaaa.....",
      "......atttta....",
      ".....atttutta...",
      "...aaatuttttaa..",
      "..awwatttttaswa.",
      ".awwswaattaaswwa",
      ".awwsaabbaasswwa",
      "..awwsssbsssswa.",
      "...aawwwwwwwaa..",
      ".....aaaaaaa....",
      "................",
    ],
  },
  plate: {
    palette: PALETTE,
    rows: [
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "................",
      "...aaaaaaaaaa...",
      "..awwwwwwwwwwa..",
      ".awwssssssssswa.",
      ".awwsdddddddswa.",
      "..awwsssssssswa.",
      "...aawwwwwwwaa..",
      ".....aaaaaaa....",
      "................",
    ],
  },
};
