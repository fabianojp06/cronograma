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
- [x] Setup do projeto Next.js (App Router) + TypeScript + Tailwind CSS
- [ ] Configurar Prisma + PostgreSQL com o schema inicial descrito em SCHEMA.md
      (models Projeto, Acao, HistoricoAlteracao, enum StatusAcao)
- [ ] Rodar a primeira migration e criar seed com 3 projetos de exemplo e 5 ações
      cada, com datas Previsto variadas (algumas no passado, algumas futuras)
- [ ] Integrar Clerk (Instance ID `ins_3JTS4qDnU1wKm8mPloItwq6KxYJ`) como autenticação,
      habilitando login social via Microsoft/Outlook (Azure AD OAuth) — usar
      `clerk_sdk_snippet` do MCP do Clerk para o código de integração correto do
      Next.js App Router; a chave secreta e a publishable key vão em variáveis de
      ambiente (`.env.local`, nunca commitadas)
- [ ] Configurar `CHECK_CMD` de testes (Jest ou Vitest) e escrever o primeiro teste
      trivial só para validar que o pipeline de teste funciona
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

- 2026-09-17 — Bloco 1, itens 1 e 2. O item de clonar o repositório já estava
  satisfeito (repo clonado em `C:/Users/fabia/Documents/crono/cronograma`, remote
  `origin` apontando para o GitHub e dois commits na raiz), então foi apenas
  marcado. Scaffold do Next.js criado com `create-next-app` (App Router,
  TypeScript, ESLint, `src/`, alias `@/*`, npm) — gerado em diretório temporário e
  copiado para a raiz porque o `create-next-app` recusa diretório não vazio.
  Versões: Next.js 16.3.5, React 19.2.8, Tailwind CSS v4 (via
  `@tailwindcss/postcss`, sem `tailwind.config.js` — configuração por `@theme` no
  CSS). Os tokens de tema do CLAUDE.md foram implementados em
  `src/app/globals.css` como CSS variables (`:root` claro / `.dark` escuro) e
  expostos ao Tailwind via `@theme inline`, mais um `@custom-variant dark` baseado
  em classe (não em `prefers-color-scheme`) para permitir a alternância manual
  claro/escuro exigida pelo protótipo. Fontes Manrope (display) e Public Sans
  (corpo) carregadas via `next/font/google`. `lang="pt-BR"`. Arquivo `teste.ts`
  (conteúdo placeholder "init") removido. Verificação: `npm run build` (que já roda
  o TypeScript) e `npm run lint` passam. Falta: definir o `CHECK_CMD` real de
  testes (item do Bloco 1 ainda pendente) — até lá, `npm run build` é a verificação
  usada.
