import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameState } from "@/lib/chess";
import { initialState } from "@/lib/chess";
import { readProgress } from "@/lib/progress";

type Row = { id: string; white_token: string; black_token: string | null; state: GameState };
const harness = vi.hoisted(() => ({
  id: "",
  rows: new Map<string, Row>(),
  sequence: 0,
  listeners: new Map<string, (event: { new: Row }) => void>(),
  navigate: vi.fn(),
  conflict: false,
}));

function broadcast(row: Row) {
  harness.listeners.get(row.id)?.({ new: structuredClone(row) });
}
class Query {
  mode: "read" | "insert" | "update" = "read";
  payload: Partial<Row> = {};
  filters: { column: string; value: unknown }[] = [];
  select() {
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }
  is(column: string, value: unknown) {
    return this.eq(column, value);
  }
  insert(payload: Partial<Row>) {
    this.mode = "insert";
    this.payload = payload;
    return this;
  }
  update(payload: Partial<Row>) {
    this.mode = "update";
    this.payload = payload;
    return this;
  }
  single() {
    return this.execute();
  }
  maybeSingle() {
    return this.execute();
  }
  then(resolve: (value: { data: Row | null; error: null }) => unknown) {
    return this.execute().then(resolve);
  }
  async execute(): Promise<{ data: Row | null; error: null }> {
    if (this.mode === "insert") {
      const row = { ...this.payload, id: `created-${++harness.sequence}` } as Row;
      harness.rows.set(row.id, structuredClone(row));
      return { data: structuredClone(row), error: null };
    }
    const row = [...harness.rows.values()].find((item) =>
      this.filters.every(({ column, value }) => {
        const actual = column.startsWith("state->>")
          ? item.state[column.slice(8) as keyof GameState]
          : item[column as keyof Row];
        return value === null ? actual == null : String(actual) === String(value);
      }),
    );
    if (!row) return { data: null, error: null };
    if (this.mode === "update") {
      if (harness.conflict) {
        harness.conflict = false;
        row.state = {
          ...row.state,
          revision: (row.state.revision ?? 0) + 1,
          clock: { remaining: { w: 300000, b: 300000 }, startedAt: Date.now(), limitMs: 300000 },
        };
        return { data: null, error: null };
      }
      const updated = { ...row, ...this.payload };
      harness.rows.set(row.id, structuredClone(updated));
      broadcast(updated);
      return { data: structuredClone(updated), error: null };
    }
    return { data: structuredClone(row), error: null };
  }
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => new Query(),
    channel: () => {
      let id = "";
      const channel = {
        on: (
          _event: string,
          options: { filter: string },
          callback: (event: { new: Row }) => void,
        ) => {
          id = options.filter.slice(6);
          harness.listeners.set(id, callback);
          return channel;
        },
        subscribe: () => channel,
        remove: () => harness.listeners.delete(id),
      };
      return channel;
    },
    removeChannel: (channel: { remove: () => void }) => channel.remove(),
  },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({ options, useParams: () => ({ id: harness.id }) }),
  useNavigate: () => harness.navigate,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/hooks/use-computer-turn", () => ({
  useComputerTurn: () => ({ thinking: false, error: "", retry: vi.fn() }),
}));
vi.mock("@/lib/new-game", async (importOriginal) => {
  const original = await importOriginal<typeof import("@/lib/new-game")>();
  return {
    ...original,
    newGameState: (options: Parameters<typeof original.newGameState>[0]) => {
      const state = original.newGameState(options);
      if (options?.training) state.energy = { w: 9, b: 9 };
      return state;
    },
  };
});
vi.mock("@/components/Board3D", () => ({
  default: ({ state, onSquare }: { state: GameState; onSquare: (square: number) => void }) => (
    <div data-testid="board" data-move={state.move} data-turn={state.turn}>
      {Array.from({ length: 64 }, (_, square) => (
        <button key={square} aria-label={`Casa ${square}`} onClick={() => onSquare(square)}>
          {state.board[square]?.t ?? "·"}
        </button>
      ))}
    </div>
  ),
}));

import { Route } from "@/routes/jogo.$id";
const GamePage = Route.options.component!;
beforeEach(() => {
  cleanup();
  localStorage.clear();
  harness.rows.clear();
  harness.listeners.clear();
  harness.navigate.mockReset();
  harness.conflict = false;
  harness.id = `test-game-${++harness.sequence}`;
  let token = 0;
  vi.stubGlobal("crypto", {
    randomUUID: () => `uuid-${harness.id}-${++token}`,
    getRandomValues: (value: Uint32Array) => {
      value[0] = 0;
      return value;
    },
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

function fixture(state = initialState(), color: "w" | "b" = "w") {
  const row = {
    id: harness.id,
    white_token: "original-white",
    black_token: "original-black",
    state,
  };
  harness.rows.set(row.id, structuredClone(row));
  localStorage.setItem(`xadrez-token-${row.id}`, color === "w" ? row.white_token : row.black_token);
  return row;
}
const square = (value: number) =>
  fireEvent.click(screen.getByRole("button", { name: `Casa ${value}` }));

describe("Gameplay integration", () => {
  it("an older realtime snapshot cannot rewind a saved move", async () => {
    const original = fixture();
    render(<GamePage />);
    await screen.findByTestId("board");
    square(52);
    square(36);
    await waitFor(() => expect(screen.getByTestId("board")).toHaveAttribute("data-move", "1"));
    act(() => broadcast(original));
    expect(screen.getByTestId("board")).toHaveAttribute("data-move", "1");
    expect(screen.getByTestId("board")).toHaveAttribute("data-turn", "b");
  });
  it("requires explicit bomb markings, ends the turn, and resolves only after a reply", async () => {
    vi.useFakeTimers();
    harness.id = "treino";
    const view = render(<GamePage />);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByTestId("board")).toBeInTheDocument();
    // Resource income is covered by the engine tests; seed this UI scenario at 9 energy.
    fireEvent.click(screen.getByRole("button", { name: /Bomba/ }));
    square(9);
    expect(screen.getByRole("button", { name: /Armar bomba/ })).toBeDisabled();
    square(8);
    square(9);
    square(10);
    expect(screen.getByRole("button", { name: "Armar bomba · 2 alvo(s)" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Armar bomba · 2 alvo(s)" }));
    expect(screen.getByTestId("board")).toHaveAttribute("data-turn", "b");
    expect(screen.getByRole("button", { name: "Casa 8" })).toHaveTextContent("p");
    expect(screen.getAllByText("BOMBA ARMADA!").length).toBeGreaterThan(0);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(710);
    });
    square(12);
    square(28);
    expect(screen.getByTestId("board")).toHaveAttribute("data-turn", "w");
    expect(screen.getByRole("button", { name: "Casa 8" })).toHaveTextContent("·");
    expect(screen.getByRole("button", { name: "Casa 9" })).toHaveTextContent("·");
    expect(screen.getByRole("button", { name: "Casa 10" })).toHaveTextContent("p");
    expect(readProgress(localStorage).xp).toBe(0);
    view.unmount();
  });

  it("a PvP rematch requires acceptance, swaps tokens and starts a fresh clock", async () => {
    const state = {
      ...initialState({ matchId: "ended" }),
      winner: "w" as const,
      result: "checkmate" as const,
    };
    const row = fixture(state);
    render(<GamePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Convidar para revanche" }));
    await screen.findByRole("button", { name: "Revanche enviada · aguardando" });
    expect(harness.navigate).not.toHaveBeenCalled();
    const offer = harness.rows.get(row.id)!.state.rematch!;
    const next = harness.rows.get(offer.gameId)!;
    expect(next.white_token).not.toBe(row.black_token);
    expect(next.black_token).not.toBe(row.white_token);
    expect(next.state.clock?.startedAt).toBeNull();
    act(() =>
      broadcast({
        ...row,
        state: { ...harness.rows.get(row.id)!.state, rematch: { ...offer, accepted: true } },
      }),
    );
    await waitFor(() =>
      expect(harness.navigate).toHaveBeenCalledWith({ to: "/jogo/$id", params: { id: next.id } }),
    );
    expect(localStorage.getItem(`xadrez-token-${next.id}`)).toBe(next.black_token);
    expect(readProgress(localStorage).xp).toBe(100);
  });

  it("the opponent accepts the offer and receives white in the next game", async () => {
    const next = {
      id: `next-${harness.id}`,
      white_token: "fresh-white",
      black_token: "fresh-black",
      state: initialState({ matchId: "next" }),
    };
    harness.rows.set(next.id, next);
    fixture(
      {
        ...initialState(),
        winner: "w",
        result: "checkmate",
        rematch: { gameId: next.id, requestedBy: "w", accepted: false },
      },
      "b",
    );
    render(<GamePage />);
    fireEvent.click(await screen.findByRole("button", { name: "Aceitar revanche · trocar cores" }));
    await waitFor(() => expect(harness.rows.get(next.id)!.state.clock?.startedAt).not.toBeNull());
    await waitFor(() => expect(harness.navigate).toHaveBeenCalled());
    expect(harness.rows.get(harness.id)!.state.rematch?.accepted).toBe(true);
    expect(localStorage.getItem(`xadrez-token-${next.id}`)).toBe("fresh-white");
    expect(readProgress(localStorage).xp).toBe(25);
  });

  it("a rejected stale timeout reloads the server state and awards no XP", async () => {
    const state = initialState();
    state.clock = { limitMs: 300000, remaining: { w: 0, b: 300000 }, startedAt: Date.now() };
    fixture(state);
    harness.conflict = true;
    render(<GamePage />);
    await screen.findByText(/A partida foi atualizada/);
    expect(screen.queryByLabelText("Resumo da partida")).not.toBeInTheDocument();
    expect(readProgress(localStorage).xp).toBe(0);
  });
});
