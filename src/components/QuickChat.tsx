import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Volume2, VolumeX } from "lucide-react";
import type { Color } from "@/lib/chess";

export const QUICK_PHRASES = [
  { title: "Respeito", entries: ["Belo lance!", "Calculado.", "GG!"] },
  { title: "Provocação", entries: ["Ops...", "O que foi isso?!", "Nem vi chegar", "Foi de propósito?"] },
  { title: "Combate", entries: ["Cuidado com a bomba!", "Congelado!", "Xeque!"] },
] as const;
const VALID = new Set<string>(QUICK_PHRASES.flatMap(group => [...group.entries]));
const COOLDOWN = 3000;

export type ChatReaction = { phrase: string; side: Color; name: string; nonce: string };
export function validReaction(value: unknown): value is ChatReaction {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<ChatReaction>;
  return typeof p.phrase === "string" && VALID.has(p.phrase)
    && (p.side === "w" || p.side === "b")
    && typeof p.name === "string" && p.name.length <= 32
    && typeof p.nonce === "string" && p.nonce.length <= 80;
}
export function arcadeBeep() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + .09);
    gain.gain.setValueAtTime(.055, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(.001, context.currentTime + .16);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + .17);
    oscillator.onended = () => void context.close();
  } catch { /* Audio is optional. */ }
}
export function QuickChat({ side, name, onSend, reaction, enabled }: {
  side: Color | "spec"; name: string; onSend: (reaction: ChatReaction) => Promise<boolean>;
  reaction: ChatReaction | null; enabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState("");
  const deadline = useRef(0);
  const lastNonce = useRef("");
  useEffect(() => {
    if (!reaction || reaction.nonce === lastNonce.current) return;
    lastNonce.current = reaction.nonce;
    if (!muted) arcadeBeep();
  }, [reaction, muted]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setInterval(() => setCooldown(Math.max(0, deadline.current - Date.now())), 150);
    return () => clearInterval(timer);
  }, [cooldown > 0]);
  async function send(phrase: string) {
    if (side === "spec" || !enabled || Date.now() < deadline.current) return;
    const message: ChatReaction = { phrase, side, name: name.slice(0,32), nonce: crypto.randomUUID() };
    deadline.current = Date.now() + COOLDOWN;
    setCooldown(COOLDOWN); setOpen(false); setError("");
    if (!await onSend(message)) {
      deadline.current = 0; setCooldown(0); setError("Mensagem não enviada. Tente de novo.");
    }
  }
  return <div className="quick-chat">
    {reaction && <div key={reaction.nonce} className={"quick-chat-toast quick-chat-" + reaction.side} role="status" aria-live="polite">
      <span>{reaction.name} · {reaction.side === "w" ? "BRANCAS" : "PRETAS"}</span>
      <strong>{reaction.phrase}</strong>
    </div>}
    {side !== "spec" && enabled && <div className="quick-chat-controls">
      {open && <div className="quick-chat-menu" aria-label="Mensagens rápidas">
        <div className="quick-chat-menu-head"><strong>QUICK CHAT</strong>
          <button type="button" onClick={() => setMuted(v => !v)} title={muted ? "Ativar sons" : "Silenciar mensagens"}>{muted ? <VolumeX/> : <Volume2/>}</button>
          <button type="button" onClick={() => setOpen(false)} aria-label="Fechar menu"><X/></button>
        </div>
        {QUICK_PHRASES.map(group => <div className="quick-chat-group" key={group.title}>
          <span>{group.title}</span><div>{group.entries.map(phrase => <button type="button" key={phrase} onClick={() => void send(phrase)} disabled={cooldown > 0}>{phrase}</button>)}</div>
        </div>)}
        <small>{cooldown > 0 ? "Aguarde " + Math.ceil(cooldown / 1000) + "s" : "Escolha uma reação · 3s entre mensagens"}</small>
      </div>}
      <button type="button" className="quick-chat-trigger" aria-label={open ? "Fechar Quick Chat" : "Abrir Quick Chat"} aria-expanded={open} onClick={() => setOpen(v => !v)}><MessageCircle/> <span>QUICK CHAT</span></button>
      {error && <span className="quick-chat-error">{error}</span>}
    </div>}
  </div>;
}
