# PROGRESS — Cronograma CTCEA

## Status
BACKLOG_CONCLUIDO (todos os itens dos Blocos 1–6 marcados; pendente apenas a
execução dos scripts de migração contra os .xlsx reais, que não estão no repositório)

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
- [x] Integrar Clerk (Instance ID `ins_3JTS4qDnU1wKm8mPloItwq6KxYJ`) como autenticação,
      habilitando login social via Microsoft/Outlook (Azure AD OAuth) — usar
      `clerk_sdk_snippet` do MCP do Clerk para o código de integração correto do
      Next.js App Router; a chave secreta e a publishable key vão em variáveis de
      ambiente (`.env.local`, nunca commitadas)
- [x] Conectar o repositório GitHub ao projeto Vercel `prj_HxI1VBYwefOAGBqyJXvEOCBAkHPO`
      (deploy automático a cada push) e ao projeto Railway
      `28445ef3-95ee-44bd-bfba-b5af383d8057` (banco PostgreSQL) — registrar no
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
- **Banco usado:** o projeto Railway `28445ef3-...` **ainda não tem serviço PostgreSQL**
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
  Microsoft) da instância `ins_3JTS4qDnU1wKm8mPloItwq6KxYJ`, e cadastrar Client ID/Secret de
  um app registrado no Azure AD para produção. Isso é configuração de instância, não de
  código: o SDK já renderiza o botão assim que a conexão for ligada. Requer as chaves de API
  da instância, que ainda não estão disponíveis nesta máquina.
- Verificação: `npm test` = **19 testes passando** (3 novos em `src/lib/rotas-publicas.test.ts`,
  cobrindo rotas públicas, subcaminhos do Clerk, webhooks e o padrão fechado); `tsc --noEmit`
  e `npm run lint` limpos; `next build` completo com chaves de exemplo (4 rotas + proxy).
- **Falta:** conectar GitHub → Vercel e provisionar o PostgreSQL no Railway (último item
  do Bloco 1).

### 2026-09-17 — Bloco 1: Railway (PostgreSQL) + Vercel (deploy automático)
- **PostgreSQL provisionado no Railway** (projeto `28445ef3-...`, ambiente `production`):
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
  Ela se obtém com `railway link -p 28445ef3-... -e production -s Postgres` seguido de
  `railway variables -s Postgres --kv`. O `.env.example` foi reescrito com esse
  procedimento, mantendo o Docker local como alternativa offline.
- **Migration e seed aplicados no banco do Railway:** `prisma migrate deploy` aplicou
  `20260917231112_inicial` (a mesma migration versionada, sem regerar nada) e o
  `db:seed` criou os 3 projetos de exemplo com 5 ações cada. O banco de produção já
  responde com dados.
- **Vercel:** o projeto `prj_HxI1VBYwefOAGBqyJXvEOCBAkHPO` (**`cronograma-lktu`**) já
  estava conectado ao repositório `fabianojp06/cronograma` — existe o domínio de branch
  `cronograma-lktu-git-main-fabianojp06s-projects.vercel.app`, ou seja, **push na `main`
  já dispara deploy automático**. Domínios gerados:
  - Produção: `https://cronograma-lktu-fabianojp06s-projects.vercel.app`
  - Branch `main`: `https://cronograma-lktu-git-main-fabianojp06s-projects.vercel.app`
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
  do usuário:** compartilhar o artifact com a conta `fabianojp06@gmail.com` (ou
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
  artifact com `fabianojp06@gmail.com` ou colar o conteúdo do artboard. A tela
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
  artifact com `fabianojp06@gmail.com` ou colar o conteúdo do artboard. A grade
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
  **Ação necessária do usuário:** compartilhar o artifact com `fabianojp06@gmail.com`
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
  da app `cronograma`, instância **development** `ins_3JTS4...`), além das 4
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
