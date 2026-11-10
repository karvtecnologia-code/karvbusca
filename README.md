# KarvBusca

Robô pessoal que vigia sites de leilão de veículos (Sodré Santoro, Superbid/Sold, Freitas, VIP e Loop),
acha os carros e motos **aptos a rodar** nos modelos que você escolher e avisa no **Telegram** com foto,
% da FIPE, custo real, nota de oportunidade e botões 👍 Gostei / 🗑 Descartar.

Tudo roda em serviços **gratuitos** e o código é **open source** (licença MIT).

| Peça | Serviço (plano grátis) |
| --- | --- |
| Painel web | Vercel (Hobby) |
| Banco, login, fotos, cofre de senhas | Supabase (Free) |
| Robô 3x por dia | GitHub Actions (repositório público = minutos ilimitados) |
| Alertas | Telegram (bot próprio) |
| Análise por IA (opcional) | Google Gemini (chave grátis) |
| FIPE, mapas e rotas | Parallelum FIPE, OpenStreetMap (Nominatim) e OSRM |

---

## Instalação (uns 30 minutos, sem programar)

Você vai precisar de contas gratuitas no **GitHub**, **Supabase**, **Vercel** e **Telegram**.

### 1. Copie o projeto
1. Entre no GitHub e clique em **Fork** neste repositório (ou **Use this template**).
2. Deixe o repositório **público** (assim o GitHub Actions não tem limite de minutos). Nenhuma senha fica no código.

### 2. Crie o banco no Supabase
1. Em [supabase.com](https://supabase.com), crie um projeto (região **São Paulo**).
2. Anote o **ref** do projeto: é o trecho `abcdefghijklmnopqrst` do endereço `https://abcdefghijklmnopqrst.supabase.co`.
3. Abra o arquivo [`supabase/schema.sql`](supabase/schema.sql), troque `SEU-PROJETO` pelo seu ref,
   cole **tudo** em **SQL Editor → New query** e clique em **Run**.
4. Em **Authentication → Sign In / Providers**, desligue **Allow new users to sign up**.
5. Em **Authentication → Users → Add user**, crie o seu e-mail e senha (marque *Auto confirm*).
6. Em **Project Settings → API Keys**, copie a **Publishable key** e a **Secret key**. Em **Data API**, copie a **Project URL**.

### 3. Publique o painel na Vercel
1. Em [vercel.com](https://vercel.com) → **Add New → Project**, importe o seu repositório.
2. **Root Directory:** `apps/web`.
3. Em **Environment Variables**, cadastre:

   | Nome | Valor |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL (sem `/rest/v1` no fim) |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | Secret key |
   | `ENABLE_EXPERIMENTAL_COREPACK` | `1` |
   | `GITHUB_DISPATCH_TOKEN` *(opcional)* | token do GitHub para o botão "Rodar agora" |
   | `GITHUB_REPO` *(opcional)* | `seu-usuario/seu-repositorio` |
4. Clique em **Deploy** e abra o endereço `https://seu-projeto.vercel.app`.

### 4. Ligue o robô no GitHub
No seu repositório → **Settings → Secrets and variables → Actions → New repository secret**:

| Nome | Valor |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key |

Depois, em **Actions**, ative os workflows. A busca roda às 07h, 12h e 18h (horário de Brasília).

### 5. Configure tudo pelo painel
Entre no painel e abra **Configurações**:
1. **Telegram:** clique em **Como criar o bot?** e siga o passo a passo. Cole o token, clique em
   **Salvar token** e em **Conectar bot**. Mande qualquer mensagem para o bot: chega *"✅ KarvBusca conectado"*.
2. **Estados e origem:** escolha os estados (padrão SP e MG) e a sua cidade (para distância e frete).
3. **Termos** (menu): cadastre os modelos que você quer (ex.: `hrv`, `corolla`, `bros`).
4. **IA** *(opcional)*: gere uma chave grátis em [aistudio.google.com/apikey](https://aistudio.google.com/apikey) e cole.
5. **Usuários** *(opcional)*: crie acesso para outras pessoas. Para elas receberem os alertas,
   basta abrir o bot e mandar `/start CÓDIGO` (o código aparece na seção Telegram).

### 6. Lembretes de encerramento *(opcional)*
Para receber "⏰ encerra em 24h / 2h" dos favoritos, publique a função uma vez (precisa do Node instalado):
```bash
npx supabase login
npx supabase functions deploy lembretes --no-verify-jwt --project-ref SEU-PROJETO
```

---

## A Loop Leilões
A Loop bloqueia acessos vindos de datacenters (como o GitHub). O robô dela roda no **seu computador**:
```powershell
git clone https://github.com/seu-usuario/seu-repositorio.git
cd seu-repositorio
corepack enable; pnpm install
pnpm --filter @karv/scraper exec playwright install chromium
copy .env.example apps\web\.env.local   # preencha NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY
.\scripts\agendar-loop.ps1               # agenda 07:05, 12:05 e 18:05 no Windows
```
Se não quiser, desmarque a Loop em **Configurações → Sites**.

---

## Como o sistema decide
- **Apto a rodar:** não é sucata nem grande monta, o motor não está marcado como parado, a circulação não
  está vedada e não há dano estrutural (longarina, chassi, airbag acionado…). Média monta só conta se o site
  confirmar que o motor funciona. As palavras-chave ficam em [`packages/core/src/keywords.ts`](packages/core/src/keywords.ts).
- **Nota de oportunidade (0–100):** % da FIPE (peso maior), monta, motor, procedência, km/ano, distância e chave.
- **Modo descoberta:** acha carros fora dos seus termos com lance abaixo de X% da FIPE.
- **Telegram:** todo lote apto novo gera alerta; 🔥 quando a nota passa do corte. Os botões valem no painel.

## Desenvolvimento
```bash
pnpm install
pnpm test        # testes com páginas reais salvas dos sites
pnpm dev         # painel em http://localhost:3000
pnpm scrape -- --seco --visivel   # robô sem gravar, com o navegador na tela
```
Estrutura: `apps/web` (painel Next.js + webhook do Telegram), `packages/core` (regras: matching, monta,
custo, FIPE, nota, IA), `packages/scraper` (robô Playwright, um adaptador por site), `supabase/` (schema e
função de lembretes).
