# PLANO — Card WIN, fase 2

Documento de trabalho, revisado depois do code-review (8 achados). Sai do
repositório quando a fase 2 for entregue; o que sobrar vira registro no
PROGRESS.md e regra no CLAUDE.md.

## Correção de premissa (3 rodadas de revisão)

A primeira versão dizia que a fase 2 é só leitura e não teria migration. Três
rodadas desmontaram isso, e a terceira mostrou que o problema não eram os
detalhes, era o mecanismo.

**Rodada 1** — promover e encerrar *apagavam* o `WinSemana` da semana da ação.
A semana em que a equipe promoveu tudo ficava vazia; cada WIN promovido perdia
uma aparição. Reconstruir por `Win.promovidoEm` não serve: o campo guarda quando
a ação rodou, não a semana em que o WIN estava no card.

**Rodada 2** — manter a linha com um desfecho diferente de `NO_CARD` resolvia a semana vazia, mas
nem `promoverWin` nem `encerrarWin` escrevem `WinSemana.status`, então o WIN
promovido seguia PENDENTE e a semana boa ainda dava 0%.

**Rodada 3** — as emendas começaram a colidir entre si: o promovido contava duas
vezes na barra, saía do denominador de todas as semanas anteriores, e
`ordem Int?` quebrava os call sites. Sintoma de desenho, não de descuido: eu
estava sobrecarregando um desfecho diferente de `NO_CARD` com um significado que ela não carrega, e
lendo desfecho de `Win.promovidoEm` — campo do WIN, não da aparição.

### O desfecho pertence à aparição

```prisma
enum DesfechoWin {
  NO_CARD      // está no card desta semana
  PROMOVIDO    // virou item do plano de ação
  ENCERRADO    // terminou aqui, concluído ou abandonado
}

model WinSemana {
  ordem    Int          // continua NOT NULL — nenhum call site quebra
  desfecho DesfechoWin  @default(NO_CARD)
}
```

A vaga é liberada por **índice único parcial**, não por nulo:

```sql
DROP INDEX "WinSemana_cardId_ordem_key";
CREATE UNIQUE INDEX "WinSemana_cardId_ordem_no_card"
  ON "WinSemana" ("cardId", "ordem") WHERE "desfecho" = 'NO_CARD';
```

O Prisma não expressa índice parcial, então ele vive em SQL na migration — mesmo
caminho já usado pela CHECK `WinSemana_ordem_entre_1_e_3`, e por isso o
`@@unique([cardId, ordem])` sai do schema com comentário explicando onde foi
parar. `@@unique([cardId, winId])` **fica**: um WIN promovido não volta ao card.

O que este desenho resolve de graça, em comparação com um desfecho diferente de `NO_CARD`:

- `ordem` continua `Int` — some a quebra de tipos e o risco do `?? 0` recriar o
  erro de contagem de vaga;
- o desfecho é **por aparição**, então um WIN promovido na S39 continua contando
  normalmente na S37 e na S38;
- vira o **discriminador único** do gráfico: ou a linha é `NO_CARD` e o `status`
  dela vale, ou é `PROMOVIDO`/`ENCERRADO` e não entra nos baldes de status. Fim
  da contagem dupla.

### Decisões de negócio (tomadas com o usuário)

- **Promovido é categoria própria**, fora do cálculo da taxa: nem concluído (o
  trabalho não acabou, mudou de lugar) nem falho (contar como fracasso ensinaria
  a equipe a evitar a promoção, que é o método funcionando).
- **Encerrar passa a perguntar o desfecho**: "Concluí" grava `FEITO`,
  "Abandonei" grava `NAO_FEITO`. Hoje a ação não pergunta, e o docstring dela
  admite a ambiguidade.

### Mudanças nas ações da fase 1

| ação | hoje | passa a ser |
|---|---|---|
| `promoverWin` | `deleteMany` | `updateMany({ desfecho: PROMOVIDO })` |
| `encerrarWin` | `deleteMany` | `updateMany({ desfecho: ENCERRADO, status })` |
| `removerWinDaSemana` | `deleteMany` | **continua apagando** |

`removerWinDaSemana` apaga porque tirar da semana é dizer "isto não deveria
estar aqui" — engano, não fato consumado. Manter a linha inflaria a contagem com
WINs que ninguém chegou a perseguir.

`encerrarWin` **deixa de devolver `void`**. Hoje ela engole erro em silêncio;
com um desfecho vindo do formulário, um valor ausente ou forjado faria a
transação falhar sem nada aparecer na tela — o WIN continuaria no card e
`encerradoEm` nunca seria escrito. Passa a validar o desfecho contra a lista e a
devolver estado, como as demais.

### As duas perguntas que a mesma consulta respondia

A consulta de ocupação servia também de guarda de duplicata em `repetirWin`.
São perguntas diferentes e passam a ser consultas diferentes:

- *"que posições estão ocupadas?"* → só `desfecho: NO_CARD`
- *"este WIN já está neste card?"* → **todas** as linhas

Confundi-las cega a guarda, e como existe `@@unique([cardId, winId])`, repetir um
WIN já promovido trocaria a mensagem amigável por um P2002 cru.

### O importador também muda

`scripts/importar-card-win.ts:238` apaga **todos** os `WinSemana` do card, sem
filtro, e a varredura de órfãos (241-246) checa só `promovidoEm`, ignorando
`encerradoEm`. Sem mexer nisso, reimportar uma semana destrói exatamente as
linhas que esta migration existe para preservar, e apaga WINs encerrados de vez.

- o `deleteMany` passa a filtrar `desfecho: NO_CARD`;
- a varredura de órfãos passa a exigir `promovidoEm: null` **e**
  `encerradoEm: null`.

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

/**
 * Colaboradores ATIVOS **sem nenhum WIN** na semana — numa daily, o dado mais
 * acionável.
 *
 * O critério é não ter WIN, e não "não ter `CardSemanal`": `garantirCard` e
 * `salvarCard` criam a linha do card só por salvar o cabeçalho, e ela sobrevive
 * à remoção dos WINs. Quem digitou a área e mais nada tem card, zero WINs, e
 * sumiria da lista de quem falta — justamente quem a daily precisa ver.
 */
export function semWins(
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
  promovidos: number    // categoria própria, fora do cálculo da taxa
  taxa: number | null   // feitos / (total - promovidos); null se denominador 0
  /**
   * Por que a taxa é nula. `SEM_WINS` é semana de recesso; `TODOS_PROMOVIDOS`
   * é a semana em que o funil funcionou melhor. Sem este campo as duas
   * renderizariam igual, e a melhor semana pareceria a mais vazia.
   */
  motivoSemTaxa: 'SEM_WINS' | 'TODOS_PROMOVIDOS' | null
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
  `null`/`0` evita. Marcada por **contorno tracejado e rótulo "em curso"** —
  nunca por hachura, que já significa outra coisa dentro da barra.
- As linhas `PROMOVIDO` e `ENCERRADO` **contam** no `total`: saíram do card,
  mas aconteceram naquela semana.
- **`promovidos` fica fora da taxa.** `taxa = feitos / (total - promovidos)`,
  e `null` quando esse denominador é zero. Promover não é concluir nem falhar:
  o trabalho mudou de lugar. Incluí-lo no denominador puniria a semana em que o
  método funcionou.

### Visualização

Barras empilhadas, uma por semana, taxa em rótulo. Ordem da pilha:

```
FEITO (realizado/verde) → PROMOVIDO (hachura sobre realizado)
→ ENCERRADO (segue o status gravado) → EM_ANDAMENTO (previsto/azul)
→ PENDENTE (textFaint) → NAO_FEITO (warn/laranja)
```

`PROMOVIDO` distingue-se por **textura, não por cor**: hachura sobre
`realizado`. Usar `accent` gastaria em status uma cor que o CLAUDE.md reserva a
magnitude, e o parentesco com o verde é correto — promover é desfecho bom.

**Hachura só pode significar uma coisa.** A semana em curso, que na versão
anterior também era hachurada, passa a ser marcada por contorno tracejado: na
última barra as duas coincidiriam e nada as distinguiria.

`ENCERRADO` não é faixa própria — o desfecho agora grava `FEITO` ou `NAO_FEITO`,
então a linha cai no balde de status correspondente. É todo o ponto de a ação
perguntar.

**Revalidar em CVD antes de entregar.** A ordem do painel foi validada para
*aquele* conjunto de cinco status; este é outro conjunto e nenhum par adjacente
aqui foi medido. Se o pior par ficar abaixo do piso, a ordem muda.

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

- Conta **todas** as linhas `WinSemana`, qualquer que seja o desfecho — é o
  que torna a contagem dos promovidos correta.
- **Soma `Win.aparicoesAnteriores`.** Contar só as linhas subconta exatamente os
  WINs importados que já vinham se repetindo: cairiam abaixo do corte de 2 e
  sumiriam do relatório que existe para encontrá-los. `primeiraSemana` fica
  `null` quando só há aparições anteriores, e a tabela mostra "antes do sistema"
  em vez de inventar uma data.
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

- `wins-equipe.test.ts` — montagem, ordenação, `semWins` só com ativos, incluindo quem tem card só de cabeçalho, card de
  colaborador inativo preservado no histórico, WIN encerrado **não** marcado
  como "deve promover", e o contrato do `aparicoesAnteriores: 0`.
- `dashboard-wins.test.ts` — os três casos de taxa nula ou zero separados
  (`SEM_WINS`, `TODOS_PROMOVIDOS` e `taxa === 0`);
  `taxa === null` em semana vazia contra `taxa === 0`
  em semana só com NAO_FEITO; janela densa atravessando a virada de ano;
  `emCurso` na semana atual; `aparicoesAnteriores` somando uma vez só;
  ordenação estável; WIN promovido contando a aparição da semana em que saiu.
- Integração: a migration aplicada; promover deixando um desfecho diferente de `NO_CARD` com a linha
  viva; a vaga liberada aceitando um WIN novo na mesma posição; o limite de 3
  **não** contando linhas com um desfecho diferente de `NO_CARD`; e os 29 testes existentes passando.

### Os testes existentes que mudam de expectativa

O impacto nos 29 é maior do que "um ou outro `count`". Mudam, no mínimo:

- `wins-banco.test.ts:185-190` — o array `restantes` do teste de promoção;
- `wins-banco.test.ts:294` e `:326-333` — os dois testes de `encerrar`, que
  hoje afirmam `winSemana.count() === 0`;
- todo teste que construa `WinSemana` assumindo `ordem` não nula.

Cada um passa a afirmar a **linha viva com um desfecho diferente de `NO_CARD`**, que é a mudança de
contrato. Reescrever essas expectativas é parte da entrega, não efeito
colateral — e nenhuma pode ser afrouxada só para passar.

## Riscos

1. **O filtro `desfecho: NO_CARD` esquecido em algum lugar.** É o risco
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
