import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { leaderboard, type Leader } from "@/lib/player";

export const Route = createFileRoute("/ranking")({ ssr: false, component: Ranking });
function Ranking() {
  const [players, setPlayers] = useState<Leader[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    leaderboard().then(setPlayers).catch(() => setError("Não foi possível carregar o ranking."));
  }, []);
  return <main className="ranking-page">
    <header><Link to="/">← VOLTAR À ARENA</Link><span>CHESS LEAGUE</span></header>
    <span className="player-login-kicker">HALL DA FAMA</span>
    <h1>Ranking da arena</h1>
    <p>Vitórias em duelos online. Modo treino e partidas contra a IA não entram nesta classificação.</p>
    {error && <p role="alert">{error}</p>}
    <ol className="ranking-list">{players.map((p, i) =>
      <li key={p.id}><span className="ranking-position">#{i + 1}</span><strong>{p.display_name}</strong><span>{p.wins} V · {p.losses} D · {p.draws} E</span><b>{p.xp} XP</b></li>
    )}</ol>
    {!error && players.length === 0 && <p>Ainda não há partidas classificadas. Seja o primeiro!</p>}
  </main>;
}
