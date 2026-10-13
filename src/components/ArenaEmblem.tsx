import duel from "@/assets/announcements/duel.png";
import danger from "@/assets/announcements/danger.png";
import crown from "@/assets/announcements/crown.png";
import power from "@/assets/announcements/power.png";

export type EmblemKind = "check" | "mate" | "win" | "lose" | "draw" | "power" | "capture" | "promote" | "turn";

const artwork = { duel, danger, crown, power };

export default function ArenaEmblem({ kind }: { kind: EmblemKind }) {
  const art = kind === "win" || kind === "promote" ? "crown"
    : kind === "check" || kind === "mate" || kind === "lose" ? "danger"
      : kind === "power" ? "power" : "duel";
  return <img className="announcement-emblem" src={artwork[art]} alt="" aria-hidden="true" width={816} height={816} loading="lazy" draggable={false} />;
}