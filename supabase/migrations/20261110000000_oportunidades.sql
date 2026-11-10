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
  add column if not exists ia_auto_max_dia smallint not null default 5;               -- análises automáticas/dia

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
