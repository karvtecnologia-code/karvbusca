Você vai construir do zero o **KarvBusca**, um sistema pessoal que monitora sites de leilão de veículos e me avisa no Telegram. Leia tudo antes de começar. Trabalhe em fases, faça commits pequenos com mensagens claras e, no fim de cada fase, me mostre o que funciona e o que falta.

## 0. Antes de codar: ambiente e skills

1. Verifique e, se faltar, instale (me peça confirmação antes de instalar algo global):
   - Node.js 20 LTS ou superior e pnpm (`corepack enable`)
   - Git e GitHub CLI (`gh`), autenticado com `gh auth status`
   - Supabase CLI (`npx supabase --version` serve)
   - Vercel CLI (`pnpm dlx vercel --version`)
   - Navegadores do Playwright (`pnpm exec playwright install --with-deps chromium`, depois que o pacote existir)
2. Estou no Windows. Use comandos que funcionem no PowerShell e caminhos sem espaço.
3. Se estas skills estiverem instaladas, use-as: **design taste** e **emil** (Emil Kowalski) para a interface e as animações, **playwright** para os robôs e os testes de tela, e **graphify** para mapear o código depois da fase 2. Se alguma não existir, me avise e siga sem ela.
4. Nunca me peça para colar chaves no chat. Crie `.env.example` com todos os nomes de variável e me diga onde colocar os valores reais (`.env.local`, GitHub Secrets, Vercel).

## 1. O que o sistema faz

- Todo dia, um robô entra nestes 5 sites e coleta lotes de **carros e motos** localizados em **SP ou MG**:
  - https://www.vipleiloes.com.br/
  - https://www.sodresantoro.com.br/
  - https://www.sold.com.br/ (plataforma Superbid)
  - https://www.freitasleiloeiro.com.br/ (busca por URL: `/Leiloes/Pesquisar?Categoria=1&TipoLoteId=1` carros, `TipoLoteId=3` motos)
  - https://loopleiloes.com.br/ (Next.js, estoque em `/estoque`)
- Todos carregam os lotes por JavaScript, então use o **Playwright**. Prefira capturar as respostas JSON internas (`page.on('response')`) a ler HTML. A VIP restringe robôs no robots.txt e a Sodré recusou acesso automático: comporte-se como uso pessoal (um site por vez, pausa de 2 a 5 s entre páginas, user-agent de navegador comum, nada atrás de login).
- Eu cadastro os modelos no painel (ex.: `hrv`, `asx`, `outlander`, `bros`) e o robô acha todos os lotes com esses nomes nos 5 sites.
- Preferência: veículos que **rodam** e **sem monta**.
- Alerta no Telegram com **foto, dados e link** do lote.
- **Gostei** → o lote vira favorito e não recebe mais alerta de "lote novo". **Descartar** → o lote é ignorado para sempre (chave `site + id_externo`).

## 2. Arquitetura (já decidida)

| Peça | Tecnologia | Onde roda |
| --- | --- | --- |
| Painel web | Next.js (App Router) + TypeScript + Tailwind | Vercel, em `busca.karv.tec.br` |
| Login | Supabase Auth (e-mail e senha, só eu) | Supabase |
| Banco + fotos | Postgres + Storage | Supabase (região São Paulo) |
| Robô | Node + TypeScript + Playwright, um adaptador por site | GitHub Actions |
| Lembretes 24h/2h | `pg_cron` + Edge Function | Supabase |
| Bot | Telegram Bot API, webhook em `/api/telegram` | Vercel |

Monorepo com pnpm workspaces:

```
karvbusca/
  apps/web/            painel Next.js + webhook do Telegram
  packages/scraper/    robô Playwright
    src/adapters/      vip.ts, sodre.ts, sold.ts, freitas.ts, loop.ts
  packages/core/       tipos, normalização, matching, classificação de monta, FIPE, custo real
  supabase/            migrations, seed, functions
  .github/workflows/   scrape-full.yml, scrape-favorites.yml
```

Agendamentos (horário de Brasília; no GitHub o cron é em UTC, então converta):
- Busca completa nos 5 sites: 07:00, 12:00 e 18:00
- Checagem de lance só dos favoritos: a cada 2h, das 07:00 às 23:00
- Lembretes 24h e 2h antes do encerramento: `pg_cron` a cada 15 min
- Os workflows também aceitam `workflow_dispatch`, para o botão "rodar agora" do painel

## 3. Banco de dados (crie como migrations do Supabase, com RLS em tudo)

- `sites`: slug, nome, url, ativo, comissao_pct (padrão 5), taxa_adm, ultima_execucao, status
- `termos_busca`: termo, apelidos text[], tipo (carro|moto), ano_min, ano_max, lance_max, ativo
- `lotes`: site_id, id_externo (único com site_id), url, titulo, marca, modelo, versao, ano_fab, ano_mod, km, uf, cidade, condicao_monta (sem_monta|pequena|media|grande|sucata|nao_informado), roda (sim|nao|nao_informado), combustivel, lance_atual, lance_inicial, avaliacao, inicio_em, fim_em, status, fotos text[], fipe_codigo, fipe_valor, fipe_atualizado_em, raw jsonb, visto_primeiro_em, visto_ultimo_em
- `lotes_historico`: lote_id, capturado_em, lance_atual, status, fim_em
- `lote_termos`: lote_id, termo_id
- `decisoes`: site_id, id_externo, decisao (gostei|descartado), decidido_em, nota
- `alertas_enviados`: lote_id, tipo (novo|lance|lembrete_24h|lembrete_2h|robo_falhou), enviado_em, telegram_msg_id
- `execucoes_robo`: site_id, inicio, fim, encontrados, novos, atualizados, erro, log
- `config`: chat_id_telegram, frete_por_km, frete_fixo, origem ("Passos-MG"), custo_doc_padrao, custo_patio_padrao

O painel lê com o usuário logado. O robô e o webhook gravam com a service key, que só existe nos secrets.
Seed: os 5 sites e os termos `hrv` (apelidos `hr-v`, `hr v`), `asx`, `outlander` e `bros` (tipo moto).

## 4. Pipeline do robô (igual para todos os sites)

1. **Coletar** com o adaptador do site, que devolve um tipo único `LoteColetado`
2. **Normalizar**: minúsculas, sem acento, sem hífen ou espaço extra
3. **Casar** com termo + apelidos por palavra inteira (`bros` não casa com `Ambrosio`) e aplicar ano, tipo e lance máximo
4. **Classificar** monta e "roda" pelos campos do site e por palavras-chave da descrição, num arquivo editável (`funcionando`, `motor funciona`, `não dá partida`, `sucata`, `pequena monta`, `média monta`, `grande monta`…)
5. **Gravar**: upsert por `site + id_externo`. Se lance, status ou data mudarem, grava em `lotes_historico`. Copia as fotos para o Storage (os sites apagam depois do leilão)
6. **Alertar**:
   - descartado → ignora
   - novo + `sem_monta` + `roda = sim` → alerta de lote novo
   - com monta, sucata ou sem informação → só aparece no painel, com etiqueta
   - favorito com lance diferente → alerta de mudança de lance
7. **Registrar** em `execucoes_robo`. Se um site der erro ou trouxer 0 lotes em 2 execuções seguidas → alerta "robô do <site> falhou". Salve screenshot e HTML do erro como artefato do GitHub Actions.

Cada adaptador precisa de um teste com um fixture salvo (JSON ou HTML real capturado), para eu saber na hora quando um site mudar.

## 5. Telegram

- Mensagem de lote novo: foto (`sendPhoto`), título, ano/km, cidade-UF, lance, % FIPE, custo real, data e hora de encerramento, e botões inline `👍 Gostei`, `🗑 Descartar` e `🔗 Ver no site`
- Ao clicar, o webhook grava em `decisoes` e edita a mensagem para mostrar "⭐ Favorito" ou "Descartado"
- Outros alertas: lance mudou (favoritos), lembrete 24h e 2h (favoritos), robô falhou
- Comandos: `/favoritos`, `/hoje`, `/add <modelo>`, `/termos`, `/status`
- Segurança: valide o `secret_token` do webhook e responda só ao `chat_id` salvo em `config`. Na primeira mensagem que eu mandar, capture o meu `chat_id`

## 6. Extras da v1

- **FIPE**: API pública da FIPE (Parallelum). Case marca/modelo/ano, guarde o código e o valor, atualize 1 vez por mês. Mostre `% FIPE = custo real / FIPE`, com etiqueta verde abaixo de 70%. Se o casamento for incerto, mostre "FIPE aproximada" e permita corrigir o código na mão
- **Custo real** = lance × (1 + comissão) + taxa adm + pátio + frete + documentação. O frete é a distância do pátio até Passos-MG × R$/km (ou valor fixo). Todos os valores podem ser editados no painel e por lote
- **Histórico de lances**: gráfico de linha (lance × tempo) com a FIPE como linha de referência

## 7. Painel web

Telas, todas atrás do login:
- **Lotes**: cards com foto, modelo, ano/km, UF, etiquetas de monta e "roda", lance, % FIPE, custo real e contagem regressiva. Filtros por site, termo, UF, monta, roda e "encerra em 24h". Gostei/Descartar no próprio card
- **Favoritos**: ordenados pelo encerramento, com gráfico e nota pessoal
- **Detalhe do lote**: galeria, descrição completa, calculadora de custo real, histórico e link
- **Termos de busca**: CRUD com apelidos, ano, tipo, lance máximo e liga/desliga
- **Saúde dos robôs**: última execução por site, contagens, erros e botão "rodar agora" (`workflow_dispatch` via API do GitHub)
- **Descartados**: escondida no menu, só para desfazer

Design: simples, objetivo, tons escuros e sóbrios, mas com acabamento caprichado.
- Fundo grafite quase preto (`#0B0C0E`), superfícies em camadas (`#121418`, `#1A1D22`), bordas de 1px
- Um único acento âmbar (`#F5A524`) para "encerra em breve". Verde sóbrio para "sem monta", vermelho apagado para "grande monta"
- Inter ou Geist no texto, Geist Mono em preços, km e contagens
- Animações no estilo Emil Kowalski: 150 a 250 ms com ease-out, card saindo suavemente ao descartar, `prefers-reduced-motion` respeitado
- Funciona bem no celular

## 8. Ordem de execução

1. **Base**: monorepo, migrations, seed, login, tela de termos, deploy na Vercel
2. **Robôs**: os 5 adaptadores com testes, o pipeline, os workflows e a tela de saúde. Comece explorando cada site com o Playwright em modo visível para descobrir os endpoints JSON. Antes de escrever o adaptador, me mostre o que encontrou em cada site
3. **Telegram**: bot, alertas, botões e alerta de robô quebrado
4. **Painel completo**: cards, filtros, favoritos, detalhe, FIPE, custo real e gráfico
5. **Lembretes**: `pg_cron` + Edge Function, checagem de favoritos a cada 2h e comandos

Comece agora pela seção 0 e pela fase 1. Quando precisar de algo que só eu posso fazer (criar o projeto no Supabase, o bot no BotFather, o CNAME `busca` no DNS de karv.tec.br, os secrets), pare e me dê um passo a passo curto. No fim de cada fase, rode os testes e me diga exatamente como conferir.
