import { useEffect, useRef } from "react";
import type { GameState } from "@/lib/chess";
import moveSfx from "../audio/movendo peça/Chess Piece Sliding Movement 1/Chess Piece Sliding Movement 1.mp3";
import captureSfx from "../audio/colocando peça 2/OBJECT_TABLE_GAME_Chess_Piece_Place_04.wav";
import laserSfx from "../audio/tiros de lazer.wav";
import shieldSfx from "../audio/Sparkling Magic Elixir.wav";
import freezeSfx from "../audio/Sparkle Elixir Bonus.wav";
import teleportSfx from "../audio/up diamond-sparkle.mp3";
import victorySfx from "../audio/Game Celebration 2.mp3";
import defeatSfx from "../audio/Gamers Fail Game.wav";
import chatSfx from "../audio/mensagem enviada/Message Alert/Message Alert.mp3";

export type ArenaCue = "move" | "capture" | "power" | "explosion" | "victory" | "defeat" | "bolt" | "shield" | "freeze" | "teleport" | "chat";
const AUDIO_LIBRARY: Partial<Record<ArenaCue, { src: string; gain: number }>> = {
  move: { src: moveSfx, gain: .22 },
  capture: { src: captureSfx, gain: .3 },
  bolt: { src: laserSfx, gain: .28 },
  shield: { src: shieldSfx, gain: .22 },
  freeze: { src: freezeSfx, gain: .2 },
  teleport: { src: teleportSfx, gain: .23 },
  victory: { src: victorySfx, gain: .26 },
  defeat: { src: defeatSfx, gain: .24 },
  chat: { src: chatSfx, gain: .15 },
};
const activeAudio = new Set<HTMLAudioElement>();
export function playFileCue(cue: ArenaCue): boolean {
  if (typeof window === "undefined") return false;
  const entry = AUDIO_LIBRARY[cue];
  if (!entry) return false;
  try {
    const audio = new Audio(entry.src);
    audio.volume = entry.gain;
    activeAudio.add(audio);
    const cleanup = () => { activeAudio.delete(audio); audio.removeEventListener("ended", cleanup); audio.removeEventListener("error", cleanup); };
    audio.addEventListener("ended", cleanup);
    audio.addEventListener("error", cleanup);
    void audio.play().catch(cleanup);
    return true;
  } catch { return false; }
}


type Cue = ArenaCue;
let audioContext: AudioContext | null = null;
function tone(ctx: AudioContext, frequency: number, at: number, duration: number, type: OscillatorType, volume: number, endFrequency?: number) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, at);
  if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, at + duration);
  gain.gain.setValueAtTime(volume, at);
  gain.gain.exponentialRampToValueAtTime(.001, at + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(at);
  oscillator.stop(at + duration + .01);
}
export function playArenaCue(cue: Cue) {
  if (playFileCue(cue)) return;
  try {
    audioContext ??= new AudioContext();
    if (audioContext.state !== "running") { void audioContext.resume(); return; }
    const at = audioContext.currentTime;
    if (cue === "move") tone(audioContext, 210, at, .09, "triangle", .055, 130);
    if (cue === "capture") {
      tone(audioContext, 290, at, .2, "sawtooth", .09, 65);
      tone(audioContext, 110, at + .035, .16, "triangle", .08, 45);
    }
    if (cue === "power") {
      tone(audioContext, 370, at, .24, "sine", .075, 900);
      tone(audioContext, 740, at + .08, .2, "triangle", .04, 1100);
    }
    if (cue === "explosion") {
      tone(audioContext, 115, at, .4, "sawtooth", .11, 38);
      tone(audioContext, 75, at + .04, .5, "triangle", .08, 33);
    }
    if (cue === "victory") for (const [i, f] of [440,554,659,880].entries()) tone(audioContext, f, at + i*.15, .32, "triangle", .07);
    if (cue === "defeat") for (const [i, f] of [330,277,220].entries()) tone(audioContext, f, at + i*.2, .32, "triangle", .065);
  } catch { /* Sound is optional in restricted browsers. */ }
}
export function useArenaSound(state: GameState | undefined, enabled: boolean, viewer: "w" | "b" | "spec" | null, gameId: string) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!state) return;
    const key = gameId + ":" + (state.matchId ?? "") + ":" + (state.revision ?? state.move) + ":" + (state.result ?? "");
    if (last.current === null || !enabled) { last.current = key; return; }
    if (key === last.current) return;
    last.current = key;
    if (state.winner || state.result) { playArenaCue(state.winner && state.winner === viewer ? "victory" : "defeat"); return; }
    const kind = state.fx?.kind;
    if (kind === "bomb") playArenaCue("explosion");
    else if (kind === "capture") playArenaCue("capture");
    else if (kind === "bolt" || kind === "shield" || kind === "freeze" || kind === "teleport") playArenaCue(kind);
    else if (kind && kind !== "move") playArenaCue("power");
    else playArenaCue("move");
  }, [gameId, state, state?.revision, state?.move, state?.result, enabled, viewer]);
}
