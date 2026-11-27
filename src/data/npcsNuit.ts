/**
 * PNJ DE LA NUIT DU 27-28/11 (claude/BRIEF_SECTION4_ET_S3.md ; planche art/nuit_v1.png).
 * Section 3 : PELLE-CREUSE, le fossoyeur (cimetière intérieur) ; DAME BANDELETTE, l'embaumeuse (salle d'embaumement).
 * Section 2 : BOLETUS, le cuisinier myconide (cuisine aux spores). Valeurs (C).
 */
export const FOSSOYEUR = {
  name: "Pelle-Creuse",
  opening: [
    "Un vieil homme au chapeau cabossé tasse la terre d'une tombe du plat de sa pelle.",
    "« Un vivant ! Pelle-Creuse, fossoyeur. Je range les morts. Le culte les dérange, moi je les range. »",
    "« Ils m'ont pris trois os de mes meilleurs clients. Une tombe incomplète, ça ne dort pas. »",
  ],
  away: [
    "Un vieil homme au chapeau cabossé, la pelle sur l'épaule, scrute les niches des murs.",
    "« Pelle-Creuse, fossoyeur. Mon cimetière est plus loin. Je cherche des os volés : un crâne, un fémur, une main. »",
  ],
  /** Creuser une tombe fraîche : chance d'y trouver un objet (sinon un mort se lève). */
  digLootChance: 0.55,
  digAlarm: 5,
};

export const BANDELETTE = {
  name: "Dame Bandelette",
  opening: [
    "Une momie aux bandelettes jaunies range des bocaux avec une lenteur infinie. Ses yeux luisent, bleu pâle.",
    "« Entrez… entrez… Dame Bandelette… embaumeuse… Pardonnez… ma lenteur… J'ai… trois mille ans. »",
    "« On m'a… volé… mes quatre vases… Chacal… faucon… babouin… serpent. »",
  ],
  away: [
    "Une momie aux bandelettes jaunies avance à pas comptés, une lanterne à la main.",
    "« Dame Bandelette… embaumeuse… Je cherche… mes vases… Quatre… Vous… les verriez… ? »",
  ],
  /** Le remède : jet de Charisme ; réussi, tous les PV (une fois). */
  remedyDc: "medium" as const,
};

export const BOLETUS = {
  name: "Boletus",
  opening: [
    "Un Myconide coiffé d'une toque blanche touille une marmite qui bouillonne de spores vertes.",
    "« Ah ! Un goûteur ! Boletus, chef de la meilleure cuisine sous la terre. La seule, aussi. »",
    "« Ma soupe de la lune manque de trois lueurs : l'azur, le rubis, le doré. Elles poussent sur l'étage. »",
  ],
  away: [
    "Un Myconide en toque blanche fouille les recoins, un panier sous le bras.",
    "« Boletus, chef. Ma cuisine est plus loin. Je cherche trois lueurs : l'azur, le rubis, le doré. »",
  ],
  /** Goûter la soupe (sans la quête) : 1 fois sur 2 elle soigne, sinon elle endort un tour. */
  tasteHeal: 6,
};
