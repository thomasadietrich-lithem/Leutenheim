/** Motifs gravés au sol (planche art/motifs_sol_v1.png, validée le 2026-11-11 sauf le damier) : taille en cases. */
export type MotifKind = "rosace" | "boussole" | "runes" | "croix" | "spirale";
export const MOTIF_SIZE: Record<MotifKind, number> = { rosace: 2, boussole: 2, runes: 2, croix: 1, spirale: 1 };
export const MOTIF_KINDS = Object.keys(MOTIF_SIZE) as MotifKind[];
