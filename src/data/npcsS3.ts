/**
 * Section 3, l'Ossuaire (Thomas, 2026-11-19 : « une chapelle aussi comme spéciale, avec une autre sœur d'os » ; planche
 * art/ossuaire_chapelle_v1.png, validée « Ok »). SŒUR CLAVICULE, la sœur aînée de Sœur Osseuse, restée dans la vieille
 * chapelle quand le culte de la Lune pâle a pris l'ossuaire. Trois demandes (C) : briser des crânes (bénédiction du
 * repos), rallumer ses cierges d'argent (potion de nuit), « ma sœur » (le chapelet d'argent).
 */
export const CLAVICULE = {
  name: "Sœur Clavicule",
  maxEncounters: 3,
  opening: [
    "Une religieuse d'os en voile blanc prie à genoux devant l'autel. Son chapelet d'argent tinte.",
    "« Un vivant ? Ici ? … Je suis Sœur Clavicule. Je garde la chapelle depuis que la Lune pâle a pris l'ossuaire. »",
    "« Les morts ne dorment plus. La lune les relève, encore et encore. »",
  ],
  /** Crânes à briser (squelettes vaincus pour de bon) pour la bénédiction du repos. */
  skulls: 5,
};
