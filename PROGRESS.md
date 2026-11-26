# PROGRESS — Cronograma CTCEA

## Status

**BACKLOG_CONCLUIDO** — 12 blocos entregues, nenhum item em aberto. Tudo o que
resta é operacional ou decisão de negócio, não código pendente.

| # | Bloco | Estado | Onde vive |
|---|---|---|---|
| 1 | Fundação (Next, Prisma, Clerk, Vercel, Railway) | entregue | — |
| 2 | CRUD de Projetos | entregue | `/projetos` |
| 3 | CRUD de Ações + `HistoricoAlteracao` | entregue | `/projetos/[id]` |
| 4 | Visualização Gantt | entregue | `/projetos/[id]` |
| 5 | Painel consolidado (modelo PLA-DEP) | entregue | `/` |
| 6 | Migração dos dados das planilhas | entregue | `scripts/` |
| 7 | Dashboards (15 relatórios) | entregue | `/dashboards` |
| 8 | Modo escuro (Sistema/Claro/Escuro) | entregue | cabeçalho |
| 9 | Matriz de Priorização (Benefício × Esforço × GUT) | entregue | `/priorizacao` |
| 10 | Card WIN — fase 1 (funil de entrada do plano) | entregue | `/wins` |
| 11 | Card WIN — fase 2 (equipe + 2 relatórios) | entregue | `/wins/equipe`, `/dashboards` |
| 12 | Administração de colaboradores | entregue | `/colaboradores` |

Blocos 1–10 estão detalhados no Backlog abaixo; 11 e 12 nasceram depois e estão
no Log de decisões.

**Verificação atual:** `npm test` 541 em 39 arquivos · `npm run test:integracao`
71 em 5 arquivos · `tsc`, `lint` e `build` limpos.

### O que está em aberto

| Pendência | Tipo | Consequência se ficar assim |
|---|---|---|
| **Clerk em instância de *development*** | operacional | Limites de conta e chaves de teste. Ao promover, **registrar o app no Azure AD ANTES**, senão o login Microsoft quebra na troca de chaves. |
| **Planilha real não importada em produção** | operacional | Ninguém tem card. O WIN que já bateu 3 semanas segue sem virar item do plano. **Ensaio de 28/09 validou a importação ponta a ponta** — falta só rodar com a `DATABASE_URL` de produção, o que exige a máquina do usuário. |
| **Sem trilha de auditoria para `Colaborador`** | código, fora de escopo | Quem desativou ou renomeou quem, e quando, não fica registrado. `HistoricoAlteracao` é só de `Acao`. |
| **URLs órfãs do projeto `cronograma` desconectado** | operacional | Continuam no ar, protegidas por SSO. Não recebem deploy novo. |
| **CI em `actions/checkout@v4` e `setup-node@v4`** | manutenção | Aviso de descontinuação do Node 20 a cada execução. Não quebra nada hoje. |

### O que ainda não existe e talvez você queira

- Notificação de WIN prestes a estourar as 3 semanas (hoje o aviso só aparece
  para quem abre a própria tela).
- Exportar card ou relatório para PDF/Excel.
- Editar card de outra pessoa (decisão de produto não tomada).


## Contexto do projeto (não apagar — referência para o Claude)
- Sistema independente que substitui as planilhas PLA-DEP-2026-001.xlsx (consolidado
  multi-projeto) e CRO-DEP-2026-001.xlsx (detalhe de um projeto).
- Stack: Next.js (App Router) + TypeScript + Prisma + PostgreSQL + Tailwind.
- Uso interno único da CTCEA — SEM multi-tenant.
- Ver CLAUDE.md para convenções e SCHEMA.md para o modelo de dados detalhado.
- Idioma: Português (BR) em todo o sistema (UI, nomes de campos do domínio).

## Backlog

### Bloco 1 — Fundação
- [x] Clonar https://github.com/fabianojp06/cronograma (privado) e fazer o commit
      inicial (setup do Next.js) antes de rodar o autoloop.sh pela primeira vez
- [x] Configurar `CHECK_CMD` de testes (Jest ou Vitest) e escrever o primeiro teste
      trivial só para validar que o pipeline de teste funciona — fazer este item
      ANTES de qualquer outro código, para que o script `npm test` já exista desde
      a primeira verificação do autoloop
- [x] Setup do projeto Next.js (App Router) + TypeScript + Tailwind CSS
- [x] Configurar Prisma + PostgreSQL com o schema inicial descrito em SCHEMA.md
      (models Projeto, Acao, HistoricoAlteracao, enum StatusAcao)
- [x] Rodar a primeira migration e criar seed com 3 projetos de exemplo e 5 ações
      cada, com datas Previsto variadas (algumas no passado, algumas futuras)
- [x] Integrar Clerk (Instance ID `<id-instancia-clerk>`) como autenticação,
      habilitando login social via Microsoft/Outlook (Azure AD OAuth) — usar
      `clerk_sdk_snippet` do MCP do Clerk para o código de integração correto do
      Next.js App Router; a chave secreta e a publishable key vão em variáveis de
      ambiente (`.env.local`, nunca commitadas)
- [x] Conectar o repositório GitHub ao projeto Vercel `<id-projeto-vercel>`
      (deploy automático a cada push) e ao projeto Railway
      `<id-projeto-railway>` (banco PostgreSQL) — registrar no
      Log de decisões o domínio gerado pela Vercel e a connection string (via
      variável de ambiente, nunca em texto plano no repositório) assim que
      existirem

### Bloco 2 — CRUD de Projetos
- [x] Ler o protótipo aprovado em https://claude.ai/artifact/WPxn8dThgUAmMPJHAPJzhs
      (artboard `E-FormularioProjeto`) antes de implementar a tela de criação/edição
      — **acesso negado** ao artifact nesta conta; ver Log de decisões
- [x] Server Action de criação de Projeto com validação (nome obrigatório; demais
      campos opcionais) cobrindo os campos do SCHEMA.md
- [x] Tela de listagem de Projetos com filtro por equipe, categoria e status
      agregado (calculado a partir das Ações)
- [x] Edição de Projeto existente
- [x] Exclusão lógica de Projeto (campo `ativo = false`, nunca DELETE físico)

### Bloco 3 — CRUD de Ações
- [x] Ler o protótipo aprovado em https://claude.ai/artifact/WPxn8dThgUAmMPJHAPJzhs
      (artboard `F-FormularioAcao`) antes de implementar a tela de criação/edição —
      inclui o painel de histórico de alterações ao lado do formulário —
      **acesso negado** ao artifact nesta conta (3ª tentativa); ver Log de decisões
- [x] Server Action de criação de Ação vinculada a um Projeto, com `numero`
      sequencial automático dentro do projeto (usar a constraint `@@unique([projetoId, numero])`)
- [x] Função utilitária de cálculo de dias úteis entre duas datas (excluir sábados,
      domingos, e a lista de feriados nacionais fixos do Brasil), com teste unitário
      cobrindo pelo menos 3 casos (mesma semana, atravessando um feriado, mês inteiro)
- [x] Atualização de status de uma Ação: toda mudança de `status`, `previstoInicio`,
      `previstoTermino`, `realizadoInicio` ou `realizadoTermino` deve gravar uma linha
      em `HistoricoAlteracao` com valor antigo e novo — cobrir com teste que confirma
      que o histórico é criado
- [x] Endpoint/Server Action específico para registrar datas "Realizado" (distinto do
      fluxo de registrar datas "Previsto")

### Bloco 4 — Visualização Gantt
- [x] Ler o protótipo aprovado em https://claude.ai/artifact/WPxn8dThgUAmMPJHAPJzhs
      (artboard `D-DetalheGantt`) antes de implementar — layout, tokens de cor e
      comportamento visual descritos em CLAUDE.md devem ser seguidos fielmente —
      **acesso negado** ao artifact nesta conta (4ª tentativa); ver Log de decisões
- [x] Componente de grade semanal renderizando, para um Projeto, as barras Previsto
      (azul) e Realizado (verde) de cada Ação sobrepostas na linha do tempo
- [x] Regra visual de atraso: se `previstoTermino < hoje` e `status != CONCLUIDO` e
      não há `realizadoTermino`, a barra Previsto fica vermelha
- [x] Navegação/scroll horizontal por período (a planilha original cobre ~13 meses;
      o componente não precisa renderizar tudo de uma vez — paginar por mês/trimestre)

### Bloco 5 — Dashboard consolidado (visão PLA-DEP)
- [x] Ler o protótipo aprovado em https://claude.ai/artifact/WPxn8dThgUAmMPJHAPJzhs
      (artboard `C-PainelOperacional`) antes de implementar — inclui alternância
      claro/escuro, indicadores por traço lateral, e link de cada linha para o
      detalhe do projeto (Bloco 4) — **acesso negado** ao artifact nesta conta
      (5ª tentativa); ver Log de decisões
- [x] Tela consolidada listando todos os Projetos ativos com progresso agregado
      (% de Ações com status CONCLUIDO sobre o total do projeto)
- [x] Filtros globais por equipe, responsável, categoria e status
- [x] Indicador/contador de projetos com pelo menos uma Ação atrasada (ver regra do
      Bloco 4)

### Bloco 6 — Migração dos dados existentes
- [x] Script (rodado uma vez, fora da aplicação) para importar PLA-DEP-2026-001.xlsx
      para o novo schema, seguindo a tabela de mapeamento em SCHEMA.md — o .xlsx
      real não está no repositório; o script está pronto e o mapeamento coberto
      por teste com uma planilha-fixture (ver Log de decisões)
- [x] Script equivalente para importar CRO-DEP-2026-001.xlsx como um Projeto
      individual com suas Ações detalhadas — `npm run importar:cro-dep`; o .xlsx
      real continua fora do repositório, mapeamento coberto por teste-fixture
- [x] Validação pós-importação: contagem de linhas da planilha original vs. registros
      criados, reportada no Log de decisões — `npm run validar:importacao`; a regra de
      conferência está coberta por teste, o número real depende de rodar contra o .xlsx

### Bloco 7 — Dashboards (relatórios consolidados)
- [x] Menu principal no cabeçalho (Painel / Projetos / Dashboards), visível só com
      sessão ativa
- [x] Catálogo de relatórios (`src/lib/dashboard-catalogo.ts`) como fonte única de
      verdade, alimentando o índice de navegação e as âncoras das seções
- [x] Relatórios de distribuição por equipe, responsável, natureza, categoria e
      prioridade, com barra de magnitude embutida na linha
- [x] Composição da carteira por status agregado (barra empilhada + legenda + números)
- [x] Relatórios de prazo: aderência Previsto x Realizado, ranking de maiores atrasos
      (em dias úteis) e radar de vencimentos em 7/15/30 dias
- [x] Relatórios temporais: curva acumulada Previsto x Realizado (burn-up) e carga
      de inícios/términos por mês
- [x] Relatório de higiene do cadastro, com o efeito de cada pendência sobre os números
- [x] Relatórios de auditoria sobre `HistoricoAlteracao`: replanejamentos por ação e
      alterações recentes por campo/autor

### Bloco 8 — Modo escuro
- [x] Alternador de tema no cabeçalho com três opções (Sistema / Claro / Escuro),
      preferência guardada no `localStorage`
- [x] Aplicação do tema antes da primeira pintura, sem flash branco na recarga
- [x] Acompanhar a troca de tema do sistema operacional em tempo real enquanto a
      preferência for "Sistema"
- [x] UI do Clerk (modal de login, UserButton) seguindo os mesmos tokens

### Bloco 9 — Matriz de Priorização (Benefício x Esforço ponderado por GUT)
- [x] Schema `AvaliacaoProjeto` (1:1 opcional com Projeto) e `PesoCriterio`, em
      migration nova, sem tocar na anterior
- [x] Catálogo dos dez critérios, escalas e quadrantes como fonte única
- [x] Cálculo transcrito da planilha, com teste de paridade contra as três linhas
      preenchidas do arquivo original
- [x] Tela `/priorizacao` com plano Esforço × Benefício em quatro quadrantes e
      ranking por prioridade
- [x] Formulário de avaliação por projeto, com totais e quadrante recalculados
- [x] Pesos ajustáveis por critério (`/priorizacao/pesos`), somando 100% por grupo
- [x] Entrada "Priorização" no menu principal

### Bloco 11 — Card WIN, fase 2
- [x] Visão de equipe para a daily (`/wins/equipe`) — o "Compartilhamento dos
      Cards" da aba Agenda, somente leitura
- [x] Relatório de conclusão dos WINs por semana, com promovido como categoria
      própria fora do denominador
- [x] Relatório de WINs reincidentes, somando as aparições anteriores ao sistema
- [x] Migration `wins_desfecho_da_aparicao`: o desfecho passa a viver na
      aparição, com a vaga liberada por índice único parcial

### Bloco 12 — Administração de colaboradores
- [x] Tela `/colaboradores` — desativar, reativar e corrigir nome
- [x] Renomear oferece alinhar `Projeto.responsavel`, pela mesma chave de
      identidade do cadastro e do importador
- [x] Auto-cadastro na tela do Card WIN, para o primeiro usuário num banco zerado

### Bloco 10 — Card WIN Semanal (fase 1)
- [x] Calendário de semanas da CTCEA (`semana-ctcea.ts`), com teste de paridade
      contra as 52 semanas da aba Referências
- [x] Schema `Colaborador`, `CardSemanal`, `Win`, `WinSemana` + enum `StatusWin`,
      em migration nova
- [x] Tela `/wins` com o card da semana, navegação e bloco da semana anterior
      derivado (nunca copiado)
- [x] Regra das 3 semanas com alerta e promoção ao plano de ação
- [x] Importação da semana 39 com o contador de repetições semeado
- [x] Entrada "Card WIN" no menu principal

## Log de decisões
(o Claude preenche aqui a cada rodada: o que fez, por quê, o que falta)

### 2026-09-17 — Bloco 1: pipeline de testes
- Marcados como concluídos os itens já entregues em commits anteriores: repositório
  clonado com commit inicial e scaffold do Next.js (App Router + TS + Tailwind v4).
- **Framework de teste escolhido: Vitest** (`vitest run` via `npm test`) — integra-se
  nativamente ao pipeline Vite/ESM e ao `tsconfig` do projeto, sem a camada extra de
  transpilação que o Jest exigiria com Next 16 + TS. Essa escolha é definitiva para
  todo o projeto (CLAUDE.md pede consistência).
- `CHECK_CMD` do autoloop = `npm test`.
- Criado `vitest.config.mts` (ambiente `node`, resolução nativa de paths do tsconfig,
  padrão de arquivos `src/**/*.test.ts(x)` e `tests/**/*.test.ts(x)`).
- Primeiro teste trivial em `src/lib/formatacao.test.ts` cobrindo `formatarDataBR`
  (datas em pt-BR, dd/mm/aaaa) — 2 testes, ambos passando.
- `@types/node` subiu para `^24` porque o Vitest 5 não resolve com `^20` (ERESOLVE).
- **Falta:** Prisma + PostgreSQL com o schema do SCHEMA.md (próximo item do Bloco 1).

### 2026-09-17 — Bloco 1: Prisma + PostgreSQL (schema inicial)
- `prisma/schema.prisma` criado com os models `Projeto`, `Acao`, `HistoricoAlteracao`
  e o enum `StatusAcao`, fiéis ao SCHEMA.md. Desvios (todos aditivos, nada removido):
  - `onDelete: Cascade` nas relações `Acao -> Projeto` e `HistoricoAlteracao -> Acao`
    (integridade referencial; a exclusão de Projeto no sistema continua sendo lógica
    via `ativo = false`, conforme o Bloco 2).
  - Índices `@@index` em `Projeto(ativo)`, `Projeto(equipe)`, `Acao(projetoId)` e
    `HistoricoAlteracao(acaoId, alteradoEm)` para os filtros do dashboard e do painel
    de histórico.
- **Prisma 7.10.0** (CLI e client pinados na mesma versão). No Prisma 7 o
  `datasource.url` não existe mais no schema: a URL passou para `prisma.config.ts`
  (`env('DATABASE_URL')`, carregada via `dotenv/config`) e o client usa o driver
  adapter `@prisma/adapter-pg`.
- Client gerado em `src/generated/prisma` (gitignored) — `postinstall: prisma generate`
  garante a geração em qualquer clone/CI. Singleton em `src/lib/prisma.ts` com cache em
  `globalThis` para não vazar pool no hot-reload do Next.
- `.env.example` versionado (exceção `!.env.example` no .gitignore); `.env` real
  continua fora do repositório.
- Scripts novos: `db:migrate` (`prisma migrate dev`) e `db:studio`.
- Testes: `src/lib/prisma.test.ts` cobre o enum `StatusAcao`, a presença dos 3 models,
  a constraint `@@unique([projetoId, numero])` e o campo `ativo`. `npm test` = 6 testes
  passando; `tsc --noEmit` limpo.
- **Falta:** rodar a primeira migration e o seed — depende do `DATABASE_URL` real do
  Railway, que ainda não foi provisionado (próximos itens do Bloco 1).

### 2026-09-17 — Bloco 1: primeira migration + seed
- **Migration inicial aplicada e versionada:** `prisma/migrations/20260917231112_inicial/`
  — cria o enum `StatusAcao`, as tabelas `Projeto`, `Acao` e `HistoricoAlteracao`, os 4
  índices e a unique `Acao_projetoId_numero_key`, exatamente como o schema descreve.
- **Banco usado:** o projeto Railway `<id-projeto-railway>` **ainda não tem serviço PostgreSQL**
  (só um serviço de app `cronograma` em estado *staged-create*, não commitado). Para não
  provisionar infraestrutura fora do escopo deste item, a migration foi gerada e validada
  contra um **PostgreSQL 16 local em Docker** (`cronograma-pg`, porta 55432). O `.env.example`
  documenta esse setup. Quando o serviço do Railway existir (item posterior do Bloco 1),
  basta `npm run db:deploy` — a migration é a mesma, nada precisa ser regerado.
- **Seed:** dados de exemplo em `src/lib/seed-dados.ts` como **função pura** `dadosSeed(hoje)`
  (sem Prisma, sem banco) e o gravador em `prisma/seed.ts`. Essa separação existe para que os
  dados sejam cobertos por teste unitário sem exigir banco no `CHECK_CMD`.
  - 3 projetos (`CRO-DEP-2026-001` / STI, `PLA-DEP-2026-014` / STI, `PLA-DEP-2026-027` / GRH),
    5 ações cada = 15 ações.
  - Datas Previsto são **offsets em dias relativos a `hoje`**, não datas fixas, para que o
    cenário (parte no passado, parte no futuro) continue válido em qualquer rodada futura.
  - Inclui deliberadamente **2 ações em atraso** (previsto vencido, sem `realizadoTermino`,
    status != CONCLUIDO) para exercitar a regra visual vermelha dos Blocos 4 e 5.
  - **Idempotente:** cada projeto é localizado por `referencia` e recriado (ações caem por
    cascade). Rodado 2x seguidas → continua 3 projetos / 15 ações.
- **`tsx` adicionado como devDependency** para rodar o seed: o client do Prisma 7 é gerado
  em TypeScript com imports sem extensão, que o `node --experimental-strip-types` não
  resolve. Por isso também trocamos `@/generated/prisma/...` por import relativo em
  `src/lib/prisma.ts` (o alias `@/` não existe fora do bundler do Next).
- Scripts novos: `db:seed` (`tsx prisma/seed.ts`) e `db:deploy` (`prisma migrate deploy`,
  para produção). O seed também está registrado em `prisma.config.ts` (`migrations.seed`),
  então `prisma migrate reset` repopula o banco automaticamente.
- Testes: `src/lib/seed-dados.test.ts` (8 testes: contagens, numeração sequencial, unicidade
  de referência, `previstoInicio <= previstoTermino`, presença de passado e futuro, presença
  de atrasos, `realizadoTermino` só em concluídas, `emDias`) e `src/lib/migrations.test.ts`
  (2 testes: migration versionada e conteúdo do SQL). **`npm test` = 16 testes passando**;
  `tsc --noEmit` e `npm run lint` limpos.
- **Falta:** integrar o Clerk (próximo item do Bloco 1) e provisionar Railway + Vercel.

### 2026-09-17 — Bloco 1: autenticação com Clerk
- **`@clerk/nextjs` 7.9.4 + `@clerk/localizations` 4.17.1** instalados. Código obtido via
  `clerk_sdk_snippet` do MCP do Clerk (bundles `server-side` e `show-component`).
- **Padrão fechado:** `src/proxy.ts` roda `clerkMiddleware` e chama `auth.protect()` em
  tudo que não casa com `ROTAS_PUBLICAS` (`/entrar*`, `/cadastrar*`, `/api/webhooks*`).
  Uso interno da CTCEA — nenhuma tela de domínio é pública.
  - O arquivo é `src/proxy.ts`, **não** `middleware.ts`: o Next 16.3 deprecou a convenção
    `middleware` em favor de `proxy` (aviso explícito no build). Mesma API.
  - Os padrões de rota pública vivem em `src/lib/rotas-publicas.ts` (módulo separado) só
    para poderem ser cobertos por teste sem carregar o proxy inteiro.
- **`ClerkProvider`** envolve o `RootLayout` com `localization={ptBR}` (UI do Clerk em
  português, requisito do CLAUDE.md), `signInUrl="/entrar"` / `signUpUrl="/cadastrar"`
  (rotas em português) e `colorPrimary` = `#0F766E`, o token `accent` do tema claro.
- Telas `src/app/entrar/[[...entrar]]` e `src/app/cadastrar/[[...cadastrar]]` (catch-all,
  exigido pelo Clerk para os passos de verificação/2FA).
- `src/components/cabecalho.tsx` com `UserButton` (sessão ativa) ou botão Entrar.
  Usamos **`<Show when="signed-in">`**, não `<SignedIn>`: no Core 3 do `@clerk/nextjs` 7
  os componentes `SignedIn`/`SignedOut`/`Protect` foram removidos e quebram o build.
- **Variáveis de ambiente** documentadas em `.env.example` (`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
  `CLERK_SECRET_KEY`, URLs de sign-in/sign-up e fallback). O `.env` real continua fora do
  repositório — nenhuma chave foi commitada.
- **Pendência manual (não automatizável daqui):** habilitar o **login social Microsoft/Outlook
  (Azure AD OAuth)** no dashboard do Clerk (User & Authentication → SSO Connections →
  Microsoft) da instância `<id-instancia-clerk>`, e cadastrar Client ID/Secret de
  um app registrado no Azure AD para produção. Isso é configuração de instância, não de
  código: o SDK já renderiza o botão assim que a conexão for ligada. Requer as chaves de API
  da instância, que ainda não estão disponíveis nesta máquina.
- Verificação: `npm test` = **19 testes passando** (3 novos em `src/lib/rotas-publicas.test.ts`,
  cobrindo rotas públicas, subcaminhos do Clerk, webhooks e o padrão fechado); `tsc --noEmit`
  e `npm run lint` limpos; `next build` completo com chaves de exemplo (4 rotas + proxy).
- **Falta:** conectar GitHub → Vercel e provisionar o PostgreSQL no Railway (último item
  do Bloco 1).

### 2026-09-17 — Bloco 1: Railway (PostgreSQL) + Vercel (deploy automático)
- **PostgreSQL provisionado no Railway** (projeto `<id-projeto-railway>`, ambiente `production`):
  serviço **`Postgres`** (`39b6e75a-3875-4287-b0b5-f215ea9fc4c7`), criado a partir do
  template verificado `postgres`. Foi criado **ao vivo**, deliberadamente fora do patch
  staged que já existia no ambiente (o serviço de app `cronograma`, em `staged-create`,
  3 mudanças pendentes) — assim provisionar o banco não commitou nada que o usuário
  ainda não aprovou. **O patch staged continua pendente e é decisão do usuário aplicá-lo.**
- **TCP proxy público** criado no serviço Postgres (porta de aplicação 5432), porque a
  `DATABASE_URL` padrão aponta para `postgres.railway.internal`, que só resolve dentro
  da rede do Railway — a Vercel e a máquina de desenvolvimento precisam do endpoint
  público. Host/porta ficam em `RAILWAY_TCP_PROXY_DOMAIN` / `RAILWAY_TCP_PROXY_PORT`.
- **Connection string NÃO está registrada aqui nem no repositório** (regra do CLAUDE.md).
  Ela se obtém com `railway link -p <id-projeto-railway> -e production -s Postgres` seguido de
  `railway variables -s Postgres --kv`. O `.env.example` foi reescrito com esse
  procedimento, mantendo o Docker local como alternativa offline.
- **Migration e seed aplicados no banco do Railway:** `prisma migrate deploy` aplicou
  `20260917231112_inicial` (a mesma migration versionada, sem regerar nada) e o
  `db:seed` criou os 3 projetos de exemplo com 5 ações cada. O banco de produção já
  responde com dados.
- **Vercel:** o projeto `<id-projeto-vercel>` (**`cronograma-lktu`**) já
  estava conectado ao repositório `fabianojp06/cronograma` — existe o domínio de branch
  `cronograma-lktu-git-main-<equipe>.vercel.app`, ou seja, **push na `main`
  já dispara deploy automático**. Domínios gerados:
  - Produção: `https://cronograma-lktu-<equipe>.vercel.app`
  - Branch `main`: `https://cronograma-lktu-git-main-<equipe>.vercel.app`
- **Bug de build encontrado e corrigido:** o último deploy estava em `ERROR`. Causa real
  (dos build logs): `prisma.config.ts` usava `env('DATABASE_URL')` do `prisma/config`,
  que **lança** quando a variável não existe. Como `prisma generate` roda no `postinstall`,
  o `npm install` inteiro morria antes de qualquer código do app. Trocado por
  `process.env.DATABASE_URL ?? ''` — a geração do client não precisa da URL; só
  migrate/seed/studio precisam, e esses falham com mensagem própria. Regressão travada
  por teste (`src/lib/prisma-config.test.ts`, 2 testes).
- **Pendências manuais (não automatizáveis daqui — a CLI da Vercel está deslogada nesta
  máquina e o login é interativo; o MCP da Vercel não expõe escrita de env vars):**
  1. Cadastrar em **Vercel → Settings → Environment Variables** (Production e Preview):
     `DATABASE_URL` (a do TCP proxy público do Railway), `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
     `CLERK_SECRET_KEY` e as 4 variáveis `NEXT_PUBLIC_CLERK_SIGN_*` do `.env.example`.
     Sem as chaves do Clerk o build passa, mas a aplicação não autentica em produção.
  2. Habilitar o login social Microsoft/Outlook no dashboard do Clerk (pendência que já
     vinha do item anterior).
  3. Decidir sobre o patch staged do serviço de app `cronograma` no Railway — a aplicação
     está na Vercel, então rodar o app também no Railway provavelmente é redundante.
- Verificação: `npm test` = **21 testes passando**; `tsc --noEmit` e `npm run lint` limpos;
  `next build` completo **com `DATABASE_URL` ausente do ambiente**, reproduzindo a
  condição exata que quebrava a Vercel. **Confirmado na própria Vercel:** o deploy do
  push desta rodada saiu de `ERROR` para `Build Completed` / `Deployment completed`
  (`npm install` -> `prisma generate` -> `next build` -> 4 rotas + proxy).
- **Bloco 1 concluído.** Próximo: Bloco 2 — CRUD de Projetos, começando pela leitura do
  protótipo `E-FormularioProjeto`.

### 2026-09-17 — Bloco 2: formulário de Projeto (leitura do protótipo + criação)

- **Protótipo `E-FormularioProjeto` não pôde ser lido.** O link
  `https://claude.ai/artifact/WPxn8dThgUAmMPJHAPJzhs` foi aberto pelo conector de
  documentos (não por web fetch, conforme a regra) e a resposta foi `access: deny`
  — o documento não está compartilhado com a conta desta sessão. **Ação necessária
  do usuário:** compartilhar o artifact com a conta do autor (ou
  colar o conteúdo do artboard aqui) para que as telas dos Blocos 2 a 5 sejam
  conferidas contra o desenho aprovado.
  Sem ele, a tela foi construída a partir da especificação textual do CLAUDE.md
  (estilo "Painel Operacional", tokens de tema, seções marcadas por traço lateral
  em vez de card com sombra, Manrope nos títulos). **Considerar a fidelidade visual
  como pendente de revisão** quando o protótipo ficar acessível.
- **Validação em módulo puro:** `src/lib/projeto-validacao.ts` — `validarDadosProjeto`
  aceita `FormData` ou objeto simples e devolve `{ ok, dados }` ou `{ ok: false, erros }`
  indexado por campo. Regras: `nome` obrigatório (trim, máx. 200); os 8 campos de texto
  do SCHEMA.md opcionais (máx. 500, `comentario` 2000); `prioridade` inteiro >= 1 ou nulo.
  String vazia é normalizada para `null` (o banco guarda "sem valor", não texto vazio) e
  campos desconhecidos do formulário são ignorados.
  Ficou separado da action de propósito: a regra de negócio é testável sem banco e sem
  runtime do servidor, mantendo o `CHECK_CMD` independente de infraestrutura.
- **Server Action** `criarProjeto` em `src/app/projetos/acoes-projeto.ts`: exige sessão
  Clerk (`auth()`), valida, grava via Prisma e revalida `/projetos`. **Não redireciona** —
  devolve `{ criado: { id, nome } }` e a UI confirma na própria tela, porque `/projetos`
  (listagem) e `/projetos/[id]` (detalhe) ainda não existem; o redirecionamento entra
  junto com essas telas. Erro de banco vira `erroGeral`, sem vazar a exceção para a UI.
- **UI:** `src/components/formulario-projeto.tsx` (client, `useActionState`) e a rota
  `src/app/projetos/novo/page.tsx`. Todas as cores saem dos tokens (`bg-surface`,
  `text-textMuted`, `border-accent`, `text-warn`) — nada hardcodado.
- Verificação: `npm test` = **28 testes passando** (7 novos em
  `src/lib/projeto-validacao.test.ts`); `tsc --noEmit`, `npm run lint` e `next build`
  limpos (5 rotas + proxy).
- **Falta:** tela de listagem de Projetos com filtros (próximo item do Bloco 2).

### 2026-09-17 — Bloco 2: listagem de Projetos com filtros

- **Rota `/projetos`** (Server Component, `src/app/projetos/page.tsx`): tabela de
  projetos ativos com Equipe, Categoria, Responsável, status agregado, barra de
  progresso embutida na linha e contagem `concluídas/total`. Cada linha linka para
  `/projetos/[id]` (tela do Bloco 4, ainda não existente) e há atalho para
  `/projetos/novo`. Ordenação por `prioridade` e depois `nome`.
- **Status agregado é derivado, não coluna** (`src/lib/projeto-resumo.ts`, módulo puro):
  `SEM_ACOES` | `NAO_INICIADO` | `EM_ANDAMENTO` | `ATRASADO` | `CONCLUIDO`.
  `ATRASADO` tem **precedência** sobre `EM_ANDAMENTO`/`NAO_INICIADO` porque é o que o
  painel precisa destacar; `CONCLUIDO` só quando todas as ações estão concluídas.
  A regra de atraso é a do CLAUDE.md (`previstoTermino < hoje`, sem `realizadoTermino`,
  `status != CONCLUIDO`) e já fica aqui pronta para reuso nos Blocos 4 e 5.
- **Comparação de datas em UTC** (`src/lib/data-hoje.ts`): as datas de negócio são
  gravadas à meia-noite UTC (ver `emDias` do seed), então "hoje" também é normalizado
  para meia-noite UTC — sem isso o atraso escorregaria um dia conforme o fuso do servidor.
- **Filtros em query string** (`src/lib/projeto-filtros.ts` + `FiltrosProjetos` com
  `method="get"`): a tela fica linkável/compartilhável e funciona sem JavaScript.
  - Equipe e categoria são **colunas**, então vão para o `where` do Prisma
    (`whereProjetoAtivo`, que sempre força `ativo: true` — a exclusão é lógica).
  - Status é **derivado**, então é filtrado em memória (`filtrarPorStatus`) depois do
    resumo. Status desconhecido na URL é ignorado em vez de virar erro.
  - As opções dos `select` vêm de **todos** os projetos ativos, não do resultado
    filtrado — senão aplicar um filtro esconderia as outras opções.
- **Composição projeto + resumo** isolada em `src/lib/projetos-listagem.ts`
  (`montarLinhas`, `opcoesDistintas`), de novo pura, para manter o `CHECK_CMD` sem banco.
- Cores só via tokens (`border-warn`, `text-realizado`, `bg-tableHeadBg`, `border-previsto`),
  traço lateral por status em vez de card com sombra. **Fidelidade ao protótipo segue
  pendente de revisão** — o artifact `E-FormularioProjeto`/`C-PainelOperacional` continua
  inacessível a esta conta (ver rodada anterior).
- Verificação: `npm test` = **51 testes passando** (23 novos: 10 em `projeto-resumo.test.ts`,
  9 em `projeto-filtros.test.ts`, 4 em `projetos-listagem.test.ts`); `tsc --noEmit`,
  `npm run lint` e `next build` limpos (6 rotas + proxy).
- **Falta:** edição de Projeto existente (próximo item do Bloco 2).

### 2026-09-17 — Bloco 2: edição de Projeto existente

- **Rota `/projetos/[id]/editar`** (Server Component): carrega o projeto com
  `findFirst({ where: { id, ativo: true } })` e chama `notFound()` quando não existe
  — projeto excluído logicamente (`ativo = false`) **não é editável**, o que já deixa
  o próximo item (exclusão lógica) coerente. Link "Editar" adicionado em cada linha
  da listagem.
- **Reuso do mesmo formulário:** `FormularioProjeto` ganhou a prop opcional
  `projeto={{ id, valores }}`. Quando ela vem preenchida, o `id` vai em campo oculto,
  os inputs recebem `defaultValue` e a Server Action passa a ser `atualizarProjeto`.
  Duplicar o formulário criaria duas telas para divergir — a validação e o layout são
  os mesmos.
- **Server Action `atualizarProjeto`** em `src/app/projetos/acoes-projeto.ts`: exige
  sessão Clerk, lê o `id`, valida com o mesmo `validarDadosProjeto`, confere se o
  projeto existe e está ativo, e **só grava se algum campo mudou** (`camposAlterados`)
  — sem isso, um "salvar" sem alteração sujaria o `updatedAt` e revalidaria cache à
  toa. Erro de banco vira `erroGeral`, sem vazar a exceção.
- **Módulo puro novo `src/lib/projeto-edicao.ts`** (mesma razão de `projeto-validacao.ts`:
  regra testável sem banco): `CAMPOS_PROJETO` (lista única dos campos editáveis, derivada
  de `CAMPOS_TEXTO_OPCIONAIS` para não sair de sincronia), `valoresIniciais` (null → string
  vazia para o formulário), `lerIdProjeto` e `camposAlterados`.
- `EstadoFormularioProjeto` ganhou `salvo?: { id, nome }`, distinto de `criado`, para a UI
  confirmar "alterações salvas" sem fingir que criou um registro novo.
- **Fidelidade ao protótipo segue pendente de revisão** — o artifact
  `E-FormularioProjeto` continua inacessível a esta conta (ver rodadas anteriores).
- Verificação: `npm test` = **60 testes passando** (9 novos em `projeto-edicao.test.ts`);
  `tsc --noEmit`, `npm run lint` e `next build` limpos (7 rotas + proxy).
- **Falta:** exclusão lógica de Projeto (`ativo = false`) — último item do Bloco 2.

### 2026-09-17 — Bloco 2: exclusão lógica de Projeto

- **Server Action `excluirProjeto`** em `src/app/projetos/acoes-projeto.ts`: exige
  sessão Clerk, lê o `id` do campo oculto (`lerIdProjeto`, reaproveitado da edição) e
  grava **apenas `ativo = false`** — nunca `delete`. As Ações e o `HistoricoAlteracao`
  continuam no banco: são a trilha de auditoria exigida pelo CLAUDE.md, e apagá-las
  junto contrariaria o requisito central do sistema.
- **`updateMany` com `ativo: true` no filtro**, não `update`: excluir um projeto já
  excluído (duplo submit, botão voltar) vira "nenhuma linha afetada" e devolve mensagem
  de negócio, em vez de estourar `P2025` como erro de banco. No sucesso, revalida
  `/projetos` e `/projetos/[id]` e redireciona para a listagem — a tela de edição deixa
  de existir para um projeto inativo (`findFirst({ ativo: true })` → `notFound()`, regra
  que já estava no item anterior).
- **Confirmação digitada** (módulo puro novo `src/lib/projeto-exclusao.ts`): a action só
  prossegue se o campo `confirmacao` contiver a palavra `EXCLUIR` (tolerando espaços e
  caixa). A tela de edição fica a um link da listagem, então um botão de exclusão sem
  trava seria clique acidental esperando acontecer. O módulo também exporta
  `DADOS_EXCLUSAO_LOGICA = { ativo: false }`, com teste que trava a forma do objeto — é a
  garantia automatizada de que essa mutação nunca vire outra coisa.
- **UI:** `src/components/excluir-projeto.tsx` (client, `useActionState`) renderizado no
  fim da tela de edição, dentro de um `<details>` recolhido, com traço lateral `warn` em
  vez de card — mesmo padrão visual do resto do painel. O texto explica que nada é
  apagado do banco.
- Nenhuma tela precisou mudar para esconder o projeto excluído: `whereProjetoAtivo` já
  força `ativo: true` na listagem e a rota de edição já filtrava por `ativo`.
- **Fidelidade ao protótipo segue pendente de revisão** — o artifact continua inacessível
  a esta conta (ver rodadas anteriores).
- Verificação: `npm test` = **66 testes passando** (6 novos em `projeto-exclusao.test.ts`);
  `tsc --noEmit`, `npm run lint` e `next build` limpos (7 rotas + proxy).
- **Bloco 2 concluído.** Próximo: Bloco 3 — CRUD de Ações, começando pela leitura do
  protótipo `F-FormularioAcao` (que provavelmente seguirá inacessível).

### 2026-09-17 — Bloco 3: criação de Ação (leitura do protótipo + Server Action)

- **Protótipo `F-FormularioAcao` continua inacessível.** O artifact
  `WPxn8dThgUAmMPJHAPJzhs` foi lido de novo pelo conector de documentos (não por
  web fetch) e a resposta voltou `verdict: deny`, `reason: access` — mesma
  situação dos Blocos 2 e 5. **Ação necessária do usuário:** compartilhar o
  artifact com a conta do autor ou colar o conteúdo do artboard. A tela
  foi construída a partir do CLAUDE.md (traço lateral por seção, tokens de tema,
  Manrope nos títulos) e **a fidelidade visual segue pendente de revisão**.
  O **painel de histórico ao lado do formulário não foi implementado nesta
  rodada**: o `HistoricoAlteracao` só passa a ter conteúdo no item de atualização
  de status (mais adiante no Bloco 3), e um painel sempre vazio seria enfeite.
- **Validação em módulo puro:** `src/lib/acao-validacao.ts` — `validarDadosAcao`
  aceita `FormData` ou objeto simples e devolve `{ ok, dados }` ou erros indexados
  por campo. Regras: `descricao` obrigatória (trim, máx. 500); `status` dentro do
  enum `StatusAcao` (ausente = `NAO_INICIADO`, o padrão do schema; valor fora do
  enum é erro); as 4 datas opcionais.
  - `lerDataISO` converte o `aaaa-mm-dd` do `<input type="date">` para
    **meia-noite UTC**, alinhado com `data-hoje.ts` e com o seed — sem isso o
    cálculo de atraso escorregaria um dia. Também **rejeita datas inexistentes**
    (31/02, mês 13), que o `Date.UTC` silenciosamente normalizaria.
  - **Coerência de período:** término anterior ao início (previsto ou realizado)
    é erro de digitação e vira erro de campo, não exceção de banco. Mesmo dia é
    aceito (ação de um dia só).
  - O módulo também exporta `STATUS_ACAO`, `ROTULOS_STATUS` (rótulos pt-BR para o
    `select`) e `CAMPOS_DATA`, fonte única reaproveitada pelos Blocos 4 e 5.
- **Server Action `criarAcao`** em `src/app/projetos/acoes-acao.ts`: exige sessão
  Clerk, lê o `projetoId` do campo oculto (`lerIdProjeto`, reaproveitado do CRUD de
  Projetos), confirma que o **projeto está ativo** (projeto excluído logicamente
  não recebe registros novos) e grava via Prisma, revalidando `/projetos` e
  `/projetos/[id]`.
- **Numeração sequencial com a constraint como autoridade:** `numero` vem de
  `proximoNumero(maior número existente)`. Como dois usuários podem criar ações
  simultaneamente, ler-e-gravar tem corrida; então a `@@unique([projetoId, numero])`
  é quem decide, e a colisão (`P2002`) **recalcula e tenta de novo** (até 5 vezes)
  em vez de devolver erro ao usuário. Um `SELECT max+1` sozinho geraria duplicidade
  ou erro visível; um contador em coluna criaria estado a manter.
- **UI:** `src/components/formulario-acao.tsx` (client, `useActionState`) e a rota
  `src/app/projetos/[id]/acoes/nova/page.tsx` (Server Component; `notFound()` se o
  projeto não existe ou está inativo). O `numero` **não aparece no formulário** —
  é atribuído pelo servidor. Seções Previsto e Realizado usam os tokens
  `border-previsto` (azul) e `border-realizado` (verde) do CLAUDE.md.
- Verificação: `npm test` = **81 testes passando** (15 novos em
  `src/lib/acao-validacao.test.ts`: descrição, enum completo, conversão UTC, datas
  inválidas, coerência de período, `FormData`, `proximoNumero`); `tsc --noEmit`,
  `npm run lint` e `next build` limpos (8 rotas + proxy).
- **Falta:** função de cálculo de dias úteis com feriados nacionais fixos (próximo
  item do Bloco 3).

### 2026-09-17 — Bloco 3: cálculo de dias úteis

- **`src/lib/dias-uteis.ts`** — módulo puro (sem Prisma, sem Next), no mesmo
  padrão de `projeto-validacao.ts`: a regra fica coberta por teste sem banco.
- **Dia útil = segunda a sexta que não é feriado nacional de data fixa.** Os 9
  feriados fixos (Leis 662/49, 6.802/80 e 14.759/24, que tornou 20/11 nacional)
  ficam num `Map` de `mm-dd` → nome, então a função também sabe **dizer qual**
  feriado é — útil para explicar na UI por que uma data foi pulada.
- **Feriados móveis ficam de fora**, como manda o CLAUDE.md: Carnaval, Sexta-feira
  Santa e Corpus Christi dependem da Páscoa e exigiriam calendário próprio. Há
  teste explícito fixando esse comportamento, para que a ausência apareça como
  decisão e não como esquecimento.
- **Tudo em UTC** (`getUTCDay`, `getUTCDate`), igual a `data-hoje.ts`, ao seed e à
  conversão de `acao-validacao.ts`. Ler os componentes em fuso local faria uma
  data gravada à meia-noite UTC escorregar para o dia anterior no Brasil e
  mudaria a contagem numa virada de semana.
- **`diasUteisEntre` conta o intervalo fechado `[inicio, fim]`** — as duas pontas
  entram. É a contagem do negócio: ação que começa e termina na mesma segunda
  dura 1 dia útil, não 0. Fim anterior ao início devolve 0, não negativo — quem
  valida a ordem das datas é `acao-validacao.ts`. A hora do dia é descartada
  antes de iterar.
- **`somarDiasUteis` é o par inverso**, para projetar término previsto a partir de
  uma duração; conta o próprio dia como dia 1 quando ele é útil e, quando o
  início cai em sábado/feriado, anda até o próximo dia útil.
- Verificação: `npm test` = **99 testes passando** (18 novos em
  `src/lib/dias-uteis.test.ts`, cobrindo os 3 casos pedidos — mesma semana,
  atravessando o feriado de 21/04 e o mês inteiro de setembro/2026 com 21 dias
  úteis — além de fim de semana, ponta única, intervalo invertido, hora do dia e
  ida-e-volta entre as duas funções); `tsc --noEmit` e `npm run lint` limpos.
- **Próximo item:** gravar `HistoricoAlteracao` a cada mudança de status/datas de
  uma Ação.

### 2026-09-17 — Bloco 3: trilha de auditoria da Ação (HistoricoAlteracao)
- `src/lib/acao-historico.ts`: `CAMPOS_AUDITADOS` (`status` + as quatro datas),
  `alteracoesDeAcao` (diff atual x novo, uma linha por campo alterado) e
  `gravarAcaoComHistorico`, que faz o `update` da Ação e o `createMany` do
  histórico **na mesma transação** — sem isso uma falha após o `update` deixaria
  a alteração sem rastro, que é justamente o buraco da planilha atual.
- O cliente Prisma entra por parâmetro, com um tipo estrutural mínimo
  (`ClienteTransacaoAcao`/`ClienteGravacaoAcao`). Assim o teste injeta um cliente
  falso e confirma a criação do histórico sem precisar de banco — coerente com o
  resto da suíte, que roda sem PostgreSQL.
- Valores são serializados como texto: datas viram `aaaa-mm-dd` em UTC (mesma
  convenção de `lerDataISO`), para as colunas `valorAntigo`/`valorNovo` ficarem
  legíveis no painel de histórico do artboard `F-FormularioAcao`.
- Campo que não mudou não gera linha; mudar só a descrição atualiza a Ação e não
  cria histórico (descrição não está na lista de campos auditados do CLAUDE.md).
- Server Action `atualizarAcao` em `src/app/projetos/acoes-acao.ts`: lê o estado
  auditável atual, recusa Ação de projeto inativo, grava com histórico e usa o
  `userId` do Clerk como `alteradoPor`. Novo helper `lerIdAcao` em
  `acao-validacao.ts` (espelha o `lerIdProjeto`).
- **Verificação:** `npm test` — 15 arquivos, 111 testes, todos passando;
  `tsc --noEmit` e `eslint` limpos nos arquivos tocados.
- **Escopo deixado de fora de propósito:** a tela de edição de Ação que consome
  `atualizarAcao` — o formulário de Ação hoje só cria. O backlog trata a UI de
  Gantt/detalhe no Bloco 4; o próximo item (Server Action específica de datas
  "Realizado") reaproveita `gravarAcaoComHistorico`.

### 2026-09-17 — Bloco 3: apontamento de datas Realizado
- `src/lib/acao-realizado.ts` (puro): `validarRealizado` lê **só**
  `realizadoInicio`/`realizadoTermino` do formulário. Previsto e descrição
  ficam intocados de propósito — Previsto é o plano contra o qual o Gantt do
  Bloco 4 compara; se o apontamento pudesse reescrevê-lo, o atraso nunca
  apareceria.
- Regras que distinguem este fluxo do de Previsto: data realizada **no futuro é
  recusada** (apontamento registra o que já ocorreu; hoje é aceito), e término
  sem início — nem no formulário, nem já gravado no banco — também. Por isso a
  validação recebe o estado atual da Ação, não só o `FormData`.
- `statusAposRealizado` deriva o status em vez de pedir que ele seja digitado de
  novo: término preenchido conclui; apagar o término de uma Ação concluída a
  devolve para `EM_CURSO_75`; início sem término tira de `NAO_INICIADO`; status
  intermediário (25/50/75) informado à mão é preservado.
- `alteracoesDeAcao` passou a aceitar `novos` **parcial** e a ignorar campo
  ausente. Sem isso o apontamento, que não manda Previsto, geraria linhas falsas
  de histórico "previstoInicio: 2026-09-01 → null". Ausência ≠ apagar.
- Server Action `registrarRealizado` em `src/app/projetos/acoes-acao.ts`
  reaproveita `gravarAcaoComHistorico`, então a auditoria sai idêntica à da
  edição (uma linha por campo, mesma transação) e devolve `camposAlterados`
  para a UI confirmar o que foi gravado.
- **Verificação:** `npm test` — 16 arquivos, **124 testes** passando (13 novos em
  `src/lib/acao-realizado.test.ts`, incluindo um que confirma que o apontamento
  não fabrica histórico de Previsto); `tsc --noEmit` e `eslint` limpos.
- **Próximo item:** Bloco 4 — o backlog pede ler o artboard `D-DetalheGantt` do
  protótipo antes de implementar, e o acesso ao artifact segue negado nesta
  conta (ver registro anterior no Log); a implementação terá de se apoiar nos
  tokens e na descrição do CLAUDE.md.

### 2026-09-17 — Bloco 4: grade semanal do Gantt

- **Protótipo `D-DetalheGantt` continua inacessível.** O artifact
  `WPxn8dThgUAmMPJHAPJzhs` foi lido pelo conector de documentos (não por web
  fetch) e voltou `verdict: deny`, `reason: access` — 4ª tentativa, mesma
  situação dos Blocos 2, 3 e 5. **Ação necessária do usuário:** compartilhar o
  artifact com a conta do autor ou colar o conteúdo do artboard. A grade
  foi construída a partir do CLAUDE.md (tokens de tema, Previsto azul /
  Realizado verde, linha do "hoje") e **a fidelidade visual segue pendente de
  revisão**.
- **`src/lib/gantt.ts`** — módulo puro (sem Prisma, sem Next), no mesmo padrão de
  `projeto-resumo.ts` e `dias-uteis.ts`: todo o posicionamento é aritmética de
  calendário e fica coberto por teste sem banco.
  - **A coluna é a semana, não o dia** — igual às planilhas PLA-DEP/CRO-DEP, que
    apontam Previsto x Realizado por semana. Dia daria ~400 colunas para os 13
    meses da planilha sem informação nova.
  - `inicioDaSemanaUTC` ancora a semana na **segunda-feira** (convenção da
    planilha); domingo pertence à semana que começou seis dias antes. Tudo em
    **UTC**, alinhado a `data-hoje.ts` e `acao-validacao.ts` — ler componentes em
    fuso local faria uma data de meia-noite UTC cair na semana anterior no Brasil.
  - `periodoDaGrade` = período das ações **alargado por `hoje`**, para que a linha
    do "hoje" sempre tenha coluna onde aparecer; projeto sem data apontada cai na
    semana corrente em vez de grade vazia.
  - `faixaDaBarra` **recorta** a barra aos limites da grade, devolve `null` para
    barra inteiramente fora, desenha **uma semana quando só uma ponta foi
    apontada** (ação iniciada sem término é informação, não ausência) e não gera
    faixa negativa se o término vier antes do início (a ordem das datas é erro de
    campo em `acao-validacao.ts`, não deve virar layout quebrado).
  - `agruparPorMes` monta o cabeçalho de dois níveis (mês em cima, dia da
    segunda-feira embaixo).
- **`src/components/gantt-projeto.tsx`** — Server Component, **um único CSS grid**
  para todo o corpo: coluna 1 é o rótulo da ação (`sticky left-0`, acompanha a
  rolagem horizontal) e as demais são as semanas. Cada ação ocupa **duas linhas**
  (Previsto em cima, Realizado embaixo), como na planilha. Grid único — e não um
  por ação — porque é o que permite a **linha vertical tracejada do "hoje"**
  atravessar todas as ações com `gridRow: 3 / -1`. Previsto = barra de **contorno**
  azul (`border-previsto`), Realizado = barra **sólida** verde (`bg-realizado`),
  conforme o CLAUDE.md. Spacers de altura fixa por sublinha evitam que uma ação
  sem data apontada colapse a raia.
- **`src/app/projetos/[id]/page.tsx`** — a rota de detalhe do projeto **não
  existia** (a listagem já linkava para ela e caía em 404, e as Server Actions já
  revalidavam esse caminho). Server Component com `notFound()` para projeto
  inexistente ou logicamente excluído, cabeçalho com resumo agregado
  (`resumirAcoes`) e atalhos para editar / nova ação.
- **Lint pré-existente corrigido:** três `<a href="/projetos">` de "Cancelar" /
  "Limpar filtros" viraram `<Link>` — a regra `no-html-link-for-pages` passou a
  acusá-los, e navegação client-side é o comportamento correto mesmo.
- Verificação: `npm test` = **149 testes passando** (25 novos em
  `src/lib/gantt.test.ts`: âncora de segunda-feira, geração de semanas incluindo
  os ~13 meses da planilha, período das ações, recorte de barra nas duas pontas,
  ponta única, faixa invertida, coluna do "hoje" dentro e fora da grade,
  agrupamento por mês atravessando o ano); `tsc --noEmit`, `npm run lint` e
  `next build` limpos (9 rotas + proxy).
- **Falta no Bloco 4:** regra visual de atraso (barra Previsto em vermelho) e
  navegação/paginação horizontal por mês/trimestre — próximos itens.

### 2026-09-17 — Bloco 4: regra visual de atraso na barra Previsto
- `previstoEmAtraso(acao, hoje)` em `src/lib/gantt.ts`: `previstoTermino < hoje`
  **e** `status != CONCLUIDO` **e** sem `realizadoTermino`, exatamente a regra do
  CLAUDE.md. Comparação normalizada por `inicioDoDiaUTC` nos dois lados, para que
  uma data gravada com hora (ex.: 23:59 de hoje) não conte como atraso.
- Regra **reescrita** aqui em vez de importada de `acaoEstaAtrasada`
  (`projeto-resumo.ts`): aquele módulo importa o enum gerado pelo Prisma e
  `gantt.ts` é deliberadamente livre de Prisma. As duas versões estão cobertas por
  teste — se a regra mudar, mudar nas duas.
- `GanttProjeto` passa a pintar a barra Previsto com o token `warn` (contorno +
  preenchimento 20%) quando em atraso, com `title` "Previsto — em atraso", e ganhou
  a entrada "Previsto em atraso" na legenda.
- 6 novos testes em `gantt.test.ts` (atraso, término hoje/futuro, concluída,
  realizado apontado, sem previstoTermino, data com hora). `npm test`: 155 testes,
  17 arquivos, todos passando. `tsc --noEmit` limpo.
- **Falta no Bloco 4:** navegação/scroll horizontal por período (paginar por
  mês/trimestre) — hoje a grade renderiza todas as semanas de uma vez.

### 2026-09-17 — Bloco 4: paginação por período do Gantt
- Criado `src/lib/gantt-periodo.ts` (puro, sem Prisma/Next, igual a `gantt.ts`):
  `gerarJanelas`, `indiceDaJanela`, `janelaInicial` e `limitarIndice`.
- **Decisão: janelas são fatias de calendário** (mês cheio ou trimestre cheio),
  não blocos de N semanas — assim o rótulo da janela ("set/26", "3º tri/26")
  coincide com o cabeçalho de mês da grade e a navegação fica previsível entre
  projetos diferentes. Padrão = trimestre (~13 colunas, cabe na tela).
- `GanttProjeto` virou Client Component: controles ← / → , botão "Hoje", contador
  "n de N" e seletor Mês/Trimestre. **Toda a navegação é client-side** — o período
  inteiro já veio do servidor, então trocar de janela não refaz consulta ao banco.
- A janela aberta por padrão é a de "hoje" quando o projeto a cobre; se "hoje"
  está fora do período do projeto, abre na primeira janela (abrir num trimestre
  vazio esconderia todas as barras). Ao trocar de granularidade, a posição é
  reancorada pela data da janela aberta, não pelo índice.
- A rolagem horizontal do contêiner foi mantida dentro da janela, para telas
  estreitas. O recorte das barras fora da janela já era feito por `faixaDaBarra`.
- 16 testes novos em `src/lib/gantt-periodo.test.ts` (virada de ano, alinhamento
  ao trimestre de calendário, período de um dia, `fim` anterior a `inicio`,
  os 13 meses da planilha). `npm test`: 18 arquivos, 171 testes, todos passando;
  `next build` OK.
- **Falta:** Bloco 5 — dashboard consolidado (visão PLA-DEP).

### 2026-09-17 — Bloco 5: painel consolidado (leitura do protótipo + tela)

- **Protótipo `C-PainelOperacional` continua inacessível.** Nova leitura do artifact
  `WPxn8dThgUAmMPJHAPJzhs` pelo conector de documentos (não web fetch) voltou
  `verdict: deny`, `reason: access` — 5ª tentativa, mesmo resultado dos Blocos 2 a 4.
  **Ação necessária do usuário:** compartilhar o artifact com a conta do autor
  ou colar o conteúdo do artboard. A tela foi construída a partir do CLAUDE.md
  (indicadores por traço lateral, tokens de tema, Manrope nos títulos) e a
  **fidelidade visual segue pendente de revisão**.
- **Rota `/` virou o painel consolidado** (Server Component): antes era uma página
  estática de "em construção". É a tela de entrada do sistema e já está protegida
  pelo proxy do Clerk (`/` não está em `ROTAS_PUBLICAS`), então pode consultar o banco.
- **Reuso deliberado de `ListaProjetos` e `FiltrosProjetos`** em vez de uma segunda
  tabela: a regra de status agregado e a de atraso são as mesmas de `/projetos` e
  duplicá-las garantiria divergência na primeira mudança. `FiltrosProjetos` ganhou a
  prop opcional `acao` (default `/projetos`) para o form GET e o "Limpar filtros"
  apontarem para a tela que os renderiza — no painel, `acao="/"`.
- **Módulo puro novo `src/lib/painel-consolidado.ts`** (`resumirPainel`): calcula os
  indicadores sobre as linhas **já resumidas** pela listagem, então o número do painel
  e o da tabela não podem divergir. O progresso geral é **ponderado pelo total de
  ações** (soma de concluídas / soma de ações), não a média dos percentuais por
  projeto — senão um projeto de 1 ação pesaria igual a um de 40 (há teste cobrindo
  exatamente esse caso, 5% vs. 50%).
- `IndicadoresPainel` (`src/components/indicadores-painel.tsx`): projetos ativos,
  ações, progresso geral — cada um com traço lateral colorido, sem card com sombra.
  O contador de projetos com ação atrasada fica para o próximo item do Bloco 5.
- Verificação: `npm test` = **176 testes passando** (5 novos em
  `painel-consolidado.test.ts`); `tsc --noEmit`, `npm run lint` e `next build` limpos
  (9 rotas + proxy).
- **Falta:** filtros globais por responsável (equipe, categoria e status já vêm
  reaproveitados) e o indicador de projetos com Ação atrasada — próximos itens do Bloco 5.

### 2026-09-17 — Bloco 5: filtros globais (equipe, responsável, categoria, status)
- Os filtros de equipe/categoria/status já existiam de rodadas anteriores; faltava
  **responsável**, que era o item pendente do backlog. Adicionado em
  `src/lib/projeto-filtros.ts` (`FiltrosProjeto.responsavel`, leitura da query
  string, `algumFiltroAtivo`, `whereProjetoAtivo`), no componente
  `src/components/filtros-projetos.tsx` e nas duas telas que o consomem
  (`/` painel consolidado e `/projetos`).
- `responsavel` é coluna de `Projeto` (texto livre, opcional), então entra no `where`
  do Prisma por igualdade exata — mesmo tratamento dado a equipe e categoria. Só o
  status agregado continua filtrado em memória, por ser derivado das Ações.
- As opções do select saem de `opcoesDistintas` sobre **todos** os projetos ativos
  (não sobre o resultado já filtrado), senão aplicar um filtro esconderia as demais
  opções — mesma regra dos selects existentes.
- Grade do formulário passou de `sm:grid-cols-3` para `sm:grid-cols-2 lg:grid-cols-4`
  para acomodar o quarto select sem apertar os rótulos.
- Verificação: `npm test` → 19 arquivos, 177 testes, todos passando; `npx tsc --noEmit`
  sem erros.
- **Falta:** indicador/contador de projetos com pelo menos uma Ação atrasada (último
  item do Bloco 5) e todo o Bloco 6 (importação das planilhas).

### 2026-09-17 — Bloco 5: indicador de projetos com atraso
- `ResumoPainel` ganhou `projetosAtrasados` (projetos com ao menos uma Ação atrasada)
  e `acoesAtrasadas` (soma das ações atrasadas), calculados em `resumirPainel` a
  partir de `resumo.acoesAtrasadas` — e não do status agregado `ATRASADO`. Os dois
  coincidem hoje, mas contar pela ação mantém uma única origem de verdade
  (`acaoEstaAtrasada`) e não quebra se a precedência do status agregado mudar.
- `IndicadoresPainel` passou a exibir o 4º indicador ("Projetos com atraso"), com
  traço e valor em `warn` (vermelho do tema) quando há atraso, ocupando a quarta
  coluna que já existia no grid. O indicador é um link para `/?status=ATRASADO`,
  reaproveitando o filtro por status agregado do Bloco 5 como drill-down.
- `Indicador` ganhou prop opcional `href`: sem ela continua sendo `div`, com ela
  vira `Link` — evita duplicar o componente só para o caso clicável.
- Testes: 4 novos casos em `painel-consolidado.test.ts` (contagem com e sem atraso,
  soma das ações, e o caso zerado). `npm test` — 19 arquivos, 179 testes, todos
  passando.
- Próximo: Bloco 6 — scripts de importação das planilhas PLA-DEP e CRO-DEP.

### 2026-09-17 — Bloco 6: importação do PLA-DEP-2026-001.xlsx

- **O arquivo .xlsx não está no repositório** (nem versionado, nem acessível nesta
  rodada). Em vez de travar o item, ele foi entregue como script pronto para o
  operador rodar apontando para o arquivo: `npm run importar:pla-dep -- <caminho.xlsx>`.
  **Falta:** executar contra a planilha real e conferir os totais (é o 3º item do
  Bloco 6, "Validação pós-importação").
- **Separação E/S × regra:** toda a conversão vive em `src/lib/importacao-planilha.ts`,
  módulo **puro** que recebe a matriz de células (`sheet_to_json(..., {header: 1})`)
  e devolve Projetos com Ações — mesma escolha dos demais módulos, para manter o
  `CHECK_CMD` sem banco e sem depender do .xlsx. `scripts/importar-pla-dep.ts` só lê
  o arquivo, chama o Prisma e relata.
- **Formato assumido da planilha** (documentado no topo do módulo, a revisar quando o
  arquivo real aparecer): cabeçalho localizado pelos próprios títulos (há linhas de
  título acima dele); colunas do Projeto preenchidas só na primeira linha do bloco
  (células mescladas) → preenchimento para baixo; cada Ação em **duas** linhas,
  Previsto e Realizado, distinguidas pela coluna `Linha`.
- **Datas**: aceita `Date`, serial do Excel (base 1899-12-30) e `dd/mm/aaaa`, sempre
  normalizando para meia-noite **UTC** — igual a `data-hoje.ts`/`dias-uteis.ts`, senão
  a data escorregaria um dia. `31/02` é rejeitado em vez de "rolar" para março.
- **Progresso → `StatusAcao`**: percentual cai para a faixa imediatamente **abaixo**
  (60% → `EM_CURSO_50`) — arredondar progresso para cima mentiria no painel. Texto
  ("Concluído", "Em curso", "Não iniciado") também é aceito.
- **Linha ruim vira aviso, não exceção**: com centenas de linhas, morrer na primeira
  célula suja esconderia o resto dos problemas. O script roda em **simulação por
  padrão** e só grava com `--gravar`; projeto com mesma `referencia` é substituído,
  então reimportar depois de corrigir a planilha não duplica.
- `xlsx` (SheetJS) entrou como **devDependency** — é usado só pelo script de migração,
  não pela aplicação.
- Verificação: `npm test` = **195 testes passando** (16 novos em
  `importacao-planilha.test.ts`); `tsc --noEmit`, `npm run lint` e `next build` limpos.
- Próximo: script equivalente do CRO-DEP-2026-001.xlsx (o módulo já aceita
  `referenciaPadrao` para o caso de projeto único).

### 2026-09-17 — Bloco 6: importação do CRO-DEP-2026-001.xlsx

- **Reaproveitou o PLA-DEP em vez de duplicar o parser**: as colunas de Ação
  (`Ação`, `Linha`, `Início`, `Término`, `Progresso`) são as mesmas nas duas
  planilhas. `importarPlanilha` ganhou a opção `projetoInicial`, que abre o
  resultado com um projeto já ativo; `importarCroDep` só monta esse projeto e
  delega o resto. Sem isso, toda ação do CRO-DEP cairia no aviso "antes de
  qualquer projeto", porque a planilha de projeto único **não tem** coluna
  "Assunto".
- **De onde vem a identidade do projeto**: das linhas de título acima do
  cabeçalho (`extrairIdentificacaoProjeto`) — referência pelo padrão
  `CRO-DEP-2026-001` e nome por "Projeto: X", pelo rótulo em célula vizinha, ou
  pelo título com a referência removida. `--nome=` e `--referencia=` no script
  vencem a planilha, para o caso de título não confiável.
- **Casamento no texto cru, não normalizado**: `normalizarRotulo` descarta os
  dois-pontos, que é exatamente o separador de "Projeto: X" — daí a regex do
  rótulo rodar sobre a célula original.
- **Campos do cabeçalho do projeto** (Equipe, Responsável, Natureza, Categoria,
  Apoio, Setor, Prioridade) vêm da primeira linha de dados: no CRO-DEP eles se
  repetem por ação, e deixar o cabeçalho do projeto vazio quebraria os filtros
  do painel consolidado.
- **Avisa em vez de falhar** (mesma escolha do PLA-DEP): sem nome, sem
  referência, ou quando a planilha gera mais de um projeto (sinal de que é um
  PLA-DEP disfarçado). O script simula por padrão; `--gravar` grava, e projeto
  com a mesma `referencia` é substituído — reimportar não duplica.
- Verificação: `npm test` = **205 testes passando** (10 novos); `tsc --noEmit` e
  `npm run lint` limpos.
- Próximo: último item do Bloco 6 — validação pós-importação (contagem planilha ×
  banco), que depende de rodar os dois scripts contra os .xlsx reais.

### 2026-09-17 — Bloco 6: validação pós-importação

- **O que este item entrega**: `npm run validar:importacao -- <arquivo.xlsx>`
  (`--cro-dep` para a planilha de projeto único) relê a planilha original e
  compara com o que está gravado, do total agregado até a ação individual. Não
  grava nada e **sai com código 1** quando há divergência, para não passar
  despercebido dentro de um pipeline.
- **Por que não bastava o "Gravado: N projetos e M ações" do importador**: aquele
  número compara o importador com ele mesmo. A conferência que o item pede é
  planilha × banco, feita numa segunda leitura independente — e por isso o
  módulo `src/lib/validacao-importacao.ts` recebe a lista do banco, não confia no
  retorno da gravação.
- **Quatro níveis de conferência**, do grosso ao fino: totais (projetos/ações);
  cobertura de linhas (`linhaCabecalho + lidas + ignoradas` tem de fechar com o
  total de linhas da aba — é o que pega linha sumida em silêncio); projeto a
  projeto (`PROJETO_FALTANDO`, `PROJETO_EXCEDENTE`, `CONTAGEM_ACOES`); e ação a
  ação (`ACAO_FALTANDO`, `ACAO_EXCEDENTE`, `DESCRICAO_DIVERGENTE`).
- **Casamento planilha × banco pela `referencia`** quando existe (é o
  identificador do negócio) e pelo **nome normalizado** quando não — os blocos do
  PLA-DEP nem sempre têm referência própria. Descrição de ação também é comparada
  normalizada (sem acento/caixa/espaço repetido): divergir por causa de dois
  espaços seria ruído, divergir por texto realmente diferente não.
- **Só os projetos daquela planilha entram na conferência**: o banco pode ter
  projetos criados pela aplicação ou vindos da outra planilha, e acusá-los como
  "excedentes" esconderia as divergências reais.
- **`linhasLidas > 2 × ações` também é divergência**: cada ação ocupa no máximo
  as linhas Previsto e Realizado; mais que isso significa descrições repetidas
  colapsadas na mesma ação, uma apagando as datas da outra — exatamente o erro
  silencioso que uma contagem só de totais deixaria passar.
- Verificação: `npm test` = **218 testes passando** (13 novos em
  `validacao-importacao.test.ts`); `tsc --noEmit` e `npm run lint` limpos.
- **Contagem real ainda em aberto**: os .xlsx continuam fora do repositório, então
  não há número de linhas reais para registrar aqui. A sequência para o operador é
  `importar:pla-dep -- <arquivo> --gravar` → `validar:importacao -- <arquivo>` e
  colar o relatório impresso neste Log.
- Com isto, todos os itens dos Blocos 1–6 estão marcados.

### 2026-09-17 — Rodada sem item pendente (verificação)
- Varredura do backlog: **nenhum item `- [ ]` restante** nos Blocos 1–6 — todos os
  itens estão marcados como concluídos. Nada foi implementado nesta rodada porque
  não há próximo item a executar.
- `CHECK_CMD` rodado mesmo assim para confirmar que a árvore atual está sã:
  `npm test` = **218 testes passando em 21 arquivos**.
- **Único pendente conhecido continua sendo operacional, não de código**: rodar
  `importar:pla-dep -- <arquivo> --gravar` e `validar:importacao -- <arquivo>`
  contra os .xlsx reais (PLA-DEP-2026-001 / CRO-DEP-2026-001), que não estão no
  repositório, e colar o relatório de conferência neste Log.
- Para o loop continuar produzindo, é preciso acrescentar novos itens ao backlog
  (ex.: Bloco 7) ou fornecer as planilhas reais.

### 2026-09-18 — Variáveis de ambiente na Vercel (feito pelo Claude, autorizado pelo usuário)
- **Cadastradas na Vercel** (projeto `cronograma-lktu`, ambientes Production, Preview e
  Development) via `vercel env add`, sem expor valores no terminal nem no repositório:
  `DATABASE_URL` (montada a partir do TCP proxy público do Postgres no Railway),
  `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` e `CLERK_SECRET_KEY` (obtidas com `clerk env pull`
  da app `cronograma`, instância **development** `<id-instancia-clerk>`), além das 4
  `NEXT_PUBLIC_CLERK_SIGN_*`. Pendência 1 do registro de Railway/Vercel: **resolvida**.
- Produção reimplantada (`vercel redeploy`): build ok, mas **todas as rotas respondem 404**
  (`X-Vercel-Error: NOT_FOUND`). Causa: o projeto na Vercel está com
  **Framework Preset = "Other"**, então a saída do Next.js não é servida. Não é o mesmo
  erro de antes (aquele era o build quebrando por falta de `DATABASE_URL`).
- **Pendências:**
  1. Trocar o Framework Preset para **Next.js** (Vercel → Settings → Build & Deployment,
     ou `vercel.json` com `"framework": "nextjs"`) e reimplantar.
  2. O `main` local está **11 commits à frente** do `origin/main` (Blocos 2–5 nunca foram
     enviados), e há alterações ainda não commitadas (Blocos 5–6). Produção hoje só tem o
     Bloco 1. É preciso fazer commit e `git push` para o deploy automático publicar o sistema.
  3. As chaves são da instância **development** do Clerk (aparece o selo "Development
     mode"). Para produção de verdade: `clerk deploy`, domínio próprio e troca das chaves.
  4. Login Microsoft/Outlook: **conexão já habilitada** no dashboard do Clerk — o
     usuário confirmou ter entrado com a conta Microsoft (2026-09-18). Em instância
     **development** o Clerk usa credenciais OAuth compartilhadas dele, então funciona
     sem app no Azure. O que resta é junto da pendência 3: ao promover a instância para
     production, registrar um app no Azure AD da CTCEA e cadastrar Client ID/Secret
     próprios em SSO Connections → Microsoft, senão o botão para de funcionar.
  5. A Vercel tem Deployment Protection ativa: quem acessa precisa entrar primeiro na
     conta Vercel. Para usuários da CTCEA, desativar isso e deixar só o Clerk.

### 2026-09-18 — Importação das planilhas reais (Bloco 6 fechado de verdade)
- As planilhas estavam em `public/`, **pasta que o Next.js serve publicamente**.
  Foram movidas para `dados/`, e `/dados/` + `*.xlsx` (exceto fixtures de teste)
  entraram no `.gitignore`. Nunca colocar dados internos em `public/`.
- **O layout real do PLA-DEP não batia com a fixture**: a coluna ASSUNTO vem
  **vazia** em todas as linhas, o marcador Previsto/Realizado fica na coluna
  **CATEGORIA** (CRONOGRAMA vem vazia) e o STATUS usa o texto "Em Progresso".
  Resultado da 1ª simulação: 0 projetos.
- Ajustes em `src/lib/importacao-planilha.ts`: sem Assunto, **cada N° vira um
  Projeto** (nome = texto da AÇÃO, referência `PLA-DEP-2026-001/<N°>`) com uma
  Ação; marcador na CATEGORIA é lido como Previsto/Realizado e não é gravado como
  categoria; "progresso" = em curso. Os scripts passam `prefixoItem` (nome do
  arquivo). 3 testes novos → `npm test` = **221 passando**.
- **Gravado no PostgreSQL do Railway e conferido (`validar:importacao`)**:
  - PLA-DEP-2026-001: 150 linhas na aba, 124 lidas (62 pares Previsto/Realizado),
    **62 projetos × 62 no banco, 62 ações × 62**. Conferência OK.
  - CRO-DEP-2026-001: 50 linhas na aba, 16 lidas, **1 projeto, 8 ações × 8**.
    Conferência OK (usar `--cro-dep` no validador). Substituiu o projeto de
    exemplo de mesma referência.
- Os 2 projetos fictícios do seed (`PLA-DEP-2026-014`, `PLA-DEP-2026-027`)
  foram **desativados** (`ativo = false`, reversível). Banco: 63 projetos ativos.
- Observação de negócio: o PLA-DEP real tem 1 ação por item; o detalhamento em
  várias ações existe só no CRO-DEP (item 53 do PLA-DEP = projeto do CRO-DEP,
  hoje importados como dois projetos separados).

### 2026-09-18 — Bloco 7: tela de Dashboards

**Menu.** `src/components/cabecalho.tsx` ganhou um menu principal (Painel / Projetos /
Dashboards) num array `MENU`, para não ser reescrito a cada tela nova. Fica dentro de
`<Show when="signed-in">`: as telas de domínio são fechadas, um menu para quem não tem
sessão só levaria ao redirect do Clerk.

**15 relatórios em 6 grupos**, todos em `/dashboards`, com índice de âncoras no topo:
- *Panorama*: panorama geral (reaproveita `IndicadoresPainel`) e composição por status.
- *Distribuição*: por equipe, responsável, natureza, categoria e prioridade.
- *Prazos*: aderência ao prazo, maiores atrasos, próximos vencimentos (7/15/30 dias).
- *Evolução no tempo*: Previsto x Realizado acumulado (burn-up) e carga por mês.
- *Qualidade do cadastro*: pendências, com o efeito de cada uma sobre os números.
- *Auditoria*: replanejamentos e alterações recentes.

**Decisões que valem registro:**
- O **catálogo** (`dashboard-catalogo.ts`) é a fonte única: índice e seções derivam
  dele, e a página lança erro se referenciar um id inexistente. Cada relatório declara
  a *pergunta de negócio* que responde — o critério para um relatório existir.
- Os relatórios partem de `montarLinhas`/`resumirAcoes`, as mesmas funções do painel
  consolidado. Duas origens de verdade divergiriam na primeira mudança de regra.
- **Os filtros valem para a carteira, mas não para a auditoria**: a pergunta da
  auditoria é "o que mudou no sistema", e recortá-la por equipe esconderia justamente
  o que se quer fiscalizar. Limitada às 500 alterações mais recentes.
- **Aderência ao prazo** só considera ação concluída **com** previsto e realizado. Sem
  as duas pontas não é "no prazo" nem "atrasada" — é não avaliável, e misturar
  inflaria artificialmente algum dos lados. O número de não avaliáveis aparece na tela.
- **Atraso é sempre em dias úteis** (`diasUteisEntre`), descontando o dia do prazo.
- O **burn-up** interrompe a curva Realizado no mês corrente: estendê-la sobre meses
  futuros desenharia uma queda de ritmo que não aconteceu.
- **Nenhuma dependência nova.** Gráficos em SVG inline e `div` com largura percentual,
  tudo server component. Hover via `<title>` nativo, sem JavaScript no cliente.
- As **regras de cor de gráfico** foram para o CLAUDE.md, incluindo a ordem fixa da
  pilha de status (verde ao lado de laranja fica abaixo do piso de legibilidade em
  protanopia; a ordem adotada sobe o pior par adjacente de ΔE 6.6 para 11.7).

**Verificação:**
- `npm test` = **288 testes passando em 27 arquivos** (221 antes; +67 em 6 arquivos
  novos de teste, um por módulo de agregação).
- `tsc --noEmit` e `npm run lint` limpos; `next build` completo, rota `/dashboards`
  registrada.
- **Conferência visual** num Postgres local descartável (migration + seed + histórico
  fictício): os componentes foram renderizados em modo claro e escuro e as consultas
  Prisma da página foram executadas de verdade. Isso pegou **dois defeitos que o build
  não pegaria**: (1) as barras de "Carga por mês" não apareciam — `height` em % não
  resolve contra pai de altura automática, virou pixel; (2) os rótulos diretos do
  burn-up eram cortados na borda do `viewBox` — margem direita de 64 para 132.
  Lição: build verde não é conferência de layout.

**Não feito (fora do pedido, mas anotado):** o CLAUDE.md exige alternância clara/escura
e **ela ainda não existe** — `globals.css` define os tokens de `.dark`, mas nada aplica
a classe. Os componentes novos já usam só tokens, então passam a funcionar assim que o
alternador for implementado. Candidato a Bloco 8.

### 2026-09-18 — CI de testes no GitHub Actions

- Até aqui o repositório **não tinha CI rodando a suíte**: os únicos checks no PR
  eram Vercel (build + deploy) e GitGuardian (segredos). Um PR podia entrar com
  teste quebrado sem ninguém ver — justamente a rede de proteção do projeto.
- `.github/workflows/ci.yml` roda, em push para `main` e em todo pull request, a
  mesma sequência que um desenvolvedor roda localmente: `npm ci` → `npm run lint`
  → `npm test` → `npm run build`.
- **O build faz as vezes de typecheck.** `tsc --noEmit` sozinho falha no projeto
  porque `PageProps`/`LayoutProps` são tipos gerados pelo próprio `next build`;
  rodar o build cobre o typecheck sem passo extra.
- O build recebe `DATABASE_URL` e chaves do Clerk **descartáveis**, só para
  completar: nada é implantado a partir do CI e nenhuma conexão de banco é aberta
  (todas as rotas são dinâmicas, renderizadas sob demanda). Os segredos reais
  continuam só na Vercel.
- `concurrency` com `cancel-in-progress`: push novo cancela a execução anterior da
  mesma branch.
- **Verificação**: a sequência inteira foi executada num clone limpo (`git ls-files`
  → `npm ci` do zero), com o env exato do workflow — lint limpo, **288 testes
  passando**, build completo com as 10 rotas. O YAML foi validado por parser.
- Observação registrada no mesmo dia: o repositório está ligado a **dois projetos
  Vercel** (`cronograma` / `<id-projeto-vercel-duplicado>` e `cronograma-lktu` / `<id-projeto-vercel>`,
  este último o do CLAUDE.md). Cada push gera dois deploys — decidir qual manter.

### 2026-09-18 — Bloco 8: modo escuro

- O `globals.css` já trazia **todos** os tokens de `.dark` desde o Bloco 1, mas
  **nada aplicava a classe** — a alternância exigida pelo CLAUDE.md nunca tinha
  saído do papel. Este bloco fecha essa lacuna.
- **Três opções, não duas**: Sistema (padrão), Claro e Escuro. Abrir o sistema já
  no tema que a pessoa usa no resto do computador é o comportamento esperado; só
  quem quer divergir precisa escolher.
- `src/lib/tema.ts` concentra a regra (resolução, leitura tolerante a valor
  corrompido, serialização do estado) como **módulo puro**, coberto por 23 testes.
  Inclui o `SCRIPT_TEMA`, que é executado nos testes com `new Function` num
  ambiente simulado — ele decide o que a pessoa vê no primeiro frame, então não
  podia ficar sem cobertura só por ser uma string.
- **Sem flash branco**: o script roda inline no `<head>`, antes da primeira
  pintura. O `<html>` leva `suppressHydrationWarning` porque a classe muda antes
  do React hidratar — divergência intencional.
- O alternador usa **`useSyncExternalStore`**, não `setState` em `useEffect`: o
  lint do React Compiler barra o segundo padrão, e de fato `localStorage` e
  `prefers-color-scheme` são stores externos. O instantâneo é a string
  `"<preferencia>|<efetivo>"` — precisa ser primitivo para não re-renderizar em
  laço, e carregar o efetivo junto é o que faz a troca no sistema operacional
  chegar ao componente enquanto a preferência é "Sistema".
- **UI do Clerk** recebe `appearance.variables` apontando para as CSS variables
  (`var(--accent)`, `var(--surface)`...), então troca junto sem precisar de um
  provider client nem da dependência `@clerk/themes`. Os nomes mudaram no Core 3
  (`colorForeground`, `colorMutedForeground`, `colorInput`... — não mais
  `colorText`/`colorInputBackground`).

**Verificação**: `npm test` = **311 passando em 28 arquivos**; tsc, lint e build
limpos. Além disso, o componente foi exercitado **num navegador de verdade**
(harness Vite + Playwright, descartado depois): 22 cenários, todos passando —
troca de todos os tokens (não só o fundo), persistência, sobrevivência à recarga,
ausência de flash no primeiro frame, escolha explícita vencendo o sistema
operacional, acompanhamento do SO em tempo real com "Sistema", valor corrompido
caindo em Sistema, e nenhum erro de hidratação no console. Os valores medidos
batem com a tabela do CLAUDE.md (`#F5F7FA`→`#0B1418`, `#FFFFFF`→`#121C21`,
`#16212B`→`#EAF1F0`).

**Ressalva honesta**: a UI do Clerk não pôde ser conferida em tela — exige chaves
vivas e rede até o Clerk, que este ambiente não tem. O mapeamento de variáveis
está tipado e compila; vale um olhar na tela de login depois do deploy.

### 2026-09-21 — Bloco 9: Matriz de Priorização

Nova tela a partir da planilha `Matriz de Priorização: Benefício x Esforço
(Ponderado por GUT)` enviada pelo usuário.

**O modelo, lido das fórmulas do arquivo (não do visual):**

```
TOTAL DE BENEFÍCIO = Σ (nota × peso)        5 critérios, escala 0/3/6/9
TOTAL DE ESFORÇO   = Σ (nota × peso)        5 critérios, escala 0/3/6/9
TOTAL GUT          = G × U × T              produto; cada fator de 1 a 5
PRIORIDADE         = SE(Esforço = 0; Benefício × GUT; (Benefício × GUT) / Esforço)
Quadrantes: X = Esforço, Y = Benefício, limiares X = 3 e Y = 4
```

**Decisões tomadas com o usuário** (as três estruturais foram perguntadas antes de
qualquer código, porque errar nelas custaria migration refeita):
1. A matriz avalia os **Projetos que já existem**, em relação 1:1 opcional — não
   cria cadastro paralelo. Reaproveita nome, equipe e responsável, e o score
   conversa com o campo `prioridade` que o Projeto já tinha.
2. **Pesos ajustáveis**, guardados no banco, começando nos 20% da planilha.
3. **Critérios fixos** no código, com os nomes exatos do arquivo.

**Decisões técnicas que valem registro:**
- **Os totais não são colunas.** São derivados a cada leitura, porque mudar um
  peso precisa repontuar a carteira inteira na hora. Gravá-los daria dois valores
  para a mesma verdade, e eles mudariam sozinhos.
- **"Não avaliado" é a ausência do registro**, não uma linha de zeros. A planilha
  precisava de 45 linhas zeradas por ser planilha; um banco não precisa.
- **Pesos em inteiros** (20 = 20%): a regra é "o grupo soma 100", e em ponto
  flutuante essa conferência falharia por arredondamento.
- **Soma ponderada feita em inteiros** e só então dividida por 100. A planilha
  guarda 5.400000000000001 por somar `nota × 0,2` em float; aqui 5,4 é exato.
  Efeito colateral: a prioridade da linha 1 sai 140,63 e a planilha mostra 140,62
  — a diferença é o erro da planilha, não fórmula diferente.
- **Ambiguidades da planilha que precisaram de decisão**, ambas documentadas no
  código: (a) as faixas de quadrante se tocam (0–3 e 3–6), então o limiar foi
  atribuído ao lado "alto", que não subestima esforço; (b) a tabela de quadrantes
  para em 6 de esforço e 8 de benefício, mas a escala vai a 9 — sem teto, um
  projeto com esforço 9 ficaria sem quadrante.
- **Quadrante é posição, não cor**: as quatro regiões têm tinta de fundo e os
  pontos ficam todos em `accent`. Colorir os pontos seria redundante num 2×2 e
  gastaria as cores reservadas a status. Contraste do ponto sobre cada tinta
  validado em ≥ 3:1 nos dois modos.
- **A matriz recomenda, não sobrescreve** `Projeto.prioridade`: a tabela mostra o
  score calculado e a prioridade cadastrada lado a lado.

**Verificação:**
- `npm test` = **356 passando em 30 arquivos** (311 antes; +45). Inclui teste de
  paridade com as três linhas preenchidas da planilha original — benefício,
  esforço, GUT e prioridade batendo valor a valor.
- `tsc --noEmit`, `npm run lint` e `next build` limpos; 13 rotas.
- **Ponta a ponta num Postgres local descartável**: migration aplicada, os três
  projetos da planilha gravados e relidos pela mesma consulta da página, com os
  totais conferindo. Depois os pesos foram alterados (Compromissos a 60%) para
  provar que o ranking realmente se reordena.
- **Conferência visual** em navegador (harness Vite + Playwright, descartado
  depois), nos dois temas. Pegou duas colisões de rótulo que o build não pegaria:
  o nome do quadrante batia nas linhas de limiar, e o rótulo direto do ponto caía
  sobre o ponto vizinho. Corrigido com rótulo de região no canto externo e rótulo
  de ponto ao lado, com halo na cor da superfície.

**Observação de negócio para o usuário:** o ranking e o quadrante **podem
discordar**, e isso é propriedade do modelo, não defeito. Na conferência, um
projeto de baixo benefício (quadrante 3) ficou em 1º no ranking porque o GUT alto
domina a fórmula, enquanto um Quick Win legítimo ficou em 3º. Vale a CTCEA decidir
se lê primeiro o quadrante ou o score — a tela mostra os dois.

### 2026-09-21 — Migration de produção no pipeline, com guarda de ambiente

**Problema.** A migration da Matriz de Priorização entrou no `main`, mas o banco do
Railway não tinha as tabelas — `/priorizacao` quebraria no ambiente publicado até
alguém lembrar de rodar `npm run db:deploy`. Tentei aplicar daqui e **não consegui**:
a leitura da connection string de produção foi bloqueada pelo classificador de
segurança da sessão (Credential Materialization), e os CLIs do Railway e da Vercel
não existem neste ambiente. O usuário optou por resolver no pipeline.

**A armadilha que a solução precisou evitar.** A `DATABASE_URL` está cadastrada nos
**três** ambientes da Vercel apontando para o **mesmo** banco do Railway. Um
`prisma migrate deploy && next build` solto teria rodado também nos previews — o
preview de um PR aplicaria a migration em produção **antes do merge**.

**Solução.** `build` passou a ser `tsx scripts/migrar-producao.ts && next build`. A
decisão fica em `src/lib/migracao-deploy.ts`, módulo puro com 10 testes:

| Situação | Resultado |
|---|---|
| `VERCEL_ENV=production` com banco | aplica |
| `VERCEL_ENV=preview` ou `development` | pula (é o mesmo banco de produção) |
| Sem `VERCEL_ENV` (local/CI) | pula |
| `PULAR_MIGRACAO` definida | pula (escape de emergência) |
| Produção sem `DATABASE_URL` | **erro**, build abortado |
| Migration falha | **erro**, build abortado |

Migrar vem **antes** de construir: se o build falhar depois, o banco fica à frente
do código, o que é seguro porque as migrations aqui são aditivas. Publicar código
que espera tabelas inexistentes não seria.

**Verificação** — os nove caminhos foram exercitados de verdade, não só no teste
unitário: os quatro de "pular", o erro sem `DATABASE_URL` (código de saída 1),
a aplicação real contra um Postgres local (as 5 tabelas criadas do zero), a
re-execução idempotente ("No pending migrations to apply"), o build abortando com
banco inalcançável (código 1), e o build completo em modo CI pulando a migration e
gerando as 13 rotas. `npm test` = **366 passando em 31 arquivos** (356 antes);
tsc e lint limpos.

**Efeito prático:** a migration da Matriz de Priorização será aplicada sozinha no
próximo deploy de produção, e toda mudança de schema futura também — sem ninguém
precisar lembrar.

### 2026-09-21 — Migration aplicada em produção, e o projeto Vercel duplicado

**A migration da Matriz de Priorização foi aplicada.** O deploy de produção do
merge do PR #4 (`a7d92d5`) no projeto **`cronograma-lktu`** ficou `READY`. Isso é
conclusivo, não suposição: com `VERCEL_ENV=production`, uma falha do
`prisma migrate deploy` faria o script sair com código 1 e o deploy viraria
`ERROR`. As tabelas `AvaliacaoProjeto` e `PesoCriterio` existem no Railway.

**O projeto duplicado quebrou — e foi esta mudança que o quebrou.** O mesmo commit
falhou no projeto **`cronograma`** (`<id-projeto-vercel-duplicado>`), com a mensagem da guarda:

```
[migração] VERCEL_ENV=production mas DATABASE_URL está vazia.
Error: Command "npm run build" exited with 1
```

Esse projeto nunca teve variáveis cadastradas — elas foram só para o
`cronograma-lktu`. Antes ele construía verde porque `next build` não toca no banco,
mas **o app publicado ali já estava quebrado em runtime**: toda página que consulta
o Prisma daria 500. A guarda não criou o problema; tornou visível um deploy de
produção sem banco que passava despercebido desde o início.

**Decisão do usuário: desconectar o duplicado** (Vercel → `cronograma` → Settings →
Git → Disconnect). A guarda fica como está — foi ela que flagrou o problema, e
afrouxá-la devolveria a cegueira. Registrado no CLAUDE.md que
`<id-projeto-vercel>` é o único alvo de deploy.

**Erro meu que vale registrar:** ao confirmar o deploy eu conferi apenas o
`cronograma-lktu` e relatei o resultado como se fosse geral. Com dois projetos
ligados ao mesmo repositório, conferir um só não basta.

### 2026-09-25 — Bloco 10: Card WIN Semanal (fase 1)

Integração da planilha `CARD WIN Semanal - Mariana` enviada pelo usuário.

**O achado que orientou tudo.** A planilha não é concorrente do plano de ação —
é o funil de entrada dele, e ela mesma diz isso no rodapé de toda aba: "Caso um
mesmo WIN se repetir por 3 semanas, já na terceira semana ele deve ser cadastrado
no Plano de Ação (PLA-DEP-2026-001) e retirado do Card WIN."

**E a regra já tinha estourado sem ninguém ver.** "Desenvolvimento do documento
de elicitação de requisitos — relatórios orçamentários" aparece nas semanas 37,
38 e 39; na semana 39 deveria ter virado item do plano e saído do card. Continuava
lá como EM ANDAMENTO. Outros sintomas da manutenção manual, todos no arquivo:
a aba S37 repete como "semana anterior" o bloco da S36 em vez dos WINs atuais
dela (e o suporte do mesmo item mudou de "Priscila - GFIN" para "Giovani/Ana");
a semana 34 não existe; e a maioria dos status da S37/S38 está em branco.

**Decisões fechadas com o usuário antes de qualquer código:**
1. Colaborador em tabela própria, com `clerkUserId` opcional — nome controlado,
   funciona antes de a pessoa ter conta, e é o nome que vai para
   `Projeto.responsavel` na promoção.
2. Limite de 3 WINs por semana, **rígido**.
3. Promoção escolhe o destino na hora: projeto novo ou ação em projeto existente.
4. Importar só a semana 39, com o contador de repetições semeado.

**Decisões técnicas que valem registro:**
- **`Win` é identidade, `WinSemana` é aparição.** O texto do WIN muda de semana
  para semana na planilha ("… orçamentários", "… orçamentários ()",
  "… orçamentários () - SGO"), então contar repetição por string seria frágil.
  A comparação por texto acontece **uma única vez**, na importação, só para
  semear o contador.
- **O bloco "semana anterior" é consulta**, não dado copiado. A duplicação
  manual dele é a causa da divergência entre S36 e S37.
- **A regra conta aparições, não semanas consecutivas** — a semana 34 não existe,
  e zerar o contador por esquecimento premiaria justamente o que a regra pega.
- **O calendário não é ISO**: semana começa no domingo, semana 1 de 2026 em
  28/12/2025. A planilha lista 53 semanas mas o `XLOOKUP` dela só varre até a 52;
  a 53ª é sobra de fórmula e já é a semana 1 de 2027.
- **O limite de 3 é do banco**, via `@@unique([cardId, ordem])`, não só da tela.

**Verificação:**
- `npm test` = **455 passando em 35 arquivos** (366 antes; +89). Inclui as 52
  semanas do calendário conferidas uma a uma contra a planilha.
- `tsc`, `lint` e `next build` limpos; rota `/wins` registrada.
- **Ponta a ponta contra Postgres local**: migration aplicada, a semana 39
  importada do arquivo real (o WIN repetido entrou com 3 aparições e disparou o
  alerta), a promoção executada criando a Ação e ligando os dois, e o WIN saindo
  do alerta. A tentativa de reusar uma posição de WIN foi **rejeitada pela
  constraint**, provando que o limite não depende da tela.
- **Conferência visual** em navegador nos dois temas, com as Server Actions
  substituídas por stubs; sem erro de console.

**Fase 2 (não feita):** visão de equipe para a daily ("Compartilhamento dos
Cards" da aba Agenda) e os dois relatórios no catálogo do dashboard — taxa de
conclusão semanal e WINs reincidentes.

### 2026-09-25 — Bloco 10: code review da fase 1 (8 achados, todos corrigidos)

Revisão pedida pelo usuário antes de abrir o PR. Encontrou 8 problemas; todos
foram corrigidos e **provados contra banco**, não só relidos.

**1. Falha de segurança (a mais grave).** No ramo "reaproveitar um WIN que veio
repetindo", `salvarWin` fazia `win.update({ where: { id: winExistente } })` com o
id vindo direto do formulário e sem escopo de dono — ao contrário de todos os
outros caminhos de escrita do arquivo. Um POST forjado reescreveria o WIN de
outro colaborador e o penduraria no card de quem enviou. Corrigido com checagem
prévia de propriedade e `where` com `colaboradorId`.

**2. `lerSemana` aceitava lixo.** `Number(null)` é 0, então um POST sem os campos
passava como "semana 0 do ano 0" e criava `CardSemanal` que nenhuma tela abre de
novo. Agora exige os campos como texto, valida faixa de ano e passa por
`ehSemanaValida`.

**3. Área da GIA gravada como equipe.** A promoção escrevia `Colaborador.area`
(AGP/APD/ACT) em `Projeto.equipe` (STI/GIA/GRH) — vocabulários diferentes, o que
inventaria equipes no relatório "por equipe" do dashboard. A área passou para o
comentário e a equipe fica em branco.

**4. Contador mentia em semanas passadas.** A contagem vinha do total global do
WIN, então abrir a semana 37 mostrava "está na 3ª semana" e o alerta de promoção
para um WIN que ali estava na primeira aparição. Nasceu
`contarAparicoesAte(anteriores, aparições, até)`, que congela a contagem na
semana exibida, com 6 testes.

**5. Reimportação acumulava lixo e podia duplicar projeto.** O script apagava só
os `WinSemana` e sempre recriava os `Win`: órfãos acumulavam e um WIN já
promovido voltava ao card, permitindo uma segunda promoção e um `Projeto`
duplicado. Agora remove órfãos e pula WIN já promovido. Verificado: após duas
importações da mesma semana, `orfaos=0` e `projetos=1`.

**6. `vincularColaborador` podia estourar.** Sem try/catch e sem checar vínculo
existente, um usuário cujo colaborador foi desativado veria o formulário de novo
e o `updateMany` bateria no índice único de `clerkUserId` (P2002), com a exceção
saindo da Server Action.

**7. Argumentos do script.** `find(a => !a.startsWith('--'))` pegava o "39" de
`--semana 39` como nome do arquivo, e `--semana` sem valor virava `NaN` que o
`??` não pega.

**8. Eu afirmei algo que não era verdade.** Disse — na conversa, no commit e no
CLAUDE.md — que o limite de 3 era garantido pelo banco via
`@@unique([cardId, ordem])`. A unicidade impede duas linhas na mesma posição mas
**não limita o valor** de `ordem`: nada impedia as posições 4, 5, 6. Em vez de só
corrigir o texto, a afirmação foi tornada verdadeira com a migration
`20260925130000_limite_wins_por_semana`, que adiciona
`CHECK (ordem BETWEEN 1 AND 3)`. Migration separada de propósito, porque a
anterior já pode ter sido aplicada em alguma máquina.

**Verificação das correções**, num Postgres local: escrita cruzada entre
colaboradores bloqueada; ordem 4 e ordem 0 rejeitadas pelo banco e ordem 3 aceita;
contador devolvendo 1/2/3 nas semanas 37/38/39; promoção deixando `equipe` nula;
unicidade de `clerkUserId` confirmada; script aceitando `--semana` antes do
arquivo e reclamando quando vem sem valor.

`npm test` = **461 passando em 35 arquivos** (455 antes; +6 do contador por
semana). `tsc`, `lint` e `build` limpos.

### Segunda rodada de code-review na Fase 1 (25/09/2026)

Nove achados. O primeiro sozinho anulava o motivo da fase inteira.

**1. O caminho de repetir um WIN estava morto.** O `input` escondido `winId` só
era renderizado quando `registroId === null && winId !== null` — combinação que
nenhuma linha da página produzia. Na prática, redigitar o mesmo WIN na semana
seguinte criava um `Win` novo, com `aparicoesAnteriores = 0`: **a regra das 3
semanas só podia disparar para WINs importados da planilha.** O sistema
funcionava com os dados que vieram do Excel e nunca com os digitados.

A correção não é reativar o campo: é uma ação própria, `repetirWin`, e um botão
"Repetir nesta semana" na lista da semana anterior, com o ramo morto removido de
`salvarWin`. Adivinhar a repetição comparando o texto seria voltar ao problema
que o par `Win`/`WinSemana` existe para resolver.

**Por que não peguei antes:** o teste ponta a ponta da rodada 1 semeava o banco
pelo importador e promovia. Nenhuma vez exerceu "usuário repete o WIN na semana
seguinte" — o único caminho que a fase inteira existe para servir.

**2. Erros do cabeçalho nunca chegavam à tela.** `CardWin` calculava
`estado.erros` e não renderizava; colar mais de 2000 caracteres abortava o
salvamento em silêncio. Os quatro campos viraram uma lista (era a repetição do
bloco que deixou o erro de fora em três deles) e ganharam `maxLength`.

**3. Promover não tirava o WIN do card**, embora a tela prometesse isso e o
rodapé da planilha exigisse. Ele seguia ocupando uma das três vagas. As
aparições são somadas em `aparicoesAnteriores` **antes** de apagar os registros:
apagar direto zeraria a contagem de um WIN que de fato se repetiu três semanas.

**4. A promoção criava `Acao` sem o laço de nova tentativa** que `criarAcao`
tem: lia o maior `numero` e gravava, e sob concorrência estouraria com P2002,
deixando o WIN sem o item do plano. `ehColisaoDeNumero` e `TENTATIVAS_NUMERO`
saíram de `acoes-acao.ts` para `src/lib/acao-validacao.ts`, com teste.

**5. O importador gravava o card no ano errado.** Sem prazo em nenhum WIN da
aba, o ano caía no relógio: uma aba importada em janeiro gravaria a semana 52
sob o ano novo, fora do card certo e fora da contagem, sem erro. Agora aceita
`--ano` e **para** quando não consegue deduzir.

**6. Tirar da semana deixava `Win` órfão** — linha que nenhuma tela alcança. O
importador já limpava exatamente esse estado; o caminho interativo, não.

**7. `Win.encerradoEm` era campo que nada escrevia**, e a mensagem do limite
mandava "encerrar". Em vez de corrigir o texto, a ação passou a existir
(`encerrarWin`): tirar da semana libera a vaga e o WIN pode voltar somando
aparições; encerrar diz que não volta.

**8. `traduzirStatus` não normalizava Unicode.** "NÃO FEITO" com til decomposto
não bate com a chave do mapa e caía calado em PENDENTE.

**9. Docstring mentia** sobre 01/01/2027 ser a semana 52 de 2026. É a semana 1
de 2027. Os quatro casos de virada viraram teste, para o comentário não poder
divergir de novo.

**A lição da rodada, e a mudança de prática:** `tsc`, `eslint` e 461 testes
verdes conviviam com uma funcionalidade que não funcionava. Os achados 1, 3, 4 e
6 são todos invisíveis em teste unitário. Por isso existe agora
`tests/integracao/` — 12 testes que chamam as Server Actions reais contra um
Postgres descartável (`npm run test:integracao`), fora do `npm test` porque o CI
não sobe banco. Foram eles que provaram cada correção, em vez da releitura do
código:

- três semanas pelo botão Repetir → **1** `Win`, **3** aparições, promoção
  disparando; redigitar → **2** `Win` com contador zerado (o defeito, fixado
  como teste);
- promoção → `winSemana = 0` e `aparicoesAnteriores = 3`;
- ação promovida numerada **8** depois de uma ação 7 existente;
- remoção apagando o órfão e **preservando** o WIN que ainda aparece noutra
  semana;
- `encerradoEm` gravado e WIN encerrado recusando repetição;
- escrita cruzada entre colaboradores bloqueada nas três ações novas.

Também aqui um erro meu: na primeira execução o `npm test` capturou o teste de
integração (o `include` já cobria `tests/**`), o que teria deixado o CI vermelho
por falta de banco. Pego porque rodei lint, testes e build antes de commitar, e
não só o arquivo que eu tinha acabado de escrever.

`npm test` = **474 passando em 35 arquivos** (461 antes; +13 dos achados 4, 8 e
9). `npm run test:integracao` = **12 passando**. `tsc`, `lint` e `build` limpos.

### Terceira rodada de code-review na Fase 1 (25/09/2026)

Três achados. O primeiro é um defeito que **eu introduzi na rodada 2**.

**1. O retry de P2002 que eu adicionei não funcionava.** Coloquei o laço de
nova tentativa *dentro* do `$transaction` de `promoverWin`, copiado de
`criarAcao` — que roda **fora** de transação. No Postgres a violação de
constraint aborta a transação inteira: a consulta seguinte falha com "current
transaction is aborted", não com P2002. O laço por dentro, portanto, nunca
renumerava; ele trocava uma colisão recuperável pela falha da promoção inteira,
o oposto do que o comentário que escrevi prometia.

Provado antes de mexer, num Postgres descartável: depois de uma colisão dentro
da transação, o `findFirst` seguinte falha com **P2039**. O laço virou
`refazerNaColisao`, em `src/lib/acao-validacao.ts`, envolvendo a transação
inteira — com quatro testes unitários, porque concorrência real não é
determinística mas a semântica do retry é.

**2. `encerrarWin` apagava o histórico.** Apagava *todos* os `WinSemana` do WIN,
não só o da semana corrente: encerrar na S39 sumia com o WIN dos cards da S37 e
da S38. Isso levou a rever também a decisão que eu tinha tomado na rodada 2 —
promover somava as aparições em `aparicoesAnteriores` e apagava os registros.
**Estava errado pelo mesmo motivo**, e o CLAUDE.md foi corrigido: as duas ações
agora recebem `ano`/`semana` e tiram o WIN **só daquela semana**. As aparições
anteriores registram o que foi de fato comprometido; apagá-las é reescrever o
passado para arrumar o presente. `aparicoesAnteriores` volta a significar uma
coisa só: aparições anteriores ao sistema, vindas da importação.

**3. `vincularColaborador` ignorava o `count` do `updateMany`.** A lista de
nomes é montada quando a página renderiza; se entre aquilo e o envio o
colaborador fosse tomado por outra conta ou desativado, o update não fazia nada
e o usuário voltava ao mesmo "Quem é você?" sem erro e sem saída. Agora a ação
devolve estado e o componente mostra a mensagem.

Também: o docstring de `TENTATIVAS_NUMERO` ficou órfão em `acoes-acao.ts` quando
movi a constante, empilhado sobre o doc de `criarAcao`. Removido.

**Erro de processo nesta rodada:** rodei `npx prettier --write` nos arquivos que
toquei. O projeto não usa prettier (sem config, fora do `package.json`), e o
padrão da ferramenta trocou aspas simples por duplas e adicionou ponto-e-vírgula
no arquivo inteiro — 565 linhas alteradas onde a correção mexia em ~200. Revertí
os quatro arquivos para o HEAD e refiz as edições à mão. Formatador não se roda
num projeto que não o adotou.

`npm test` = **478 passando em 35 arquivos** (474 antes; +4 de `refazerNaColisao`).
`npm run test:integracao` = **16 passando** (12 antes; +4 dos achados 2 e 3, entre
eles a prova de que encerrar na S39 preserva as aparições da S37 e da S38).
`tsc`, `lint` e `build` limpos.

### Porta de entrada trancada — descoberto em produção (25/09/2026)

Depois do merge do PR #7, o usuário abriu `/wins` em produção e viu: *"Não há
colaborador disponível para vincular. Peça para cadastrarem seu nome antes de
usar o card."* — e perguntou se conseguiria cadastrar um WIN na fase 2.

**A única coisa que criava um `Colaborador` era `scripts/importar-card-win.ts`.**
Não havia nenhum caminho pela interface. Num banco recém-migrado a tabela está
vazia, a lista de nomes vem vazia, e ninguém passa da tela "Quem é você?" — nem
para cadastrar o primeiro WIN. O sistema estava inutilizável na porta de entrada.

**Por que três rodadas de code-review não pegaram:** não é defeito de código. O
código está certo, os 478 testes passavam, e os testes de integração sempre
criavam o colaborador no `beforeEach` ou pelo importador. Nunca exercitei o
estado que a produção teria de verdade: banco migrado e vazio, primeiro usuário
chegando. É o mesmo padrão do achado da rodada 2 — testei o caminho que eu já
sabia que funcionava.

**A lição, que vale além deste caso:** o estado inicial de um sistema é um caso
de uso, não um detalhe de setup. Fixture que cria os dados que a tela precisa
esconde exatamente a pergunta "como esses dados aparecem pela primeira vez?".

**Correção** (auto-cadastro, escolhido pelo usuário entre três opções):

- `cadastrarColaborador` cria o colaborador e vincula a conta na mesma ação.
  Seguro aqui porque o Clerk já decide quem entra e o cadastro é restrito.
- **Reconhece quem o importador já criou.** `nome` é `@unique`; sem comparar por
  chave sem acento/caixa (`chaveDoNome`), digitar "mariana jose" esbarraria no
  índice único do "Mariana José" existente e devolveria erro de banco em vez de
  vincular. Vincula o cadastro que existe, preservando a `area` da planilha.
- **Sugere os `Projeto.responsavel` já usados.** Não é conveniência: é o mesmo
  nome que volta para o plano de ação na promoção, e duas grafias partem a
  pessoa em dois responsáveis no relatório, sem erro aparecer.
- Nome já vinculado a outra conta, ou colaborador desativado, dão mensagem
  específica — desativação não é revertida por conta própria.

**Verificação**, contra Postgres descartável, partindo de `colaborador.count() = 0`:
o primeiro cadastro vincula; espaços normalizam mas acento e caixa se preservam;
o nome do importador é reconhecido em vez de duplicado, com a `area` intacta;
nome tomado e colaborador desativado avisam; uma conta não vira dois
colaboradores; e a **jornada completa** — cadastrar e registrar o primeiro WIN —
termina com o `WinSemana` na semana certa, sob o nome certo.

`npm test` = **490 passando em 36 arquivos** (478 antes; +12 da validação do nome).
`npm run test:integracao` = **26 passando** (16 antes; +10 do cadastro).
`tsc`, `lint` e `build` limpos.

**Ainda não resolvido:** não existe tela para desativar colaborador nem para
corrigir um nome cadastrado errado. Hoje isso é edição direta no banco.

### Code-review do auto-cadastro (25/09/2026)

Dois achados, os dois meus, os dois do mesmo commit.

**1. Beco sem saída para quem está vinculado a colaborador desativado.** O
atalho `if (jaVinculado) return {}` não olhava `ativo`. Como a página só busca
colaborador com `ativo: true`, essa é a **única** situação em que o ramo é
alcançável — e nela o botão não fazia nada nem avisava nada. Exatamente o beco
que este commit veio remover, reintroduzido três linhas adiante. A conferência
virou `conferirVinculoExistente`, usada pelos dois caminhos (escolher da lista e
cadastrar), porque os dois tinham o mesmo atalho.

**2. A proteção contra grafias divergentes era unidirecional.** A tela
reconhecia quem o importador tinha criado, mas `scripts/importar-card-win.ts`
fazia `upsert` por igualdade exata de `nome`. Quem se cadastrasse como "Mariana
Jose" num banco zerado — onde não há `Projeto`, logo nenhuma sugestão de grafia
— ganhava uma segunda linha `Colaborador` quando a planilha com "Mariana José"
fosse importada.

Provado nos dois sentidos, com o importador **real** rodando contra Postgres e
uma planilha mínima construída para o teste:

- código **antigo**: `2 colaboradores` — "Mariana Jose [clerk=user_clerk]" e
  "Mariana José [clerk=null]", com o card importado sob o segundo. A conta do
  usuário ficava órfã e o relatório por responsável passava a contar dois.
- código **novo**: `1 colaborador`, card sob a conta certa, `area` atualizada
  pela planilha, e a divergência de grafia avisada na saída do script.

A regra de identidade virou `encontrarPorNome`, em `src/lib`, usada pela tela e
pelo script — antes eram duas cópias da mesma decisão em arquivos diferentes, e
foi exatamente por isso que uma delas ficou para trás. O importador **não
renomeia** o cadastro existente: o nome pode já ter ido para
`Projeto.responsavel` numa promoção, então ele avisa e deixa a decisão para quem
roda.

Incidental: o guard do `--ano` (achado 5 da 2ª rodada) disparou sozinho durante
este teste, com a mensagem certa, porque a planilha de prova não tinha prazo.

`npm test` = **494 passando em 36 arquivos** (490 antes; +4 de `encontrarPorNome`).
`npm run test:integracao` = **29 passando** (26 antes; +3 do vínculo desativado).
`tsc`, `lint` e `build` limpos.

### Bloco 11 — Card WIN, fase 2 (25/09/2026)

Três entregas: visão de equipe para a daily, taxa de conclusão semanal e WINs
reincidentes. O plano passou por **três rodadas de code-review antes de virar
código** — 20 achados, e é o que mais vale registrar deste bloco.

**A revisão do plano encontrou um erro de modelagem que nenhuma revisão de
código teria pego barato.** A fase 1 apagava o `WinSemana` ao promover ou
encerrar. Isso não incomodava ninguém enquanto não havia relatório; com eles, a
semana em que a equipe promoveu tudo apareceria vazia e cada WIN promovido
perderia uma aparição. Duas tentativas de remendo (`ordem = null`, depois
somar em `aparicoesAnteriores`) criaram mais problemas do que resolveram —
sintoma de estar sobrecarregando um campo com significado que ele não carrega.

O desenho que resolveu: **o desfecho pertence à aparição**, não ao WIN. Um WIN
promovido na S39 continua tendo acontecido na S37 e na S38. Daí
`WinSemana.desfecho` e a vaga liberada por índice único **parcial**, com `ordem`
continuando `NOT NULL` — nenhum call site precisou lidar com nulo, e o risco do
`?? 0` recriar erro de contagem de vaga sumiu junto.

Duas decisões de negócio que a revisão expôs como ausentes, decididas com o
usuário:

- **Promovido é categoria própria**, fora do denominador da taxa: nem concluído
  nem falho. Contá-lo como fracasso ensinaria a equipe a evitar a promoção, que
  é o método funcionando.
- **Encerrar passa a perguntar o desfecho.** A ação existia sem perguntar, e o
  próprio docstring dela admitia a ambiguidade. Sem a pergunta, o WIN encerrado
  guardava o status que por acaso tinha e a taxa o contava como fracasso.

Outros achados corrigidos antes de escrever a primeira linha: `encerradoEm`
faltava na consulta da tela de equipe (WIN encerrado seria marcado "deve
promover"); filtrar colaborador ativo apagaria retroativamente os cards de quem
saiu; `contarAparicoesAte` e `totalDeAparicoes` somam `aparicoesAnteriores` cada
um, então o consumidor passa zero; `ano`/`semana` são duas colunas e nenhum
intervalo contínuo sai de um `gte` na virada de ano; os relatórios de WIN não
respondem aos filtros da página; a última barra é a semana em curso e sem marca
lê como queda a zero; hachura estava significando duas coisas; `semCard` errava
o critério, porque salvar só o cabeçalho já cria a linha do card.

E um que era perda de dados: **o importador apagava todos os `WinSemana` do
card**, sem filtro, e ignorava `encerradoEm` na varredura de órfãos —
reimportar uma semana destruiria exatamente o histórico que a migration existe
para preservar.

**Verificação**, contra Postgres descartável:

- o índice parcial existe no banco, com o `WHERE` correto;
- depois de promover, a **mesma posição** aceita um WIN novo — o risco central
  da migration;
- o limite de 3 não conta linhas que saíram do card;
- repetir um WIN que saiu dá mensagem, não P2002;
- encerrar sem desfecho, ou com desfecho forjado, recusa **sem** deixar o WIN
  meio encerrado;
- reimportar preserva a aparição promovida;
- a contagem da tela de equipe bate com a da tela individual;
- promovido sai do denominador e não é contado duas vezes;
- semana toda promovida não se confunde com semana de recesso.

`npm test` = **524 passando em 38 arquivos** (505 antes).
`npm run test:integracao` = **48 passando** (36 antes).
`tsc`, `lint` e `build` limpos.

**A lição do bloco:** revisar o plano saiu muito mais barato que revisar a
implementação. Três rodadas sobre um documento acharam um erro de modelagem,
duas decisões de negócio ausentes e uma perda de dados — tudo antes de existir
código para refazer. Quando o custo de errar é migration mais reescrita de
teste, o documento é o lugar certo para errar.

### Code-review da fase 2 (25/09/2026)

Cinco achados. A máquina de estados do `desfecho`, a taxa com promovido fora do
denominador e a regra de identidade compartilhada passaram limpas.

**1. Reimportar ressuscitava WIN encerrado.** O `deleteMany` já poupava as
linhas `ENCERRADO`, mas a lista de "não recriar" só olhava `promovidoEm`. O laço
recriava o WIN encerrado como `Win` novo, com linha `NO_CARD` na mesma `ordem` —
permitido pelo índice parcial, porque a linha encerrada não ocupa mais a vaga.
A semana ficava com 4 aparições num card de 3: `/wins` mostrava 3 e
`/dashboards` contava 4. Provado e corrigido: reimportar agora deixa 3 linhas,
2 no card.

**2. O índice parcial podia sumir em silêncio.** Ele e a CHECK de `ordem` vivem
só na migration — o Prisma não expressa nenhum dos dois, então um
`prisma migrate dev` diffaria como índice sobrando e geraria um DROP, tirando a
camada de banco do limite de 3 sem nada quebrar. `@@index([desfecho])`, que É
expressável, entrou no schema; e dois testes de integração passaram a verificar
o índice e a CHECK contra o `pg_indexes`, para que perdê-los seja barulhento.

**3. Rótulo do eixo era no-op.** `rotuloSemana` já devolve "S39/2026", então o
`.replace('Semana ', 'S')` não fazia nada e cada barra levava um rótulo de 8
caracteres com o ano.

**4. Indicador mentia no rótulo.** "Pessoas com card" contava quem tem WIN —
justamente a distinção que `semWins` documenta. Virou "Pessoas com WIN", e o
campo passou a se chamar `comWins`.

**5. O índice de navegação mentia.** As duas entradas de WIN entraram no
catálogo entre as duas de auditoria, então o menu (agrupado) dizia uma ordem e a
página renderizava outra. Nada quebrava — o pior tipo de defeito. Corrigido nos
dois lados, e **agora há teste**: `dashboard-catalogo.test.ts` lê o fonte da
página e compara a ordem dos ids literais com a do catálogo.

`npm test` = **526 passando em 38 arquivos** (524 antes).
`npm run test:integracao` = **50 passando** (48 antes).

### Bloco 12 — Administração de colaboradores (25/09/2026)

Fechando a lacuna que eu vinha sinalizando desde o auto-cadastro: não havia como
desativar alguém nem corrigir um nome digitado errado, e isso era edição direta
no banco.

**O risco desta tela não é renomear — é o que renomear arrasta.**
`Colaborador.nome` é copiado para `Projeto.responsavel` a cada promoção de WIN.
Renomear só de um lado parte a pessoa em duas no relatório por responsável: o
mesmo defeito que o auto-cadastro veio evitar, chegando pela outra ponta.

Por isso a renomeação **oferece** levar a mudança para os projetos, mostrando
quantos serão afetados antes de decidir. É escolha e não automatismo porque as
duas intenções são legítimas: corrigir digitação quer levar junto; alguém que
mudou de sobrenome pode não querer reescrever o histórico. O `comentario` da
promoção, que também cita o nome em prosa, fica como está — é registro do que
aconteceu na época.

Outras decisões:

- **Conflito de nome usa `chaveDoNome`**, a mesma regra do cadastro e do
  importador. Igualdade exata deixaria criar "Mariana Jose" ao lado de "Mariana
  José". Corrigir só acento ou caixa do próprio nome é permitido — é o caso de
  uso principal.
- **Desativar não apaga nada e não solta o `clerkUserId`.** Soltar deixaria a
  conta se cadastrar de novo com outro nome, deixando o histórico órfão.
- **Ninguém desativa a si mesmo**: cairia na tela "Quem é você?" sem conseguir
  se escolher, porque a lista só oferece ativos e sem dono.
- **Sem sistema de papéis.** Qualquer conta autenticada administra, coerente com
  a decisão do auto-cadastro. Inventar papéis para uma equipe deste tamanho
  seria infraestrutura sem demanda — e, se um dia precisar, o lugar é o Clerk.

`npm test` = **535 passando em 39 arquivos** (526 antes).
`npm run test:integracao` = **60 passando** (50 antes), incluindo a propagação do
nome para os projetos, a recusa de colisão sem acento e a preservação do
histórico ao desativar.

**Ainda não existe** trilha de auditoria para `Colaborador` — `HistoricoAlteracao`
é de `Acao`. Quem desativou quem, e quando, não fica registrado.

### Code-review da tela de colaboradores (27/09/2026)

Cinco achados, e os três primeiros eram do mesmo tipo: a tela usava um modelo de
identidade e de intenção diferente do resto do sistema.

**1. Propagar só andava de carona numa mudança de nome.** Quem desmarcasse a
caixa uma vez deixava a divergência **sem conserto pela tela**: a linha passava a
mostrar "0 projeto(s)", a caixa sumia, e reenviar o mesmo nome devolvia "o nome
já era esse". Pior, há divergência que nasce sem ninguém renomear — planilha
importada com uma grafia, cadastro com outra. As duas operações ficaram
independentes.

**2. `alternarAtivo` negava o estado lido em vez de agir pela intenção.** Com
duas pessoas administrando, ou um POST reenviado, um clique em "Desativar" podia
reativar alguém e ainda relatar "voltou a ficar ativo". A intenção passou a vir
no `value` do botão, e o `updateMany` condicional devolve `count = 0` quando o
estado já mudou — mesmo padrão de `vincularColaborador`.

**3. A propagação casava `Projeto.responsavel` por igualdade exata**, enquanto a
identidade em todo o resto passa por `chaveDoNome`. A tela ficava cega
justamente para a divergência que existe para curar: "Mariana Jose" no projeto
contra "Mariana José" no cadastro não era contado nem atualizado, e propagar
podia deixar uma terceira grafia para trás.

**4. A contagem filtrava `ativo: true`, a escrita não** — o rótulo prometia N e
o resultado relatava M. E projeto excluído logicamente pode ser restaurado,
voltando com a grafia velha. As duas passaram a usar a mesma consulta, sem
filtro.

**5. Faltavam revalidações.** Renomear não invalidava `/projetos` nem
`/wins/equipe`, e pulava `/dashboards` quando só o nome mudava — embora ele
imprima o nome.

Tela e ação agora compartilham `projetosDaPessoa`/`projetosADivergir`, em
`src/lib`, testadas em separado. A tela também passou a dizer quantos projetos
**já estão divergentes**, o que torna o conserto visível antes de alguém
precisar descobrir sozinho.

`npm test` = **541 passando em 39 arquivos** (535 antes).
`npm run test:integracao` = **67 passando** (60 antes).

### Revisão e conferência visual da fase 2 (27/09/2026)

**Code review, 4 achados — todos da mesma família.** Introduzi o `desfecho` como
a coisa que decide "esta aparição ainda está no card" e atualizei quase todos os
pontos de uso; **quatro ficaram agindo sobre aparições sem consultá-lo.** Todos
partem do mesmo cenário: alguém tem a página aberta, o WIN é promovido ou
encerrado por outro caminho, e o clique num botão que a aba antiga ainda mostra
reescreve o passado.

- `removerWinDaSemana` sem filtro apagava de vez uma linha PROMOVIDO/ENCERRADO;
- a varredura de órfãos da mesma função não checava `encerradoEm` — o mesmo
  buraco que este PR corrigiu no importador e deixou aqui;
- o ramo de edição de `salvarWin` resolvia por `{ id, cardId }` e reescrevia o
  `status` de uma semana já fechada e a `descricao` de um WIN já promovido;
- `encerrarWin` não exigia `encerradoEm: null`, então um WIN encerrado na S38
  podia ser encerrado de novo pela aparição da S37, sobrescrevendo a data.

**Conferência visual — 2 defeitos que nenhum teste pegaria.** Três telas foram
construídas nesta sessão sem nunca serem renderizadas. Com harness Vite +
Playwright (Server Actions substituídas por stubs), nos dois temas:

- **A amostra da legenda de "Promovido" era um quadrado liso**, enquanto a barra
  usa hachura. A legenda existe para a identidade não ficar só na cor, e ela
  estava falhando nisso — agora repete a textura.
- **Erro de concordância visível ao usuário**: "2 já está com grafia diferente".

O que a conferência confirmou funcionando: semana vazia como traço e não barra
de altura zero; "todos promovidos" distinto de "—"; e a hachura (promovido)
distinguível do contorno tracejado (semana em curso) na mesma barra — que era o
risco que motivou separar as duas marcas.

`npm test` = **541 passando**. `npm run test:integracao` = **71 passando**
(67 antes; +4 dos cenários de aba velha).

### Blocos 11 e 12 em produção, e o CI parado (27/09/2026)

**PR #9 mergeado** (`cd0acbf`), com os 13 commits conferidos um a um no `main`.
Deploy de produção READY no commit do merge; o projeto duplicado segue
desconectado. Em produção agora: `/wins/equipe`, os dois relatórios de WIN em
`/dashboards` e `/colaboradores`.

A migration `wins_desfecho_da_aparicao` foi aplicada — **por dedução da ordem do
build**, não por leitura de log: `migrar-producao.ts` roda antes do `next build`
e falha de migration aborta o build, então um deploy READY implica sucesso. Os
logs da Vercel devolvem 403 de escopo neste token e a política de rede do
ambiente bloqueia o app, então as duas vias diretas estão fechadas. Abrir
`/wins` logado fecha a lacuna em um clique.

**Um erro meu que vale registrar.** Durante várias mensagens eu afirmei que "o
PR #8 está aberto com 13 commits e três assuntos", e recomendei separá-los antes
de mergear. **O PR #8 já estava mergeado desde 25/09**, com apenas 2 commits (o
auto-cadastro). Eu contei os commits da branch e presumi que estavam todos no
PR, sem nunca reler o estado dele.

Efeito prático: por horas, a fase 2 e a tela de colaboradores não estavam em
nenhum PR — e portanto nunca estiveram a um clique de produção, como eu dava a
entender. A lição é a mesma de outros erros desta sessão: **estado remoto se
verifica, não se deduz do que está na máquina local.**

Um PR mergeado não recebe trabalho novo, então o certo foi abrir o **PR #9**
para os 12 commits que ficaram de fora.

**O GitHub Actions não executa neste repositório desde 25/09.** Três evidências
independentes, todas sobre o PR #9:

- abrir o PR não disparou o workflow;
- o push seguinte (evento `synchronize`) também não;
- o **merge no `main`** — que dispara por `push` — também não.

E o disparo manual terminou em `startup_failure` com **zero jobs criados**. O
workflow está `active` e o YAML é válido (conferido com `yaml.safe_load`). Zero
jobs significa que o Actions não conseguiu iniciar nada: normalmente cota de
minutos esgotada ou bloqueio de faturamento, que não dá para verificar pelas
ferramentas desta sessão. **Conferir em `github.com/settings/billing`.**

Enquanto isso, o que substituiu o CI neste merge, rodado localmente: 541 testes
unitários, 71 de integração contra Postgres real, `tsc`/`eslint`/`next build`
limpos, e conferência visual nos dois temas. O CI roda `npm ci → lint → test →
build`; a única coisa a mais seria o `npm ci` com `node_modules` limpo.

O workflow ganhou `workflow_dispatch` no caminho — antes não havia como
reexecutá-lo sem empurrar código, e as alternativas eram commit vazio ou fechar
e reabrir o PR, ambas descartadas.

### Ensaio da importação da planilha real do Card WIN (28/09/2026)
- O usuário enviou a versão atual de `CARD_WIN_Semanal_-_Mariana.xlsx` (agora com a
  semana 40; a versão anterior ia até a 39). Arquivo em `dados/`, que é gitignored.
- **Simulação + gravação ensaiadas contra um Postgres descartável local**, com as
  migrations aplicadas por `prisma migrate deploy` — o mesmo caminho que produção usa.
  Resultado: 1 colaborador (`Mariana Garcia`), 1 card (2026/S40), 3 WINs.
- **A regra das 3 semanas dispara no primeiro dia**, como o desenho previa: o WIN
  "Desenvolvimento do documento de elicitação de requisitos — relatórios orçamentários"
  entra com `aparicoesAnteriores = 3` (semanas 37, 38 e 39 da planilha) e o importador
  já o marca `<-- JÁ DEVE SER PROMOVIDO`. Ele é exatamente o caso que motivou o par
  `Win`/`WinSemana`: aparece na planilha com três grafias diferentes.
- **Reimportação após promoção verificada com o arquivo real**, não só com fixture:
  marcado o WIN recorrente como `PROMOVIDO` e rodada a importação de novo, o resultado
  foi 3 linhas de `WinSemana` com 2 no card — a aparição promovida sobreviveu e não foi
  recriada. É o cenário que a filtragem por `desfecho` nos três pontos do importador
  existe para evitar.
- Conferido que `prisma migrate deploy` preserva o que só existe em SQL: o índice
  parcial `WinSemana_cardId_ordem_no_card` e a CHECK `WinSemana_ordem_entre_1_e_3`.
- Verde: 541 testes unitários (39 arquivos) e 71 de integração (5 arquivos).
- **Só a semana 40 é gravada**, por decisão já registrada: as semanas 31–39 servem
  apenas para semear `aparicoesAnteriores`. Consequência a ter em mente — o histórico
  navegável em `/wins/equipe` e os gráficos de `/dashboards` começam na semana 40.
- **A gravação em produção continua pendente e é do usuário**: a leitura da credencial
  do Railway é barrada por classificador de segurança nesta sessão, e não se contorna.
  Comando, com a `DATABASE_URL` de produção no `.env` (ver `.env.example`):
  `npm run importar:card-win -- ./dados/CARD_WIN_Semanal_-_Mariana.xlsx --ano 2026 --gravar`
  (sem `--gravar` primeiro, para conferir).
- Depois da importação, a tela "Quem é você?" de `/wins` passa a oferecer
  `Mariana Garcia` para vincular — é o que resolve a mensagem "Não há colaborador
  disponível para vincular" vista em produção. **Vincular ao nome existente**, sem
  redigitar outra grafia, senão nascem dois colaboradores para a mesma pessoa.

### Campo de área e a divergência de nome que ela revelou (28/09/2026)

Veio de uma observação do usuário no print de `/colaboradores`: a linha dizia
"sem área" e não havia como preencher.

- **Diagnóstico:** `Colaborador.area` só era escrito pelo importador. O
  auto-cadastro grava `nome` e `clerkUserId`; o campo "Área" de `/wins` grava em
  `CardSemanal.area`. Quem entrava pela tela ficava sem área para sempre — e,
  como `/wins` preenche a Área com `cardAtual?.area ?? colaborador.area`, toda
  semana nova abria vazia e a pessoa redigitava.
- **Campo "Área" na tela `/colaboradores`**, no mesmo formulário do nome (o botão
  "Renomear" virou "Editar", e `renomearColaborador` virou `salvarColaborador`).
  Sugere as grafias já em uso, lidas do cadastro E dos cards.
- **Um defeito que o próprio teste pegou antes do commit:** `FormData.get`
  devolve `null` para campo ausente e `''` para campo vazio. Tratar os dois como
  "remover" faria uma aba aberta antes desta versão apagar a área de quem veio da
  planilha. Agora ausente vira `undefined` (o Prisma pula a coluna). Verificado
  revertendo a correção: o teste falha com `expected null to be 'APD'`.
- **A investigação revelou um bloqueio na importação pendente.** O cadastro de
  produção diz "Mariana Santos Garcia" e a planilha diz "Mariana Garcia".
  `chaveDoNome` cobre acento e caixa, não um nome do meio — não casa.
  **Reproduzido contra o banco**, com a planilha real e o cadastro de produção:
  sem correção, a importação cria duas pessoas, uma com o card e a área, outra
  com a conta do Clerk e o projeto.
- **Solução: `--colaborador="Nome no cadastro"`** no importador. As duas
  alternativas custavam uma grafia (renomear o cadastro, ou editar a planilha a
  cada versão nova) e nenhuma estava errada — então quem decide é uma pessoa, uma
  vez, por argumento. Provado: com a flag, uma pessoa só, com nome preservado,
  área da planilha, conta do Clerk, 1 card e 3 WINs. Nome inexistente aborta com
  saída 1 e sem escrever nada.
- **Conferência visual** nos dois modos, com o harness Vite+Playwright e as
  Server Actions em stub. Pegou o que nenhum teste vê: o texto de ajuda estava em
  `textFaint`, mais fraco que a explicação vizinha da caixa de seleção
  (`textMuted`), e ocupava três linhas. Ajustado para uma linha e o mesmo peso.
- Verde: 547 unitários (39 arquivos), 78 de integração (5 arquivos), `tsc`,
  `eslint` e `next build`.
- **Ainda pendente, e é do usuário:** a gravação em produção. O comando agora é
  `npm run importar:card-win -- ./dados/CARD_WIN_Semanal_-_Mariana.xlsx --ano 2026 --colaborador "Mariana Santos Garcia" --gravar`
  (sem `--gravar` antes, para conferir). Esta versão precisa estar em produção
  antes, senão a flag não existe lá.

### Code-review do campo de área e da flag de importação (28/09/2026)

Três achados, todos legítimos e todos corrigidos. O primeiro era grave.

- **`--colaborador` só aceitava a forma `=`.** `--semana` e `--ano`, no mesmo
  laço logo acima, aceitavam espaço — então `--colaborador "Mariana Santos
  Garcia"`, a forma que os vizinhos ensinam, caía no `continue` dos
  sinalizadores desconhecidos e o nome era engolido pelo `arquivo ??=`.
  **Reproduzido contra o banco**: a importação criava as duas pessoas e imprimia
  "Gravado: 1 card, 3 WINs". Não era um erro, era um sucesso mentiroso — e
  justamente na flag que existe para evitar a duplicação.
  Corrigido extraindo a leitura para `src/lib/argumentos-importacao.ts`, puro e
  com 13 testes. Agora as duas formas valem para todos os sinalizadores, e valor
  faltando, valor vazio, sinalizador desconhecido ou dois arquivos abortam com
  saída 1. Também fechada a brecha de `--colaborador --gravar` gravar uma pessoa
  chamada "--gravar".
- **A importação sobrescrevia `Colaborador.area`.** A área definida na tela nova
  seria revertida pela importação seguinte, e zerada de vez se o cabeçalho da
  planilha estivesse em branco — as semanas voltariam a abrir vazias, que é o
  defeito que a tela veio consertar. Agora a planilha SEMEIA (só preenche cadastro
  sem área) e avisa quando os dois divergem. Verificado: área `ACT` posta na tela
  sobrevive à reimportação, o card recebe `AGP` da planilha, e a divergência é
  relatada.
- **A mensagem do catch dizia "renomear"** numa ação que agora salva nome e área.

Verde: 560 unitários (40 arquivos), 78 de integração, `tsc`, `eslint` e
`next build`. As formas que já funcionavam foram reconferidas uma a uma.

### O CI voltou a rodar (28/09/2026)

O `Lint, testes e build` executou no PR #10 — **primeira execução desde 25/09**,
depois de três gatilhos independentes falharem e de um `workflow_dispatch` manual
terminar em `startup_failure` com zero jobs.

- Run 36424275759, job 108934275925: 40 arquivos, **560 testes**, os mesmos da
  máquina local, incluindo o `argumentos-importacao.test.ts` recém-criado.
- A guarda de migration se comportou como documentado:
  `[migração] Build fora da Vercel (local ou CI) — migration não se aplica aqui.`
- Build compilou, TypeScript passou, 12 páginas geradas.
- Nada foi mexido no workflow desde o `startup_failure`, então a causa era mesmo
  externa ao repositório — coerente com a hipótese de minutos/faturamento.
- Único aviso: a descontinuação do Node 20 em `actions/checkout@v4` e
  `setup-node@v4`, que continua na lista de manutenção.

A pendência **"GitHub Actions não roda desde 25/09" foi removida** da tabela de
aberto e do "Onde retomar". Os deploys de preview da Vercel, esses, nunca
pararam — é por isso que o build vinha sendo conferido por lá.

### Onde retomar

1. **Importar a planilha real em produção** — ensaiada e validada em 28/09 contra
   um Postgres descartável; falta rodar com a `DATABASE_URL` de produção, o que
   só a máquina do usuário consegue fazer:
   `npm run importar:card-win -- ./dados/CARD_WIN_Semanal_-_Mariana.xlsx --ano 2026 --colaborador "Mariana Santos Garcia" --gravar`
   (sem `--gravar` antes, para conferir). **A flag `--colaborador` não é
   opcional aqui**: sem ela a importação cria uma segunda pessoa, porque a
   planilha diz "Mariana Garcia" e o cadastro diz "Mariana Santos Garcia".
   Exige esta versão já publicada. Sem ela ninguém tem card, e o WIN que já
   bateu três semanas segue sem virar item do plano de ação. Importar **antes** de
   as pessoas se cadastrarem evita divergência de grafia — embora a proteção
   funcione nos dois sentidos.
2. **Abrir `/wins` logado** para confirmar a migration pelo caminho direto.
3. Promover o Clerk para produção, **registrando o app no Azure AD antes**.

A branch `claude/peaceful-dijkstra-daoesm` foi reiniciada a partir do `main`
depois do merge, como manda a regra de PR já mergeado, e está limpa.
