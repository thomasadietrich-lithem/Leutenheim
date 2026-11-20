/**
 * Section 3, l'Ossuaire (Thomas, 2026-11-19 : « une chapelle aussi comme spéciale, avec une autre sœur d'os » ; planche
 * art/ossuaire_chapelle_v1.png, validée « Ok »). SŒUR CLAVICULE, la sœur aînée de Sœur Osseuse, restée dans la vieille
 * chapelle quand le culte de la Lune pâle a pris l'ossuaire. Trois demandes (C) : briser des crânes (bénédiction du
 * repos), rallumer ses cierges d'argent (potion de nuit), « ma sœur » (le chapelet d'argent).
 */
/**
 * LE CONSERVATEUR (Maître Osselet), le squelette du musée de l'ossuaire (Thomas, 2026-11-19 : « fonce sur quête »).
 * Monocle et nœud papillon ; il veille sur son tricératops. Quête : la CORNE DU NEZ volée par le culte (une salle qui
 * brille) → la MASSUE DE TRICÉRATOPS. Ou lire l'écriteau (Intelligence) : il montre le plan de l'étage.
 */
export const OSSELET = {
  name: "Maître Osselet",
  opening: [
    "Un squelette en monocle et nœud papillon époussette l'estrade du tricératops.",
    "« Bienvenue au musée ! Maître Osselet, conservateur. Ne touchez pas au cordon. »",
    "« Le culte m'a volé la corne du nez. Un tricératops à deux cornes, c'est un bicératops. Une honte. »",
  ],
  /** Hors du musée (Thomas, 2026-11-20 : « s'il n'apparaît pas dans le musée, il faut qu'il parle différemment »). */
  away: [
    "Un squelette en monocle et nœud papillon fait sa ronde, un plumeau sous le bras, loin de ses vitrines.",
    "« Maître Osselet, conservateur. Mon musée est un peu plus loin : je surveille les couloirs, le culte rôde. »",
    "« Ils m'ont volé la corne du nez de mon tricératops. Un tricératops à deux cornes, c'est un bicératops. Une honte. »",
  ],
};

export const CLAVICULE = {
  name: "Sœur Clavicule",
  maxEncounters: 3,
  opening: [
    "Une religieuse d'os en voile blanc prie à genoux devant l'autel. Son chapelet d'argent tinte.",
    "« Un vivant ? Ici ? … Je suis Sœur Clavicule. Je garde la chapelle depuis que la Lune pâle a pris l'ossuaire. »",
    "« Les morts ne dorment plus. La lune les relève, encore et encore. »",
  ],
  /** Hors de sa chapelle. */
  away: [
    "Une religieuse d'os en voile blanc égrène son chapelet d'argent, loin de son autel.",
    "« Un vivant ? Ici ? … Je suis Sœur Clavicule. Je garde la vieille chapelle, d'habitude. Aujourd'hui, je cherche. »",
    "« Les morts ne dorment plus. La lune les relève, encore et encore. »",
  ],
  /** Crânes à briser (squelettes vaincus pour de bon) pour la bénédiction du repos. */
  skulls: 5,
};
