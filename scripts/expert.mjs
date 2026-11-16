// Outils pour le joueur automatique EXPERT (`tests/botExpert.ts`), hors historique :
//   node scripts/expert.mjs 100                          résumé sur 100 parties (mêmes graines que `npm run bots`)
//   node scripts/expert.mjs 100 '{"off":{"push":true}}'  la même chose sans une stratégie (ici : sans pousser), pour voir
//                                                        ce qu'elle rapporte ; autres réglages : voie, stats, build
//   node scripts/expert.mjs --trace 1313 40              les 40 derniers tours de la partie 1313, règle par règle
import { build } from "esbuild";
await build({ entryPoints: ["tests/bots.ts"], bundle: true, platform: "node", format: "cjs", outfile: "dist/bots.cjs", logLevel: "error" });
const { playExpert } = await import("../dist/bots.cjs");

if (process.argv[2] === "--trace") {
  const seed = Number(process.argv[3]);
  const last = Number(process.argv[4] ?? 40);
  const log = [];
  const r = playExpert(seed, 24000, {
    trace: (why, g) => {
      const b = g.bossActor();
      log.push(`tour ${g.turn} étage ${g.depth} (${g.hero.x},${g.hero.y}) PV ${g.hero.hp}/${g.hero.maxHp} : ${why}${b ? ` | boss PV ${b.hp}` : ""} | ${g.visibleMonsters().length} en vue`);
    },
  });
  console.log(log.slice(-last).join("\n"));
  console.log(r);
} else {
  const n = Number(process.argv[2] ?? 100);
  const opts = JSON.parse(process.argv[3] ?? "{}");
  const runs = [];
  for (let s = 1; s <= n; s++) runs.push(playExpert(s * 101, 24000, opts));
  const pct = (f) => Math.round((100 * runs.filter(f).length) / n);
  const avg = (f) => Math.round((10 * runs.reduce((a, r) => a + f(r), 0)) / n) / 10;
  console.log(`${n} parties ${JSON.stringify(opts)}`);
  console.log(`étage moyen ${avg((r) => r.deepest)} ; meurt à l'étage 1 ${pct((r) => r.dead && r.deepest === 1)} % ; arrive à la Tisseuse ${pct((r) => r.deepest >= 5)} %, la bat ${pct((r) => r.boss)} %`);
  console.log(`étage 8 ${pct((r) => r.deepest >= 8)} % ; étage 10 ${pct((r) => r.deepest >= 10)} % ; bat le Carillon ${pct((r) => r.boss2)} % ; bloqué ${pct((r) => !r.dead && !r.won)} %`);
  console.log(`niveau ${avg((r) => r.heroLevel)}, CA ${avg((r) => r.armorClass)}, ${avg((r) => r.turns)} tours`);
  const causes = {};
  for (const r of runs) if (r.dead) causes[`étage ${r.deepest} ${r.cause}`] = (causes[`étage ${r.deepest} ${r.cause}`] ?? 0) + 1;
  console.log(Object.entries(causes).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => `${k} : ${v}`).join(" ; "));
}
