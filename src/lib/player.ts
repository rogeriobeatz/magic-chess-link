import { supabase } from "@/integrations/supabase/client";
import type { SupabaseClient } from "@supabase/supabase-js";
const db = supabase as unknown as SupabaseClient;

export type Player = { id: string; display_name: string; phone: string };
export type Leader = { id: string; display_name: string; wins: number; losses: number; draws: number; games: number; xp: number };

export async function currentPlayer(): Promise<Player | null> {
  const { data: { session } } = await db.auth.getSession();
  if (!session) return null;
  const { data, error } = await db.from("player_profiles").select("id,display_name,phone").eq("id", session.user.id).maybeSingle();
  if (error) throw error;
  return data as Player | null;
}

export async function registerPlayer(name: string, rawPhone: string): Promise<Player> {
  const display_name = name.trim().replace(/\s+/g, " ");
  const phone = rawPhone.replace(/\D/g, "");
  if (display_name.length < 2 || display_name.length > 32) throw new Error("Use um nome de 2 a 32 caracteres.");
  if (phone.length < 10 || phone.length > 13) throw new Error("Informe um telefone com DDD válido.");
  let { data: { session } } = await db.auth.getSession();
  if (!session) {
    const { data, error } = await db.auth.signInAnonymously();
    if (error || !data.session) throw new Error("Não foi possível iniciar a sessão. Ative o login anônimo no Supabase.");
    session = data.session;
  }
  const player: Player = { id: session.user.id, display_name, phone };
  const { error } = await db.from("player_profiles").upsert(player, { onConflict: "id" });
  if (error) throw new Error("Não foi possível salvar seu perfil. Confirme que a migração foi aplicada.");
  return player;
}

export async function leaderboard(): Promise<Leader[]> {
  const { data, error } = await db.rpc("chess_leaderboard");
  if (error) throw error;
  return (data ?? []) as Leader[];
}

export async function submitResult(gameId: string, token: string): Promise<void> {
  const { error } = await db.rpc("submit_chess_result", { p_game_id: gameId, p_token: token });
  if (error) throw error;
}
