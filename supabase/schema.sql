-- =====================================================================
-- KarvBusca — schema completo do banco (Supabase / Postgres 15+)
-- Instalação do zero: Supabase > SQL Editor > cole TUDO > Run.
-- Antes de rodar, troque SEU-PROJETO (seção "Lembretes") pelo ref do
-- seu projeto Supabase (ex.: abcdefghijklmnopqrst).
-- =====================================================================


-- ---------------------------------------------------------------- 20261108000000_init
-- KarvBusca: schema inicial
-- Painel: usuário logado (role authenticated). Robô/webhook: service_role (ignora RLS).
-- Cadastro público desativado no Supabase: só existe o seu usuário.

create extension if not exists pgcrypto;

-- ---------- tipos ----------
create type tipo_veiculo as enum ('carro', 'moto');
create type condicao_monta as enum ('sem_monta', 'pequena', 'media', 'grande', 'sucata', 'nao_informado');
create type roda_status as enum ('sim', 'nao', 'nao_informado');
create type decisao_tipo as enum ('gostei', 'descartado');
create type alerta_tipo as enum ('novo', 'lance', 'lembrete_24h', 'lembrete_2h', 'robo_falhou');

-- ---------- sites ----------
create table sites (
  id smallint generated always as identity primary key,
  slug text not null unique,
  nome text not null,
  url text not null,
  ativo boolean not null default true,
  comissao_pct numeric(5,2) not null default 5,
  taxa_adm numeric(10,2) not null default 0,
  ultima_execucao timestamptz,
  status text not null default 'nunca_rodou',  -- ok | erro | vazio | nunca_rodou
  falhas_seguidas smallint not null default 0
);

-- ---------- termos_busca ----------
create table termos_busca (
  id uuid primary key default gen_random_uuid(),
  termo text not null unique,
  apelidos text[] not null default '{}',
  tipo tipo_veiculo,
  ano_min smallint,
  ano_max smallint,
  lance_max numeric(12,2),
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  check (ano_min is null or ano_max is null or ano_min <= ano_max)
);

-- ---------- lotes ----------
create table lotes (
  id uuid primary key default gen_random_uuid(),
  site_id smallint not null references sites(id),
  id_externo text not null,
  url text not null,
  titulo text not null,
  tipo tipo_veiculo,
  marca text,
  modelo text,
  versao text,
  descricao text,
  ano_fab smallint,
  ano_mod smallint,
  km integer,
  uf char(2),
  cidade text,
  condicao_monta condicao_monta not null default 'nao_informado',
  roda roda_status not null default 'nao_informado',
  combustivel text,
  lance_atual numeric(12,2),
  lance_inicial numeric(12,2),
  avaliacao numeric(12,2),
  inicio_em timestamptz,
  fim_em timestamptz,
  status text,
  fotos text[] not null default '{}',
  fipe_codigo text,
  fipe_valor numeric(12,2),
  fipe_atualizado_em timestamptz,
  fipe_aproximada boolean not null default false,
  custo_patio numeric(10,2),        -- sobrescreve o padrão de config
  custo_doc numeric(10,2),          -- sobrescreve o padrão de config
  custo_frete numeric(10,2),        -- sobrescreve o cálculo
  raw jsonb,
  visto_primeiro_em timestamptz not null default now(),
  visto_ultimo_em timestamptz not null default now(),
  unique (site_id, id_externo)
);
create index lotes_fim_em_idx on lotes (fim_em);
create index lotes_uf_idx on lotes (uf);

-- ---------- lotes_historico ----------
create table lotes_historico (
  id bigint generated always as identity primary key,
  lote_id uuid not null references lotes(id) on delete cascade,
  capturado_em timestamptz not null default now(),
  lance_atual numeric(12,2),
  status text,
  fim_em timestamptz
);
create index lotes_historico_lote_idx on lotes_historico (lote_id, capturado_em);

-- ---------- lote_termos ----------
create table lote_termos (
  lote_id uuid not null references lotes(id) on delete cascade,
  termo_id uuid not null references termos_busca(id) on delete cascade,
  primary key (lote_id, termo_id)
);

-- ---------- decisoes (por site + id_externo, sobrevive a mudança de título) ----------
create table decisoes (
  site_id smallint not null references sites(id),
  id_externo text not null,
  decisao decisao_tipo not null,
  decidido_em timestamptz not null default now(),
  nota text,
  primary key (site_id, id_externo)
);

-- ---------- alertas_enviados ----------
create table alertas_enviados (
  id bigint generated always as identity primary key,
  lote_id uuid references lotes(id) on delete cascade,
  site_id smallint references sites(id),
  tipo alerta_tipo not null,
  enviado_em timestamptz not null default now(),
  telegram_msg_id bigint
);
-- um alerta "novo"/"lembrete" por lote
create unique index alertas_unicos_idx on alertas_enviados (lote_id, tipo)
  where tipo in ('novo', 'lembrete_24h', 'lembrete_2h');

-- ---------- execucoes_robo ----------
create table execucoes_robo (
  id bigint generated always as identity primary key,
  site_id smallint not null references sites(id),
  modo text not null default 'completo',   -- completo | favoritos
  inicio timestamptz not null default now(),
  fim timestamptz,
  encontrados integer not null default 0,
  novos integer not null default 0,
  atualizados integer not null default 0,
  erro text,
  log text
);
create index execucoes_robo_site_idx on execucoes_robo (site_id, inicio desc);

-- ---------- config (linha única) ----------
create table config (
  id boolean primary key default true check (id),
  chat_id_telegram bigint,
  frete_por_km numeric(8,2),
  frete_fixo numeric(10,2),
  origem text not null default 'Passos-MG',
  origem_lat numeric(9,6) not null default -20.718800,
  origem_lon numeric(9,6) not null default -46.609800,
  custo_doc_padrao numeric(10,2) not null default 1000,
  custo_patio_padrao numeric(10,2) not null default 300
);

-- ---------- RLS ----------
do $$
declare t text;
begin
  foreach t in array array['sites','termos_busca','lotes','lotes_historico','lote_termos',
                           'decisoes','alertas_enviados','execucoes_robo','config']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy "logado le" on %I for select to authenticated using (true)', t);
  end loop;
end $$;

-- o painel também edita estas:
create policy "logado edita termos" on termos_busca for all to authenticated using (true) with check (true);
create policy "logado edita decisoes" on decisoes for all to authenticated using (true) with check (true);
create policy "logado edita config" on config for update to authenticated using (true) with check (true);
create policy "logado edita sites" on sites for update to authenticated using (true) with check (true);
create policy "logado edita custos do lote" on lotes for update to authenticated using (true) with check (true);

-- ---------- Storage: fotos ----------
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------- 20261108000001_seed
insert into sites (slug, nome, url) values
  ('vip',     'VIP Leilões',       'https://www.vipleiloes.com.br/'),
  ('sodre',   'Sodré Santoro',     'https://www.sodresantoro.com.br/'),
  ('sold',    'Sold (Superbid)',   'https://www.sold.com.br/'),
  ('freitas', 'Freitas Leiloeiro', 'https://www.freitasleiloeiro.com.br/'),
  ('loop',    'Loop Leilões',      'https://loopleiloes.com.br/'),
  ('copart',  'Copart',            'https://www.copart.com.br/'),
  ('pestana', 'Pestana Leilões',   'https://www.pestanaleiloes.com.br/'),
  ('mega',    'Mega Leilões',      'https://www.megaleiloes.com.br/')
on conflict (slug) do nothing;

insert into termos_busca (termo, apelidos, tipo) values
  ('hrv',       '{hr-v,"hr v"}', 'carro'),
  ('asx',       '{}',            'carro'),
  ('outlander', '{}',            'carro'),
  ('bros',      '{}',            'moto')
on conflict (termo) do nothing;

insert into config (id) values (true) on conflict (id) do nothing;

-- ---------------------------------------------------------------- 20261108000002_condicao_detalhada
-- Campos extras de condição, para filtrar carros que podem rodar.

create type circulacao_status as enum ('liberada', 'vedada', 'nao_informado');
create type sim_nao as enum ('sim', 'nao', 'nao_informado');
create type procedencia_tipo as enum (
  'financiamento', 'seguradora', 'patrimonio', 'judicial', 'apreensao', 'frota', 'particular', 'nao_informado'
);

alter table lotes
  add column circulacao circulacao_status not null default 'nao_informado',
  add column chave sim_nao not null default 'nao_informado',
  add column dano_estrutural boolean not null default false,
  add column dano_detalhe text[] not null default '{}',
  add column procedencia procedencia_tipo not null default 'nao_informado',
  add column financiavel boolean,
  add column ipva_pago boolean,
  add column fipe_site numeric(12,2),   -- valor FIPE informado pelo próprio site (Loop)
  add column observacoes text,          -- observações do site (texto original)
  add column apto_rodar boolean not null default false;

create index lotes_apto_idx on lotes (apto_rodar) where apto_rodar;

comment on column lotes.apto_rodar is
  'Calculado pelo robô: não é sucata nem grande monta, roda <> nao, circulação <> vedada e sem dano estrutural.';

-- ---------------------------------------------------------------- 20261108000003_taxas_alerta
-- Taxas fixas informadas pelo site (Loop: administração, estadia, transporte…)
alter table lotes add column taxas_site numeric(10,2);

-- Fila de alertas: o robô marca o que precisa ser avisado, o envio no Telegram (fase 3) consome.
create type alerta_pendente as enum ('novo', 'lance');
alter table lotes
  add column alerta_pendente alerta_pendente,
  add column lance_anterior numeric(12,2);

-- ---------------------------------------------------------------- 20261109000000_painel
-- View usada pelo painel: lote + site + decisão + termos que casaram.
-- security_invoker = respeita o RLS de quem consulta (usuário logado).
create or replace view lotes_painel with (security_invoker = true) as
select
  l.*,
  s.slug as site_slug,
  s.nome as site_nome,
  s.comissao_pct,
  s.taxa_adm,
  d.decisao,
  d.nota,
  d.decidido_em,
  coalesce((select array_agg(lt.termo_id) from lote_termos lt where lt.lote_id = l.id), '{}') as termos
from lotes l
join sites s on s.id = l.site_id
left join decisoes d on d.site_id = l.site_id and d.id_externo = l.id_externo;

grant select on lotes_painel to authenticated;

-- o painel pode inserir/atualizar a config padrão de custos
alter table config add column if not exists frete_padrao numeric(10,2);

-- ---------------------------------------------------------------- 20261109000001_lembretes_cron
-- Lembretes de 24h e 2h: o pg_cron chama a Edge Function "lembretes" a cada 15 min.
-- A função é idempotente e não devolve dados, então não precisa de chave aqui.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('karvbusca-lembretes')
where exists (select 1 from cron.job where jobname = 'karvbusca-lembretes');

select cron.schedule(
  'karvbusca-lembretes',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://SEU-PROJETO.supabase.co/functions/v1/lembretes',
    headers := '{"content-type": "application/json"}'::jsonb,
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $$
);

-- ---------------------------------------------------------------- 20261109000002_ia_cofre
-- IA por lote, cofre de logins (Supabase Vault) e extras (resumo diário, favorito sumiu).

-- ---------- novos tipos de alerta ----------
alter type alerta_tipo add value if not exists 'sumiu';
alter type alerta_tipo add value if not exists 'resumo';

-- ---------- IA: configuração (a chave fica no Vault, nunca em texto puro) ----------
alter table config
  add column if not exists ia_base_url text not null default 'https://generativelanguage.googleapis.com/v1beta/openai/',
  add column if not exists ia_modelo text not null default 'gemini-flash-latest',
  add column if not exists ia_secret_id uuid;

-- análise gerada para um lote
create table if not exists lote_ia (
  lote_id uuid primary key references lotes(id) on delete cascade,
  analise jsonb not null,
  modelo text,
  gerado_em timestamptz not null default now()
);
-- conversa aberta sobre o lote
create table if not exists lote_ia_mensagens (
  id bigint generated always as identity primary key,
  lote_id uuid not null references lotes(id) on delete cascade,
  papel text not null check (papel in ('user', 'assistant')),
  texto text not null,
  criado_em timestamptz not null default now()
);
create index if not exists lote_ia_mensagens_lote_idx on lote_ia_mensagens (lote_id, criado_em);

alter table lote_ia enable row level security;
alter table lote_ia_mensagens enable row level security;
create policy "logado tudo" on lote_ia for all to authenticated using (true) with check (true);
create policy "logado tudo" on lote_ia_mensagens for all to authenticated using (true) with check (true);

-- ---------- cofre de logins dos sites ----------
create table if not exists credenciais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,                 -- ex.: "VIP Leilões"
  site_slug text references sites(slug),
  usuario text,
  secret_id uuid,                     -- senha no Vault
  observacao text,
  atualizado_em timestamptz not null default now()
);
alter table credenciais enable row level security;
create policy "logado tudo" on credenciais for all to authenticated using (true) with check (true);

-- Funções SECURITY DEFINER: o painel nunca lê vault.* direto.
-- Só usuários logados (authenticated) podem chamar; o cadastro público está desligado.

create or replace function cofre_salvar(p_id uuid, p_nome text, p_site text, p_usuario text, p_senha text, p_obs text)
returns uuid language plpgsql security definer set search_path = public, vault as $$
declare v_id uuid := p_id; v_secret uuid;
begin
  if auth.role() <> 'authenticated' then raise exception 'sem permissão'; end if;
  if v_id is null then
    insert into credenciais (nome, site_slug, usuario, observacao)
    values (p_nome, nullif(p_site, ''), p_usuario, p_obs) returning id into v_id;
  else
    update credenciais set nome = p_nome, site_slug = nullif(p_site, ''), usuario = p_usuario,
      observacao = p_obs, atualizado_em = now() where id = v_id;
  end if;
  -- senha vazia = mantém a atual
  if coalesce(p_senha, '') <> '' then
    select secret_id into v_secret from credenciais where id = v_id;
    if v_secret is null then
      v_secret := vault.create_secret(p_senha, 'cred_' || v_id::text, 'KarvBusca: login de site');
      update credenciais set secret_id = v_secret where id = v_id;
    else
      perform vault.update_secret(v_secret, p_senha);
    end if;
  end if;
  return v_id;
end $$;

create or replace function cofre_revelar(p_id uuid)
returns text language plpgsql security definer set search_path = public, vault as $$
declare v text;
begin
  if auth.role() <> 'authenticated' then raise exception 'sem permissão'; end if;
  select ds.decrypted_secret into v
  from credenciais c join vault.decrypted_secrets ds on ds.id = c.secret_id
  where c.id = p_id;
  return v;
end $$;

create or replace function cofre_remover(p_id uuid)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_secret uuid;
begin
  if auth.role() <> 'authenticated' then raise exception 'sem permissão'; end if;
  select secret_id into v_secret from credenciais where id = p_id;
  delete from credenciais where id = p_id;
  if v_secret is not null then delete from vault.secrets where id = v_secret; end if;
end $$;

-- chave da IA: o painel grava; só o servidor (service_role) lê
create or replace function ia_salvar_chave(p_chave text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v_secret uuid;
begin
  if auth.role() <> 'authenticated' then raise exception 'sem permissão'; end if;
  select ia_secret_id into v_secret from config where id;
  if v_secret is null then
    v_secret := vault.create_secret(p_chave, 'ia_chave', 'KarvBusca: chave da IA');
    update config set ia_secret_id = v_secret where id;
  else
    perform vault.update_secret(v_secret, p_chave);
  end if;
end $$;

create or replace function ia_chave()
returns text language sql security definer set search_path = public, vault as $$
  select ds.decrypted_secret from config c join vault.decrypted_secrets ds on ds.id = c.ia_secret_id where c.id;
$$;

revoke all on function cofre_salvar(uuid, text, text, text, text, text) from public, anon;
revoke all on function cofre_revelar(uuid) from public, anon;
revoke all on function cofre_remover(uuid) from public, anon;
revoke all on function ia_salvar_chave(text) from public, anon;
revoke all on function ia_chave() from public, anon, authenticated;
grant execute on function cofre_salvar(uuid, text, text, text, text, text) to authenticated;
grant execute on function cofre_revelar(uuid) to authenticated;
grant execute on function cofre_remover(uuid) to authenticated;
grant execute on function ia_salvar_chave(text) to authenticated;
grant execute on function ia_chave() to service_role;

-- ---------------------------------------------------------------- 20261110000000_oportunidades
-- Oportunidades: nota, distância até Passos, relistados, arremates, modo descoberta e IA automática.

alter table lotes
  add column if not exists nota smallint,                 -- nota de oportunidade 0–100
  add column if not exists nota_motivos text[] not null default '{}',
  add column if not exists distancia_km integer,           -- rota até a origem (Passos-MG)
  add column if not exists chave_veiculo text,            -- marca+modelo+ano+km: acha o mesmo carro relistado
  add column if not exists relistado_de uuid references lotes(id) on delete set null,
  add column if not exists lance_anterior_relist numeric(12,2),
  add column if not exists descoberta boolean not null default false,  -- achado fora dos termos
  add column if not exists lance_inicial_anterior numeric(12,2);       -- 2ª praça: lance mínimo caiu

create index if not exists lotes_chave_veiculo_idx on lotes (chave_veiculo);
create index if not exists lotes_nota_idx on lotes (nota desc);

-- cache de geolocalização e de distância por cidade (Nominatim + OSRM, gratuitos)
create table if not exists cidades_geo (
  chave text primary key,          -- "cidade|uf" normalizado
  lat numeric(9,6),
  lon numeric(9,6),
  distancia_km integer,            -- rota até a origem
  atualizado_em timestamptz not null default now()
);
alter table cidades_geo enable row level security;
create policy "logado le" on cidades_geo for select to authenticated using (true);

-- cache persistente da FIPE por modelo/ano (poupa o limite de 1000 consultas/dia)
create table if not exists fipe_cache (
  chave text primary key,          -- tipo|marca|modelo+versao|ano|combustivel normalizados
  codigo text,
  valor numeric(12,2),
  aproximada boolean,
  atualizado_em timestamptz not null default now()
);
alter table fipe_cache enable row level security;

-- novos alertas
alter type alerta_tipo add value if not exists 'relistado';
alter type alerta_tipo add value if not exists 'segunda_praca';
alter type alerta_pendente add value if not exists 'relistado';
alter type alerta_pendente add value if not exists 'segunda_praca';

-- configuração das novas funções
alter table config
  add column if not exists descoberta_ativa boolean not null default true,
  add column if not exists descoberta_pct_fipe numeric(4,2) not null default 0.65,  -- abaixo de 65% da FIPE
  add column if not exists descoberta_ano_min smallint not null default 2012,
  add column if not exists raio_max_km integer,                                      -- filtro padrão (null = sem limite)
  add column if not exists nota_alerta_quente smallint not null default 75,           -- 🔥 a partir desta nota
  add column if not exists ia_auto_max_dia smallint not null default 0;               -- análises automáticas/dia (0 = só quando você clica)

-- preço provável de arremate: último lance visto de lotes encerrados, em relação à FIPE
create or replace view arremates_modelo with (security_invoker = true) as
select
  lower(coalesce(marca, '')) || ' ' || lower(split_part(coalesce(modelo, titulo), ' ', 1)) as modelo_base,
  count(*) as amostras,
  percentile_cont(0.5) within group (order by lance_atual / nullif(coalesce(fipe_valor, fipe_site), 0)) as pct_fipe_mediana
from lotes
where fim_em < now() - interval '1 hour'
  and lance_atual > 0
  and coalesce(fipe_valor, fipe_site) > 0
  and status is distinct from 'retirado'
group by 1
having count(*) >= 2;

grant select on arremates_modelo to authenticated;

-- a view do painel: recriada porque lotes ganhou a coluna "nota" (oportunidade) e a nota
-- pessoal do favorito passa a se chamar "nota_pessoal" (não dá para renomear com replace)
drop view if exists lotes_painel;
create view lotes_painel with (security_invoker = true) as
select
  l.*,
  s.slug as site_slug,
  s.nome as site_nome,
  s.comissao_pct,
  s.taxa_adm,
  d.decisao,
  d.nota as nota_pessoal,
  d.decidido_em,
  coalesce((select array_agg(lt.termo_id) from lote_termos lt where lt.lote_id = l.id), '{}') as termos
from lotes l
join sites s on s.id = l.site_id
left join decisoes d on d.site_id = l.site_id and d.id_externo = l.id_externo;

grant select on lotes_painel to authenticated;

-- a Sold é uma loja do Superbid: o robô passa a buscar o Superbid inteiro
update sites set nome = 'Superbid (inclui Sold)' where slug = 'sold';

-- ---------------------------------------------------------------- 20261110000001_multiusuario
-- Instalação para qualquer pessoa: token do bot no painel, vários usuários/chats, estados e origem configuráveis.

-- ---------- estados monitorados e cidade de origem ----------
alter table config
  add column if not exists ufs text[] not null default '{SP,MG}',
  add column if not exists telegram_secret_id uuid,          -- token do bot no Vault
  add column if not exists webhook_secret_id uuid,           -- secret_token do webhook no Vault
  add column if not exists codigo_vinculo text not null default substr(md5(random()::text), 1, 6);

-- ---------- chats do Telegram que recebem os alertas ----------
create table if not exists telegram_chats (
  chat_id bigint primary key,
  nome text,
  vinculado_em timestamptz not null default now()
);
alter table telegram_chats enable row level security;
create policy "logado tudo" on telegram_chats for all to authenticated using (true) with check (true);

-- o chat que já estava ligado continua recebendo
insert into telegram_chats (chat_id, nome)
select chat_id_telegram, 'principal' from config where chat_id_telegram is not null
on conflict do nothing;

-- ---------- token do bot e secret do webhook (Vault) ----------
create or replace function telegram_salvar_token(p_token text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v uuid;
begin
  if auth.role() <> 'authenticated' then raise exception 'sem permissão'; end if;
  select telegram_secret_id into v from config where id;
  if v is null then
    v := vault.create_secret(p_token, 'telegram_token', 'KarvBusca: token do bot');
    update config set telegram_secret_id = v where id;
  else
    perform vault.update_secret(v, p_token);
  end if;
end $$;

create or replace function telegram_token()
returns text language sql security definer set search_path = public, vault as $$
  select ds.decrypted_secret from config c join vault.decrypted_secrets ds on ds.id = c.telegram_secret_id where c.id;
$$;

create or replace function telegram_salvar_webhook_secret(p_secret text)
returns void language plpgsql security definer set search_path = public, vault as $$
declare v uuid;
begin
  select webhook_secret_id into v from config where id;
  if v is null then
    v := vault.create_secret(p_secret, 'telegram_webhook_secret', 'KarvBusca: secret do webhook');
    update config set webhook_secret_id = v where id;
  else
    perform vault.update_secret(v, p_secret);
  end if;
end $$;

create or replace function telegram_webhook_secret()
returns text language sql security definer set search_path = public, vault as $$
  select ds.decrypted_secret from config c join vault.decrypted_secrets ds on ds.id = c.webhook_secret_id where c.id;
$$;

revoke all on function telegram_salvar_token(text) from public, anon;
revoke all on function telegram_token() from public, anon, authenticated;
revoke all on function telegram_salvar_webhook_secret(text) from public, anon, authenticated;
revoke all on function telegram_webhook_secret() from public, anon, authenticated;
grant execute on function telegram_salvar_token(text) to authenticated;
grant execute on function telegram_token() to service_role;
grant execute on function telegram_salvar_webhook_secret(text) to service_role;
grant execute on function telegram_webhook_secret() to service_role;
