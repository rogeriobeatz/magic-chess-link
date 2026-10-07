import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { initialState, POWERS } from "@/lib/chess";

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
    <main className="min-h-screen px-6 py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="font-display text-sm uppercase tracking-[0.4em] text-primary">Arena PvP</p>
        <h1 className="mt-4 font-display text-6xl font-bold md:text-8xl">
          Chess <span className="text-primary">League</span>
        </h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
          Xadrez em uma arena 3D neon, com poderes, explosões e regras malucas. Crie uma partida, envie o link e enfrente seu amigo em tempo real.
        </p>
        <button
          onClick={create}
          disabled={loading}
          className="mt-10 rounded-full bg-primary px-10 py-4 font-display text-lg font-semibold text-primary-foreground shadow-[var(--glow)] transition hover:scale-105 disabled:opacity-60"
        >
          {loading ? "Criando..." : "Criar partida"}
        </button>
        {err && <p className="mt-4 text-destructive">{err}</p>}
      </div>

      <section className="mx-auto mt-20 grid max-w-4xl gap-4 sm:grid-cols-2">
        {Object.values(POWERS).map((p) => (
          <div key={p.name} className="rounded-2xl border bg-card p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-xl font-semibold">{p.icon} {p.name}</h3>
              <span className="rounded-full bg-secondary px-3 py-1 text-sm text-primary">{p.cost} ⚡</span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
          </div>
        ))}
      </section>

      <section className="mx-auto mt-10 max-w-4xl rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
        <h2 className="font-display text-lg font-semibold text-foreground">Regras</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5">
          <li>Cada jogador ganha 1 de energia por turno (máx. 10).</li>
          <li>Você pode usar 1 poder por turno, antes de mover — e ainda precisa mover.</li>
          <li>Não existe xeque-mate: vence quem capturar o rei adversário.</li>
          <li>Peões que chegam ao fim viram Dama.</li>
          <li>Capturar uma peça dá +1 de energia bônus.</li>
        </ul>
      </section>
    </main>
  );
}
