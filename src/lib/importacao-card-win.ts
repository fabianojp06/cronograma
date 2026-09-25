/**
 * Leitura do arquivo `CARD WIN Semanal` — módulo puro, sem Prisma e sem Next.
 *
 * Recebe as células já extraídas de cada aba (o script cuida do XLSX) e devolve
 * o que deve entrar no banco. Separado do script pelo mesmo motivo do resto do
 * projeto: a regra fica coberta por teste sem depender de arquivo nem de banco.
 *
 * O ponto delicado é `aparicoesAnteriores`. A planilha não tem identidade de
 * WIN — o mesmo item aparece como "… relatórios orçamentários", depois
 * "… relatórios orçamentários ()" e depois "… relatórios orçamentários () -
 * SGO". Então a comparação por texto acontece **uma única vez, aqui na
 * importação**, só para semear o contador. Dali em diante quem carrega a
 * identidade é o registro `Win`, e nenhuma comparação de string volta a
 * acontecer.
 */

/** Uma aba de semana já lida, no formato "coluna+linha → valor". */
export type AbaSemana = {
  /** Nome da aba, ex.: "S39". */
  nome: string
  celulas: Record<string, string>
}

/** Linhas onde ficam os WINs da semana atual no layout do arquivo. */
export const LINHAS_WIN_ATUAL = [20, 21, 22] as const

export type WinLido = {
  ordem: number
  descricao: string
  suporte: string | null
  /** Serial do Excel, convertido pelo script; `null` quando vazio. */
  prazoSerial: number | null
  statusBruto: string | null
}

export type CardLido = {
  aba: string
  semana: number
  area: string | null
  atividade: string | null
  colaborador: string | null
  alertaRiscos: string | null
  pedidoAjuda: string | null
  wins: WinLido[]
}

function texto(celulas: Record<string, string>, ref: string): string | null {
  const valor = celulas[ref]
  if (typeof valor !== 'string') return null
  const limpo = valor.trim()
  return limpo === '' ? null : limpo
}

function numero(celulas: Record<string, string>, ref: string): number | null {
  const valor = texto(celulas, ref)
  if (valor === null) return null
  const n = Number(valor)
  return Number.isFinite(n) ? n : null
}

export function lerAba({ nome, celulas }: AbaSemana): CardLido | null {
  const semana = numero(celulas, 'AD4')
  if (semana === null) return null

  const wins: WinLido[] = []
  LINHAS_WIN_ATUAL.forEach((linha, indice) => {
    const descricao = texto(celulas, `H${linha}`)
    if (descricao === null) return
    wins.push({
      ordem: indice + 1,
      descricao,
      suporte: texto(celulas, `Z${linha}`),
      prazoSerial: numero(celulas, `AB${linha}`),
      statusBruto: texto(celulas, `AD${linha}`),
    })
  })

  return {
    aba: nome,
    semana,
    area: texto(celulas, 'H6'),
    atividade: texto(celulas, 'R6'),
    colaborador: texto(celulas, 'AB6'),
    // No arquivo, a linha 25 guarda os dois campos em colunas diferentes.
    alertaRiscos: texto(celulas, 'D25'),
    pedidoAjuda: texto(celulas, 'R25'),
    wins,
  }
}

/** Mapa do texto da planilha para o enum do sistema. Vazio vira PENDENTE. */
export const STATUS_DA_PLANILHA: Record<string, string> = {
  'FEITO': 'FEITO',
  'NÃO FEITO': 'NAO_FEITO',
  'NAO FEITO': 'NAO_FEITO',
  'EM ANDAMENTO': 'EM_ANDAMENTO',
}

export function traduzirStatus(bruto: string | null): string {
  if (bruto === null) return 'PENDENTE'
  const chave = bruto.trim().toUpperCase()
  return STATUS_DA_PLANILHA[chave] ?? 'PENDENTE'
}

/**
 * Chave de comparação usada **só na importação**: minúsculas, sem acento, sem
 * pontuação, colapsando espaços e cortando no começo significativo. É
 * deliberadamente tolerante — os três textos do mesmo WIN na planilha só
 * coincidem assim.
 */
export function chaveDeComparacao(descricao: string): string {
  return descricao
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 45)
}

/**
 * Quantas semanas ANTERIORES à semana alvo continham um WIN parecido.
 *
 * É o número que vai para `Win.aparicoesAnteriores`. Sem ele, o WIN que já
 * vinha de três semanas recomeçaria do zero no sistema e escaparia da
 * promoção justamente no momento em que ela é devida.
 */
export function contarAparicoesAnteriores(
  descricao: string,
  cards: readonly CardLido[],
  semanaAlvo: number,
): number {
  const chave = chaveDeComparacao(descricao)
  const semanasComOWin = new Set<number>()

  for (const card of cards) {
    if (card.semana >= semanaAlvo) continue
    if (card.wins.some((win) => chaveDeComparacao(win.descricao) === chave)) {
      semanasComOWin.add(card.semana)
    }
  }
  return semanasComOWin.size
}

export type ResumoImportacao = {
  colaborador: string | null
  semana: number
  wins: {
    ordem: number
    descricao: string
    suporte: string | null
    status: string
    aparicoesAnteriores: number
    /** Total considerando esta semana — é o que dispara a regra das 3. */
    aparicoesTotais: number
  }[]
}

/** Monta o que será gravado para a semana alvo, já com o contador semeado. */
export function prepararImportacao(
  cards: readonly CardLido[],
  semanaAlvo: number,
): ResumoImportacao | null {
  const card = cards.find((c) => c.semana === semanaAlvo)
  if (!card) return null

  return {
    colaborador: card.colaborador,
    semana: card.semana,
    wins: card.wins.map((win) => {
      const anteriores = contarAparicoesAnteriores(win.descricao, cards, semanaAlvo)
      return {
        ordem: win.ordem,
        descricao: win.descricao,
        suporte: win.suporte,
        status: traduzirStatus(win.statusBruto),
        aparicoesAnteriores: anteriores,
        aparicoesTotais: anteriores + 1,
      }
    }),
  }
}
