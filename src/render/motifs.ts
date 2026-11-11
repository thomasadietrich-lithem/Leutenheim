/**
 * Motifs gravés dans le sol (planche `art/motifs_sol_v1.png`, validée par Thomas le 2026-11-11, sauf le damier) :
 * rosace, rose des vents en laiton, sceau de runes (2 × 2 cases) ; croix ancrée, spirale (1 case). Mêmes formules
 * que `art/motifs_sol_v1.py`. Chaque fonction reçoit (u, v) de -1 à 1 sur le motif et rend : 0 rien, 1 trait gravé,
 * 2 laiton.
 */
import { MotifKind } from "../data/motifs";

const hypot = Math.hypot;

export const MOTIFS: Record<MotifKind, (u: number, v: number) => number> = {
  rosace(u, v) {
    const r = hypot(u, v);
    const a = Math.atan2(v, u);
    if (Math.abs(r - 0.9) < 0.05 || Math.abs(r - 0.78) < 0.04) return 1;
    if (r < 0.14) return 2;
    if (r < 0.74) {
      const k = (((a / (Math.PI / 4)) % 1) + 1) % 1;
      const d = Math.min(k, 1 - k);
      const width = 0.5 * Math.sin(Math.PI * Math.min(1, Math.max(0, (r - 0.16) / 0.58)));
      if (Math.abs(d - width * 0.5) < 0.05 && r > 0.18) return 1;
    }
    return 0;
  },
  boussole(u, v) {
    const r = hypot(u, v);
    if (Math.abs(r - 0.9) < 0.06) return 1;
    const au = Math.abs(u);
    const av = Math.abs(v);
    if ((au < 0.12 * (1 - av / 0.85) && av < 0.85) || (av < 0.12 * (1 - au / 0.85) && au < 0.85)) return 2;
    if (Math.abs(au - av) < 0.05 && r < 0.5) return 1;
    return 0;
  },
  runes(u, v) {
    const r = hypot(u, v);
    const a = Math.atan2(v, u);
    if (Math.abs(r - 0.92) < 0.05 || Math.abs(r - 0.62) < 0.05) return 1;
    if (r > 0.68 && r < 0.86) {
      const seg = ((a + Math.PI) / (2 * Math.PI)) * 10;
      if (Math.abs(seg - Math.round(seg)) < 0.1 || (Math.floor(seg) % 2 === 0 && Math.abs(r - 0.77) < 0.03)) return 1;
    }
    if (r < 0.3 && Math.abs(Math.abs(u) - Math.abs(v)) < 0.05) return 1;
    return 0;
  },
  croix(u, v) {
    const au = Math.abs(u);
    const av = Math.abs(v);
    const m = Math.max(au, av);
    if (m > 0.86 && m < 0.94) return 1;
    if ((au < 0.12 && av < 0.7) || (av < 0.12 && au < 0.7)) return 1;
    if ((av > 0.55 && av < 0.7 && au < 0.3) || (au > 0.55 && au < 0.7 && av < 0.3)) return 1;
    return 0;
  },
  spirale(u, v) {
    const r = hypot(u, v);
    const a = Math.atan2(v, u);
    if (r > 0.92) return 0;
    const t = (r / 0.9) * 3 - (a + Math.PI) / (2 * Math.PI);
    return Math.abs(t - Math.round(t)) < 0.12 && r > 0.08 ? 1 : 0;
  },
};
