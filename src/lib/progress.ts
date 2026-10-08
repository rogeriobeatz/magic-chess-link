import {
  isGameOver,
  POWERS,
  type Color,
  type GameState,
  type PowerId,
  type PowerUse,
} from "./chess";
import type { Difficulty } from "./computer";

const KEY = "chess-league-progress-v2";
export type MatchSummary = {
  id: string;
  viewer: Color;
  winner: Color | null;
  mode: "solo" | "pvp";
  difficulty: Difficulty | null;
  roulette: boolean;
  result: string;
  turns: number;
  durationMs: number;
  powers: PowerUse[];
};
export type Progress = {
  xp: number;
  awarded: string[];
  matches: MatchSummary[];
  achievements: string[];
};
export const ACHIEVEMENTS: Record<string, string> = {
  debut: "Primeiro duelo concluído",
  victory: "Primeira vitória",
  veteran: "10 duelos concluídos",
  master: "Vitória no solo difícil",
};
const empty = (): Progress => ({ xp: 0, awarded: [], matches: [], achievements: [] });
export function readProgress(storage: Pick<Storage, "getItem">): Progress {
  try {
    const data: unknown = JSON.parse(storage.getItem(KEY) ?? "null");
    if (!data || typeof data !== "object") return empty();
    const value = data as Progress;
    return Number.isFinite(value.xp) &&
      value.xp >= 0 &&
      Array.isArray(value.awarded) &&
      value.awarded.every((id) => typeof id === "string") &&
      Array.isArray(value.matches) &&
      value.matches.every(
        (match) =>
          match &&
          typeof match.id === "string" &&
          (match.viewer === "w" || match.viewer === "b") &&
          (match.winner === null || match.winner === "w" || match.winner === "b") &&
          Number.isFinite(match.durationMs) &&
          Array.isArray(match.powers) &&
          match.powers.every(
            (use) =>
              use &&
              Object.hasOwn(POWERS, use.power) &&
              (use.color === "w" || use.color === "b") &&
              Number.isFinite(use.materialBefore),
          ),
      ) &&
      Array.isArray(value.achievements) &&
      value.achievements.every((key) => typeof key === "string")
      ? value
      : empty();
  } catch {
    return empty();
  }
}
export function matchDuration(state: GameState): number {
  const clock = state.clock;
  return clock && clock.limitMs > 0
    ? Math.max(0, clock.limitMs * 2 - clock.remaining.w - clock.remaining.b)
    : 0;
}
export function matchXp(state: GameState, viewer: Color): number {
  return !state.winner ? 50 : state.winner === viewer ? 100 : 25;
}
export function recordMatch(
  storage: Pick<Storage, "getItem" | "setItem">,
  gameId: string,
  state: GameState,
  viewer: Color,
  difficulty: Difficulty | null,
): Progress {
  const progress = readProgress(storage);
  const key = `${gameId}:${state.matchId ?? "legacy"}`;
  if (!isGameOver(state) || gameId === "treino" || progress.awarded.includes(key)) return progress;
  const summary: MatchSummary = {
    id: key,
    viewer,
    winner: state.winner,
    mode: difficulty ? "solo" : "pvp",
    difficulty,
    roulette: state.roulette?.enabled ?? false,
    result: state.result ?? "checkmate",
    turns: state.move,
    durationMs: matchDuration(state),
    powers: state.powerHistory ?? [],
  };
  const achievements = new Set(progress.achievements);
  achievements.add("debut");
  if (state.winner === viewer) achievements.add("victory");
  if (progress.awarded.length + 1 >= 10) achievements.add("veteran");
  if (difficulty === "hard" && state.winner === viewer) achievements.add("master");
  const next: Progress = {
    xp: progress.xp + matchXp(state, viewer),
    awarded: [...progress.awarded, key],
    matches: [...progress.matches, summary].slice(-200),
    achievements: [...achievements],
  };
  storage.setItem(KEY, JSON.stringify(next));
  return next;
}
export function balanceMetrics(matches: MatchSummary[]) {
  const powers = (Object.keys(POWERS) as PowerId[]).map((power) => {
    const uses = matches.flatMap((match) =>
      match.powers
        .filter((use) => use.power === power)
        .map((use) => ({ ...use, won: match.winner === use.color })),
    );
    return {
      power,
      count: uses.length,
      wins: uses.filter((use) => use.won).length,
      ahead: uses.filter((use) => use.materialBefore > 0).length,
      behind: uses.filter((use) => use.materialBefore < 0).length,
    };
  });
  const timed = matches.filter((match) => match.durationMs > 0);
  return {
    games: matches.length,
    whiteWins: matches.filter((match) => match.winner === "w").length,
    blackWins: matches.filter((match) => match.winner === "b").length,
    draws: matches.filter((match) => !match.winner).length,
    averageMs: timed.length
      ? timed.reduce((sum, match) => sum + match.durationMs, 0) / timed.length
      : 0,
    powers,
  };
}
