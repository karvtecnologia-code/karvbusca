-- IA por lote, cofre de logins (Supabase Vault) e extras (resumo diário, favorito sumiu).

-- ---------- novos tipos de alerta ----------
alter type alerta_tipo add value if not exists 'sumiu';
alter type alerta_tipo add value if not exists 'resumo';

-- ---------- IA: configuração (a chave fica no Vault, nunca em texto puro) ----------
alter table config
  add column if not exists ia_base_url text not null default 'https://generativelanguage.googleapis.com/v1beta/openai/',
  add column if not exists ia_modelo text not null default 'gemini-2.5-flash',
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
