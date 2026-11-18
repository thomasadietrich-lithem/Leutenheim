// DIAGNOSTIC DES PARTIES BLOQUÉES : qui, à quel étage, à quel tour, pourquoi (Thomas, 2026-11-18).
//   node scripts/blocages.mjs                 lit le dernier passage de chaque race dans stats/bots/ et fait le bilan
//   node scripts/blocages.mjs --detail        la même chose, avec la liste des parties (graine, étage, tour, cause)
//   node scripts/blocages.mjs --jouer 60      rejoue 60 parties par joueur et par race tout de suite (sans rien garder)
// Pour revoir une partie bloquée de l'Expert tour par tour : node scripts/expert.mjs --trace <graine> 40
import { readdirSync, readFileSync } from "node:fs";
const args = process.argv.slice(2);
const detail = args.includes("--detail");
const LABEL = { debutant: "Débutant", moyen: "Moyen", maitrise: "Maîtrise", expert: "Expert" };
const RACES = ["humain", "halfelin", "elfe"];
let data = {};
if (args.includes("--jouer")) {
  const n = Number(args[args.indexOf("--jouer") + 1] ?? 60);
  const { build } = await import("esbuild");
  await build({ entryPoints: ["tests/bots.ts"], bundle: true, platform: "node", format: "cjs", outfile: "dist/bots.cjs", logLevel: "error" });
  const { playBot, playExpert } = await import("../dist/bots.cjs");
  for (const race of RACES) {
    data[race] = { runs: n, date: "à l'instant", levels: {} };
    for (const level of Object.keys(LABEL)) {
      const runs = [];
      for (let s = 1; s <= n; s++) runs.push(level === "expert" ? playExpert(s * 101, 24000, { race }) : playBot(level, s * 101, 8000, { race }));
      data[race].levels[level] = { blockedRuns: runs.filter((r) => r.stuck).map((r) => ({ seed: r.seed, end: r.end, ...r.stuck })) };
    }
  }
} else {
  const dir = "stats/bots/";
  const all = readdirSync(dir).filter((f) => f.endsWith(".json")).sort();
  for (const race of RACES) {
    const f = all.filter((x) => (race === "humain" ? !/_(halfelin|elfe)\.json$/.test(x) : x.endsWith(`_${race}.json`))).pop();
    if (f) data[race] = JSON.parse(readFileSync(dir + f, "utf8"));
  }
}
for (const race of RACES) {
  const r = data[race];
  if (!r) continue;
  console.log(`\n===== ${race.toUpperCase()} — ${r.runs} parties par joueur, passage du ${String(r.date).slice(0, 16).replace("T", " ")}`);
  for (const [level, s] of Object.entries(r.levels)) {
    const list = s.blockedRuns;
    if (!list) { console.log(`${LABEL[level]} : ce passage est trop ancien (pas de diagnostic) ; relancer les bots.`); continue; }
    console.log(`${LABEL[level]} : ${list.length} bloquée(s) sur ${r.runs} (${Math.round((100 * list.length) / r.runs)} %)`);
    const by = {};
    for (const b of list) (by[`étage ${b.floor} — ${b.cause}`] ??= []).push(b);
    for (const [k, v] of Object.entries(by).sort((a, b) => b[1].length - a[1].length)) {
      const turns = v.map((b) => b.turn).sort((a, b) => a - b);
      console.log(`   ${String(v.length).padStart(3)} × ${k} (tour médian ${turns[Math.floor(turns.length / 2)]})`);
      if (detail) for (const b of v) console.log(`         graine ${b.seed}, tour ${b.turn}, PV ${b.hp}${b.last ? `, dernière règle « ${b.last} »` : ""}${b.detail ? ` — ${b.detail}` : ""}`);
      else if (v[0].detail) console.log(`         ex. graine ${v[0].seed} : ${v[0].detail}`);
    }
  }
}
