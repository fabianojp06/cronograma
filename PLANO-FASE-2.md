# PLANO — Card WIN, fase 2

Documento de trabalho, submetido a revisão **antes** de escrever código. Sai do
repositório quando a fase 2 for entregue; o que sobrar vira registro no
PROGRESS.md e regra no CLAUDE.md.

A fase 1 entregou o schema, as migrations e as regras de gravação. A fase 2 é
**leitura e apresentação** — não cria tabela, não cria migration, não altera
nenhuma regra de gravação. Se alguma decisão abaixo exigir mudança de schema,
ela está errada e precisa ser repensada.

## O que a fase 1 deixou gravado

O que existe hoje, e que é tudo com que a fase 2 pode contar:

```
Colaborador  id, nome, clerkUserId, area, ativo
CardSemanal  id, colaboradorId, ano, semana, area, atividade, alertaRiscos, pedidoAjuda
             @@unique([colaboradorId, ano, semana])
WinSemana    id, winId, cardId, ordem (1-3), prazo, status
             @@unique([cardId, ordem]) + CHECK ordem BETWEEN 1 AND 3
Win          id, colaboradorId, descricao, suporte, aparicoesAnteriores,
             promovidoEm, encerradoEm, projetoId, acaoId
enum StatusWin  PENDENTE | EM_ANDAMENTO | FEITO | NAO_FEITO
```

Regras da fase 1 que a fase 2 tem de respeitar ao contar:

- **`aparicoesAnteriores` não é zero por padrão.** Vem da importação e significa
  "aparições anteriores ao sistema". Qualquer contagem de recorrência que
  ignore esse campo subconta justamente os WINs que já vinham se repetindo —
  que são os que mais interessam.
- **Promover e encerrar apagam só o `WinSemana` da semana da ação.** As demais
  aparições continuam no banco. Então um WIN promovido **ainda aparece** nas
  semanas anteriores, e é assim que deve ser.
- `Win.promovidoEm` e `Win.encerradoEm` são os únicos marcadores de fim de vida.

## Entrega 1 — Visão de equipe (`/wins/equipe`)

**Pergunta:** o que cada um comprometeu nesta semana? (É o "Compartilhamento
dos Cards" da aba Agenda da planilha — o momento da daily.)

Rota nova, `?ano=&semana=` igual a `/wins`, navegação entre semanas igual.

### Consulta

```ts
prisma.cardSemanal.findMany({
  where: { ano, semana, colaborador: { ativo: true } },
  orderBy: { colaborador: { nome: 'asc' } },
  select: {
    area: true, atividade: true, alertaRiscos: true, pedidoAjuda: true,
    colaborador: { select: { id: true, nome: true } },
    registros: {
      orderBy: { ordem: 'asc' },
      select: {
        ordem: true, prazo: true, status: true,
        win: {
          select: {
            id: true, descricao: true, suporte: true,
            aparicoesAnteriores: true, promovidoEm: true,
            registros: { select: { card: { select: { ano: true, semana: true } } } },
          },
        },
      },
    },
  },
})
```

### Módulo puro: `src/lib/wins-equipe.ts`

```ts
export type CardDaEquipe = {
  colaborador: { id: string; nome: string }
  area: string | null
  atividade: string | null
  alertaRiscos: string | null
  pedidoAjuda: string | null
  wins: WinDaEquipe[]
}

export type WinDaEquipe = {
  ordem: number
  descricao: string
  suporte: string | null
  prazo: Date | null
  status: StatusWin
  aparicoes: number          // via contarAparicoesAte, congelado na semana exibida
  deveSerPromovido: boolean  // via deveSerPromovido, já existente
}

export function montarEquipe(
  cards: CardLidoDoBanco[],
  semana: SemanaCtcea,
): CardDaEquipe[]

/** Colaboradores ativos que NÃO têm card na semana. */
export function semCard(
  ativos: { id: string; nome: string }[],
  cards: CardDaEquipe[],
): { id: string; nome: string }[]
```

**`semCard` não é enfeite.** Numa daily, quem não preencheu o card é a
informação mais acionável da tela, e uma lista que só mostra quem preencheu
esconde exatamente isso.

**Reúso obrigatório:** `contarAparicoesAte` e `deveSerPromovido` são os mesmos
de `/wins`. Recalcular aqui faria a tela de equipe divergir da tela individual
— o erro que a planilha cometia entre S36 e S37.

### Somente leitura

A tela de equipe **não** edita WIN de ninguém. Nenhuma Server Action nova, nenhum
formulário. Editar o card alheio é decisão de produto que ninguém tomou, e a
fase 1 amarra toda escrita ao `colaboradorId` do usuário logado.

## Entrega 2 — Taxa de conclusão semanal (`/dashboards#wins-conclusao`)

**Pergunta:** dos WINs comprometidos em cada semana, quantos foram concluídos?

### Catálogo

```ts
{ id: 'wins-conclusao',
  titulo: 'Conclusão dos WINs por semana',
  pergunta: 'Dos WINs comprometidos em cada semana, quantos foram concluídos?',
  grupo: 'TEMPO' }
```

Grupo `TEMPO` porque é série temporal. **Não** criar grupo novo: `GRUPOS_RELATORIO`
ordena a navegação, e um grupo com um relatório só vira ruído no índice.

### Módulo puro: `src/lib/dashboard-wins.ts`

```ts
export type RegistroSemanal = {
  ano: number
  semana: number
  status: StatusWin
}

export type ConclusaoSemanal = {
  semana: SemanaCtcea
  rotulo: string        // rotuloSemana
  total: number
  feitos: number
  naoFeitos: number
  emAndamento: number
  pendentes: number
  taxa: number | null   // feitos / total; null quando total === 0
}

export function taxaDeConclusao(
  registros: RegistroSemanal[],
  ate: SemanaCtcea,
  semanas: number,     // janela, ex.: 12
): ConclusaoSemanal[]
```

**`taxa` é `null`, não `0`, quando não houve WIN na semana.** Zero por cento
significa "comprometeram e não entregaram"; semana sem card significa "ninguém
registrou". São coisas diferentes, e achatar as duas em `0` produziria um
gráfico que acusa a equipe de falhar em semanas de recesso.

**A janela inclui semanas vazias.** Pular semanas sem card comprimiria o eixo e
faria um buraco de três semanas parecer contínuo — a série tem de ser densa.

### Visualização

Barras empilhadas por semana, **uma barra por semana**, com a taxa em rótulo.
Ordem da pilha, seguindo a regra de cor reservada do CLAUDE.md:

```
FEITO (realizado/verde) → EM_ANDAMENTO (previsto/azul)
→ PENDENTE (textFaint) → NAO_FEITO (warn/laranja)
```

Semana sem registro: coluna vazia com traço em `textFaint` e rótulo "—", nunca
uma barra de altura zero que se confunda com 0%.

**A ordem da pilha precisa ser revalidada em CVD** antes de entregar. A ordem
existente do painel (`SEM_ACOES → CONCLUIDO → …`) foi validada para *aquele*
conjunto; este tem quatro cores diferentes e o par adjacente verde/azul não foi
medido. Se o pior par adjacente ficar abaixo do piso, a ordem muda.

## Entrega 3 — WINs reincidentes (`/dashboards#wins-reincidentes`)

**Pergunta:** que assuntos ficam voltando semana após semana?

Este é o relatório que expõe o que a planilha esconde: a regra das 3 semanas só
avisa quando já estourou, e só na tela de uma pessoa.

### Catálogo

```ts
{ id: 'wins-reincidentes',
  titulo: 'WINs reincidentes',
  pergunta: 'Que assuntos se repetem semana após semana, e quais já viraram plano de ação?',
  grupo: 'QUALIDADE' }
```

### Módulo puro: mesmo `src/lib/dashboard-wins.ts`

```ts
export type WinRecorrente = {
  winId: string
  descricao: string
  colaborador: string
  aparicoes: number
  primeiraSemana: SemanaCtcea | null   // null quando só há aparicoesAnteriores
  ultimaSemana: SemanaCtcea | null
  situacao: SituacaoWin                 // reúsa situacaoDoWin da fase 1
  projetoId: string | null              // link para o item promovido
}

export function winsReincidentes(
  wins: WinParaRecorrencia[],
  minimoAparicoes = 2,
): WinRecorrente[]
```

Ordenação: `aparicoes` desc, depois `ultimaSemana` desc, depois `descricao` —
três níveis porque os dois primeiros empatam muito e uma ordem instável faz a
tabela dançar entre recargas.

**Inclui promovidos e encerrados**, marcados pela `situacao`. Um WIN que foi
promovido é o caso de sucesso da regra; escondê-lo deixaria o relatório só com
os problemas em aberto e ninguém veria o funil funcionando. Promovido leva link
para `/projetos/{projetoId}`.

**`minimoAparicoes = 2`**, não 3: quem aparece duas vezes é justamente quem
ainda dá para acompanhar antes de virar item do plano. Um relatório que só
mostra os que já estouraram chega tarde.

### Visualização

Tabela, não gráfico. São poucas linhas, cada uma com nome, dono, contagem e
situação — e a regra do CLAUDE.md diz que todo gráfico vem acompanhado dos
números. Aqui os números *são* a resposta; um gráfico seria decoração.

Barra embutida na linha mostrando aparições contra o limite de 3, no estilo do
painel (traço lateral, sem card com sombra).

## Testes

Cada módulo com seu `.test.ts`, igual ao resto de `src/lib/`:

- `wins-equipe.test.ts` — montagem, ordenação por nome, `semCard`, e o caso do
  WIN promovido que continua aparecendo nas semanas anteriores.
- `dashboard-wins.test.ts` — `taxa === null` em semana vazia contra `taxa === 0`
  em semana só com NAO_FEITO (o caso que motiva a distinção); janela densa
  atravessando virada de ano (semana 52 → 1, onde o ano do calendário diverge
  do civil); `aparicoesAnteriores` somando na recorrência; ordenação estável.

Integração (`tests/integracao/`) para a tela de equipe: um card de cada um de
dois colaboradores na mesma semana, um colaborador ativo sem card, e a
conferência de que a tela **não** expõe WIN de colaborador inativo.

## Riscos e o que pode dar errado

1. **Divergir de `/wins` na contagem.** Mitigação: reusar `contarAparicoesAte` e
   `deveSerPromovido`; teste que compara a contagem das duas telas para o mesmo
   WIN. É o erro que a planilha cometia.
2. **N+1 na tela de equipe.** Cada `WinSemana` traz `win.registros` para contar
   aparições. Com 10 pessoas × 3 WINs são 30 sub-consultas. Mitigação: uma
   consulta só, com `include` aninhado; medir com `EXPLAIN` se passar de ~50ms.
3. **Privacidade.** A tela de equipe mostra o card de todo mundo. Na CTCEA a
   daily já é aberta, e a planilha original era compartilhada — mas isso é
   **decisão do usuário, não minha**. Se ele disser que o card é individual, a
   entrega 1 sai do escopo.
4. **Virada de ano na janela de 12 semanas.** `semanaAnterior` já atravessa o
   ano corretamente e tem teste; a janela tem de usá-la, nunca `semana - 1`.

## Fora de escopo, declarado

- Editar card de outra pessoa.
- Tela de administração de colaborador (desativar, renomear) — continua
  pendente e é provavelmente o próximo incômodo real.
- Exportar o card para PDF/Excel.
- Notificação de WIN prestes a estourar as 3 semanas.
