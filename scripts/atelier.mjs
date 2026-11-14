// Atelier (Thomas, 2026-11-13) : deux pages autonomes, lues directement dans les fichiers du jeu.
//   demo/catalogue.html : tout le matériel du jeu (objets, créatures, personnages, mobilier, états, concepts, planches).
//   demo/quetes.html    : le deck des quêtes et de leurs zones spéciales.
// `node scripts/atelier.mjs`. Les planches à afficher sont listées ci-dessous (PNG de art/, embarqués).
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const PLANCHES = [
  ["paperdoll_v1.png", "Paperdoll v1 — le Guerrier change avec son équipement", "Proposition (2026-11-13) : couches de 24 × 24, trois races, nouvelles armures et casques. Rien en jeu."],
  ["a_terre_v1.png", "À terre v1 — Kobold et frondeur renversés", "Proposition (2026-11-14) : sur le dos mais vivants (œil ouvert, pattes qui pédalent), puis « il se relève ». À valider."],
  ["araignee_v2.png", "Araignée v2 — plus animée", "EN JEU (2026-11-14) : repos ×4, marche ×4, aux aguets ×2, morsure ×2, à terre ×2."],
  ["escaliers_v3.png", "Escaliers v3 — 14 escaliers droits", "La n° 3 (pierre fendue) est EN JEU (2026-11-14) ; les autres sont gardées (src/render/sprites/escaliers.ts)."],
  ["heros_v10.png", "Notre héros, niveau 1 — 16 designs originaux", "Proposition (2026-11-14) : même personnage et même équipement de départ, 16 façons différentes de le dessiner. On choisit, puis on fait les variations. Gardé de la v9 : le n° 2 (apprenti garde) plaît."],
  ["ferme_v2.png", "Ferme v2", "Validée et EN JEU (pré clos, poules) ; Grum le fermier et les statues à faire."],
  ["salle_bain_v1.png", "Salle de bain du Kobold", "EN JEU."],
  ["soeur_v1.png", "Sœur Osseuse", "EN JEU ; dessin à valider."],
  ["trainards_v3.png", "Trainards v3", "Validés : tonneau, caisses, botte de paille, squelette à butin, grille ronde."],
];

const font = readFileSync("node_modules/@fontsource/vt323/files/vt323-latin-400-normal.woff2").toString("base64");
const planches = PLANCHES.map(([file, title, note]) => ({ title, note, src: `data:image/png;base64,${readFileSync(`art/${file}`).toString("base64")}` }));

const CSS = `
@font-face { font-family: "VT323"; src: url(data:font/woff2;base64,${font}) format("woff2"); }
* { box-sizing: border-box; }
html, body { margin: 0; background: #1a140e; color: #eadfc4; font-family: "VT323", "Courier New", monospace; font-size: 19px; }
button { font: inherit; color: inherit; cursor: pointer; }
h1, h2, h3 { font-weight: normal; letter-spacing: 1px; color: #ffe9b0; margin: 8px 0; }
#app { max-width: 980px; margin: 0 auto; padding: 10px; }
.tabs { display: flex; flex-wrap: wrap; gap: 6px; position: sticky; top: 0; background: #1a140e; padding: 8px 0; z-index: 2; }
.tabs button { background: #3a2f22; border: 2px solid #6a5634; padding: 4px 10px; }
.tabs button.on { background: #f0c050; color: #1a140e; border-color: #ffe27a; }
.search { width: 100%; font: inherit; padding: 6px 10px; background: #2a2219; color: #eadfc4; border: 2px solid #6a5634; margin: 4px 0 8px; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(104px, 1fr)); gap: 8px; }
.card { background: #2a2219; border: 2px solid #4a3c28; padding: 8px 4px 6px; display: flex; flex-direction: column; align-items: center; gap: 6px; position: relative; min-height: 104px; justify-content: flex-end; }
.card canvas { image-rendering: pixelated; max-width: 96px; max-height: 96px; }
.card .name { font-size: 15px; line-height: 1; text-align: center; }
.card .dot { position: absolute; top: 5px; left: 5px; width: 9px; height: 9px; }
.detail { position: fixed; inset: auto 0 0 0; max-height: 75vh; overflow: auto; background: #241c14; border-top: 3px solid #f0c050; padding: 12px 16px 20px; z-index: 5; text-align: center; }
.detail .close { position: absolute; right: 10px; top: 6px; background: none; border: none; font-size: 30px; }
.detail .bigsprite { image-rendering: pixelated; max-width: 90vw; background: #3a3046; padding: 8px; }
.detail .group { color: #b8a888; }
.badge { display: inline-block; padding: 1px 8px; color: #1a140e; margin: 6px; }
.palette { display: flex; flex-wrap: wrap; gap: 3px; justify-content: center; margin-top: 8px; }
.swatch { width: 16px; height: 16px; border: 1px solid #000; }
.planche { margin: 0 0 22px; }
.planche img { width: 100%; image-rendering: pixelated; border: 2px solid #4a3c28; }
.planche figcaption { font-size: 22px; color: #ffe9b0; }
.note, .empty { color: #b8a888; margin: 2px 0 6px; }
/* Deck */
.stage { min-height: calc(100vh - 110px); }
.slide { padding: 6px 4px 20px; }
.kicker { color: #f0c050; text-transform: uppercase; font-size: 16px; letter-spacing: 1px; }
.slide h1 { font-size: 30px; line-height: 1.05; }
.status { display: inline-block; background: #3a2f22; border: 1px solid #6a5634; padding: 0 8px; color: #b8e05a; margin-bottom: 6px; }
.lead { color: #d8ccb0; font-size: 20px; }
.bullets li, .how li { margin: 6px 0; line-height: 1.15; }
.choices { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; margin: 10px 0; }
.choice { background: #2a2219; border: 2px solid #4a3c28; padding: 8px 10px; line-height: 1.15; }
.choice .pick { color: #ffe9b0; font-size: 21px; margin-bottom: 4px; }
.choice .roll { float: right; font-size: 15px; color: #9fd0f4; }
.choice .goal { color: #f4e4c0; margin: 4px 0; }
.choice .win { color: #9fe0a0; margin: 4px 0; }
.choice .fail { color: #ff9a8a; margin: 4px 0; }
.zonebox { background: #221a13; border: 2px solid #6a5634; padding: 8px 10px; margin-top: 10px; }
.zone { display: flex; flex-wrap: wrap; gap: 12px; align-items: flex-start; }
.zone canvas { image-rendering: pixelated; border: 2px solid #000; max-width: 100%; }
.legend { display: flex; flex-direction: column; gap: 2px; font-size: 16px; color: #d8ccb0; }
.gallery { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-top: 8px; }
.gcard { background: #2a2219; border: 2px solid #4a3c28; padding: 8px; display: flex; flex-direction: column; align-items: center; gap: 4px; text-align: center; }
.gcard canvas { image-rendering: pixelated; }
.gcard small { color: #b8a888; font-size: 15px; line-height: 1.05; }
.nav { position: sticky; bottom: 0; display: flex; justify-content: space-between; align-items: center; background: #1a140e; padding: 6px 0; border-top: 2px solid #4a3c28; }
.nav button { background: #3a2f22; border: 2px solid #6a5634; width: 64px; height: 44px; font-size: 30px; }
.dots { display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; padding: 6px 0 10px; }
.dots button { width: 12px; height: 12px; background: #4a3c28; border: none; padding: 0; }
.dots button.on { background: #f0c050; }
`;

mkdirSync("demo", { recursive: true });
for (const [entry, out, title] of [
  ["scripts/atelier/catalogue.ts", "demo/catalogue.html", "Cave Roller — catalogue du matériel"],
  ["scripts/atelier/quetes.ts", "demo/quetes.html", "Cave Roller — quêtes et zones spéciales"],
]) {
  const res = await build({
    entryPoints: [entry],
    bundle: true,
    format: "iife",
    write: false,
    minify: true,
    target: "es2020",
    define: { __PLANCHES__: JSON.stringify(planches) },
    logLevel: "error",
  });
  const js = res.outputFiles[0].text.replace(/<\/script/g, "<\\/script");
  const html = `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${CSS}</style></head><body><div id="app"></div><script>${js}</script></body></html>`;
  writeFileSync(out, html);
  console.log(out, Math.round(html.length / 1024), "Ko");
}
