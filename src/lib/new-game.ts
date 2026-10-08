import { initialState, startClock, MATCH_TIME_MS, type ActionContext } from "./chess";

// Entropy is sampled only at the application boundary. The rules engine and
// computer search cannot predict future spins; the chosen event is saved once.
export function randomArenaRoll(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0]! % 4;
}
export function actionContext(): ActionContext {
  return { now: Date.now(), rouletteRoll: randomArenaRoll() };
}
export function newGameState({ roulette = true, training = false, start = false } = {}) {
  const state = initialState({
    roulette,
    rouletteRoll: randomArenaRoll(),
    clockMs: training ? 0 : MATCH_TIME_MS,
    matchId: crypto.randomUUID(),
  });
  return start ? startClock(state, Date.now()) : state;
}
