import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Bot, Check, Copy, Crown, Flame, Gamepad2, LockKeyhole, Radio, Shield, Sparkles, Swords, Trophy, UserRound, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { newGameState } from "@/lib/new-game";
import { soloGameId, type Difficulty } from "@/lib/computer";
import logo from "../../img-refs/Logo 3D Chess League Neon Dourado.png";
import arenaArt from "../../img-refs/Arena Neon de Xadrez Galáctico.png";
import arenaBg from "../../img-refs/BG - Arena Cósmica de Xadrez Neon.png";
import "./../styles/hall.css";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Chess League — Escolha sua arena" },
    { name: "description", content: "Seu novo hall de xadrez: partidas com poderes, treino com IA e futuras arenas clássica, ranqueada e CAOS." },
    { property: "og:title", content: "Chess League — Entre na arena" },
    { property: "og:description", content: "Escolha seu modo, pratique com IA e desafie seus amigos." },
  ]}),
  component: Hall,
});

const difficulties: Record<Difficulty, string> = { easy: "Recruta", medium: "Tático", hard: "Mestre" };

function Hall() {
  const [creating, setCreating] = useState(false);
  const [roomLink, setRoomLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");

  async function copyRoom(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
      setError("A sala foi criada, mas não foi possível copiar automaticamente. Use o link exibido abaixo.");
    }
  }

  async function createRoom() {
    if (creating) return;
    setCreating(true);
    setError("");
    setCopied(false);
    try {
      const token = crypto.randomUUID();
      // PvP casual uses the same balanced powers as the future competitive mode.
      // A room invitation is not ranked matchmaking and never awards rank points.
      const { data, error: failure } = await supabase.from("games")
        .insert({ white_token: token, state: newGameState({ roulette: false }) as never })
        .select("id").single();
      if (failure || !data) throw new Error("room-create-failed");
      localStorage.setItem("xadrez-token-" + data.id, token);
      const url = new URL("/jogo/" + data.id, window.location.origin).href;
      setRoomLink(url);
      await copyRoom(url);
    } catch {
      setError("Não foi possível criar a sala. Confira sua conexão e tente novamente.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="hall" id="hall">
      <div className="hall-container">
        <header className="hall-nav">
          <a className="hall-brand" href="#hall" aria-label="Chess League — Hall principal">
            <img src={logo} alt="Chess League" width={2172} height={724} />
          </a>
          <nav className="hall-nav-links" aria-label="Navegação principal">
            <a href="#arenas">ARENAS</a>
            <a href="#treinamento">TREINAMENTO</a>
            <a href="#competitivo">COMPETITIVO</a>
          </nav>
          <div className="hall-identity" aria-label="Perfil de visitante">
            <span>VISITANTE</span><span className="hall-avatar"><UserRound size={19}/></span>
          </div>
        </header>

        <section className="hall-intro" aria-labelledby="hall-title">
          <div>
            <span className="hall-eyebrow">◆ CENTRAL DE COMBATE / CHESS LEAGUE</span>
            <h1 id="hall-title">ESCOLHA SUA <em>ARENA.</em></h1>
            <p>Quatro caminhos. Uma liga. Estratégia para todos os estilos de jogo.</p>
          </div>
          <div className="hall-season" id="competitivo"><Trophy size={28} /><span>SEASON 00<small>PRÉ-TEMPORADA</small></span></div>
        </section>

        <section className="hall-grid" id="arenas" aria-label="Modalidades Chess League">
          <article className="hall-card hall-feature">
            <img className="hall-card-img" src={arenaArt} alt="" />
            <div className="hall-card-inner">
              <span className="hall-mode-index"><span className="hall-dot"/> ARENA 01 // O MODO PRINCIPAL</span>
              <h2>ARENA<br/><span>COMPETITIVA.</span></h2>
              <p>O xadrez ganha uma nova camada de estratégia. Escudo, Raio, Teleporte, Congelamento e Bomba transformam cada confronto.</p>
              <div className="hall-card-bottom">
                <div className="hall-chipline">
                  <span className="hall-chip">05 PODERES</span>
                  <span className="hall-chip">PvP 1 × 1</span>
                  <span className="hall-chip">SEM ROLETA</span>
                </div>
                <div className="hall-actions">
                  <button className="hall-btn" type="button" onClick={() => void createRoom()} disabled={creating}>
                    <Swords size={18}/>{creating ? "CRIANDO SALA..." : "JOGAR COM AMIGO"}<ArrowRight size={16}/>
                  </button>
                  <a className="hall-btn hall-btn-secondary" href="#treinamento"><Bot size={18}/> TREINAR COM IA</a>
                </div>
                <p style={{marginTop:16,fontSize:11,color:"#8499b8"}}><LockKeyhole size={12} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>PARTIDAS RANQUEADAS E PATENTES EM DESENVOLVIMENTO</p>
              </div>
            </div>
          </article>
          <article className="hall-card hall-side hall-classic">
            <img className="hall-card-img" src={arenaBg} alt="" />
            <div className="hall-card-inner">
              <span className="hall-mode-index"><Shield size={14}/> ARENA 02 // ORIGENS</span>
              <h2>XADREZ<br/>CLÁSSICO.</h2>
              <p>Sem poderes, sem vantagens extras. Apenas você, seu adversário e o tabuleiro.</p>
              <div className="hall-card-bottom"><span className="hall-status"><LockKeyhole size={12}/> EM DESENVOLVIMENTO</span></div>
            </div>
          </article>
          <article className="hall-card hall-side hall-chaos">
            <img className="hall-card-img" src={arenaArt} alt="" />
            <div className="hall-card-inner">
              <span className="hall-mode-index"><Flame size={14}/> ARENA 03 // SEM LIMITES</span>
              <h2>MODO<br/>CAOS.</h2>
              <p>Cartas absurdas, mutações e duelos frenéticos. Prepare-se para esquecer tudo que conhece.</p>
              <div className="hall-card-bottom"><span className="hall-status"><Sparkles size={12}/> EM DESENVOLVIMENTO</span></div>
            </div>
          </article>
        </section>

        {roomLink && (
          <div className="hall-room" role="status">
            <Check size={23} color="#00f0ff"/>
            <label htmlFor="hall-room-link">SALA CRIADA · {copied ? "LINK COPIADO" : "CONVIDE SEU ADVERSÁRIO"}</label>
            <input id="hall-room-link" value={roomLink} readOnly onFocus={e=>e.currentTarget.select()}/>
            <button className="hall-btn hall-btn-secondary" type="button" onClick={()=>void copyRoom(roomLink)}><Copy size={16}/> COPIAR</button>
            <Link className="hall-btn" to="/jogo/$id" params={{id:roomLink.split("/").pop()!}}>ENTRAR NA SALA <ArrowRight size={15}/></Link>
          </div>
        )}
        {error && <p className="hall-alert" role="alert">{error}</p>}

        <section className="hall-lower" id="treinamento">
          <div className="hall-training">
            <span className="hall-training-icon"><Bot size={29}/></span>
            <div className="hall-training-content">
              <span className="hall-overline">CAMPO DE TREINAMENTO</span>
              <h3>AFIE SUAS JOGADAS COM A IA</h3>
              <p>Aprenda os poderes e pratique as regras da arena competitiva. Sem perder pontos.</p>
            </div>
            <div className="hall-training-control">
              <label htmlFor="hall-difficulty" className="hall-overline">DIFICULDADE</label>
              <select id="hall-difficulty" value={difficulty} onChange={e=>setDifficulty(e.target.value as Difficulty)}>
                {(Object.keys(difficulties) as Difficulty[]).map(key=><option key={key} value={key}>{difficulties[key]}</option>)}
              </select>
              <Link className="hall-btn" to="/jogo/$id" params={{id:soloGameId(difficulty,false)}}><Gamepad2 size={17}/> TREINAR <ArrowRight size={15}/></Link>
            </div>
          </div>
          <div className="hall-news">
            <Crown size={37}/>
            <div><span className="hall-overline">A PRÓXIMA EVOLUÇÃO</span><h3>RANQUES, INSÍGNIAS E TEMPORADAS</h3><p>As patentes competitivas chegarão à liga. Por enquanto, desafie amigos ou domine os poderes contra a IA.</p></div>
          </div>
        </section>
        <footer className="hall-footer">
          <span>© CHESS LEAGUE · ARENA DE XADREZ 2.0</span>
          <span><Radio size={12} style={{display:"inline",verticalAlign:"middle",marginRight:6}}/>HALL ONLINE · MODO PODERES DISPONÍVEL</span>
        </footer>
      </div>
    </main>
  );
}
