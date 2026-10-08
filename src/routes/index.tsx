import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState, type CSSProperties } from "react";
import {
  ArrowDown,
  ArrowRight,
  Bot,
  ChevronDown,
  Crown,
  Gamepad2,
  Link2,
  ShieldCheck,
  Sparkles,
  Swords,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { POWERS, type PowerId } from "@/lib/chess";
import { newGameState } from "@/lib/new-game";
import { DIFFICULTIES, soloGameId, type Difficulty } from "@/lib/computer";
import arenaBg from "../../img-refs/BG - Arena Cósmica de Xadrez Neon.png";
import arenaArt from "../../img-refs/Arena Neon de Xadrez Galáctico.png";
import logo from "../../img-refs/Logo 3D Chess League Neon Dourado.png";
import powerIcons from "@/assets/power-icons.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chess League — Entre na arena. Mude o jogo." },
      {
        name: "description",
        content:
          "Xadrez 3D com poderes em uma arena neon. Desafie um amigo pelo link ou enfrente o computador em três níveis. Entre na arena sem cadastro.",
      },
      { property: "og:title", content: "Chess League — Xadrez com poderes" },
      {
        property: "og:description",
        content: "Sua jogada. Seu poder. Sua arena. Jogue contra amigos ou enfrente o computador.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [roulette, setRoulette] = useState(true);

  async function create() {
    if (loading) return;
    setLoading(true);
    setErr("");
    try {
      const token = crypto.randomUUID();
      const { data, error } = await supabase
        .from("games")
        .insert({ white_token: token, state: newGameState({ roulette }) as never })
        .select("id")
        .single();
      if (error || !data) throw new Error("create-game");
      localStorage.setItem("xadrez-token-" + data.id, token);
      await navigate({ to: "/jogo/$id", params: { id: data.id } });
    } catch {
      setErr("Não foi possível criar a partida. Tente novamente.");
      setLoading(false);
    }
  }

  return (
    <main className="landing-shell" id="inicio">
      <img className="lp-backdrop" src={arenaBg} alt="" aria-hidden="true" fetchPriority="high" />
      <div className="lp-atmosphere" aria-hidden="true" />
      <div className="lp-wrap">
        <header className="lp-header">
          <a href="#inicio" className="lp-brand" aria-label="Chess League — início">
            <img src={logo} alt="Chess League" width={2172} height={724} fetchPriority="high" />
          </a>
          <nav aria-label="Navegação principal">
            <a href="#jogar">A arena</a>
            <a href="#poderes">Poderes</a>
            <a href="#como-jogar">Como jogar</a>
          </nav>
          <a href="#jogar" className="lp-button lp-button-gold lp-header-cta">
            <Gamepad2 aria-hidden="true" />
            Jogar agora
            <ArrowRight aria-hidden="true" />
          </a>
        </header>

        <section className="lp-hero" aria-labelledby="hero-title">
          <div className="lp-hero-copy">
            <span className="lp-eyebrow">
              <span className="lp-signal" />
              XADREZ 3D. ENERGIA MÁXIMA.
            </span>
            <h1 id="hero-title">
              <span className="lp-headline-line">Sua jogada.</span>
              <span className="lp-headline-line">Seu poder.</span>
              <span className="lp-headline-line">
                Sua <em>arena.</em>
              </span>
            </h1>
            <p>
              O clássico ganhou poderes. Domine o tabuleiro, surpreenda seu rival e transforme cada
              lance em um espetáculo.
            </p>
            <div className="lp-hero-actions">
              <a href="#jogar" className="lp-button lp-button-gold">
                <Swords aria-hidden="true" />
                Entrar na arena
                <ArrowRight aria-hidden="true" />
              </a>
              <Link
                to="/jogo/$id"
                params={{ id: "treino" }}
                className="lp-button lp-button-outline"
              >
                Explorar o tabuleiro
              </Link>
            </div>
            <div className="lp-hero-features">
              <span>
                <ShieldCheck aria-hidden="true" />
                Sem cadastro
              </span>
              <span>
                <Swords aria-hidden="true" />
                PvP & solo
              </span>
              <span>
                <Zap aria-hidden="true" />5 poderes
              </span>
            </div>
          </div>
          <figure className="lp-hero-art">
            <div className="lp-art-heading">
              <span>
                <Crown aria-hidden="true" />
                CHESS LEAGUE ARENA
              </span>
              <span className="lp-art-chip">ESTRATÉGIA × PODER</span>
            </div>
            <div className="lp-arena-window">
              <img
                src={arenaArt}
                alt="Arena Chess League com tabuleiro dourado e peças neon cyan e magenta"
                width={1672}
                height={941}
                fetchPriority="high"
              />
            </div>
            <figcaption className="lp-art-caption">
              <span className="lp-caption-icon">
                <Sparkles aria-hidden="true" />
              </span>
              <div>
                <strong>O próximo xeque pode mudar tudo.</strong>
                <span>Uma arena. Dois lados. A sua estratégia.</span>
              </div>
              <span className="lp-caption-diamond" aria-hidden="true" />
            </figcaption>
          </figure>
        </section>

        <div className="lp-feature-ribbon" aria-label="Recursos da arena">
          <span>
            <Swords aria-hidden="true" />
            DUELOS POR LINK
          </span>
          <span>
            <Bot aria-hidden="true" />3 NÍVEIS NO SOLO
          </span>
          <span>
            <Zap aria-hidden="true" />
            PODERES ESPECIAIS
          </span>
          <span>
            <Crown aria-hidden="true" />
            VITÓRIA POR XEQUE-MATE
          </span>
        </div>

        <section className="lp-play-section" id="jogar" aria-labelledby="play-title">
          <div className="lp-section-heading">
            <div>
              <span className="lp-eyebrow">ESCOLHA SEU DESAFIO</span>
              <h2 id="play-title">
                A arena está <span>te esperando.</span>
              </h2>
            </div>
            <p>Seu próximo duelo começa aqui.</p>
          </div>
          <div className="lp-play-grid">
            <article className="lp-mode-card lp-mode-pvp">
              <div className="lp-mode-top">
                <span className="lp-mode-icon">
                  <Swords aria-hidden="true" />
                </span>
                <span className="lp-mode-badge">1v1 ONLINE</span>
              </div>
              <h3>Desafie um amigo</h3>
              <p>Crie sua arena, envie o link e descubra quem domina o tabuleiro.</p>
              <div className="lp-mode-detail">
                <Link2 aria-hidden="true" />
                Um link é tudo que vocês precisam.
              </div>
              <button
                type="button"
                onClick={create}
                disabled={loading}
                className="lp-button lp-button-gold"
              >
                {loading ? "Preparando a arena..." : "Criar partida PvP"}
                <ArrowRight aria-hidden="true" />
              </button>
              {err && (
                <p className="lp-error" role="alert">
                  {err}
                </p>
              )}
            </article>
            <article className="lp-mode-card lp-mode-solo">
              <div className="lp-mode-top">
                <span className="lp-mode-icon">
                  <Bot aria-hidden="true" />
                </span>
                <span className="lp-mode-badge">VS COMPUTADOR</span>
              </div>
              <h3>Supere seus limites</h3>
              <p>Treine sua estratégia contra um adversário que também sabe usar poderes.</p>
              <div className="lp-solo-controls">
                <label htmlFor="solo-difficulty">Seu nível de desafio</label>
                <div className="lp-select">
                  <select
                    id="solo-difficulty"
                    value={difficulty}
                    onChange={(event) => setDifficulty(event.target.value as Difficulty)}
                  >
                    {(Object.keys(DIFFICULTIES) as Difficulty[]).map((level) => (
                      <option key={level} value={level}>
                        {DIFFICULTIES[level].name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden="true" />
                </div>
              </div>
              <Link
                to="/jogo/$id"
                params={{ id: soloGameId(difficulty, roulette) }}
                className="lp-button lp-button-cyan"
              >
                Jogar sozinho
                <ArrowRight aria-hidden="true" />
              </Link>
              <p className="lp-level-description">{DIFFICULTIES[difficulty].description}</p>
            </article>
          </div>
          <label className="lp-roulette-choice" htmlFor="roulette-mode">
            <input
              id="roulette-mode"
              type="checkbox"
              checked={roulette}
              onChange={(event) => setRoulette(event.target.checked)}
            />
            <span>
              <strong>Roleta da arena · PvP e solo</strong>
              <small>
                A cada 3 rodadas, um evento público com 25% de chance cada. Desmarque para jogar com
                custos fixos.
              </small>
            </span>
          </label>
          <Link to="/jogo/$id" params={{ id: "treino" }} className="lp-training-link">
            Primeira vez na arena? Experimente o modo treino.
            <ArrowRight aria-hidden="true" />
          </Link>
        </section>

        <section className="lp-powers-section" id="poderes" aria-labelledby="powers-title">
          <div className="lp-section-heading">
            <div>
              <span className="lp-eyebrow">SEU ARSENAL NA ARENA</span>
              <h2 id="powers-title">
                O tabuleiro é <span>só o começo.</span>
              </h2>
            </div>
            <p>
              Acumule energia. Escolha o momento.
              <br />
              Vire o jogo com um poder.
            </p>
          </div>
          <div className="lp-powers-grid">
            {(Object.keys(POWERS) as PowerId[]).map((key, index) => {
              const power = POWERS[key];
              return (
                <article className="lp-power-card" data-tone={key} key={key}>
                  <span className="lp-power-cost" aria-label={power.cost + " de energia"}>
                    <Zap aria-hidden="true" />
                    {power.cost}
                  </span>
                  <span
                    className="lp-power-art"
                    aria-hidden="true"
                    style={{ "--lp-sprite-index": index } as CSSProperties}
                  >
                    <img src={powerIcons} alt="" width={1536} height={512} loading="lazy" />
                  </span>
                  <h3>{power.name}</h3>
                  <p>{power.desc}</p>
                </article>
              );
            })}
          </div>
          <p className="lp-power-note">
            <Zap aria-hidden="true" />
            Uma peça ou um poder por turno. Cada escolha conta.
          </p>
        </section>

        <section className="lp-how-section" id="como-jogar" aria-labelledby="how-title">
          <div className="lp-section-heading">
            <div>
              <span className="lp-eyebrow">DO PRIMEIRO LANCE AO XEQUE-MATE</span>
              <h2 id="how-title">
                Entre. Surpreenda. <span>Vença.</span>
              </h2>
            </div>
          </div>
          <ol className="lp-steps">
            <li>
              <span className="lp-step-number">01</span>
              <div>
                <h3>Escolha seu duelo</h3>
                <p>Convide um amigo pelo link ou enfrente o computador no seu nível.</p>
              </div>
            </li>
            <li>
              <span className="lp-step-number">02</span>
              <div>
                <h3>Jogue com poder</h3>
                <p>Os dois ganham energia a cada rodada. Mova uma peça ou ative uma habilidade.</p>
              </div>
            </li>
            <li>
              <span className="lp-step-number">03</span>
              <div>
                <h3>Conquiste a arena</h3>
                <p>Proteja seu rei, surpreenda o adversário e vença por xeque-mate.</p>
              </div>
            </li>
          </ol>
          <details className="lp-rules">
            <summary>
              Conheça as regras da arena
              <ChevronDown aria-hidden="true" />
            </summary>
            <ul>
              <li>
                Ambos começam com 1 de energia e recebem +1 juntos após cada rodada completa, até
                10.
              </li>
              <li>
                Capturas somam material: peão 1, cavalo e bispo 3, torre 5 e dama 9. Não geram
                energia. Vence quem protege o rei e encerra a partida, independentemente dos pontos.
              </li>
              <li>Usar um poder encerra seu turno. Você não pode mover outra peça em seguida.</li>
              <li>
                Cada poder leva 3 rodadas para recarregar. Escudo não protege o rei; congelar
                bloqueia movimento e ataques. A mesma peça recebe imunidade temporária contra
                reaplicação.
              </li>
              <li>
                Teleporte alcança até 3 casas, sem capturar ou promover. Raio alcança até 3 casas de
                uma peça sua ativa e não atinge rei nem dama. Bomba marca até 2 alvos em 3×3 e
                explode depois de uma resposta: mover para fora ou usar escudo salva a peça.
              </li>
              <li>
                Com roleta: Arena estável, Proteção, Inverno e Distorção têm 25% de chance cada. O
                desconto de 1 energia em escudo, congelar ou teleporte vale para ambos por 3
                rodadas. Sem roleta: custos fixos.
              </li>
              <li>
                PvP e solo têm 5 minutos por jogador, sem incremento. Treino não tem relógio.
                Revanche troca as cores.
              </li>
              <li>Peões que chegam ao fim do tabuleiro são promovidos a dama.</li>
              <li>
                Vence quem der xeque-mate. Poderes que salvam o rei também são uma saída válida.
              </li>
              <li>
                Quando o jogador não está em xeque e não tem nenhuma ação legal, a partida termina
                em empate.
              </li>
              <li>
                Somente os reis ou a terceira repetição da posição completa também empatam. Energia,
                recargas e efeitos fazem parte da posição.
              </li>
              <li>
                Vitória rende 100 XP, empate 50 e derrota 25. Conquistas são locais e cosméticas:
                nunca aumentam o poder de uma peça.
              </li>
            </ul>
          </details>
        </section>

        <section className="lp-final-cta">
          <Crown aria-hidden="true" />
          <div>
            <span className="lp-eyebrow">A PRÓXIMA JOGADA É SUA</span>
            <h2>
              Seu lugar é <span>na arena.</span>
            </h2>
          </div>
          <a href="#jogar" className="lp-button lp-button-gold">
            Escolher meu desafio
            <ArrowRight aria-hidden="true" />
          </a>
        </section>
        <footer className="lp-footer">
          <a href="#inicio" aria-label="Chess League — voltar ao início">
            <img src={logo} alt="Chess League" width={2172} height={724} loading="lazy" />
          </a>
          <p>Xadrez. Estratégia. Poder.</p>
          <a href="#inicio">
            Voltar ao topo
            <ArrowDown aria-hidden="true" />
          </a>
        </footer>
      </div>
    </main>
  );
}
