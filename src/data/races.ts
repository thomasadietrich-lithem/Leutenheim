/** Une race apporte de petits ajustements et (plus tard) un trait passif. */
export interface RaceDef {
  id: string;
  name: string;
  hpBonus: number;
  vision: number;
}

export const RACES = {
  humain: { id: "humain", name: "Humain", hpBonus: 2, vision: 7 },
} satisfies Record<string, RaceDef>;
