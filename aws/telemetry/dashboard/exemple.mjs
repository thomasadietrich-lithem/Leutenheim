// Fabrique des données D'EXEMPLE pour la maquette du tableau de bord (aucun vrai joueur).
//   node aws/telemetry/dashboard/exemple.mjs   → écrit data.json à côté, marqué « exemple ».
// Hasard à graine fixe : la maquette ne change pas d'un passage à l'autre.
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let seed = 20261124;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (list) => { const total = list.reduce((s, [, w]) => s + w, 0); let r = rnd() * total; for (const [v, w] of list) { r -= w; if (r <= 0) return v; } return list[0][0]; };

const CAUSES = { 1: [["rat", 5], ["schrat", 4], ["frondeur", 3], ["piège", 2], ["araignee", 2]], 2: [["myconide", 5], ["sporelin", 4], ["cueilleur", 3], ["envahi", 3], ["piège", 2]], 3: [["squelette", 5], ["acolyte", 4], ["fidele", 3], ["colosse", 2], ["piège", 2]] };
const BOSS = { 5: "tisseuse", 10: "carillon", 15: "pretresse" };
const PASS = { humain: 0.8, halfelin: 0.77, elfe: 0.79 };
const BOSS_WIN = { 5: 0.45, 10: 0.38, 15: 0.3 };
const QUESTS = ["champignons", "cloche", "reliques", "prisonnier", "colporteur"];

const runs = [], quests = [];
const start = Date.UTC(2026, 9, 26);
for (let d = 0; d < 30; d++) {
  const day = new Date(start + d * 86400000).toISOString().slice(0, 10);
  const n = Math.round(6 + d * 0.9 + rnd() * 8);
  for (let i = 0; i < n; i++) {
    const race = pick([["humain", 5], ["halfelin", 3], ["elfe", 4]]);
    const version = d < 12 ? "0.2.0" : pick([["0.2.0", 1], ["0.3.0", 4]]);
    const platform = pick([["web", 6], ["android", 3]]);
    let floor = 1, end = "mort", cause = "", bosses = 0;
    for (;;) {
      if (rnd() < 0.04) { end = "abandon"; break; }
      if (BOSS[floor]) {
        if (rnd() > BOSS_WIN[floor]) { cause = BOSS[floor]; break; }
        bosses++;
        if (floor === 15) { end = "fin"; break; }
      } else if (rnd() > PASS[race]) { cause = pick(CAUSES[Math.ceil(floor / 5)]); break; }
      floor++;
    }
    const level = Math.max(1, Math.round(floor * 0.8 + rnd() * 2));
    runs.push({ day, version, platform, race, deepest: floor, end, cause, level, turns: Math.round(floor * (140 + rnd() * 120)), gold: Math.round(floor * (18 + rnd() * 30)), kills: Math.round(floor * (3 + rnd() * 4)), bosses, device: "ex" + Math.floor(rnd() * (40 + d * 4)) });
    for (const q of QUESTS) if (rnd() < 0.12 * Math.min(floor, 6)) quests.push({ day, version, platform, race, id: q, what: pick([["réussie", 5], ["ratée", 3], ["perdue", 2]]) });
  }
}
const out = { exemple: true, genere: "2026-11-24", runs, quests };
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), "data.json"), JSON.stringify(out));
console.log(runs.length, "parties d'exemple,", quests.length, "quêtes");
