# KarvBusca — Plano e arquitetura

Nov 8, 2026 · @Guilherme

## Visão geral

O KarvBusca é um robô que varre 5 sites de leilão 3 vezes por dia e avisa no Telegram quando aparece um carro ou moto dos modelos cadastrados. O painel web fica em `busca.karv.tec.br`.

**Sites monitorados**

| Site | URL | O que se sabe hoje |
| --- | --- | --- |
| VIP Leilões | https://www.vipleiloes.com.br/ | Bloqueia robôs no robots.txt; exige navegador real |
| Sodré Santoro | https://www.sodresantoro.com.br/ | Recusou acesso automático; risco de bloqueio por IP |
| Sold (Superbid) | https://www.sold.com.br/ | Plataforma Superbid; lotes carregados por JavaScript |
| Freitas Leiloeiro | https://www.freitasleiloeiro.com.br/ | Busca por URL: `categoria=1`, `TipoLoteId=1` carros, `3` motos |
| Loop Leilões | https://loopleiloes.com.br/ | Next.js; estoque em `/estoque`, abas Carros e Motos |

**Parâmetros iniciais**

- Tipos: carros e motos
- Estados: SP e MG
- Condição: que rodem, de preferência sem monta
- Modelos: definidos no painel, vários ao mesmo tempo (ex.: `hrv`, `asx`, `outlander`, `bros`)
- Gostei → fica fixo nos favoritos, sem novo alerta de "lote novo"
- Descartar → o lote é ignorado para sempre

## Arquitetura e hospedagem

O painel e o banco ficam online. O robô roda no GitHub Actions, porque a Vercel não executa navegador.

&#91;embedded content: arquitetura do KarvBusca · 5 peças\]

O Supabase é o centro: o robô grava nele, o painel lê dele, e os botões do Telegram voltam para ele pelo webhook do painel.

| Peça | Tecnologia | Onde roda |
| --- | --- | --- |
| Painel web | Next.js (App Router) + TypeScript + Tailwind | Vercel, `busca.karv.tec.br` |
| Login | Supabase Auth (e-mail e senha) | Supabase |
| Banco | Postgres | Supabase |
| Robô coletor | Node + TypeScript + Playwright, um adaptador por site | GitHub Actions |
| Lembretes 24h/2h | `pg_cron` + Edge Function | Supabase |
| Bot | Telegram Bot API, webhook em `/api/telegram` | Vercel |
| Fotos | Supabase Storage (cópia das fotos) | Supabase |

**Agendamentos** (horário de Brasília; o cron do GitHub usa UTC)

| Rotina | Quando | Onde |
| --- | --- | --- |
| Busca completa nos 5 sites | 07:00, 12:00 e 18:00 | GitHub Actions |
| Checagem de lance dos favoritos | A cada 2h, das 07:00 às 23:00 | GitHub Actions |
| Lembretes 24h e 2h antes do encerramento | A cada 15 min | Supabase `pg_cron` |

Estimativa de uso do GitHub Actions: cerca de 1.400 min/mês, dentro dos 2.000 grátis de um repositório privado.

**Estrutura do repositório (monorepo)**

```
karvbusca/
  apps/web/            painel Next.js + webhook do Telegram
  packages/scraper/    robô Playwright
    src/adapters/      vip.ts, sodre.ts, sold.ts, freitas.ts, loop.ts
  packages/core/       tipos, normalização, matching, classificação de monta
  supabase/            migrations, seed, edge functions
  .github/workflows/   scrape-full.yml, scrape-favorites.yml
```

## Banco de dados

São 9 tabelas no Supabase. O lote é identificado por `site + id_externo`, então um descartado nunca volta, mesmo que o site mude o título.

| Tabela | Campos principais | Para quê |
| --- | --- | --- |
| `sites` | slug, nome, url, ativo, comissao\_pct, taxa\_adm, ultima\_execucao, status | Cadastro dos 5 sites e da saúde de cada robô |
| `termos_busca` | termo, apelidos\[\], tipo (carro/moto), ano\_min, ano\_max, lance\_max, ativo | Modelos definidos no painel |
| `lotes` | site\_id, id\_externo, url, titulo, marca, modelo, versao, ano\_fab, ano\_mod, km, uf, cidade, condicao\_monta, roda, combustivel, lance\_atual, lance\_inicial, avaliacao, inicio\_em, fim\_em, status, fotos\[\], fipe\_codigo, fipe\_valor, raw jsonb, visto\_primeiro\_em, visto\_ultimo\_em | Cada lote coletado |
| `lotes_historico` | lote\_id, capturado\_em, lance\_atual, status, fim\_em | Mudanças de lance, status e data (gráfico) |
| `lote_termos` | lote\_id, termo\_id | Qual termo casou com qual lote |
| `decisoes` | site\_id, id\_externo, decisao (gostei/descartado), decidido\_em, nota | Favoritos e lista negra permanente |
| `alertas_enviados` | lote\_id, tipo (novo/lance/lembrete\_24h/lembrete\_2h/robo\_falhou), enviado\_em, telegram\_msg\_id | Evita alerta repetido |
| `execucoes_robo` | site\_id, inicio, fim, encontrados, novos, atualizados, erro, log | Log e tela de saúde |
| `config` | chat\_id\_telegram, frete\_por\_km, origem (Passos-MG), horarios | Configurações gerais |

Todas as tabelas têm RLS ligado: o painel lê com o usuário logado, e o robô e o webhook gravam com a service key, que fica só nos secrets.

## Lógica do robô

Cada site tem um adaptador que devolve lotes num formato único. O resto do fluxo é igual para todos.

1. **Coletar**: o Playwright abre a listagem de veículos e escuta as respostas JSON internas do site (`page.on('response')`). Só usa o HTML quando não houver JSON. Filtra carros e motos de SP e MG.
2. **Normalizar**: deixa tudo minúsculo, sem acento, sem hífen e sem espaço extra (`HR-V`, `hr v` e `hrv` viram `hrv`).
3. **Casar com os termos**: compara título, modelo e descrição com termo + apelidos, por palavra inteira (`bros` não casa com `Ambrosio`). Depois aplica ano, tipo e lance máximo.
4. **Classificar a condição**: lê os campos do site e procura palavras-chave na descrição.
   - Monta: `sem monta`, `pequena`, `média`, `grande`, `sucata`, `não informado`
   - Roda: `sim` (funcionando, motor funciona, dá partida), `não` (não dá partida, sem motor, motor travado), `não informado`
   - As palavras-chave ficam num arquivo fácil de editar
5. **Gravar**: faz upsert em `lotes` por `site + id_externo`. Se o lance, o status ou a data mudarem, grava uma linha em `lotes_historico`. Copia as fotos para o Storage.
6. **Decidir o alerta**
   - Descartado → ignora
   - Novo + sem monta + roda = sim → alerta de lote novo
   - Com monta, sucata ou sem informação → só aparece no painel, com etiqueta
   - Favorito com lance diferente → alerta de mudança de lance
7. **Registrar a execução**: grava em `execucoes_robo`. Se um site der erro ou trouxer 0 lotes em 2 execuções seguidas, avisa "robô da Sodré falhou" no Telegram.

**Boas práticas**: um site por vez, pausa de 2 a 5 s entre páginas, user-agent de navegador comum, nada que exija login e screenshot do erro salvo como artefato do GitHub Actions.

## Telegram

Os alertas chegam com foto e botões. Gostei e Descartar funcionam direto no Telegram, sem abrir o painel.

| Alerta | Quando dispara | Conteúdo |
| --- | --- | --- |
| Lote novo | Lote novo, sem monta e rodando | Foto, título, ano/km, cidade-UF, lance, % FIPE, custo real, data de encerramento, link + botões |
| Lance mudou | Favorito com lance diferente da última coleta | Lance anterior → atual, % FIPE, link |
| Lembrete 24h | Favorito a 24h do encerramento | Foto, lance, hora exata, link |
| Lembrete 2h | Favorito a 2h do encerramento | Lance, hora exata, link |
| Robô falhou | Site com erro ou 0 lotes em 2 execuções seguidas | Nome do site e o erro |

**Botões** (`inline_keyboard` com `callback_data`)

- 👍 Gostei → grava `decisoes = gostei`; a mensagem passa a mostrar "⭐ Favorito"
- 🗑 Descartar → grava `decisoes = descartado`; a mensagem passa a mostrar "Descartado"
- 🔗 Ver no site → link do lote

**Comandos**: `/favoritos`, `/hoje` (encerram hoje), `/add asx`, `/termos`, `/status` (saúde dos robôs).

**Segurança**: o webhook confere o `secret_token` do Telegram e só responde ao `chat_id` cadastrado.

## Painel web

São 6 telas, todas atrás do login do Supabase.

| Tela | O que tem |
| --- | --- |
| Lotes | Cards com foto, modelo, ano/km, UF, etiquetas de monta e "roda", lance, % FIPE, custo real e contagem regressiva. Filtros por site, termo, UF, monta, roda e "encerra em 24h". Botões Gostei/Descartar no card |
| Favoritos | Lotes marcados, ordenados pelo encerramento, com gráfico do histórico de lances e nota pessoal |
| Detalhe do lote | Galeria de fotos, descrição completa, calculadora de custo real, histórico e link para o site |
| Termos de busca | Adicionar e remover modelos, apelidos, ano, tipo e lance máximo; liga/desliga |
| Saúde dos robôs | Última execução por site, lotes encontrados/novos, erros e botão "rodar agora" (dispara o workflow) |
| Descartados | Lista escondida no menu, só para desfazer um clique errado |

**Direção visual**

- Fundo grafite quase preto (`#0B0C0E`), superfícies em camadas (`#121418`, `#1A1D22`), bordas finas de 1px
- Um único acento: âmbar (`#F5A524`) para "encerra em breve" e destaques; verde sóbrio para "sem monta", vermelho apagado para "grande monta"
- Tipografia: Inter ou Geist para texto, Geist Mono para preços, km e contagem regressiva
- Cards densos e objetivos, com a foto grande à esquerda e os números alinhados à direita
- Movimento no estilo do Emil Kowalski: transições de 150 a 250 ms com ease-out, card que sai suavemente ao descartar, `prefers-reduced-motion` respeitado
- Responsivo: no celular, os cards viram uma lista vertical e os filtros ficam numa gaveta

## Extras da primeira versão

Entram 4 extras: FIPE, custo real, histórico com gráfico e botões no Telegram (já descritos acima).

**Comparação com a FIPE**

- Usa a API pública da FIPE (Parallelum) para casar marca, modelo e ano e pegar o código FIPE
- O valor fica em cache em `lotes.fipe_valor` e é atualizado 1 vez por mês
- Mostra `% FIPE = custo real / valor FIPE`. Abaixo de 70% ganha etiqueta verde
- Se o casamento for incerto, mostra "FIPE aproximada" e deixa corrigir o código na mão

**Custo real**

```latex
\text{custo real} = \text{lance} \times (1 + \text{comissão}) + \text{taxa adm} + \text{pátio} + \text{frete} + \text{documentação}
```

- Comissão: 5% por padrão, editável por site em `sites.comissao_pct`
- Frete: distância do pátio até Passos-MG × R$/km configurado (ou um valor fixo de guincho)
- Documentação e pátio: valores padrão editáveis no painel e em cada lote

**Histórico de lances**

- Cada mudança vira uma linha em `lotes_historico`
- Gráfico de linha (lance × tempo) no detalhe e nos favoritos, com a linha da FIPE como referência

## Fases de construção

São 5 fases, e cada uma termina com algo funcionando de ponta a ponta.

1. **Base**: monorepo, migrations do Supabase, login, tela de termos com seed (`hrv`, `asx`, `outlander`, `bros`) e deploy na Vercel. Termina com o login funcionando em `busca.karv.tec.br`.
2. **Robôs**: os 5 adaptadores, o pipeline (normalizar → casar → classificar → gravar), os workflows do GitHub Actions e a tela de saúde. Termina com lotes reais no banco 3 vezes por dia.
3. **Telegram**: bot, alertas com foto, botões Gostei/Descartar via webhook e aviso de robô quebrado. Termina com o primeiro alerta real no celular.
4. **Painel completo**: cards, filtros, favoritos, detalhe, FIPE, custo real, gráfico de lances e descartados.
5. **Lembretes**: `pg_cron` + Edge Function para 24h/2h, checagem de lance dos favoritos a cada 2h e comandos do bot.

**O que você precisa providenciar**

- [ ] Criar o repositório privado `karvbusca` no GitHub
- [ ] Criar o projeto no Supabase (região São Paulo) e anotar a URL, a anon key e a service key
- [ ] Criar o bot no @BotFather e anotar o token
- [ ] Conectar o repositório na Vercel
- [ ] Criar o CNAME `busca` no DNS de karv.tec.br apontando para a Vercel
- [ ] Cadastrar os secrets no GitHub e as variáveis de ambiente na Vercel (nunca colar as chaves no chat)
- [ ] Definir o frete: R$/km ou valor fixo de guincho por região
- [ ] Mandar a primeira mensagem para o bot, para o sistema capturar o seu `chat_id`

## Riscos e cuidados

O maior risco é um site bloquear o IP do GitHub ou mudar o layout. Os dois casos têm um plano B.

| Risco | Sinal | Plano B |
| --- | --- | --- |
| Site bloqueia o IP dos EUA (Sodré é o mais provável) | Erro 403 ou página de desafio | Rodar só aquele adaptador no seu PC com Windows (Agendador de Tarefas), com o mesmo código |
| Site muda o layout ou a API interna | 0 lotes em 2 execuções seguidas | Alerta "robô falhou" + screenshot no GitHub Actions; ajusta só aquele adaptador |
| Termos de uso e robots.txt (a VIP restringe robôs) | — | Uso pessoal, baixa frequência, pausas entre páginas, nada atrás de login |
| Cron do GitHub atrasa ou pula execuções | Execução fora do horário | Lembretes críticos ficam no `pg_cron` do Supabase, não no GitHub |
| Classificação de monta errada | Lote com monta chegando como "sem monta" | Palavras-chave editáveis + o texto original guardado em `raw` para conferir |
| Estourar os 2.000 min grátis | Uso acima de 1.600 min no mês | Reduzir a checagem de favoritos para a cada 3h ou tornar o repo público (sem segredos no código) |

**Para depois da v1**: Copart e Mega Leilões (muito estoque em SP), exportar encerramentos para a agenda (.ics) e distância real por rota.
