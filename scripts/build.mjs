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
    // Version publique (GitHub Pages, pour les copains) : sans la salle d'essai (Thomas, 2026-11-12).
    define: { __PUBLIC__: process.argv.includes("--public") ? "true" : "false" },
    logLevel: "warning",
  });
  const js = result.outputFiles[0].text.replaceAll("</script", "<\\/script");
  const html = readFileSync("scripts/template.html", "utf8").replace("/*__BUNDLE__*/", () => js);
  mkdirSync("demo", { recursive: true });
  writeFileSync("demo/index.html", html);
  console.log(`demo/index.html : ${(html.length / 1024).toFixed(1)} Ko`);
}
