insert into sites (slug, nome, url) values
  ('vip',     'VIP Leilões',       'https://www.vipleiloes.com.br/'),
  ('sodre',   'Sodré Santoro',     'https://www.sodresantoro.com.br/'),
  ('sold',    'Sold (Superbid)',   'https://www.sold.com.br/'),
  ('freitas', 'Freitas Leiloeiro', 'https://www.freitasleiloeiro.com.br/'),
  ('loop',    'Loop Leilões',      'https://loopleiloes.com.br/')
on conflict (slug) do nothing;

insert into termos_busca (termo, apelidos, tipo) values
  ('hrv',       '{hr-v,"hr v"}', 'carro'),
  ('asx',       '{}',            'carro'),
  ('outlander', '{}',            'carro'),
  ('bros',      '{}',            'moto')
on conflict (termo) do nothing;

insert into config (id) values (true) on conflict (id) do nothing;
