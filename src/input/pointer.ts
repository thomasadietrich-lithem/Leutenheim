const KEYS: Record<string, [number, number]> = {
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
};

/** Au-delà de ce déplacement du doigt (en pixels), ce n'est plus un simple toucher. */
const TAP_SLOP = 12;

export interface InputHandlers {
  /** Toucher/clic sur un point du canvas. */
  onTap(px: number, py: number): void;
  /** Flèches du clavier (pour tester sur ordinateur). */
  onMove(dx: number, dy: number): void;
  /** Zoom : facteur > 1 pour agrandir, < 1 pour réduire (molette ou pincement à deux doigts). */
  onZoom(factor: number): void;
}

export function bindInput(canvas: HTMLCanvasElement, handlers: InputHandlers): void {
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt = { x: 0, y: 0 };
  let isGesture = false; // vrai dès qu'un deuxième doigt se pose ou que le doigt glisse
  let pinchDistance = 0;

  const distance = (): number => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  canvas.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
      /* sans gravité */
    }
    if (pointers.size === 1) {
      isGesture = false;
      downAt = { x: e.clientX, y: e.clientY };
    } else if (pointers.size === 2) {
      isGesture = true;
      pinchDistance = distance();
    }
    e.preventDefault();
  });

  canvas.addEventListener("pointermove", (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const d = distance();
      if (pinchDistance > 0 && d > 0) handlers.onZoom(d / pinchDistance);
      pinchDistance = d;
    } else if (Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > TAP_SLOP) {
      isGesture = true;
    }
  });

  const release = (e: PointerEvent, cancelled: boolean) => {
    if (!pointers.delete(e.pointerId)) return;
    pinchDistance = 0;
    if (!cancelled && !isGesture && pointers.size === 0) {
      const rect = canvas.getBoundingClientRect();
      handlers.onTap(e.clientX - rect.left, e.clientY - rect.top);
    }
  };
  canvas.addEventListener("pointerup", (e) => release(e, false));
  canvas.addEventListener("pointercancel", (e) => release(e, true));

  canvas.addEventListener(
    "wheel",
    (e) => {
      handlers.onZoom(e.deltaY < 0 ? 1.1 : 1 / 1.1);
      e.preventDefault();
    },
    { passive: false },
  );

  window.addEventListener("keydown", (e) => {
    const dir = KEYS[e.key];
    if (!dir) return;
    handlers.onMove(dir[0], dir[1]);
    e.preventDefault();
  });
}
