/**
 * Vérification du bilingue (Thomas, 2026-11-12 : « développe en bilingue ») : relève tous les textes en français du code
 * et de la page, et échoue si l'un d'eux n'a pas sa traduction dans `src/i18n/en.ts`.
 * `node scripts/i18n-check.cjs` : vérifie ; `--list` : écrit la liste des textes manquants (JSON) sur la sortie.
 */
const ts = require('typescript5');
const fs = require('fs'); const path = require('path');
const root = path.resolve(__dirname, '..');
function walk(d, out=[]) { for (const f of fs.readdirSync(d)) { const p = path.join(d,f); if (fs.statSync(p).isDirectory()) { if (!/(sprites|i18n)$/.test(p)) walk(p,out); } else if (p.endsWith('.ts')) out.push(p); } return out; }
const files = walk(path.join(root,'src'));
const keys = new Map();
const fr = (s) => {
  const t = s.trim();
  if (t.length < 2) return false;
  if (/^[#.]?[a-z0-9_\-]+$/.test(t)) return false; // ids
  if (/^(rgba?|translate|scale|rotate|repeating|linear|radial|cubic|inset|url|hsl)\(/.test(t)) return false;
  if (/^[.\-#KWRGBYOXxSDEeVUuIiTtLlPpHhAaNnCcZzFfJjQkmyr0-9]{8,}$/.test(t) && !/^[A-ZÉ][a-zé]+$/.test(t)) return false; // pixel rows
  if (/[;{}]/.test(t) && /:/.test(t) && !/[«»]/.test(t)) return false; // css
  if (/[À-ÿ«»]/.test(t)) return true;
  if (/[A-Za-z]/.test(t) && /\s/.test(t)) return true;
  if (/^[A-ZÉ][a-zé]+[ !?.]*$/.test(t)) return true;
  if (/^[A-Z ]{3,}$/.test(t)) return true;
  return false;
};
for (const f of files) {
  if (/icons\.ts$|pictos\.ts$/.test(f)) {} 
  const src = ts.createSourceFile(f, fs.readFileSync(f,'utf8'), ts.ScriptTarget.Latest, true);
  const rel = path.relative(root, f);
  const visit = (n) => {
    let k = null;
    if (ts.isStringLiteral(n) || ts.isNoSubstitutionTemplateLiteral(n)) {
      // skip imports, property keys, type literals
      const p = n.parent;
      if (ts.isImportDeclaration(p) || ts.isExportDeclaration(p) || ts.isLiteralTypeNode(p) || (ts.isPropertyAssignment(p) && p.name === n) || ts.isElementAccessExpression(p) && p.argumentExpression === n) {}
      else k = n.text;
    } else if (ts.isTemplateExpression(n)) {
      let s = n.head.text; n.templateSpans.forEach((sp, i) => { s += `{${i}}` + sp.literal.text; }); k = s;
    }
    if (k !== null && fr(k.replace(/\{\d\}/g, ''))) { if (!keys.has(k)) keys.set(k, rel); }
    ts.forEachChild(n, visit);
  };
  visit(src);
}
// template.html text nodes and attributes
const html = fs.readFileSync(path.join(root,'scripts/template.html'),'utf8').replace(/<style>[\s\S]*?<\/style>/g,'').replace(/<script>[\s\S]*?<\/script>/g,'');
for (const m of html.matchAll(/>([^<>]+)</g)) { const t = m[1].trim(); if (t && fr(t)) keys.set(t, 'template.html'); }
for (const m of html.matchAll(/(?:aria-label|title|placeholder)="([^"]+)"/g)) { if (fr(m[1])) keys.set(m[1], 'template.html'); }

const { EN } = loadEN();
function loadEN() {
  const src = fs.readFileSync(path.join(root, 'src/i18n/en.ts'), 'utf8');
  const obj = src.slice(src.indexOf('{', src.indexOf('export const EN')), src.lastIndexOf('}') + 1);
  return { EN: Function('return ' + obj)() };
}
const ignore = new Set(EN_IGNORE());
function EN_IGNORE() {
  try { return JSON.parse(fs.readFileSync(path.join(root, 'src/i18n/ignore.json'), 'utf8')); } catch { return []; }
}
const miss = [...keys].filter(([k]) => !(k in EN) && !(k.trim() in EN) && !ignore.has(k)).map(([k, f]) => ({ k, f }));
if (process.argv.includes('--list')) { console.log(JSON.stringify(miss, null, 1)); process.exit(0); }
if (miss.length) {
  console.error(`i18n : ${miss.length} texte(s) sans traduction anglaise (src/i18n/en.ts) :`);
  for (const m of miss.slice(0, 40)) console.error(`  ${m.f} : ${JSON.stringify(m.k)}`);
  process.exit(1);
}
console.log(`i18n : ${keys.size} textes, tous traduits.`);
