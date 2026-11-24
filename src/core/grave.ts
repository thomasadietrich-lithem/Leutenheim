/**
 * LA TOMBE DU HÉROS PRÉCÉDENT (Thomas, 2026-11-24 : « on repasse devant la tombe à l'étage où il est tombé, à la partie
 * suivante, avec un objet du précédent run »). L'interface la garde d'une partie à l'autre et la donne ici avant de créer
 * la nouvelle partie ; le jeu la pose sur l'étage voulu (voir `Game.placeGrave`).
 */
import type { ItemId } from "../data/items";

export interface HeroGrave {
  /** L'étage où il est tombé (celui d'un boss : l'étage d'avant). */
  depth: number;
  /** L'objet qu'il laisse : le plus rare de ce qu'il portait. */
  item: ItemId;
  /** « Humain Guerrier ». */
  who: string;
  level: number;
  cause: string;
}

let next: HeroGrave | null = null;

/** La tombe à poser dans la prochaine partie créée (null : aucune). */
export function setPreviousGrave(g: HeroGrave | null): void {
  next = g;
}

export function previousGrave(): HeroGrave | null {
  return next;
}
