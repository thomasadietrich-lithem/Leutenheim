/** Portraits de l'encyclopédie : les vrais sprites du jeu, figés sur une image. */
import { buildIcon } from "./icons";
import { SCHRAT, SCHRAT_PALETTE } from "../render/sprites/schrat";
import { ARAIGNEE } from "../render/sprites/araignee";
import { BOSS } from "../render/sprites/boss";
import { BAIN } from "../render/sprites/bain";
import { SOEUR_PALETTE, SOEUR_SPRITE } from "../render/sprites/soeur";
import { FERMIER } from "../render/sprites/ferme";
import { MOBS_CHAMPI } from "../render/sprites/mobsChampi";
import { MOBS_OSS } from "../render/sprites/mobsOss";
import { CARILLON, CARILLON_PALETTE } from "../render/sprites/carillon";
import { MARCHAND, MARCHAND_PALETTE } from "../render/sprites/marchand";
import { POULET, POULET_PALETTE } from "../render/sprites/poulet";
import { FIFRELIN_PALETTE, FRONDEUR_PALETTE, GLUCK_PALETTE, KRIK_PALETTE, MAESTRO_PALETTE, MORILLON_FRAMES, MORILLON_PALETTE } from "../render/renderer";
import { EXPO } from "../render/sprites/expo";
import { SECRET } from "../render/sprites/secret";
import { CHAPELLE } from "../render/sprites/chapelle";

type Pic = { rows: readonly string[]; palette: Record<string, string> };
const kobold = (palette: Record<string, string>): Pic => ({ rows: SCHRAT.idleDown[0], palette });

const PORTRAITS: Record<string, Pic> = {
  "m:schrat": kobold(SCHRAT_PALETTE),
  "m:frondeur": kobold(FRONDEUR_PALETTE),
  "m:araignee": ARAIGNEE.idle0,
  "m:tisseuse": BOSS.tisseuse_idle0,
  // Le Carillon (boss de la section 2) et son battant (le bas du même dessin).
  "m:carillon": { rows: CARILLON.idle1, palette: CARILLON_PALETTE },
  "m:battant": { rows: CARILLON.idle1.slice(46, 62).map((r) => r.slice(16, 32)), palette: CARILLON_PALETTE },
  // Section 2 (planche art/mobs_champi_v1.png).
  ...Object.fromEntries(["myconide", "sporelin", "cueilleur", "envahi"].map((id) => [`m:${id}`, { rows: MOBS_CHAMPI[id].frames.idleDown0, palette: MOBS_CHAMPI[id].palette }])),
  ...Object.fromEntries(Object.keys(MOBS_OSS).map((id) => [`m:${id}`, { rows: MOBS_OSS[id].frames.idleDown0, palette: MOBS_OSS[id].palette }])),
  "n:gluck": kobold(GLUCK_PALETTE),
  "n:krik": kobold(KRIK_PALETTE),
  "n:fifrelin": kobold(FIFRELIN_PALETTE),
  "n:compteur": kobold(SCHRAT_PALETTE),
  "n:soeur": { rows: SOEUR_SPRITE[0], palette: SOEUR_PALETTE },
  "n:grum": { rows: FERMIER.rows, palette: FERMIER.palette },
  "n:morillon": { rows: MORILLON_FRAMES.idleDown0, palette: MORILLON_PALETTE },
  "n:vernis": { rows: EXPO.vernis.rows, palette: EXPO.vernis.palette },
  "n:maestro": { rows: SCHRAT.idleDown[0], palette: MAESTRO_PALETTE },
  "n:plumeau": { rows: SECRET.plumeau0.rows, palette: SECRET.plumeau0.palette },
  "n:osselet": { rows: MOBS_OSS.conservateur.frames.idleDown0, palette: MOBS_OSS.conservateur.palette },
  "n:clavicule": { rows: CHAPELLE.clavicule0.rows, palette: CHAPELLE.clavicule0.palette },
  "n:colporteur": { rows: MARCHAND.front, palette: MARCHAND_PALETTE },
  "n:poulet": { rows: POULET.idle, palette: POULET_PALETTE },
  "n:bain": BAIN.tub0,
};

/** Le portrait d'une créature (« m:id ») ou d'un personnage (« n:id »), ou rien. */
export function portrait(key: string): SVGSVGElement | null {
  const p = PORTRAITS[key];
  return p ? buildIcon(p.rows, p.palette) : null;
}
