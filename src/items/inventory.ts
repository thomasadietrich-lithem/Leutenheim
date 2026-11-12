import { ITEMS, ItemDef, ItemId } from "../data/items";

/** Un objet rangé dans le sac : sa fiche, sa case en haut à gauche, et combien il y en a (pile). */
export interface BagItem {
  uid: number;
  defId: ItemId;
  x: number;
  y: number;
  count: number;
  /** Pour une clef : l'étage où on l'a trouvée. Elle n'ouvre que les portes de cet étage. */
  floor?: number;
}

/** Sac à cases, à la Diablo : chaque objet occupe un rectangle de cases, les munitions s'empilent. */
export class Inventory {
  items: BagItem[] = [];
  private nextUid = 1;

  constructor(
    public cols = 6,
    public rows = 4,
  ) {}

  /**
   * Il y aurait assez de cases libres pour cet objet, mais pas d'un seul tenant (Thomas, 2026-11-12 : « un message
   * adapté ») : il suffit de ranger le sac.
   */
  fitsIfTidied(defId: ItemId): boolean {
    const d = ITEMS[defId];
    const used = this.items.reduce((n, i) => n + ITEMS[i.defId].w * ITEMS[i.defId].h, 0);
    return this.cols * this.rows - used >= d.w * d.h;
  }

  /** Change la taille du sac (on en équipe un autre). Refusé si un objet se retrouverait dehors. */
  resize(cols: number, rows: number): boolean {
    for (const i of this.items) {
      const d = this.def(i);
      if (i.x + d.w > cols || i.y + d.h > rows) return false;
    }
    this.cols = cols;
    this.rows = rows;
    return true;
  }

  /** Pour la sauvegarde : le contenu du sac et le prochain numéro d'objet. */
  snapshot(): { items: BagItem[]; nextUid: number } {
    return { items: this.items.map((i) => ({ ...i })), nextUid: this.nextUid };
  }

  restore(data: { items: BagItem[]; nextUid: number }): void {
    this.items = data.items.map((i) => ({ ...i }));
    this.nextUid = data.nextUid;
  }

  def(item: BagItem): ItemDef {
    return ITEMS[item.defId];
  }

  /** L'objet qui occupe une case donnée, s'il y en a un. */
  at(x: number, y: number): BagItem | undefined {
    return this.items.find((i) => {
      const d = this.def(i);
      return x >= i.x && x < i.x + d.w && y >= i.y && y < i.y + d.h;
    });
  }

  get(uid: number): BagItem | undefined {
    return this.items.find((i) => i.uid === uid);
  }

  /** Un objet de cette fiche tient-il à cet endroit ? (`ignoreUid` : l'objet qu'on est en train de déplacer.) */
  fits(defId: ItemId, x: number, y: number, ignoreUid?: number): boolean {
    const d: ItemDef = ITEMS[defId];
    if (x < 0 || y < 0 || x + d.w > this.cols || y + d.h > this.rows) return false;
    for (let cy = y; cy < y + d.h; cy++) {
      for (let cx = x; cx < x + d.w; cx++) {
        const other = this.at(cx, cy);
        if (other && other.uid !== ignoreUid) return false;
      }
    }
    return true;
  }

  /** Ajoute des objets : complète d'abord les piles existantes, puis prend la première place libre. Renvoie ce qui n'a pas pu entrer. */
  add(defId: ItemId, count = 1, floor?: number): number {
    const d: ItemDef = ITEMS[defId];
    for (const item of this.items) {
      if (count === 0) break;
      if (item.defId !== defId || item.floor !== floor) continue; // des clefs d'étages différents ne s'empilent pas
      const room = Math.min(d.maxStack - item.count, count);
      item.count += room;
      count -= room;
    }
    while (count > 0) {
      let placed = false;
      for (let y = 0; y < this.rows && !placed; y++) {
        for (let x = 0; x < this.cols && !placed; x++) {
          if (!this.fits(defId, x, y)) continue;
          const n = Math.min(d.maxStack, count);
          this.items.push({ uid: this.nextUid++, defId, x, y, count: n, floor });
          count -= n;
          placed = true;
        }
      }
      if (!placed) break; // sac plein
    }
    return count;
  }

  /** Sort un objet du sac (pour le porter). */
  removeItem(uid: number): BagItem | undefined {
    const item = this.get(uid);
    if (item) this.items = this.items.filter((i) => i !== item);
    return item;
  }

  /** Remet dans le sac un objet qu'on portait, à la première place libre. Renvoie faux si le sac est plein. */
  placeItem(item: BagItem): boolean {
    for (let y = 0; y < this.rows; y++) {
      for (let x = 0; x < this.cols; x++) {
        if (!this.fits(item.defId, x, y)) continue;
        item.x = x;
        item.y = y;
        this.items.push(item);
        return true;
      }
    }
    return false;
  }

  /** Déplace un objet vers une autre case, si la place est libre. */
  moveTo(uid: number, x: number, y: number): boolean {
    const item = this.get(uid);
    if (!item || !this.fits(item.defId, x, y, uid)) return false;
    item.x = x;
    item.y = y;
    return true;
  }

  /** Combien on en a. Avec `floor` : seulement ceux de cet étage (clefs). */
  count(defId: ItemId, floor?: number): number {
    return this.items.reduce((sum, i) => sum + (i.defId === defId && (floor === undefined || i.floor === floor) ? i.count : 0), 0);
  }

  /** Retire `n` exemplaires (munitions tirées). Renvoie faux s'il n'y en a pas assez. */
  take(defId: ItemId, n = 1, floor?: number): boolean {
    if (this.count(defId, floor) < n) return false;
    for (const item of [...this.items].reverse()) {
      if (n === 0) break;
      if (item.defId !== defId || (floor !== undefined && item.floor !== floor)) continue;
      const used = Math.min(item.count, n);
      item.count -= used;
      n -= used;
    }
    this.items = this.items.filter((i) => i.count > 0);
    return true;
  }
}
