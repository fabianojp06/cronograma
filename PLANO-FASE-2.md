# PLANO — Card WIN, fase 2

Documento de trabalho, revisado depois do code-review (8 achados). Sai do
repositório quando a fase 2 for entregue; o que sobrar vira registro no
PROGRESS.md e regra no CLAUDE.md.

## Correção de premissa

A primeira versão deste plano afirmava que a fase 2 é só leitura e **não teria
migration**. Estava errado, e a revisão mostrou por quê.

Promover e encerrar **apagam** o `WinSemana` da semana da ação. Consequência:

- a semana em que a equipe concluiu e promoveu tudo aparece vazia ou 0% na taxa
  de conclusão — o relatório pune justamente a semana boa;
- todo WIN promovido entra em "reincidentes" com uma aparição a menos, e os
  promovidos na segunda aparição somem do corte.

Reconstruir a semana a partir de `Win.promovidoEm` **não funciona**: esse campo
guarda quando a ação foi executada, não a semana em que o WIN estava no card.
Quem promove olhando uma semana passada grava um timestamp de hoje.

O erro é o mecanismo, não o escopo. A 3ª rodada de revisão da fase 1 corrigiu o
escopo (apagar só a semana da ação, não todas) mas manteve o apagamento.

### Migration `wins_ordem_opcional`

```prisma
model WinSemana {
  ordem Int?   // era Int
}
```

```sql
ALTER TABLE "WinSemana" ALTER COLUMN "ordem" DROP NOT NULL;
ALTER TABLE "WinSemana" DROP CONSTRAINT "WinSemana_ordem_entre_1_e_3";
ALTER TABLE "WinSemana" ADD CONSTRAINT "WinSemana_ordem_entre_1_e_3"
  CHECK ("ordem" IS NULL OR "ordem" BETWEEN 1 AND 3);
```

`ordem IS NULL` passa a significar **"saiu do card, mas aconteceu"**.

- **A vaga continua liberada:** no Postgres nulos não colidem em índice único,
  então `@@unique([cardId, ordem])` aceita vários nulos no mesmo card.
- O CHECK é recriado explícito. `NULL BETWEEN 1 AND 3` já passaria (avalia para
  NULL, e CHECK só reprova em FALSE), mas depender disso é depender de uma
  sutileza de SQL que a próxima pessoa não tem por que conhecer.
- Migration **nova**, nunca editando as duas existentes.

### Mudanças nas ações da fase 1

`promoverWin` e `encerrarWin`: onde hoje há `deleteMany`, passa a haver
`updateMany({ data: { ordem: null } })` com o mesmo `where`.

`removerWinDaSemana` **continua apagando**. Tirar da semana é dizer "isto não
deveria estar aqui" — correção de engano, não fato consumado. Manter a linha
inflaria a contagem de aparições com WINs que ninguém chegou a perseguir.

`proximaOrdemLivre` e `podeAdicionarWin` recebem só as ordens não nulas. A
consulta de ocupação passa a filtrar `ordem: { not: null }` — **é o ponto onde
esta mudança mais provavelmente quebra algo**, porque uma omissão aqui deixaria
o limite de 3 contando linhas que já saíram do card.

`/wins` e o bloco "semana anterior" também filtram `ordem: { not: null }`: um
WIN promovido não volta a aparecer no card.

Os 29 testes de integração existentes cobrem essas ações e têm de continuar
passando **sem alteração de expectativa** — exceto os que hoje afirmam
`winSemana.count() === 0` após promover, que passam a afirmar
`ordem === null` com a linha viva.

## O que a fase 1 deixou gravado

```
Colaborador  id, nome, clerkUserId, area, ativo
CardSemanal  id, colaboradorId, ano, semana, area, atividade, alertaRiscos, pedidoAjuda
             @@unique([colaboradorId, ano, semana])
WinSemana    id, winId, cardId, ordem (1-3 ou NULL), prazo, status
Win          id, colaboradorId, descricao, suporte, aparicoesAnteriores,
             promovidoEm, encerradoEm, projetoId, acaoId
enum StatusWin  PENDENTE | EM_ANDAMENTO | FEITO | NAO_FEITO
```

### A armadilha da dupla contagem

`contarAparicoesAte(aparicoesAnteriores, aparicoes, ate)` **já soma**
`aparicoesAnteriores`. E `totalDeAparicoes`, que `deveSerPromovido` e
`situacaoDoWin` usam, **soma de novo**.

Por isso `/wins` monta o contável com `aparicoesAnteriores: 0`
(`page.tsx:176-181`). Todo consumidor novo tem de fazer o mesmo, ou conta em
dobro os WINs importados — justamente os que mais se repetem.

Vale um teste que fixe esse contrato, já que a assimetria não é adivinhável
pela assinatura.

## Entrega 1 — Visão de equipe (`/wins/equipe`)

**Pergunta:** o que cada um comprometeu nesta semana? (O "Compartilhamento dos
Cards" da aba Agenda — o momento da daily.)

### Consulta

```ts
prisma.cardSemanal.findMany({
  where: { ano, semana },
  orderBy: { colaborador: { nome: 'asc' } },
  select: {
    area: true, atividade: true, alertaRiscos: true, pedidoAjuda: true,
    colaborador: { select: { id: true, nome: true, ativo: true } },
    registros: {
      where: { ordem: { not: null } },
      orderBy: { ordem: 'asc' },
      select: {
        ordem: true, prazo: true, status: true,
        win: {
          select: {
            id: true, descricao: true, suporte: true,
            aparicoesAnteriores: true,
            promovidoEm: true,
            encerradoEm: true,        // exigido por situacaoDoWin
            registros: { select: { card: { select: { ano: true, semana: true } } } },
          },
        },
      },
    },
  },
})
```

**`encerradoEm` não é opcional na seleção.** Sem ele, `situacaoDoWin` trata um
WIN encerrado como ativo, e a tela de equipe carimba "deve ser promovido" num
WIN que a pessoa já encerrou.

**O filtro `colaborador: { ativo: true }` saiu do `where`.** A tela navega por
semanas passadas: filtrar por ativo apagaria retroativamente os cards de quem
saiu da equipe, reescrevendo o que aconteceu naquela semana. `ativo` vem no
select e a tela marca quem está inativo — a lista de *quem falta* é que usa
apenas os ativos, porque cobrar card de quem saiu não faz sentido.

### Módulo puro: `src/lib/wins-equipe.ts`

```ts
export type WinDaEquipe = {
  ordem: number
  descricao: string
  suporte: string | null
  prazo: Date | null
  status: StatusWin
  aparicoes: number
  situacao: SituacaoWin       // reúsa situacaoDoWin
  deveSerPromovido: boolean
}

export type CardDaEquipe = {
  colaborador: { id: string; nome: string; ativo: boolean }
  area: string | null
  atividade: string | null
  alertaRiscos: string | null
  pedidoAjuda: string | null
  wins: WinDaEquipe[]
}

export function montarEquipe(cards: CardLido[], semana: SemanaCtcea): CardDaEquipe[]

/** Colaboradores ATIVOS sem card na semana — numa daily, é o dado mais acionável. */
export function semCard(
  ativos: { id: string; nome: string }[],
  cards: CardDaEquipe[],
): { id: string; nome: string }[]
```

`montarEquipe` monta o contável com `aparicoesAnteriores: 0`, como `/wins`.

### Somente leitura

Nenhuma Server Action nova, nenhum formulário. Editar card alheio é decisão de
produto que ninguém tomou, e a fase 1 amarra toda escrita ao `colaboradorId` do
usuário logado.

## Entrega 2 — Taxa de conclusão semanal (`/dashboards#wins-conclusao`)

**Pergunta:** dos WINs comprometidos em cada semana, quantos foram concluídos?

### Onde os relatórios de WIN entram na página

`/dashboards` aplica filtros a todas as seções **exceto auditoria**, e os
relatórios de WIN não têm como responder a esses filtros (equipe, natureza e
prioridade são dimensões de `Projeto`, não de `Win`).

Então os dois entram num grupo próprio, **fora do alcance dos filtros**, com a
mesma ressalva visual que a seção de auditoria já usa. Sem isso, mexer num
filtro deixaria os números de WIN parados e leria como bug.

```ts
// GRUPOS_RELATORIO ganha 'WINS', posicionado antes de AUDITORIA
{ id: 'wins-conclusao',
  titulo: 'Conclusão dos WINs por semana',
  pergunta: 'Dos WINs comprometidos em cada semana, quantos foram concluídos?',
  grupo: 'WINS' }
```

Grupo novo, e não `TEMPO`, justamente porque o comportamento sob filtro difere:
misturar com os relatórios filtráveis é que criaria a confusão.

### A consulta na virada de ano

`ano` e `semana` são duas colunas inteiras. **Nenhum intervalo contínuo sai de
um `gte`** — `ano >= 2026 AND semana >= 45` não pega a semana 3 de 2027.

A janela é gerada em memória com `semanaAnterior` (que já atravessa o ano e tem
teste) e vira um `OR` explícito:

```ts
const janela = janelaDeSemanas(ate, 12)  // [{ano, semana}, ...]
where: { card: { OR: janela.map(({ ano, semana }) => ({ ano, semana })) } }
```

12 cláusulas `OR` é barato e é a única forma correta com chave composta.

### Módulo puro: `src/lib/dashboard-wins.ts`

```ts
export type ConclusaoSemanal = {
  semana: SemanaCtcea
  rotulo: string
  total: number
  feitos: number
  naoFeitos: number
  emAndamento: number
  pendentes: number
  taxa: number | null
  emCurso: boolean      // a semana ainda não terminou
}

export function janelaDeSemanas(ate: SemanaCtcea, quantas: number): SemanaCtcea[]
export function taxaDeConclusao(
  registros: RegistroSemanal[],
  janela: SemanaCtcea[],
  hoje: Date,
): ConclusaoSemanal[]
```

- **`taxa` é `null`, não `0`, em semana sem WIN.** Zero por cento é
  "comprometeram e não entregaram"; sem card é "ninguém registrou". Achatar as
  duas acusaria a equipe de falhar em semanas de recesso.
- **A janela é densa**, incluindo semanas vazias: pular comprimiria o eixo e um
  buraco de três semanas pareceria contínuo.
- **`emCurso` marca a semana atual.** A última barra é sempre uma semana em
  aberto, e sem essa marca lê como queda a zero — o mesmo erro que a distinção
  `null`/`0` evita. Renderizada hachurada, com rótulo "em curso".
- Os WINs com `ordem = null` **contam**: saíram do card, mas aconteceram
  naquela semana.

### Visualização

Barras empilhadas, uma por semana, taxa em rótulo. Ordem da pilha:

```
FEITO (realizado/verde) → EM_ANDAMENTO (previsto/azul)
→ PENDENTE (textFaint) → NAO_FEITO (warn/laranja)
```

**Revalidar em CVD antes de entregar.** A ordem do painel foi validada para
*aquele* conjunto de cinco status; este tem quatro e o par adjacente verde/azul
não foi medido. Se o pior par ficar abaixo do piso, a ordem muda.

## Entrega 3 — WINs reincidentes (`/dashboards#wins-reincidentes`)

**Pergunta:** que assuntos se repetem, e quais já viraram plano de ação?

```ts
{ id: 'wins-reincidentes',
  titulo: 'WINs reincidentes',
  pergunta: 'Que assuntos se repetem semana após semana, e quais já viraram plano de ação?',
  grupo: 'WINS' }
```

```ts
export type WinRecorrente = {
  winId: string
  descricao: string
  colaborador: string
  aparicoes: number
  primeiraSemana: SemanaCtcea | null
  ultimaSemana: SemanaCtcea | null
  situacao: SituacaoWin
  projetoId: string | null
}

export function winsReincidentes(
  wins: WinParaRecorrencia[],
  minimoAparicoes = 2,
): WinRecorrente[]
```

- Conta **todas** as linhas `WinSemana`, inclusive `ordem = null` — é o que
  torna a contagem dos promovidos correta.
- Ordenação em três níveis: `aparicoes` desc, `ultimaSemana` desc, `descricao`.
  Os dois primeiros empatam muito, e ordem instável faz a tabela dançar.
- **Inclui promovidos e encerrados**, marcados pela `situacao`. O promovido é o
  caso de sucesso da regra; escondê-lo deixaria só os problemas em aberto e
  ninguém veria o funil funcionando. Leva link para `/projetos/{projetoId}` —
  que funciona nos dois destinos de promoção, porque promover para `ACAO`
  também grava `projetoId`.
- **`minimoAparicoes = 2`**, não 3: quem apareceu duas vezes ainda dá para
  acompanhar antes de estourar. Relatório que só mostra os estourados chega tarde.

Tabela, não gráfico: são poucas linhas e os números *são* a resposta. Barra
embutida mostrando aparições contra o limite de 3.

## Testes

- `wins-equipe.test.ts` — montagem, ordenação, `semCard` só com ativos, card de
  colaborador inativo preservado no histórico, WIN encerrado **não** marcado
  como "deve promover", e o contrato do `aparicoesAnteriores: 0`.
- `dashboard-wins.test.ts` — `taxa === null` em semana vazia contra `taxa === 0`
  em semana só com NAO_FEITO; janela densa atravessando a virada de ano;
  `emCurso` na semana atual; `aparicoesAnteriores` somando uma vez só;
  ordenação estável; WIN promovido contando a aparição da semana em que saiu.
- Integração: a migration aplicada; promover deixando `ordem = null` com a linha
  viva; a vaga liberada aceitando um WIN novo na mesma posição; o limite de 3
  **não** contando linhas com `ordem = null`; e os 29 testes existentes passando.

## Riscos

1. **O filtro `ordem: { not: null }` esquecido em algum lugar.** É o risco
   central da migration: uma omissão no cálculo de ocupação deixa o limite de 3
   contando linhas que já saíram. Mitigação: teste de integração que promove e
   depois insere um WIN novo na mesma ordem.
2. **Divergir de `/wins` na contagem.** Mitigação: reúso das mesmas funções e
   teste comparando as duas telas para o mesmo WIN.
3. **N+1 na tela de equipe.** 10 pessoas × 3 WINs, cada um trazendo
   `win.registros`. Mitigação: consulta única com include aninhado; medir se
   passar de ~50ms.
4. **Privacidade.** A tela de equipe mostra o card de todos. Na CTCEA a daily já
   é aberta e a planilha era compartilhada, mas isso é **decisão do usuário**.

## Fora de escopo, declarado

- Editar card de outra pessoa.
- Tela de administração de colaborador (desativar, renomear) — segue pendente e
  é provavelmente o próximo incômodo real.
- Exportar card para PDF/Excel.
- Notificação de WIN prestes a estourar as 3 semanas.
