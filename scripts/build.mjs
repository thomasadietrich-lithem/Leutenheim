// Construit le jeu. Sans option : demo/index.html (fichier unique). Avec --tests : dist/tests.cjs.
// Avec --public : la version publique (sans salle d'essai), même fichier.
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

if (process.argv.includes("--tests")) {
  await build({
    entryPoints: ["tests/sim.test.ts"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: "dist/tests.cjs",
    logLevel: "warning",
  });
} else {
  const result = await build({
    entryPoints: ["src/main.ts"],
    bundle: true,
    format: "iife",
    target: "es2020",
    write: false,
    // Code compacté (audit du 2026-11-13) : 1 047 → 650 Ko de JavaScript, démarrage plus rapide.
    minify: true,
    // Version publique (GitHub Pages, pour les copains) : sans la salle d'essai (Thomas, 2026-11-12).
    define: { __PUBLIC__: process.argv.includes("--public") ? "true" : "false" },
    logLevel: "warning",
  });
  const js = result.outputFiles[0].text.replaceAll("</script", "<\\/script");
  // La police VT323, en base64 dans la page (latin, et latin étendu pour « œ »).
  const font = (subset, range) => {
    const data = readFileSync(`node_modules/@fontsource/vt323/files/vt323-${subset}-400-normal.woff2`).toString("base64");
    return `@font-face{font-family:"VT323";font-style:normal;font-weight:400;font-display:block;src:url(data:font/woff2;base64,${data}) format("woff2");unicode-range:${range};}`;
  };
  const fonts =
    font("latin", "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+2000-206F,U+2074,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD") +
    font("latin-ext", "U+0100-02AF,U+0304,U+0308,U+0329,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF");
  const html = readFileSync("scripts/template.html", "utf8")
    .replace("/*__FONTS__*/", () => fonts)
    .replace("/*__BUNDLE__*/", () => js)
    // Le logo (emblème D2 : le dragon au-dessus du d20, dans son médaillon) et le titre « CAVE ROLLER » (T6), en base64
    // dans la page (fabriqués par `python3 art/logo_d2.py embleme` et `titre`).
    .replaceAll("__LOGO__", () => `data:image/png;base64,${readFileSync("art/logo_embleme.png").toString("base64")}`)
    .replaceAll("__TITRE__", () => `data:image/png;base64,${readFileSync("art/logo_titre.png").toString("base64")}`);
  mkdirSync("demo", { recursive: true });
  writeFileSync("demo/index.html", html);
  console.log(`demo/index.html : ${(html.length / 1024).toFixed(1)} Ko`);
}
