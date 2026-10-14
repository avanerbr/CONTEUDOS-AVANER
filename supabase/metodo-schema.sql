-- Central de Conteúdos AVANER — Método AVANER · estrutura do banco (versão 2)
-- Rode no SQL Editor do Supabase. Depois rode supabase/metodo-regras.sql.
--
-- O que este arquivo faz:
--   * cria as tabelas novas, todas com prefixo metodo_;
--   * só deixa ler e gravar quem está logado E tem o e-mail em metodo_membros;
--   * aplica no próprio banco as regras de bloqueio (não depende do navegador):
--       - peça com pendência de BLOQUEIO aberta não avança para aprovado, gravado, editado nem publicado;
--       - peça com pendência de PUBLICAÇÃO aberta não é marcada como publicada;
--       - etapas só valem em ordem (não existe publicado sem editado, etc.);
--       - só quem é aprovador (pode_aprovar) libera pendência e autoriza versão segura;
--       - liberar pendência exige registro escrito;
--       - tema do banco editorial (sem roteiro) não entra em produção;
--   * registra quem alterou e quando (preenchido pelo banco, não pela página);
--   * ninguém apaga linhas pela página.
--
-- O que este arquivo NÃO faz: não apaga tabela, linha nem política existente e não mexe nas tabelas Yamaha.
-- Pode rodar mais de uma vez.

-- 1. Equipe ----------------------------------------------------------------------
create table if not exists public.metodo_membros (
  email text primary key check (email = lower(email)),
  nome text,
  criado_em timestamptz not null default now()
);
alter table public.metodo_membros add column if not exists pode_aprovar boolean not null default false;
alter table public.metodo_membros enable row level security;
revoke all on table public.metodo_membros from anon, authenticated;
-- Sem políticas: só o SQL Editor altera esta lista.

create or replace function public.metodo_is_membro()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.metodo_membros m where m.email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
create or replace function public.metodo_pode_aprovar()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.metodo_membros m where m.email = lower(coalesce(auth.jwt() ->> 'email', '')) and m.pode_aprovar);
$$;
revoke all on function public.metodo_is_membro() from public, anon;
revoke all on function public.metodo_pode_aprovar() from public, anon;
grant execute on function public.metodo_is_membro() to authenticated;
grant execute on function public.metodo_pode_aprovar() to authenticated;

-- 2. Regras (preenchidas por supabase/metodo-regras.sql) -----------------------------
create table if not exists public.metodo_itens (
  item_id text primary key check (item_id ~ '^(M|AN)[0-9]{2}$'),
  tem_versao_segura boolean not null default false,
  versao_regras text not null,
  ativo boolean not null default true
);
create table if not exists public.metodo_pendencias_def (
  id text primary key check (id ~ '^[A-Z][0-9]$'),
  severidade text not null check (severidade in ('bloqueio','publicacao','atencao')),
  assunto text not null,
  versao_regras text not null,
  ativo boolean not null default true
);
create table if not exists public.metodo_dependencias (
  item_id text not null references public.metodo_itens(item_id),
  dep_id text not null references public.metodo_pendencias_def(id),
  dispensavel_versao_segura boolean not null default false,
  versao_regras text not null,
  ativo boolean not null default true,
  primary key (item_id, dep_id)
);

-- 3. Status ------------------------------------------------------------------------
create table if not exists public.metodo_execucao (
  item_id text primary key check (item_id ~ '^(M|AN|B)[0-9]{2}$'),
  aprovado boolean not null default false,
  aprovado_em date,
  gravado boolean not null default false,
  gravado_em date,
  editado boolean not null default false,
  editado_em date,
  publicado boolean not null default false,
  publicado_em date,
  versao_gravada text,
  gancho_usado text check (gancho_usado in ('A','B')),
  gancho_escolhido text check (gancho_escolhido in ('A','B')),
  versao_segura boolean not null default false,
  notas text check (char_length(notas) <= 4000),
  updated_at timestamptz not null default now(),
  updated_by text
);
create table if not exists public.metodo_pendencias (
  id text primary key check (id ~ '^[A-Z][0-9]$'),
  status text not null default 'ABERTA' check (status in ('ABERTA','LIBERADA')),
  obs text check (char_length(obs) <= 4000),
  updated_at timestamptz not null default now(),
  updated_by text
);
create table if not exists public.metodo_resultados (
  item_id text primary key check (item_id ~ '^(M|AN)[0-9]{2}$' or item_id = 'FUNIL'),
  dados jsonb not null default '{}'::jsonb check (jsonb_typeof(dados) = 'object' and pg_column_size(dados) <= 8000),
  updated_at timestamptz not null default now(),
  updated_by text
);

-- 4. Carimbo: quem alterou e quando ---------------------------------------------------
create or replace function public.metodo_carimbo()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at := clock_timestamp();
  new.updated_by := lower(coalesce(auth.jwt() ->> 'email', 'sql-editor'));
  return new;
end;
$$;

-- 5. Regras de bloqueio no banco ---------------------------------------------------------
create or replace function public.metodo_valida_execucao()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_seg boolean;
  v_bloq text;
  v_pub text;
  o_apr boolean := false; o_gra boolean := false; o_edi boolean := false; o_pub boolean := false; o_seg boolean := false;
begin
  if not metodo_is_membro() then
    raise exception using errcode = '42501', message = 'METODO: acesso negado.';
  end if;
  if not exists (select 1 from metodo_itens where ativo) then
    raise exception using errcode = 'P0001', message = 'METODO: as regras de bloqueio não estão instaladas no banco. Rode supabase/metodo-regras.sql.';
  end if;
  select tem_versao_segura into v_seg from metodo_itens where item_id = new.item_id and ativo;
  if not found then
    raise exception using errcode = 'P0001', message = format('METODO: %s não está no catálogo de produção (tema do banco editorial ou peça desconhecida).', new.item_id);
  end if;
  if tg_op = 'UPDATE' then
    o_apr := old.aprovado; o_gra := old.gravado; o_edi := old.editado; o_pub := old.publicado; o_seg := old.versao_segura;
  end if;

  if (new.publicado and not new.editado) or (new.editado and not new.gravado) or (new.gravado and not new.aprovado) then
    raise exception using errcode = 'P0001', message = format('METODO: etapas fora de ordem em %s.', new.item_id);
  end if;

  if new.versao_segura and not o_seg then
    if not v_seg then
      raise exception using errcode = 'P0001', message = format('METODO: %s não tem versão segura.', new.item_id);
    end if;
    if not metodo_pode_aprovar() then
      raise exception using errcode = 'P0001', message = 'METODO: só o aprovador autoriza a versão segura.';
    end if;
  end if;

  select string_agg(d.dep_id, ', ' order by d.dep_id) into v_bloq
    from metodo_dependencias d
    join metodo_pendencias_def f on f.id = d.dep_id
    left join metodo_pendencias p on p.id = d.dep_id
   where d.item_id = new.item_id and d.ativo and f.severidade = 'bloqueio'
     and coalesce(p.status, 'ABERTA') <> 'LIBERADA'
     and not (d.dispensavel_versao_segura and new.versao_segura);
  select string_agg(d.dep_id, ', ' order by d.dep_id) into v_pub
    from metodo_dependencias d
    join metodo_pendencias_def f on f.id = d.dep_id
    left join metodo_pendencias p on p.id = d.dep_id
   where d.item_id = new.item_id and d.ativo and f.severidade = 'publicacao'
     and coalesce(p.status, 'ABERTA') <> 'LIBERADA';

  if v_bloq is not null and ((new.aprovado and not o_apr) or (new.gravado and not o_gra) or (new.editado and not o_edi) or (new.publicado and not o_pub)) then
    raise exception using errcode = 'P0001', message = format('METODO: %s está bloqueada por %s.', new.item_id, v_bloq);
  end if;
  if new.publicado and not o_pub and (v_bloq is not null or v_pub is not null) then
    raise exception using errcode = 'P0001', message = format('METODO: publicação de %s travada por %s.', new.item_id, concat_ws(', ', v_bloq, v_pub));
  end if;
  return new;
end;
$$;

create or replace function public.metodo_valida_pendencia()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not metodo_is_membro() then
    raise exception using errcode = '42501', message = 'METODO: acesso negado.';
  end if;
  if not exists (select 1 from metodo_pendencias_def where id = new.id and ativo) then
    raise exception using errcode = 'P0001', message = format('METODO: pendência %s desconhecida. Rode supabase/metodo-regras.sql.', new.id);
  end if;
  if new.status = 'LIBERADA' and (tg_op = 'INSERT' or old.status <> 'LIBERADA') then
    if not metodo_pode_aprovar() then
      raise exception using errcode = 'P0001', message = 'METODO: só o aprovador libera pendências.';
    end if;
    if coalesce(btrim(new.obs), '') = '' then
      raise exception using errcode = 'P0001', message = 'METODO: para liberar, registre o que foi confirmado, por quem e quando.';
    end if;
  end if;
  if tg_op = 'UPDATE' and old.status = 'LIBERADA' and new.status = 'LIBERADA' and new.obs is distinct from old.obs and not metodo_pode_aprovar() then
    raise exception using errcode = 'P0001', message = 'METODO: só o aprovador altera o registro de uma pendência liberada.';
  end if;
  return new;
end;
$$;

drop trigger if exists metodo_execucao_carimbo on public.metodo_execucao;
create trigger metodo_execucao_carimbo before insert or update on public.metodo_execucao
  for each row execute function public.metodo_carimbo();
drop trigger if exists metodo_execucao_valida on public.metodo_execucao;
create trigger metodo_execucao_valida before insert or update on public.metodo_execucao
  for each row execute function public.metodo_valida_execucao();
drop trigger if exists metodo_pendencias_carimbo on public.metodo_pendencias;
create trigger metodo_pendencias_carimbo before insert or update on public.metodo_pendencias
  for each row execute function public.metodo_carimbo();
drop trigger if exists metodo_pendencias_valida on public.metodo_pendencias;
create trigger metodo_pendencias_valida before insert or update on public.metodo_pendencias
  for each row execute function public.metodo_valida_pendencia();
drop trigger if exists metodo_resultados_carimbo on public.metodo_resultados;
create trigger metodo_resultados_carimbo before insert or update on public.metodo_resultados
  for each row execute function public.metodo_carimbo();
-- "drop trigger if exists" só recria os gatilhos deste próprio arquivo. Não toca em dados.

-- 6. Permissões -----------------------------------------------------------------------
revoke all on table public.metodo_execucao, public.metodo_pendencias, public.metodo_resultados,
  public.metodo_itens, public.metodo_pendencias_def, public.metodo_dependencias from anon;
revoke insert, update, delete, truncate on table public.metodo_itens, public.metodo_pendencias_def, public.metodo_dependencias from authenticated;
revoke delete, truncate on table public.metodo_execucao, public.metodo_pendencias, public.metodo_resultados from authenticated;
grant select on table public.metodo_itens, public.metodo_pendencias_def, public.metodo_dependencias to authenticated;
grant select, insert, update on table public.metodo_execucao, public.metodo_pendencias, public.metodo_resultados to authenticated;

alter table public.metodo_execucao enable row level security;
alter table public.metodo_pendencias enable row level security;
alter table public.metodo_resultados enable row level security;
alter table public.metodo_itens enable row level security;
alter table public.metodo_pendencias_def enable row level security;
alter table public.metodo_dependencias enable row level security;

do $$
declare t text;
begin
  foreach t in array array['metodo_execucao','metodo_pendencias','metodo_resultados'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_membros_leitura') then
      execute format('create policy %I on public.%I for select to authenticated using (public.metodo_is_membro())', t || '_membros_leitura', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_membros_insercao') then
      execute format('create policy %I on public.%I for insert to authenticated with check (public.metodo_is_membro())', t || '_membros_insercao', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_membros_atualizacao') then
      execute format('create policy %I on public.%I for update to authenticated using (public.metodo_is_membro()) with check (public.metodo_is_membro())', t || '_membros_atualizacao', t);
    end if;
  end loop;
  foreach t in array array['metodo_itens','metodo_pendencias_def','metodo_dependencias'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_membros_leitura') then
      execute format('create policy %I on public.%I for select to authenticated using (public.metodo_is_membro())', t || '_membros_leitura', t);
    end if;
  end loop;
end $$;

-- 7. Tempo real (só adiciona se ainda não estiver na publicação) ----------------------------
do $$
declare t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['metodo_execucao','metodo_pendencias','metodo_resultados'] loop
      if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end $$;

-- 8. Liberar a equipe ---------------------------------------------------------------------
-- Crie cada pessoa em Authentication > Users > Add user (e-mail + senha, "Auto Confirm User" marcado).
-- Depois troque os e-mails, tire os dois traços do início e rode só estas linhas.
-- pode_aprovar = true: libera pendências e autoriza versão segura. Recomendado: só o Michael.
-- insert into public.metodo_membros (email, nome, pode_aprovar) values
--   ('email-do-michael@exemplo.com', 'Michael', true),
--   ('email-da-jamille@exemplo.com', 'Jamille', false),
--   ('email-do-guilherme@exemplo.com', 'Guilherme', false)
-- on conflict (email) do update set nome = excluded.nome, pode_aprovar = excluded.pode_aprovar;

-- 9. Conferência (só leitura) -----------------------------------------------------------------
-- select tablename, policyname, cmd from pg_policies where tablename like 'metodo_%' order by 1, 2;   -- 12 políticas
-- select email, nome, pode_aprovar from public.metodo_membros;
-- select count(*) filter (where ativo) as pecas, max(versao_regras) from public.metodo_itens;          -- 44 peças
