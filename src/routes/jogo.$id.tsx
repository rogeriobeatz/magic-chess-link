import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
const Board3D = lazy(() => import("@/components/Board3D"));
import GameAnnouncement from "@/components/GameAnnouncement";
import { ArenaBalance, MatchResult } from "@/components/ArenaBalance";
import { timeLabel } from "@/lib/time";
import { actionContext, newGameState } from "@/lib/new-game";
import { recordMatch } from "@/lib/progress";
import logoUrl from "../../img-refs/Logo 3D Chess League Neon Dourado.png";
import powerIcons from "@/assets/power-icons.png";
import { Button } from "@/components/ui/button";
import {
  Settings,
  Maximize,
  Minimize,
  Swords,
  Link2,
  Zap,
  Clock3,
  CircleHelp,
  Crown,
  Bot,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import {
  applyComputerAction,
  DIFFICULTIES,
  soloDifficulty,
  soloGameId,
  type Difficulty,
} from "@/lib/computer";
import { useComputerTurn } from "@/hooks/use-computer-turn";
import {
  applyMove,
  applyPower,
  movesFrom,
  powerTargets,
  isGameOver,
  isKingThreatened,
  startClock,
  clockRemaining,
  applyTimeout,
  powerCost,
  powerCooldown,
  bombTargets,
  opposite,
  RESULT_LABELS,
  POWERS,
  MAX_ENERGY,
  ARENA_EVENTS,
  sqName,
  type Color,
  type GameState,
  type PowerId,
} from "@/lib/chess";

export const Route = createFileRoute("/jogo/$id")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Partida — Chess League" },
      {
        name: "description",
        content: "Você foi desafiado para uma partida de Xadrez 2.0 com poderes.",
      },
      { property: "og:title", content: "Você foi desafiado — Chess League" },
      { property: "og:description", content: "Entre na partida de xadrez com poderes pelo link." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GamePage,
});

type Row = { id: string; white_token: string; black_token: string | null; state: GameState };

function newestRow(current: Row | null, incoming: Row): Row {
  if (current?.id !== incoming.id) return incoming;
  const previous = current.state.revision;
  const next = incoming.state.revision;
  if (previous !== undefined && (next === undefined || next < previous)) return current;
  if (previous === undefined && next === undefined && incoming.state.move < current.state.move)
    return current;
  return incoming;
}

const joins = new Map<string, Promise<{ row: Row; me: Color | "spec" } | null>>();
const POWER_HINTS: Record<PowerId, string> = {
  shield: "Proteja uma peça na próxima resposta",
  freeze: "Bloqueie movimento e ataque",
  teleport: "Reposicione até 3 casas, sem captura",
  bolt: "Alcance 3 · rei e dama imunes",
  bomb: "Marque 2 alvos · explosão após resposta",
};

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
        const { data: upd } = await supabase
          .from("games")
          .update({ black_token: token, state: startClock(r.state, Date.now()) as never })
          .eq("id", id)
          .is("black_token", null)
          .select("*")
          .maybeSingle();
        if (upd) {
          localStorage.setItem(key, token);
          return { row: upd as unknown as Row, me: "b" as const };
        }
      }
      return { row: r, me: "spec" as const };
    })();
    joins.set(id, p);
  }
  return p;
}

function GamePage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const training = id === "treino";
  const difficulty = soloDifficulty(id);
  const solo = difficulty !== null;
  const local = training || solo;
  const [row, setRow] = useState<Row | null>(null);
  const [me, setMe] = useState<Color | "spec" | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [sel, setSel] = useState<number | null>(null);
  const [power, setPower] = useState<PowerId | null>(null);
  const [tpFrom, setTpFrom] = useState<number | null>(null);
  const [bombCenter, setBombCenter] = useState<number | null>(null);
  const [marked, setMarked] = useState<number[]>([]);
  const [now, setNow] = useState(Date.now);
  const [rematching, setRematching] = useState(false);
  const [openAttempt, setOpenAttempt] = useState(0);
  const [copied, setCopied] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [effects, setEffects] = useState(true);
  const [fullscreen, setFullscreen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [resultOpen, setResultOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const submitting = useRef(false);

  useEffect(() => {
    let active = true;
    setNotFound(false);
    setSaveError("");
    if (local) {
      setRow({
        id,
        white_token: "local-white",
        black_token: "local-black",
        state: newGameState({
          training,
          roulette: !training && !id.endsWith("-classico"),
          start: solo,
        }),
      });
      setMe("w");
      return;
    }
    joinGame(id).then((res) => {
      if (!active) return;
      if (!res) {
        setNotFound(true);
        return;
      }
      setRow((current) => newestRow(current, res.row));
      setMe(res.me);
    });
    const ch = supabase
      .channel(`game-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}` },
        (p) => {
          if (active) setRow((current) => newestRow(current, p.new as unknown as Row));
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          void supabase
            .from("games")
            .select("*")
            .eq("id", id)
            .maybeSingle()
            .then(({ data }) => {
              if (active && data) setRow((current) => newestRow(current, data as unknown as Row));
            });
        }
      });
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [id, local, solo, training]);

  const s = row?.state;
  const over = !!s && isGameOver(s);
  useEffect(() => {
    setResultOpen(over);
  }, [over, s?.matchId]);
  useEffect(() => {
    if (!s || row?.id !== id || !over || saving || training || !me || me === "spec") return;
    try {
      recordMatch(localStorage, id, s, me, difficulty);
    } catch {
      /* The result panel reports unavailable local storage. */
    }
  }, [s, over, saving, training, me, id, difficulty, row?.id]);
  const myTurn =
    !!s &&
    row?.id === id &&
    (training || me === s.turn) &&
    !!row?.black_token &&
    !isGameOver(s) &&
    !saving;

  const computer = useComputerTurn({
    state: s,
    difficulty,
    enabled: solo && row?.id === id && !saving,
    computerColor: me === "b" ? "w" : "b",
    onAction: (action, expected) => {
      if (row?.state !== expected || expected.turn === me) return;
      const next = applyComputerAction(expected, action, actionContext());
      if (next) void push(next);
    },
  });

  useEffect(() => {
    setSel(null);
    setPower(null);
    setTpFrom(null);
    setBombCenter(null);
    setMarked([]);
  }, [s?.move, s?.matchId, id]);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (
      !s ||
      row?.id !== id ||
      !row.black_token ||
      !me ||
      me === "spec" ||
      saving ||
      submitting.current
    )
      return;
    const expired = applyTimeout(s, now);
    if (expired) void push(expired);
    // The timeout is compared against the saved state when submitted, like a move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s, now, me, saving, row?.black_token, row?.id, id]);

  useEffect(() => {
    if (local || !s?.rematch?.accepted || !me || me === "spec" || saving || rematching) return;
    let active = true;
    const nextId = s.rematch.gameId;
    void supabase
      .from("games")
      .select("*")
      .eq("id", nextId)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        if (!data) {
          setSaveError(
            "A revanche foi aceita, mas não foi possível abri-la. Use Abrir revanche para tentar novamente.",
          );
          return;
        }
        const next = data as unknown as Row;
        const color = opposite(me);
        const token = color === "w" ? next.white_token : next.black_token;
        if (!token) return;
        localStorage.setItem(`xadrez-token-${nextId}`, token);
        void navigate({ to: "/jogo/$id", params: { id: nextId } });
      });
    return () => {
      active = false;
    };
  }, [
    s?.rematch?.accepted,
    s?.rematch?.gameId,
    me,
    local,
    navigate,
    saving,
    rematching,
    openAttempt,
  ]);

  const highlights = useMemo(() => {
    if (!s || !myTurn) return new Set<number>();
    if (power === "bomb" && bombCenter !== null) return new Set(bombTargets(s, bombCenter));
    if (power) return new Set(powerTargets(s, power, tpFrom ?? undefined));
    if (sel !== null) return new Set(movesFrom(s, sel));
    return new Set<number>();
  }, [s, myTurn, power, sel, tpFrom, bombCenter]);

  async function push(proposed: GameState) {
    if (submitting.current || !row || row.id !== id) return false;
    submitting.current = true;
    setSaving(true);
    setSaveError("");
    const previous = row;
    const next = { ...proposed, revision: (previous.state.revision ?? 0) + 1 };
    setRow((r) => (r ? { ...r, state: next } : r));
    try {
      if (!local) {
        let update = supabase
          .from("games")
          .update({ state: next as never, updated_at: new Date().toISOString() })
          .eq("id", id);
        update =
          previous.state.revision === undefined
            ? update.is("state->>revision", null).eq("state->>move", String(previous.state.move))
            : update.eq("state->>revision", String(previous.state.revision));
        const { data, error } = await update.select("*").maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("stale-state");
        setRow((current) =>
          current?.id === id ? newestRow(current, data as unknown as Row) : current,
        );
      }
      await new Promise((resolve) =>
        setTimeout(resolve, effects && next.move !== previous.state.move ? 700 : 0),
      );
      return true;
    } catch {
      const { data } = await supabase.from("games").select("*").eq("id", id).maybeSingle();
      if (data) setRow((current) => (current?.id === id ? (data as unknown as Row) : current));
      else setRow((current) => (current?.state === next ? previous : current));
      setSaveError(
        "A partida foi atualizada ou a ação não pôde ser salva. Confira a arena e tente novamente.",
      );
      return false;
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  async function rematch() {
    if (!s || !row || !isGameOver(s) || me === "spec" || !me || rematching || saving) return;
    if (local) {
      if (solo) setMe(opposite(me));
      setRow({
        ...row,
        state: newGameState({ training, roulette: s.roulette?.enabled ?? false, start: solo }),
      });
      setSaveError("");
      return;
    }
    if (s.rematch?.accepted) {
      setOpenAttempt((attempt) => attempt + 1);
      return;
    }
    setRematching(true);
    setSaveError("");
    try {
      if (s.rematch && s.rematch.requestedBy !== me) {
        const { data: nextData, error: readError } = await supabase
          .from("games")
          .select("*")
          .eq("id", s.rematch.gameId)
          .single();
        if (readError) throw readError;
        const nextRow = nextData as unknown as Row;
        const started = startClock(nextRow.state, Date.now());
        if (started !== nextRow.state) {
          const { data: updated, error: startError } = await supabase
            .from("games")
            .update({ state: started as never })
            .eq("id", nextRow.id)
            .eq("state->>revision", String(nextRow.state.revision ?? 0))
            .select("*")
            .maybeSingle();
          if (startError || !updated) throw startError ?? new Error("stale-rematch");
        }
        await push({ ...s, rematch: { ...s.rematch, accepted: true } });
      } else if (!s.rematch) {
        const { data, error } = await supabase
          .from("games")
          .insert({
            white_token: crypto.randomUUID(),
            black_token: crypto.randomUUID(),
            state: newGameState({ roulette: s.roulette?.enabled ?? false }) as never,
          })
          .select("id")
          .single();
        if (error || !data) throw error ?? new Error("rematch");
        await push({ ...s, rematch: { gameId: data.id, requestedBy: me, accepted: false } });
      }
    } catch {
      setSaveError("Não foi possível preparar a revanche. Tente novamente.");
    } finally {
      setRematching(false);
    }
  }

  function click(i: number) {
    if (!s || !myTurn || submitting.current) return;
    if (power) {
      if (power === "bomb" && bombCenter !== null) {
        if (highlights.has(i))
          setMarked((current) =>
            current.includes(i)
              ? current.filter((square) => square !== i)
              : current.length < 2
                ? [...current, i]
                : current,
          );
        return;
      }
      if (!highlights.has(i)) {
        setPower(null);
        setTpFrom(null);
        return;
      }
      if (power === "teleport" && tpFrom === null) {
        setTpFrom(i);
        return;
      }
      if (power === "bomb") {
        setBombCenter(i);
        setMarked([]);
        return;
      }
      const next =
        power === "teleport"
          ? tpFrom !== null
            ? applyPower(s, power, tpFrom, i, actionContext())
            : null
          : applyPower(s, power, i, undefined, actionContext());
      setPower(null);
      setTpFrom(null);
      if (next) push(next);
      return;
    }
    if (sel !== null && highlights.has(i)) {
      const next = applyMove(s, sel, i, actionContext());
      setSel(null);
      if (next) push(next);
      return;
    }
    const p = s.board[i];
    setSel(p && p.c === s.turn ? i : null);
  }

  if (notFound)
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-xl">Partida não encontrada.</p>
        <Link to="/" className="text-primary underline">
          Criar nova partida
        </Link>
      </main>
    );
  if (!s || !row || row.id !== id || !me)
    return (
      <main className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando partida...
      </main>
    );

  const flip = me === "b";
  const shareUrl = typeof window !== "undefined" ? window.location.href : "";
  const meColor: Color = me === "spec" ? "w" : me;
  const opp: Color = meColor === "w" ? "b" : "w";
  const powerColor = training ? s.turn : meColor;
  const check = isKingThreatened(s);

  let status = "";
  if (s.result && !s.winner) status = `Empate — ${RESULT_LABELS[s.result]}`;
  else if (s.winner)
    status =
      training || me === "spec"
        ? `${s.winner === "w" ? "Brancas" : "Pretas"} venceram!`
        : s.winner === me
          ? "Você venceu! 👑"
          : "Você perdeu.";
  else if (training)
    status = `Treino — vez das ${s.turn === "w" ? "Brancas" : "Pretas"}${check ? " · Xeque!" : ""}`;
  else if (solo && s.turn !== me)
    status = computer.error
      ? "Computador aguardando"
      : computer.thinking
        ? "Computador pensando..."
        : "Vez do computador";
  else if (!row.black_token) status = "Aguardando adversário entrar pelo link...";
  else if (me === "spec") status = `Assistindo — vez das ${s.turn === "w" ? "Brancas" : "Pretas"}`;
  else
    status = check
      ? me === s.turn
        ? "Xeque! Proteja seu rei"
        : "Adversário em xeque!"
      : saving
        ? "Jogada em andamento..."
        : myTurn
          ? "Sua vez"
          : "Vez do adversário";

  const event = ARENA_EVENTS[s.roulette?.event ?? "stable"];
  const modeLabel =
    solo && difficulty
      ? `Solo · ${DIFFICULTIES[difficulty].name}`
      : training
        ? "Treino livre"
        : me === "spec"
          ? "Espectador"
          : "Duelo online";
  const actionHint =
    power === "bomb" && bombCenter !== null
      ? `Marque até duas peças na área · ${marked.length}/2 selecionadas`
      : power === "teleport" && tpFrom !== null
        ? "Escolha uma casa vazia até 3 casas de distância"
        : power
          ? `${POWERS[power].name}: escolha um alvo destacado`
          : over
            ? "Partida encerrada"
            : !row.black_token
              ? "Convide alguém pelo link para começar"
              : myTurn
                ? "Selecione uma peça ou ative um poder"
                : "Acompanhe a resposta do adversário";
  const rematchLabel = training
    ? "Reiniciar simulação"
    : local
      ? "Revanche · trocar cores"
      : s.rematch?.accepted
        ? "Abrir revanche"
        : s.rematch
          ? s.rematch.requestedBy === me
            ? "Revanche enviada · aguardando"
            : "Aceitar revanche · trocar cores"
          : "Convidar para revanche";

  return (
    <main className="game-shell arena-ui">
      <div className="arena-screen">
        <header className="arena-topbar">
          <div className="arena-identity">
            <Link to="/" className="arena-brand" aria-label="Chess League — início">
              <img src={logoUrl} alt="Chess League" />
            </Link>
            <button
              className="arena-mode"
              onClick={() => setSettingsOpen(true)}
              aria-label="Configurar partida"
            >
              {solo ? <Bot /> : <Swords />}
              <span>{modeLabel}</span>
            </button>
          </div>
          <div className="arena-turn" data-active={myTurn} data-check={check} role="status">
            <span className="arena-turn-dot" />
            <strong>{!row.black_token ? "Aguardando rival" : status}</strong>
          </div>
          <nav className="arena-tools" aria-label="Controles da arena">
            {!local && me !== "spec" && (
              <button
                type="button"
                className="arena-tool"
                title="Convidar adversário"
                aria-label="Convidar adversário"
                onClick={() => setShareOpen(true)}
              >
                <Link2 />
              </button>
            )}
            <button
              type="button"
              className="arena-tool"
              title="Histórico de lances"
              aria-label="Histórico de lances"
              onClick={() => setHistoryOpen(true)}
            >
              <Clock3 />
            </button>
            <button
              type="button"
              className="arena-tool"
              title="Regras e chances"
              aria-label="Regras e chances"
              onClick={() => setRulesOpen(true)}
            >
              <CircleHelp />
            </button>
            <button
              type="button"
              className="arena-tool"
              title="Configurações"
              aria-label="Configurações"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings />
            </button>
            <button
              type="button"
              className="arena-tool arena-fullscreen"
              title="Tela cheia"
              aria-label="Tela cheia"
              onClick={async () => {
                if (document.fullscreenElement) {
                  await document.exitFullscreen();
                  setFullscreen(false);
                } else {
                  await document.documentElement.requestFullscreen();
                  setFullscreen(true);
                }
              }}
            >
              {fullscreen ? <Minimize /> : <Maximize />}
            </button>
          </nav>
        </header>

        <div className="arena-workspace">
          <section className="arena-stage" aria-label="Arena de xadrez">
            <PlayerBar
              opponent
              label={solo ? "Computador" : training || me === "spec" ? "Pretas" : "Adversário"}
              detail={
                !row.black_token
                  ? "Aguardando"
                  : solo && computer.thinking
                    ? "Pensando…"
                    : opp === "w"
                      ? "Brancas"
                      : "Pretas"
              }
              energy={s.energy[opp]}
              material={s.material?.[opp] ?? 0}
              clock={s.clock?.limitMs ? timeLabel(clockRemaining(s, opp, now)) : "Livre"}
              active={s.turn === opp && !over && !!row.black_token}
              urgent={!!s.clock?.limitMs && clockRemaining(s, opp, now) <= 30000}
            />
            <div className="arena-canvas">
              <Suspense fallback={<div className="arena-loading">Carregando arena…</div>}>
                <Board3D
                  state={s}
                  flip={flip}
                  highlights={highlights}
                  selected={sel ?? tpFrom}
                  onSquare={click}
                  effects={effects}
                  bombPreview={bombCenter === null ? null : { center: bombCenter, targets: marked }}
                />
              </Suspense>
              <GameAnnouncement
                state={s}
                viewer={training ? "spec" : me}
                active={!!row.black_token}
                effects={effects}
              />
              {!!s.bombs?.length && (
                <div className="arena-bomb-alert" role="alert">
                  <strong>BOMBA ARMADA!</strong>
                  <span>
                    Área {s.bombs.map((bomb) => sqName(bomb.center)).join(", ")} · saia da área ou
                    use escudo
                  </span>
                </div>
              )}
              {power === "bomb" && bombCenter !== null && (
                <div className="arena-bomb-confirm">
                  <span>
                    Alvos: <strong>{marked.length}/2</strong>
                  </span>
                  <Button
                    variant="arena"
                    className="arena-confirm"
                    disabled={!marked.length || !myTurn}
                    onClick={() => {
                      const next = applyPower(s, "bomb", bombCenter, undefined, {
                        ...actionContext(),
                        bombTargets: marked,
                      });
                      if (next) void push(next);
                    }}
                  >
                    Armar bomba · {marked.length} alvo(s)
                  </Button>
                  <Button
                    variant="arena"
                    className="arena-cancel"
                    onClick={() => {
                      setPower(null);
                      setBombCenter(null);
                      setMarked([]);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              )}
              {over && !resultOpen && (
                <Button
                  variant="arena"
                  className="arena-result-reopen"
                  onClick={() => setResultOpen(true)}
                >
                  Ver resultado e revanche
                </Button>
              )}
            </div>
            <PlayerBar
              label={training || me === "spec" ? "Brancas" : "Você"}
              detail={meColor === "w" ? "Brancas" : "Pretas"}
              energy={s.energy[meColor]}
              material={s.material?.[meColor] ?? 0}
              clock={s.clock?.limitMs ? timeLabel(clockRemaining(s, meColor, now)) : "Livre"}
              active={s.turn === meColor && !over && !!row.black_token}
              urgent={!!s.clock?.limitMs && clockRemaining(s, meColor, now) <= 30000}
            />
          </section>

          <aside className="arena-console" aria-label="Poderes e condições da partida">
            <section className="arena-power-rack" aria-label="Poderes">
              <div className="arena-rack-heading">
                <div>
                  <span className="arena-eyebrow">ESCOLHA SUA JOGADA</span>
                  <h2>
                    <Zap /> Poderes
                  </h2>
                </div>
                <span className="arena-energy-total">
                  <Zap />
                  {s.energy[powerColor]}
                  <small>/{MAX_ENERGY}</small>
                </span>
              </div>
              <p className="arena-rack-rule">Um poder encerra sua vez.</p>
              <div className="arena-power-list">
                {(Object.keys(POWERS) as PowerId[]).map((k, index) => {
                  const pw = POWERS[k],
                    cost = powerCost(s, k),
                    cooldown = powerCooldown(s, k, powerColor);
                  const can =
                    me !== "spec" &&
                    myTurn &&
                    !s.powerUsed &&
                    !cooldown &&
                    s.energy[powerColor] >= cost &&
                    powerTargets(s, k).length > 0;
                  const reason = over
                    ? "Partida encerrada"
                    : !myTurn
                      ? "Aguarde sua vez"
                      : cooldown
                        ? `Recarga: ${cooldown} rodada(s)`
                        : s.energy[powerColor] < cost
                          ? `Requer ${cost} de energia`
                          : "Nenhum alvo legal disponível";
                  return (
                    <button
                      type="button"
                      key={k}
                      className={`arena-power-btn ${power === k ? "is-selected" : ""}`}
                      data-tone={k}
                      disabled={!can}
                      aria-pressed={power === k}
                      title={`${pw.desc}${!can ? " · " + reason : ""}`}
                      onClick={() => {
                        setSel(null);
                        setTpFrom(null);
                        setBombCenter(null);
                        setMarked([]);
                        setPower(power === k ? null : k);
                      }}
                    >
                      <span
                        className="arena-power-art"
                        style={{ "--power-index": index } as CSSProperties}
                        aria-hidden="true"
                      >
                        <img src={powerIcons} alt="" />
                      </span>
                      <span className="arena-power-copy">
                        <strong>{pw.name}</strong>
                        <small>{POWER_HINTS[k]}</small>
                      </span>
                      <span className="arena-power-price" data-cooldown={!!cooldown}>
                        {cooldown ? <Clock3 /> : <Zap />}
                        {cooldown ? `${cooldown}r` : cost}
                      </span>
                    </button>
                  );
                })}
              </div>
              <div className="arena-action-hint" data-selected={!!power} role="status">
                <span>{actionHint}</span>
                {power && (
                  <button
                    onClick={() => {
                      setPower(null);
                      setTpFrom(null);
                      setBombCenter(null);
                      setMarked([]);
                    }}
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </section>

            <button
              className="arena-event-compact"
              onClick={() => setRulesOpen(true)}
              aria-label="Ver evento e chances da roleta"
              data-event={s.roulette?.enabled ? s.roulette.event : "off"}
            >
              <span className="arena-event-symbol">
                <Sparkles />
              </span>
              <span className="arena-event-copy">
                <small>
                  {s.roulette?.enabled ? "ROLETA DA ARENA" : "CUSTOS FIXOS"} · R
                  {Math.floor(s.move / 2) + 1}
                </small>
                <strong>{s.roulette?.enabled ? event.name : "Arena clássica"}</strong>
                <span>{s.roulette?.enabled ? event.desc : "Poderes com preços fixos"}</span>
              </span>
              <span className="arena-event-next">
                {s.roulette?.enabled ? (
                  <>
                    <strong>{Math.ceil((6 - (s.move % 6)) / 2)}r</strong>
                    <small>novo giro</small>
                  </>
                ) : (
                  <CircleHelp />
                )}
              </span>
            </button>
            <div className="arena-recent">
              <span className="arena-eyebrow">ÚLTIMO LANCE</span>
              <p>{s.lastDecision ?? "A arena está pronta. Faça sua primeira jogada."}</p>
              <button onClick={() => setHistoryOpen(true)}>
                Ver histórico <Clock3 />
              </button>
            </div>
            {saveError && (
              <p className="arena-save-error" role="alert">
                {saveError}
              </p>
            )}
            {computer.error && (
              <div className="arena-save-error" role="alert">
                {computer.error}
                <button onClick={computer.retry}>Tentar novamente</button>
              </div>
            )}
          </aside>
        </div>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="arena-ui arena-dialog">
          <DialogTitle>Partida e configurações</DialogTitle>
          <DialogDescription>
            {modeLabel} ·{" "}
            {training
              ? "Controle os dois lados"
              : `Você joga com as ${meColor === "w" ? "brancas" : "pretas"}`}
          </DialogDescription>
          {solo && difficulty && (
            <div className="arena-setting-group">
              <label htmlFor="game-difficulty">Dificuldade</label>
              <select
                id="game-difficulty"
                value={difficulty}
                onChange={(event) => {
                  const level = event.target.value;
                  if (Object.hasOwn(DIFFICULTIES, level)) {
                    setSettingsOpen(false);
                    void navigate({
                      to: "/jogo/$id",
                      params: { id: soloGameId(level as Difficulty, s.roulette?.enabled ?? false) },
                    });
                  }
                }}
              >
                {(Object.keys(DIFFICULTIES) as Difficulty[]).map((level) => (
                  <option key={level} value={level}>
                    {DIFFICULTIES[level].name}
                  </option>
                ))}
              </select>
              <p>{DIFFICULTIES[difficulty].description} Alterar o nível inicia uma nova partida.</p>
            </div>
          )}
          <div className="arena-setting-switch">
            <label htmlFor="arena-effects">Efeitos especiais</label>
            <Switch id="arena-effects" checked={effects} onCheckedChange={setEffects} />
          </div>
          {local && (
            <Button
              variant="arena"
              className="arena-confirm"
              disabled={saving}
              onClick={() => {
                setMe("w");
                setRow({
                  ...row,
                  state: newGameState({
                    training,
                    roulette: s.roulette?.enabled ?? false,
                    start: solo,
                  }),
                });
                setSaveError("");
                setSettingsOpen(false);
              }}
            >
              {training ? "Reiniciar simulação" : "Nova partida solo"}
            </Button>
          )}
          {!local && me !== "spec" && (
            <Button
              variant="arena"
              className="arena-confirm"
              onClick={() => {
                setSettingsOpen(false);
                setShareOpen(true);
              }}
            >
              Convidar adversário
            </Button>
          )}
          <Link to="/" className="arena-home-link">
            Voltar ao início
          </Link>
        </DialogContent>
      </Dialog>
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="arena-ui arena-dialog">
          <DialogTitle>Histórico de lances</DialogTitle>
          <DialogDescription>
            Rodada {Math.floor(s.move / 2) + 1} · {s.move} ações
          </DialogDescription>
          <ol className="arena-history-list">
            {s.log.length ? (
              s.log.map((entry, index) => <li key={index}>{entry}</li>)
            ) : (
              <li>Nenhum lance ainda.</li>
            )}
          </ol>
        </DialogContent>
      </Dialog>
      <Dialog open={rulesOpen} onOpenChange={setRulesOpen}>
        <DialogContent className="arena-ui arena-dialog">
          <DialogTitle>Regras e chances da arena</DialogTitle>
          <DialogDescription>
            Um movimento ou um poder por turno. Cada escolha conta.
          </DialogDescription>
          <ArenaBalance state={s} effects={effects} />
          <div className="arena-rule-list">
            {(Object.keys(POWERS) as PowerId[]).map((key) => (
              <p key={key}>
                <strong>
                  {POWERS[key].name} · {powerCost(s, key)} energia
                </strong>
                {POWERS[key].desc}
              </p>
            ))}
            <p>
              Vitória por xeque-mate ou tempo. Capturas contam material, não energia. Cada poder
              recarrega em 3 rodadas.
            </p>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={shareOpen} onOpenChange={setShareOpen}>
        <DialogContent className="arena-ui arena-dialog">
          <DialogTitle>Convide seu adversário</DialogTitle>
          <DialogDescription>Envie este link para entrar na partida.</DialogDescription>
          <div className="arena-share-controls">
            <input aria-label="Link da partida" readOnly value={shareUrl} />
            <Button
              variant="arena"
              className="arena-confirm"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  setCopied(false);
                }
              }}
            >
              {copied ? "Copiado!" : "Copiar"}
            </Button>
          </div>
          <Link to="/jogo/$id" params={{ id: "treino" }} className="arena-home-link">
            Experimentar o treino livre
          </Link>
        </DialogContent>
      </Dialog>
      <Dialog open={resultOpen && over} onOpenChange={setResultOpen}>
        <DialogContent className="arena-ui arena-dialog arena-result-dialog">
          <DialogTitle className="sr-only">Resultado da partida</DialogTitle>
          <DialogDescription className="sr-only">Resumo, progresso e revanche</DialogDescription>
          {over && (
            <MatchResult
              state={s}
              gameId={id}
              viewer={me}
              difficulty={difficulty}
              training={training}
              confirmed={!saving}
              rematch={() => void rematch()}
              rematchDisabled={
                saving ||
                rematching ||
                (!local && !s.rematch?.accepted && s.rematch?.requestedBy === me)
              }
              rematchLabel={rematchLabel}
            />
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}

function PlayerBar({
  opponent = false,
  label,
  detail,
  energy,
  material,
  clock,
  active,
  urgent,
}: {
  opponent?: boolean;
  label: string;
  detail: string;
  energy: number;
  material: number;
  clock: string;
  active: boolean;
  urgent: boolean;
}) {
  return (
    <div className="arena-hud" data-opponent={opponent} data-active={active}>
      <div className="arena-player">
        <span className="arena-player-avatar" aria-hidden="true">
          ♞
        </span>
        <strong>{label}</strong>
        <span className="arena-player-color">{detail}</span>
      </div>
      <div className="arena-player-stats">
        <span className="arena-material" title="Peão 1 · cavalo/bispo 3 · torre 5 · dama 9">
          <Crown />
          <strong>{material}</strong>
          <small>material</small>
        </span>
        <span className="arena-hud-energy" aria-label={`${energy} de ${MAX_ENERGY} de energia`}>
          <Zap />
          <span className="arena-energy-ticks">
            {Array.from({ length: MAX_ENERGY }, (_, index) => (
              <i key={index} data-filled={index < energy} />
            ))}
          </span>
          <strong>
            {energy}
            <small>/{MAX_ENERGY}</small>
          </strong>
        </span>
        <strong
          className="arena-clock"
          data-urgent={urgent}
          aria-label={`Tempo de ${label}: ${clock}`}
        >
          {clock}
        </strong>
      </div>
    </div>
  );
}
