#!/usr/bin/env node
/**
 * MESURE DE PERFORMANCE (Thomas, 2026-11-14 : « j'ai à nouveau des chutes de perf ; une vérification à chaque
 * publication »). Ouvre demo/index.html dans un Chromium sans écran, format téléphone (412 × 915, densité 3), processeur
 * ralenti ×4 (un téléphone moyen), dans la salle d'essai (le plus lourd : 200 × 70 cases, toutes les salles), et joue
 * toujours les mêmes scènes : immobile, longue marche, zoom, combat. Pour chacune : image moyenne, 95e centile, pire
 * image (ms), images par seconde, part du JavaScript ; et le temps de calcul d'un tour de jeu et de la lumière.
 *
 *   node scripts/perf.mjs "note"            → mesure, compare au passage précédent, garde le résultat
 *   node scripts/perf.mjs "note" --no-save  → mesure seulement
 *
 * Résultats : stats/perf/AAAA-MM-JJ_HHhMM_<commit>.json et une ligne par passage dans stats/perf/HISTORIQUE.md.
 * Sortie en erreur (code 1) si une scène est plus lente de 40 % (et de 4 ms) ou plus que le passage précédent (seuil REGRESSION).
 */
import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const REGRESSION = 1.4;
const root = process.env.PERF_ROOT ?? path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const note = process.argv.slice(2).filter((a) => !a.startsWith("--")).join(" ") || "(sans note)";
const save = !process.argv.includes("--no-save");

const COLLECT = () => {
  window.__f = [];
  let last = performance.now();
  const loop = (t) => {
    window.__f.push(t - last);
    last = t;
    if (window.__on) requestAnimationFrame(loop);
  };
  window.__on = true;
  requestAnimationFrame(loop);
};
const STOP = () => {
  window.__on = false;
  const f = window.__f.slice(2).sort((a, b) => a - b);
  const n = f.length;
  const avg = f.reduce((a, b) => a + b, 0) / n;
  return { n, avg: +avg.toFixed(1), p95: +f[Math.floor(n * 0.95)].toFixed(1), max: +f[n - 1].toFixed(1), fps: Math.round(1000 / avg) };
};

async function metrics(cdp) {
  const m = await cdp.send("Performance.getMetrics");
  return Object.fromEntries(m.metrics.map((x) => [x.name, x.value]));
}

// Playwright : celui du projet s'il est installé, sinon celui de la machine (PLAYWRIGHT=chemin/vers/index.mjs).
let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  ({ chromium } = await import(process.env.PLAYWRIGHT ?? "/home/claude/.npm-global/lib/node_modules/playwright/index.mjs"));
}
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true });
const page = await ctx.newPage();
await page.addInitScript(() => {
  localStorage.clear();
  localStorage.setItem("leutenheim.options", JSON.stringify({ sound: false, music: false, lang: "fr" })); let __s = 12345; Math.random = () => ((__s = (Math.imul(__s, 1103515245) + 12345) >>> 0) / 4294967296);
});
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
const cdp = await ctx.newCDPSession(page);
await cdp.send("Performance.enable");
await page.goto("file://" + path.join(root, "demo/index.html"));
await page.waitForTimeout(500);
await page.click("#menu-sandbox");
await page.waitForTimeout(1200);

// Le calcul d'un tour et de la lumière, sans ralentissement (pour repérer un calcul devenu lourd).
const logic = await page.evaluate(() => {
  const g = window.leutenheim.game();
  g.peaceful = true;
  const t0 = performance.now();
  for (let i = 0; i < 40; i++) {
    g.wait();
    g.tick();
  }
  const tick = (performance.now() - t0) / 40;
  const t1 = performance.now();
  for (let i = 0; i < 40; i++) g.refreshLight();
  const light = (performance.now() - t1) / 40;
  const t2 = performance.now();
  for (let i = 0; i < 40; i++) g.updateVision();
  const vision = (performance.now() - t2) / 40;
  return { tickMs: +tick.toFixed(2), lightMs: +light.toFixed(2), visionMs: +vision.toFixed(2) };
});

await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
const scenes = {};
async function scene(name, action, ms) {
  const a = await metrics(cdp);
  await page.evaluate(COLLECT);
  await action();
  await page.waitForTimeout(ms);
  const r = await page.evaluate(STOP);
  const b = await metrics(cdp);
  r.js = Math.round((100 * (b.ScriptDuration - a.ScriptDuration)) / (b.Timestamp - a.Timestamp));
  scenes[name] = r;
}
await scene("immobile", async () => {}, 2500);
await scene("marche", () => page.evaluate(() => window.leutenheim.game().setDestination(180, 45, true)), 5000);
await scene("retour", () => page.evaluate(() => window.leutenheim.game().setDestination(99, 45, true)), 5000);
await scene("zoom", async () => {
  for (let k = 0; k < 10; k++) {
    await page.mouse.move(206, 400);
    await page.mouse.wheel(0, k < 5 ? -120 : 120);
    await page.waitForTimeout(120);
  }
}, 600);
await scene("combat", async () => {
  await page.evaluate(() => {
    const g = window.leutenheim.game();
    g.peaceful = false;
    g.hero.x = g.hero.fromX = 92;
    g.hero.y = g.hero.fromY = 61;
    g.updateVision();
    const ms = g.monsters.filter((m) => !m.boss).slice(0, 3);
    ms.forEach((m, i) => Object.assign(m, { x: g.hero.x + 1, y: g.hero.y - 1 + i, fromX: g.hero.x + 1, fromY: g.hero.y - 1 + i, hp: 999, asleep: false, alerted: true }));
    window.__ms = ms;
  });
  for (let k = 0; k < 6; k++) {
    await page.evaluate(() => {
      const g = window.leutenheim.game();
      g.hero.hp = g.hero.maxHp;
      const m = window.__ms[0];
      g.setDestination(m.x, m.y, true);
    });
    await page.waitForTimeout(600);
  }
}, 300);
// Le donjon : une nouvelle partie (graine tirée par le jeu), on marche vers l'escalier à travers l'étage.
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
await page.evaluate(() => localStorage.removeItem("leutenheim.save"));
await page.reload();
await page.waitForTimeout(500);
await page.click("#menu-new");
await page.waitForTimeout(300);
await page.click("#new-start");
await page.waitForTimeout(300);
await page.click("#intro-go").catch(() => {});
await page.waitForTimeout(800);
await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
await scene("donjon", () => page.evaluate(() => {
  const g = window.leutenheim.game();
  g.peaceful = true;
  const s = g.current.stairs;
  g.setDestination(s.x, s.y, true);
}), 5000);
await browser.close();

const commit = execSync("git rev-parse --short HEAD", { cwd: root }).toString().trim();
const result = { date: new Date().toISOString(), commit, note, logic, scenes, errors };

// Comparaison avec le passage précédent.
const dir = path.join(root, "stats/perf");
fs.mkdirSync(dir, { recursive: true });
const previous = fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort().pop();
const prev = previous ? JSON.parse(fs.readFileSync(path.join(dir, previous), "utf8")) : null;
let worse = [];
console.log(`Calcul (sans ralentissement) : tour ${logic.tickMs} ms, lumière ${logic.lightMs} ms, vision ${logic.visionMs} ms`);
for (const [name, r] of Object.entries(scenes)) {
  const p = prev?.scenes?.[name];
  const delta = p ? ` (avant ${p.avg} ms, ${p.fps} i/s)` : "";
  console.log(`${name.padEnd(9)} image ${r.avg} ms · 95 % ${r.p95} ms · pire ${r.max} ms · ${r.fps} i/s · JS ${r.js} %${delta}`);
  if (p && r.avg > p.avg * REGRESSION && r.avg - p.avg > 4) worse.push(`${name} : ${p.avg} → ${r.avg} ms`);
}
for (const k of ["tickMs", "lightMs", "visionMs"]) {
  const p = prev?.logic?.[k];
  if (p && logic[k] > p * REGRESSION && logic[k] - p > 0.3) worse.push(`${k} : ${p} → ${logic[k]} ms`);
}
if (errors.length) console.log("ERREURS DANS LA PAGE :", errors);
if (save) {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", "_").replace(":", "h");
  fs.writeFileSync(path.join(dir, `${stamp}_${commit}.json`), JSON.stringify(result, null, 1));
  const hist = path.join(dir, "HISTORIQUE.md");
  if (!fs.existsSync(hist)) fs.writeFileSync(hist, "# Mesures de performance (scripts/perf.mjs)\n\nImage moyenne en ms (processeur ×4, 412 × 915, densité 3, salle d'essai) ; plus c'est bas, mieux c'est.\n\n| Date | Commit | Immobile | Marche | Retour | Zoom | Combat | Donjon | Tour | Lumière | Note |\n|---|---|---|---|---|---|---|---|---|---|---|\n");
  const s = scenes;
  fs.appendFileSync(hist, `| ${stamp} | ${commit} | ${s.immobile.avg} | ${s.marche.avg} | ${s.retour.avg} | ${s.zoom.avg} | ${s.combat.avg} | ${s.donjon?.avg ?? ""} | ${logic.tickMs} | ${logic.lightMs} | ${note} |\n`);
}
if (worse.length) {
  console.log("\nRÉGRESSION (plus lent de 40 % ou plus que le passage précédent) :\n- " + worse.join("\n- "));
  process.exit(1);
}
console.log(prev ? "\nPas de régression par rapport au passage précédent." : "\nPremier passage : il sert de référence.");
