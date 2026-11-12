// Trois joueurs automatiques (débutant, moyen, maîtrise) : `node scripts/bots.mjs [parties par niveau]`.
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
const n = Number(process.argv[2] ?? 60);
await build({ entryPoints: ["tests/bots.ts"], bundle: true, platform: "node", format: "cjs", outfile: "dist/bots.cjs", logLevel: "error" });
const { playBot } = await import("../dist/bots.cjs");
const all = {};
for (const level of ["debutant", "moyen", "maitrise"]) {
  const runs = [];
  for (let seed = 1; seed <= n; seed++) runs.push(playBot(level, seed * 101));
  all[level] = runs;
  const avg = (f) => (runs.reduce((a, r) => a + f(r), 0) / runs.length).toFixed(1);
  const pct = (f) => Math.round((100 * runs.filter(f).length) / runs.length) + " %";
  const causes = {};
  for (const r of runs) if (r.dead) causes[r.cause ?? "?"] = (causes[r.cause ?? "?"] ?? 0) + 1;
  const reach = [2, 3, 4, 5].map((d) => `${d}:${pct((r) => r.deepest >= d)}`).join(" ");
  console.log(`\n== ${level} (${n} parties)`);
  console.log(`étage atteint moyen ${avg((r) => r.deepest)} ; atteint ${reach} ; boss vaincu ${pct((r) => r.boss)} ; morts ${pct((r) => r.dead)}`);
  console.log(`niveau ${avg((r) => r.heroLevel)} ; tours ${avg((r) => r.turns)} ; or ${avg((r) => r.gold)} ; monstres tués ${avg((r) => r.kills)}`);
  console.log("tué par : " + Object.entries(causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
}
writeFileSync("/tmp/bots.json", JSON.stringify(all));
