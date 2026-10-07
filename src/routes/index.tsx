import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initialState, POWERS } from "@/lib/chess";
import arenaBg from "../../img-refs/BG - Arena Cósmica de Xadrez Neon.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chess League — Xadrez 3D com poderes online" },
      { name: "description", content: "Crie uma partida de xadrez com poderes e jogue online enviando um link para seu amigo." },
      { property: "og:title", content: "Chess League — Xadrez 3D com poderes online" },
      { property: "og:description", content: "Partidas PvP de xadrez com poderes. Só enviar o link." },
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

  async function create() {
    setLoading(true);
    setErr("");
    const token = crypto.randomUUID();
    const { data, error } = await supabase
      .from("games")
      .insert({ white_token: token, state: initialState() as never })
      .select("id")
      .single();
    if (error || !data) {
      setErr("Não foi possível criar a partida. Tente novamente.");
      setLoading(false);
      return;
    }
    localStorage.setItem(`xadrez-token-${data.id}`, token);
    navigate({ to: "/jogo/$id", params: { id: data.id } });
  }

  return (
    <main
      className="landing-shell min-h-screen px-4 py-5"
      style={{
        backgroundImage: `radial-gradient(circle at 12% 12%, rgba(41, 230, 255, 0.12), transparent 20%), radial-gradient(circle at 80% 10%, rgba(255, 47, 209, 0.12), transparent 24%), linear-gradient(180deg, rgba(7, 7, 17, 1) 0%, rgba(10, 12, 24, 0.98) 100%), url(${arenaBg})`,
        backgroundSize: "cover, cover, cover, cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      <div className="landing-wrap">
        <header className="landing-header">
          <div className="landing-brand" aria-label="Chess League">
            <span className="landing-brand-mark">♔</span>
            <div className="landing-brand-copy">
              <span>CHESS</span>
              <strong>LEAGUE</strong>
            </div>
          </div>

          <button
            type="button"
            onClick={create}
            disabled={loading}
            className="landing-cta"
          >
            {loading ? "Criando..." : "Criar partida"}
          </button>
        </header>

        <section className="hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">ARENA PvP</span>
            <h1>
              Chess <span>League</span>
            </h1>
            <p>
              Xadrez em uma arena 3D neon, com poderes explosivos e partidas instantâneas por link.
            </p>

            <div className="hero-actions">
              <button type="button" onClick={create} disabled={loading} className="primary-action">
                {loading ? "Criando..." : "Criar partida"}
              </button>
              <button type="button" className="secondary-action">Ver poderes</button>
            </div>

            <div className="hero-stats">
              <div>
                <strong>1v1</strong>
                <span>Instantâneo</span>
              </div>
              <div>
                <strong>5</strong>
                <span>Habilidades</span>
              </div>
              <div>
                <strong>Link</strong>
                <span>Compartilhável</span>
              </div>
            </div>

            {err && <p className="landing-error">{err}</p>}
          </div>

          <div className="hero-showcase">
            <div className="showcase-panel">
              <div className="showcase-topline">
                <span className="live-dot" />
                <span>LIVE ARENA</span>
              </div>

              <div className="showcase-board">
                <div className="mini-board" aria-hidden="true">
                  {Array.from({ length: 64 }, (_, index) => (
                    <span key={index} className={((index + Math.floor(index / 8)) % 2 === 0 ? "light" : "dark")} />
                  ))}
                </div>
              </div>

              <div className="showcase-meta">
                <div>
                  <small>JOGADOR</small>
                  <strong>Cyan Prime</strong>
                </div>
                <div>
                  <small>OPONENTE</small>
                  <strong>Nova Pulse</strong>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="powers-section">
          {Object.values(POWERS).map((p) => (
            <article key={p.name} className="power-card" data-tone={p.name.toLowerCase()}>
              <div className="power-card-head">
                <div className="power-card-icon">{p.icon}</div>
                <span className="power-card-cost">{p.cost} ⚡</span>
              </div>
              <h3>{p.name}</h3>
              <p>{p.desc}</p>
            </article>
          ))}
        </section>

        <section className="rules-panel">
          <div className="rules-head">
            <span className="eyebrow muted">REGRAS</span>
            <h2>Como a partida funciona</h2>
          </div>
          <ul>
            <li>Cada jogador ganha 1 de energia por turno e pode chegar até 10.</li>
            <li>Você usa 1 poder por turno antes de mover, e ainda precisa fazer o lance.</li>
            <li>Vence quem capturar o rei adversário, sem xeque-mate tradicional.</li>
            <li>Peões que chegam ao fim viram Dama.</li>
            <li>Capturar uma peça concede energia extra.</li>
          </ul>
        </section>
      </div>
    </main>
  );
}
