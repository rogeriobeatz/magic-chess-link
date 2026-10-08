-- Chess League: nome público, telefone privado e placar calculado no servidor.
-- Requer Anonymous Sign-ins habilitado em Supabase Auth.
create table if not exists public.player_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 32),
  phone text not null check (phone ~ '^[0-9]{10,13}$'),
  wins integer not null default 0 check (wins >= 0),
  losses integer not null default 0 check (losses >= 0),
  draws integer not null default 0 check (draws >= 0),
  games integer not null default 0 check (games >= 0),
  xp integer not null default 0 check (xp >= 0),
  created_at timestamptz not null default now()
);
alter table public.player_profiles enable row level security;
create policy "players read own profile" on public.player_profiles for select to authenticated using (id = auth.uid());
create policy "players create own profile" on public.player_profiles for insert to authenticated with check (id = auth.uid());
create policy "players edit own identity" on public.player_profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.player_profiles from authenticated;
grant select, insert on public.player_profiles to authenticated;
grant update (display_name, phone) on public.player_profiles to authenticated;

create table if not exists public.chess_match_awards (
  game_id uuid not null references public.games(id) on delete cascade,
  player_id uuid not null references auth.users(id) on delete cascade,
  primary key (game_id, player_id)
);
alter table public.chess_match_awards enable row level security;
revoke all on public.chess_match_awards from anon, authenticated;

create or replace function public.chess_leaderboard()
returns table(id uuid, display_name text, wins integer, losses integer, draws integer, games integer, xp integer)
language sql stable security definer set search_path = ''
as $$
  select p.id, p.display_name, p.wins, p.losses, p.draws, p.games, p.xp
  from public.player_profiles p
  where p.games > 0
  order by p.xp desc, p.wins desc, p.games asc, p.created_at asc
  limit 100;
$$;

create or replace function public.submit_chess_result(p_game_id uuid, p_token text)
returns boolean language plpgsql security definer set search_path = ''
as $$
declare
  g record;
  side text;
  winner text;
  outcome text;
begin
  if auth.uid() is null then raise exception 'login required'; end if;
  select white_token, black_token, state into g from public.games where id = p_game_id;
  if not found then raise exception 'game not found'; end if;
  if p_token = g.white_token then side := 'w';
  elsif p_token = g.black_token then side := 'b';
  else raise exception 'not a participant'; end if;
  winner := g.state->>'winner';
  outcome := g.state->>'result';
  if (winner is null or winner not in ('w','b')) and (outcome is null or outcome = '') then
    raise exception 'game not finished';
  end if;
  insert into public.chess_match_awards(game_id, player_id) values (p_game_id, auth.uid())
  on conflict do nothing;
  if not found then return false; end if;
  update public.player_profiles set
    games = games + 1,
    wins = wins + case when winner = side then 1 else 0 end,
    losses = losses + case when winner is not null and winner <> side then 1 else 0 end,
    draws = draws + case when winner is null then 1 else 0 end,
    xp = xp + case when winner = side then 100 when winner is null then 50 else 25 end
  where id = auth.uid();
  if not found then raise exception 'player profile missing'; end if;
  return true;
end;
$$;
revoke all on function public.chess_leaderboard() from public;
revoke all on function public.submit_chess_result(uuid,text) from public;
grant execute on function public.chess_leaderboard() to authenticated;
grant execute on function public.submit_chess_result(uuid,text) to authenticated;
