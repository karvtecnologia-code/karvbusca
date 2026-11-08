# KarvBusca

Monitor pessoal de leilões de veículos (VIP, Sodré Santoro, Sold, Freitas, Loop) com alertas no Telegram.
Plano completo em [docs/plano-arquitetura.md](docs/plano-arquitetura.md). Licença MIT.

## Estrutura

```
apps/web/            painel Next.js 16 + webhook do Telegram (Vercel)
packages/core/       tipos, normalização, matching, monta/roda, custo real
packages/scraper/    robô Playwright (fase 2)
supabase/            migrations (schema + seed)
.github/workflows/   agendamentos (fase 2)
```

## Rodar localmente

```powershell
pnpm install
copy .env.example apps\web\.env.local   # preencha os valores
pnpm test
pnpm dev                                # http://localhost:3000
```

## Onde ficam as chaves

| Variável | `.env.local` | Vercel | GitHub Secrets |
| --- | :-: | :-: | :-: |
| `NEXT_PUBLIC_SUPABASE_URL` | ✔ | ✔ | ✔ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✔ | ✔ | |
| `SUPABASE_SERVICE_ROLE_KEY` | opcional | ✔ | ✔ |
| `TELEGRAM_BOT_TOKEN` | | ✔ | ✔ |
| `TELEGRAM_WEBHOOK_SECRET` | | ✔ | |
| `GITHUB_DISPATCH_TOKEN`, `GITHUB_REPO` | | ✔ | |

Nenhuma chave vai para o código: o repositório é público.
