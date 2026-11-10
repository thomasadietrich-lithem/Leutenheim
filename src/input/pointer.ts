const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/** Branche le tactile/la souris (toucher une case) et les flèches du clavier (pour tester sur ordinateur). */
export function bindInput(
  canvas: HTMLCanvasElement,
  onTap: (px: number, py: number) => void,
  onMove: (dx: number, dy: number) => void,
): void {
  canvas.addEventListener("pointerdown", (e) => {
    const rect = canvas.getBoundingClientRect();
    onTap(e.clientX - rect.left, e.clientY - rect.top);
    e.preventDefault();
  });
  window.addEventListener("keydown", (e) => {
    const dir = KEYS[e.key];
    if (!dir) return;
    onMove(dir[0], dir[1]);
    e.preventDefault();
  });
}
