-- ######################################################################
-- NÃO RODE NESTA ETAPA. A decisão desta implantação é preservar as tabelas
-- e o histórico Yamaha sem nenhuma alteração. Este arquivo fica guardado
-- para quando você decidir fechar a escrita pública das tabelas antigas.
-- ######################################################################
--
-- OPCIONAL — Fechar a escrita pública nas tabelas antigas (campanhas Yamaha)
--
-- Situação hoje (supabase/schema.sql antigo): as tabelas g11_execucao, g11_pendencias,
-- g20004_execucao e g20004_pendencias aceitam leitura, inserção e alteração de QUALQUER pessoa
-- que tenha a chave pública da página (ela fica visível no supabase-config.js, como toda chave pública).
-- Ou seja: qualquer um pode alterar o status dessas campanhas sem login.
--
-- O que este arquivo faz:
--   * mantém a LEITURA pública (a página campanhas-yamaha.html continua mostrando todo o histórico);
--   * remove a inserção e a alteração públicas;
--   * permite inserir e alterar só para membros logados (mesma lista metodo_membros).
--
-- Efeito colateral: a página campanhas-yamaha.html não tem login. Depois deste arquivo, ela vira
-- SOMENTE LEITURA: os botões continuam lá, mas o banco recusa a gravação (fica só no navegador).
-- Por isso rode só quando ninguém mais precisar marcar status nas campanhas Yamaha.
--
-- Não apaga tabela nem linha. Remove apenas as 4 políticas de escrita aberta, pelo nome.
-- Pré-requisito: ter rodado supabase/metodo-schema.sql (usa a função metodo_is_membro).
-- IMPORTANTE: depois disto, não rode de novo o supabase/schema.sql antigo, porque ele recria as políticas abertas.

-- 0. Conferência antes (só leitura): veja todas as políticas do esquema público.
-- select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname = 'public' order by 1, 2;

begin;

drop policy if exists "g11 exec insercao" on public.g11_execucao;
drop policy if exists "g11 exec atualizacao" on public.g11_execucao;
drop policy if exists "g11 pend insercao" on public.g11_pendencias;
drop policy if exists "g11 pend atualizacao" on public.g11_pendencias;
drop policy if exists "g20004 exec insercao" on public.g20004_execucao;
drop policy if exists "g20004 exec atualizacao" on public.g20004_execucao;
drop policy if exists "g20004 pend insercao" on public.g20004_pendencias;
drop policy if exists "g20004 pend atualizacao" on public.g20004_pendencias;

do $$
declare t text;
begin
  foreach t in array array['g11_execucao','g11_pendencias','g20004_execucao','g20004_pendencias'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_membros_insercao') then
      execute format('create policy %I on public.%I for insert to authenticated with check (public.metodo_is_membro())', t || '_membros_insercao', t);
    end if;
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_membros_atualizacao') then
      execute format('create policy %I on public.%I for update to authenticated using (public.metodo_is_membro()) with check (public.metodo_is_membro())', t || '_membros_atualizacao', t);
    end if;
  end loop;
end $$;

commit;

-- Tabela "execucao" (Código Vermelho original): não está neste arquivo porque não sei quais
-- políticas ela tem hoje. Rode a consulta do passo 0 e, se aparecer insert/update com qual = true
-- para o papel public/anon, me mande o resultado para eu preparar o comando específico.

-- Para desfazer (volta a escrita aberta, como era antes):
-- create policy "g11 exec insercao" on public.g11_execucao for insert with check (true);
-- create policy "g11 exec atualizacao" on public.g11_execucao for update using (true);
-- create policy "g11 pend insercao" on public.g11_pendencias for insert with check (true);
-- create policy "g11 pend atualizacao" on public.g11_pendencias for update using (true);
-- create policy "g20004 exec insercao" on public.g20004_execucao for insert with check (true);
-- create policy "g20004 exec atualizacao" on public.g20004_execucao for update using (true);
-- create policy "g20004 pend insercao" on public.g20004_pendencias for insert with check (true);
-- create policy "g20004 pend atualizacao" on public.g20004_pendencias for update using (true);
