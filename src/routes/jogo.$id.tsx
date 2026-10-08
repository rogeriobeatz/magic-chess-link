import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
const Board3D = lazy(() => import("@/components/Board3D"));
import GameAnnouncement from "@/components/GameAnnouncement";
import { ArenaBalance, MatchResult } from "@/components/ArenaBalance";
import { timeLabel } from "@/lib/time";
import { actionContext, newGameState } from "@/lib/new-game";
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
  ChevronDown,
  Crown,
  Bot,
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
  const [historyOpen, setHistoryOpen] = useState(true);
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
  const over = isGameOver(s);
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

  return (
    <main className="game-shell min-h-screen text-foreground">
      <div className="game-container">
        <header className="game-header">
          <Link to="/" className="brand-block" aria-label="Chess League — início">
            <img src={logoUrl} alt="Chess League" className="brand-logo" />
          </Link>
          <div className="status-banner" role="status">
            {s.winner ? <Crown className="status-symbol" /> : <Swords className="status-symbol" />}
            <div className="status-copy">
              <strong className="status-text">
                {!row.black_token ? "Aguardando adversário" : status}
              </strong>
              <p>
                {solo && difficulty
                  ? `Modo solo · ${DIFFICULTIES[difficulty].name} · Você joga com as ${meColor === "w" ? "brancas" : "pretas"}.`
                  : training
                    ? "Simulação local: controle os dois lados da arena."
                    : !row.black_token
                      ? "Envie o link e desafie um amigo para começar!"
                      : over
                        ? "Partida encerrada."
                        : me === "spec"
                          ? "Partida em andamento"
                          : myTurn
                            ? "Mova uma peça ou use um poder."
                            : "Seu adversário está preparando a jogada."}
              </p>
            </div>
          </div>
          <div className="header-actions">
            <Button
              variant="arena"
              size="icon"
              className="icon-button"
              title="Configurações"
              aria-label="Configurações"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings />
            </Button>
            <Button
              variant="arena"
              size="icon"
              className="icon-button"
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
            </Button>
          </div>
        </header>
        <div className="game-layout">
          <section className="board-panel" aria-label="Arena de xadrez">
            <div className="arena-box">
              <PlayerBar
                opponent
                label={solo ? "Computador" : training || me === "spec" ? "Pretas" : "Adversário"}
                detail={
                  over
                    ? "Partida encerrada"
                    : !row.black_token
                      ? "Aguardando..."
                      : solo && computer.thinking
                        ? "Pensando..."
                        : s.turn === opp
                          ? "Sua vez de jogar"
                          : "Na arena"
                }
                energy={s.energy[opp]}
                material={s.material?.[opp] ?? 0}
                clock={s.clock?.limitMs ? timeLabel(clockRemaining(s, opp, now)) : "—"}
                active={s.turn === opp && !over && !!row.black_token}
                urgent={!!s.clock?.limitMs && clockRemaining(s, opp, now) <= 30000}
              />
              <div className="board-wrap">
                <Suspense
                  fallback={
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      Carregando arena...
                    </div>
                  }
                >
                  <Board3D
                    state={s}
                    flip={flip}
                    highlights={highlights}
                    selected={sel ?? tpFrom}
                    onSquare={click}
                    effects={effects}
                    bombPreview={
                      bombCenter === null ? null : { center: bombCenter, targets: marked }
                    }
                  />
                </Suspense>
                <GameAnnouncement
                  state={s}
                  viewer={training ? "spec" : me}
                  active={!!row.black_token}
                  effects={effects}
                />
              </div>
              <PlayerBar
                label={training || me === "spec" ? "Brancas" : "Você"}
                detail={
                  over
                    ? s.winner === meColor
                      ? "Campeão da arena"
                      : "Fim da partida"
                    : (training ? s.turn === "w" : myTurn)
                      ? "Sua vez de brilhar..."
                      : "Sua vez em breve..."
                }
                energy={s.energy[meColor]}
                material={s.material?.[meColor] ?? 0}
                clock={s.clock?.limitMs ? timeLabel(clockRemaining(s, meColor, now)) : "—"}
                active={s.turn === meColor && !over && !!row.black_token}
                urgent={!!s.clock?.limitMs && clockRemaining(s, meColor, now) <= 30000}
              />
              {power === "bomb" && bombCenter !== null && (
                <div className="bomb-confirm board-bomb-confirm">
                  <p>Alvos marcados: {marked.length}/2 · uma resposta para escapar</p>
                  <Button
                    variant="arena"
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
            </div>
          </section>
          <aside className="side-panel">
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
                rematchLabel={
                  training
                    ? "Reiniciar simulação"
                    : local
                      ? "Revanche · trocar cores"
                      : s.rematch?.accepted
                        ? "Abrir revanche"
                        : s.rematch
                          ? s.rematch.requestedBy === me
                            ? "Revanche enviada · aguardando"
                            : "Aceitar revanche · trocar cores"
                          : "Convidar para revanche"
                }
              />
            )}
            <ArenaBalance state={s} effects={effects} />
            {solo && difficulty && (
              <section className="neon-card simulation-card solo-card">
                <div className="card-header">
                  <Bot className="card-icon" />
                  <h3>Você × Computador</h3>
                </div>
                <p>
                  Você joga com as {meColor === "w" ? "brancas" : "pretas"}. O computador usa os
                  mesmos poderes, preços e recargas.
                </p>
                <label htmlFor="game-difficulty">Dificuldade</label>
                <select
                  id="game-difficulty"
                  className="solo-difficulty"
                  value={difficulty}
                  onChange={(event) => {
                    const level = event.target.value;
                    if (Object.hasOwn(DIFFICULTIES, level))
                      void navigate({
                        to: "/jogo/$id",
                        params: {
                          id: soloGameId(level as Difficulty, s.roulette?.enabled ?? false),
                        },
                      });
                  }}
                >
                  {(Object.keys(DIFFICULTIES) as (keyof typeof DIFFICULTIES)[]).map((level) => (
                    <option key={level} value={level}>
                      {DIFFICULTIES[level].name}
                    </option>
                  ))}
                </select>
                <p className="solo-description">
                  {DIFFICULTIES[difficulty].description} Alterar o nível começa uma nova partida.
                </p>
                <Button
                  variant="arena"
                  className="cta-link"
                  disabled={saving}
                  onClick={() => {
                    setMe("w");
                    setRow({
                      ...row,
                      state: newGameState({ roulette: s.roulette?.enabled ?? false, start: true }),
                    });
                    setSel(null);
                    setPower(null);
                    setTpFrom(null);
                    setSaveError("");
                  }}
                >
                  Nova partida solo
                </Button>
                {computer.error && (
                  <div className="computer-error" role="alert">
                    <p>{computer.error}</p>
                    <Button variant="arena" onClick={computer.retry}>
                      Tentar novamente
                    </Button>
                  </div>
                )}
              </section>
            )}
            {training && (
              <section className="neon-card simulation-card">
                <div className="card-header">
                  <Swords className="card-icon" />
                  <h3>Simulação de partida</h3>
                </div>
                <p>
                  Jogue pelos dois lados. Selecione uma peça e uma casa marcada para testar
                  movimentos e poderes.
                </p>
                <Button
                  variant="arena"
                  className="cta-link"
                  disabled={saving}
                  onClick={() => {
                    setRow({ ...row, state: newGameState({ training: true, roulette: false }) });
                    setSaveError("");
                  }}
                >
                  Reiniciar simulação
                </Button>
              </section>
            )}
            {saveError && (
              <p className="save-error" role="alert">
                {saveError}
              </p>
            )}
            {!local && me !== "spec" && (
              <section className="neon-card share-card">
                <div className="invite-heading">
                  <Link2 className="card-icon" />
                  <div>
                    <h3>Convide seu adversário</h3>
                    <p>Envie este link para entrar na partida.</p>
                  </div>
                </div>
                <div className="share-box">
                  <input
                    aria-label="Link da partida"
                    readOnly
                    value={shareUrl}
                    className="share-input"
                  />
                  <Button
                    variant="arena"
                    className="copy-button"
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
                {!row.black_token && (
                  <Link to="/jogo/$id" params={{ id: "treino" }} className="simulation-link">
                    Simular uma partida enquanto espera
                  </Link>
                )}
              </section>
            )}
            {me !== "spec" && (
              <section className="neon-card powers-card">
                <div className="card-header">
                  <Zap className="card-icon" />
                  <h3>Poderes</h3>
                </div>
                <p className="powers-rule">
                  {training ? `${s.turn === "w" ? "Brancas" : "Pretas"} · ` : ""}Usar um poder
                  encerra sua vez.
                </p>
                <div className="power-list">
                  {(Object.keys(POWERS) as PowerId[]).map((k, index) => {
                    const pw = POWERS[k];
                    const cost = powerCost(s, k);
                    const cooldown = powerCooldown(s, k, powerColor);
                    const can =
                      myTurn &&
                      !s.powerUsed &&
                      !cooldown &&
                      s.energy[powerColor] >= cost &&
                      powerTargets(s, k).length > 0;
                    return (
                      <Button
                        variant="arena"
                        key={k}
                        data-tone={k}
                        disabled={!can}
                        aria-pressed={power === k}
                        title={
                          !can
                            ? !myTurn
                              ? "Aguarde sua vez"
                              : cooldown
                                ? `Recarga: ${cooldown} rodada(s)`
                                : s.energy[powerColor] < cost
                                  ? `Requer ${cost} de energia`
                                  : "Nenhum alvo legal disponível"
                            : `${pw.name} — encerra o turno`
                        }
                        onClick={() => {
                          setSel(null);
                          setTpFrom(null);
                          setBombCenter(null);
                          setMarked([]);
                          setPower(power === k ? null : k);
                          if (window.matchMedia("(max-width: 760px)").matches)
                            document.querySelector(".board-panel")?.scrollIntoView({
                              behavior: effects ? "smooth" : "auto",
                              block: "start",
                            });
                        }}
                        className={`power-item h-auto whitespace-normal ${power === k ? "active" : ""}`}
                      >
                        <span className="power-left">
                          <span className={`power-icon power-sprite-${index}`} aria-hidden="true">
                            <img src={powerIcons} width={1536} height={512} alt="" loading="lazy" />
                          </span>
                          <span className="power-copy">
                            <strong>{pw.name}</strong>
                            <small>{pw.desc}</small>
                          </span>
                        </span>
                        <span className="power-cost">
                          <Zap />
                          {cooldown ? `${cooldown}r` : cost}
                        </span>
                      </Button>
                    );
                  })}
                </div>
                {power && (
                  <p className="power-helper">
                    {power === "bomb" && bombCenter !== null
                      ? `Selecione até 2 peças marcadas (${marked.length}/2). Elas terão uma resposta para escapar.`
                      : power === "teleport" && tpFrom !== null
                        ? "Escolha a casa de destino."
                        : "Escolha o alvo no tabuleiro."}
                  </p>
                )}
              </section>
            )}
            <section className="neon-card history-card">
              <Button
                variant="arena"
                className="history-toggle"
                aria-expanded={historyOpen}
                onClick={() => setHistoryOpen(!historyOpen)}
              >
                <Clock3 />
                <span>Histórico de lances</span>
                <ChevronDown className={historyOpen ? "" : "closed"} />
              </Button>
              {historyOpen && (
                <ul className="history-list">
                  {s.log.length === 0 ? (
                    <li>Nenhum lance ainda.</li>
                  ) : (
                    s.log.map((l, i) => <li key={i}>{l}</li>)
                  )}
                </ul>
              )}
            </section>
            {over && (
              <Button variant="arena" asChild className="cta-link">
                <Link to="/">Nova partida</Link>
              </Button>
            )}
          </aside>
        </div>
      </div>
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent>
          <DialogTitle>Configurações da arena</DialogTitle>
          <DialogDescription>Chess League</DialogDescription>
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="arena-effects">Efeitos especiais</label>
            <Switch id="arena-effects" checked={effects} onCheckedChange={setEffects} />
          </div>
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
    <div className={opponent ? "opponent-bar" : "player-bar"}>
      <div className="player-pill">
        <div className={`avatar ${opponent ? "avatar-magenta" : "avatar-cyan"}`} aria-hidden="true">
          ♞
        </div>
        <div>
          <strong>{label}</strong>
          <span className="label">{detail}</span>
        </div>
      </div>
      <div className="player-match-metrics">
        <span title="Peão 1 · cavalo/bispo 3 · torre 5 · dama 9">
          Material <strong>{material}</strong>
        </span>
        <strong
          className={`match-clock ${active ? "clock-active" : ""} ${urgent ? "clock-urgent" : ""}`}
          aria-label={`Tempo de ${label}: ${clock}`}
        >
          {clock}
        </strong>
      </div>
      <div
        className={`energy-inline ${opponent ? "energy-magenta" : "energy-cyan"}`}
        aria-label={`${energy} de ${MAX_ENERGY} de energia`}
      >
        <div className="energy-track">
          {Array.from({ length: MAX_ENERGY }, (_, i) => (
            <span key={i} className={i < energy ? "filled" : ""} />
          ))}
        </div>
        <Zap className="energy-label" />
        <strong>{energy}/10</strong>
      </div>
    </div>
  );
}
