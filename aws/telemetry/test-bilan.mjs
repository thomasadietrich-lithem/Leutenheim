// Essai sans AWS du calcul du tableau de bord : lit le code de la fonction « caveroller-stats-bilan » directement
// dans cloudformation.yaml (une seule copie du code), lui donne de faux événements et vérifie le résultat.
//   node aws/telemetry/test-bilan.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const yaml = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "cloudformation.yaml"), "utf8");
const start = yaml.indexOf("ZipFile: |", yaml.indexOf("FunctionName: caveroller-stats-bilan"));
const lines = yaml.slice(start).split("\n").slice(1);
const code = [];
for (const line of lines) { if (line.trim() && !line.startsWith("          ")) break; code.push(line.slice(10)); }
const mod = { exports: {} };
new Function("require", "exports", "module", "process", code.join("\n"))(() => ({}), mod.exports, mod, { env: {} });
const { build, code: playerCode } = mod.exports;

const now = Date.UTC(2026, 10, 24, 12), H = 3600000;
const ev = (run, e, t, more = {}) => ({ run, e, t: now - t * H, device: "appareil-" + run[0], version: "0.3.0", platform: "web", ...more });
const out = build([
  ev("a1", "run_start", 50, { race: "elfe" }), ev("a1", "floor", 49, { depth: 2, level: 2, turn: 150, gold: 30 }),
  ev("a1", "quest", 49, { id: "cloche", what: "start" }), ev("a1", "quest", 48, { id: "cloche", what: "complete" }),
  ev("a1", "death", 48, { depth: 3, level: 3, turn: 400, gold: 55, cause: "rat", deepest: 3 }),
  ev("a2", "run_start", 40, { race: "humain" }), ev("a2", "death", 39, { depth: 5, cause: "tisseuse", deepest: 5 }), ev("a2", "revive", 38.9),
  ev("a2", "boss_kill", 38, { depth: 5 }), ev("a2", "demo_end", 30, { deepest: 15, bosses: 3 }),
  ev("b1", "run_start", 30, { race: "halfelin" }), ev("b1", "floor", 29, { depth: 2 }),
  ev("b2", "run_start", 1, { race: "humain" }),
  ev("c1", "run_start", 5, { race: "elfe", test: true }),
  { e: "floor", depth: 9 }, null,
], now);
const by = Object.fromEntries(out.runs.map((r) => [r.race + "/" + r.end, r]));
assert.equal(out.runs.length, 4, "la partie d'essai et les lignes sans numéro sont écartées");
assert.deepEqual({ end: by["elfe/mort"].end, cause: by["elfe/mort"].cause, deepest: by["elfe/mort"].deepest, level: by["elfe/mort"].level, gold: by["elfe/mort"].gold }, { end: "mort", cause: "rat", deepest: 3, level: 3, gold: 55 });
assert.equal(by["humain/fin"].deepest, 15, "ressuscité puis fin de la démo");
assert.equal(by["humain/fin"].bosses, 1);
assert.equal(by["humain/fin"].cause, "");
assert.ok(by["halfelin/abandon"], "sans nouvelle depuis plus d'un jour : abandon");
assert.ok(by["humain/en cours"], "partie récente sans fin : en cours");
assert.deepEqual(out.quests, [{ day: by["elfe/mort"].day, version: "0.3.0", platform: "web", race: "elfe", device: "KFJC7", id: "cloche", what: "réussie" }]);
assert.ok(out.runs.every((r) => /^[A-HJ-NP-Z2-9]{5}$/.test(r.device)), "seul le code joueur sort, jamais le numéro d'appareil");
assert.equal(playerCode("appareil-a"), "KFJC7", "même calcul que playerCode dans le jeu");
assert.equal(new Set(out.runs.map((r) => r.device)).size, 2, "a1 et a2 viennent du même appareil");
assert.equal(out.genere, "2026-11-24");
assert.equal(out.maj, "2026-11-24T12:00:00.000Z", "heure du calcul, pour l'afficher dans la page");
console.log("Bilan : tous les essais passent (" + out.runs.length + " parties).");

// --- Étiquettes : le filtre de la fonction « caveroller-stats-etiquettes », lu lui aussi dans le modèle.
const startTags = yaml.indexOf("ZipFile: |", yaml.indexOf("FunctionName: caveroller-stats-etiquettes"));
const codeTags = [];
for (const line of yaml.slice(startTags).split("\n").slice(1)) { if (line.trim() && !line.startsWith("          ")) break; codeTags.push(line.slice(10)); }
const modTags = { exports: {} };
new Function("require", "exports", "module", "process", codeTags.join("\n"))(() => ({}), modTags.exports, modTags, { env: {} });
const { clean, handler } = modTags.exports;
assert.deepEqual(clean({ KFJC7: "  Florian  ", S9GCP: "" }), { KFJC7: "Florian" }, "prénom nettoyé, étiquette vide retirée");
assert.deepEqual(clean({ KFJC7: "<img src=x onerror=alert(1)>" }), { KFJC7: "img src=x onerror=alert(1)" }, "signes dangereux retirés");
assert.equal(clean({ "../x": "a" }), null, "code invalide : tout est refusé");
assert.equal(clean({ KFJC7: 12 }), null, "prénom qui n'est pas un texte : refusé");
assert.equal(clean([1, 2]), null);
assert.equal(clean({ KFJC7: "x".repeat(80) }).KFJC7.length, 30, "30 signes au plus");
const call = (method, headers, body) => handler({ requestContext: { http: { method } }, headers, body });
assert.equal((await call("POST", { "content-type": "application/json" }, "{}")).statusCode, 405, "seul PUT est accepté");
assert.equal((await call("PUT", { "content-type": "text/plain" }, "{}")).statusCode, 415);
assert.equal((await call("PUT", { "content-type": "application/json", "sec-fetch-site": "cross-site" }, "{}")).statusCode, 403, "appel venu d'un autre site : refusé");
assert.equal((await call("PUT", { "content-type": "application/json" }, "pas du json")).statusCode, 400);
assert.equal((await call("PUT", { "content-type": "application/json" }, "x".repeat(30000))).statusCode, 413);
console.log("Étiquettes : tous les essais passent.");

