import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  ARENA_EVENTS,
  POWERS,
  RESULT_LABELS,
  sqName,
  type GameState,
  type Color,
} from "@/lib/chess";
import {
  ACHIEVEMENTS,
  balanceMetrics,
  matchDuration,
  matchXp,
  readProgress,
  recordMatch,
} from "@/lib/progress";
import type { Difficulty } from "@/lib/computer";
import { timeLabel } from "@/lib/time";

export function ArenaBalance({ state, effects }: { state: GameState; effects: boolean }) {
  const roulette = state.roulette;
  const event = ARENA_EVENTS[roulette?.event ?? "stable"];
  const [spinning, setSpinning] = useState(false);
  useEffect(() => {
    if (!roulette?.enabled || !effects) return;
    setSpinning(true);
    const timer = setTimeout(() => setSpinning(false), 900);
    return () => clearTimeout(timer);
  }, [roulette?.cycle, roulette?.enabled, effects]);
  return (
    <section className="neon-card arena-balance-card" aria-label="Condições da arena">
      <div className="card-header">
        <h3>{roulette?.enabled ? "Roleta da arena" : "Arena · custos fixos"}</h3>
        <span className="arena-round">Rodada {Math.floor(state.move / 2) + 1}</span>
      </div>
      {roulette?.enabled ? (
        <>
          <div
            className={`arena-event ${spinning ? "is-spinning" : ""}`}
            key={roulette.cycle}
            data-event={roulette.event}
            role="status"
          >
            <span>EVENTO COMPARTILHADO</span>
            <strong>{event.name}</strong>
            <p>{event.desc}</p>
          </div>
          <p className="balance-note">
            Próximo sorteio em {Math.ceil((6 - (state.move % 6)) / 2)} rodada(s). O evento vale para
            ambos.
          </p>
          <details className="arena-odds">
            <summary>Chances de cada evento</summary>
            <ul>
              {Object.values(ARENA_EVENTS).map((item) => (
                <li key={item.name}>
                  <span>{item.name}</span>
                  <strong>25%</strong>
                </li>
              ))}
            </ul>
          </details>
        </>
      ) : (
        <p className="balance-note">
          Poderes com preço fixo. A opção é escolhida antes da partida.
        </p>
      )}
      <p className="balance-note">
        +1 energia para os dois após cada rodada. Capturas pontuam material; o resultado depende do
        rei.
      </p>
      {!!state.bombs?.length && (
        <div className="bomb-warning" role="alert">
          <strong>BOMBA ARMADA!</strong>
          {state.bombs.map((bomb) => (
            <p key={`${bomb.owner}-${bomb.detonateAt}`}>
              Área {sqName(bomb.center)} · alvos{" "}
              {bomb.targets
                .map((target) => {
                  const current = state.board.findIndex((piece) => piece?.id === target.id);
                  return sqName(current >= 0 ? current : target.square);
                })
                .join(", ")}
              . Explode após esta resposta. Saia da área ou use escudo.
            </p>
          ))}
        </div>
      )}
    </section>
  );
}

export function MatchResult({
  state,
  gameId,
  viewer,
  difficulty,
  training,
  rematch,
  rematchLabel,
  rematchDisabled,
  confirmed,
}: {
  state: GameState;
  gameId: string;
  viewer: Color | "spec";
  difficulty: Difficulty | null;
  training: boolean;
  rematch: () => void;
  rematchLabel: string;
  rematchDisabled: boolean;
  confirmed: boolean;
}) {
  const [progress, setProgress] = useState(() => readProgress(localStorage));
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    if (training || viewer === "spec" || !confirmed) return;
    try {
      setProgress(recordMatch(localStorage, gameId, state, viewer, difficulty));
    } catch {
      setStorageError(true);
    }
  }, [gameId, state, viewer, difficulty, training, confirmed]);
  const metrics = balanceMetrics(progress.matches);
  const title = !state.winner
    ? "Empate"
    : viewer === "spec" || training
      ? `${state.winner === "w" ? "Brancas" : "Pretas"} venceram`
      : state.winner === viewer
        ? "Você venceu!"
        : "Você perdeu";
  return (
    <section className="neon-card match-result-card" aria-label="Resumo da partida">
      <span className="result-eyebrow">PARTIDA ENCERRADA</span>
      <h3>{title}</h3>
      <p>{state.result ? RESULT_LABELS[state.result] : "Vitória"}</p>
      <div className="match-stat-grid">
        <div>
          <strong>{state.move}</strong>
          <span>Ações</span>
        </div>
        <div>
          <strong>{timeLabel(matchDuration(state))}</strong>
          <span>Tempo jogado</span>
        </div>
        <div>
          <strong>
            {state.material?.w ?? 0} × {state.material?.b ?? 0}
          </strong>
          <span>Material capturado · B/P</span>
        </div>
      </div>
      <div className="decisive-action">
        <span>Última ação</span>
        <p>{state.lastDecision ?? state.log[0] ?? "Partida encerrada"}</p>
      </div>
      {!training && viewer !== "spec" && (
        <div className="cosmetic-progress">
          <strong>
            +{matchXp(state, viewer)} XP · {progress.xp} XP total
          </strong>
          <p>Conquistas cosméticas · salvas neste dispositivo</p>
          <ul>
            {progress.achievements.map((key) => (
              <li key={key}>✦ {ACHIEVEMENTS[key] ?? key}</li>
            ))}
          </ul>
          {storageError && <p role="alert">Não foi possível salvar o progresso neste navegador.</p>}
        </div>
      )}
      {viewer !== "spec" && (
        <Button variant="arena" className="cta-link" onClick={rematch} disabled={rematchDisabled}>
          {rematchLabel}
        </Button>
      )}
      {!training && viewer !== "spec" && (
        <details className="balance-metrics">
          <summary>Seus dados de equilíbrio · {metrics.games} partidas</summary>
          <p>
            Últimas 200 partidas neste dispositivo, misturando PvP e níveis solo. Amostra
            descritiva: associação entre uso e vitória, sem provar que um poder causou o resultado.
          </p>
          <p>
            Vitórias: brancas {metrics.whiteWins} · pretas {metrics.blackWins} · empates{" "}
            {metrics.draws}. Duração média: {timeLabel(metrics.averageMs)}.
          </p>
          <ul>
            {metrics.powers.map((item) => (
              <li key={item.power}>
                <strong>
                  {POWERS[item.power].name}: {item.count} usos
                </strong>
                <span>
                  {item.wins} nas cores vencedoras · {item.ahead} com vantagem de material antes ·{" "}
                  {item.behind} em desvantagem
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
