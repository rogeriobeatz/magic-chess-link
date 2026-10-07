import { createFileRoute, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
const Board3D = lazy(() => import("@/components/Board3D"));
import logoUrl from "../../img-refs/Logo 3D Chess League Neon Dourado.png";
import arenaBg from "../../img-refs/BG - Arena Cósmica de Xadrez Neon.png";
import { supabase } from "@/integrations/supabase/client";
import {
  applyMove, applyPower, movesFrom, powerTargets,
  POWERS, MAX_ENERGY, type Color, type GameState, type PowerId,
} from "@/lib/chess";

export const Route = createFileRoute("/jogo/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Partida — Chess League" },
      { name: "description", content: "Você foi desafiado para uma partida de Xadrez 2.0 com poderes." },
      { property: "og:title", content: "Você foi desafiado — Chess League" },
      { property: "og:description", content: "Entre na partida de xadrez com poderes pelo link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GamePage,
});

type Row = { id: string; white_token: string; black_token: string | null; state: GameState };

const joins = new Map<string, Promise<{ row: Row; me: Color | "spec" } | null>>();

function joinGame(id: string) {
  let p = joins.get(id);
  if (!p) {
    p = (async () => {
      const key = `xadrez-token-${id}`;
      let token = localStorage.getItem(key);
      const { data } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
      if (!data) return null;
      const r = data as unknown as Row;
      if (token === r.white_token) return { row: r, me: "w" as const };
      if (token && token === r.black_token) return { row: r, me: "b" as const };
      if (!r.black_token) {
        token = crypto.randomUUID();
        const { data: upd } = await supabase.from("games").update({ black_token: token })
          .eq("id", id).is("black_token", null).select("*").maybeSingle();
        if (upd) { localStorage.setItem(key, token); return { row: upd as unknown as Row, me: "b" as const }; }
      }
      return { row: r, me: "spec" as const };
    })();
    joins.set(id, p);
  }
  return p;
}

function GamePage() {
  const { id } = Route.useParams();
  const [row, setRow] = useState<Row | null>(null);
  const [me, setMe] = useState<Color | "spec" | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [power, setPower] = useState<PowerId | null>(null);
  const [tpFrom, setTpFrom] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let active = true;
    joinGame(id).then((res) => {
      if (!active) return;
      if (!res) { setNotFound(true); return; }
      setRow(res.row); setMe(res.me);
    });
    const ch = supabase.channel(`game-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}` },
        (p) => setRow(p.new as unknown as Row))
      .subscribe();
    return () => { active = false; supabase.removeChannel(ch); };
  }, [id]);

  const s = row?.state;
  const myTurn = !!s && me === s.turn && !!row?.black_token && !s.winner;

  const highlights = useMemo(() => {
    if (!s || !myTurn) return new Set<number>();
    if (power) return new Set(powerTargets(s, power, tpFrom ?? undefined));
    if (sel !== null) return new Set(movesFrom(s, sel));
    return new Set<number>();
  }, [s, myTurn, power, sel, tpFrom]);

  async function push(next: GameState) {
    setRow((r) => (r ? { ...r, state: next } : r));
    await supabase.from("games").update({ state: next as never, updated_at: new Date().toISOString() }).eq("id", id);
  }

  function click(i: number) {
    if (!s || !myTurn) return;
    if (power) {
      if (!highlights.has(i)) { setPower(null); setTpFrom(null); return; }
      if (power === "teleport" && tpFrom === null) { setTpFrom(i); return; }
      const next = power === "teleport" ? applyPower(s, power, tpFrom!, i) : applyPower(s, power, i);
      setPower(null); setTpFrom(null);
      if (next) push(next);
      return;
    }
    if (sel !== null && highlights.has(i)) {
      const next = applyMove(s, sel, i);
      setSel(null);
      if (next) push(next);
      return;
    }
    const p = s.board[i];
    setSel(p && p.c === me ? i : null);
  }

  if (notFound) return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <p className="text-xl">Partida não encontrada.</p>
      <Link to="/" className="text-primary underline">Criar nova partida</Link>
    </main>
  );
  if (!s || !row || !me) return <main className="flex min-h-screen items-center justify-center text-muted-foreground">Carregando partida...</main>;

  const flip = me === "b";
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const meColor: Color = me === "spec" ? "w" : me;
  const opp: Color = meColor === "w" ? "b" : "w";

  let status = "";
  if (s.winner) status = me === "spec" ? `${s.winner === "w" ? "Brancas" : "Pretas"} venceram!` : s.winner === me ? "Você venceu! 👑" : "Você perdeu.";
  else if (!row.black_token) status = "Aguardando adversário entrar pelo link...";
  else if (me === "spec") status = `Assistindo — vez das ${s.turn === "w" ? "Brancas" : "Pretas"}`;
  else status = myTurn ? (s.powerUsed ? "Poder usado — agora mova uma peça" : "Sua vez") : "Vez do adversário";

  return (
    <main
      className="game-shell min-h-screen px-4 py-6 text-foreground"
      style={{
        backgroundImage: `radial-gradient(circle at 15% 10%, rgba(41, 230, 255, 0.12), transparent 26%), radial-gradient(circle at 78% 8%, rgba(255, 47, 209, 0.12), transparent 24%), linear-gradient(180deg, rgba(7, 6, 15, 0.96) 0%, rgba(13, 15, 25, 0.98) 100%), url(${arenaBg})`,
        backgroundSize: "cover, cover, cover, cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="mx-auto max-w-[1440px]">
        <header className="game-header flex items-center justify-between gap-4">
          <div className="brand-block" aria-label="Chess League">
            <img src={logoUrl} alt="Chess League" className="brand-logo" />
          </div>

          <div className="header-actions flex items-center gap-3">
            <button type="button" className="icon-button" aria-label="Configurações">⚙</button>
            <button type="button" className="icon-button" aria-label="Tela cheia">⤢</button>
          </div>
        </header>

        <div className="game-layout">
          <section className="board-panel">
            <div className="status-banner">
              <div className="status-copy">
                <div className="status-line">
                  <span className="status-text">{row.black_token ? (myTurn ? "Sua vez" : "Aguardando adversário") : "Aguardando adversário"}</span>
                  <span className="status-pill">● ONLINE</span>
                </div>
                <p>{row.black_token ? (myTurn ? "Faça sua jogada e controle o ritmo da arena." : "Envie o link para iniciar a partida.") : "Envie o link para iniciar a partida."}</p>
              </div>
            </div>

            <div className="arena-box">
              <div className="opponent-bar">
                <div className="player-pill">
                  <div className="avatar avatar-magenta">{me === "spec" ? "◈" : "◉"}</div>
                  <div>
                    <span className="label">Adversário</span>
                    <strong>{me === "spec" ? "Aguardando" : "Arena rival"}</strong>
                  </div>
                </div>
                <div className="energy-inline energy-magenta">
                  <span className="energy-label">⚡</span>
                  <div className="energy-track">
                    {Array.from({ length: MAX_ENERGY }, (_, i) => (
                      <span key={i} className={i < s.energy[me === "spec" ? "b" : opp] ? "filled" : ""} />
                    ))}
                  </div>
                  <strong>{s.energy[me === "spec" ? "b" : opp]}/10</strong>
                </div>
              </div>

              <div className="board-wrap">
                <Suspense fallback={<div className="flex h-full items-center justify-center text-muted-foreground">Carregando arena...</div>}>
                  <Board3D state={s} flip={flip} highlights={highlights} selected={sel ?? tpFrom} onSquare={click} />
                </Suspense>
              </div>

              <div className="player-bar">
                <div className="player-pill self-pill">
                  <div className="avatar avatar-cyan">{me === "spec" ? "◉" : "◌"}</div>
                  <div>
                    <span className="label">{me === "spec" ? "Brancas" : "Você"}</span>
                    <strong>{me === "spec" ? "Observando" : myTurn ? "Em ação" : "Pronto"}</strong>
                  </div>
                </div>
                <div className="energy-inline energy-cyan">
                  <span className="energy-label">⚡</span>
                  <div className="energy-track">
                    {Array.from({ length: MAX_ENERGY }, (_, i) => (
                      <span key={i} className={i < s.energy[me === "spec" ? "w" : meColor] ? "filled" : ""} />
                    ))}
                  </div>
                  <strong>{s.energy[me === "spec" ? "w" : meColor]}/10</strong>
                </div>
              </div>
            </div>
          </section>

          <aside className="side-panel">
            {!row.black_token && me === "w" && (
              <div className="neon-card share-card">
                <div className="card-header">
                  <span className="card-icon">🔗</span>
                  <h3>Convide seu adversário</h3>
                </div>
                <p>Envie este link para entrar na partida.</p>
                <div className="share-box">
                  <input readOnly value={shareUrl} className="share-input" />
                  <button onClick={() => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                    className="copy-button">{copied ? "Copiado!" : "Copiar"}</button>
                </div>
              </div>
            )}

            {me !== "spec" && (
              <div className="neon-card powers-card">
                <div className="card-header">
                  <span className="card-icon">✦</span>
                  <h3>Poderes</h3>
                </div>
                <p className="muted-text">Use estratégias para virar o jogo.</p>

                <div className="power-list">
                  {(Object.keys(POWERS) as PowerId[]).map((k) => {
                    const pw = POWERS[k];
                    const can = myTurn && !s.powerUsed && s.energy[meColor] >= pw.cost;
                    return (
                      <button key={k} data-tone={k} disabled={!can}
                        onClick={() => { setSel(null); setTpFrom(null); setPower(power === k ? null : k); }}
                        className={`power-item ${power === k ? "active" : ""}`}>
                        <div className="power-left">
                          <span className="power-icon">{pw.icon}</span>
                          <div className="power-copy">
                            <strong>{pw.name}</strong>
                            <small>{pw.desc}</small>
                          </div>
                        </div>
                        <span className="power-cost">{pw.cost}</span>
                      </button>
                    );
                  })}
                </div>

                {power && <p className="power-helper">{power === "teleport" && tpFrom !== null ? "Escolha a casa de destino." : "Escolha o alvo no tabuleiro."}</p>}
              </div>
            )}

            <div className="neon-card history-card">
              <div className="card-header collapsed">
                <span className="card-icon">◫</span>
                <h3>Histórico de lances</h3>
              </div>
              <ul className="history-list">
                {s.log.length === 0 && <li>Nenhum lance ainda.</li>}
                {s.log.map((l, i) => <li key={i}>{l}</li>)}
              </ul>
            </div>

            {s.winner && <Link to="/" className="cta-link">Nova partida</Link>}
          </aside>
        </div>
      </div>
    </main>
  );
}

function EnergyBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex w-full items-center gap-3 text-sm">
      <span className="w-24 text-muted-foreground">{label}</span>
      <div className="flex flex-1 gap-1">
        {Array.from({ length: MAX_ENERGY }, (_, i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i < value ? "bg-primary" : "bg-secondary"}`} />
        ))}
      </div>
      <span className="w-8 text-right font-semibold text-primary">{value}⚡</span>
    </div>
  );
}
