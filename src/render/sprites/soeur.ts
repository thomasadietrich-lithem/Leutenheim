/**
 * Sœur Osseuse (quête 02, Thomas 2026-11-12) : un squelette en voile de nonne déchiré, guimpe blanche autour du crâne,
 * orbites noires, robe sombre, mains d'os qui égrènent un chapelet. 16 × 16, vue de face, deux images de repos (le
 * chapelet se balance, le bas du voile flotte). Premier jet, à valider sur image.
 * K contour, V voile noir, v reflet du voile, X guimpe, W os, w os ombré, E orbite, H robe, h pli de la robe, R perle.
 */
export const SOEUR_SPRITE: string[][] = [
  [
    "....KKKKKKKK....",
    "...KVVVVVVVVK...",
    "..KVvXXXXXXvVK..",
    "..KVXWWWWWWXVK..",
    "..KVXWEEWEEXVK..",
    "..KVXWEEWEEXVK..",
    "..KVXWWwwWWXVK..",
    "..KVKXwKKwXKVK..",
    ".KVVVKXXXXKVVVK.",
    ".KVHHHHHHHHHHVK.",
    ".KVHhHRHHRHhHVK.",
    "..KHWWHRRHWWHK..",
    "..KHhHHHRHHhHK..",
    "..KHhHHHRHHhHK..",
    "..KVHHHHHHHHVK..",
    "...KVK.KK.KVK...",
  ],
  [
    "....KKKKKKKK....",
    "...KVVVVVVVVK...",
    "..KVvXXXXXXvVK..",
    "..KVXWWWWWWXVK..",
    "..KVXWEEWEEXVK..",
    "..KVXWEEWEEXVK..",
    "..KVXWWwwWWXVK..",
    "..KVKXwKKwXKVK..",
    ".KVVVKXXXXKVVVK.",
    ".KVHHHHHHHHHHVK.",
    ".KVHhHRHHRHhHVK.",
    "..KHWWHRRHWWHK..",
    "..KHhHHRHHHhHK..",
    "..KHhHHRHHHhHK..",
    "..KVHHHHHHHHVK..",
    "...KK.KVK.KKVK..",
  ],
];

export const SOEUR_PALETTE: Record<string, string> = {
  K: "#100c12",
  V: "#2c2636",
  v: "#4e4660",
  X: "#e8e4d8",
  W: "#e6dcc0",
  w: "#a89c80",
  E: "#120d10",
  H: "#3a3448",
  h: "#565070",
  R: "#c8b48a",
};

/** Sa bulle : une petite croix d'os sur fond crème (même bulle que Gluck, autre dessin dedans). 8 × 8. */
export const SOEUR_BUBBLE_ICON = [
  "...KK...",
  "..KWWK..",
  "KKKWWKKK",
  "KWWWWWWK",
  "KKKWWKKK",
  "..KWWK..",
  "..KWWK..",
  "...KK...",
];
