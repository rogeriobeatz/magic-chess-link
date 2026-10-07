export type Color = "w" | "b";
export type PType = "p" | "n" | "b" | "r" | "q" | "k";
export type Piece = { t: PType; c: Color; shield?: number; frozen?: number };
export type Square = Piece | null;
export type PowerId = "shield" | "freeze" | "teleport" | "bolt";

export type GameState = {
  board: Square[];
  turn: Color;
  move: number;
  energy: Record<Color, number>;
  powerUsed: boolean;
  winner: Color | null;
  log: string[];
  last?: [number, number];
};

export const POWERS: Record<PowerId, { name: string; cost: number; desc: string; icon: string }> = {
  shield: { name: "Escudo", cost: 2, desc: "Uma peça sua fica imune a captura até seu próximo turno.", icon: "🛡️" },
  freeze: { name: "Congelar", cost: 3, desc: "Uma peça inimiga (exceto rei) não pode se mover no próximo turno.", icon: "❄️" },
  teleport: { name: "Teleporte", cost: 4, desc: "Mova uma peça sua (exceto rei) para qualquer casa vazia.", icon: "✨" },
  bolt: { name: "Raio", cost: 6, desc: "Destrói uma peça inimiga (exceto rei e dama) sem escudo.", icon: "⚡" },
};

export const MAX_ENERGY = 10;

export function initialState(): GameState {
  const back: PType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board: Square[] = Array(64).fill(null);
  for (let i = 0; i < 8; i++) {
    board[i] = { t: back[i], c: "b" };
    board[8 + i] = { t: "p", c: "b" };
    board[48 + i] = { t: "p", c: "w" };
    board[56 + i] = { t: back[i], c: "w" };
  }
  return { board, turn: "w", move: 0, energy: { w: 1, b: 1 }, powerUsed: false, winner: null, log: [] };
}

const rc = (i: number) => [Math.floor(i / 8), i % 8] as const;
const idx = (r: number, c: number) => r * 8 + c;
const inside = (r: number, c: number) => r >= 0 && r < 8 && c >= 0 && c < 8;
export const sqName = (i: number) => "abcdefgh"[i % 8] + (8 - Math.floor(i / 8));

export const isShielded = (p: Piece, move: number) => (p.shield ?? -1) > move;
export const isFrozen = (p: Piece, move: number) => (p.frozen ?? -1) > move;

export function movesFrom(s: GameState, from: number): number[] {
  const p = s.board[from];
  if (!p || isFrozen(p, s.move)) return [];
  const [r, c] = rc(from);
  const out: number[] = [];
  const canLand = (i: number) => {
    const t = s.board[i];
    return !t || (t.c !== p.c && !isShielded(t, s.move));
  };
  const ray = (dirs: [number, number][], slide: boolean) => {
    for (const [dr, dc] of dirs) {
      let nr = r + dr, nc = c + dc;
      while (inside(nr, nc)) {
        const i = idx(nr, nc);
        const t = s.board[i];
        if (canLand(i)) out.push(i);
        if (t || !slide) break;
        nr += dr; nc += dc;
      }
    }
  };
  const diag: [number, number][] = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const orth: [number, number][] = [[1, 0], [-1, 0], [0, 1], [0, -1]];
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
        if (t && t.c !== p.c && !isShielded(t, s.move)) out.push(i);
      }
      break;
    }
    case "n":
      ray([[1, 2], [2, 1], [-1, 2], [-2, 1], [1, -2], [2, -1], [-1, -2], [-2, -1]], false);
      break;
    case "b": ray(diag, true); break;
    case "r": ray(orth, true); break;
    case "q": ray([...diag, ...orth], true); break;
    case "k": ray([...diag, ...orth], false); break;
  }
  return out;
}

const NAMES: Record<PType, string> = { p: "Peão", n: "Cavalo", b: "Bispo", r: "Torre", q: "Dama", k: "Rei" };
const cname = (c: Color) => (c === "w" ? "Brancas" : "Pretas");

function clone(s: GameState): GameState {
  return { ...s, board: s.board.map((p) => (p ? { ...p } : null)), energy: { ...s.energy }, log: [...s.log] };
}

export function applyMove(s0: GameState, from: number, to: number): GameState | null {
  if (s0.winner) return null;
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
  if (captured?.t === "k") s.winner = p.c;
  s.log.unshift(entry);
  s.last = [from, to];
  s.move += 1;
  s.turn = s.turn === "w" ? "b" : "w";
  s.powerUsed = false;
  s.energy[s.turn] = Math.min(MAX_ENERGY, s.energy[s.turn] + 1);
  if (!s.winner && !s.board.some((q, i) => q && q.c === s.turn && movesFrom(s, i).length > 0)) {
    s.winner = p.c;
    s.log.unshift(`${cname(s.turn)} sem movimentos!`);
  }
  return s;
}

export function powerTargets(s: GameState, power: PowerId, first?: number): number[] {
  const me = s.turn;
  const res: number[] = [];
  s.board.forEach((p, i) => {
    if (power === "teleport" && first !== undefined) {
      if (!p) res.push(i);
      return;
    }
    if (!p) return;
    if (power === "shield" && p.c === me) res.push(i);
    if (power === "freeze" && p.c !== me && p.t !== "k") res.push(i);
    if (power === "teleport" && p.c === me && p.t !== "k" && !isFrozen(p, s.move)) res.push(i);
    if (power === "bolt" && p.c !== me && p.t !== "k" && p.t !== "q" && !isShielded(p, s.move)) res.push(i);
  });
  return res;
}

export function applyPower(s0: GameState, power: PowerId, target: number, dest?: number): GameState | null {
  if (s0.winner || s0.powerUsed) return null;
  const cost = POWERS[power].cost;
  if (s0.energy[s0.turn] < cost) return null;
  if (!powerTargets(s0, power).includes(target)) return null;
  const s = clone(s0);
  const p = s.board[target]!;
  let entry = `${cname(s.turn)} usou ${POWERS[power].name}`;
  if (power === "shield") { p.shield = s.move + 2; entry += ` em ${NAMES[p.t]} ${sqName(target)}`; }
  if (power === "freeze") { p.frozen = s.move + 2; entry += ` em ${NAMES[p.t]} ${sqName(target)}`; }
  if (power === "bolt") { s.board[target] = null; entry += ` e destruiu ${NAMES[p.t]} ${sqName(target)}`; }
  if (power === "teleport") {
    if (dest === undefined || s.board[dest]) return null;
    s.board[dest] = p; s.board[target] = null;
    entry += `: ${NAMES[p.t]} ${sqName(target)}→${sqName(dest)}`;
  }
  s.energy[s.turn] -= cost;
  s.powerUsed = true;
  s.log.unshift(entry);
  return s;
}

export const GLYPH: Record<PType, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
