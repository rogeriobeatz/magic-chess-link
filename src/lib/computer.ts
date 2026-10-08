import {
  applyMove,
  applyPower,
  isFrozen,
  isGameOver,
  isInCheck,
  isShielded,
  movesFrom,
  powerTargets,
  powerCost,
  bombTargets,
  bombArea,
  type ActionContext,
  type Color,
  type GameState,
  type PowerId,
  type PType,
} from "./chess";

export const DIFFICULTIES = {
  easy: {
    name: "Fácil",
    description: "Jogadas variadas para aprender.",
    depth: 1,
    width: 8,
    budget: 250,
  },
  medium: {
    name: "Médio",
    description: "Antecipa sua resposta e busca capturas.",
    depth: 2,
    width: 12,
    budget: 650,
  },
  hard: {
    name: "Difícil",
    description: "Planeja sequências e combina poderes.",
    depth: 3,
    width: 16,
    budget: 1500,
  },
} as const;
export type Difficulty = keyof typeof DIFFICULTIES;
export type ComputerAction =
  | { kind: "move"; from: number; to: number }
  | { kind: "power"; power: PowerId; target: number; dest?: number; targets?: number[] };
export type ComputerRequest = { state: GameState; difficulty: Difficulty };
export type ComputerResponse = { action: ComputerAction | null; error?: string };

export function soloDifficulty(id: string): Difficulty | null {
  const key = id.startsWith("solo-") ? id.slice(5).replace(/-classico$/, "") : "";
  return Object.hasOwn(DIFFICULTIES, key) ? (key as Difficulty) : null;
}

export function soloGameId(difficulty: Difficulty, roulette: boolean): string {
  return `solo-${difficulty}${roulette ? "" : "-classico"}`;
}

export function applyComputerAction(
  state: GameState,
  action: ComputerAction,
  context: ActionContext = {},
): GameState | null {
  return action.kind === "move"
    ? applyMove(state, action.from, action.to, context)
    : applyPower(state, action.power, action.target, action.dest, {
        ...context,
        ...(action.targets ? { bombTargets: action.targets } : {}),
      });
}

const VALUE: Record<PType, number> = { p: 100, n: 320, b: 335, r: 500, q: 900, k: 0 };
const MATE = 100_000;

function evaluate(state: GameState, perspective: Color): number {
  if (state.winner) return state.winner === perspective ? MATE : -MATE;
  if (state.result) return 0;
  let score = (state.energy[perspective] - state.energy[perspective === "w" ? "b" : "w"]) * 12;
  state.board.forEach((piece, square) => {
    if (!piece) return;
    const row = Math.floor(square / 8),
      col = square % 8;
    const center = 7 - Math.abs(3.5 - row) - Math.abs(3.5 - col);
    const advancement = piece.c === "w" ? 6 - row : row - 1;
    const development =
      piece.t === "p"
        ? advancement * 9 + center * 3
        : piece.t === "n" || piece.t === "b"
          ? center * 10
          : piece.t === "k"
            ? -center * 4
            : center * 2;
    const protection = isShielded(piece, state.move)
      ? piece.t === "k"
        ? 35
        : VALUE[piece.t] * 0.08
      : 0;
    const frozen = isFrozen(piece, state.move) ? VALUE[piece.t] * 0.12 : 0;
    score +=
      (piece.c === perspective ? 1 : -1) * (VALUE[piece.t] + development + protection - frozen);
  });
  if (isInCheck(state, perspective)) score -= 45;
  if (isInCheck(state, perspective === "w" ? "b" : "w")) score += 45;
  for (const bomb of state.bombs ?? []) {
    const area = bombArea(bomb.center);
    const threatened = bomb.targets.reduce((sum, target) => {
      const square = state.board.findIndex((piece) => piece?.id === target.id);
      const piece = state.board[square];
      return (
        sum +
        (piece && area.includes(square) && !isShielded(piece, state.move) ? VALUE[piece.t] : 0)
      );
    }, 0);
    // A reply can save one target. Search evaluates the actual escape/detonation next.
    score += (bomb.owner === perspective ? 1 : -1) * threatened * 0.35;
  }
  return score;
}

// Include every legal kind of power, especially escapes from check. The deadline
// limits search work; candidates are always validated by the shared rules engine.
function* legalActions(state: GameState): Generator<ComputerAction> {
  if (isGameOver(state)) return;
  for (let from = 0; from < 64; from++) {
    if (state.board[from]?.c !== state.turn) continue;
    for (const to of movesFrom(state, from)) yield { kind: "move", from, to };
  }
  // Teleport has the largest branching factor, so examine it last.
  for (const power of ["bolt", "bomb", "freeze", "shield", "teleport"] as PowerId[]) {
    if (state.energy[state.turn] < powerCost(state, power)) continue;
    for (const target of powerTargets(state, power)) {
      if (power === "teleport") {
        for (const dest of powerTargets(state, power, target))
          yield { kind: "power", power, target, dest };
      } else if (power === "bomb") {
        const targets = bombTargets(state, target);
        // Different markings can lead to different tactical responses.
        for (let i = 0; i < targets.length; i++) {
          yield { kind: "power", power, target, targets: [targets[i]!] };
          for (let j = i + 1; j < targets.length; j++)
            yield { kind: "power", power, target, targets: [targets[i]!, targets[j]!] };
        }
      } else yield { kind: "power", power, target };
    }
  }
}

type Candidate = { action: ComputerAction; state: GameState; score: number };
const TIMEOUT = Symbol("computer-search-timeout");

export function chooseComputerAction(
  state: GameState,
  difficulty: Difficulty,
  options: { random?: () => number; timeBudgetMs?: number } = {},
): ComputerAction | null {
  if (isGameOver(state)) return null;
  const config = DIFFICULTIES[difficulty];
  const deadline = performance.now() + (options.timeBudgetMs ?? config.budget);
  const perspective = state.turn;
  const candidates = (position: GameState, root = false): Candidate[] => {
    const output: Candidate[] = [];
    for (const action of legalActions(position)) {
      if (performance.now() > deadline && output.length) {
        if (root) break;
        throw TIMEOUT;
      }
      const next = applyComputerAction(position, action);
      if (next) output.push({ action, state: next, score: evaluate(next, perspective) });
    }
    const direction = position.turn === perspective ? -1 : 1;
    return output.sort((a, b) => direction * (a.score - b.score));
  };
  const root = candidates(state, true);
  if (!root.length) return null;
  // All levels take immediate mates rather than randomly overlooking the result.
  if (root[0]!.state.winner === perspective) return root[0]!.action;
  if (difficulty === "easy") {
    const pool = root.slice(0, config.width);
    const random = Math.max(0, Math.min(0.999999, (options.random ?? Math.random)()));
    return pool[Math.floor(random * pool.length)]!.action;
  }

  const search = (position: GameState, depth: number, alpha: number, beta: number): number => {
    if (performance.now() > deadline) throw TIMEOUT;
    if (!depth || isGameOver(position)) return evaluate(position, perspective);
    const maximize = position.turn === perspective;
    let best = maximize ? -Infinity : Infinity;
    const replies = candidates(position).slice(0, config.width);
    if (!replies.length) return evaluate(position, perspective);
    for (const reply of replies) {
      const score = search(reply.state, depth - 1, alpha, beta);
      best = maximize ? Math.max(best, score) : Math.min(best, score);
      if (maximize) alpha = Math.max(alpha, best);
      else beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  };

  let choice = root[0]!.action;
  // Iterative deepening keeps the last fully evaluated decision on timeout.
  for (let depth = 2; depth <= config.depth; depth++) {
    let best = -Infinity;
    let iteration = choice;
    try {
      for (const candidate of root.slice(0, config.width * 2)) {
        const score = search(candidate.state, depth - 1, best, Infinity);
        if (score > best) {
          best = score;
          iteration = candidate.action;
        }
      }
      choice = iteration;
    } catch (error) {
      if (error !== TIMEOUT) throw error;
      break;
    }
  }
  return choice;
}
