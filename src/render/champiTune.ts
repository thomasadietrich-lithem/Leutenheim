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

/** Les variantes de la planche art/champi_couleurs_v1.png que l'on peut poser sur une salle (salle d'essai). */
export const CHAMPI_PRESETS: Record<string, Partial<ChampiTune>> = {
  /** E · chaud, terreux (Thomas, 2026-11-15 : « fais une salle chaud terreux et une salle normale »). */
  warm: {
    stone: [66, 56, 52], stoneSpread: 0.22, mossThreshold: 0.56, moss: [62, 96, 64], glow: [150, 210, 140], glowChance: 0.05,
    joint: [26, 20, 18], wallStone: [80, 64, 58], wallJamb: [102, 84, 76], wallMortar: [34, 26, 22], wallHi: [138, 116, 104],
    wallMyc: 0.75, wallBiolum: 0.04, wallDiscs: 0.12,
  },
};

/** Dessine avec une variante posée le temps de `fn`, puis rend les réglages d'avant. */
export function withTune<T>(preset: Partial<ChampiTune> | undefined, fn: () => T): T {
  if (!preset) return fn();
  const saved: Record<string, unknown> = {};
  for (const k of Object.keys(preset)) saved[k] = (CHAMPI_TUNE as Record<string, unknown>)[k];
  Object.assign(CHAMPI_TUNE, preset);
  try {
    return fn();
  } finally {
    Object.assign(CHAMPI_TUNE, saved);
  }
}
