# Cronograma CTCEA

[![CI](https://github.com/fabianojp06/cronograma/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/fabianojp06/cronograma/actions/workflows/ci.yml)
![Node](https://img.shields.io/badge/node-24.x-339933?logo=node.js&logoColor=white)
![Next.js](https://img.shields.io/badge/Next.js-16-000000?logo=next.js&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)
![Licença](https://img.shields.io/badge/licen%C3%A7a-uso%20interno-lightgrey)

Sistema de acompanhamento de projetos e planos de ação da **CTCEA**. Substitui as
planilhas de plano de ação consolidado (**PLA-DEP**) e de cronograma por projeto
(**CRO-DEP**), além da Matriz de Priorização e do Card WIN semanal. Diferente
delas, guarda o histórico de cada alteração.

> Uso interno da CTCEA. O acesso é restrito a contas `@ctcea.org.br`.

---

## Sumário

- [Visão geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Stack](#stack)
- [Arquitetura](#arquitetura)
- [Estrutura do repositório](#estrutura-do-repositório)
- [Como rodar localmente](#como-rodar-localmente)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Scripts](#scripts)
- [Banco de dados e migrations](#banco-de-dados-e-migrations)
- [Importação das planilhas](#importação-das-planilhas)
- [Testes](#testes)
- [Integração contínua](#integração-contínua)
- [Deploy](#deploy)
- [Fluxo de desenvolvimento](#fluxo-de-desenvolvimento)
- [Convenções](#convenções)
- [Documentação relacionada](#documentação-relacionada)
- [Licença](#licença)

---

## Visão geral

O sistema oferece duas visões sobre os mesmos dados:

- **Consolidada:** todos os projetos de todas as equipes (STI, GIA, GRH…), no modelo
  da planilha PLA-DEP.
- **Por projeto:** o cronograma detalhado de um projeto, com Gantt de Previsto ×
  Realizado, no modelo da CRO-DEP.

Três regras de negócio valem em todo o sistema:

| Regra | Como funciona |
|---|---|
| **Trilha de auditoria** | Toda mudança de status ou de data de uma ação grava uma linha em `HistoricoAlteracao`, com o campo, o valor antigo, o valor novo e o momento da mudança. |
| **Dias úteis** | Os prazos são contados em dias úteis: sem sábados, domingos e feriados nacionais de data fixa. |
| **Cores de status** | Previsto em azul, Realizado em verde e Atraso em vermelho. Atraso é quando o Realizado está vazio, o Previsto já passou e o status não é Concluído. |

## Funcionalidades

### Projetos e ações
- **Painel consolidado:** indicadores e lista de projetos com a barra de progresso
  na própria linha.
- **Detalhe do projeto:** Gantt com Previsto (contorno), Realizado (sólido) e a linha
  de "hoje". Mostra também como o projeto estava em uma data passada
  (`?em=aaaa-mm-dd`).
- **Ações:** criar, editar, duplicar e registrar o realizado, com histórico de
  alterações ao lado do formulário. Ao mudar a data prevista, o sistema pede o
  motivo do replanejamento.
- **Dependência entre ações:** uma ação só começa quando a anterior termina. O líder
  do projeto pode liberar o início antes disso.
- **Edição em lote:** remarcar o previsto e trocar o responsável de várias ações de
  uma vez.
- **Riscos e bloqueios** por projeto, **links e anexos** por ação (só o endereço,
  sem guardar o arquivo) e **comentários** com aviso para as pessoas marcadas.
- **Modelos de projeto:** criar um projeto a partir de um conjunto de ações pronto.
- **Meus projetos** e **Minhas ações:** o que é de cada pessoa.

### Gestão e acompanhamento
- **Dashboards** em abas: Gestão, Panorama, Distribuição, Prazos, Evolução no tempo,
  Qualidade do cadastro, Card WIN e Auditoria. Cada relatório responde a uma pergunta
  de negócio e traz um guia de leitura.
- **Matriz de Priorização** (Benefício × Esforço, ponderada por GUT), com pesos
  configuráveis. A matriz recomenda a prioridade, e a decisão continua humana.
- **Reunião:** modo de projeção para a daily.
- **Resumo semanal** para os administradores.
- **Exportação para Excel** de projetos, ações e ações atrasadas.

### Card WIN semanal
- O compromisso semanal individual da GIA (*What's Important Now*), com limite de
  3 WINs por semana garantido pelo próprio banco.
- Visão da equipe para a daily, em modo somente leitura.
- **Promoção:** um WIN que se repete por 3 semanas vira projeto ou ação do plano.

### Avisos
- **Notificações** no sistema, com o sino no cabeçalho.
- **E-mail semanal** de ações atrasadas para cada responsável, toda segunda às 8h.
- **Alertas de erro** por e-mail para os administradores.

### Administração
- **Perfis:** Administrador, Colaborador (o padrão) e Leitor (consulta e exporta,
  mas não grava).
- **Colaboradores:** ativar, desativar, corrigir o nome e definir a área.
- **Lixeira:** restaurar um projeto excluído. Nenhuma exclusão de projeto é física.
- **Painel do sistema** e **registro de erros**.
- **Manual do usuário** dentro do próprio sistema, em `/manual`.

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | [Next.js 16](https://nextjs.org) (App Router, Server Components e Server Actions) |
| Linguagem | TypeScript 5 |
| Interface | React 19 e Tailwind CSS 4. Gráficos em SVG inline, sem biblioteca de charting |
| Banco | PostgreSQL 16, com [Prisma 7](https://www.prisma.io) e o adaptador `@prisma/adapter-pg` |
| Autenticação | [Clerk](https://clerk.com), com login Microsoft (Azure AD) |
| E-mail | [Resend](https://resend.com) |
| Planilhas | `exceljs` para exportar e `xlsx` para importar |
| Testes | [Vitest](https://vitest.dev) e [Playwright](https://playwright.dev) |
| Hospedagem | [Vercel](https://vercel.com) para o app e o cron, [Railway](https://railway.com) para o PostgreSQL |

## Arquitetura

```mermaid
flowchart LR
    U[Navegador] -->|HTTPS| P[proxy.ts<br/>Clerk: exige login]
    P --> RSC[Server Components<br/>páginas em src/app]
    P --> SA[Server Actions<br/>mutações]
    RSC --> L[src/lib<br/>regras de negócio puras]
    SA --> L
    L --> DB[(PostgreSQL<br/>via Prisma)]
    SA --> H[HistoricoAlteracao<br/>trilha de auditoria]
    H --> DB
    C[Vercel Cron<br/>segunda, 8h] --> API["/api/cron/atrasos"] --> E[Resend<br/>e-mail]
```

- **Server Actions** fazem as mutações. API routes existem só para o que precisa de
  URL: cron, exportação e verificação de saúde.
- **As regras de negócio ficam em `src/lib`**, em módulos puros sem Prisma nem Next,
  cada um com seu `.test.ts`. O painel e os dashboards partem das mesmas funções,
  então nunca somam diferente.
- **O acesso é fechado por padrão:** toda rota exige login, exceto as listadas em
  `src/lib/rotas-publicas.ts`. Também é preciso ter um e-mail principal verificado
  do domínio `@ctcea.org.br`.
- **O tema claro ou escuro** usa tokens em CSS. Um script inline no `<head>` aplica a
  escolha antes da primeira pintura, para não haver flash branco.

## Estrutura do repositório

```
.
├── prisma/
│   ├── schema.prisma        # modelo de dados (nomes do domínio em português)
│   ├── migrations/          # migrations versionadas; nunca editar uma já aplicada
│   └── seed.ts              # 3 projetos de exemplo com 5 ações cada
├── scripts/                 # importadores de planilha e migração no build
├── src/
│   ├── app/                 # rotas (App Router), páginas e Server Actions
│   │   └── api/             # cron, exportação e saúde
│   ├── components/          # componentes de interface
│   ├── lib/                 # regras de negócio puras + testes unitários (*.test.ts)
│   ├── generated/           # cliente Prisma gerado (fora do Git)
│   └── proxy.ts             # autenticação de toda requisição
├── tests/
│   ├── integracao/          # testes das Server Actions contra um Postgres real
│   └── e2e/                 # testes de navegador (Playwright)
├── .github/workflows/ci.yml # lint, testes, build e teste de navegador
├── CLAUDE.md                # decisões de projeto e regras de negócio
├── SCHEMA.md                # resumo do modelo de dados
└── PROGRESS.md              # andamento do backlog
```

## Como rodar localmente

### Pré-requisitos
- **Node.js 24.x**, versão fixada em `engines` no `package.json`.
- **Docker**, para o PostgreSQL local, ou acesso a um PostgreSQL 16.
- Uma aplicação no **Clerk**. A instância de desenvolvimento serve.

### Passo a passo

```bash
# 1. Clonar e instalar. O postinstall já gera o cliente Prisma.
git clone git@github.com:fabianojp06/cronograma.git
cd cronograma
npm ci

# 2. Subir um PostgreSQL local descartável
docker run -d --name cronograma-pg \
  -e POSTGRES_USER=cronograma -e POSTGRES_PASSWORD=cronograma \
  -e POSTGRES_DB=cronograma -p 55432:5432 postgres:16

# 3. Configurar as variáveis (veja a próxima seção)
cp .env.example .env
#    DATABASE_URL="postgresql://cronograma:cronograma@localhost:55432/cronograma?schema=public"
#    e as chaves do Clerk

# 4. Criar as tabelas e carregar os dados de exemplo
npm run db:deploy
npm run db:seed

# 5. Rodar
npm run dev
```

O sistema abre em [http://localhost:3000](http://localhost:3000) e redireciona para
`/entrar`.

> **Para entrar localmente**, a sua conta do Clerk precisa ter o e-mail principal em
> `@ctcea.org.br`, ou o seu endereço precisa estar em `EMAILS_EXCECAO`.

## Variáveis de ambiente

O modelo completo, com comentários, está em [`.env.example`](.env.example). Nunca
faça commit do `.env` real: ele já está no `.gitignore`.

| Variável | Obrigatória | Para que serve |
|---|---|---|
| `DATABASE_URL` | Sim | Conexão com o PostgreSQL |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Sim | Chave pública do Clerk. É embutida no JavaScript durante o build |
| `CLERK_SECRET_KEY` | Sim | Chave secreta do Clerk |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` / `_SIGN_UP_URL` | Sim | Rotas de login em português: `/entrar` e `/cadastrar` |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` / `_SIGN_UP_FALLBACK_REDIRECT_URL` | Sim | Para onde ir depois do login: `/` |
| `EMAILS_EXCECAO` | Não | Endereços, separados por vírgula, que entram mesmo fora de `@ctcea.org.br` |
| `RESEND_API_KEY` | Não | Liga o envio de e-mails. Só funciona em produção |
| `EMAIL_REMETENTE` | Não | Remetente dos e-mails. Sem ele, usa o endereço de teste do Resend |
| `EMAIL_ALERTAS` | Não | Quem recebe os alertas de erro. Sem ela, vão para os administradores ativos |
| `APP_URL` | Não | Endereço público usado nos links dos e-mails |
| `CRON_SECRET` | Em produção | Autoriza a chamada do cron em `/api/cron/atrasos` |
| `PULAR_MIGRACAO` | Não | Emergência: pula a migration no build de produção |

**E-mails só saem em produção** (`VERCEL_ENV=production`). Na máquina local, no CI
e nos previews nenhum e-mail é enviado, mesmo com a chave configurada.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Migration de produção, quando aplicável, e `next build` |
| `npm start` | Servidor de produção, depois do build |
| `npm run lint` | ESLint |
| `npm test` | Testes unitários (Vitest) |
| `npm run test:watch` | Testes unitários em modo observação |
| `npm run test:integracao` | Testes contra um PostgreSQL real. Veja o aviso em [Testes](#testes) |
| `npm run test:e2e` | Testes de navegador (Playwright) |
| `npm run db:deploy` | Aplica as migrations pendentes |
| `npm run db:migrate` | Cria uma migration nova, só em desenvolvimento |
| `npm run db:seed` | Carrega os projetos de exemplo |
| `npm run db:studio` | Abre o Prisma Studio |
| `npm run importar:pla-dep` | Importa a planilha PLA-DEP (simula, a menos que receba `--gravar`) |
| `npm run importar:cro-dep` | Importa uma planilha CRO-DEP (simula, a menos que receba `--gravar`) |
| `npm run importar:card-win` | Importa uma semana do Card WIN (simula, a menos que receba `--gravar`) |
| `npm run validar:importacao` | Confere a importação contra a planilha de origem |
| `npm run carregar:modelos` | Carrega os modelos de projeto iniciais |

## Banco de dados e migrations

- **Os nomes do domínio são em português** (`Projeto`, `Acao`, `previstoInicio`,
  `realizadoTermino`), a mesma linguagem das planilhas.
- **Nunca altere uma migration já aplicada.** Toda mudança de schema é uma
  migration nova: `npm run db:migrate -- --name descricao`.
- **Duas proteções existem só em SQL**, porque o Prisma não consegue expressá-las:
  o índice parcial `WinSemana_cardId_ordem_no_card` e a CHECK
  `WinSemana_ordem_entre_1_e_3`. Um `migrate dev` pode gerar um `DROP` delas, então
  revise o SQL de toda migration gerada antes do commit.
- **Exclusão de projeto é lógica** (`ativo = false`), e o projeto pode ser
  restaurado pela Lixeira.

O resumo do modelo está em [`SCHEMA.md`](SCHEMA.md) e o schema completo em
[`prisma/schema.prisma`](prisma/schema.prisma).

## Importação das planilhas

Os importadores leem as planilhas originais e usam o banco da `DATABASE_URL` de
quem roda o comando. **Por padrão eles só simulam:** imprimem o relatório de
conferência e não gravam nada. Para gravar, acrescente `--gravar`.

```bash
# 1. Simular e conferir o relatório
npm run importar:pla-dep -- ./PLA-DEP-2026-001.xlsx

# 2. Gravar
npm run importar:pla-dep -- ./PLA-DEP-2026-001.xlsx --gravar

# 3. Comparar o que foi gravado com a planilha de origem
npm run validar:importacao -- ./PLA-DEP-2026-001.xlsx
```

| Importador | Uso |
|---|---|
| PLA-DEP | `npm run importar:pla-dep -- <arquivo.xlsx> [--gravar]` |
| CRO-DEP | `npm run importar:cro-dep -- <arquivo.xlsx> [--nome=…] [--referencia=…] [--gravar]` |
| Card WIN | `npm run importar:card-win -- <arquivo.xlsx> [--semana 39] [--ano 2026] [--colaborador "Nome"] [--gravar]` |

- Argumento faltando, vazio ou desconhecido **aborta com erro**, em vez de ser
  ignorado.
- O importador do Card WIN não renomeia um colaborador que já existe, e não
  sobrescreve a área definida pela tela. Quando o nome da planilha diverge do
  cadastro, use `--colaborador` para indicar quem é a pessoa.

> **Confira a `DATABASE_URL` antes de importar.** O importador grava no banco que
> ela indicar, inclusive no de produção.

## Testes

São três níveis, do mais rápido ao mais completo:

| Nível | Comando | Onde fica | Precisa de banco |
|---|---|---|---|
| Unitário | `npm test` | `src/lib/**/*.test.ts` | Não |
| Integração | `npm run test:integracao` | `tests/integracao/` | Sim |
| Navegador | `npm run test:e2e` | `tests/e2e/*.spec.ts` | Sim, só local |

> [!CAUTION]
> **Os testes de integração apagam as tabelas e não conferem o banco.** Eles rodam
> contra o banco da `DATABASE_URL`, seja ele qual for. Use sempre um banco
> descartável, **nunca** o de produção.

```bash
# Banco descartável para os testes
docker run -d --name cronograma-teste -e POSTGRES_PASSWORD=teste \
  -e POSTGRES_DB=cronograma -p 57432:5432 postgres:16

export DATABASE_URL=postgresql://postgres:teste@127.0.0.1:57432/cronograma
npm run db:deploy
npm run test:integracao

# Teste de navegador: na primeira vez, instale o Chromium
npx playwright install --with-deps chromium
npm run test:e2e
```

- **O teste de navegador** usa um login falso (`E2E_AUTH_FALSA=1`), trocado pela
  configuração, sem exceção no código. Ele recusa qualquer banco que não seja
  `localhost`, e o login falso se recusa a carregar na Vercel.
- **Mudou alguma ação do Card WIN (`/wins`)?** Rode também os testes de integração.
  Os erros dessa área só aparecem com o banco.

## Integração contínua

O workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) roda em todo pull
request e em todo push na `main`, com dois jobs:

| Job | O que roda |
|---|---|
| **Lint, testes e build** | `npm ci`, `npm run lint`, `npm test` e `npm run build`. O build também faz o typecheck |
| **Teste de navegador** | PostgreSQL descartável, migrations, Chromium e `npm run test:e2e` |

Um push novo na mesma branch cancela a execução anterior. O CI também pode ser
disparado à mão pela aba **Actions**.

## Deploy

A produção roda na **Vercel**, no projeto `cronograma-lktu`, com o banco no
**Railway**. Todo merge na `main` publica em produção.

- **As migrations rodam no build**, antes do `next build`, por
  [`scripts/migrar-producao.ts`](scripts/migrar-producao.ts), e **só quando
  `VERCEL_ENV=production`**. Os previews compartilham o banco de produção, então
  migrar ali aplicaria a mudança antes do merge.
- **Uma migration com falha aborta o build**, em vez de publicar um código que
  espera tabelas que não existem.
- **O cron** (`vercel.json`) chama `/api/cron/atrasos` toda segunda às 11:00 UTC,
  que são 8:00 em Brasília.
- **A verificação de saúde** responde em `/api/saude`, sem login, com "ok" ou "fora"
  e o tempo de resposta do banco.

## Fluxo de desenvolvimento

1. Crie uma branch a partir da `main`.
2. Desenvolva com testes. Regras de negócio vão para `src/lib`, com o `.test.ts`
   ao lado.
3. Rode `npm run lint`, `npm test` e, se a mudança mexe com banco,
   `npm run test:integracao`.
4. Abra o pull request. O CI precisa passar antes do merge.

Parte do backlog é executada por um loop autônomo
([`autoloop.sh`](autoloop.sh), ou [`autoloop.ps1`](autoloop.ps1) no Windows), que
lê o [`PROGRESS.md`](PROGRESS.md), implementa a próxima etapa e só segue se a
verificação passar. As regras dele estão no [`CLAUDE.md`](CLAUDE.md).

## Convenções

- **A interface e os dados são em português do Brasil**, e os nomes do domínio no
  código também.
- **Mutação de ação sempre grava histórico** em `HistoricoAlteracao`.
- **Cores só por tokens** (`bg`, `surface`, `text`, `accent`, `warn`…), definidos
  em `src/app/globals.css`, para os modos claro e escuro. Nenhum componente testa o
  tema por conta própria.
- **Gráficos seguem regras de leitura:** um único eixo, magnitude em uma cor só,
  cores de status reservadas e números sempre visíveis. Os detalhes estão no
  `CLAUDE.md`.
- **Fora de escopo:** multi-tenancy e integração com o SGO 2.0. São sistemas
  separados.

## Documentação relacionada

| Documento | Conteúdo |
|---|---|
| [`CLAUDE.md`](CLAUDE.md) | Decisões de projeto, regras de negócio e o porquê de cada uma |
| [`SCHEMA.md`](SCHEMA.md) | Resumo do modelo de dados |
| [`PROGRESS.md`](PROGRESS.md) | Andamento do backlog |
| `/manual` (no sistema) | Manual do usuário, tela a tela |

## Licença

Software de uso interno da CTCEA. Todos os direitos reservados. A cópia, a
distribuição ou o uso fora da organização não são permitidos sem autorização.
