import { useEffect, useRef, useState } from "react";
import { isGameOver, type GameState } from "@/lib/chess";
import type { ComputerAction, ComputerResponse, Difficulty } from "@/lib/computer";

export function useComputerTurn({
  state,
  difficulty,
  enabled,
  onAction,
}: {
  state: GameState | undefined;
  difficulty: Difficulty | null;
  enabled: boolean;
  onAction: (action: ComputerAction, expected: GameState) => void;
}) {
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  const callback = useRef(onAction);
  useEffect(() => {
    callback.current = onAction;
  }, [onAction]);

  useEffect(() => {
    setError("");
    if (!enabled || !state || !difficulty || state.turn !== "b" || isGameOver(state)) {
      setThinking(false);
      return;
    }
    let active = true;
    let worker: Worker | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = performance.now();
    setThinking(true);
    const fail = () => {
      if (!active) return;
      worker?.terminate();
      setThinking(false);
      setError("O computador não conseguiu jogar. Tente novamente.");
    };
    try {
      worker = new Worker(new URL("../lib/computer.worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onerror = fail;
      worker.onmessage = (event: MessageEvent<ComputerResponse>) => {
        if (!active) return;
        worker?.terminate();
        if (event.data.error || !event.data.action) {
          fail();
          return;
        }
        const action = event.data.action;
        timer = setTimeout(
          () => {
            if (!active) return;
            setThinking(false);
            callback.current(action, state);
          },
          Math.max(0, 600 - (performance.now() - started)),
        );
      };
      worker.postMessage({ state, difficulty });
    } catch {
      fail();
    }
    return () => {
      active = false;
      worker?.terminate();
      if (timer) clearTimeout(timer);
    };
  }, [state, difficulty, enabled, attempt]);

  return { thinking, error, retry: () => setAttempt((value) => value + 1) };
}
