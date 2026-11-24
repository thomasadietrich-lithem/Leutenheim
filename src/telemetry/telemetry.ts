/**
 * STATISTIQUES ANONYMES (Thomas, 2026-11-15 : « un module qui marche sur la maquette en ligne et sur la future app
 * Android / Apple », côté serveur sur AWS).
 *
 * Le jeu range de petits événements (« mort à l'étage 3, tué par une araignée ») dans une file gardée sur l'appareil,
 * puis les envoie par lots à une adresse (une Lambda AWS, voir `aws/telemetry/`). Le même code sert partout : le
 * navigateur, et l'appli Capacitor (Android, iPhone), qui sait faire `fetch`.
 *
 * Rien de personnel : un numéro tiré au hasard pour l'appareil, un autre pour la partie ; pas de nom, pas d'adresse.
 * Rien ne part sans l'accord du joueur (Paramètres, et une question au premier lancement). Sans réseau, les
 * événements attendent (500 au plus) et repartent plus tard ; un envoi raté ne gêne jamais la partie.
 *
 * Ce module n'est importé que par l'interface (`main.ts`) : la logique du jeu ne le connaît pas.
 */
import { TELEMETRY } from "../data/telemetry";

export type Consent = "yes" | "no" | "unset";

export interface TelemetryEvent {
  /** Nom de l'événement : run_start, floor, death, boss_kill, quest, demo_end, revive… */
  e: string;
  /** Moment (millisecondes depuis 1970, heure de l'appareil). */
  t: number;
  /** Partie (numéro au hasard, changé à chaque nouvelle partie). */
  run: string;
  /** Le reste : étage, cause, niveau, tour… (nombres et textes courts seulement). */
  [key: string]: string | number | boolean;
}

/** Ce qui ne change pas pendant une session : envoyé avec chaque lot. */
export interface TelemetryContext {
  /** Appareil (numéro au hasard, gardé). */
  device: string;
  /** Version du jeu (`package.json`) et date de construction. */
  version: string;
  /** web, android, ios. */
  platform: string;
  /** Démo d'essai (avec la salle d'essai) ou version publique. */
  build: "demo" | "public";
  /** Langue choisie. */
  lang: string;
}

const KEYS = { consent: "leutenheim.stats", device: "leutenheim.stats.device", queue: "leutenheim.stats.queue" };

/** Un numéro au hasard (pas `Math.random` de la logique du jeu : ceci est de l'interface, hors partie). */
export function randomId(): string {
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c?.randomUUID) return c.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 3) | 8).toString(16);
  });
}

/**
 * Code joueur (Thomas, 2026-11-24) : cinq signes tirés du numéro d'appareil, toujours les mêmes pour un appareil.
 * Affiché dans les Paramètres ; un ami le donne à Thomas, qui pose une étiquette dessus dans le tableau de bord.
 * Sans 0, O, 1 ni I (faciles à confondre). Le même calcul est recopié dans `aws/telemetry/cloudformation.yaml`.
 */
export function playerCode(device: string): string {
  const signs = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let h = 0x811c9dc5;
  for (let i = 0; i < device.length; i++) h = Math.imul(h ^ device.charCodeAt(i), 0x01000193) >>> 0;
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += signs[h & 31];
    h >>>= 5;
  }
  return out;
}

/** Garde seulement des valeurs simples et courtes (jamais un objet entier du jeu). */
export function clean(fields: Record<string, unknown>): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(fields)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.slice(0, 80);
  }
  return out;
}

/** Stockage de l'appareil (absent ou refusé : on fait sans). */
interface Store {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
}

export class Telemetry {
  private queue: TelemetryEvent[] = [];
  private sending = false;
  private run = randomId();
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly ctx: Omit<TelemetryContext, "device">,
    private readonly store: Store | null = safeStore(),
    private readonly post: (url: string, body: string) => Promise<boolean> = defaultPost,
  ) {
    try {
      this.queue = JSON.parse(this.store?.getItem(KEYS.queue) ?? "[]");
      if (!Array.isArray(this.queue)) this.queue = [];
    } catch {
      this.queue = [];
    }
  }

  /** L'accord du joueur : « oui », « non », ou pas encore demandé. */
  consent(): Consent {
    const v = this.store?.getItem(KEYS.consent);
    return v === "yes" || v === "no" ? v : "unset";
  }

  setConsent(value: "yes" | "no"): void {
    this.store?.setItem(KEYS.consent, value);
    if (value === "no") {
      // Refus : on jette ce qui attendait.
      this.queue = [];
      this.save();
    } else this.flush();
  }

  /** Actif : une adresse est réglée et le joueur a dit oui. */
  enabled(): boolean {
    return !!TELEMETRY.url && this.consent() === "yes";
  }

  /** Une nouvelle partie commence : nouveau numéro de partie. */
  newRun(): void {
    this.run = randomId();
  }

  /** Note un événement (rien si le joueur a refusé ou si l'adresse n'est pas réglée). */
  track(name: string, fields: Record<string, unknown> = {}): void {
    if (!this.enabled()) return;
    this.queue.push({ ...clean(fields), e: name, t: Date.now(), run: this.run });
    if (this.queue.length > TELEMETRY.maxQueue) this.queue.splice(0, this.queue.length - TELEMETRY.maxQueue);
    this.save();
    if (this.queue.length >= TELEMETRY.batchSize) void this.flush();
  }

  /** Envoie la file par lots ; ce qui n'est pas parti reste pour la fois suivante. */
  async flush(): Promise<void> {
    if (!this.enabled() || this.sending || this.queue.length === 0) return;
    this.sending = true;
    try {
      while (this.queue.length > 0) {
        const batch = this.queue.slice(0, TELEMETRY.batchSize);
        const ok = await this.post(TELEMETRY.url, JSON.stringify({ ...this.context(), events: batch }));
        if (!ok) break;
        this.queue.splice(0, batch.length);
        this.save();
      }
    } finally {
      this.sending = false;
    }
  }

  /** Envoi régulier (et à la mise en arrière-plan, appelé par l'interface). */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.flush(), TELEMETRY.flushSeconds * 1000);
  }

  /** Combien d'événements attendent (pour les essais). */
  pending(): number {
    return this.queue.length;
  }

  /** Le numéro de cet appareil (tiré au hasard la première fois, puis gardé). */
  private device(): string {
    let device = this.store?.getItem(KEYS.device) ?? "";
    if (!device) {
      device = randomId();
      this.store?.setItem(KEYS.device, device);
    }
    return device;
  }

  /** Le code joueur de cet appareil (voir `playerCode`). */
  code(): string {
    return playerCode(this.device());
  }

  private context(): TelemetryContext {
    return { ...this.ctx, device: this.device() };
  }

  private save(): void {
    try {
      this.store?.setItem(KEYS.queue, JSON.stringify(this.queue));
    } catch {
      /* stockage plein ou refusé : la file reste en mémoire */
    }
  }
}

function safeStore(): Store | null {
  try {
    const s = (globalThis as { localStorage?: Store }).localStorage;
    return s ?? null;
  } catch {
    return null;
  }
}

async function defaultPost(url: string, body: string): Promise<boolean> {
  try {
    // `keepalive` : l'envoi survit à la fermeture de la page (mise en arrière-plan du téléphone).
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "text/plain" }, body, keepalive: body.length < 60000 });
    return res.ok;
  } catch {
    return false;
  }
}

/** web, android ou ios : l'appli Capacitor le dit ; sinon c'est le navigateur. */
export function detectPlatform(): string {
  const cap = (globalThis as { Capacitor?: { getPlatform?: () => string } }).Capacitor;
  return cap?.getPlatform?.() ?? "web";
}
