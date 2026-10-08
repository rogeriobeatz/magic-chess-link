import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
const Board3D = lazy(() => import("@/components/Board3D"));
import GameAnnouncement from "@/components/GameAnnouncement";
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
import { applyComputerAction, DIFFICULTIES, soloDifficulty } from "@/lib/computer";
import { useComputerTurn } from "@/hooks/use-computer-turn";
import {
  applyMove,
  applyPower,
  movesFrom,
  powerTargets,
  initialState,
  isGameOver,
  isInCheck,
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
          .update({ black_token: token })
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
      setRow({ id, white_token: "local-white", black_token: "local-black", state: initialState() });
      setMe("w");
      return;
    }
    joinGame(id).then((res) => {
      if (!active) return;
      if (!res) {
        setNotFound(true);
        return;
      }
      setRow(res.row);
      setMe(res.me);
    });
    const ch = supabase
      .channel(`game-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${id}` },
        (p) => {
          if (active) setRow(p.new as unknown as Row);
        },
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(ch);
    };
  }, [id, local]);

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
    onAction: (action, expected) => {
      if (row?.state !== expected || expected.turn !== "b") return;
      const next = applyComputerAction(expected, action);
      if (next) void push(next);
    },
  });

  useEffect(() => {
    setSel(null);
    setPower(null);
    setTpFrom(null);
  }, [s?.move, id]);

  const highlights = useMemo(() => {
    if (!s || !myTurn) return new Set<number>();
    if (power) return new Set(powerTargets(s, power, tpFrom ?? undefined));
    if (sel !== null) return new Set(movesFrom(s, sel));
    return new Set<number>();
  }, [s, myTurn, power, sel, tpFrom]);

  async function push(next: GameState) {
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setSaveError("");
    const previous = row;
    setRow((r) => (r ? { ...r, state: next } : r));
    try {
      if (!local) {
        const { error } = await supabase
          .from("games")
          .update({ state: next as never, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, effects ? 700 : 0));
    } catch {
      setRow((current) => (current?.state.fx?.id === next.fx?.id ? previous : current));
      setSaveError("Não foi possível salvar a jogada. Tente novamente.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  function click(i: number) {
    if (!s || !myTurn || submitting.current) return;
    if (power) {
      if (!highlights.has(i)) {
        setPower(null);
        setTpFrom(null);
        return;
      }
      if (power === "teleport" && tpFrom === null) {
        setTpFrom(i);
        return;
      }
      const next =
        power === "teleport"
          ? tpFrom !== null
            ? applyPower(s, power, tpFrom, i)
            : null
          : applyPower(s, power, i);
      setPower(null);
      setTpFrom(null);
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
  const check = isInCheck(s);

  let status = "";
  if (s.result === "stalemate") status = "Empate — rei afogado";
  else if (s.winner)
    status =
      training || me === "spec"
        ? `${s.winner === "w" ? "Brancas" : "Pretas"} venceram!`
        : s.winner === me
          ? "Você venceu! 👑"
          : "Você perdeu.";
  else if (training)
    status = `Treino — vez das ${s.turn === "w" ? "Brancas" : "Pretas"}${check ? " · Xeque!" : ""}`;
  else if (solo && s.turn === "b")
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
                  ? `Modo solo · ${DIFFICULTIES[difficulty].name} · Você joga com as brancas.`
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
              />
            </div>
          </section>
          <aside className="side-panel">
            {solo && difficulty && (
              <section className="neon-card simulation-card solo-card">
                <div className="card-header">
                  <Bot className="card-icon" />
                  <h3>Você × Computador</h3>
                </div>
                <p>
                  Você joga com as brancas. O computador também usa poderes e respeita os turnos.
                </p>
                <label htmlFor="game-difficulty">Dificuldade</label>
                <select
                  id="game-difficulty"
                  className="solo-difficulty"
                  value={difficulty}
                  onChange={(event) => {
                    const level = event.target.value;
                    if (Object.hasOwn(DIFFICULTIES, level))
                      void navigate({ to: "/jogo/$id", params: { id: `solo-${level}` } });
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
                    setRow({ ...row, state: initialState() });
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
                    setRow({ ...row, state: initialState() });
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
                    const can =
                      myTurn &&
                      !s.powerUsed &&
                      s.energy[powerColor] >= pw.cost &&
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
                              : s.energy[powerColor] < pw.cost
                                ? `Requer ${pw.cost} de energia`
                                : "Nenhum alvo legal disponível"
                            : `${pw.name} — encerra o turno`
                        }
                        onClick={() => {
                          setSel(null);
                          setTpFrom(null);
                          setPower(power === k ? null : k);
                        }}
                        className={`power-item whitespace-normal ${power === k ? "active" : ""}`}
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
                          {pw.cost}
                        </span>
                      </Button>
                    );
                  })}
                </div>
                {power && (
                  <p className="power-helper">
                    {power === "teleport" && tpFrom !== null
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
}: {
  opponent?: boolean;
  label: string;
  detail: string;
  energy: number;
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
