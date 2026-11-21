/**
 * Relatórios de GESTÃO dos Dashboards — módulo puro (sem Prisma e sem Next).
 *
 * Cruzam duas ou mais fontes que os relatórios antigos olhavam separadas:
 * ações × equipe × atraso, projetos × status, riscos × impacto, priorização ×
 * atraso, conclusões × criações por semana e replanejamentos × motivo. A regra
 * de atraso é a do painel (`acaoEstaAtrasada`); a da equipe vem do projeto.
 */

import { StatusAcao } from '../generated/prisma/enums'
import { resumirAderencia, type AcaoComPrazo } from './dashboard-prazos'
import { acaoEstaAtrasada, type StatusAgregado } from './projeto-resumo'
import { nomeDoMotivo } from './motivo-replanejamento'
import { quadranteDe } from './matriz-calculo'
import type { Quadrante } from './matriz-criterios'
import { DIA_MS, SEM_EQUIPE } from './resumo-semanal'

export const nomeDaEquipe = (equipe: string | null | undefined): string => equipe?.trim() || SEM_EQUIPE

const ordemDasEquipes = (a: string, b: string) =>
  a === SEM_EQUIPE ? 1 : b === SEM_EQUIPE ? -1 : a.localeCompare(b, 'pt-BR')

// ───────────────────────── Semáforo por equipe ─────────────────────────

/**
 * Os limites do semáforo moram AQUI, num lugar só. Vermelho: mais de 20% das
 * ações abertas atrasadas, ou risco de impacto alto com prazo vencido. Amarelo:
 * de 5% a 20%, ou risco de impacto alto aberto. Verde: abaixo disso.
 */
export const LIMITE_VERMELHO = 0.2
export const LIMITE_AMARELO = 0.05
/** Janela dos replanejamentos mostrados no cartão (informativo; não muda a cor). */
export const JANELA_REPLANEJAMENTO_DIAS = 30

export type CorSemaforo = 'VERMELHO' | 'AMARELO' | 'VERDE' | 'SEM_DADOS'

export const ROTULO_SEMAFORO: Record<CorSemaforo, string> = {
  VERMELHO: 'Crítica',
  AMARELO: 'Atenção',
  VERDE: 'Em dia',
  SEM_DADOS: 'Sem ações abertas',
}

export type RiscoParaGestao = {
  projetoId: string
  equipe: string | null
  impacto: string
  tipo: string
  /** Só os ABERTOS (aberto ou em tratamento). */
  prazo: Date | null
}

export type CartaoSemaforo = {
  equipe: string
  cor: CorSemaforo
  acoes: number
  abertas: number
  atrasadas: number
  /** Atrasadas sobre abertas (0 a 1). */
  proporcaoAtraso: number
  /** Concluídas no prazo sobre as concluídas com prazo (0 a 100), `null` sem base. */
  aderenciaPercentual: number | null
  riscosAbertos: number
  riscosAltosVencidos: number
  riscosAltosAbertos: number
  /** Mudanças de data prevista nos últimos 30 dias (eventos). */
  replanejamentos: number
  /** Por que a cor é essa, em frases curtas. */
  motivos: string[]
}

const acaoAberta = (a: Pick<AcaoComPrazo, 'status' | 'realizadoTermino'>) =>
  a.status !== StatusAcao.CONCLUIDO && a.realizadoTermino === null

const riscoAltoVencido = (r: RiscoParaGestao, hoje: Date) =>
  r.impacto === 'ALTO' && r.prazo !== null && r.prazo.getTime() < hoje.getTime()

export function corDoSemaforo(c: {
  abertas: number
  riscosAbertos: number
  proporcaoAtraso: number
  riscosAltosVencidos: number
  riscosAltosAbertos: number
}): CorSemaforo {
  if (c.abertas === 0 && c.riscosAbertos === 0) return 'SEM_DADOS'
  if (c.proporcaoAtraso > LIMITE_VERMELHO || c.riscosAltosVencidos > 0) return 'VERMELHO'
  if (c.proporcaoAtraso >= LIMITE_AMARELO || c.riscosAltosAbertos > 0) return 'AMARELO'
  return 'VERDE'
}

const percentual = (p: number) => `${Math.round(p * 100)}%`

export function semaforoPorEquipe(entrada: {
  acoes: readonly AcaoComPrazo[]
  riscos: readonly RiscoParaGestao[]
  /** Um item por EVENTO de replanejamento dos últimos 30 dias, com a equipe do projeto. */
  replanejamentos: readonly { equipe: string | null }[]
  hoje: Date
}): CartaoSemaforo[] {
  const { hoje } = entrada
  const equipes = new Set<string>()
  entrada.acoes.forEach((a) => equipes.add(nomeDaEquipe(a.equipe)))
  entrada.riscos.forEach((r) => equipes.add(nomeDaEquipe(r.equipe)))

  const cartoes = [...equipes].map((equipe) => {
    const acoes = entrada.acoes.filter((a) => nomeDaEquipe(a.equipe) === equipe)
    const riscos = entrada.riscos.filter((r) => nomeDaEquipe(r.equipe) === equipe)
    const abertas = acoes.filter(acaoAberta).length
    const atrasadas = acoes.filter((a) => acaoEstaAtrasada(a, hoje)).length
    const proporcaoAtraso = abertas === 0 ? 0 : atrasadas / abertas
    const aderencia = resumirAderencia(acoes)
    const riscosAltosVencidos = riscos.filter((r) => riscoAltoVencido(r, hoje)).length
    const riscosAltosAbertos = riscos.filter((r) => r.impacto === 'ALTO').length
    const replanejamentos = entrada.replanejamentos.filter((r) => nomeDaEquipe(r.equipe) === equipe).length

    const base = {
      abertas,
      riscosAbertos: riscos.length,
      proporcaoAtraso,
      riscosAltosVencidos,
      riscosAltosAbertos,
    }
    const cor = corDoSemaforo(base)

    const motivos: string[] = []
    if (abertas > 0 && atrasadas > 0) {
      motivos.push(`${percentual(proporcaoAtraso)} das ações abertas estão atrasadas (${atrasadas} de ${abertas})`)
    }
    if (riscosAltosVencidos > 0) {
      motivos.push(`${riscosAltosVencidos} ${riscosAltosVencidos === 1 ? 'risco de impacto alto com prazo vencido' : 'riscos de impacto alto com prazo vencido'}`)
    } else if (riscosAltosAbertos > 0) {
      motivos.push(`${riscosAltosAbertos} ${riscosAltosAbertos === 1 ? 'risco de impacto alto aberto' : 'riscos de impacto alto abertos'}`)
    }
    if (motivos.length === 0 && cor === 'VERDE') motivos.push('nenhum atraso relevante nem risco alto')

    return {
      equipe,
      cor,
      acoes: acoes.length,
      abertas,
      atrasadas,
      proporcaoAtraso,
      aderenciaPercentual: aderencia.avaliaveis === 0 ? null : aderencia.percentualNoPrazo,
      riscosAbertos: riscos.length,
      riscosAltosVencidos,
      riscosAltosAbertos,
      replanejamentos,
      motivos,
    }
  })

  const PESO: Record<CorSemaforo, number> = { VERMELHO: 0, AMARELO: 1, VERDE: 2, SEM_DADOS: 3 }
  return cartoes.sort(
    (a, b) =>
      PESO[a.cor] - PESO[b.cor] ||
      b.proporcaoAtraso - a.proporcaoAtraso ||
      ordemDasEquipes(a.equipe, b.equipe),
  )
}

// ───────────────────────── Mapa de calor Equipe × Status ─────────────────────────

export type MatrizDeCalor = {
  linhas: string[]
  colunas: { id: string; rotulo: string }[]
  /** `valores[linha][coluna]`. */
  valores: number[][]
  totaisDasLinhas: number[]
  maximo: number
}

/** A ordem fixa de status do CLAUDE.md (a mesma da pilha de composição). */
export const ORDEM_STATUS_MAPA: readonly StatusAgregado[] = [
  'SEM_ACOES',
  'CONCLUIDO',
  'EM_ANDAMENTO',
  'NAO_INICIADO',
  'ATRASADO',
]

export function mapaDeCalorEquipeStatus(
  projetos: readonly { equipe: string | null; resumo: { status: StatusAgregado } }[],
  rotuloDoStatus: Record<StatusAgregado, string>,
): MatrizDeCalor {
  const equipes = [...new Set(projetos.map((p) => nomeDaEquipe(p.equipe)))].sort(ordemDasEquipes)
  const colunas = ORDEM_STATUS_MAPA.map((s) => ({ id: s, rotulo: rotuloDoStatus[s] }))
  const valores = equipes.map((equipe) =>
    ORDEM_STATUS_MAPA.map(
      (status) => projetos.filter((p) => nomeDaEquipe(p.equipe) === equipe && p.resumo.status === status).length,
    ),
  )
  return {
    linhas: equipes,
    colunas,
    valores,
    totaisDasLinhas: valores.map((linha) => linha.reduce((s, v) => s + v, 0)),
    maximo: Math.max(0, ...valores.flat()),
  }
}

// ───────────────────────── Idade do atraso ─────────────────────────

export const FAIXAS_DE_ATRASO = [
  { id: 'ate7', rotulo: 'Até 7 dias', min: 1, max: 7 },
  { id: 'de8a30', rotulo: '8 a 30 dias', min: 8, max: 30 },
  { id: 'de31a90', rotulo: '31 a 90 dias', min: 31, max: 90 },
  { id: 'mais90', rotulo: 'Mais de 90 dias', min: 91, max: Infinity },
] as const

export type LinhaIdadeDoAtraso = { equipe: string; total: number; faixas: number[] }

/** Atrasadas por equipe, nas faixas de dias CORRIDOS de atraso (1 dia ou mais). */
export function idadeDoAtraso(acoes: readonly AcaoComPrazo[], hoje: Date): LinhaIdadeDoAtraso[] {
  const porEquipe = new Map<string, number[]>()
  for (const a of acoes) {
    if (!acaoEstaAtrasada(a, hoje)) continue
    const dias = Math.round((hoje.getTime() - a.previstoTermino!.getTime()) / DIA_MS)
    const indice = FAIXAS_DE_ATRASO.findIndex((f) => dias >= f.min && dias <= f.max)
    if (indice < 0) continue
    const equipe = nomeDaEquipe(a.equipe)
    const faixas = porEquipe.get(equipe) ?? FAIXAS_DE_ATRASO.map(() => 0)
    faixas[indice] += 1
    porEquipe.set(equipe, faixas)
  }
  return [...porEquipe.entries()]
    .map(([equipe, faixas]) => ({ equipe, total: faixas.reduce((s, v) => s + v, 0), faixas }))
    .sort((a, b) => b.total - a.total || ordemDasEquipes(a.equipe, b.equipe))
}

// ───────────────────────── Riscos por equipe e impacto ─────────────────────────

export const IMPACTOS_ORDEM = ['ALTO', 'MEDIO', 'BAIXO'] as const

export type LinhaRiscosPorEquipe = {
  equipe: string
  total: number
  /** Na ordem de `IMPACTOS_ORDEM`. */
  porImpacto: number[]
  bloqueios: number
  vencidos: number
}

export function riscosPorEquipe(riscos: readonly RiscoParaGestao[], hoje: Date): LinhaRiscosPorEquipe[] {
  const mapa = new Map<string, LinhaRiscosPorEquipe>()
  for (const r of riscos) {
    const equipe = nomeDaEquipe(r.equipe)
    const linha = mapa.get(equipe) ?? { equipe, total: 0, porImpacto: IMPACTOS_ORDEM.map(() => 0), bloqueios: 0, vencidos: 0 }
    const i = (IMPACTOS_ORDEM as readonly string[]).indexOf(r.impacto)
    if (i >= 0) linha.porImpacto[i] += 1
    linha.total += 1
    if (r.tipo === 'BLOQUEIO') linha.bloqueios += 1
    if (r.prazo !== null && r.prazo.getTime() < hoje.getTime()) linha.vencidos += 1
    mapa.set(equipe, linha)
  }
  return [...mapa.values()].sort(
    (a, b) => b.porImpacto[0] - a.porImpacto[0] || b.total - a.total || ordemDasEquipes(a.equipe, b.equipe),
  )
}

// ───────────────────────── Prioridade × atraso ─────────────────────────

export type PontoPrioridadeAtraso = {
  projetoId: string
  nome: string
  equipe: string
  beneficio: number
  esforco: number
  quadrante: Quadrante
  atrasadas: number
  abertas: number
  /** Alto benefício (quick win ou estratégico) com ação atrasada: o atraso que mais custa. */
  critico: boolean
}

export function prioridadeXAtraso(
  projetos: readonly {
    id: string
    nome: string
    equipe: string | null
    resultado: { beneficio: number; esforco: number } | null
    acoes: readonly AcaoComPrazo[]
  }[],
  hoje: Date,
): PontoPrioridadeAtraso[] {
  return projetos
    .filter((p) => p.resultado !== null)
    .map((p) => {
      const { beneficio, esforco } = p.resultado!
      const quadrante = quadranteDe(beneficio, esforco)
      const atrasadas = p.acoes.filter((a) => acaoEstaAtrasada(a, hoje)).length
      return {
        projetoId: p.id,
        nome: p.nome,
        equipe: nomeDaEquipe(p.equipe),
        beneficio,
        esforco,
        quadrante,
        atrasadas,
        abertas: p.acoes.filter(acaoAberta).length,
        critico: atrasadas > 0 && (quadrante === 'QUICK_WINS' || quadrante === 'ESTRATEGICOS'),
      }
    })
    .sort((a, b) => Number(b.critico) - Number(a.critico) || b.atrasadas - a.atrasadas || a.nome.localeCompare(b.nome, 'pt-BR'))
}

// ───────────────────────── Ritmo de entrega ─────────────────────────

export const SEMANAS_DO_RITMO = 12
const MEDIA_MOVEL = 4

export type SemanaDoRitmo = {
  /** Domingo da semana (como a semana da CTCEA), aaaa-mm-dd. */
  inicio: string
  concluidas: number
  criadas: number
  /** Média das concluídas nesta e nas 3 semanas anteriores (menos, no começo). */
  mediaMovel: number
}

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** O domingo da semana de `data` (a semana da CTCEA começa no domingo). */
export function domingoDaSemana(data: Date): Date {
  const d = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()))
  return new Date(d.getTime() - d.getUTCDay() * DIA_MS)
}

/**
 * As últimas 12 semanas (a corrente inclusive): ações concluídas (pelo término
 * REALIZADO) contra ações criadas (`createdAt`). Concluir mais do que se cria é
 * o que faz a carteira encolher.
 */
export function ritmoDeEntrega(
  concluidas: readonly Date[],
  criadas: readonly Date[],
  hoje: Date,
  semanas = SEMANAS_DO_RITMO,
): SemanaDoRitmo[] {
  const ultima = domingoDaSemana(hoje).getTime()
  const inicios = Array.from({ length: semanas }, (_, i) => ultima - (semanas - 1 - i) * 7 * DIA_MS)
  const contar = (datas: readonly Date[], inicio: number) =>
    datas.filter((d) => {
      const dia = domingoDaSemana(d).getTime()
      return dia === inicio
    }).length

  const base = inicios.map((inicio) => ({
    inicio: iso(new Date(inicio)),
    concluidas: contar(concluidas, inicio),
    criadas: contar(criadas, inicio),
  }))
  return base.map((s, i) => {
    const janela = base.slice(Math.max(0, i - MEDIA_MOVEL + 1), i + 1)
    return { ...s, mediaMovel: janela.reduce((soma, x) => soma + x.concluidas, 0) / janela.length }
  })
}

// ───────────────────────── Replanejamentos: motivo × equipe ─────────────────────────

export type RegistroDeMotivo = {
  acaoId: string
  campo: string
  valorAntigo: string | null
  alteradoEm: Date
  motivo: string | null
  equipe: string | null
}

export const SEM_MOTIVO = '__sem_motivo__'

/**
 * Eventos de replanejamento (uma mudança de data que já existia; início e
 * término no mesmo instante valem UM) por equipe e motivo. As linhas são os
 * motivos; as colunas, as equipes.
 */
export function motivosPorEquipe(
  registros: readonly RegistroDeMotivo[],
  motivosDaLista: readonly string[],
): MatrizDeCalor {
  const eventos = new Map<string, { equipe: string; motivo: string | null }>()
  for (const r of registros) {
    if (r.campo !== 'previstoInicio' && r.campo !== 'previstoTermino') continue
    if (r.valorAntigo === null) continue
    const chave = `${r.acaoId}|${r.alteradoEm.getTime()}`
    const atual = eventos.get(chave)
    if (!atual || (atual.motivo === null && r.motivo !== null)) {
      eventos.set(chave, { equipe: nomeDaEquipe(r.equipe), motivo: r.motivo })
    }
  }

  const equipes = [...new Set([...eventos.values()].map((e) => e.equipe))].sort(ordemDasEquipes)
  const ids = [...motivosDaLista, SEM_MOTIVO]
  const colunas = equipes.map((e) => ({ id: e, rotulo: e }))
  // Linhas = motivos (só os que aconteceram), colunas = equipes.
  const valores = ids.map((id) =>
    equipes.map((equipe) => [...eventos.values()].filter((e) => e.equipe === equipe && (e.motivo ?? SEM_MOTIVO) === id).length),
  )
  const manter = ids.map((_, i) => valores[i].some((v) => v > 0))
  const linhas = ids.filter((_, i) => manter[i]).map((id) => (id === SEM_MOTIVO ? nomeDoMotivo(null) : nomeDoMotivo(id)))
  const vFinal = valores.filter((_, i) => manter[i])
  return {
    linhas,
    colunas,
    valores: vFinal,
    totaisDasLinhas: vFinal.map((l) => l.reduce((s, v) => s + v, 0)),
    maximo: Math.max(0, ...vFinal.flat()),
  }
}

/** Replanejamentos (eventos) dos últimos N dias por equipe, para o cartão do semáforo. */
export function eventosRecentesPorEquipe(
  registros: readonly RegistroDeMotivo[],
  hoje: Date,
  dias = JANELA_REPLANEJAMENTO_DIAS,
): { equipe: string | null }[] {
  const desde = hoje.getTime() - dias * DIA_MS
  const eventos = new Map<string, { equipe: string | null }>()
  for (const r of registros) {
    if (r.campo !== 'previstoInicio' && r.campo !== 'previstoTermino') continue
    if (r.valorAntigo === null || r.alteradoEm.getTime() < desde) continue
    eventos.set(`${r.acaoId}|${r.alteradoEm.getTime()}`, { equipe: r.equipe })
  }
  return [...eventos.values()]
}
