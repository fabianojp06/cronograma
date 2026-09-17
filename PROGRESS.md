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
- [ ] Integrar Clerk (Instance ID `ins_3JTS4qDnU1wKm8mPloItwq6KxYJ`) como autenticação,
      habilitando login social via Microsoft/Outlook (Azure AD OAuth) — usar
      `clerk_sdk_snippet` do MCP do Clerk para o código de integração correto do
      Next.js App Router; a chave secreta e a publishable key vão em variáveis de
      ambiente (`.env.local`, nunca commitadas)
- [ ] Conectar o repositório GitHub ao projeto Vercel `prj_HxI1VBYwefOAGBqyJXvEOCBAkHPO`
      (deploy automático a cada push) e ao projeto Railway
      `28445ef3-95ee-44bd-bfba-b5af383d8057` (banco PostgreSQL) — registrar no
      Log de decisões o domínio gerado pela Vercel e a connection string (via
      variável de ambiente, nunca em texto plano no repositório) assim que
      existirem

### Bloco 2 — CRUD de Projetos
- [ ] Ler o protótipo aprovado em https://claude.ai/artifact/WPxn8dThgUAmMPJHAPJzhs
      (artboard `E-FormularioProjeto`) antes de implementar a tela de criação/edição
- [ ] Server Action de criação de Projeto com validação (nome obrigatório; demais
      campos opcionais) cobrindo os campos do SCHEMA.md
- [ ] Tela de listagem de Projetos com filtro por equipe, categoria e status
      agregado (calculado a partir das Ações)
- [ ] Edição de Projeto existente
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
