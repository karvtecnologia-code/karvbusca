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
