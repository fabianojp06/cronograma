/**
 * Apresentação para reunião (daily) — módulo puro.
 *
 * Transforma os dados de agora numa sequência de telas: panorama, atrasadas,
 * vencem em 7 dias, replanejadas na semana e concluídas. Lista longa vira várias
 * telas ("2/3"), para ninguém rolar a página durante a reunião. A classificação
 * das ações é a do resumo semanal (`classificarAcao`), a mesma do painel.
 */

import { ordenarPorAtencao, prazoVencido } from './risco-projeto'
import {
  DIA_MS,
  SEM_EQUIPE,
  classificarAcao,
  type AcaoParaResumo,
  type ItemResumo,
} from './resumo-semanal'

export const ITENS_POR_TELA = 6
export const JANELA_REPLANEJAMENTO_DIAS = 7

export type RegistroDeData = {
  acaoId: string
  projetoId: string
  projetoNome: string
  equipe: string | null
  numero: number
  descricao: string
  responsavel: string | null
  campo: string
  valorAntigo: string | null
  valorNovo: string | null
  alteradoEm: Date
  /** Nome de quem alterou (já resolvido), ou `null`. */
  alteradoPor: string | null
  motivo?: string | null
  motivoDetalhe?: string | null
}

export type Replanejada = {
  acaoId: string
  projetoId: string
  projetoNome: string
  numero: number
  descricao: string
  responsavel: string | null
  /** O campo mostrado: o término previsto, ou o início se só ele mudou. */
  campo: 'previstoTermino' | 'previstoInicio'
  /** aaaa-mm-dd; `null` = sem data. */
  de: string | null
  para: string | null
  /** Quantas mudanças de data prevista a ação teve na janela. */
  mudancas: number
  por: string | null
  quando: string
  /** Código do motivo da ÚLTIMA mudança, se informado, e o detalhe. */
  motivo: string | null
  motivoDetalhe: string | null
}

/**
 * Uma linha por ação: a data de antes (a primeira mudança da janela) e a de
 * depois (a última), do término previsto — ou do início, se só ele mudou —,
 * com o total de mudanças e quem fez a última. As ações mais mexidas primeiro.
 */
export function agruparReplanejadas(registros: readonly RegistroDeData[]): Replanejada[] {
  const porAcao = new Map<string, RegistroDeData[]>()
  for (const r of registros) {
    if (r.campo !== 'previstoTermino' && r.campo !== 'previstoInicio') continue
    porAcao.set(r.acaoId, [...(porAcao.get(r.acaoId) ?? []), r])
  }

  const linhas: Replanejada[] = []
  for (const lista of porAcao.values()) {
    const campo = lista.some((r) => r.campo === 'previstoTermino') ? 'previstoTermino' : 'previstoInicio'
    const doCampo = lista
      .filter((r) => r.campo === campo)
      .sort((a, b) => a.alteradoEm.getTime() - b.alteradoEm.getTime())
    const primeira = doCampo[0]
    const ultima = doCampo[doCampo.length - 1]
    // Ida e volta (voltou à data original): não é replanejamento visível.
    if (primeira.valorAntigo === ultima.valorNovo) continue
    linhas.push({
      acaoId: primeira.acaoId,
      projetoId: primeira.projetoId,
      projetoNome: primeira.projetoNome,
      numero: primeira.numero,
      descricao: primeira.descricao,
      responsavel: primeira.responsavel,
      campo,
      de: primeira.valorAntigo,
      para: ultima.valorNovo,
      mudancas: lista.length,
      por: ultima.alteradoPor,
      quando: ultima.alteradoEm.toISOString(),
      motivo: ultima.motivo ?? null,
      motivoDetalhe: ultima.motivoDetalhe ?? null,
    })
  }
  return linhas.sort((a, b) => b.mudancas - a.mudancas || b.quando.localeCompare(a.quando))
}

/** Um risco ou bloqueio ABERTO, como o carregador entrega (com datas). */
export type RiscoParaReuniao = {
  id: string
  projetoId: string
  projetoNome: string
  equipe: string | null
  tipo: string
  titulo: string
  impacto: string
  status: string
  responsavel: string | null
  acaoNumero: number | null
  prazo: Date | null
  criadoEm: Date
}

export type RiscoNaTela = {
  id: string
  projetoId: string
  projetoNome: string
  tipo: string
  titulo: string
  impacto: string
  status: string
  responsavel: string | null
  acaoNumero: number | null
  /** aaaa-mm-dd. */
  prazo: string | null
  vencido: boolean
}

export type Panorama = {
  projetosAtivos: number
  riscosAbertos: number
  atrasadas: number
  vencendo: number
  concluidas: number
  replanejadas: number
}

export type Tela =
  | { id: string; tipo: 'panorama'; titulo: string; panorama: Panorama }
  | {
      id: string
      tipo: 'atrasadas' | 'vencendo' | 'concluidas'
      titulo: string
      pagina: number
      paginas: number
      total: number
      itens: ItemResumo[]
    }
  | {
      id: string
      tipo: 'replanejadas'
      titulo: string
      pagina: number
      paginas: number
      total: number
      itens: Replanejada[]
    }
  | {
      id: string
      tipo: 'riscos'
      titulo: string
      pagina: number
      paginas: number
      total: number
      itens: RiscoNaTela[]
    }

const TITULOS = {
  atrasadas: 'Atrasadas',
  vencendo: 'Vencem nos próximos 7 dias',
  concluidas: 'Concluídas na semana',
  replanejadas: 'Replanejadas na semana',
  riscos: 'Riscos e bloqueios abertos',
} as const

function dividir<T>(itens: readonly T[]): T[][] {
  if (itens.length === 0) return [[]]
  const partes: T[][] = []
  for (let i = 0; i < itens.length; i += ITENS_POR_TELA) partes.push(itens.slice(i, i + ITENS_POR_TELA))
  return partes
}

/** Filtra por equipe (`null` = todas); `SEM_EQUIPE` pega os projetos sem equipe. */
export function filtrarPorEquipe<T extends { equipe: string | null }>(itens: readonly T[], equipe: string | null): T[] {
  if (equipe === null) return [...itens]
  return itens.filter((i) => (i.equipe?.trim() || SEM_EQUIPE) === equipe)
}

export function montarTelas(entrada: {
  acoes: readonly AcaoParaResumo[]
  replanejadas: readonly Replanejada[]
  riscos?: readonly RiscoParaReuniao[]
  projetosAtivos: number
  hoje: Date
}): Tela[] {
  const { acoes, replanejadas, hoje } = entrada
  const riscos: RiscoNaTela[] = ordenarPorAtencao(entrada.riscos ?? []).map((r) => ({
    id: r.id,
    projetoId: r.projetoId,
    projetoNome: r.projetoNome,
    tipo: r.tipo,
    titulo: r.titulo,
    impacto: r.impacto,
    status: r.status,
    responsavel: r.responsavel,
    acaoNumero: r.acaoNumero,
    prazo: r.prazo ? r.prazo.toISOString().slice(0, 10) : null,
    vencido: prazoVencido(r, hoje),
  }))

  const por = { atrasadas: [] as ItemResumo[], vencendo: [] as ItemResumo[], concluidas: [] as ItemResumo[] }
  const dia = (d: Date) => d.toISOString().slice(0, 10)
  const classificadas = acoes
    .map((a) => ({ a, c: classificarAcao(a, hoje) }))
    .filter((x): x is { a: AcaoParaResumo; c: NonNullable<ReturnType<typeof classificarAcao>> } => x.c !== null)
  // Atrasadas: as mais antigas primeiro. Vencem: as mais próximas. Concluídas: as mais recentes.
  classificadas.sort((x, y) =>
    x.c.tipo === 'concluidas' ? y.c.data.getTime() - x.c.data.getTime() : x.c.data.getTime() - y.c.data.getTime(),
  )
  for (const { a, c } of classificadas) {
    por[c.tipo].push({
      acaoId: a.id,
      projetoId: a.projetoId,
      projetoNome: a.projetoNome,
      numero: a.numero,
      descricao: a.descricao,
      responsavel: a.responsavel,
      data: dia(c.data),
      ...(c.tipo === 'atrasadas'
        ? { diasAtraso: Math.round((hoje.getTime() - c.data.getTime()) / DIA_MS) }
        : {}),
    })
  }

  const telas: Tela[] = [
    {
      id: 'panorama',
      tipo: 'panorama',
      titulo: 'Panorama',
      panorama: {
        projetosAtivos: entrada.projetosAtivos,
        riscosAbertos: riscos.length,
        atrasadas: por.atrasadas.length,
        vencendo: por.vencendo.length,
        concluidas: por.concluidas.length,
        replanejadas: replanejadas.length,
      },
    },
  ]

  for (const tipo of ['atrasadas', 'vencendo', 'replanejadas', 'riscos', 'concluidas'] as const) {
    const todos = tipo === 'replanejadas' ? replanejadas : tipo === 'riscos' ? riscos : por[tipo]
    const partes = dividir(todos as readonly unknown[])
    partes.forEach((itens, i) => {
      telas.push({
        id: `${tipo}-${i + 1}`,
        tipo,
        titulo: TITULOS[tipo],
        pagina: i + 1,
        paginas: partes.length,
        total: todos.length,
        itens,
      } as Tela)
    })
  }
  return telas
}

const dm = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}` : 'sem data')

/** "10/11 → 24/11", para a tela de replanejadas. */
export function descreverMudanca(r: Pick<Replanejada, 'de' | 'para'>): string {
  return `${dm(r.de)} → ${dm(r.para)}`
}

/** A equipe pedida na URL, se existir entre as conhecidas; senão `null` (= todas). */
export function lerEquipe(bruto: string | string[] | undefined, conhecidas: readonly string[]): string | null {
  const v = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim()
  return v && conhecidas.includes(v) ? v : null
}
