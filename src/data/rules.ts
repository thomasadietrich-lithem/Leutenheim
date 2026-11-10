/** Règles chiffrées du jeu, hors fiches de créatures. */
export const RULES = {
  /** Crocheter une serrure : d20 + bonus de classe contre cette difficulté. Silencieux. */
  lockpickDc: 12,
  /** Enfoncer une porte : d20 + bonus de classe contre cette difficulté. Bruyant, réussite ou non. */
  breakDc: 8,
  /** Le bruit d'une porte enfoncée alerte les monstres jusqu'à cette distance (en cases). */
  noiseRadius: 10,
  /** Un monstre remarque plus facilement un héros éclairé par une torche, moins facilement dans le noir. */
  noticeInLight: 1.5,
  noticeInDark: 0.6,
  /** Un monstre endormi remarque moins bien le héros ; un monstre qui se promène, mieux. */
  noticeAsleep: 0.5,
  noticeAwake: 1.5,
  /** Flèche qui touche : chance de la retrouver intacte sur la case de la cible. */
  arrowKeepOnHit: 0.6,
  /** Flèche qui rate : elle file dans le décor ; chance qu'elle ne se casse pas. */
  arrowKeepOnMiss: 0.5,
  /** Flèche tirée sur le décor (sol, mur, porte) : chance qu'elle ne se casse pas. */
  arrowKeepOnScenery: 0.5,
  /** Une flèche qui heurte un obstacle rebondit d'une à deux cases en arrière avant de tomber. */
  arrowBounceMin: 1,
  arrowBounceMax: 2,
  /** Une flèche brisée reste visible au sol ce nombre de tours, et s'efface sur les derniers. */
  brokenArrowTurns: 8,
  brokenArrowFadeTurns: 4,
  /** Distance maximale parcourue par une flèche ratée au-delà de sa cible. */
  arrowOvershoot: 4,
  /** Nombre d'étages d'une section (région à thème). Une clef ne sert que dans la section où on l'a trouvée. */
  floorsPerSection: 4,
  /** Chance qu'une clef traîne quelque part sur l'étage. Elle ouvre une porte verrouillée, sans jet ni bruit. */
  keyChance: 0.35,
  /** Expérience à réunir pour passer au niveau suivant : ce nombre × le niveau actuel. */
  xpPerLevel: 30,
  /** Points de vie gagnés à chaque niveau. */
  hpPerLevel: 3,
  /** Or contenu dans un coffre : de `min` à `max`, plus un bonus par étage. */
  chestGoldMin: 8,
  chestGoldMax: 20,
  chestGoldPerDepth: 3,
  /** Nombre de pas sur lesquels on « devine » les passages au-delà de ce qu'on voit. */
  senseDepth: 3,
};
