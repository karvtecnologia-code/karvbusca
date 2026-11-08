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
