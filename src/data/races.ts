/** Une race apporte de petits ajustements et (plus tard) un trait passif. */
export interface RaceDef {
  id: string;
  name: string;
  hpBonus: number;
  /** Rayon de la lueur portée par le héros : ce qu'il voit dans le noir. */
  darkVision: number;
  /** Distance maximale à laquelle il distingue une zone éclairée. */
  sight: number;
}

export const RACES = {
  humain: { id: "humain", name: "Humain", hpBonus: 2, darkVision: 4, sight: 11 },
} satisfies Record<string, RaceDef>;
