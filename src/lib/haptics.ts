import { useEffect, useRef } from "react";
import type { GameState } from "@/lib/chess";

const PATTERNS: Record<string, number | number[]> = {
  move: 12,
  capture: [25, 40, 25],
  promote: [20, 30, 60],
  shield: 30,
  freeze: [15, 30, 15],
  teleport: [10, 20, 10, 20, 10],
  bolt: [60, 30, 40],
  bomb: [90, 40, 120],
};

/** Vibra o celular conforme o último efeito da partida (Android/Chrome). */
export function useArenaHaptics(state: GameState | null | undefined, enabled: boolean) {
  const last = useRef<number | null>(null);
  useEffect(() => {
    const fx = state?.fx;
    if (!fx) return;
    if (last.current === null) {
      last.current = fx.id;
      return;
    }
    if (fx.id === last.current) return;
    last.current = fx.id;
    if (!enabled || typeof navigator === "undefined" || !("vibrate" in navigator)) return;
    let pattern = PATTERNS[fx.kind] ?? 12;
    if (state?.winner) pattern = [120, 60, 120, 60, 240];
    try {
      navigator.vibrate(pattern);
    } catch {
      /* ignore */
    }
  }, [state?.fx, state?.winner, enabled]);
}
