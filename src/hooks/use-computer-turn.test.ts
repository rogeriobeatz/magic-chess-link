import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useComputerTurn } from "./use-computer-turn";
import { applyMove, initialState } from "@/lib/chess";
import type { ComputerResponse } from "@/lib/computer";

class FakeWorker {
  static instances: FakeWorker[] = [];
  onmessage: ((event: { data: ComputerResponse }) => void) | null = null;
  onerror: (() => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() {
    FakeWorker.instances.push(this);
  }
}
beforeEach(() => {
  vi.useFakeTimers();
  FakeWorker.instances = [];
  vi.stubGlobal("Worker", FakeWorker);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
const blackTurn = () => applyMove(initialState(), 52, 36)!;

describe("Automatic computer turns", () => {
  it("controls white after a solo rematch swaps the human to black", () => {
    const onAction = vi.fn();
    const state = initialState();
    renderHook(() =>
      useComputerTurn({ state, difficulty: "medium", enabled: true, computerColor: "w", onAction }),
    );
    expect(FakeWorker.instances).toHaveLength(1);
    act(() => {
      FakeWorker.instances[0]!.onmessage?.({
        data: { action: { kind: "move", from: 52, to: 36 } },
      });
      vi.advanceTimersByTime(600);
    });
    expect(onAction).toHaveBeenCalledWith({ kind: "move", from: 52, to: 36 }, state);
  });
  it("starts only on the computer turn and sends the selected difficulty", () => {
    const onAction = vi.fn();
    const { rerender, result } = renderHook(
      ({ state }) => useComputerTurn({ state, difficulty: "hard", enabled: true, onAction }),
      { initialProps: { state: initialState() } },
    );
    expect(FakeWorker.instances).toHaveLength(0);
    const state = blackTurn();
    rerender({ state });
    expect(result.current.thinking).toBe(true);
    expect(FakeWorker.instances[0]!.postMessage).toHaveBeenCalledWith({
      state,
      difficulty: "hard",
    });
    act(() => {
      FakeWorker.instances[0]!.onmessage?.({
        data: { action: { kind: "move", from: 12, to: 28 } },
      });
      vi.advanceTimersByTime(600);
    });
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction).toHaveBeenCalledWith({ kind: "move", from: 12, to: 28 }, state);
  });

  it("cancels a pending reply when the player restarts", () => {
    const onAction = vi.fn();
    const { rerender } = renderHook(
      ({ state }) => useComputerTurn({ state, difficulty: "medium", enabled: true, onAction }),
      { initialProps: { state: blackTurn() } },
    );
    const worker = FakeWorker.instances[0]!;
    act(() => worker.onmessage?.({ data: { action: { kind: "move", from: 12, to: 28 } } }));
    rerender({ state: initialState() });
    act(() => vi.advanceTimersByTime(1000));
    expect(worker.terminate).toHaveBeenCalled();
    expect(onAction).not.toHaveBeenCalled();
  });

  it("ignores late messages from a cancelled difficulty and retries failures", () => {
    const onAction = vi.fn();
    const state = blackTurn();
    const { result, rerender } = renderHook(
      ({ enabled }) => useComputerTurn({ state, difficulty: "easy", enabled, onAction }),
      { initialProps: { enabled: true } },
    );
    const worker = FakeWorker.instances[0]!;
    rerender({ enabled: false });
    act(() => {
      worker.onmessage?.({ data: { action: { kind: "move", from: 12, to: 28 } } });
      vi.advanceTimersByTime(1000);
    });
    expect(onAction).not.toHaveBeenCalled();
    rerender({ enabled: true });
    act(() => FakeWorker.instances[1]!.onerror?.());
    expect(result.current.error).toContain("Tente novamente");
    act(() => result.current.retry());
    expect(FakeWorker.instances).toHaveLength(3);
    expect(result.current.thinking).toBe(true);
  });

  it("does not start for multiplayer or after the result", () => {
    const onAction = vi.fn();
    const { rerender } = renderHook(
      ({ enabled, state }) => useComputerTurn({ state, difficulty: "easy", enabled, onAction }),
      { initialProps: { enabled: false, state: blackTurn() } },
    );
    rerender({ enabled: true, state: { ...blackTurn(), winner: "w" } });
    expect(FakeWorker.instances).toHaveLength(0);
  });
});
