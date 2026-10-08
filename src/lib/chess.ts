export type Color = "w" | "b";
export type PType = "p" | "n" | "b" | "r" | "q" | "k";
export type Piece = { t: PType; c: Color; shield?: number; frozen?: number };
export type Square = Piece | null;
export type PowerId = "shield" | "freeze" | "teleport" | "bolt" | "bomb";
export type Fx = {
  id: number;
  kind: "move" | "capture" | "shield" | "freeze" | "teleport" | "bolt" | "bomb" | "promote";
  squares: number[];
};

export type GameState = {
  board: Square[];
  turn: Color;
  move: number;
  energy: Record<Color, number>;
  powerUsed: boolean;
  winner: Color | null;
  result?: "checkmate" | "stalemate";
  log: string[];
  last?: [number, number];
  fx?: Fx;
};

export const POWERS: Record<PowerId, { name: string; cost: number; desc: string; icon: string }> = {
  shield: {
    name: "Escudo",
    cost: 2,
    desc: "Uma peça sua fica imune a captura até seu próximo turno.",
    icon: "🛡️",
  },
  freeze: {
    name: "Congelar",
    cost: 3,
    desc: "Uma peça inimiga (exceto rei) não pode se mover no próximo turno.",
    icon: "❄️",
  },
  teleport: {
    name: "Teleporte",
    cost: 4,
    desc: "Mova uma peça sua (exceto rei) para qualquer casa vazia.",
    icon: "✨",
  },
  bolt: {
    name: "Raio",
    cost: 6,
    desc: "Destrói uma peça inimiga (exceto rei e dama) sem escudo.",
    icon: "⚡",
  },
  bomb: {
    name: "Bomba",
    cost: 9,
    desc: "Explode uma área 3x3 ao redor de uma casa: destrói todas as peças inimigas sem escudo (exceto o rei).",
    icon: "💣",
  },
};

export const MAX_ENERGY = 10;

export function initialState(): GameState {
  const back: PType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board: Square[] = Array(64).fill(null);
  for (let i = 0; i < 8; i++) {
    board[i] = { t: back[i]!, c: "b" };
    board[8 + i] = { t: "p", c: "b" };
    board[48 + i] = { t: "p", c: "w" };
    board[56 + i] = { t: back[i]!, c: "w" };
  }
  return {
    board,
    turn: "w",
    move: 0,
    energy: { w: 1, b: 1 },
    powerUsed: false,
    winner: null,
    log: [],
  };
}

const rc = (i: number) => [Math.floor(i / 8), i % 8] as const;
const idx = (r: number, c: number) => r * 8 + c;
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const sqName = (i: number) => "abcdefgh".charAt(i % 8) + (8 - Math.floor(i / 8));

export const isShielded = (p: Piece, move: number) => (p.shield ?? -1) > move;
export const isFrozen = (p: Piece, move: number) => (p.frozen ?? -1) > move;

function pseudoMoves(s: GameState, from: number): number[] {
  const p = s.board[from];
  if (!p || isFrozen(p, s.move)) return [];
  const [r, c] = rc(from);
  const out: number[] = [];
  const canLand = (i: number) => {
    const t = s.board[i];
    return !t || (t.c !== p.c && t.t !== "k" && !isShielded(t, s.move));
  };
  const ray = (dirs: [number, number][], slide: boolean) => {
    for (const [dr, dc] of dirs) {
      let nr = r + dr,
        nc = c + dc;
      while (inside(nr, nc)) {
        const i = idx(nr, nc);
        const t = s.board[i];
        if (canLand(i)) out.push(i);
        if (t || !slide) break;
        nr += dr;
        nc += dc;
      }
    }
  };
  const diag: [number, number][] = [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ];
  const orth: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ];
  switch (p.t) {
    case "p": {
      const d = p.c === "w" ? -1 : 1;
      const start = p.c === "w" ? 6 : 1;
      if (inside(r + d, c) && !s.board[idx(r + d, c)]) {
        out.push(idx(r + d, c));
        if (r === start && !s.board[idx(r + 2 * d, c)]) out.push(idx(r + 2 * d, c));
      }
      for (const dc of [-1, 1]) {
        if (!inside(r + d, c + dc)) continue;
        const i = idx(r + d, c + dc);
        const t = s.board[i];
        if (t && t.c !== p.c && t.t !== "k" && !isShielded(t, s.move)) out.push(i);
      }
      break;
    }
    case "n":
      ray(
        [
          [1, 2],
          [2, 1],
          [-1, 2],
          [-2, 1],
          [1, -2],
          [2, -1],
          [-1, -2],
          [-2, -1],
        ],
        false,
      );
      break;
    case "b":
      ray(diag, true);
      break;
    case "r":
      ray(orth, true);
      break;
    case "q":
      ray([...diag, ...orth], true);
      break;
    case "k":
      ray([...diag, ...orth], false);
      break;
  }
  return out;
}

export const isGameOver = (s: GameState) => !!s.winner || !!s.result;

// Attack maps differ from moves: pawns attack diagonally, and kings defend
// adjacent squares. Frozen pieces and shielded kings respect power durations.
export function isInCheck(s: GameState, color: Color = s.turn): boolean {
  const king = s.board.findIndex((p) => p?.t === "k" && p.c === color);
  if (king < 0 || isShielded(s.board[king]!, s.move)) return false;
  const [kr, kc] = rc(king);
  return s.board.some((p, from) => {
    if (!p || p.c === color || isFrozen(p, s.move)) return false;
    const [r, c] = rc(from);
    const dr = kr - r,
      dc = kc - c;
    if (p.t === "p") return dr === (p.c === "w" ? -1 : 1) && Math.abs(dc) === 1;
    if (p.t === "n") return Math.abs(dr) * Math.abs(dc) === 2;
    if (p.t === "k") return Math.max(Math.abs(dr), Math.abs(dc)) === 1;
    const diagonal = Math.abs(dr) === Math.abs(dc);
    const straight = dr === 0 || dc === 0;
    if (p.t === "b" ? !diagonal : p.t === "r" ? !straight : !diagonal && !straight) return false;
    const stepR = Math.sign(dr),
      stepC = Math.sign(dc);
    for (let nr = r + stepR, nc = c + stepC; nr !== kr || nc !== kc; nr += stepR, nc += stepC) {
      if (s.board[idx(nr, nc)]) return false;
    }
    return true;
  });
}

export function movesFrom(s: GameState, from: number): number[] {
  if (isGameOver(s)) return [];
  const piece = s.board[from];
  if (!piece) return [];
  return pseudoMoves(s, from).filter((to) => {
    const next = clone(s);
    next.board[to] = next.board[from]!;
    next.board[from] = null;
    // Validate after status durations advance, including an expiring shield.
    next.move += 1;
    return !isInCheck(next, piece.c);
  });
}

const NAMES: Record<PType, string> = {
  p: "Peão",
  n: "Cavalo",
  b: "Bispo",
  r: "Torre",
  q: "Dama",
  k: "Rei",
};
const cname = (c: Color) => (c === "w" ? "Brancas" : "Pretas");

function clone(s: GameState): GameState {
  return {
    ...s,
    board: s.board.map((p) => (p ? { ...p } : null)),
    energy: { ...s.energy },
    log: [...s.log],
  };
}

function finishTurn(s: GameState): GameState {
  const actor = s.turn;
  s.move += 1;
  s.turn = actor === "w" ? "b" : "w";
  s.powerUsed = false;
  s.energy[s.turn] = Math.min(MAX_ENERGY, s.energy[s.turn] + 1);
  const hasMove = s.board.some((p, i) => p?.c === s.turn && movesFrom(s, i).length > 0);
  // A power that saves the king is a valid escape from check.
  const hasPower =
    !hasMove &&
    (Object.keys(POWERS) as PowerId[]).some((power) => powerTargets(s, power).length > 0);
  if (!hasMove && !hasPower) {
    if (isInCheck(s)) {
      s.winner = actor;
      s.result = "checkmate";
      s.log.unshift(`Xeque-mate! ${cname(actor)} venceram.`);
    } else {
      s.result = "stalemate";
      s.log.unshift("Empate! Rei afogado, sem ações legais.");
    }
  } else if (isInCheck(s)) {
    s.log.unshift(`Xeque! ${cname(s.turn)} precisam proteger o rei.`);
  }
  return s;
}

export function applyMove(s0: GameState, from: number, to: number): GameState | null {
  if (isGameOver(s0)) return null;
  const p = s0.board[from];
  if (!p || p.c !== s0.turn || !movesFrom(s0, from).includes(to)) return null;
  const s = clone(s0);
  const captured = s.board[to];
  const moving = s.board[from]!;
  s.board[to] = moving;
  s.board[from] = null;
  const [tr] = rc(to);
  if (moving.t === "p" && (tr === 0 || tr === 7)) moving.t = "q";
  let entry = `${cname(p.c)}: ${NAMES[p.t]} ${sqName(from)}→${sqName(to)}`;
  if (captured) entry += ` captura ${NAMES[captured.t]}`;
  if (captured) {
    s.energy[p.c] = Math.min(MAX_ENERGY, s.energy[p.c] + 1);
    entry += " (+1⚡)";
  }
  const promoted = p.t === "p" && moving.t === "q";
  s.fx = {
    id: Math.max(Date.now(), (s0.fx?.id ?? 0) + 1),
    kind: promoted ? "promote" : captured ? "capture" : "move",
    squares: [from, to],
  };
  s.log.unshift(entry);
  s.last = [from, to];
  return finishTurn(s);
}

function rawPowerTargets(s: GameState, power: PowerId, first?: number): number[] {
  const me = s.turn;
  const res: number[] = [];
  s.board.forEach((p, i) => {
    if (power === "teleport" && first !== undefined) {
      if (!p) res.push(i);
      return;
    }
    if (power === "bomb") {
      res.push(i);
      return;
    }
    if (!p) return;
    if (power === "shield" && p.c === me) res.push(i);
    if (power === "freeze" && p.c !== me && p.t !== "k") res.push(i);
    if (power === "teleport" && p.c === me && p.t !== "k" && !isFrozen(p, s.move)) res.push(i);
    if (power === "bolt" && p.c !== me && p.t !== "k" && p.t !== "q" && !isShielded(p, s.move))
      res.push(i);
  });
  return res;
}

export function powerTargets(s: GameState, power: PowerId, first?: number): number[] {
  if (isGameOver(s) || s.powerUsed || s.energy[s.turn] < POWERS[power].cost) return [];
  return rawPowerTargets(s, power, first).filter((target) => {
    if (power === "teleport" && first === undefined) {
      return rawPowerTargets(s, power, target).some(
        (dest) => powerDraft(s, power, target, dest) !== null,
      );
    }
    return power === "teleport" && first !== undefined
      ? powerDraft(s, power, first, target) !== null
      : powerDraft(s, power, target) !== null;
  });
}

function powerDraft(
  s0: GameState,
  power: PowerId,
  target: number,
  dest?: number,
): GameState | null {
  if (isGameOver(s0) || s0.powerUsed) return null;
  const cost = POWERS[power].cost;
  if (s0.energy[s0.turn] < cost) return null;
  if (!rawPowerTargets(s0, power).includes(target)) return null;
  const s = clone(s0);
  const p = s.board[target]!;
  const fxId = Math.max(Date.now(), (s0.fx?.id ?? 0) + 1);
  s.fx = { id: fxId, kind: power, squares: [target] };
  let entry = `${cname(s.turn)} usou ${POWERS[power].name}`;
  if (power === "bomb") {
    const [r, c] = rc(target);
    let n = 0;
    const hit: number[] = [];
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!inside(r + dr, c + dc)) continue;
        const i = idx(r + dr, c + dc);
        const q = s.board[i];
        hit.push(i);
        if (q && q.c !== s.turn && q.t !== "k" && !isShielded(q, s.move)) {
          s.board[i] = null;
          n++;
        }
      }
    s.fx = { id: fxId, kind: "bomb", squares: hit };
    entry += ` em ${sqName(target)} e destruiu ${n} peça(s)`;
  }
  if (power === "shield") {
    p.shield = s.move + 2;
    entry += ` em ${NAMES[p.t]} ${sqName(target)}`;
  }
  if (power === "freeze") {
    p.frozen = s.move + 2;
    entry += ` em ${NAMES[p.t]} ${sqName(target)}`;
  }
  if (power === "bolt") {
    s.board[target] = null;
    entry += ` e destruiu ${NAMES[p.t]} ${sqName(target)}`;
  }
  if (power === "teleport") {
    s.fx = { id: fxId, kind: "teleport", squares: [target, dest ?? target] };
    if (dest === undefined || !rawPowerTargets(s0, power, target).includes(dest)) return null;
    s.board[dest] = p;
    s.board[target] = null;
    if (p.t === "p" && (Math.floor(dest / 8) === 0 || Math.floor(dest / 8) === 7)) p.t = "q";
    s.last = [target, dest];
    entry += `: ${NAMES[p.t]} ${sqName(target)}→${sqName(dest)}`;
  }
  s.energy[s.turn] -= cost;
  if (isInCheck({ ...s, move: s.move + 1 }, s.turn)) return null;
  s.log.unshift(`${entry} — encerrou o turno`);
  return s;
}

export function applyPower(
  s0: GameState,
  power: PowerId,
  target: number,
  dest?: number,
): GameState | null {
  const s = powerDraft(s0, power, target, dest);
  if (!s) return null;
  return finishTurn(s);
}

export const GLYPH: Record<PType, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
