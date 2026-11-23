# Flash Report e Sinal do Projeto Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Entregar a coluna "Sinal" na lista de projetos e a tela `/projetos/[id]/flash-report`, ambas calculadas do sistema, com macroetapa como cadastro do projeto.

**Architecture:** Três módulos puros novos em `src/lib/` (`avanco-fisico`, `farol-projeto`, `flash-report`), cada um com `.test.ts`, no padrão do resto de `src/lib/`. Migration só aditiva. A tela e a coluna só renderizam o que os módulos devolvem; o servidor carrega os dados e, para semanas passadas, reconstrói o estado com `fotoDoProjeto`.

**Tech Stack:** Next.js App Router, Prisma/PostgreSQL, Tailwind, Vitest, Playwright. Sem biblioteca de gráfico (SVG/CSS no servidor).

**Spec:** `docs/superpowers/specs/2026-11-23-flash-report-design.md`

## Global Constraints

- Nomes de domínio em português (`Macroetapa`, `macroetapaId`, `pedeAjuda`).
- Migration NOVA e aditiva; nunca editar migration aplicada. Conferir o SQL gerado: se houver `DROP` de índice parcial ou CHECK de `WinSemana`, remover do arquivo (o Prisma não os expressa).
- Só banco local descartável (`postgresql://postgres:teste@127.0.0.1:57432/cronograma`); nunca a `DATABASE_URL` de produção.
- Toda mutação de `Acao` grava `HistoricoAlteracao` (campo `macroetapa`, com o NOME).
- Server Action nova de gravação: `contaPodeEditar` logo após `auth()`; `catch` usa `registrarFalha`, nunca `console.error`.
- Campo ausente no `FormData` não mexe; vazio remove.
- Cores de status reservadas: Previsto azul, Realizado verde, atraso `warn`, atenção token `atencao`. "Adiantado" é verde com seta. Identidade nunca só na cor (palavra + ícone + motivo).
- Sem `uppercase`/`tracking-wide`; texto mínimo 13 px (`text-xs`); contraste conferido por `tipografia.test.ts`.
- Datas em dias úteis (`dias-uteis.ts`); semana é a da CTCEA (`semana-ctcea.ts`, domingo a sábado), com `SeloSemana`/"S{n}".
- Nenhuma tela rola de lado a 390 px e 768 px; tabela larga usa `TabelaEmpilhavel`.
- Limites do sinal, em UM lugar (`farol-projeto.ts`): `LIMITE_ATRASADO = -10`, `LIMITE_ATENCAO = -3`, `LIMITE_ADIANTADO = 3` (p.p.).
- Máximo de 12 macroetapas por projeto.
- Manual (`manual-conteudo.ts`, com `desde: '2026-11-23'` ou a data da entrega) e CLAUDE.md entram no mesmo PR.
- Fluxo de branch: branch `etapa-49-flash-report` a partir de `homologacao`; PR contra `homologacao`.
- Commits terminam com as linhas de atribuição do ambiente.

## Review Focus

1. Projeto sem ação com data, ou com data só numa ponta, ou término antes do início: sinal "Sem dados", relatório com aviso; nunca `NaN`, divisão por zero ou erro 500 (Tasks 2, 3, 7).
2. `?semana=` inválida, futura ou fora da janela do projeto: cai na semana corrente (Task 8).
3. Projeto antigo, com todas as ações sem macroetapa: relatório mostra só "Sem macroetapa" com convite a cadastrar, não uma tela vazia (Tasks 7, 8).
4. POST forjado escolhendo macroetapa de OUTRO projeto, ou nome repetido com outro acento/caixa: recusado com mensagem (Task 4, 5).
5. Excluir macroetapa que tem ações: as ações ficam desvinculadas e o histórico registra a troca (Task 4).

---

### Task 1: Schema e migration

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `prisma/migrations/<timestamp gerado pelo Prisma>_flash_report/migration.sql`
- Commit também: `docs/superpowers/specs/2026-11-23-flash-report-design.md` e este plano (já escritos).

**Interfaces:**
- Produces: modelo `Macroetapa { id, projetoId, nome, ordem Int, createdAt, updatedAt }` com `@@unique([projetoId, nome])` e `@@index([projetoId])`; `Acao.macroetapaId String?` (`onDelete: SetNull`, `@@index([macroetapaId])`); `Projeto.cliente String?`, `Projeto.objetivo String?`, `Projeto.macroetapas Macroetapa[]`; `RiscoProjeto.pedeAjuda Boolean @default(false)`.

- [ ] **Step 1:** `git switch homologacao && git pull && git switch -c etapa-49-flash-report`; trazer os dois documentos (spec e plano) e commitá-los.
- [ ] **Step 2:** Editar o schema como em Interfaces.
- [ ] **Step 3:** Subir o Postgres descartável (como na seção de testes de integração do CLAUDE.md) e rodar `npx prisma migrate dev --create-only --name flash_report`. Abrir o SQL e confirmar que só há `CREATE TABLE`, `ADD COLUMN` e índices novos (nenhum `DROP`).
- [ ] **Step 4:** `npx prisma migrate deploy && npx prisma generate && npx tsc --noEmit`. Esperado: sem erros.
- [ ] **Step 5:** `npm run test:integracao`. Esperado: tudo passa (inclusive a verificação do índice parcial e da CHECK de WIN).
- [ ] **Step 6:** Commit `"Flash Report: schema de macroetapa, cliente, objetivo e pedeAjuda"`.

### Task 2: Avanço físico (regra pura)

**Files:**
- Create: `src/lib/avanco-fisico.ts`, `src/lib/avanco-fisico.test.ts`

**Interfaces:**
- Consumes: `StatusAcao` (`src/generated/prisma/enums`), `diasUteisEntre(inicio: Date, fim: Date): number` (`dias-uteis.ts`, as duas pontas contam).
- Produces:
  - `PERCENTUAL_DO_STATUS: Record<StatusAcao, number>` (0, 25, 50, 75, 100).
  - `type AcaoParaAvanco = { status: StatusAcao; previstoInicio: Date | null; previstoTermino: Date | null }`.
  - `pesoDaAcao(a: AcaoParaAvanco): number` (dias úteis do previsto; 0 se faltar data ou término < início).
  - `previstoDaAcaoEm(a: AcaoParaAvanco, data: Date): number` (0 antes do início, 100 a partir do término, senão `diasUteisEntre(início, data) / peso * 100`).
  - `realizadoDaAcao(a: AcaoParaAvanco): number`.
  - `type Avanco = { previsto: number; realizado: number; desvio: number; peso: number; acoesSemPeso: number }` (percentuais com 1 casa; `desvio` = realizado − previsto calculado antes de arredondar).
  - `avancoEm(acoes: readonly AcaoParaAvanco[], data: Date): Avanco | null` (`null` se o peso total é 0).

- [ ] **Step 1: Testes.** `pesoDaAcao` de segunda a sexta = 5; sem data = 0; término antes do início = 0. `previstoDaAcaoEm` antes do início = 0, depois do término = 100, no 3º dos 5 dias úteis = 60. `avancoEm`: duas ações (peso 5 e 15), a primeira CONCLUIDO e a segunda NAO_INICIADO, previsto 100/0 → `realizado` 25, `previsto` 25, `desvio` 0. `avancoEm([], d)` e só ações sem peso → `null`, e `acoesSemPeso` contado quando há ao menos uma com peso.
- [ ] **Step 2:** `npx vitest run src/lib/avanco-fisico.test.ts`. Esperado: FAIL (módulo inexistente).
- [ ] **Step 3:** Implementar. Média ponderada pelo peso; arredondar com uma função `umaCasa(n)`.
- [ ] **Step 4:** Rodar o teste. Esperado: PASS.
- [ ] **Step 5:** Commit `"Flash Report: avanço físico ponderado (regra pura)"`.

### Task 3: Sinal do projeto (regra pura)

**Files:**
- Create: `src/lib/farol-projeto.ts`, `src/lib/farol-projeto.test.ts`

**Interfaces:**
- Consumes: `avancoEm`, `AcaoParaAvanco` (Task 2); `riscoAberto(status: string): boolean` (`risco-projeto.ts`).
- Produces:
  - constantes `LIMITE_ATRASADO`, `LIMITE_ATENCAO`, `LIMITE_ADIANTADO` (valores em Global Constraints).
  - `type SinalProjeto = 'ATRASADO' | 'ATENCAO' | 'EM_DIA' | 'ADIANTADO' | 'SEM_DADOS'`; `ROTULO_SINAL: Record<SinalProjeto, string>` ("Atrasado", "Atenção", "Em dia", "Adiantado", "Sem dados"); `ORDEM_SINAL` do pior ao melhor (para ordenar).
  - `type RiscoParaSinal = { impacto: string; status: string; prazo: Date | null }`.
  - `type Farol = { sinal: SinalProjeto; desvio: number | null; motivo: string; subiuPorRisco: boolean }`.
  - `sinalDoProjeto(e: { acoes: readonly AcaoParaAvanco[]; riscos: readonly RiscoParaSinal[]; hoje: Date }): Farol`.

- [ ] **Step 1: Testes.** Desvio −10 → ATRASADO; −9,9 e −3 → ATENCAO; −2,9 e +3 → EM_DIA; +3,1 → ADIANTADO. Sem ações com peso → SEM_DADOS com `desvio: null` e motivo "Sem ações com datas previstas". EM_DIA com risco `impacto: 'ALTO'` aberto e `prazo < hoje` → ATENCAO com `subiuPorRisco: true`; ATRASADO nunca passa disso; risco resolvido ou impacto MEDIO não sobe; SEM_DADOS não sobe. `motivo` sempre não vazio e cita o desvio ("−4 p.p.").
- [ ] **Step 2:** Rodar; esperado FAIL.
- [ ] **Step 3:** Implementar, avaliando em `hoje`. A fronteira −3 pertence a ATENCAO (resolve a sobreposição da spec: "amarelo a partir de −3"; Em dia é −3 < d ≤ +3). "Sobe um nível" anda um passo em `ADIANTADO → EM_DIA → ATENCAO → ATRASADO`.
- [ ] **Step 4:** Rodar; esperado PASS.
- [ ] **Step 5:** Commit `"Flash Report: sinal do projeto (regra pura)"`.

### Task 4: Cadastro de macroetapas

**Files:**
- Create: `src/lib/macroetapa.ts`, `src/lib/macroetapa.test.ts`, `src/app/projetos/acoes-macroetapa.ts`, `src/components/secao-macroetapas.tsx`, `tests/integracao/macroetapas.test.ts`
- Modify: `src/app/projetos/[id]/page.tsx` (montar a seção, só com permissão de editar; Leitor usa `AvisoSomenteLeitura`)

**Interfaces:**
- Consumes: `chaveDoNome(nome: string): string` (`colaborador-validacao.ts`), `contaPodeEditar(userId: string): Promise<boolean>`, `registrarFalha`, `gravarAcaoComHistorico` (`acao-historico.ts`) para o histórico das ações desvinculadas.
- Produces:
  - `MAXIMO_MACROETAPAS = 12`; `validarNomeMacroetapa(nome: string, existentes: readonly { id: string; nome: string }[], idAtual?: string): { ok: true; nome: string } | { ok: false; erro: string }` (1 a 80 caracteres aparados; conflito por `chaveDoNome`; trocar só acento/caixa do próprio nome é permitido).
  - Server Actions `criarMacroetapa`, `renomearMacroetapa`, `reordenarMacroetapa` (intenção `subir`/`descer`), `excluirMacroetapa`, todas `(prev, formData)` no padrão das ações vizinhas, devolvendo `{ ok, mensagem }`.

- [ ] **Step 1: Testes unitários** de `validarNomeMacroetapa`: "Homologação" vs "homologacao" → erro; vazio e 81 caracteres → erro; renomear para a mesma grafia com outra caixa do PRÓPRIO id → ok; 13ª macroetapa → erro (usar uma função auxiliar `podeCriarMais(qtd: number): boolean`).
- [ ] **Step 2: Testes de integração** (`tests/integracao/macroetapas.test.ts`, no estilo de `links-acao.test.ts`): criar duas macroetapas → `ordem` 1 e 2; reordenar troca as duas; excluir macroetapa com 2 ações deixa `macroetapaId` nulo nas duas e grava uma linha `HistoricoAlteracao` (`campo = 'macroetapa'`, valor novo vazio) por ação; Leitor recebe recusa e nada grava; excluir ou renomear id de outro projeto não afeta.
- [ ] **Step 3:** Rodar os dois; esperado FAIL.
- [ ] **Step 4:** Implementar módulo, ações e seção (lista ordenada com renomear, subir/descer, excluir com confirmação no navegador; aviso de que excluir só desvincula as ações).
- [ ] **Step 5:** `npx vitest run src/lib/macroetapa.test.ts && npm run test:integracao -- macroetapas`. Esperado: PASS.
- [ ] **Step 6:** Commit `"Flash Report: cadastro de macroetapas do projeto"`.

### Task 5: Macroetapa na ação, cliente/objetivo no projeto, pedido de ajuda no risco

**Files:**
- Modify: `src/components/formulario-acao.tsx`, `src/app/projetos/acoes-acao.ts`, `src/lib/acao-validacao.ts`, `src/lib/acao-historico.ts` (campo auditado `macroetapa`, gravando o NOME) e `rotularCampo` em `src/lib/dashboard-auditoria.ts` ("Macroetapa"), `src/components/formulario-projeto.tsx`, `src/app/projetos/acoes-projeto.ts`, `src/components/formulario-risco.tsx`, `src/app/projetos/acoes-risco.ts`, `src/lib/risco-projeto.ts`, `src/components/secao-riscos.tsx` (selo "Pede decisão da diretoria")
- Test: `tests/integracao/macroetapas.test.ts` (acrescentar), `src/lib/acao-validacao.test.ts`, `src/lib/risco-projeto.test.ts`

**Interfaces:**
- Consumes: Task 1 (campos) e Task 4 (macroetapas do projeto).
- Produces: `lerMacroetapaId(formData: FormData): string | null | undefined` (ausente → `undefined`, vazio → `null`), no padrão de `lerResponsavelId`.

- [ ] **Step 1: Testes.** Unit: `lerMacroetapaId` nos três casos. Integração: atualizar ação com macroetapa do mesmo projeto grava `macroetapaId` e uma linha de histórico com os NOMES antigo/novo; macroetapa de OUTRO projeto (id forjado) é recusada e nada muda; campo ausente não altera; criar projeto com `cliente`/`objetivo` persiste e editar só o nome não os apaga; risco criado com `pedeAjuda` marcado persiste e `riscoAberto` + `pedeAjuda` é o critério do pedido.
- [ ] **Step 2:** Rodar; esperado FAIL.
- [ ] **Step 3:** Implementar: `select` "Macroetapa" no formulário da ação (opção vazia = "Sem macroetapa"), campos `cliente` (até 120) e `objetivo` (até 1000) no formulário do projeto, caixa "Precisa de decisão da diretoria" no formulário do risco, tudo com a regra "ausente não mexe".
- [ ] **Step 4:** `npx vitest run && npm run test:integracao`. Esperado: PASS.
- [ ] **Step 5:** Commit `"Flash Report: macroetapa na ação, cliente/objetivo e pedido de ajuda"`.

### Task 6: Coluna "Sinal" na lista e no painel

**Files:**
- Create: `src/components/sinal-projeto.tsx`
- Modify: `src/lib/projetos-listagem.ts`, `src/components/lista-projetos.tsx` (`LinhaProjeto` ganha `sinal: Farol`), `src/lib/projeto-filtros.ts`, `src/components/filtros-projetos.tsx`, `src/app/projetos/page.tsx`, `src/app/page.tsx`, `src/lib/exportacao.ts`
- Test: `src/lib/projetos-listagem.test.ts`, `src/lib/projeto-filtros.test.ts`, `src/lib/exportacao.test.ts`, `src/lib/painel-consolidado.test.ts`

**Interfaces:**
- Consumes: `sinalDoProjeto`, `Farol`, `ORDEM_SINAL` (Task 3).
- Produces: `ProjetoComAcoes` ganha `riscos: RiscoParaSinal[]` (só riscos abertos, lidos na mesma consulta); `montarLinhas` devolve `sinal`; filtro `?sinal=ATRASADO|ATENCAO|EM_DIA|ADIANTADO|SEM_DADOS` (valor desconhecido = sem filtro); ordenação "pior sinal primeiro" como opção; `<SinalProjeto farol={Farol} />` (bolinha + ícone + palavra + "−4 p.p.", `title` com o motivo).

- [ ] **Step 1: Testes.** `montarLinhas`: projeto com ações atrasadas no ritmo e `desvio −4` → `sinal.sinal === 'ATENCAO'` enquanto `resumo.status` segue `'ATRASADO'` (convivem). Filtro por `sinal` mantém só os do estado; valor inválido ignora. Ordenação põe ATRASADO antes de ATENCAO e SEM_DADOS por último. Exportação `projetos`: colunas "Sinal" (texto) e "Desvio (p.p.)" (número, tipo `numero`/null quando sem dados). O painel e `/projetos` usam a mesma `montarLinhas` (teste em `painel-consolidado.test.ts` confere que os dois dão o mesmo sinal para o mesmo projeto).
- [ ] **Step 2:** Rodar; esperado FAIL.
- [ ] **Step 3:** Implementar. Consultas das duas páginas incluem `riscos` com `status` aberto e `select` mínimo. Texto "Como ler" curto sob o cabeçalho da coluna explicando status x sinal. Estados acessíveis: ícone distinto por estado (círculo, triângulo, check, seta para cima, traço).
- [ ] **Step 4:** `npx vitest run && npx tsc --noEmit && npx eslint`. Esperado: sem falhas.
- [ ] **Step 5:** Commit `"Sinal do projeto na lista, no painel e no Excel"`.

### Task 7: Montagem do Flash Report (regra pura)

**Files:**
- Create: `src/lib/flash-report.ts`, `src/lib/flash-report.test.ts`

**Interfaces:**
- Consumes: `avancoEm`, `AcaoParaAvanco` (Task 2); `sinalDoProjeto`, `Farol` (Task 3); `semanaDe`, `periodoDaSemana`, `distanciaEmSemanas`, `semanaSeguinte`, `SemanaCtcea` (`semana-ctcea.ts`); `classificarAcao` (`resumo-semanal.ts`); `ordenarPorAtencao`, `riscoAberto` (`risco-projeto.ts`).
- Produces:
  - `type AcaoDoRelatorio = AcaoParaAvanco & { id: string; numero: number; descricao: string; macroetapaId: string | null; realizadoTermino: Date | null; bloqueada: boolean; atrasada: boolean }`.
  - `type EntradaFlash = { projeto: { nome: string; cliente: string | null; objetivo: string | null; lider: string | null }; macroetapas: { id: string; nome: string; ordem: number }[]; acoes: readonly AcaoDoRelatorio[]; acoesNoFimDeCada: ReadonlyMap<string, readonly AcaoParaAvanco[]> /* chave = chaveSemana */; riscos: readonly RiscoDoRelatorio[]; semana: SemanaCtcea; hoje: Date }`.
  - `type FlashReport = { semanaDoProjeto: number; totalSemanas: number; periodo: PeriodoSemana; farol: Farol; consolidado: Avanco | null; macroetapas: LinhaMacro[]; curva: PontoCurva[]; realizadas: ItemAtividade[]; proximas: ItemAtividade[]; riscos: RiscoDoRelatorio[]; alertas: AlertaRelatorio[]; pedidosDeAjuda: RiscoDoRelatorio[]; avisos: string[] }`.
  - `LinhaMacro = { nome: string; avanco: Avanco | null; celulas: ('REALIZADO'|'ATENCAO'|'PLANEJADO'|null)[] }`; `PontoCurva = { rotulo: string /* "S01" */; previsto: number; realizado: number | null }`.
  - `montarFlashReport(e: EntradaFlash): FlashReport`.
  - `normalizarSemana(valor: string | undefined, janela: { primeira: SemanaCtcea; ultima: SemanaCtcea }, hoje: Date): SemanaCtcea` (inválida, futura ou fora da janela → semana de `hoje`, limitada à janela).

- [ ] **Step 1: Testes.** (a) Janela de 10 semanas, semana 7: `semanaDoProjeto === 7`, `totalSemanas === 10`. (b) Curva tem 10 pontos; `previsto` não decresce; `realizado` é `null` depois da semana escolhida e vem de `acoesNoFimDeCada` nas anteriores. (c) Macro com desvio −10 na semana escolhida: célula da semana escolhida `ATENCAO`, anteriores dentro do intervalo `REALIZADO`, posteriores `PLANEJADO`, fora do intervalo `null`. (d) Ações sem `macroetapaId` formam a linha "Sem macroetapa" só se existirem; sem macroetapa nenhuma o relatório traz esse único grupo e um `avisos` sugerindo cadastrar. (e) `realizadas`: concluídas na semana (via `classificarAcao`), máx. 4 + total em "e mais N"; `proximas`: não concluídas com previsto cruzando a semana seguinte. (f) Alertas, nesta ordem: macroetapa com desvio ≤ −10; N ações atrasadas e a mais antiga; riscos abertos vencidos; ações bloqueadas. (g) `pedidosDeAjuda` só com `pedeAjuda` e aberto, ordenados por atenção. (h) Sem nenhuma ação com peso: `consolidado === null`, `farol.sinal === 'SEM_DADOS'`, `avisos` explica, sem exceção. (i) `normalizarSemana('2026-99', …)`, `'abc'`, `undefined` e uma semana futura → semana de hoje.
- [ ] **Step 2:** Rodar; esperado FAIL.
- [ ] **Step 3:** Implementar. A semana do projeto vai da semana da menor data prevista à da maior (peso > 0 ou não, qualquer data prevista). O previsto do ponto S é medido no sábado da semana (`avancoEm(acoes, fim)`). Nenhuma dependência de Prisma ou Next.
- [ ] **Step 4:** Rodar; esperado PASS.
- [ ] **Step 5:** Commit `"Flash Report: montagem do relatório (regra pura)"`.

### Task 8: Tela do Flash Report

**Files:**
- Create: `src/app/projetos/[id]/flash-report/page.tsx`, `src/lib/flash-report-servidor.ts`, `src/components/flash-report/cabecalho-flash.tsx`, `gantt-macro.tsx`, `curva-avanco.tsx`, `blocos-flash.tsx`
- Modify: `src/app/projetos/[id]/page.tsx` (link "Flash Report"), `src/proxy.ts` só se uma rota nova exigir (não deve)
- Test: `tests/e2e/flash-report.spec.ts`

**Interfaces:**
- Consumes: `montarFlashReport`, `normalizarSemana`, `FlashReport` (Task 7); `fotoDoProjeto` / `corteDaFoto` (`foto-em-data.ts`); `SeloSemana`; `SinalProjeto` (Task 6).
- Produces: `carregarFlashReport(projetoId: string, semanaParam: string | undefined, agora: Date): Promise<FlashReport | null>` (`null` se projeto inexistente ou excluído → `notFound()`); a página lê `?semana=aaaa-ss`.

- [ ] **Step 1: Teste de navegador** (no estilo de `fluxos.spec.ts`): semear projeto com 2 macroetapas, ações em estados variados e um risco com `pedeAjuda`; abrir `/projetos/{id}/flash-report` e verificar o texto do farol, as linhas das macroetapas com os percentuais, "Pedido de ajuda" com o risco; `?semana=2026-99` abre a semana corrente; projeto sem ações mostra o aviso e não dá 500; a 390 px e a 768 px `scrollWidth <= innerWidth`.
- [ ] **Step 2:** `DATABASE_URL=postgresql://postgres:teste@127.0.0.1:57432/cronograma npx playwright test flash-report`. Esperado: FAIL (rota inexistente).
- [ ] **Step 3:** Implementar `carregarFlashReport`: uma consulta (projeto + macroetapas + ações + dependências + riscos abertos), `acoesNoFimDeCada` por `fotoDoProjeto` para cada sábado da janela até a semana escolhida (histórico lido uma vez). Se a janela começa antes da primeira ação registrada no sistema, acrescentar em `avisos` que as semanas antigas não são confiáveis. Componentes: cabeçalho com `SeloSemana`, farol (palavra + motivo) e cliente/líder/objetivo; Gantt macro em grade CSS com legenda (Realizado/Atenção/Planejado); curva em SVG de um eixo só, previsto tracejado e realizado sólido, com a tabela de números ao lado; blocos de texto (realizadas, próximas, riscos com impacto em texto, alertas, pedido de ajuda). Navegação de semana anterior/seguinte. Texto "Como ler" explicando "Avanço físico". Impressão: A4 paisagem, `print:hidden` nos controles, tema escuro desligado (padrão existente).
- [ ] **Step 4:** Rodar o e2e; esperado PASS. Conferir visualmente a tela real a 1280, 768 e 390 px, nos dois temas.
- [ ] **Step 5:** Commit `"Flash Report: tela do relatório semanal do projeto"`.

### Task 9: Manual, CLAUDE.md e fechamento

**Files:**
- Modify: `src/lib/manual-conteudo.ts`, `CLAUDE.md`, `src/lib/tour.ts` só se algum item de menu mudou (não deve)
- Test: `src/lib/manual.test.ts` (já cobra rotas)

- [ ] **Step 1:** Manual: seção "Flash Report do projeto" (`rotas: ['/projetos/[id]/flash-report']`, `desde` = data da entrega, imperativo, nomes exatos dos botões), passo novo de macroetapa na seção do projeto e da ação, e a explicação do "Sinal" na seção da lista. Rodar `npx vitest run src/lib/manual.test.ts`; esperado PASS (falha se a rota nova não tiver seção).
- [ ] **Step 2:** CLAUDE.md: seção "Flash Report e Sinal do projeto" com as regras de Global Constraints (sinal único, fronteira −3, avanço físico x percentual do painel, macroetapa opcional, histórico por nome, semanas antigas não confiáveis).
- [ ] **Step 3:** Rodar tudo: `npx tsc --noEmit && npx eslint && npm test && npm run test:integracao && npm run build`. Esperado: tudo verde.
- [ ] **Step 4:** Abrir o PR contra `homologacao` e conferir o aviso de migration nova ao promover para `main`. Commit `"Flash Report: manual e CLAUDE.md"`.
