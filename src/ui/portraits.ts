/** Portraits de l'encyclopédie : les vrais sprites du jeu, figés sur une image. */
import { buildIcon } from "./icons";
import { SCHRAT, SCHRAT_PALETTE } from "../render/sprites/schrat";
import { ARAIGNEE } from "../render/sprites/araignee";
import { BOSS } from "../render/sprites/boss";
import { BAIN } from "../render/sprites/bain";
import { SOEUR_PALETTE, SOEUR_SPRITE } from "../render/sprites/soeur";
import { FERMIER } from "../render/sprites/ferme";
import { MARCHAND, MARCHAND_PALETTE } from "../render/sprites/marchand";
import { POULET, POULET_PALETTE } from "../render/sprites/poulet";
import { FIFRELIN_PALETTE, FRONDEUR_PALETTE, GLUCK_PALETTE, KRIK_PALETTE } from "../render/renderer";

type Pic = { rows: readonly string[]; palette: Record<string, string> };
const kobold = (palette: Record<string, string>): Pic => ({ rows: SCHRAT.idleDown[0], palette });

const PORTRAITS: Record<string, Pic> = {
  "m:schrat": kobold(SCHRAT_PALETTE),
  "m:frondeur": kobold(FRONDEUR_PALETTE),
  "m:araignee": ARAIGNEE.idle0,
  "m:tisseuse": BOSS.tisseuse_idle0,
  "n:gluck": kobold(GLUCK_PALETTE),
  "n:krik": kobold(KRIK_PALETTE),
  "n:fifrelin": kobold(FIFRELIN_PALETTE),
  "n:compteur": kobold(SCHRAT_PALETTE),
  "n:soeur": { rows: SOEUR_SPRITE[0], palette: SOEUR_PALETTE },
  "n:grum": { rows: FERMIER.rows, palette: FERMIER.palette },
  "n:colporteur": { rows: MARCHAND.front, palette: MARCHAND_PALETTE },
  "n:poulet": { rows: POULET.idle, palette: POULET_PALETTE },
  "n:bain": BAIN.tub0,
};

/** Le portrait d'une créature (« m:id ») ou d'un personnage (« n:id »), ou rien. */
export function portrait(key: string): SVGSVGElement | null {
  const p = PORTRAITS[key];
  return p ? buildIcon(p.rows, p.palette) : null;
}
