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
