import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Bot, Check, ChevronDown, Copy, Crown, Gamepad2, MessageCircle, Radio, Shield, Sparkles, Swords, Timer, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { POWERS, type PowerId } from "@/lib/chess";
import { newGameState } from "@/lib/new-game";
import { soloGameId, type Difficulty } from "@/lib/computer";
import arenaBg from "../../img-refs/BG - Arena Cósmica de Xadrez Neon.png";
import arenaArt from "../../img-refs/Arena Neon de Xadrez Galáctico.png";
import logo from "../../img-refs/Logo 3D Chess League Neon Dourado.png";
import powerIcons from "@/assets/power-icons.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chess League | Xadrez 2.0 com poderes — Arena PvP e IA" },
      { name: "description", content: "Entre na arena Chess League: xadrez 3D competitivo com cinco poderes especiais, duelos por link, partidas de 5 minutos por jogador e treino contra IA." },
      { property: "og:title", content: "Chess League — Xadrez 2.0 com poderes nucleares" },
      { property: "og:description", content: "Crie sua sala, desafie um rival e domine uma arena de xadrez 3D com poderes." },
      { property: "og:type", content: "website" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const arsenal: { id: PowerId; headline: string; note: string }[] = [
  { id: "bolt", headline: "ATAQUE CIRÚRGICO", note: "Elimine uma peça inimiga desprotegida a até 3 casas. Rei e dama são imunes." },
  { id: "bomb", headline: "ÁREA DE PERIGO", note: "Marque até 2 alvos numa área 3×3. Detona após a resposta rival." },
  { id: "freeze", headline: "CONTROLE TOTAL", note: "Imobilize uma peça rival durante a próxima vez dela." },
  { id: "teleport", headline: "MUDE AS REGRAS DO ESPAÇO", note: "Reposicione uma peça aliada em uma casa livre a até 3 casas." },
  { id: "shield", headline: "DEFESA EXTREMA", note: "Proteja uma peça aliada na resposta do adversário. Não vale para o Rei." },
];

const labels: Record<Difficulty, string> = { easy: "Fácil", medium: "Médio", hard: "Mestre" };

function Index() {
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [roomLink, setRoomLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [roulette, setRoulette] = useState(true);
  const [activePower, setActivePower] = useState<PowerId>("bolt");
  const selected = arsenal.find(p => p.id === activePower)!;

  async function copyRoom(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
      setError("A sala foi criada, mas o navegador não permitiu copiar automaticamente. Copie o endereço abaixo.");
    }
  }
  async function createRoom() {
    if (creating) return;
    setCreating(true); setError(""); setCopied(false);
    try {
      const token = crypto.randomUUID();
      const { data, error: createError } = await supabase.from("games")
        .insert({ white_token: token, state: newGameState({ roulette }) as never })
        .select("id").single();
      if (createError || !data) throw new Error("create-room");
      localStorage.setItem("xadrez-token-" + data.id, token);
      const url = new URL("/jogo/" + data.id, window.location.origin).href;
      setRoomLink(url);
      await copyRoom(url);
      // Keep the share URL visible so a created room can actually be distributed.
    } catch {
      setError("Não foi possível criar sua sala. Tente novamente.");
    } finally { setCreating(false); }
  }

  return <main className="league-lp" id="inicio">
    <div className="league-bg" aria-hidden="true" style={{ backgroundImage: `linear-gradient(180deg,#07091399,#070913 94%),url("${arenaBg}")` }} />
    <header className="league-nav">
      <a className="league-logo" href="#inicio" aria-label="Chess League, início"><img src={logo} alt="Chess League" width={2172} height={724} fetchPriority="high" /></a>
      <nav aria-label="Navegação principal"><a href="#arsenal">Arsenal</a><a href="#regras">Regras</a><a href="#como-jogar">Como jogar</a><Link to="/ranking">Ranking</Link></nav>
      <a href="#arena" className="league-nav-cta"><Gamepad2 size={17} aria-hidden="true" /> JOGAR AGORA</a>
    </header>

    <section className="league-hero" id="arena" aria-labelledby="league-hero-title">
      <div className="league-hero-content">
        <span className="league-kicker"><span className="league-live-dot" /> BEM-VINDO À PRÓXIMA GERAÇÃO DO XADREZ</span>
        <h1 id="league-hero-title">XADREZ <em>2.0:</em><br />ESTRATÉGIA COM <span>PODERES NUCLEARES.</span></h1>
        <p>O tabuleiro é clássico. O confronto, não. Acumule energia, ative habilidades devastadoras e surpreenda quem achava que já sabia jogar.</p>
        <div className="league-actions">
          <button className="league-action league-action-primary" type="button" onClick={() => void createRoom()} disabled={creating}><Swords aria-hidden="true" />{creating ? "CRIANDO SALA..." : "CRIAR SALA PvP"}<span>GERAR LINK <ArrowRight size={16} /></span></button>
          <div className="league-ai-action"><label htmlFor="league-difficulty">TREINAR CONTRA IA</label><div><select id="league-difficulty" value={difficulty} onChange={e => setDifficulty(e.target.value as Difficulty)}>{(Object.keys(labels) as Difficulty[]).map(key => <option key={key} value={key}>{labels[key]}</option>)}</select><Link to="/jogo/$id" params={{ id: soloGameId(difficulty, roulette) }} aria-label={`Treinar contra IA: ${labels[difficulty]}`}><Bot size={19}/><ArrowRight size={18}/></Link></div></div>
        </div>
        <Link className="league-try" to="/jogo/$id" params={{ id: "treino" }}><Gamepad2 size={17}/> VER TABULEIRO 3D <ArrowRight size={14}/></Link>
        <label className="league-roulette"><input type="checkbox" checked={roulette} onChange={e => setRoulette(e.target.checked)}/><span>Roleta de eventos ativada <small>Alterações táticas a cada 3 rodadas · PvP e IA</small></span></label>
        {roomLink && <div className="league-room" role="status"><strong><Check size={16}/> SALA PRONTA · LINK {copied ? "COPIADO!" : "GERADO"}</strong><div><input aria-label="Link da sala" value={roomLink} readOnly onFocus={e => e.currentTarget.select()}/><button type="button" onClick={() => void copyRoom(roomLink)}><Copy size={16}/> COPIAR</button></div><Link to="/jogo/$id" params={{id: roomLink.split("/").pop()!}}>ENTRAR NA MINHA SALA <ArrowRight size={16}/></Link></div>}
        {error && <p className="league-error" role="alert">{error}</p>}
        <div className="league-hero-metrics"><span><Zap size={17}/> 05 PODERES</span><span><Timer size={17}/> 5 MIN / JOGADOR</span><span><Swords size={17}/> PvP + IA</span></div>
      </div>
      <figure className="league-preview"><div className="league-preview-top"><span><Radio size={16} aria-hidden="true"/> ARENA // 01</span><span className="league-live"><span className="league-live-dot"/> ARENA PRONTA</span></div><div className="league-preview-picture"><img src={arenaArt} alt="Prévia ilustrativa do tabuleiro 3D da Chess League com peças neon ciano e magenta" width={1672} height={941} fetchPriority="high"/><div className="league-preview-scan" aria-hidden="true"/></div><figcaption><strong>BRANCAS <span>VS</span> PRETAS</strong><small>UMA ARENA. DOIS LADOS. INFINITAS REVIRAVOLTAS.</small></figcaption></figure>
    </section>

    <div className="league-ticker" aria-label="Recursos"><span>ESTRATÉGIA SEM LIMITES</span><Zap/><span>5 PODERES ESPECIAIS</span><Zap/><span>DUELAR POR LINK</span><Zap/><span>DOMINE A ARENA</span></div>

    <section className="league-section" id="arsenal" aria-labelledby="arsenal-title"><div className="league-section-head"><div><span className="league-kicker">01 // ESCOLHA SUA ARMA</span><h2 id="arsenal-title">ARSENAL <em>DA LIGA.</em></h2></div><p>Cinco poderes. Um tabuleiro. Cada escolha pode virar o jogo.</p></div>
      <div className="league-power-grid">{arsenal.map((entry, i) => <button type="button" key={entry.id} aria-pressed={activePower===entry.id} onMouseEnter={() => setActivePower(entry.id)} onFocus={() => setActivePower(entry.id)} onClick={() => setActivePower(entry.id)} className={"league-power "+(activePower===entry.id?"is-selected":"")} data-power={entry.id}><span className="league-power-index">0{i+1} // {entry.headline}</span><span className="league-power-image"><img src={powerIcons} alt="" loading="lazy" width={1536} height={512} style={{transform:`translateX(-${["shield","freeze","teleport","bolt","bomb"].indexOf(entry.id)*20}%)`}}/></span><strong>{POWERS[entry.id].name.toUpperCase()}</strong><span className="league-power-energy"><Zap size={14}/> {POWERS[entry.id].cost} ENERGIA</span></button>)}</div>
      <div className="league-power-detail" aria-live="polite"><div><span>ARSENAL SELECIONADO // {selected.headline}</span><h3>{POWERS[activePower].name.toUpperCase()}</h3><p>{selected.note}</p></div><span className="league-energy-value"><Zap size={26}/>{POWERS[activePower].cost}<small>ENERGIA</small></span></div>
    </section>

    <section className="league-section" id="regras" aria-labelledby="rules-title"><div className="league-section-head"><div><span className="league-kicker">02 // UM NOVO CONFRONTO</span><h2 id="rules-title">O CLÁSSICO EVOLUIU. <em>E MUITO.</em></h2></div></div>
      <div className="league-versus"><div className="league-versus-classic"><span>TRADICIONAL</span><h3>XADREZ CLÁSSICO</h3><ul><li>Somente movimentos tradicionais</li><li>Sem poderes especiais</li><li>Empates e partidas longas são possíveis</li></ul></div><div className="league-versus-mark">VS</div><div className="league-versus-new"><span>EVOLUÇÃO 2.0</span><h3>CHESS LEAGUE</h3><ul><li>Energia acumulada a cada rodada</li><li>5 poderes com recarga tática</li><li>5 minutos por jogador + xeque-mate</li><li>Entre apenas com nome e celular, sem senha</li></ul></div></div>
      <p className="league-rules-note"><Shield size={16}/> O Rei não pode ser capturado diretamente: a vitória acontece por xeque-mate ou tempo esgotado. Empates ainda são possíveis.</p>
    </section>

    <section className="league-section" id="como-jogar" aria-labelledby="steps-title"><div className="league-section-head"><div><span className="league-kicker">03 // CONVITE INSTANTÂNEO</span><h2 id="steps-title">DUELO EM <em>3 PASSOS.</em></h2></div><p>Sem instalação. Só estratégia e uma boa rivalidade.</p></div><ol className="league-steps"><li><b>01</b><Swords/><h3>CRIE A SALA</h3><p>Um clique gera o link privado da partida.</p></li><li><b>02</b><Copy/><h3>CHAME SEU RIVAL</h3><p>Compartilhe no WhatsApp, Discord ou onde preferir.</p></li><li><b>03</b><Gamepad2/><h3>ENTRE NA ARENA</h3><p>Os dois jogam pelo navegador, em tempo real.</p></li></ol></section>

    <section className="league-chat-section"><div><span className="league-kicker">NOVIDADE // QUICK CHAT</span><h2>PROVOQUE. ELOGIE. <em>VENÇA.</em></h2><p>Uma reação rápida vale mais que mil palavras. Sem digitação, sem perder o lance.</p></div><div className="league-chat-pills" aria-label="Exemplos de reações rápidas"><span>Calculado.</span><span>Ops...</span><span>Belo lance!</span><span>GG!</span><MessageCircle aria-hidden="true"/></div></section>

    <section className="league-bottom"><Crown size={38} aria-hidden="true"/><div><span className="league-kicker">A ARENA ESTÁ PRONTA</span><h2>O PRÓXIMO CAMPEÃO <em>PODE SER VOCÊ.</em></h2></div><a href="#arena" className="league-action league-action-primary">COMEÇAR AGORA <ArrowRight size={20}/></a></section>
    <footer className="league-footer"><a href="#inicio" aria-label="Voltar ao início"><img src={logo} alt="Chess League" width={2172} height={724} loading="lazy"/></a><span>© CHESS LEAGUE · XADREZ 2.0</span><Link to="/ranking">RANKING <ChevronDown size={15}/></Link></footer>
  </main>;
}
