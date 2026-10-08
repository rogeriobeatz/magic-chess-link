import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GameAnnouncement from "./GameAnnouncement";
import { initialState } from "@/lib/chess";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Gameplay announcements", () => {
  it("shows mate before the loser's result and keeps the result visible", () => {
    const state = { ...initialState(), winner: "b" as const, result: "checkmate" as const };
    render(<GameAnnouncement state={state} viewer="w" active effects />);
    expect(screen.getByText("XEQUE-MATE!")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(1800));
    expect(screen.getByText("VOCÊ PERDEU!")).toBeInTheDocument();
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.getByText("VOCÊ PERDEU!")).toBeInTheDocument();
  });

  it("personalizes victory and shows a neutral result to spectators", () => {
    const state = { ...initialState(), winner: "w" as const };
    const { rerender } = render(
      <GameAnnouncement state={state} viewer="w" active effects={false} />,
    );
    expect(screen.getByText("VOCÊ VENCEU!")).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveClass("announcement-static");
    rerender(<GameAnnouncement state={state} viewer="spec" active effects />);
    expect(screen.getByText("BRANCAS VENCERAM!")).toBeInTheDocument();
  });

  it("does not restart an animation when realtime echoes the same move", () => {
    const state = initialState();
    state.fx = { id: 1, kind: "capture", squares: [52, 36] };
    const { rerender } = render(<GameAnnouncement state={state} viewer="w" active effects />);
    act(() => vi.advanceTimersByTime(1000));
    rerender(
      <GameAnnouncement state={JSON.parse(JSON.stringify(state))} viewer="w" active effects />,
    );
    act(() => vi.advanceTimersByTime(801));
    expect(screen.queryByText("CAPTURA!")).not.toBeInTheDocument();
  });

  it("shows a real check and removes it when the king is safe", () => {
    const state = initialState();
    state.board = Array(64).fill(null);
    state.board[60] = { t: "k", c: "w" };
    state.board[4] = { t: "r", c: "b" };
    state.board[0] = { t: "k", c: "b" };
    const { rerender } = render(<GameAnnouncement state={state} viewer="w" active effects />);
    expect(screen.getByText("XEQUE!")).toBeInTheDocument();
    state.board[4] = null;
    rerender(<GameAnnouncement state={{ ...state, move: 1 }} viewer="w" active effects />);
    expect(screen.queryByText("XEQUE!")).not.toBeInTheDocument();
  });

  it("announces that a power passed the turn and stays quiet while waiting", () => {
    const state = initialState();
    state.fx = { id: 1, kind: "shield", squares: [52] };
    const { rerender } = render(<GameAnnouncement state={state} viewer="w" active effects />);
    expect(screen.getByText("ESCUDO!")).toBeInTheDocument();
    expect(screen.getByText("Poder ativado. Turno encerrado.")).toBeInTheDocument();
    rerender(<GameAnnouncement state={state} viewer="w" active={false} effects />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
