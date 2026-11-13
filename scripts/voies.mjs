// Comparer les voies du Guerrier (2026-11-13) : `node scripts/voies.mjs [parties] [maitrise|moyen]`. Pour chaque voie et chaque
// pouvoir mis en premier (3 rangs), le joueur automatique joue les mêmes graines ; « boss » = part des parties où la Tisseuse tombe.
import { build } from "esbuild";
await build({ entryPoints: ["tests/bots.ts"], bundle: true, platform: "node", format: "cjs", outfile: "dist/voies.cjs", logLevel: "error" });
const { playBot } = await import("../dist/voies.cjs");
const n = Number(process.argv[2] ?? 150);
const level = process.argv[3] ?? "maitrise";
const B = ["second_souffle", "peau_dure", "recuperation", "dernier_rempart"];
const R = ["double_frappe", "coup_puissant", "enchainement", "rage"];
const first = (list, id) => [id, ...list.filter((x) => x !== id)];
const configs = [["aucune voie", { voie: "none" }]];
for (const id of B) configs.push([`bleue, ${id} d'abord`, { voie: "blue", build: first(B, id) }]);
for (const id of R) configs.push([`rouge, ${id} d'abord`, { voie: "red", build: first(R, id) }]);
const out = [];
for (const [name, opts] of configs) {
  const t = Date.now();
  const runs = [];
  for (let seed = 1; seed <= n; seed++) runs.push(playBot(level, seed * 101, 8000, opts));
  const avg = (f) => +(runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(2);
  const pct = (f) => Math.round((100 * runs.filter(f).length) / runs.length);
  const row = { name, floor: avg((r) => r.deepest), reach5: pct((r) => r.deepest >= 5), reach4: pct((r) => r.deepest >= 4), boss: pct((r) => r.boss), dead: pct((r) => r.dead), lvl: avg((r) => r.heroLevel), kills: avg((r) => r.kills), uses: avg((r) => r.skillUses), healed: avg((r) => r.healed), lastStands: avg((r) => r.lastStands), s: Math.round((Date.now() - t) / 1000) };
  out.push(row);
  console.log(JSON.stringify(row));
}
import("node:fs").then((fs) => {
  fs.mkdirSync("stats/voies", { recursive: true });
  fs.writeFileSync(`stats/voies/${new Date().toISOString().slice(0, 10)}_${level}_${n}.json`, JSON.stringify(out, null, 1));
});
