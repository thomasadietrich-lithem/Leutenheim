// Trois joueurs automatiques (débutant, moyen, maîtrise) : `npm run bots` ou `node scripts/bots.mjs [parties] [note]`.
// Chaque passage est gardé dans stats/bots/ (un fichier JSON par passage) et ajouté au tableau stats/bots/HISTORIQUE.md,
// pour comparer dans le temps (Thomas, 2026-11-13). Les graines sont toujours les mêmes : seules les règles changent.
import { build } from "esbuild";
import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from "node:fs";

const n = Number(process.argv[2] ?? 150);
const note = process.argv.slice(3).join(" ");
await build({ entryPoints: ["tests/bots.ts"], bundle: true, platform: "node", format: "cjs", outfile: "dist/bots.cjs", logLevel: "error" });
const { playBot } = await import("../dist/bots.cjs");

const dir = "stats/bots";
mkdirSync(dir, { recursive: true });
const previous = readdirSync(dir).filter((f) => f.endsWith(".json")).sort().pop();
const before = previous ? JSON.parse(readFileSync(`${dir}/${previous}`, "utf8")) : null;

let commit = "?";
try {
  commit = execSync("git rev-parse --short HEAD").toString().trim();
} catch {}
const now = new Date();
const stamp = now.toISOString().slice(0, 16).replace("T", "_").replace(":", "h");
const result = { date: now.toISOString(), commit, runs: n, note, levels: {} };

const LABEL = { debutant: "Débutant", moyen: "Moyen", maitrise: "Maîtrise" };
for (const level of ["debutant", "moyen", "maitrise"]) {
  const runs = [];
  for (let seed = 1; seed <= n; seed++) runs.push(playBot(level, seed * 101));
  const avg = (f) => Math.round((10 * runs.reduce((a, r) => a + f(r), 0)) / runs.length) / 10;
  const pct = (f) => Math.round((100 * runs.filter(f).length) / runs.length);
  const causes = {};
  for (const r of runs) if (r.dead) causes[r.cause ?? "?"] = (causes[r.cause ?? "?"] ?? 0) + 1;
  result.levels[level] = {
    floor: avg((r) => r.deepest),
    deathFloor1: pct((r) => r.dead && r.deepest === 1),
    reach: Object.fromEntries([2, 3, 4, 5].map((d) => [d, pct((r) => r.deepest >= d)])),
    boss: pct((r) => r.boss),
    dead: pct((r) => r.dead),
    heroLevel: avg((r) => r.heroLevel),
    turns: avg((r) => r.turns),
    gold: avg((r) => r.gold),
    kills: avg((r) => r.kills),
    questsStarted: avg((r) => r.questsStarted),
    questsDone: avg((r) => r.questsDone),
    questsFailed: avg((r) => r.questsFailed),
    causes,
  };
}
writeFileSync(`${dir}/${stamp}_${commit}.json`, JSON.stringify(result, null, 1) + "\n");

// Tableau de l'historique : une ligne par niveau et par passage.
const hist = `${dir}/HISTORIQUE.md`;
if (!existsSync(hist)) {
  writeFileSync(
    hist,
    "# Joueurs automatiques : historique\n\n`npm run bots` (150 parties par niveau, toujours les mêmes graines). Une ligne par niveau et par passage.\n\n" +
      "| Date | Commit | Joueur | Étage moyen | Mort étage 1 | Arrive au boss | Bat le boss | Niveau | Monstres tués | Quêtes données / rendues / ratées | Note |\n" +
      "|---|---|---|---|---|---|---|---|---|---|---|\n",
  );
}
for (const [level, s] of Object.entries(result.levels)) {
  appendFileSync(hist, `| ${result.date.slice(0, 16).replace("T", " ")} | ${commit} | ${LABEL[level]} | ${s.floor} | ${s.deathFloor1} % | ${s.reach[5]} % | ${s.boss} % | ${s.heroLevel} | ${s.kills} | ${s.questsStarted} / ${s.questsDone} / ${s.questsFailed} | ${note} |\n`);
}

// Résumé, et l'écart avec le passage précédent.
const diff = (a, b) => (b === undefined ? "" : ` (${a - b >= 0 ? "+" : ""}${Math.round((a - b) * 10) / 10})`);
for (const [level, s] of Object.entries(result.levels)) {
  const o = before?.levels?.[level];
  console.log(`\n== ${LABEL[level]} (${n} parties)${o ? ` — comparé au ${before.date.slice(0, 16).replace("T", " ")} (${before.commit})` : ""}`);
  console.log(`étage moyen ${s.floor}${diff(s.floor, o?.floor)} ; meurt à l'étage 1 ${s.deathFloor1} %${diff(s.deathFloor1, o?.deathFloor1)} ; arrive au boss ${s.reach[5]} %${diff(s.reach[5], o?.reach?.[5])} ; bat le boss ${s.boss} %${diff(s.boss, o?.boss)}`);
  console.log(`niveau ${s.heroLevel}${diff(s.heroLevel, o?.heroLevel)} ; monstres tués ${s.kills}${diff(s.kills, o?.kills)} ; quêtes données ${s.questsStarted}, rendues ${s.questsDone}, ratées ${s.questsFailed}`);
  console.log("tué par : " + Object.entries(s.causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
}
console.log(`\nGardé dans ${dir}/${stamp}_${commit}.json et ${hist}`);
