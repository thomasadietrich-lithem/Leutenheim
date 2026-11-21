#!/bin/bash
# BATTERIE COMPLÈTE EN UNE COMMANDE (Thomas, 2026-11-21 : « consommer le moins possible »).
#   bash scripts/batterie.sh "ce qui a changé"        les 4 bots × 3 races, 150 parties, en parallèle (8 à 10 minutes)
#   bash scripts/batterie.sh "note" 60                la même chose en 60 parties (plus rapide, moins précis)
# Garde tout dans stats/bots/ comme `npm run bots`, puis n'affiche qu'un tableau court : c'est ce tableau qu'il faut lire.
cd "$(dirname "$0")/.." || exit 1
NOTE="${1:-passage de routine}"; N="${2:-150}"; T=$(mktemp -d)
node scripts/bots.mjs "$N" "$NOTE" > "$T/humain.txt" 2>&1 &
sleep 12; node scripts/bots.mjs "$N" --race=halfelin "$NOTE" > "$T/halfelin.txt" 2>&1 &
sleep 12; node scripts/bots.mjs "$N" --race=elfe "$NOTE" > "$T/elfe.txt" 2>&1 &
wait
node -e '
const fs=require("fs");const all=fs.readdirSync("stats/bots").filter(f=>f.endsWith(".json")).sort();
const L={debutant:"Débutant",moyen:"Moyen",maitrise:"Maîtrise",expert:"Expert"};
console.log("race     | bot      | étage | †ét.1 | Tisseuse | ét.8 | Carillon | ét.13 | Prêtresse | bloqué");
for(const race of ["humain","halfelin","elfe"]){const f=all.filter(x=>race==="humain"?!/_(halfelin|elfe)\.json$/.test(x):x.endsWith("_"+race+".json")).pop();const r=JSON.parse(fs.readFileSync("stats/bots/"+f));
for(const [k,s] of Object.entries(r.levels))console.log([race.padEnd(8),L[k].padEnd(8),String(s.floor).padStart(5),(s.deathFloor1+" %").padStart(5),(s.boss+" %").padStart(8),((s.reach[8]??"–")+(s.reach[8]!==undefined?" %":"")).padStart(4),((s.boss2??"–")+(s.boss2!==undefined?" %":"")).padStart(8),((s.reach[13]??"–")+(s.reach[13]!==undefined?" %":"")).padStart(5),((s.boss3??"–")+(s.boss3!==undefined?" %":"")).padStart(9),((s.blocked??0)+" %").padStart(6)].join(" | "))}'
grep -l "Error\|rror:" "$T"/*.txt 2>/dev/null | sed "s/^/ERREUR dans /"
