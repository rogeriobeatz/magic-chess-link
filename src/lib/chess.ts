export type Color = "w" | "b";
export type PType = "p" | "n" | "b" | "r" | "q" | "k";
export type Piece = {
  t: PType;
  c: Color;
  id?: string;
  shield?: number;
  frozen?: number;
  shieldReady?: number;
  freezeReady?: number;
};
export type Square = Piece | null;
export type PowerId = "shield" | "freeze" | "teleport" | "bolt" | "bomb";
export type Fx = {
  id: number;
  kind:
    | "move"
    | "capture"
    | "shield"
    | "freeze"
    | "teleport"
    | "bolt"
    | "bomb"
    | "bomb-arm"
    | "promote";
  squares: number[];
};
export type GameResult =
  "checkmate" | "stalemate" | "repetition" | "insufficient-material" | "timeout";
export type ArenaEvent = "stable" | "protection" | "winter" | "distortion";
export type Roulette = {
  enabled: boolean;
  event: ArenaEvent;
  cycle: number;
  lastRolledMove: number;
};
export type PendingBomb = {
  owner: Color;
  center: number;
  targets: { id: string; square: number; t: PType }[];
  detonateAt: number;
};
export type ClockState = {
  remaining: Record<Color, number>;
  startedAt: number | null;
  limitMs: number;
};
export type PowerUse = {
  power: PowerId;
  color: Color;
  move: number;
  materialBefore: number;
  materialAfter: number;
};
export type GameState = {
  board: Square[];
  turn: Color;
  move: number;
  energy: Record<Color, number>;
  powerUsed: boolean;
  winner: Color | null;
  result?: GameResult;
  log: string[];
  last?: [number, number];
  fx?: Fx;
  version?: number;
  revision?: number;
  matchId?: string;
  material?: Record<Color, number>;
  captures?: Record<Color, PType[]>;
  cooldowns?: Record<Color, Partial<Record<PowerId, number>>>;
  bombs?: PendingBomb[];
  roulette?: Roulette;
  clock?: ClockState;
  repetitions?: Record<string, number>;
  powerHistory?: PowerUse[];
  lastDecision?: string;
  rematch?: { gameId: string; requestedBy: Color; accepted: boolean };
};
export type ActionContext = { now?: number; rouletteRoll?: number; bombTargets?: number[] };
export const MAX_ENERGY = 10;
export const MATCH_TIME_MS = 5 * 60 * 1000;
export const POWER_COOLDOWN_ROUNDS = 3;
export const MATERIAL_VALUE: Record<PType, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
export const ARENA_EVENTS: Record<
  ArenaEvent,
  { name: string; desc: string; power: PowerId | null }
> = {
  stable: { name: "Arena estável", desc: "Custos normais para os dois jogadores.", power: null },
  protection: {
    name: "Proteção",
    desc: "Escudo custa 1 energia a menos para ambos.",
    power: "shield",
  },
  winter: {
    name: "Inverno",
    desc: "Congelar custa 1 energia a menos para ambos.",
    power: "freeze",
  },
  distortion: {
    name: "Distorção",
    desc: "Teleporte custa 1 energia a menos para ambos.",
    power: "teleport",
  },
};
export const POWERS: Record<PowerId, { name: string; cost: number; desc: string; icon: string }> = {
  shield: {
    name: "Escudo",
    cost: 2,
    desc: "Protege uma peça sua, exceto o rei, durante a resposta adversária. Intervalo: 3 rodadas.",
    icon: "🛡️",
  },
  freeze: {
    name: "Congelar",
    cost: 3,
    desc: "Bloqueia movimento e ameaça de uma peça inimiga, exceto o rei, na próxima vez dela. Intervalo: 3 rodadas.",
    icon: "❄️",
  },
  teleport: {
    name: "Teleporte",
    cost: 4,
    desc: "Move uma peça sua, exceto o rei, até 3 casas para um espaço vazio. Não promove peões. Intervalo: 3 rodadas.",
    icon: "✨",
  },
  bolt: {
    name: "Raio",
    cost: 6,
    desc: "Destrói um inimigo sem escudo a até 3 casas de uma peça sua ativa. Rei e dama são imunes. Intervalo: 3 rodadas.",
    icon: "⚡",
  },
  bomb: {
    name: "Bomba",
    cost: 9,
    desc: "Marca até 2 inimigos em uma área 3×3. Explode após a resposta adversária: saia da área ou use escudo. Rei imune. Intervalo: 3 rodadas.",
    icon: "💣",
  },
};
export const opposite = (color: Color): Color => (color === "w" ? "b" : "w");
export const isGameOver = (state: GameState) => !!state.winner || !!state.result;
export const colorName = (color: Color) => (color === "w" ? "Brancas" : "Pretas");
export const RESULT_LABELS: Record<GameResult, string> = {
  checkmate: "Xeque-mate",
  stalemate: "Rei afogado",
  repetition: "Repetição de posição",
  "insufficient-material": "Somente os reis",
  timeout: "Tempo esgotado",
};
export function initialState(
  options: { roulette?: boolean; rouletteRoll?: number; clockMs?: number; matchId?: string } = {},
): GameState {
  const back: PType[] = ["r", "n", "b", "q", "k", "b", "n", "r"];
  const board: Square[] = Array(64).fill(null);
  for (let i = 0; i < 8; i++) {
    board[i] = { t: back[i]!, c: "b", id: "b-" + i };
    board[8 + i] = { t: "p", c: "b", id: "b-" + (8 + i) };
    board[48 + i] = { t: "p", c: "w", id: "w-" + (48 + i) };
    board[56 + i] = { t: back[i]!, c: "w", id: "w-" + (56 + i) };
  }
  const time = options.clockMs ?? MATCH_TIME_MS;
  const state: GameState = {
    version: 2,
    revision: 0,
    matchId: options.matchId ?? "match",
    board,
    turn: "w",
    move: 0,
    energy: { w: 1, b: 1 },
    powerUsed: false,
    winner: null,
    log: [],
    material: { w: 0, b: 0 },
    captures: { w: [], b: [] },
    cooldowns: { w: {}, b: {} },
    bombs: [],
    roulette: {
      enabled: options.roulette ?? true,
      event: eventForRoll(options.rouletteRoll ?? 0),
      cycle: 0,
      lastRolledMove: 0,
    },
    clock: { remaining: { w: time, b: time }, startedAt: null, limitMs: time },
    powerHistory: [],
    repetitions: {},
  };
  state.repetitions![positionKey(state)] = 1;
  return state;
}
function eventForRoll(roll: number): ArenaEvent {
  const events: ArenaEvent[] = ["stable", "protection", "winter", "distortion"];
  return events[Number.isInteger(roll) && roll >= 0 && roll < 4 ? roll : 0]!;
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

export function isInCheck(s: GameState, color: Color = s.turn): boolean {
  const king = s.board.findIndex((p) => p?.t === "k" && p.c === color);
  if (king < 0) return false;
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

const NAMES: Record<PType, string> = {
  p: "Peão",
  n: "Cavalo",
  b: "Bispo",
  r: "Torre",
  q: "Dama",
  k: "Rei",
};
const distance = (a: number, b: number) =>
  Math.max(Math.abs(Math.floor(a / 8) - Math.floor(b / 8)), Math.abs((a % 8) - (b % 8)));
export function cloneState(s: GameState): GameState {
  const board = s.board.map((p, i) => (p ? { ...p, id: p.id ?? "legacy-" + p.c + "-" + i } : null));
  // Old saved games remain readable; their missing v2 features receive safe defaults.
  for (const p of board) if (p?.t === "k") delete p.shield;
  return {
    ...s,
    version: 2,
    board,
    energy: { ...s.energy },
    log: [...s.log],
    material: { ...(s.material ?? { w: 0, b: 0 }) },
    captures: { w: [...(s.captures?.w ?? [])], b: [...(s.captures?.b ?? [])] },
    cooldowns: { w: { ...s.cooldowns?.w }, b: { ...s.cooldowns?.b } },
    bombs: (s.bombs ?? []).map((b) => ({ ...b, targets: b.targets.map((t) => ({ ...t })) })),
    roulette: {
      ...(s.roulette ?? { enabled: false, event: "stable", cycle: 0, lastRolledMove: 0 }),
    },
    repetitions: { ...s.repetitions },
    powerHistory: (s.powerHistory ?? []).map((entry) => ({ ...entry })),
    ...(s.clock ? { clock: { ...s.clock, remaining: { ...s.clock.remaining } } } : {}),
  };
}
export function powerCost(s: GameState, power: PowerId): number {
  const discount = s.roulette?.enabled && ARENA_EVENTS[s.roulette.event].power === power ? 1 : 0;
  return Math.max(1, POWERS[power].cost - discount);
}
export function powerCooldown(s: GameState, power: PowerId, color = s.turn): number {
  return Math.ceil(Math.max(0, (s.cooldowns?.[color][power] ?? 0) - s.move) / 2);
}
export function bombArea(center: number): number[] {
  if (!Number.isInteger(center) || center < 0 || center > 63) return [];
  const [r, c] = rc(center);
  const area: number[] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) if (inside(r + dr, c + dc)) area.push(idx(r + dr, c + dc));
  return area;
}
export function bombTargets(s: GameState, center: number): number[] {
  return bombArea(center)
    .filter((i) => {
      const p = s.board[i];
      return p && p.c !== s.turn && p.t !== "k" && !isShielded(p, s.move);
    })
    .sort((a, b) => MATERIAL_VALUE[s.board[b]!.t] - MATERIAL_VALUE[s.board[a]!.t] || a - b);
}
function capture(s: GameState, square: number, owner: Color) {
  const piece = s.board[square];
  if (!piece || piece.c === owner || piece.t === "k") return;
  s.material![owner] += MATERIAL_VALUE[piece.t];
  s.captures![owner].push(piece.t);
  s.board[square] = null;
}
function resolveBombs(s: GameState, effects: boolean) {
  const remaining: PendingBomb[] = [];
  for (const bomb of s.bombs ?? []) {
    if (bomb.detonateAt > s.move) {
      remaining.push(bomb);
      continue;
    }
    const area = bombArea(bomb.center);
    let hits = 0;
    for (const target of bomb.targets) {
      const square = s.board.findIndex((p) => p?.id === target.id);
      const piece = s.board[square];
      // Shield remains effective during the response; it expires after that response.
      if (piece && area.includes(square) && !isShielded(piece, s.move - 1)) {
        capture(s, square, bomb.owner);
        hits++;
      }
    }
    if (effects) {
      s.fx = {
        id: (s.fx?.id ?? 0) + 1,
        kind: "bomb",
        squares: [bomb.center, ...area.filter((square) => square !== bomb.center)],
      };
      s.log.unshift(
        colorName(bomb.owner) +
          ": bomba explodiu em " +
          sqName(bomb.center) +
          " — " +
          hits +
          " alvo(s) atingido(s)",
      );
      s.lastDecision =
        (s.lastDecision ? s.lastDecision + ". " : "") +
        "Bomba em " +
        sqName(bomb.center) +
        ": " +
        hits +
        " alvo(s) atingido(s).";
      const use = s.powerHistory
        ?.slice()
        .reverse()
        .find(
          (entry) =>
            entry.power === "bomb" &&
            entry.color === bomb.owner &&
            entry.move === bomb.detonateAt - 2,
        );
      if (use) use.materialAfter = materialAdvantage(s, bomb.owner);
    }
  }
  s.bombs = remaining;
}
function previewResponse(s: GameState): GameState {
  const next = cloneState(s);
  next.move++;
  resolveBombs(next, false);
  return next;
}
export function isKingThreatened(s: GameState, color = s.turn): boolean {
  if (isInCheck(s, color)) return true;
  return (
    !!s.bombs?.some((b) => b.detonateAt === s.move + 1) && isInCheck(previewResponse(s), color)
  );
}
export function movesFrom(s: GameState, from: number): number[] {
  if (isGameOver(s)) return [];
  const p = s.board[from];
  if (!p) return [];
  return pseudoMoves(s, from).filter((to) => {
    const next = cloneState(s);
    next.board[to] = next.board[from]!;
    next.board[from] = null;
    return !isInCheck(previewResponse(next), p.c);
  });
}
export function rawPowerTargets(s: GameState, power: PowerId, first?: number): number[] {
  if (power === "teleport" && first !== undefined) {
    const piece = s.board[first];
    if (!piece || piece.c !== s.turn || piece.t === "k" || isFrozen(piece, s.move)) return [];
    return s.board.flatMap((p, i) =>
      !p &&
      distance(first, i) <= 3 &&
      (piece.t !== "p" || (Math.floor(i / 8) !== 0 && Math.floor(i / 8) !== 7))
        ? [i]
        : [],
    );
  }
  return s.board.flatMap((p, i) => {
    if (power === "bomb") return bombTargets(s, i).length ? [i] : [];
    if (!p) return [];
    if (power === "shield")
      return p.c === s.turn && p.t !== "k" && (p.shieldReady ?? 0) <= s.move ? [i] : [];
    if (power === "freeze")
      return p.c !== s.turn && p.t !== "k" && (p.freezeReady ?? 0) <= s.move ? [i] : [];
    if (power === "teleport")
      return p.c === s.turn && p.t !== "k" && !isFrozen(p, s.move) ? [i] : [];
    if (power === "bolt")
      return p.c !== s.turn &&
        p.t !== "k" &&
        p.t !== "q" &&
        !isShielded(p, s.move) &&
        s.board.some((own, j) => own?.c === s.turn && !isFrozen(own, s.move) && distance(j, i) <= 3)
        ? [i]
        : [];
    return [];
  });
}
export function powerTargets(s: GameState, power: PowerId, first?: number): number[] {
  if (
    isGameOver(s) ||
    s.powerUsed ||
    powerCooldown(s, power) ||
    s.energy[s.turn] < powerCost(s, power)
  )
    return [];
  return rawPowerTargets(s, power, first).filter((target) => {
    if (power === "teleport" && first === undefined)
      return rawPowerTargets(s, power, target).some(
        (dest) => powerDraft(s, power, target, dest) !== null,
      );
    return power === "teleport" && first !== undefined
      ? powerDraft(s, power, first, target) !== null
      : powerDraft(s, power, target) !== null;
  });
}
export function materialAdvantage(s: GameState, color: Color): number {
  return s.board.reduce(
    (value, p) => value + (p ? (p.c === color ? 1 : -1) * MATERIAL_VALUE[p.t] : 0),
    0,
  );
}
function powerDraft(
  s0: GameState,
  power: PowerId,
  target: number,
  dest?: number,
  context: ActionContext = {},
): GameState | null {
  if (
    isGameOver(s0) ||
    s0.powerUsed ||
    powerCooldown(s0, power) ||
    s0.energy[s0.turn] < powerCost(s0, power)
  )
    return null;
  if (!rawPowerTargets(s0, power).includes(target)) return null;
  const s = cloneState(s0);
  const p = s.board[target];
  s.fx = { id: Math.max(context.now ?? 0, (s0.fx?.id ?? 0) + 1), kind: power, squares: [target] };
  let entry = colorName(s.turn) + " usou " + POWERS[power].name;
  const ready = s.move + POWER_COOLDOWN_ROUNDS * 2;
  if (power === "shield") {
    p!.shield = s.move + 2;
    p!.shieldReady = ready;
    entry += " em " + sqName(target);
  }
  if (power === "freeze") {
    p!.frozen = s.move + 2;
    p!.freezeReady = ready;
    entry += " em " + sqName(target) + " (movimento e ameaça bloqueados)";
  }
  if (power === "bolt") {
    capture(s, target, s.turn);
    entry += " em " + sqName(target);
  }
  if (power === "teleport") {
    if (dest === undefined || !rawPowerTargets(s0, power, target).includes(dest)) return null;
    s.board[dest] = p!;
    s.board[target] = null;
    s.last = [target, dest];
    s.fx.squares = [target, dest];
    entry += ": " + sqName(target) + "→" + sqName(dest);
  }
  if (power === "bomb") {
    const available = bombTargets(s0, target);
    const selected = context.bombTargets ?? available.slice(0, 2);
    if (
      !selected.length ||
      selected.length > 2 ||
      new Set(selected).size !== selected.length ||
      selected.some((i) => !available.includes(i))
    )
      return null;
    const targets = selected.map((square) => ({
      id: s.board[square]!.id!,
      square,
      t: s.board[square]!.t,
    }));
    s.bombs!.push({ owner: s.turn, center: target, targets, detonateAt: s.move + 2 });
    s.fx.kind = "bomb-arm";
    s.fx.squares = [target, ...selected];
    entry +=
      " em " +
      sqName(target) +
      " — alvos: " +
      selected.map(sqName).join(", ") +
      "; explode após a resposta";
  }
  s.energy[s.turn] -= powerCost(s0, power);
  s.cooldowns![s.turn][power] = ready;
  if (isInCheck(previewResponse(s), s.turn)) return null;
  s.powerHistory!.push({
    power,
    color: s.turn,
    move: s.move,
    materialBefore: materialAdvantage(s0, s.turn),
    materialAfter: materialAdvantage(s, s.turn),
  });
  s.lastDecision = entry;
  s.log.unshift(entry + " — turno encerrado");
  return s;
}
export function positionKey(s: GameState): string {
  const relative = (until: number | undefined) => Math.max(0, (until ?? 0) - s.move);
  return JSON.stringify([
    s.board.map((p) =>
      p
        ? [
            p.t,
            p.c,
            relative(p.shield),
            relative(p.frozen),
            relative(p.shieldReady),
            relative(p.freezeReady),
          ]
        : null,
    ),
    s.turn,
    s.energy.w,
    s.energy.b,
    ["w", "b"].map((c) =>
      (Object.keys(POWERS) as PowerId[]).map((p) => relative(s.cooldowns?.[c as Color][p])),
    ),
    s.roulette?.enabled ? [s.roulette.event, s.move % 6] : ["off"],
    (s.bombs ?? []).map((b) => [
      b.owner,
      b.center,
      b.detonateAt - s.move,
      b.targets.map((t) => s.board.findIndex((p) => p?.id === t.id)),
    ]),
  ]);
}
function adjudicate(s: GameState) {
  if (isGameOver(s)) return;
  const hasMove = s.board.some((p, i) => p?.c === s.turn && movesFrom(s, i).length);
  const hasPower =
    !hasMove && (Object.keys(POWERS) as PowerId[]).some((p) => powerTargets(s, p).length);
  if (!hasMove && !hasPower) {
    if (isKingThreatened(s)) {
      s.winner = opposite(s.turn);
      s.result = "checkmate";
      s.log.unshift("Xeque-mate! " + colorName(s.winner) + " venceram.");
    } else {
      s.result = "stalemate";
      s.log.unshift("Empate! Rei afogado, sem ações legais.");
    }
  } else if (s.board.every((p) => !p || p.t === "k")) {
    s.result = "insufficient-material";
    s.log.unshift("Empate! Somente os reis no tabuleiro.");
  } else if ((s.repetitions?.[positionKey(s)] ?? 0) >= 3) {
    s.result = "repetition";
    s.log.unshift("Empate! Mesma posição completa pela terceira vez.");
  } else if (isKingThreatened(s))
    s.log.unshift("Xeque! " + colorName(s.turn) + " precisam proteger o rei.");
  if (isGameOver(s) && s.clock) s.clock.startedAt = null;
}
function finishTurn(s: GameState, context: ActionContext): GameState {
  s.revision = (s.revision ?? 0) + 1;
  s.move++;
  s.turn = opposite(s.turn);
  s.powerUsed = false;
  resolveBombs(s, true);
  // Both colors receive income together: each starts its next own turn with the same base budget.
  if (s.move % 2 === 0)
    for (const color of ["w", "b"] as Color[])
      s.energy[color] = Math.min(MAX_ENERGY, s.energy[color] + 1);
  if (s.roulette?.enabled && s.move % 6 === 0) {
    s.roulette = {
      enabled: true,
      event: eventForRoll(context.rouletteRoll ?? 0),
      cycle: s.roulette.cycle + 1,
      lastRolledMove: s.move,
    };
    s.log.unshift("Roleta: " + ARENA_EVENTS[s.roulette.event].name + " — válida por 3 rodadas.");
  }
  const key = positionKey(s);
  s.repetitions![key] = (s.repetitions![key] ?? 0) + 1;
  adjudicate(s);
  return s;
}
export function startClock(s: GameState, now: number): GameState {
  if (!s.clock || s.clock.limitMs <= 0 || s.clock.startedAt !== null || isGameOver(s)) return s;
  const next = cloneState(s);
  next.clock!.startedAt = now;
  next.revision = (s.revision ?? 0) + 1;
  return next;
}
export function clockRemaining(s: GameState, color: Color, now: number): number {
  const clock = s.clock;
  if (!clock) return 0;
  const elapsed =
    clock.startedAt !== null && s.turn === color && !isGameOver(s)
      ? Math.max(0, now - clock.startedAt)
      : 0;
  return Math.max(0, clock.remaining[color] - elapsed);
}
export function applyTimeout(s: GameState, now: number): GameState | null {
  if (
    isGameOver(s) ||
    !s.clock ||
    s.clock.limitMs <= 0 ||
    s.clock.startedAt === null ||
    clockRemaining(s, s.turn, now) > 0
  )
    return null;
  const next = cloneState(s);
  next.clock!.remaining[s.turn] = 0;
  next.clock!.startedAt = null;
  next.winner = opposite(s.turn);
  next.result = "timeout";
  next.revision = (s.revision ?? 0) + 1;
  next.lastDecision = colorName(s.turn) + " ficaram sem tempo.";
  next.log.unshift(colorName(s.turn) + " perderam por tempo.");
  return next;
}
function chargeClock(s: GameState, context: ActionContext) {
  if (context.now !== undefined && s.clock && s.clock.startedAt !== null) {
    s.clock.remaining[s.turn] = clockRemaining(s, s.turn, context.now);
    s.clock.startedAt = context.now;
  }
}
export function applyMove(
  s0: GameState,
  from: number,
  to: number,
  context: ActionContext = {},
): GameState | null {
  if (isGameOver(s0)) return null;
  const timeout = context.now !== undefined ? applyTimeout(s0, context.now) : null;
  if (timeout) return timeout;
  const p = s0.board[from];
  if (!p || p.c !== s0.turn || !movesFrom(s0, from).includes(to)) return null;
  const s = cloneState(s0);
  chargeClock(s, context);
  const captured = s.board[to];
  if (captured) capture(s, to, p.c);
  const moving = s.board[from]!;
  s.board[to] = moving;
  s.board[from] = null;
  if (moving.t === "p" && (Math.floor(to / 8) === 0 || Math.floor(to / 8) === 7)) moving.t = "q";
  const promoted = p.t === "p" && moving.t === "q";
  const entry =
    colorName(p.c) +
    ": " +
    NAMES[p.t] +
    " " +
    sqName(from) +
    "→" +
    sqName(to) +
    (captured ? " captura " + NAMES[captured.t] : "");
  s.fx = {
    id: Math.max(context.now ?? 0, (s0.fx?.id ?? 0) + 1),
    kind: promoted ? "promote" : captured ? "capture" : "move",
    squares: [from, to],
  };
  s.last = [from, to];
  s.lastDecision = entry;
  s.log.unshift(entry);
  return finishTurn(s, context);
}
export function applyPower(
  s0: GameState,
  power: PowerId,
  target: number,
  dest?: number,
  context: ActionContext = {},
): GameState | null {
  if (isGameOver(s0)) return null;
  const timeout = context.now !== undefined ? applyTimeout(s0, context.now) : null;
  if (timeout) return timeout;
  const s = powerDraft(s0, power, target, dest, context);
  if (!s) return null;
  chargeClock(s, context);
  return finishTurn(s, context);
}
export const GLYPH: Record<PType, string> = { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };
