/**
 * Réglages de couleur du décor de la section 2 (Thomas, 2026-11-15 : « le design est excellent mais très dense ; des
 * variations fines de la colorimétrie »). Les valeurs par défaut sont celles du jeu ; les variantes à comparer se
 * posent avant de lancer la partie (`window.leutenheim.champiTune`), le temps de les essayer.
 */
export type RGB = [number, number, number];

export const CHAMPI_TUNE = {
  /** Sol : couleur des pavés, écart de teinte d'un pavé à l'autre. */
  stone: [60, 56, 70] as RGB,
  stoneSpread: 0.35,
  /** Sol : joints, mousse dans les joints (seuil : plus haut = moins de mousse), brins lumineux. */
  joint: [22, 20, 26] as RGB,
  mossThreshold: 0.5,
  moss: [40, 110, 96] as RGB,
  glow: [90, 200, 170] as RGB,
  glowChance: 0.1,
  /** Sol : mycélium au pied des murs (seuil : plus haut = moins). */
  footMyc: 0.52,
  /** Murs : pierre, montant, joint ; mycélium (seuil), points lumineux, champignons ronds (part des cases). */
  wallStone: [74, 62, 72] as RGB,
  wallJamb: [98, 84, 94] as RGB,
  wallMortar: [32, 24, 30] as RGB,
  wallHi: [132, 118, 128] as RGB,
  wallMyc: 0.7,
  wallBiolum: 0.06,
  wallDiscs: 0.17,
};

export type ChampiTune = typeof CHAMPI_TUNE;
