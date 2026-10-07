import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  applyMove, applyPower, movesFrom, powerTargets, isFrozen, isShielded,
  GLYPH, POWERS, MAX_ENERGY, type Color, type GameState, type PowerId,
} from "@/lib/chess";

export const Route = createFileRoute("/jogo/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Partida — Xadrez 2.0" },
      { name: "description", content: "Você foi desafiado para uma partida de Xadrez 2.0 com poderes." },
      { property: "og:title", content: "Você foi desafiado — Xadrez 2.0" },
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
  const order = Array.from({ length: 64 }, (_, k) => (flip ? 63 - k : k));
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const meColor: Color = me === "spec" ? "w" : me;
  const opp: Color = meColor === "w" ? "b" : "w";

  let status = "";
  if (s.winner) status = me === "spec" ? `${s.winner === "w" ? "Brancas" : "Pretas"} venceram!` : s.winner === me ? "Você venceu! 👑" : "Você perdeu.";
  else if (!row.black_token) status = "Aguardando adversário entrar pelo link...";
  else if (me === "spec") status = `Assistindo — vez das ${s.turn === "w" ? "Brancas" : "Pretas"}`;
  else status = myTurn ? (s.powerUsed ? "Poder usado — agora mova uma peça" : "Sua vez") : "Vez do adversário";

  return (
    <main className="min-h-screen px-4 py-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 lg:flex-row">
        <div className="flex-1">
          <div className="mb-3 flex items-center justify-between">
            <Link to="/" className="font-display text-2xl font-bold">Xadrez <span className="text-primary">2.0</span></Link>
            <span className={`rounded-full px-4 py-1 text-sm font-semibold ${myTurn ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>{status}</span>
          </div>
          <EnergyBar label={me === "spec" ? "Pretas" : "Adversário"} value={s.energy[me === "spec" ? "b" : opp]} />
          <div className="my-3 grid aspect-square w-full max-w-[640px] grid-cols-8 grid-rows-8 overflow-hidden rounded-xl border-4 border-border shadow-[var(--glow)]">
            {order.map((i) => {
              const p = s.board[i];
              const dark = (Math.floor(i / 8) + (i % 8)) % 2 === 1;
              const hl = highlights.has(i);
              const isLast = s.last?.includes(i);
              return (
                <button key={i} onClick={() => click(i)}
                  className={`relative flex items-center justify-center ${dark ? "bg-board-dark" : "bg-board-light"} ${sel === i || tpFrom === i ? "ring-4 ring-inset ring-primary" : ""}`}>
                  {isLast && <span className="absolute inset-0 bg-primary/20" />}
                  {hl && <span className={`absolute ${p ? "inset-1 rounded-full border-4 border-primary/70" : "h-1/4 w-1/4 rounded-full bg-primary/70"}`} />}
                  {p && (
                    <span className={`relative select-none text-[clamp(1.6rem,6vw,3.4rem)] leading-none ${p.c === "w" ? "text-piece-white" : "text-piece-black"} ${isFrozen(p, s.move) ? "opacity-60" : ""}`}
                      style={{ textShadow: p.c === "w" ? "0 2px 2px oklch(0 0 0 / .6)" : "0 1px 1px oklch(1 0 0 / .3)" }}>
                      {GLYPH[p.t]}
                    </span>
                  )}
                  {p && isShielded(p, s.move) && <span className="absolute right-0.5 top-0.5 text-xs">🛡️</span>}
                  {p && isFrozen(p, s.move) && <span className="absolute left-0.5 top-0.5 text-xs">❄️</span>}
                </button>
              );
            })}
          </div>
          <EnergyBar label={me === "spec" ? "Brancas" : "Você"} value={s.energy[me === "spec" ? "w" : meColor]} />
        </div>

        <aside className="w-full space-y-4 lg:w-80">
          {!row.black_token && me === "w" && (
            <div className="rounded-2xl border border-primary bg-card p-4">
              <p className="font-display font-semibold">Convide seu adversário</p>
              <p className="mt-1 text-xs text-muted-foreground">Envie este link. Quem abrir primeiro joga de Pretas.</p>
              <div className="mt-3 flex gap-2">
                <input readOnly value={shareUrl} className="min-w-0 flex-1 rounded-md border bg-background px-2 text-xs" />
                <button onClick={() => { navigator.clipboard.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                  className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">{copied ? "Copiado!" : "Copiar"}</button>
              </div>
            </div>
          )}
          {me !== "spec" && (
            <div className="rounded-2xl border bg-card p-4">
              <p className="font-display font-semibold">Poderes</p>
              <div className="mt-3 space-y-2">
                {(Object.keys(POWERS) as PowerId[]).map((k) => {
                  const pw = POWERS[k];
                  const can = myTurn && !s.powerUsed && s.energy[meColor] >= pw.cost;
                  return (
                    <button key={k} disabled={!can}
                      onClick={() => { setSel(null); setTpFrom(null); setPower(power === k ? null : k); }}
                      className={`w-full rounded-xl border p-3 text-left transition disabled:opacity-40 ${power === k ? "border-primary bg-primary/15" : "hover:border-primary"}`}>
                      <div className="flex justify-between font-semibold"><span>{pw.icon} {pw.name}</span><span className="text-primary">{pw.cost}⚡</span></div>
                      <p className="mt-1 text-xs text-muted-foreground">{pw.desc}</p>
                    </button>
                  );
                })}
              </div>
              {power && <p className="mt-2 text-xs text-primary">{power === "teleport" && tpFrom !== null ? "Escolha a casa de destino." : "Escolha o alvo no tabuleiro."}</p>}
            </div>
          )}
          <div className="rounded-2xl border bg-card p-4">
            <p className="font-display font-semibold">Histórico</p>
            <ul className="mt-2 max-h-64 space-y-1 overflow-y-auto text-xs text-muted-foreground">
              {s.log.length === 0 && <li>Nenhum lance ainda.</li>}
              {s.log.map((l, i) => <li key={i}>{l}</li>)}
            </ul>
          </div>
          {s.winner && <Link to="/" className="block rounded-full bg-primary py-3 text-center font-semibold text-primary-foreground">Nova partida</Link>}
        </aside>
      </div>
    </main>
  );
}

function EnergyBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex max-w-[640px] items-center gap-3 text-sm">
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
