import { useEffect, useState } from "react";
import { Crown, ShieldAlert, Sparkles, Swords, Zap } from "lucide-react";
import {
  isGameOver,
  isInCheck,
  POWERS,
  type Color,
  type GameState,
  type PowerId,
} from "@/lib/chess";

type Announcement = {
  kind: "check" | "mate" | "win" | "lose" | "draw" | "power" | "capture" | "promote" | "turn";
  title: string;
  detail: string;
};

function announcementFor(state: GameState, viewer: Color | "spec"): Announcement | null {
  if (isGameOver(state)) {
    if (state.result === "stalemate")
      return {
        kind: "draw",
        title: "EMPATE!",
        detail: "Rei afogado. Nenhuma ação legal disponível.",
      };
    if (viewer === "spec")
      return {
        kind: "win",
        title: `${state.winner === "w" ? "BRANCAS" : "PRETAS"} VENCERAM!`,
        detail: "A arena tem um novo campeão.",
      };
    return state.winner === viewer
      ? { kind: "win", title: "VOCÊ VENCEU!", detail: "O trono da arena é seu." }
      : { kind: "lose", title: "VOCÊ PERDEU!", detail: "Uma nova partida. Uma nova chance." };
  }
  if (isInCheck(state))
    return {
      kind: "check",
      title: "XEQUE!",
      detail:
        viewer === state.turn
          ? "Proteja seu rei para continuar."
          : `O rei das ${state.turn === "w" ? "brancas" : "pretas"} está ameaçado.`,
    };
  if (state.fx && state.fx.kind in POWERS)
    return {
      kind: "power",
      title: `${POWERS[state.fx.kind as PowerId].name.toUpperCase()}!`,
      detail: "Poder ativado. Turno encerrado.",
    };
  if (state.fx?.kind === "promote")
    return { kind: "promote", title: "NOVA DAMA!", detail: "Um peão chegou ao topo." };
  if (state.fx?.kind === "capture")
    return { kind: "capture", title: "CAPTURA!", detail: "+1 de energia para quem capturou." };
  if (viewer === state.turn)
    return { kind: "turn", title: "SUA VEZ!", detail: "Mova uma peça ou use um poder." };
  return null;
}

export default function GameAnnouncement({
  state,
  viewer,
  active,
  effects,
}: {
  state: GameState;
  viewer: Color | "spec";
  active: boolean;
  effects: boolean;
}) {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const event = announcementFor(state, viewer);
  const kind = event?.kind;
  const title = event?.title;
  const detail = event?.detail;
  const mate = state.result === "checkmate";

  useEffect(() => {
    if (!active || !kind || !title || !detail) {
      setAnnouncement(null);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (mate) {
      setAnnouncement({ kind: "mate", title: "XEQUE-MATE!", detail: "O rei não tem saída." });
      timers.push(setTimeout(() => setAnnouncement({ kind, title, detail }), 1800));
    } else {
      setAnnouncement({ kind, title, detail });
      const duration = ["win", "lose", "draw"].includes(kind)
        ? 0
        : kind === "turn"
          ? 1500
          : kind === "capture"
            ? 1800
            : 2400;
      if (duration) timers.push(setTimeout(() => setAnnouncement(null), duration));
    }
    return () => timers.forEach(clearTimeout);
    // Scalar event fields prevent a realtime echo from replaying the animation.
  }, [kind, title, detail, mate, state.move, active]);

  if (!announcement) return null;
  const Icon = ["win", "mate"].includes(announcement.kind)
    ? Crown
    : ["check", "lose"].includes(announcement.kind)
      ? ShieldAlert
      : announcement.kind === "power"
        ? Zap
        : announcement.kind === "promote"
          ? Sparkles
          : Swords;
  return (
    <div
      className={`arena-announcement ${effects ? "" : "announcement-static"}`}
      data-kind={announcement.kind}
      key={`${state.move}-${announcement.kind}`}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="announcement-rays" aria-hidden="true" />
      <div className="announcement-card">
        <Icon className="announcement-icon" aria-hidden="true" />
        <span className="announcement-eyebrow">CHESS LEAGUE</span>
        <strong>{announcement.title}</strong>
        <p>{announcement.detail}</p>
      </div>
    </div>
  );
}
