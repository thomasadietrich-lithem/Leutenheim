/** Règles chiffrées du jeu, hors fiches de créatures. */
export const RULES = {
  /** Crocheter une serrure : d20 + bonus de classe contre cette difficulté. Silencieux. */
  lockpickDc: 12,
  /** Enfoncer une porte : d20 + bonus de classe contre cette difficulté. Bruyant, réussite ou non. */
  breakDc: 11,
  /** Le bruit d'une porte enfoncée alerte les monstres jusqu'à cette distance (en cases). */
  noiseRadius: 10,
  /** Un monstre remarque plus facilement un héros éclairé par une torche, moins facilement dans le noir. */
  noticeInLight: 1.5,
  noticeInDark: 0.6,
  /** Nombre de pas sur lesquels on « devine » les passages au-delà de ce qu'on voit. */
  senseDepth: 3,
};
