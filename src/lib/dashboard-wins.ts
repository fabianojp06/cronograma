/**
 * Relatórios do Card WIN — módulo puro, sem Prisma e sem Next.
 *
 * Duas perguntas que a planilha não respondia, porque cada semana era uma aba
 * separada e ninguém somava a série: "quantos WINs de cada semana foram
 * concluídos?" e "que assuntos ficam voltando?".
 */

import {
  chaveSemana,
  rotuloSemana,
  semanaAnterior,
  type SemanaCtcea,
} from './semana-ctcea'
import { situacaoDoWin, type SituacaoWin } from './win-promocao'

export type StatusRegistro = 'PENDENTE' | 'EM_ANDAMENTO' | 'FEITO' | 'NAO_FEITO'
export type DesfechoRegistro = 'NO_CARD' | 'PROMOVIDO' | 'ENCERRADO'

export type RegistroSemanal = {
  ano: number
  semana: number
  status: StatusRegistro
  desfecho: DesfechoRegistro
}

/** Por que a taxa não pôde ser calculada — as duas causas leem muito diferente. */
export type MotivoSemTaxa = 'SEM_WINS' | 'TODOS_PROMOVIDOS'

export type ConclusaoSemanal = {
  semana: SemanaCtcea
  rotulo: string
  total: number
  feitos: number
  naoFeitos: number
  emAndamento: number
  pendentes: number
  promovidos: number
  taxa: number | null
  motivoSemTaxa: MotivoSemTaxa | null
  emCurso: boolean
}

/**
 * As `quantas` semanas até `ate`, inclusive, da mais antiga para a mais nova.
 *
 * Usa `semanaAnterior` em vez de `semana - 1` porque a virada de ano não é
 * aritmética: a semana 1 de 2026 começa em 28/12/2025, e 2026 tem 52 semanas
 * enquanto outros anos têm 53.
 */
export function janelaDeSemanas(ate: SemanaCtcea, quantas: number): SemanaCtcea[] {
  const janela: SemanaCtcea[] = []
  let atual = ate
  for (let i = 0; i < Math.max(0, quantas); i += 1) {
    janela.unshift(atual)
    atual = semanaAnterior(atual)
  }
  return janela
}

/**
 * Conclusão por semana, sobre uma janela densa.
 *
 * **Densa de propósito**: semanas sem nenhum WIN entram com `total = 0`. Pular
 * comprimiria o eixo e faria um buraco de três semanas parecer contínuo.
 *
 * **Promovido fica fora da taxa.** Promover não é concluir nem falhar — o
 * trabalho mudou de lugar, e é o método funcionando. Contá-lo no denominador
 * puniria justamente a semana em que a regra das 3 semanas fez seu papel.
 *
 * **`motivoSemTaxa` distingue as duas causas de taxa nula.** Semana de recesso
 * e semana em que tudo foi promovido renderizariam igual sem esse campo, e a
 * melhor semana do funil pareceria a mais vazia.
 */
export function taxaDeConclusao(
  registros: readonly RegistroSemanal[],
  janela: readonly SemanaCtcea[],
  semanaAtual: SemanaCtcea,
): ConclusaoSemanal[] {
  const porSemana = new Map<string, RegistroSemanal[]>()
  for (const registro of registros) {
    const chave = chaveSemana({ ano: registro.ano, semana: registro.semana })
    const lista = porSemana.get(chave)
    if (lista) lista.push(registro)
    else porSemana.set(chave, [registro])
  }

  const chaveAtual = chaveSemana(semanaAtual)

  return janela.map((semana) => {
    const doPeriodo = porSemana.get(chaveSemana(semana)) ?? []
    const promovidos = doPeriodo.filter((r) => r.desfecho === 'PROMOVIDO').length

    // Os baldes de status só valem para o que NÃO foi promovido: uma linha
    // promovida já é sua própria categoria, e contá-la também pelo status —
    // que continua sendo o que era quando saiu — a somaria duas vezes.
    const contaveis = doPeriodo.filter((r) => r.desfecho !== 'PROMOVIDO')
    const conta = (status: StatusRegistro) =>
      contaveis.filter((r) => r.status === status).length

    const feitos = conta('FEITO')
    const denominador = contaveis.length

    let taxa: number | null = null
    let motivoSemTaxa: MotivoSemTaxa | null = null
    if (denominador > 0) {
      taxa = feitos / denominador
    } else {
      motivoSemTaxa = promovidos > 0 ? 'TODOS_PROMOVIDOS' : 'SEM_WINS'
    }

    return {
      semana,
      rotulo: rotuloSemana(semana),
      total: doPeriodo.length,
      feitos,
      naoFeitos: conta('NAO_FEITO'),
      emAndamento: conta('EM_ANDAMENTO'),
      pendentes: conta('PENDENTE'),
      promovidos,
      taxa,
      motivoSemTaxa,
      emCurso: chaveSemana(semana) === chaveAtual,
    }
  })
}

export type WinParaRecorrencia = {
  winId: string
  descricao: string
  colaborador: string
  aparicoesAnteriores: number
  promovidoEm: Date | null
  encerradoEm: Date | null
  projetoId: string | null
  aparicoes: { ano: number; semana: number }[]
}

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

const ordinal = ({ ano, semana }: SemanaCtcea) => ano * 100 + semana

/**
 * Os WINs que se repetem — o relatório que expõe o que a planilha esconde.
 *
 * A regra das 3 semanas só avisa quando já estourou, e só na tela de uma
 * pessoa. Aqui dá para ver quem está chegando perto e o que já foi promovido.
 *
 * **Soma `aparicoesAnteriores`**: contar só as linhas subcontaria exatamente os
 * WINs importados que já vinham se repetindo — eles cairiam abaixo do corte e
 * sumiriam do relatório que existe para achá-los.
 *
 * **Inclui promovidos e encerrados.** O promovido é o caso de sucesso da regra;
 * escondê-lo deixaria só os problemas em aberto e ninguém veria o funil
 * funcionando.
 */
export function winsReincidentes(
  wins: readonly WinParaRecorrencia[],
  minimoAparicoes = 2,
  /**
   * Recorte por período: só conta as aparições nas semanas aceitas. As
   * `aparicoesAnteriores` ficam de fora, porque vêm de antes do sistema e não
   * têm semana para serem situadas. A `situacao` continua sendo a do WIN
   * inteiro — ela descreve o WIN, não o período.
   */
  naSemana?: (semana: SemanaCtcea) => boolean,
): WinRecorrente[] {
  return wins
    .map((win) => {
      const todas = [...win.aparicoes].sort((a, b) => ordinal(a) - ordinal(b))
      const totalDoWin = Math.max(0, win.aparicoesAnteriores) + todas.length
      const ordenadas = naSemana ? todas.filter(naSemana) : todas
      const aparicoes = naSemana ? ordenadas.length : totalDoWin
      return {
        winId: win.winId,
        descricao: win.descricao,
        colaborador: win.colaborador,
        aparicoes,
        // `null` quando o WIN só tem aparições anteriores ao sistema: a tela
        // mostra "antes do sistema" em vez de inventar uma data.
        primeiraSemana: ordenadas[0] ?? null,
        ultimaSemana: ordenadas[ordenadas.length - 1] ?? null,
        situacao: situacaoDoWin({
          aparicoesAnteriores: 0,
          registros: totalDoWin,
          promovidoEm: win.promovidoEm,
          encerradoEm: win.encerradoEm,
        }),
        projetoId: win.projetoId,
      }
    })
    .filter((w) => w.aparicoes >= minimoAparicoes)
    .sort(
      (a, b) =>
        b.aparicoes - a.aparicoes ||
        // Três níveis: os dois primeiros empatam muito, e ordem instável faz a
        // tabela dançar entre recargas.
        (b.ultimaSemana ? ordinal(b.ultimaSemana) : 0) -
          (a.ultimaSemana ? ordinal(a.ultimaSemana) : 0) ||
        a.descricao.localeCompare(b.descricao, 'pt-BR'),
    )
}
