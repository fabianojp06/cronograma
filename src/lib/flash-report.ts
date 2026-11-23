/**
 * Montagem do Flash Report — módulo puro, sem Prisma, sem Next e sem relógio
 * (`hoje` é parâmetro). Recebe os dados já carregados e devolve tudo o que a
 * tela precisa: farol, avanço, curva S, Gantt de macroetapas, atividades da
 * semana, alertas e pedidos de ajuda.
 *
 * Semana = a semana CTCEA (domingo a sábado). O "fim" da semana é o sábado.
 */

import { avancoEm, type AcaoParaAvanco, type Avanco } from './avanco-fisico'
import { LIMITE_ATENCAO, LIMITE_ATRASADO, sinalDoProjeto, type Farol } from './farol-projeto'
import { classificarAcao } from './resumo-semanal'
import { ordenarPorAtencao, prazoVencido, riscoAberto } from './risco-projeto'
import {
  chaveSemana,
  distanciaEmSemanas,
  ehSemanaValida,
  periodoDaSemana,
  semanaDe,
  semanaSeguinte,
  type PeriodoSemana,
  type SemanaCtcea,
} from './semana-ctcea'

const DIA_MS = 86_400_000
const MAXIMO_ITENS = 4

export type AcaoDoRelatorio = AcaoParaAvanco & {
  id: string
  numero: number
  descricao: string
  macroetapaId: string | null
  realizadoTermino: Date | null
  bloqueada: boolean
  atrasada: boolean
}

export type RiscoDoRelatorio = {
  id: string
  tipo: string
  titulo: string
  impacto: string
  status: string
  prazo: Date | null
  plano: string | null
  responsavel: string | null
  pedeAjuda: boolean
  criadoEm: Date
  acaoNumero: number | null
}

export type EntradaFlash = {
  projeto: { nome: string; cliente: string | null; objetivo: string | null; lider: string | null }
  macroetapas: { id: string; nome: string; ordem: number }[]
  acoes: readonly AcaoDoRelatorio[]
  /** Ações como estavam no fim de cada semana; chave = `chaveSemana`. */
  acoesNoFimDeCada: ReadonlyMap<string, readonly AcaoParaAvanco[]>
  riscos: readonly RiscoDoRelatorio[]
  semana: SemanaCtcea
  hoje: Date
}

export type CelulaMacro = 'REALIZADO' | 'ATENCAO' | 'PLANEJADO' | null
export type LinhaMacro = { nome: string; avanco: Avanco | null; celulas: CelulaMacro[] }
export type PontoCurva = { rotulo: string; previsto: number; realizado: number | null }
export type ItemAtividade = { numero: number; descricao: string; data: Date | null }
export type AlertaRelatorio = {
  tipo: 'MACROETAPA_DESVIO' | 'ACOES_ATRASADAS' | 'RISCOS_VENCIDOS' | 'ACOES_BLOQUEADAS'
  texto: string
}

export type FlashReport = {
  /** Posição da semana escolhida na janela do projeto (1 = primeira); 0 se não há datas. */
  semanaDoProjeto: number
  totalSemanas: number
  periodo: PeriodoSemana
  farol: Farol
  consolidado: Avanco | null
  macroetapas: LinhaMacro[]
  curva: PontoCurva[]
  /** No máximo 4, as mais recentes primeiro. */
  realizadas: ItemAtividade[]
  totalRealizadas: number
  /** No máximo 4, por término previsto. */
  proximas: ItemAtividade[]
  totalProximas: number
  /** Riscos e bloqueios ABERTOS, por ordem de atenção. */
  riscos: RiscoDoRelatorio[]
  alertas: AlertaRelatorio[]
  pedidosDeAjuda: RiscoDoRelatorio[]
  avisos: string[]
}

const umaCasa = (n: number) => Math.round(n * 10) / 10

/** pt-BR, menos de verdade (U+2212), nunca "-0". */
function pontosEscritos(d: number): string {
  const r = umaCasa(d) + 0
  const t = Math.abs(r).toString().replace('.', ',')
  return r < 0 ? `−${t} p.p.` : `${t} p.p.`
}

function plural(n: number, singular: string, pluralTxt: string): string {
  return n === 1 ? singular : pluralTxt
}

function somarSemanas(base: SemanaCtcea, n: number): SemanaCtcea {
  let s = base
  for (let i = 0; i < n; i++) s = semanaSeguinte(s)
  return s
}

function semanaDaData(d: Date): SemanaCtcea {
  return semanaDe(d)
}

/** Menor semana de início e maior de término entre as ações com datas. */
function intervaloDeSemanas(
  acoes: readonly AcaoParaAvanco[],
): { primeira: SemanaCtcea; ultima: SemanaCtcea } | null {
  let menor: Date | null = null
  let maior: Date | null = null
  for (const a of acoes) {
    if (a.previstoInicio && (!menor || a.previstoInicio < menor)) menor = a.previstoInicio
    if (a.previstoTermino && (!maior || a.previstoTermino > maior)) maior = a.previstoTermino
  }
  if (!menor && !maior) return null
  const m = menor ?? maior!
  const M = maior ?? menor!
  const primeira = semanaDaData(m)
  const ultima = semanaDaData(M)
  // Término antes do início (dado ruim): a janela nunca fica invertida.
  return distanciaEmSemanas(primeira, ultima) < 0
    ? { primeira: ultima, ultima: primeira }
    : { primeira, ultima }
}

/**
 * Ordem das regras: (1) valor ausente, malformado ou fora do calendário →
 * semana de `hoje`; (2) semana depois da atual → semana de `hoje`;
 * (3) o resultado é limitado à janela (antes da primeira → primeira, depois da
 * última → última). Janela `null` (projeto sem datas) devolve só o resultado de
 * (1) e (2).
 */
export function normalizarSemana(
  valor: string | undefined,
  janela: { primeira: SemanaCtcea; ultima: SemanaCtcea } | null,
  hoje: Date,
): SemanaCtcea {
  const atual = semanaDe(hoje)
  let escolhida = atual
  const m = valor === undefined ? null : /^(\d{4})-(\d{1,2})$/.exec(valor.trim())
  if (m) {
    const candidata = { ano: Number(m[1]), semana: Number(m[2]) }
    if (ehSemanaValida(candidata) && distanciaEmSemanas(atual, candidata) <= 0) {
      escolhida = candidata
    }
  }
  if (janela === null) return escolhida
  if (distanciaEmSemanas(janela.primeira, escolhida) < 0) return janela.primeira
  if (distanciaEmSemanas(janela.ultima, escolhida) > 0) return janela.ultima
  return escolhida
}

function celulasDaMacro(
  acoes: readonly AcaoParaAvanco[],
  primeira: SemanaCtcea,
  total: number,
  escolhida: number,
  desvioNaSemana: number | null,
): CelulaMacro[] {
  const faixa = intervaloDeSemanas(acoes)
  const de = faixa ? distanciaEmSemanas(primeira, faixa.primeira) : 0
  const ate = faixa ? distanciaEmSemanas(primeira, faixa.ultima) : -1
  return Array.from({ length: total }, (_, i) => {
    if (!faixa || i < de || i > ate) return null
    const posicao = i + 1
    if (posicao > escolhida) return 'PLANEJADO'
    if (posicao === escolhida && desvioNaSemana !== null && desvioNaSemana <= LIMITE_ATENCAO) {
      return 'ATENCAO'
    }
    return 'REALIZADO'
  })
}

export function montarFlashReport(e: EntradaFlash): FlashReport {
  const periodo = periodoDaSemana(e.semana)
  const fim = periodo.fim
  const avisos: string[] = []
  const janela = intervaloDeSemanas(e.acoes)
  const totalSemanas = janela ? distanciaEmSemanas(janela.primeira, janela.ultima) + 1 : 0
  const semanaDoProjeto = janela ? distanciaEmSemanas(janela.primeira, e.semana) + 1 : 0
  const fotoDaSemana = e.acoesNoFimDeCada.get(chaveSemana(e.semana))
  const semanaPassada = fim.getTime() < e.hoje.getTime()

  // Avanço consolidado: previsto das datas atuais; realizado da foto da semana, se houver.
  const atual = avancoEm(e.acoes, fim)
  let consolidado = atual
  if (atual && fotoDaSemana) {
    const foto = avancoEm(fotoDaSemana, fim)
    if (foto) consolidado = { ...atual, realizado: foto.realizado, desvio: umaCasa(foto.realizado - atual.previsto) + 0 }
  }
  if (consolidado === null) {
    avisos.push('Nenhuma ação com datas previstas: não há avanço físico para calcular. Preencha início e término previstos das ações.')
  }

  // Farol: semana passada → no sábado dela (com a foto, se houver); atual → hoje.
  const riscosAbertos = e.riscos.filter((r) => riscoAberto(r.status))
  const farol = sinalDoProjeto(
    semanaPassada
      ? { acoes: fotoDaSemana ?? e.acoes, riscos: riscosAbertos, hoje: fim }
      : { acoes: e.acoes, riscos: riscosAbertos, hoje: e.hoje },
  )

  // Curva S.
  const curva: PontoCurva[] = []
  if (janela) {
    for (let i = 0; i < totalSemanas; i++) {
      const s = somarSemanas(janela.primeira, i)
      const sabado = periodoDaSemana(s).fim
      const previsto = avancoEm(e.acoes, sabado)?.previsto ?? 0
      let realizado: number | null = null
      if (i + 1 <= semanaDoProjeto) {
        const foto = e.acoesNoFimDeCada.get(chaveSemana(s))
        const base = foto ?? (i + 1 === semanaDoProjeto ? e.acoes : null)
        if (base) realizado = avancoEm(base, sabado)?.realizado ?? 0
      }
      curva.push({ rotulo: `S${String(i + 1).padStart(2, '0')}`, previsto, realizado })
    }
  }

  // Macroetapas.
  const ids = new Set(e.macroetapas.map((m) => m.id))
  const grupos: { nome: string; acoes: AcaoDoRelatorio[] }[] = [...e.macroetapas]
    .sort((a, b) => a.ordem - b.ordem)
    .map((m) => ({ nome: m.nome, acoes: e.acoes.filter((a) => a.macroetapaId === m.id) }))
  const soltas = e.acoes.filter((a) => a.macroetapaId === null || !ids.has(a.macroetapaId))
  if (soltas.length > 0) grupos.push({ nome: 'Sem macroetapa', acoes: soltas })
  if (e.macroetapas.length === 0 && e.acoes.length > 0) {
    avisos.push('O projeto não tem macroetapas: cadastre macroetapas para ver o avanço por etapa.')
  }

  const macroetapas: LinhaMacro[] = []
  const alertas: AlertaRelatorio[] = []
  for (const g of grupos) {
    const avanco = avancoEm(g.acoes, fim)
    macroetapas.push({
      nome: g.nome,
      avanco,
      celulas: janela
        ? celulasDaMacro(g.acoes, janela.primeira, totalSemanas, semanaDoProjeto, avanco?.desvio ?? null)
        : [],
    })
    if (avanco && avanco.desvio <= LIMITE_ATRASADO) {
      alertas.push({
        tipo: 'MACROETAPA_DESVIO',
        texto: `${g.nome} com desvio de ${pontosEscritos(avanco.desvio)}`,
      })
    }
  }

  // Demais alertas.
  const atrasadas = e.acoes.filter((a) => a.atrasada)
  if (atrasadas.length > 0) {
    const comData = atrasadas.filter((a) => a.previstoTermino !== null)
    const antiga = [...comData].sort((a, b) => a.previstoTermino!.getTime() - b.previstoTermino!.getTime())[0]
    const n = atrasadas.length
    let texto = `${n} ${plural(n, 'ação atrasada', 'ações atrasadas')}`
    if (antiga) {
      const dias = Math.max(0, Math.round((e.hoje.getTime() - antiga.previstoTermino!.getTime()) / DIA_MS))
      texto += ` (a mais antiga: #${antiga.numero}, há ${dias} ${plural(dias, 'dia', 'dias')})`
    }
    alertas.push({ tipo: 'ACOES_ATRASADAS', texto })
  }
  const vencidos = e.riscos.filter((r) => prazoVencido(r, e.hoje)).length
  if (vencidos > 0) {
    alertas.push({
      tipo: 'RISCOS_VENCIDOS',
      texto: `${vencidos} ${plural(vencidos, 'risco aberto com prazo vencido', 'riscos abertos com prazo vencido')}`,
    })
  }
  const bloqueadas = e.acoes.filter((a) => a.bloqueada).length
  if (bloqueadas > 0) {
    alertas.push({
      tipo: 'ACOES_BLOQUEADAS',
      texto: `${bloqueadas} ${plural(bloqueadas, 'ação bloqueada por dependência', 'ações bloqueadas por dependência')}`,
    })
  }

  // Realizadas: concluídas dentro da semana escolhida (relativo ao sábado dela).
  const concluidas = e.acoes
    .map((a) => ({
      a,
      c: classificarAcao(
        {
          id: a.id, projetoId: '', projetoNome: '', equipe: null, numero: a.numero, descricao: a.descricao,
          responsavel: null, status: a.status, previstoTermino: a.previstoTermino, realizadoTermino: a.realizadoTermino,
        },
        fim,
      ),
    }))
    .filter((x) => x.c?.tipo === 'concluidas' && x.c.data.getTime() >= periodo.inicio.getTime())
    .sort((x, y) => y.c!.data.getTime() - x.c!.data.getTime())
  const realizadas = concluidas
    .slice(0, MAXIMO_ITENS)
    .map(({ a, c }) => ({ numero: a.numero, descricao: a.descricao, data: c!.data }))

  // Próximas: não concluídas cujo previsto cruza a semana seguinte.
  const prox = periodoDaSemana(semanaSeguinte(e.semana))
  const proximasTodas = e.acoes
    .filter((a) => {
      if (a.status === 'CONCLUIDO' || a.realizadoTermino !== null) return false
      const ini = a.previstoInicio ?? a.previstoTermino
      const ter = a.previstoTermino ?? a.previstoInicio
      if (!ini || !ter) return false
      return ini.getTime() <= prox.fim.getTime() && ter.getTime() >= prox.inicio.getTime()
    })
    .sort((x, y) => (x.previstoTermino?.getTime() ?? Infinity) - (y.previstoTermino?.getTime() ?? Infinity))
  const proximas = proximasTodas
    .slice(0, MAXIMO_ITENS)
    .map((a) => ({ numero: a.numero, descricao: a.descricao, data: a.previstoTermino }))

  const riscos = ordenarPorAtencao(riscosAbertos)

  return {
    semanaDoProjeto,
    totalSemanas,
    periodo,
    farol,
    consolidado,
    macroetapas,
    curva,
    realizadas,
    totalRealizadas: concluidas.length,
    proximas,
    totalProximas: proximasTodas.length,
    riscos,
    alertas,
    pedidosDeAjuda: riscos.filter((r) => r.pedeAjuda),
    avisos,
  }
}


export { intervaloDeSemanas as janelaDoProjeto }
