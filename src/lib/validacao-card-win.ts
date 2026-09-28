/**
 * Conferência do que a importação do Card WIN gravou, contra a planilha.
 *
 * Módulo puro, no mesmo espírito de `validacao-importacao.ts`: compara o que
 * foi lido do arquivo com o que está no banco e devolve as divergências.
 * Quem lê o `.xlsx` e o Postgres é `scripts/validar-card-win.ts`.
 *
 * As checagens não são genéricas — cada uma corresponde a um defeito que já
 * aconteceu ou que a modelagem existe para evitar:
 *
 * - **pessoa duplicada**: `chaveDoNome` cobre acento e caixa, e só isso. Uma
 *   grafia com um nome do meio a mais cria uma segunda pessoa, com os cards de
 *   um lado e a conta do Clerk e os projetos do outro, sem erro nenhum aparecer.
 * - **vaga ocupada além de três**: o índice parcial só conta `NO_CARD`, então
 *   uma aparição promovida e outra recriada cabem juntas — `/wins` mostraria 3
 *   e `/dashboards` contaria 4.
 * - **contador de aparições**: se `aparicoesAnteriores` não bate, a regra das
 *   3 semanas dispara na hora errada, ou nunca.
 */

import { chaveDoNome } from './colaborador-validacao'

export type WinEsperado = {
  ordem: number
  descricao: string
  suporte: string | null
  status: string
  aparicoesAnteriores: number
}

export type WinGravado = {
  ordem: number
  descricao: string
  suporte: string | null
  status: string
  aparicoesAnteriores: number
  desfecho: string
}

export type ColaboradorGravado = {
  id: string
  nome: string
  area: string | null
  clerkUserId: string | null
  /** Quantos `CardSemanal` esta pessoa tem, em qualquer semana. */
  cards: number
}

export type EntradaConferencia = {
  /** O nome como a planilha escreve. */
  nomeNaPlanilha: string | null
  areaNaPlanilha: string | null
  atividadeNaPlanilha: string | null
  ano: number
  semana: number
  winsEsperados: readonly WinEsperado[]
  /** Todos os colaboradores do banco — a duplicata só aparece olhando todos. */
  colaboradores: readonly ColaboradorGravado[]
  /** O colaborador em que a planilha deveria ter entrado, por id. */
  idAlvo: string | null
  /** O card daquela semana, se existir. */
  cardGravado: { area: string | null; atividade: string | null } | null
  /** TODAS as aparições do card, inclusive promovidas e encerradas. */
  winsGravados: readonly WinGravado[]
}

export type Divergencia = {
  gravidade: 'ERRO' | 'AVISO'
  mensagem: string
}

/** Compara texto tratando "vazio" e "ausente" como a mesma coisa. */
function mesmoTexto(a: string | null, b: string | null): boolean {
  return (a ?? '') === (b ?? '')
}

export function conferirImportacao(e: EntradaConferencia): Divergencia[] {
  const d: Divergencia[] = []
  const erro = (mensagem: string) => d.push({ gravidade: 'ERRO', mensagem })
  const aviso = (mensagem: string) => d.push({ gravidade: 'AVISO', mensagem })

  const alvo = e.colaboradores.find((c) => c.id === e.idAlvo) ?? null
  if (!alvo) {
    erro('Nenhum colaborador corresponde à planilha — a importação não gravou.')
    return d
  }

  // 1. A duplicata que a flag `--colaborador` existe para evitar.
  //
  // A assinatura é específica: existe OUTRA pessoa cuja chave bate com o nome
  // escrito na planilha, diferente daquela onde o card entrou. Não é uma busca
  // por nomes parecidos — é o par exato que a importação sem a flag produz.
  if (e.nomeNaPlanilha !== null) {
    const chavePlanilha = chaveDoNome(e.nomeNaPlanilha)
    const homonimo = e.colaboradores.find(
      (c) => c.id !== alvo.id && chaveDoNome(c.nome) === chavePlanilha,
    )
    if (homonimo) {
      erro(
        `Duas pessoas para a mesma planilha: "${alvo.nome}" (${alvo.cards} card(s)) e ` +
          `"${homonimo.nome}" (${homonimo.cards} card(s)). ` +
          'A importação rodou sem --colaborador, ou com o nome errado.',
      )
    }
  }

  // 2. A pessoa partida em duas, vista pelo outro lado.
  //
  // A checagem 1 só enxerga a duplicata quando a conferência recebeu o
  // `--colaborador` certo. Sem a flag, ela resolve para a MESMA linha errada
  // que a importação criou, e nada parece fora do lugar. Esta pega o estrago
  // pela sua consequência, que independe de quem é o alvo: os cards numa
  // linha sem conta, e a conta do Clerk noutra linha sem card nenhum. É
  // exatamente a pessoa que entra no sistema e não acha o próprio card.
  const contaOrfa = e.colaboradores.find(
    (c) => c.id !== alvo.id && c.clerkUserId !== null && c.cards === 0,
  )
  if (alvo.clerkUserId === null) {
    if (contaOrfa) {
      erro(
        `A pessoa está partida em duas: "${alvo.nome}" tem o card e nenhuma conta, ` +
          `e "${contaOrfa.nome}" tem a conta do Clerk e nenhum card. ` +
          'A importação rodou sem --colaborador, ou com o nome errado.',
      )
    } else {
      aviso(`"${alvo.nome}" recebeu o card mas ainda não tem conta vinculada.`)
    }
  }

  // 3. O card da semana.
  if (!e.cardGravado) {
    erro(`Não há card de ${e.ano}/S${e.semana} para "${alvo.nome}".`)
    return d
  }
  if (!mesmoTexto(e.cardGravado.area, e.areaNaPlanilha)) {
    aviso(
      `Área do card: planilha diz "${e.areaNaPlanilha ?? '—'}", banco diz ` +
        `"${e.cardGravado.area ?? '—'}".`,
    )
  }
  if (!mesmoTexto(e.cardGravado.atividade, e.atividadeNaPlanilha)) {
    aviso(
      `Atividade do card: planilha diz "${e.atividadeNaPlanilha ?? '—'}", banco diz ` +
        `"${e.cardGravado.atividade ?? '—'}".`,
    )
  }

  // 4. A área do CADASTRO é semeada, não espelhada: quem a definiu pela tela
  //    manda. Divergir não é erro — é o comportamento documentado.
  if (alvo.area === null) {
    aviso(
      `"${alvo.nome}" está sem área no cadastro. ` +
        'Toda semana nova abrirá com a Área vazia; defina em /colaboradores.',
    )
  }

  // 5. As aparições ocupando vaga no card. Promovidas e encerradas não contam
  //    para o limite de 3, mas contam para o total de linhas.
  const noCard = e.winsGravados.filter((w) => w.desfecho === 'NO_CARD')
  if (noCard.length > 3) {
    erro(
      `${noCard.length} WINs ocupando vaga num card de 3. ` +
        'O índice parcial permite isso quando uma aparição resolvida é recriada.',
    )
  }

  const ordens = noCard.map((w) => w.ordem)
  if (new Set(ordens).size !== ordens.length) {
    erro(`Duas aparições na mesma posição: ordens ${ordens.sort().join(', ')}.`)
  }

  // 6. WIN a WIN, casando por `ordem` — é a posição no card, e é única entre
  //    as que estão NO_CARD.
  for (const esperado of e.winsEsperados) {
    const gravado = noCard.find((w) => w.ordem === esperado.ordem)
    if (!gravado) {
      const resolvido = e.winsGravados.find((w) => w.ordem === esperado.ordem)
      if (resolvido) {
        aviso(
          `WIN 0${esperado.ordem} não está mais no card (desfecho ${resolvido.desfecho}) — ` +
            'alguém já promoveu ou encerrou depois da importação.',
        )
      } else {
        erro(`WIN 0${esperado.ordem} da planilha não foi gravado.`)
      }
      continue
    }

    if (gravado.descricao !== esperado.descricao) {
      erro(
        `WIN 0${esperado.ordem} com descrição diferente:\n` +
          `    planilha: ${esperado.descricao}\n` +
          `    banco:    ${gravado.descricao}`,
      )
    }
    if (!mesmoTexto(gravado.suporte, esperado.suporte)) {
      aviso(
        `WIN 0${esperado.ordem} suporte: planilha "${esperado.suporte ?? '—'}", ` +
          `banco "${gravado.suporte ?? '—'}".`,
      )
    }
    if (gravado.status !== esperado.status) {
      aviso(
        `WIN 0${esperado.ordem} status: planilha ${esperado.status}, banco ${gravado.status}.`,
      )
    }
    // O contador é o que faz a regra das 3 semanas disparar na hora certa.
    if (gravado.aparicoesAnteriores !== esperado.aparicoesAnteriores) {
      erro(
        `WIN 0${esperado.ordem} com contador errado: planilha conta ` +
          `${esperado.aparicoesAnteriores} aparição(ões) anterior(es), banco tem ` +
          `${gravado.aparicoesAnteriores}. A regra das 3 semanas vai disparar na hora errada.`,
      )
    }
  }

  // 7. Sobrou no card algo que a planilha não tem.
  for (const gravado of noCard) {
    if (!e.winsEsperados.some((w) => w.ordem === gravado.ordem)) {
      aviso(
        `WIN 0${gravado.ordem} está no card mas não na planilha desta semana: ` +
          `"${gravado.descricao}". Pode ter sido criado pela tela.`,
      )
    }
  }

  return d
}
