/**
 * Resumo semanal para quem administra — módulo puro.
 *
 * Uma foto por semana: o que foi CONCLUÍDO nos últimos 7 dias, o que está
 * ATRASADO e o que VENCE nos próximos 7 dias, por equipe. Usa as mesmas regras
 * do painel (`acaoEstaAtrasada`), para o resumo e a tela nunca discordarem.
 *
 * A semana vai da segunda-feira, 8h de Brasília (UTC-3, sem horário de verão),
 * até a segunda seguinte. Antes das 8h da segunda, a semana "disponível" ainda
 * é a anterior.
 */

import { acaoEstaAtrasada } from './projeto-resumo'
import { StatusAcao } from '../generated/prisma/enums'

export const DIA_MS = 86_400_000
const BRASILIA_MS = 3 * 3_600_000
export const HORA_DO_RESUMO = 8
export const JANELA_DIAS = 7
export const MAXIMO_ITENS_POR_BLOCO = 10
export const SEM_EQUIPE = 'Sem equipe'

const iso = (d: Date) => d.toISOString().slice(0, 10)

/** Data (meia-noite UTC) do dia corrente em Brasília. */
export function hojeEmBrasilia(agora: Date): Date {
  const br = new Date(agora.getTime() - BRASILIA_MS)
  return new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate()))
}

/**
 * A semana cujo resumo está disponível agora: a data (aaaa-mm-dd) da segunda-feira
 * mais recente cujas 8h de Brasília já passaram.
 */
export function semanaDisponivel(agora: Date): string {
  const br = new Date(agora.getTime() - BRASILIA_MS)
  const hoje = Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate())
  const desdeSegunda = (br.getUTCDay() + 6) % 7 // segunda = 0
  let segunda = hoje - desdeSegunda * DIA_MS
  if (desdeSegunda === 0 && br.getUTCHours() < HORA_DO_RESUMO) segunda -= 7 * DIA_MS
  return iso(new Date(segunda))
}

export type AcaoParaResumo = {
  id: string
  projetoId: string
  projetoNome: string
  equipe: string | null
  numero: number
  descricao: string
  responsavel: string | null
  status: StatusAcao
  previstoTermino: Date | null
  realizadoTermino: Date | null
  /**
   * Quando foi concluída, para a ação concluída SEM data de término realizada
   * (só o status): o dia da última mudança de status para "Concluído", no
   * histórico. O término realizado, quando existe, vale mais.
   */
  concluidoEm?: Date | null
}

export type ItemResumo = {
  acaoId: string
  projetoId: string
  projetoNome: string
  numero: number
  descricao: string
  responsavel: string | null
  /** aaaa-mm-dd: o término realizado (concluídas) ou previsto (demais). */
  data: string
  /** Dias de atraso, só nas atrasadas. */
  diasAtraso?: number
}

export type BlocoResumo = { total: number; itens: ItemResumo[] }

export type EquipeResumo = {
  equipe: string
  concluidas: BlocoResumo
  atrasadas: BlocoResumo
  vencendo: BlocoResumo
}

export type ConteudoResumo = {
  /** Segunda-feira da semana, aaaa-mm-dd. */
  semana: string
  /** O dia de referência (hoje, em Brasília) e a janela de 7 dias para cada lado. */
  referencia: string
  de: string
  ate: string
  totais: { concluidas: number; atrasadas: number; vencendo: number }
  equipes: EquipeResumo[]
}

function item(a: AcaoParaResumo, data: Date, hoje: Date, comAtraso: boolean): ItemResumo {
  return {
    acaoId: a.id,
    projetoId: a.projetoId,
    projetoNome: a.projetoNome,
    numero: a.numero,
    descricao: a.descricao,
    responsavel: a.responsavel,
    data: iso(data),
    ...(comAtraso ? { diasAtraso: Math.round((hoje.getTime() - data.getTime()) / DIA_MS) } : {}),
  }
}

export type ClasseDaAcao = { tipo: 'concluidas' | 'atrasadas' | 'vencendo'; data: Date }

/**
 * Em qual bloco a ação entra, e com que data (a do término realizado, ou do
 * previsto). Concluída: término realizado nos 7 dias até hoje (ou, sem ele, o
 * dia da última conclusão no histórico). Atrasada: a regra do painel. Vence:
 * término previsto de hoje a hoje+7. Fora disso, `null`. É a regra única que o
 * resumo semanal e a apresentação para reunião compartilham.
 */
export function classificarAcao(a: AcaoParaResumo, hoje: Date): ClasseDaAcao | null {
  const inicioJanela = new Date(hoje.getTime() - JANELA_DIAS * DIA_MS)
  const fimJanela = new Date(hoje.getTime() + JANELA_DIAS * DIA_MS)
  if (a.status === StatusAcao.CONCLUIDO || a.realizadoTermino !== null) {
    const fim = a.realizadoTermino ?? a.concluidoEm ?? null
    return fim && fim >= inicioJanela && fim <= hoje ? { tipo: 'concluidas', data: fim } : null
  }
  if (a.previstoTermino === null) return null
  if (acaoEstaAtrasada(a, hoje)) return { tipo: 'atrasadas', data: a.previstoTermino }
  if (a.previstoTermino >= hoje && a.previstoTermino <= fimJanela) {
    return { tipo: 'vencendo', data: a.previstoTermino }
  }
  return null
}

/**
 * Monta o resumo. `hoje` é a data de referência (meia-noite UTC). Concluídas:
 * término realizado nos 7 dias até hoje. Atrasadas: a regra do painel. Vencem:
 * término previsto de hoje a hoje+7, sem concluir. Cada bloco guarda o TOTAL e
 * só os 10 mais relevantes: concluídas, as mais recentes; atrasadas, as mais
 * antigas; vencem, as mais próximas. Equipe sem nada não entra.
 */
export function montarResumo(
  acoes: readonly AcaoParaResumo[],
  hoje: Date,
  semana: string,
): ConteudoResumo {
  const inicioJanela = new Date(hoje.getTime() - JANELA_DIAS * DIA_MS)
  const fimJanela = new Date(hoje.getTime() + JANELA_DIAS * DIA_MS)

  const porEquipe = new Map<string, { concluidas: { a: AcaoParaResumo; d: Date }[]; atrasadas: { a: AcaoParaResumo; d: Date }[]; vencendo: { a: AcaoParaResumo; d: Date }[] }>()
  const equipeDe = (a: AcaoParaResumo) => a.equipe?.trim() || SEM_EQUIPE
  const grupo = (a: AcaoParaResumo) => {
    const chave = equipeDe(a)
    if (!porEquipe.has(chave)) porEquipe.set(chave, { concluidas: [], atrasadas: [], vencendo: [] })
    return porEquipe.get(chave)!
  }

  for (const a of acoes) {
    const c = classificarAcao(a, hoje)
    if (c) grupo(a)[c.tipo].push({ a, d: c.data })
  }

  const topo = (
    linhas: { a: AcaoParaResumo; d: Date }[],
    ordem: 'recentes' | 'antigas' | 'proximas',
    comAtraso: boolean,
  ): BlocoResumo => {
    const ordenadas = [...linhas].sort((x, y) =>
      ordem === 'recentes' ? y.d.getTime() - x.d.getTime() : x.d.getTime() - y.d.getTime(),
    )
    return {
      total: linhas.length,
      itens: ordenadas.slice(0, MAXIMO_ITENS_POR_BLOCO).map(({ a, d }) => item(a, d, hoje, comAtraso)),
    }
  }

  const equipes: EquipeResumo[] = [...porEquipe.entries()]
    .map(([equipe, g]) => ({
      equipe,
      concluidas: topo(g.concluidas, 'recentes', false),
      atrasadas: topo(g.atrasadas, 'antigas', true),
      vencendo: topo(g.vencendo, 'proximas', false),
    }))
    .sort((a, b) => {
      // Quem tem mais atraso primeiro; "Sem equipe" por último nos empates.
      if (b.atrasadas.total !== a.atrasadas.total) return b.atrasadas.total - a.atrasadas.total
      if (a.equipe === SEM_EQUIPE) return 1
      if (b.equipe === SEM_EQUIPE) return -1
      return a.equipe.localeCompare(b.equipe, 'pt-BR')
    })

  return {
    semana,
    referencia: iso(hoje),
    de: iso(inicioJanela),
    ate: iso(fimJanela),
    totais: {
      concluidas: equipes.reduce((s, e) => s + e.concluidas.total, 0),
      atrasadas: equipes.reduce((s, e) => s + e.atrasadas.total, 0),
      vencendo: equipes.reduce((s, e) => s + e.vencendo.total, 0),
    },
    equipes,
  }
}

/** O resumo não tem nada a dizer (nenhuma conclusão, atraso nem vencimento). */
export function resumoVazio(c: Pick<ConteudoResumo, 'totais'>): boolean {
  return c.totais.concluidas + c.totais.atrasadas + c.totais.vencendo === 0
}

const dm = (isoData: string) => `${isoData.slice(8, 10)}/${isoData.slice(5, 7)}`

/** "Semana de 16/11 a 22/11", a partir da segunda-feira. */
export function rotuloDaSemana(semana: string): string {
  const fim = new Date(Date.parse(`${semana}T00:00:00Z`) + 6 * DIA_MS)
  return `Semana de ${dm(semana)} a ${dm(iso(fim))}`
}

/** Uma frase para o aviso da lista de notificações. */
export function frasePrincipal(c: Pick<ConteudoResumo, 'totais'>): string {
  if (resumoVazio(c)) return 'Semana sem conclusões, atrasos nem vencimentos.'
  const { concluidas, atrasadas, vencendo } = c.totais
  const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
  return `${plural(atrasadas, 'atrasada', 'atrasadas')} · ${plural(vencendo, 'vence', 'vencem')} em 7 dias · ${plural(concluidas, 'concluída', 'concluídas')}`
}

/** Lê o JSON gravado, com uma guarda mínima (foto antiga ou corrompida vira null). */
export function lerConteudo(valor: unknown): ConteudoResumo | null {
  if (typeof valor !== 'object' || valor === null) return null
  const c = valor as Partial<ConteudoResumo>
  if (typeof c.semana !== 'string' || !Array.isArray(c.equipes) || !c.totais) return null
  return c as ConteudoResumo
}
