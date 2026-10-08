import { useEffect, useState, type ReactNode } from "react";
import { currentPlayer, registerPlayer, type Player } from "@/lib/player";

export function PlayerGate({ children }: { children: ReactNode }) {
  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    currentPlayer().then(p => { if (active) setPlayer(p); }).catch(() => {
      if (active) setError("Não foi possível verificar a sessão.");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  if (loading) return <div className="player-gate"><p>Preparando a arena...</p></div>;
  if (player) return <>{children}</>;
  return <main className="player-gate">
    <form className="player-login" onSubmit={async e => {
      e.preventDefault(); if (saving) return;
      setSaving(true); setError("");
      try { setPlayer(await registerPlayer(name, phone)); }
      catch (cause) { setError(cause instanceof Error ? cause.message : "Tente novamente."); }
      finally { setSaving(false); }
    }}>
      <span className="player-login-kicker">CHESS LEAGUE · ARENA</span>
      <h1>Qual é o seu nome, jogador?</h1>
      <p>Entre sem senha. Seu nome aparece nas partidas e no ranking; seu telefone fica privado.</p>
      <label htmlFor="player-name">Nome ou apelido</label>
      <input id="player-name" value={name} onChange={e => setName(e.target.value)} autoComplete="nickname" required minLength={2} maxLength={32} placeholder="Seu nome na arena" />
      <label htmlFor="player-phone">Celular com DDD</label>
      <input id="player-phone" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" inputMode="tel" required placeholder="(41) 99999-9999" />
      <button type="submit" disabled={saving}>{saving ? "Entrando..." : "ENTRAR NA ARENA →"}</button>
      {error && <p role="alert" className="player-login-error">{error}</p>}
      <small>Ao continuar, você concorda em usar seu nome no ranking público. O telefone é usado apenas para identificação e não será exibido. Sem verificação por SMS, o número não comprova sua identidade.</small>
    </form>
  </main>;
}
