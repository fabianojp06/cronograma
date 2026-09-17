# PROGRESS — Cronograma CTCEA

## Status
EM_ANDAMENTO

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
- [ ] Exclusão lógica de Projeto (campo `ativo = false`, nunca DELETE físico)

### Bloco 3 — CRUD de Ações
- [ ] Ler o protótipo aprovado em https://claude.ai/artifact/WPxn8dThgUAmMPJHAPJzhs
      (artboard `F-FormularioAcao`) antes de implementar a tela de criação/edição —
      inclui o painel de histórico de alterações ao lado do formulário
- [ ] Server Action de criação de Ação vinculada a um Projeto, com `numero`
      sequencial automático dentro do projeto (usar a constraint `@@unique([projetoId, numero])`)
- [ ] Função utilitária de cálculo de dias úteis entre duas datas (excluir sábados,
      domingos, e a lista de feriados nacionais fixos do Brasil), com teste unitário
      cobrindo pelo menos 3 casos (mesma semana, atravessando um feriado, mês inteiro)
- [ ] Atualização de status de uma Ação: toda mudança de `status`, `previstoInicio`,
      `previstoTermino`, `realizadoInicio` ou `realizadoTermino` deve gravar uma linha
      em `HistoricoAlteracao` com valor antigo e novo — cobrir com teste que confirma
      que o histórico é criado
- [ ] Endpoint/Server Action específico para registrar datas "Realizado" (distinto do
      fluxo de registrar datas "Previsto")

### Bloco 4 — Visualização Gantt
- [ ] Ler o protótipo aprovado em https://claude.ai/artifact/WPxn8dThgUAmMPJHAPJzhs
      (artboard `D-DetalheGantt`) antes de implementar — layout, tokens de cor e
      comportamento visual descritos em CLAUDE.md devem ser seguidos fielmente
- [ ] Componente de grade semanal renderizando, para um Projeto, as barras Previsto
      (azul) e Realizado (verde) de cada Ação sobrepostas na linha do tempo
- [ ] Regra visual de atraso: se `previstoTermino < hoje` e `status != CONCLUIDO` e
      não há `realizadoTermino`, a barra Previsto fica vermelha
- [ ] Navegação/scroll horizontal por período (a planilha original cobre ~13 meses;
      o componente não precisa renderizar tudo de uma vez — paginar por mês/trimestre)

### Bloco 5 — Dashboard consolidado (visão PLA-DEP)
- [ ] Ler o protótipo aprovado em https://claude.ai/artifact/WPxn8dThgUAmMPJHAPJzhs
      (artboard `C-PainelOperacional`) antes de implementar — inclui alternância
      claro/escuro, indicadores por traço lateral, e link de cada linha para o
      detalhe do projeto (Bloco 4)
- [ ] Tela consolidada listando todos os Projetos ativos com progresso agregado
      (% de Ações com status CONCLUIDO sobre o total do projeto)
- [ ] Filtros globais por equipe, responsável, categoria e status
- [ ] Indicador/contador de projetos com pelo menos uma Ação atrasada (ver regra do
      Bloco 4)

### Bloco 6 — Migração dos dados existentes
- [ ] Script (rodado uma vez, fora da aplicação) para importar PLA-DEP-2026-001.xlsx
      para o novo schema, seguindo a tabela de mapeamento em SCHEMA.md
- [ ] Script equivalente para importar CRO-DEP-2026-001.xlsx como um Projeto
      individual com suas Ações detalhadas
- [ ] Validação pós-importação: contagem de linhas da planilha original vs. registros
      criados, reportada no Log de decisões

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
