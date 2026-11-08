-- Taxas fixas informadas pelo site (Loop: administração, estadia, transporte…)
alter table lotes add column taxas_site numeric(10,2);

-- Fila de alertas: o robô marca o que precisa ser avisado, o envio no Telegram (fase 3) consome.
create type alerta_pendente as enum ('novo', 'lance');
alter table lotes
  add column alerta_pendente alerta_pendente,
  add column lance_anterior numeric(12,2);
