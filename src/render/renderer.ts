import { LightSource } from "../world/fov";
import { Game } from "../core/game";
import { MONSTERS } from "../data/monsters";
import { RULES } from "../data/rules";
import { Actor } from "../entities/actor";
import { Point, Tile } from "../world/map";
import { GUERRIER, GUERRIER_PALETTE } from "./sprites/guerrier";
import { SCHRAT, SCHRAT_PALETTE } from "./sprites/schrat";
import { BLOOD, FIRE_FRAMES, GOLD_PILES, PALETTE as ICON_PALETTE, STATUS_ICONS, itemIconRows, uiIconRows } from "../ui/icons";
import { goldRange } from "../data/loot";
import { DORTOIR } from "./sprites/dortoir";
import { TRAINARDS } from "./sprites/trainards";
import { ARAIGNEE } from "./sprites/araignee";
import { PIEGES } from "./sprites/pieges";
import { SALLES } from "./sprites/salles";
import { FURNITURE_KINDS, isFlat } from "../data/themedRooms";
import { furnitureCells } from "../world/furnish";
import { COLORS, TilePainter } from "./tiles";

/** Nombre de cases visibles en largeur (écran portrait) : valeur de départ et limites du zoom. */
const COLUMNS = 11;
const MIN_COLUMNS = 6;
const MAX_COLUMNS = 28;

/** Durée de vie d'un texte flottant (dégâts, « Raté »), en ms. */
const FLOAT_MS = 900;



/** Durée d'un coup (élan de l'attaquant + trace de la lame), en ms. */
const SLASH_MS = 220;
/** Durée du geste de tir à l'arc, et de la grimace quand le héros est blessé. */
const BOW_MS = 320;
const HURT_MS = 260;
const CORPSE_MS = 1400;
type Facing = "down" | "up" | "left" | "right";

/** Un coup porté de (fromX, fromY) vers (x, y). */
interface Slash {
  attackerId: number;
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  color: string;
  age: number;
  /** Faux : simple élan sans trace de lame (rebond contre une porte). */
  arc: boolean;
}

/** Une flèche en vol. */
interface Projectile {
  fromX: number;
  fromY: number;
  x: number;
  y: number;
  age: number;
  /** Vrai : la flèche tournoie (après un rebond). */
  tumble: boolean;
}
const PROJECTILE_MS = 170;

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  age: number;
}

/** Dessine l'état du jeu sur le Canvas. Design volontairement minimal : des formes colorées. */
export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  /**
   * Dessin de chaque case (sol, mur, porte, coffre…) gardé en mémoire : il ne dépend que de la carte autour de la case,
   * on ne le refait que si elle change (porte ouverte, coffre vidé) ou si le zoom change. Les ombres, la lumière et
   * les flammes, elles, sont dessinées à chaque image par-dessus.
   */
  private readonly cellCache = new Map<number, { key: string; stamp: number; canvas: HTMLCanvasElement }>();
  /** Nombre de cases redessinées depuis le début (pour mesurer l'effet du cache). */
  cellRedraws = 0;
  private width = 0;
  private height = 0;
  private tile = 32;
  private columns = COLUMNS;
  private camX = 0;
  private camY = 0;
  /** Décalage de la vue par rapport au héros, en cases (quand le joueur a fait glisser la carte). */
  private panX = 0;
  private panY = 0;
  private time = 0;
  private floats: FloatingText[] = [];
  /** Gouttes qui jaillissent d'un personnage touché (micro-animation), et ondes du bruit. */
  private drops: { x: number; y: number; vx: number; vy: number; color: string; age: number; life: number }[] = [];
  private ripples: { x: number; y: number; strength: number; age: number }[] = [];
  private slashes: Slash[] = [];
  private projectiles: Projectile[] = [];
  /** Animation du héros : de quel côté il regarde, et depuis combien de temps il tire ou encaisse. */
  private heroFacing: Facing = "down";
  private bowAge = Infinity;
  private hurtAge = Infinity;
  /** Monstres : où chacun regarde, et depuis quand il a été touché (en ms). */
  private monsterFacing = new Map<number, Facing>();
  private monsterHurtAge = new Map<number, number>();
  /** Monstres vaincus : leur corps reste un instant au sol avant de s'effacer. */
  private corpses: { actor: Actor; age: number; facing: Facing }[] = [];
  private heroDown = false;
  private readonly spriteCache = new Map<readonly string[], HTMLCanvasElement>();

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    this.width = rect.width;
    this.height = rect.height;
    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.tile = this.snapTile();
  }

  /** Pixels réels de l'écran par pixel de page (2 ou 3 sur un téléphone). */
  private dpr(): number {
    return window.devicePixelRatio || 1;
  }

  /**
   * Taille d'une case, arrondie à un nombre entier de pixels de l'écran : toutes les cases ont alors exactement la même
   * taille. Sinon, quand la vue glisse, chaque case grandit et rétrécit d'un pixel tour à tour : la carte « gigote » et
   * les cases gardées en mémoire doivent être redessinées sans cesse.
   */
  private snapTile(): number {
    const dpr = this.dpr();
    return Math.max(1, Math.round((this.width / this.columns) * dpr)) / dpr;
  }

  /** Arrondit une position au pixel réel de l'écran le plus proche. */
  private snap(v: number): number {
    const dpr = this.dpr();
    return Math.round(v * dpr) / dpr;
  }

  /** Zoom : facteur > 1 pour agrandir les cases, < 1 pour en voir davantage. */
  zoomBy(factor: number): void {
    this.columns = Math.min(MAX_COLUMNS, Math.max(MIN_COLUMNS, this.columns / factor));
    this.tile = this.snapTile();
  }

  /** Fait glisser la vue de quelques pixels ; elle reste décalée jusqu'au recentrage. */
  panBy(dxPixels: number, dyPixels: number): void {
    const limit = 24;
    const nx = Math.max(-limit, Math.min(limit, this.panX - dxPixels / this.tile));
    const ny = Math.max(-limit, Math.min(limit, this.panY - dyPixels / this.tile));
    // On déplace aussi la caméra tout de suite, pour que la carte suive le doigt sans retard.
    this.camX += nx - this.panX;
    this.camY += ny - this.panY;
    this.panX = nx;
    this.panY = ny;
  }

  /** Ramène la vue sur le héros (en douceur). */
  recenter(): void {
    this.panX = 0;
    this.panY = 0;
  }

  isPanned(): boolean {
    return Math.abs(this.panX) > 0.5 || Math.abs(this.panY) > 0.5;
  }

  /** Recentre immédiatement la vue (nouvel étage). */
  snapTo(game: Game): void {
    this.panX = 0;
    this.panY = 0;
    this.camX = game.hero.x;
    this.camY = game.hero.y;
    this.floats = [];
    this.cellCache.clear();
    this.slashes = [];
    this.projectiles = [];
    this.bowAge = Infinity;
    this.hurtAge = Infinity;
    this.heroDown = game.over && game.hero.hp <= 0;
  }

  /** Le héros tire à l'arc dans cette direction : il se tourne et tend son arc. */
  heroShoots(dx: number, dy: number): void {
    this.face(dx, dy);
    this.bowAge = 0;
  }

  /** Le héros vient d'être blessé. */
  /** Moment où chaque piège (par case « x,y ») s'est déclenché : il se montre « déclenché » un instant. */
  private trapFlash = new Map<string, number>();

  trapSprung(x: number, y: number): void {
    this.trapFlash.set(`${x},${y}`, performance.now());
  }

  heroHurt(): void {
    this.hurtAge = 0;
  }

  /** Un monstre vient d'être blessé : il s'éclaire un instant. */
  monsterHurt(id: number): void {
    this.monsterHurtAge.set(id, 0);
  }

  /** Un monstre est vaincu : son corps reste étendu une seconde, puis s'efface. */
  monsterDies(actor: Actor): void {
    this.corpses.push({ actor, age: 0, facing: this.monsterFacing.get(actor.id) ?? "down" });
  }

  /** Le héros est tombé : il reste étendu au sol. */
  heroFalls(): void {
    this.heroDown = true;
  }

  private face(dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;
    this.heroFacing = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
  }

  /** Une image de sprite (rangées de lettres) peinte une fois pour toutes sur un petit canevas 16×16. */
  private sprite(rows: readonly string[], palette: Record<string, string> = GUERRIER_PALETTE): HTMLCanvasElement {
    let c = this.spriteCache.get(rows);
    if (!c) {
      c = document.createElement("canvas");
      c.width = rows[0].length;
      c.height = rows.length;
      const g = c.getContext("2d")!;
      rows.forEach((row, y) => {
        for (let x = 0; x < row.length; x++) {
          const color = palette[row[x]];
          if (!color) continue;
          g.fillStyle = color;
          g.fillRect(x, y, 1, 1);
        }
      });
      this.spriteCache.set(rows, c);
    }
    return c;
  }

  /** Le héros : son sprite selon ce qu'il fait (repos, marche, coup d'épée, tir, blessure, mort) et où il regarde. */
  private drawHero(game: Game, at: Point, ox: number, oy: number, progress: number): void {
    const { ctx, tile } = this;
    const h = game.hero;
    const mdx = h.x - h.fromX;
    const mdy = h.y - h.fromY;
    const moving = progress < 1 && (mdx !== 0 || mdy !== 0);
    const slash = this.slashes.find((sl) => sl.attackerId === h.id);
    if (slash) this.face(slash.x - slash.fromX, slash.y - slash.fromY);
    else if (moving && this.bowAge >= BOW_MS) this.face(mdx, mdy);
    const dir = this.heroFacing === "down" ? "Down" : this.heroFacing === "up" ? "Up" : "Side";
    let rows: readonly string[];
    if (this.heroDown) rows = GUERRIER.dead[0];
    else if (this.hurtAge < HURT_MS) rows = GUERRIER.hurt[0];
    else if (slash) rows = GUERRIER[`sword${dir}`][Math.min(2, Math.floor((3 * slash.age) / SLASH_MS))];
    else if (this.bowAge < BOW_MS) rows = GUERRIER[`bow${dir}`][this.bowAge < BOW_MS * 0.5 ? 0 : 1];
    else if (moving) rows = GUERRIER[`walk${dir}`][(((h.x + h.y) & 1) * 2 + (progress < 0.5 ? 0 : 1)) % 4];
    else {
      const idle = GUERRIER[`idle${dir}`];
      // Le temps peut être très légèrement négatif à la toute première image : on prend sa valeur absolue.
      rows = idle[Math.floor(Math.abs(this.time) / 520) % idle.length];
    }
    const cx = ox + (at.x + 0.5) * tile;
    const cy = oy + (at.y + 0.5) * tile;
    // Ombre au sol.
    ctx.fillStyle = "rgba(10,8,16,0.45)";
    ctx.beginPath();
    ctx.ellipse(cx, cy + tile * 0.4, tile * 0.3, tile * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    // Le sprite dépasse un peu de sa case pour que le personnage ait la taille d'un occupant, armes comprises.
    const size = Math.round(tile * 1.3);
    const top = Math.round(cy - size / 2 - tile * 0.12);
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(Math.round(cx), 0);
    if (this.heroFacing === "left") ctx.scale(-1, 1);
    // Caché : le héros devient gris et à demi effacé.
    if (game.hidden) {
      ctx.globalAlpha = 0.55;
      ctx.filter = "grayscale(1) brightness(0.8)";
    }
    ctx.drawImage(this.sprite(rows), -size / 2, top, size, size);
    ctx.restore();
    ctx.imageSmoothingEnabled = smooth;
  }

  private smoke: { x: number; y: number; age: number; life: number; drift: number; size: number }[] = [];

  /** Fumée des feux : des volutes grises qui montent, grossissent et s'effacent (en cases, depuis le haut de la flamme). */
  private drawSmoke(game: Game, ox: number, oy: number, dt: number): void {
    const { ctx, tile } = this;
    for (const f of game.fires) {
      if (!game.isVisible(f.x, f.y)) continue;
      if (Math.random() < dt / 260) {
        this.smoke.push({ x: f.x + 0.3 + Math.random() * 0.4, y: f.y + 0.15, age: 0, life: 1400 + Math.random() * 900, drift: (Math.random() - 0.5) * 0.35, size: 0.16 + Math.random() * 0.1 });
      }
    }
    if (this.smoke.length > 160) this.smoke.splice(0, this.smoke.length - 160);
    this.smoke = this.smoke.filter((p) => (p.age += dt) < p.life);
    for (const p of this.smoke) {
      const t = p.age / p.life;
      const x = ox + (p.x + p.drift * t) * tile;
      const y = oy + (p.y - 1.3 * t) * tile;
      const r = tile * (p.size + 0.28 * t);
      ctx.fillStyle = `rgba(70,66,74,${(0.32 * (1 - t) * Math.min(1, t * 6)).toFixed(3)})`;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  /** Des flammes sur une case (cases en feu, ou personnage qui brûle). */
  private drawFlames(gx: number, gy: number, seed: number, alpha: number): void {
    const { ctx, tile } = this;
    const frame = FIRE_FRAMES[(Math.floor(this.time / 130) + seed) % FIRE_FRAMES.length];
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = alpha;
    const rx = this.snap(gx);
    const ry = this.snap(gy);
    ctx.drawImage(this.sprite(frame, ICON_PALETTE), rx, ry, this.snap(gx + tile) - rx, this.snap(gy + tile) - ry);
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = smooth;
  }

  /** Les statuts d'un monstre en petites bulles au-dessus de sa tête (empoisonné, ralenti, sonné, en feu). */
  private drawStatusBubbles(m: Actor, cx: number, cy: number, burning: boolean): void {
    const { ctx, tile } = this;
    const icons: (keyof typeof STATUS_ICONS)[] = [];
    if (m.poison) icons.push("poison");
    if (burning) icons.push("feu");
    if (m.slowed) icons.push("ralenti");
    if (m.stunned) icons.push("sonne");
    if (icons.length === 0) return;
    const s = Math.max(10, Math.round(tile * 0.36));
    const gap = 3;
    const total = icons.length * s + (icons.length - 1) * gap;
    let x = Math.round(cx - total / 2);
    const y = Math.round(cy - tile * 0.98);
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    for (const id of icons) {
      ctx.fillStyle = "rgba(20,15,10,0.9)";
      ctx.fillRect(x - 2, y - 2, s + 4, s + 4);
      ctx.strokeStyle = "#d6aa54";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 2, y - 2, s + 4, s + 4);
      ctx.drawImage(this.sprite(STATUS_ICONS[id], ICON_PALETTE), x, y, s, s);
      x += s + gap;
    }
    ctx.imageSmoothingEnabled = smooth;
  }

  /** Un objet posé au sol : son icône, réduite pour tenir dans la case (les longues armes en diagonale). */
  private drawGroundIcon(rows: readonly string[], gx: number, gy: number): void {
    const { ctx, tile } = this;
    const w = rows[0].length;
    const h = rows.length;
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(this.snap(gx + tile / 2), this.snap(gy + tile / 2));
    const long = h > w;
    if (long) ctx.rotate(Math.PI / 4);
    const scale = (tile * (long ? 1.05 : 0.8)) / Math.max(w, h);
    ctx.drawImage(this.sprite(rows, ICON_PALETTE), (-w * scale) / 2, (-h * scale) / 2, w * scale, h * scale);
    ctx.restore();
    ctx.imageSmoothingEnabled = smooth;
  }

  /** Le Schrat : repos, marche, coup de dague, blessure ou sommeil, tourné vers où il va ou vers sa cible. */
  private drawMonster(m: Actor, cx: number, cy: number, progress: number): void {
    const mdx = m.x - m.fromX;
    const mdy = m.y - m.fromY;
    const moving = progress < 1 && (mdx !== 0 || mdy !== 0);
    const slash = this.slashes.find((sl) => sl.attackerId === m.id);
    // Vers où il regarde : c'est la partie qui le décide (son éventail de vue compte pour vous remarquer).
    const facing: Facing = m.facing ?? this.monsterFacing.get(m.id) ?? "down";
    this.monsterFacing.set(m.id, facing);
    const dir = facing === "down" ? "Down" : facing === "up" ? "Up" : "Side";
    const hurt = (this.monsterHurtAge.get(m.id) ?? Infinity) < HURT_MS;
    if (m.defId === "araignee") {
      // L'araignée (planche art/araignee_v1.png) : une seule vue de 3/4, retournée quand elle va à gauche.
      const name = slash || hurt ? "bite" : moving ? (progress < 0.5 ? "walk0" : "walk1") : m.asleep ? "idle0" : `idle${Math.floor((Math.abs(this.time) + m.id * 170) / 380) % 2}`;
      if (!m.asleep) this.drawGaze(cx, cy, facing, m.alerted, m.vision);
      this.drawMonsterSprite(ARAIGNEE[name].rows, cx, cy, facing === "left", true, ARAIGNEE[name].palette);
      return;
    }
    let rows: readonly string[];
    if (m.asleep) rows = SCHRAT.sleep[0];
    else if (hurt) rows = SCHRAT.hurt[0];
    else if (slash) rows = SCHRAT[`stab${dir}`][slash.age < SLASH_MS * 0.45 ? 0 : 1];
    else if (moving) rows = SCHRAT[`walk${dir}`][progress < 0.5 ? 0 : 1];
    else rows = SCHRAT[`idle${dir}`][Math.floor((Math.abs(this.time) + m.id * 170) / 560) % 2];
    // Regard (Thomas : « très discret et très fin ») : un mince éventail clair qui part vers où il regarde,
    // ambré s'il ne vous a pas vu, rouge s'il vous traque. Pas de regard quand il dort.
    if (!m.asleep) this.drawGaze(cx, cy, facing, m.alerted, m.vision);
    // Le profil « touché » regarde à droite : on le retourne s'il regarde à gauche, comme les autres profils.
    this.drawMonsterSprite(rows, cx, cy, facing === "left", true);
  }

  private drawGaze(cx: number, cy: number, facing: Facing, alerted: boolean, vision: number): void {
    const { ctx, tile } = this;
    const angle = facing === "right" ? 0 : facing === "down" ? Math.PI / 2 : facing === "left" ? Math.PI : -Math.PI / 2;
    // Exactement l'éventail de la partie (Thomas : « l'angle de vue doit correspondre au ? et au ! ») : même ouverture,
    // et il va jusqu'au bout de sa vue, en s'effaçant (très discret).
    const half = RULES.gazeHalfAngle;
    const reach = tile * (vision + 0.5);
    const rgb = alerted ? "255,110,90" : "255,226,170";
    const grad = ctx.createRadialGradient(cx, cy, tile * 0.3, cx, cy, reach);
    grad.addColorStop(0, `rgba(${rgb},0.16)`);
    grad.addColorStop(0.45, `rgba(${rgb},0.07)`);
    grad.addColorStop(1, `rgba(${rgb},0)`);
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, reach, angle - half, angle + half);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();
    // Les deux bords, en traits très fins qui s'effacent.
    ctx.lineWidth = Math.max(1, tile * 0.025);
    ctx.strokeStyle = grad;
    for (const side of [-half, half]) {
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(angle + side) * tile * 0.35, cy + Math.sin(angle + side) * tile * 0.35);
      ctx.lineTo(cx + Math.cos(angle + side) * reach, cy + Math.sin(angle + side) * reach);
      ctx.stroke();
    }
    ctx.restore();
  }

  private drawMonsterSprite(
    rows: readonly string[],
    cx: number,
    cy: number,
    mirror: boolean,
    shadow: boolean,
    palette: Record<string, string> = SCHRAT_PALETTE,
  ): void {
    const { ctx, tile } = this;
    if (shadow) {
      ctx.fillStyle = "rgba(10,8,16,0.45)";
      ctx.beginPath();
      ctx.ellipse(cx, cy + tile * 0.36, tile * 0.26, tile * 0.09, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Plus petit que le héros (Thomas : « trop gros, trop grand ») : dessiné à la taille de la case, pieds au même niveau.
    // Un dessin de 16 pixels de haut fait une case ; un plus large (l'araignée, 18) déborde un peu sur les côtés.
    const size = Math.round(tile * 1.0);
    const width = Math.round((size * rows[0].length) / rows.length);
    const top = Math.round(cy + tile * 0.5 - size);
    const smooth = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(Math.round(cx), 0);
    if (mirror) ctx.scale(-1, 1);
    ctx.drawImage(this.sprite(rows, palette), -width / 2, top, width, size);
    ctx.restore();
    ctx.imageSmoothingEnabled = smooth;
  }

  /** Un personnage est touché : quelques gouttes jaillissent et retombent (rouge, ou vert pour un Schrat). */
  addBloodBurst(x: number, y: number, fromX: number, fromY: number, color: "red" | "green"): void {
    const dx = Math.sign(x - fromX) || (Math.random() - 0.5);
    const dy = Math.sign(y - fromY) || (Math.random() - 0.5);
    const shades = color === "green" ? ["#4f8e1e", "#8ccc3a", "#2a5a12"] : ["#b0202a", "#e04048", "#7a0e14"];
    for (let i = 0; i < 9; i++) {
      const spread = (Math.random() - 0.5) * 1.6;
      this.drops.push({
        x: x + 0.5, y: y + 0.45,
        vx: (dx + spread * Math.abs(dy || 1) * 0.6) * (1.2 + Math.random() * 1.4),
        vy: (dy + spread * Math.abs(dx || 1) * 0.6) * (1.2 + Math.random() * 1.4) - 1.6,
        color: shades[i % 3], age: 0, life: 260 + Math.random() * 180,
      });
    }
  }

  /** Du bruit à cet endroit : des ondes qui s'élargissent (plus le bruit est fort, plus il y en a). */
  addNoise(x: number, y: number, strength: number): void {
    this.ripples.push({ x, y, strength, age: 0 });
  }

  /** Affiche un petit texte qui s'élève au-dessus d'une case (dégâts, « Raté »). */
  addFloatingText(x: number, y: number, text: string, color: string): void {
    this.floats.push({ x, y, text, color, age: 0 });
  }

  /** Anime une attaque : l'attaquant s'élance vers sa cible et une lame balaie la case visée. */
  addSlash(attackerId: number, fromX: number, fromY: number, x: number, y: number, color: string, arc = true): void {
    this.slashes.push({ attackerId, fromX, fromY, x, y, color, age: 0, arc });
  }

  /** Fait voler une flèche d'une case à une autre. */
  addProjectile(fromX: number, fromY: number, x: number, y: number, delay = 0, tumble = false): void {
    this.projectiles.push({ fromX, fromY, x, y, age: -delay, tumble }); // un âge négatif : elle partira après ce délai
  }

  /** Dessine une flèche centrée en (cx, cy), pointe vers `angle`. */
  private drawArrow(cx: number, cy: number, angle: number, length: number, part: "whole" | "front" | "back" = "whole", poisoned = false): void {
    const { ctx } = this;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    const w = Math.max(1.5, length * 0.09);
    const L = length;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#120d08";
    ctx.lineWidth = Math.max(1, L * 0.045);
    const shape = (color: string, pts: number[][]): void => {
      ctx.fillStyle = color;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.stroke();
      ctx.fill();
    };
    if (part !== "front") {
      // Empennage : deux pennes bleues couchées vers l'arrière, qui laissent une encoche en V au talon.
      for (const side of [-1, 1]) {
        shape(side < 0 ? "#6aa8e0" : "#3a6fb0", [[-L * 0.2, (side * w) / 2], [-L * 0.34, side * w * 2.4], [-L * 0.56, side * w * 2.4], [-L * 0.44, (side * w) / 2]]);
      }
    }
    // Hampe fine (entière, ou seulement la moitié avant ou arrière pour une flèche brisée).
    const [x0, x1] = part === "whole" ? [-L * 0.46, L * 0.26] : part === "front" ? [-L * 0.05, L * 0.26] : [-L * 0.46, -L * 0.08];
    shape("#b9824a", [[x0, -w / 2], [x1, -w / 2], [x1, w / 2], [x0, w / 2]]);
    if (part !== "back") {
      // Petite pointe d'acier compacte : c'est elle qui dit où va la flèche.
      shape(poisoned ? "#b8e05a" : "#eef2ff", [[L / 2, 0], [L * 0.2, -w * 2.3], [L * 0.2, w * 2.3]]);
    }
    ctx.restore();
  }

  // L'origine de la carte tombe toujours sur un pixel réel de l'écran : la grille ne tremble pas quand la vue glisse.
  private originX(): number {
    return this.snap(this.width / 2 - (this.camX + 0.5) * this.tile);
  }

  private originY(): number {
    return this.snap(this.height / 2 - (this.camY + 0.5) * this.tile);
  }

  /** Fouille : une vague dorée balaie les cases de la salle depuis le héros, puis les trouvailles scintillent. */
  private scan: { cells: { x: number; y: number; d: number }[]; age: number; found: Point[] } | null = null;

  scanRoom(room: { x: number; y: number; w: number; h: number }, from: Point, found: Point[]): void {
    const cells: { x: number; y: number; d: number }[] = [];
    for (let y = room.y; y < room.y + room.h; y++) {
      for (let x = room.x; x < room.x + room.w; x++) cells.push({ x, y, d: Math.hypot(x - from.x, y - from.y) });
    }
    this.scan = { cells, age: 0, found };
  }

  /** Cases proposées pour se dégager (roue d'actions) : encadrées en doré tant qu'on n'a pas choisi. */
  jumpCells: Point[] = [];

  /** Centre d'une case de la carte, en pixels dans le canvas. */
  tileCenter(x: number, y: number): Point {
    return { x: this.originX() + (x + 0.5) * this.tile, y: this.originY() + (y + 0.5) * this.tile };
  }

  /** Convertit un point de l'écran (en pixels dans le canvas) en case de la carte. */
  screenToTile(px: number, py: number): Point {
    return {
      x: Math.floor((px - this.originX()) / this.tile),
      y: Math.floor((py - this.originY()) / this.tile),
    };
  }

  /**
   * `progress` (0 à 1) est l'avancement de l'animation du tour en cours : chaque acteur glisse
   * de sa case de début de tour vers sa case actuelle. `dt` est le temps écoulé en ms.
   * `ghosts` : monstres déjà vaincus dans les règles mais dont la mort n'a pas encore été montrée.
   */
  draw(game: Game, progress: number, dt: number, ghosts: readonly Actor[] = [], aimRange: number | null = null, aimTarget: Actor | null = null): void {
    const { ctx, tile } = this;
    this.time += dt;
    this.slashes = this.slashes.filter((s) => (s.age += dt) < SLASH_MS);
    this.bowAge += dt;
    this.hurtAge += dt;
    for (const [id, age] of this.monsterHurtAge) this.monsterHurtAge.set(id, age + dt);
    this.corpses = this.corpses.filter((c) => (c.age += dt) < CORPSE_MS);
    const shown = (a: Actor): Point => {
      const p = { x: a.fromX + (a.x - a.fromX) * progress, y: a.fromY + (a.y - a.fromY) * progress };
      // Élan : l'attaquant avance d'un tiers de case vers sa cible, puis revient.
      const s = this.slashes.find((sl) => sl.attackerId === a.id);
      if (s) {
        const push = 0.32 * Math.sin((Math.PI * s.age) / SLASH_MS);
        p.x += Math.sign(s.x - s.fromX) * push;
        p.y += Math.sign(s.y - s.fromY) * push;
      }
      return p;
    };
    const hero = shown(game.hero);
    const follow = 1 - Math.exp(-dt / 140);
    this.camX += (hero.x + this.panX - this.camX) * follow;
    this.camY += (hero.y + this.panY - this.camY) * follow;
    const ox = this.originX();
    const oy = this.originY();
    // Vacillement des torches : deux ondes lentes superposées.
    const flicker = 0.85 + 0.1 * Math.sin(this.time / 110) + 0.05 * Math.sin(this.time / 37);

    ctx.fillStyle = COLORS.background;
    ctx.fillRect(0, 0, this.width, this.height);

    // Taches de sang de l'étage, par case (dessinées sur la case, sous l'ombre).
    const stains = new Map<number, { color: "red" | "green"; shape: 0 | 1 | 2; turn?: number }>();
    for (const b of game.bloodStains()) stains.set(game.map.index(b.x, b.y), b);
    const x0 = Math.floor(-ox / tile);
    const y0 = Math.floor(-oy / tile);
    const x1 = Math.ceil((this.width - ox) / tile);
    const y1 = Math.ceil((this.height - oy) / tile);
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        if (!game.map.inBounds(x, y)) continue;
        const sx = ox + x * tile;
        const sy = oy + y * tile;
        if (!game.isExplored(x, y)) {
          // Passage deviné mais jamais vu : une trace très estompée.
          if (game.isSensed(x, y)) {
            ctx.fillStyle = COLORS.sensed;
            ctx.fillRect(sx + tile * 0.12, sy + tile * 0.12, tile * 0.76, tile * 0.76);
          }
          continue;
        }
        const t = game.map.get(x, y);
        const wall = t === Tile.Wall;
        // Les voiles d'ombre et de lumière sont calés sur les pixels entiers : deux cases voisines ne laissent
        // ni jour ni recouvrement, donc aucune ligne claire ou sombre à leur jonction.
        // Origine et taille des cases sont calées sur les pixels réels : toutes les cases ont la même taille.
        const rx = this.snap(sx);
        const ry = this.snap(sy);
        const rw = this.snap(sx + tile) - rx;
        const rh = this.snap(sy + tile) - ry;
        // Chaque case est dessinée découpée sur ces mêmes pixels entiers : rien ne déborde sur une voisine déjà ombrée.
        this.drawCell(game, t, x, y, rx, ry, rw, rh);
        const stain = stains.get(game.map.index(x, y));
        if (stain) {
          const rows = BLOOD[stain.color][stain.shape === 2 ? "mur" : stain.shape === 1 ? "sol2" : "sol1"];
          const smooth = ctx.imageSmoothingEnabled;
          ctx.imageSmoothingEnabled = false;
          if (stain.shape === 2 || !stain.turn) {
            ctx.drawImage(this.sprite(rows, ICON_PALETTE), rx, ry, rw, rh);
          } else {
            // Au sol, la giclure tourne d'un quart de tour et/ou se retourne : elles ne se ressemblent pas toutes.
            ctx.save();
            ctx.translate(rx + rw / 2, ry + rh / 2);
            ctx.rotate((stain.turn % 4) * (Math.PI / 2));
            if (stain.turn >= 4) ctx.scale(-1, 1);
            ctx.drawImage(this.sprite(rows, ICON_PALETTE), -rw / 2, -rh / 2, rw, rh);
            ctx.restore();
          }
          ctx.imageSmoothingEnabled = smooth;
        }
        // Les murs restent lisibles même dans l'ombre : on les assombrit moins que le sol.
        const shade = wall || t === Tile.Pillar ? 0.6 : 1;

        if (game.isVisible(x, y)) {
          // Luminosité : la lueur du héros, qui décroît avec la distance, ou l'éclairage d'une torche.
          // Un mur ne montre que la lumière qui tombe sur la face qu'on regarde : celle des cases dégagées
          // en vue qui le touchent. Le feu d'une salle qu'on ne voit pas ne colore pas l'autre côté du mur.
          const lit = wall ? this.wallLight(game, x, y) : game.light[game.map.index(x, y)];
          const glow = Math.max(0, 1 - Math.hypot(x - hero.x, y - hero.y) / (game.race.darkVision + 1.5));
          const brightness = Math.min(1, Math.max(lit * flicker, glow));
          ctx.fillStyle = `rgba(12,11,18,${((1 - brightness) * 0.55 * shade).toFixed(3)})`;
          ctx.fillRect(rx, ry, rw, rh);
          if (lit > 0) {
            ctx.fillStyle = `rgba(255,150,60,${(lit * flicker * 0.2).toFixed(3)})`;
            ctx.fillRect(rx, ry, rw, rh);
          }
        } else {
          // Déjà visité mais hors de vue : un voile nettement plus sombre que la pénombre de ce qu'on voit,
          // pour distinguer d'un coup d'œil le souvenir du présent (les murs restent devinables).
          ctx.fillStyle = `rgba(8,7,14,${(wall || t === Tile.Pillar ? 0.72 : 0.82).toFixed(3)})`;
          ctx.fillRect(rx, ry, rw, rh);
        }
      }
    }

    this.drawFurniture(game, ox, oy, flicker, "early");

    // Torches murales : une flamme qui vacille.
    for (const torch of game.torches) {
      if (!game.isExplored(torch.x, torch.y)) continue;
      if (torch.hearth) {
        // Tant qu'on n'a pas vu la salle qu'elle chauffe, on ne voit que le dos du mur : ni foyer ni flammes.
        if (!game.isExplored(torch.x + torch.faceX, torch.y + torch.faceY)) continue;
        this.drawHearth(game, torch, ox + torch.x * tile, oy + torch.y * tile, flicker);
        continue;
      }
      const fx = torch.faceX;
      const fy = torch.faceY;
      // Une torche est accrochée du côté de sa salle : depuis l'autre côté du mur, on ne voit ni tige ni flamme.
      if (!game.isExplored(torch.x + fx, torch.y + fy)) continue;
      const burning = game.isVisible(torch.x + fx, torch.y + fy);
      // La tige part de la limite du mur (côté salle) et la flamme brûle vers l'intérieur du mur.
      const baseX = ox + (torch.x + 0.5 + fx * 0.47) * tile;
      const baseY = oy + (torch.y + 0.5 + fy * 0.47) * tile;
      const cx = ox + (torch.x + 0.5 + fx * 0.22) * tile;
      const cy = oy + (torch.y + 0.5 + fy * 0.22) * tile;
      ctx.strokeStyle = "#6b4a2a";
      ctx.lineWidth = Math.max(2, tile * 0.09);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(baseX, baseY);
      ctx.lineTo(ox + (torch.x + 0.5 + fx * 0.32) * tile, oy + (torch.y + 0.5 + fy * 0.32) * tile);
      ctx.stroke();
      ctx.lineCap = "butt";
      // La flamme ne se voit danser que si l'on a la salle sous les yeux.
      if (!burning) continue;
      ctx.fillStyle = "#ff8a2a";
      ctx.beginPath();
      ctx.arc(cx, cy, tile * 0.16 * flicker, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#ffe08a";
      ctx.beginPath();
      ctx.arc(cx, cy + tile * 0.02, tile * 0.08 * flicker, 0, Math.PI * 2);
      ctx.fill();
    }

    // Porte verrouillée en attente de décision : un cadre doré.
    if (game.pendingDoor) {
      ctx.strokeStyle = COLORS.lock;
      ctx.lineWidth = 2;
      ctx.strokeRect(ox + game.pendingDoor.x * tile + 1, oy + game.pendingDoor.y * tile + 1, tile - 2, tile - 2);
    }

    // Chemin prévu : des points, et un rond sur la destination.
    ctx.fillStyle = COLORS.path;
    game.path.forEach((p, i) => {
      const last = i === game.path.length - 1;
      ctx.beginPath();
      ctx.arc(ox + (p.x + 0.5) * tile, oy + (p.y + 0.5) * tile, tile * (last ? 0.22 : 0.08), 0, Math.PI * 2);
      ctx.fill();
    });

    // Flèches brisées : deux morceaux qui s'effacent doucement au fil des tours.
    for (const d of game.debris) {
      if (!game.isExplored(d.x, d.y)) continue;
      const left = d.until - game.turn + (1 - progress);
      ctx.globalAlpha = Math.max(0, Math.min(1, left / RULES.brokenArrowFadeTurns));
      const cx = ox + (d.x + 0.5) * tile;
      const cy = oy + (d.y + 0.5) * tile;
      this.drawArrow(cx + Math.cos(d.angle) * tile * 0.16, cy + Math.sin(d.angle) * tile * 0.16, d.angle + 0.5, tile * 0.7, "front");
      this.drawArrow(cx - Math.cos(d.angle) * tile * 0.16, cy - Math.sin(d.angle) * tile * 0.16, d.angle - 0.35, tile * 0.7, "back");
    }
    ctx.globalAlpha = 1;

    // Objets au sol : flèches à ramasser, clef.
    // Pièges (visibles pour l'instant) : sur les cases déjà vues, estompés hors de vue.
    for (const p of game.traps()) {
      if (!game.isExplored(p.x, p.y)) continue;
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.globalAlpha = game.isVisible(p.x, p.y) ? 1 : 0.45;
      // Calé sur les mêmes pixels entiers que la case (sinon le piège « gigote » d'un pixel en glissant, comme les cases avant).
      // Pièges v3 (planche art/pieges_v3.png) : la dalle trahit le piège ; il se montre « déclenché » un instant quand il
      // part (la fosse reste effondrée) ; le gaz bouillonne sous sa grille (3 images).
      const kind = p.kind ?? "spikes";
      const flash = (this.trapFlash.get(`${p.x},${p.y}`) ?? -Infinity) > performance.now() - 700;
      const name =
        kind === "gas"
          ? flash
            ? "gasSprung"
            : `gas${Math.floor(this.time / 260 + p.x) % 3}`
          : kind === "pit"
            ? p.sprung
              ? "pitSprung"
              : "pit"
            : flash
              ? `${kind}Sprung`
              : kind;
      const art = PIEGES[name];
      const u = tile / 16;
      const w = art.rows[0].length;
      const h = art.rows.length;
      const rx = this.snap(ox + p.x * tile - u);
      const ry = this.snap(oy + (p.y + 1) * tile + u - h * u);
      ctx.drawImage(this.sprite(art.rows, art.palette), rx, ry, this.snap(rx + w * u) - rx, this.snap(ry + h * u) - ry);
      ctx.globalAlpha = 1;
      ctx.imageSmoothingEnabled = smooth;
    }
    for (const g of game.ground) {
      if (!game.isExplored(g.x, g.y)) continue;
      const gx = ox + g.x * tile;
      const gy = oy + g.y * tile;
      if (g.item === "clef") {
        ctx.fillStyle = COLORS.lock;
        ctx.beginPath();
        ctx.arc(gx + tile * 0.36, gy + tile * 0.4, tile * 0.13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillRect(gx + tile * 0.45, gy + tile * 0.37, tile * 0.3, tile * 0.07);
        ctx.fillRect(gx + tile * 0.66, gy + tile * 0.4, tile * 0.07, tile * 0.13);
        ctx.fillStyle = COLORS.floor;
        ctx.beginPath();
        ctx.arc(gx + tile * 0.36, gy + tile * 0.4, tile * 0.05, 0, Math.PI * 2);
        ctx.fill();
      } else if (g.item === "or") {
        // Or : un tas, petit, moyen ou gros selon la somme comparée à ce qu'on trouve à cet étage.
        const size = g.count >= goldRange(game.depth, "large")[0] ? "large" : g.count >= goldRange(game.depth, "medium")[0] ? "medium" : "small";
        this.drawGroundIcon(GOLD_PILES[size], gx, gy);
      } else if (g.item !== "fleche" && g.item !== "fleche_poison") {
        this.drawGroundIcon(itemIconRows(g.item), gx, gy);
      } else {
        // Flèche au sol, tournée dans le sens où elle est tombée ou s'est plantée.
        this.drawArrow(gx + tile / 2, gy + tile / 2, g.angle ?? -Math.PI / 4, tile * 0.8, "whole", g.item === "fleche_poison");
      }
    }

    // Corps des monstres vaincus : étendus, puis effacés.
    for (const c of this.corpses) {
      if (!game.isVisible(c.actor.x, c.actor.y)) continue;
      ctx.globalAlpha = Math.min(1, 2 * (1 - c.age / CORPSE_MS));
      const spider = c.actor.defId === "araignee";
      this.drawMonsterSprite(
        spider ? ARAIGNEE.dead.rows : SCHRAT.dead[0],
        ox + (c.actor.x + 0.5) * tile,
        oy + (c.actor.y + 0.5) * tile,
        c.facing === "left",
        false,
        spider ? ARAIGNEE.dead.palette : SCHRAT_PALETTE,
      );
      ctx.globalAlpha = 1;
    }
    // Monstres en vue : leur sprite (le Schrat), ou un losange de la couleur de leur fiche s'ils n'en ont pas encore.
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (const m of [...game.visibleMonsters(), ...ghosts]) {
      const p = shown(m);
      const cx = ox + (p.x + 0.5) * tile;
      const cy = oy + (p.y + 0.5) * tile;
      const r = tile * 0.36;
      if (m.defId === "schrat" || m.defId === "araignee") {
        const advantage = game.heroHasAdvantageOn(m);
        if (advantage) {
          // Liseré doré qui palpite au sol : le héros aurait l'avantage en l'attaquant maintenant.
          ctx.strokeStyle = `rgba(255,215,94,${(0.55 + 0.4 * Math.sin(this.time / 160)).toFixed(2)})`;
          ctx.lineWidth = Math.max(2, tile * 0.07);
          ctx.beginPath();
          ctx.ellipse(cx, cy + tile * 0.36, tile * 0.38, tile * 0.14, 0, 0, Math.PI * 2);
          ctx.stroke();
        }
        this.drawMonster(m, cx, cy, progress);
        const burning = !!m.burning || game.isBurning(m.x, m.y);
        if (m.burning && !game.isBurning(m.x, m.y)) this.drawFlames(cx - tile / 2, cy - tile / 2, m.id, 0.8);
        this.drawStatusBubbles(m, cx, cy, burning);
      } else {
      ctx.fillStyle = MONSTERS[m.defId as keyof typeof MONSTERS]?.color ?? "#c04040";
      ctx.beginPath();
      ctx.moveTo(cx, cy - r);
      ctx.lineTo(cx + r, cy);
      ctx.lineTo(cx, cy + r);
      ctx.lineTo(cx - r, cy);
      ctx.closePath();
      ctx.fill();
      // Liseré doré qui palpite : le héros aurait l'avantage en l'attaquant maintenant.
      if (game.heroHasAdvantageOn(m)) {
        ctx.strokeStyle = `rgba(255,215,94,${(0.55 + 0.4 * Math.sin(this.time / 160)).toFixed(2)})`;
        ctx.lineWidth = Math.max(2, tile * 0.07);
        ctx.stroke();
      }
      }
      if (!m.alerted) {
        // « z » : il dort. « ? » : il se promène sans avoir remarqué le héros.
        ctx.fillStyle = "#ffffff";
        ctx.font = `${Math.round(tile * 0.55)}px "VT323", "Courier New", monospace`;
        ctx.fillText(m.asleep ? "z" : "?", cx + tile * 0.3, cy - tile * 0.3);
      }
      if (m.hp < m.maxHp) {
        ctx.fillStyle = COLORS.hpBack;
        ctx.fillRect(cx - tile * 0.35, cy - tile * 0.48, tile * 0.7, tile * 0.08);
        ctx.fillStyle = COLORS.hpFill;
        ctx.fillRect(cx - tile * 0.35, cy - tile * 0.48, tile * 0.7 * Math.max(0, m.hp / m.maxHp), tile * 0.08);
      }
    }

    // Mode arc : un viseur encadre chaque monstre à portée de tir.
    if (aimRange !== null) {
      for (const m of game.visibleMonsters()) {
        if (Math.max(Math.abs(m.x - game.hero.x), Math.abs(m.y - game.hero.y)) > aimRange) continue;
        const p = shown(m);
        // La cible visée d'office (celle que le second appui sur la flèche touchera) : viseur épais, rouge, qui palpite.
        const locked = m === aimTarget;
        ctx.strokeStyle = locked ? "#ff5a4a" : "#ffd75e";
        ctx.lineWidth = Math.max(2, tile * (locked ? 0.12 + 0.03 * Math.sin(this.time / 120) : 0.06));
        const x0 = ox + p.x * tile + 1;
        const y0 = oy + p.y * tile + 1;
        const s = tile - 2;
        const c = tile * 0.28;
        ctx.beginPath();
        for (const [cx, cy, dx, dy] of [[x0, y0, 1, 1], [x0 + s, y0, -1, 1], [x0, y0 + s, 1, -1], [x0 + s, y0 + s, -1, -1]]) {
          ctx.moveTo(cx + dx * c, cy);
          ctx.lineTo(cx, cy);
          ctx.lineTo(cx, cy + dy * c);
        }
        ctx.stroke();
      }
    }

    // Se dégager : les cases d'arrivée possibles, encadrées d'un doré qui palpite.
    if (this.jumpCells.length > 0) {
      ctx.fillStyle = `rgba(255,215,94,${(0.16 + 0.1 * Math.sin(this.time / 140)).toFixed(2)})`;
      ctx.strokeStyle = "#ffd75e";
      ctx.lineWidth = Math.max(2, tile * 0.07);
      for (const c of this.jumpCells) {
        const x0 = Math.round(ox + c.x * tile);
        const y0 = Math.round(oy + c.y * tile);
        ctx.fillRect(x0 + 2, y0 + 2, Math.round(tile) - 4, Math.round(tile) - 4);
        ctx.strokeRect(x0 + 3, y0 + 3, Math.round(tile) - 6, Math.round(tile) - 6);
      }
    }

    // Héros : son sprite animé.
    this.drawHero(game, hero, ox, oy, progress);
    // Le héros qui brûle encore après être sorti des flammes.
    if (game.hero.burning && !game.isBurning(game.hero.x, game.hero.y)) this.drawFlames(ox + hero.x * tile, oy + hero.y * tile, 0, 0.8);
    // Meubles qui cachent un personnage placé derrière eux (sur une rangée au-dessus) : dessinés après lui (Thomas).
    this.drawFurniture(game, ox, oy, flicker, "late");
    // Cases en feu (potion de feu, meubles) : trois images de flammes qui alternent (planche art/objets_v3.png),
    // dessinées DEVANT les personnages (Thomas : le feu ne passe pas derrière), puis la fumée qui monte.
    for (const f of game.fires) {
      if (!game.isVisible(f.x, f.y)) continue;
      this.drawFlames(ox + f.x * tile, oy + f.y * tile, f.x + f.y, 0.95);
    }
    this.drawSmoke(game, ox, oy, dt);
    // Gaz empoisonné (piège à gaz) : des volutes vertes, translucides, qui ondulent sur leurs cases.
    for (const g of game.gas) {
      if (!game.isVisible(g.x, g.y)) continue;
      for (let i = 0; i < 4; i++) {
        const t = this.time / 700 + i * 1.7 + g.x * 0.9 + g.y * 1.3;
        const gx = ox + (g.x + 0.5 + Math.cos(t) * 0.22) * tile;
        const gy = oy + (g.y + 0.45 + Math.sin(t * 1.3) * 0.18) * tile;
        const r = tile * (0.32 + 0.08 * Math.sin(t * 0.8));
        const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
        grad.addColorStop(0, `rgba(150,220,110,${0.22 * Math.min(1, g.turns / 2)})`);
        grad.addColorStop(1, "rgba(150,220,110,0)");
        ctx.fillStyle = grad;
        ctx.fillRect(gx - r, gy - r, r * 2, r * 2);
      }
    }
    // Repos en cours : petite jauge au-dessus du héros.
    // Fouille en cours : la loupe oscille au-dessus de la tête du héros, comme s'il examinait le sol.
    const searching = game.searchProgress();
    if (searching > 0) {
      const s = Math.round(tile * 0.55);
      const wobble = Math.sin(this.time / 160) * tile * 0.18;
      const lx = Math.round(ox + (hero.x + 0.5) * tile - s / 2 + wobble);
      const ly = Math.round(oy + hero.y * tile - tile * 0.5 - s);
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.sprite(uiIconRows("search"), ICON_PALETTE), lx, ly, s, s);
      ctx.imageSmoothingEnabled = smooth;
    }
    // Balayage de la fouille : chaque case s'illumine quand la vague l'atteint, puis s'éteint.
    if (this.scan) {
      this.scan.age += dt;
      const front = this.scan.age / 70; // cases parcourues par la vague
      for (const c of this.scan.cells) {
        const behind = front - c.d;
        if (behind < 0 || behind > 2.5) continue;
        ctx.fillStyle = `rgba(255,224,130,${(0.35 * (1 - behind / 2.5)).toFixed(2)})`;
        ctx.fillRect(Math.round(ox + c.x * tile), Math.round(oy + c.y * tile), Math.round(tile), Math.round(tile));
      }
      const maxD = Math.max(...this.scan.cells.map((c) => c.d), 0);
      const sparkle = this.scan.age - maxD * 70;
      if (sparkle > 0) {
        // Les trouvailles scintillent : une étoile dorée à quatre branches qui pulse.
        for (const f of this.scan.found) {
          const cx = ox + (f.x + 0.5) * tile;
          const cy = oy + (f.y + 0.5) * tile;
          const r = tile * (0.25 + 0.15 * Math.abs(Math.sin(sparkle / 120)));
          ctx.fillStyle = "#fff3a0";
          ctx.fillRect(Math.round(cx - r), Math.round(cy - tile * 0.05), Math.round(2 * r), Math.max(2, Math.round(tile * 0.1)));
          ctx.fillRect(Math.round(cx - tile * 0.05), Math.round(cy - r), Math.max(2, Math.round(tile * 0.1)), Math.round(2 * r));
        }
      }
      if (sparkle > 1600) this.scan = null;
    }
    const rest = Math.max(game.restProgress(), searching);
    if (rest > 0) {
      const gx = Math.round(ox + hero.x * tile + tile * 0.1);
      const gy = Math.round(oy + hero.y * tile - tile * 0.5);
      const gw = Math.round(tile * 0.8);
      const gh = Math.max(4, Math.round(tile * 0.14));
      ctx.fillStyle = "#120d08";
      ctx.fillRect(gx - 1, gy - 1, gw + 2, gh + 2);
      ctx.fillStyle = "#3b2f20";
      ctx.fillRect(gx, gy, gw, gh);
      ctx.fillStyle = searching > 0 ? "#9fd0f4" : "#f0c050";
      ctx.fillRect(gx, gy, Math.round(gw * rest), gh);
    }
    // Liseré rouge : le héros se tient dans une porte, les ennemis ont l'avantage sur lui.
    if (game.heroExposed()) {
      ctx.strokeStyle = `rgba(255,90,100,${(0.55 + 0.4 * Math.sin(this.time / 160)).toFixed(2)})`;
      ctx.lineWidth = Math.max(2, tile * 0.07);
      ctx.beginPath();
      ctx.arc(ox + (hero.x + 0.5) * tile, oy + (hero.y + 0.5) * tile, tile * 0.44, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Coups d'épée ou de griffe : un arc qui balaie la case visée, perpendiculaire à la direction du coup.
    // Flèches en vol : un trait qui file de l'archer vers sa cible.
    this.projectiles = this.projectiles.filter((p) => (p.age += dt) < PROJECTILE_MS);
    for (const p of this.projectiles) {
      if (p.age < 0) continue;
      const t = p.age / PROJECTILE_MS;
      const px = ox + (p.fromX + (p.x - p.fromX) * t + 0.5) * tile;
      const py = oy + (p.fromY + (p.y - p.fromY) * t + 0.5) * tile;
      const heading = Math.atan2(p.y - p.fromY, p.x - p.fromX);
      // En vol, la pointe suit la trajectoire ; après un rebond, la flèche tournoie en retombant.
      if (!p.tumble) {
        // Traînée claire derrière la flèche : on lit d'un coup d'œil d'où elle vient.
        const trail = Math.min(tile * 1.4, Math.hypot(p.x - p.fromX, p.y - p.fromY) * tile * t);
        const grad = ctx.createLinearGradient(px, py, px - Math.cos(heading) * trail, py - Math.sin(heading) * trail);
        grad.addColorStop(0, "rgba(255,244,214,0.55)");
        grad.addColorStop(1, "rgba(255,244,214,0)");
        ctx.strokeStyle = grad;
        ctx.lineWidth = Math.max(1.5, tile * 0.07);
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.lineTo(px - Math.cos(heading) * trail, py - Math.sin(heading) * trail);
        ctx.stroke();
      }
      this.drawArrow(px, py, p.tumble ? heading + Math.PI + t * 7 : heading, tile * 0.8);
    }

    for (const s of this.slashes) {
      if (!s.arc) continue;
      const t = s.age / SLASH_MS;
      const cx = ox + (s.x + 0.5) * tile;
      const cy = oy + (s.y + 0.5) * tile;
      const facing = Math.atan2(s.y - s.fromY, s.x - s.fromX);
      const sweep = Math.min(1, t * 1.6); // la lame parcourt l'arc pendant les deux premiers tiers
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = 1 - t * t;
      ctx.lineCap = "round";
      ctx.lineWidth = Math.max(2, tile * 0.11 * (1 - t * 0.6));
      ctx.beginPath();
      ctx.arc(cx - Math.cos(facing) * tile * 0.25, cy - Math.sin(facing) * tile * 0.25, tile * 0.42, facing - 1.1, facing - 1.1 + 2.2 * sweep);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
    ctx.lineCap = "butt";

    // Textes flottants.
    ctx.font = `${Math.round(Math.max(18, tile * 0.6))}px "VT323", "Courier New", monospace`;
    // Gouttes de sang : elles partent du coup, retombent (gravité) et s'effacent.
    this.drops = this.drops.filter((d) => (d.age += dt) < d.life);
    for (const d of this.drops) {
      const t = d.age / 1000;
      const px = ox + (d.x + d.vx * t) * tile;
      const py = oy + (d.y + d.vy * t + 9 * t * t) * tile;
      const size = Math.max(2, Math.round(tile * 0.08));
      ctx.globalAlpha = Math.min(1, 2 * (1 - d.age / d.life));
      ctx.fillStyle = d.color;
      ctx.fillRect(Math.round(px), Math.round(py), size, size);
    }
    ctx.globalAlpha = 1;
    // Ondes du bruit : cercles dorés qui s'élargissent depuis l'endroit du bruit.
    this.ripples = this.ripples.filter((r) => (r.age += dt) < 900);
    for (const r of this.ripples) {
      const rings = r.strength >= 10 ? 3 : 1;
      for (let k = 0; k < rings; k++) {
        const t = r.age / 900 - k * 0.18;
        if (t <= 0 || t >= 1) continue;
        ctx.strokeStyle = `rgba(255,215,94,${(0.7 * (1 - t)).toFixed(3)})`;
        ctx.lineWidth = Math.max(1.5, tile * 0.06);
        ctx.beginPath();
        ctx.arc(ox + (r.x + 0.5) * tile, oy + (r.y + 0.5) * tile, tile * (0.4 + t * (r.strength >= 10 ? 3.5 : 1.4)), 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    this.floats = this.floats.filter((f) => (f.age += dt) < FLOAT_MS);
    for (const f of this.floats) {
      const t = f.age / FLOAT_MS;
      ctx.globalAlpha = 1 - t * t;
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      const fx = ox + (f.x + 0.5) * tile;
      const fy = oy + (f.y + 0.1 - t * 0.8) * tile;
      ctx.strokeText(f.text, fx, fy);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, fx, fy);
    }
    ctx.globalAlpha = 1;
  }

  /** Dessine une case depuis le cache, en la (re)dessinant d'abord si elle a changé. */
  private drawCell(game: Game, t: Tile, x: number, y: number, rx: number, ry: number, rw: number, rh: number): void {
    const dpr = window.devicePixelRatio || 1;
    // Le dessin d'un mur ou d'une porte dépend des cases voisines (raccords, coins, sens) : la carte tient à jour, pour
    // chaque case, le numéro de la dernière modification à moins de deux cases (`changed`).
    const key = `${Math.round(rw * dpr)}x${Math.round(rh * dpr)}`;
    const index = game.map.index(x, y);
    const stamp = game.map.changed[index];
    let entry = this.cellCache.get(index);
    if (!entry || entry.key !== key || entry.stamp !== stamp) {
      const canvas = entry?.canvas ?? document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(rw * dpr));
      canvas.height = Math.max(1, Math.round(rh * dpr));
      const cellCtx = canvas.getContext("2d")!;
      cellCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cellCtx.clearRect(0, 0, rw, rh);
      new TilePainter(cellCtx, this.tile, (rows, palette) => this.sprite(rows, palette)).paintCell(game, t, x, y, 0, 0);
      entry = { key, stamp, canvas };
      this.cellCache.set(index, entry);
      this.cellRedraws++;
    }
    const smooth = this.ctx.imageSmoothingEnabled;
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(entry.canvas, rx, ry, rw, rh);
    this.ctx.imageSmoothingEnabled = smooth;
  }

  /**
   * Meubles (dortoir, planche art/dortoir_v3.png) : vus de 3/4, ce qui est haut déborde sur la case du dessus. Dessinés
   * après les cases, du fond vers l'avant (le tapis d'abord), avec la même ombre et la même lueur que leurs cases.
   * La bougie de la table vacille (3 images).
   */
  private drawFurniture(game: Game, ox: number, oy: number, flicker: number, phase: "early" | "late"): void {
    const list = [...game.furnitureList()].sort((a, b) => {
      const ra = isFlat(a.kind) ? 0 : 1;
      const rb = isFlat(b.kind) ? 0 : 1;
      return ra - rb || a.y + (FURNITURE_KINDS[a.kind]?.h ?? 1) - (b.y + (FURNITURE_KINDS[b.kind]?.h ?? 1));
    });
    if (list.length === 0) return;
    const { ctx, tile } = this;
    const u = tile / 16;
    const hero = game.hero;
    const frame = Math.floor(performance.now() / 160) % 3;
    // Personnages à l'écran (héros et monstres vus), avec la case d'où ils viennent pendant un pas.
    const actors = [hero, ...game.monsters.filter((m) => game.isVisible(m.x, m.y))];
    for (const f of list) {
      const def = FURNITURE_KINDS[f.kind];
      // Le tapis est dessiné avec le sol (dans la case), pour prendre exactement sa lumière (Thomas : il clignotait).
      if (!def || def.flat) continue;
      // Un meuble passe DEVANT un personnage qui se tient derrière lui (Thomas) : sur une rangée au-dessus de sa rangée
      // du bas, dans la hauteur du dessin (2 rangées au plus), et dans sa largeur (à une case près).
      const bottom = f.y + def.h - 1;
      const behind = actors.some(
        (a) => [a.y, a.fromY].some((ay) => ay < bottom && ay >= bottom - 2) && [a.x, a.fromX].some((ax) => ax >= f.x - 1 && ax <= f.x + def.w),
      );
      if ((phase === "late") !== behind) continue;
      const cells = furnitureCells(f);
      if (!cells.some((c) => game.isExplored(c.x, c.y))) continue;
      const visible = cells.some((c) => game.isVisible(c.x, c.y));
      let dark = 0.82;
      let warm = 0;
      if (visible) {
        let lit = 0;
        let glow = 0;
        for (const c of cells) {
          lit = Math.max(lit, game.light[game.map.index(c.x, c.y)]);
          glow = Math.max(glow, 1 - Math.hypot(c.x - hero.x, c.y - hero.y) / (game.race.darkVision + 1.5));
        }
        const brightness = Math.min(1, Math.max(lit * flicker, glow));
        dark = (1 - brightness) * 0.55;
        warm = lit * flicker * 0.2;
      }
      // Meubles animés (bougie de la table, jambon qui se balance, robinet qui goutte, corde, candélabre) : 3 images.
      const animated = f.kind.startsWith("table") || (!DORTOIR[f.kind] && !TRAINARDS[f.kind] && !SALLES[f.kind] && !!SALLES[`${f.kind}0`]);
      const name = animated ? `${f.kind}${visible ? (frame + f.x) % 3 : 0}` : f.kind;
      const art = DORTOIR[name] ?? TRAINARDS[name] ?? SALLES[name];
      if (!art) continue;
      const w = art.rows[0].length;
      const h = art.rows.length;
      // Place du dessin (en pixels du dessin, 16 par case) : bas du dessin = bas de l'emprise, sauf le tapis, centré.
      let px: number;
      let py: number;
      if (def.wall) {
        // Vitrail : dans la case de mur du fond, un pixel de débord.
        px = f.x * 16 + 1;
        py = f.y * 16 - 1;
      } else if (SALLES[name]) {
        // Salles v2 (cuisine, prière, torture) : centré sur son emprise, posé sur le bas de sa dernière rangée.
        px = (f.x + def.w / 2) * 16 - w / 2;
        py = (f.y + def.h) * 16 - h;
      } else {
        const off = f.kind === "crateStack" ? [-1, 0] : f.kind === "barrel" || f.kind === "crate" ? [1, 0] : f.kind.startsWith("bunk") ? [-2, 0] : f.kind.startsWith("table") ? [1, -1] : f.kind === "chairFallen" ? [0, -1] : f.kind.startsWith("ashes") ? [0, -2] : [2, -1];
        px = f.x * 16 + off[0];
        py = (f.y + def.h) * 16 - h + off[1];
      }
      const img = this.shadedSprite(name, art.rows, art.palette, dark, warm);
      const smooth = ctx.imageSmoothingEnabled;
      ctx.imageSmoothingEnabled = false;
      const x = this.snap(ox + px * u);
      const y = this.snap(oy + py * u);
      ctx.drawImage(img, x, y, this.snap(ox + (px + w) * u) - x, this.snap(oy + (py + h) * u) - y);
      ctx.imageSmoothingEnabled = smooth;
    }
  }

  private readonly shadedCache = new Map<string, HTMLCanvasElement>();

  /** Un dessin assombri (et réchauffé par le feu) d'un coup, sans toucher au fond : gardé en mémoire par palier de 5 %. */
  private shadedSprite(name: string, rows: readonly string[], palette: Record<string, string>, dark: number, warm: number): HTMLCanvasElement {
    const d = Math.round(dark * 20) / 20;
    const wq = Math.round(warm * 20) / 20;
    const key = `${name}|${d}|${wq}`;
    let canvas = this.shadedCache.get(key);
    if (canvas) return canvas;
    const base = this.sprite(rows, palette);
    canvas = document.createElement("canvas");
    canvas.width = base.width;
    canvas.height = base.height;
    const c = canvas.getContext("2d")!;
    c.drawImage(base, 0, 0);
    c.globalCompositeOperation = "source-atop";
    if (d > 0) {
      c.fillStyle = d >= 0.8 ? `rgba(8,7,14,${d})` : `rgba(12,11,18,${d})`;
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (wq > 0) {
      c.fillStyle = `rgba(255,150,60,${wq})`;
      c.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (this.shadedCache.size > 800) this.shadedCache.clear();
    this.shadedCache.set(key, canvas);
    return canvas;
  }

  /** Lumière visible sur un mur : la plus forte parmi les cases dégagées en vue qui le touchent. */
  private wallLight(game: Game, x: number, y: number): number {
    let best = 0;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if ((dx === 0 && dy === 0) || !game.map.inBounds(nx, ny) || !game.map.isWalkable(nx, ny) || !game.isVisible(nx, ny)) continue;
        best = Math.max(best, game.light[game.map.index(nx, ny)]);
      }
    }
    return best;
  }

  /**
   * Cheminée encastrée dans un mur : un manteau de pierre claire, un foyer sombre ouvert vers la salle, des bûches,
   * et des flammes si elle est allumée. Le dessin est tourné pour que le foyer regarde la salle.
   */
  private drawHearth(game: Game, hearth: LightSource, sx: number, sy: number, flicker: number): void {
    const { ctx, tile } = this;
    ctx.save();
    ctx.beginPath();
    ctx.rect(Math.round(sx), Math.round(sy), Math.round(sx + tile) - Math.round(sx), Math.round(sy + tile) - Math.round(sy));
    ctx.clip();
    ctx.translate(sx + tile / 2, sy + tile / 2);
    // Dessiné foyer vers le bas, puis tourné vers la salle.
    ctx.rotate(Math.atan2(hearth.faceY, hearth.faceX) - Math.PI / 2);
    const u = tile / 16;
    const px = (gx: number, gy: number, w: number, h: number, color: string) => {
      ctx.fillStyle = color;
      ctx.fillRect((gx - 8) * u, (gy - 8) * u, w * u + 0.5, h * u + 0.5);
    };
    // Manteau : deux jambages et un linteau plus clair, autour du foyer noir.
    px(0, 0, 16, 16, "#5d6180");
    px(0, 0, 16, 4, "#a4abc8");
    px(0, 3, 16, 1, "#7f88a6");
    px(0, 4, 3, 12, "#8b90b0");
    px(13, 4, 3, 12, "#8b90b0");
    px(3, 4, 10, 12, "#120d08");
    px(3, 4, 10, 1, "#2a2118");
    // Bûches.
    // Le feu ne se voit brûler que si l'on a la salle sous les yeux ; de mémoire, le foyer est sombre.
    const inView = game.isVisible(hearth.x + hearth.faceX, hearth.y + hearth.faceY);
    const lit = hearth.lit !== false && inView;
    px(4, 13, 8, 2, lit ? "#7a5230" : "#4a3a2c");
    px(5, 12, 6, 1, lit ? "#9a6a34" : "#5a4a3a");
    if (lit) {
      // Flammes qui dansent avec le vacillement des torches, et braises.
      const tall = flicker > 0.92 ? 1 : 0;
      px(5, 9 - tall, 6, 4 + tall, "#ff8a2a");
      px(6, 7 - tall, 3, 3, "#ff8a2a");
      px(6, 10 - tall, 4, 3, "#ffb040");
      px(7, 11, 2, 2, "#ffe08a");
      px(4, 14, 1, 1, "#ff5a2a");
      px(11, 14, 1, 1, "#ff5a2a");
    } else {
      // Cendres froides.
      px(4, 15, 8, 1, "#6e7594");
      px(6, 14, 3, 1, "#4a4e5e");
    }
    ctx.restore();
    // Hors de vue, elle prend le même voile que le mur qui la porte.
    if (!inView) {
      ctx.fillStyle = "rgba(8,7,14,0.72)";
      ctx.fillRect(Math.round(sx), Math.round(sy), Math.round(sx + tile) - Math.round(sx), Math.round(sy + tile) - Math.round(sy));
    }
  }

}
