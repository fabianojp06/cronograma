/**
 * "Foto em uma data": como um projeto estava no fim de um dia passado,
 * reconstruído do histórico de alterações — módulo puro.
 *
 * **Como reconstrói.** Parte do estado ATUAL da ação e desfaz, da mais recente
 * para a mais antiga, cada alteração posterior à data: o campo volta ao
 * `valorAntigo` da linha. Isso é exato para os campos auditados (status, as
 * quatro datas e o responsável) porque toda gravação deles passa por
 * `gravarAcaoComHistorico`. Desfazer de trás para frente, e não refazer de
 * frente para trás, é o que dispensa conhecer o estado inicial.
 *
 * **O que NÃO é exato — a regra de aproximação, dita à tela:**
 * - A ação só aparece se `createdAt` for anterior ao corte. As importadas da
 *   planilha têm `createdAt` = dia da importação, então uma foto de ANTES do
 *   início do registro (`inicioDoRegistro`) não tem como ser fiel: o sistema não
 *   sabe o que a planilha dizia. A tela avisa em vez de mostrar uma foto vazia
 *   como se fosse a verdade.
 * - Descrição e número não são auditados: saem como estão hoje.
 * - Projeto excluído depois da data não aparece (a exclusão lógica não guarda
 *   quando aconteceu).
 * - Alteração feita fora do sistema (script de importação, SQL) não tem linha
 *   de histórico e não é desfeita.
 */

import { ehStatus } from './historico-exibicao'
import { limitesDoInstante, lerPeriodo } from './filtro-periodo'
import type { StatusAcao } from './acao-validacao'

export type RegistroHistorico = {
  campo: string
  valorAntigo: string | null
  alteradoEm: Date
}

export type AcaoComHistorico = {
  id: string
  numero: number
  descricao: string
  status: StatusAcao
  previstoInicio: Date | null
  previstoTermino: Date | null
  realizadoInicio: Date | null
  realizadoTermino: Date | null
  /** Nome da pessoa (o histórico grava o nome, não o id). */
  responsavel: string | null
  createdAt: Date
  historico: readonly RegistroHistorico[]
}

export type AcaoReconstruida = Omit<AcaoComHistorico, 'historico' | 'createdAt'>

const CAMPOS_DATA_FOTO = [
  'previstoInicio',
  'previstoTermino',
  'realizadoInicio',
  'realizadoTermino',
] as const

function lerDataHistorico(valor: string | null): Date | null {
  if (valor === null) return null
  return /^\d{4}-\d{2}-\d{2}$/.test(valor) ? new Date(`${valor}T00:00:00.000Z`) : null
}

/**
 * A data pedida na URL, ou `null` quando não vale como foto: formato inválido,
 * dia que não existe no calendário, ou hoje/futuro — nesses casos a tela mostra
 * o estado atual, que já é a "foto de hoje".
 */
export function lerDataDaFoto(
  entrada: string | string[] | undefined,
  hoje: Date,
): string | null {
  const bruto = Array.isArray(entrada) ? entrada[0] : entrada
  if (typeof bruto !== 'string') return null
  const { ate } = lerPeriodo({ ate: bruto })
  if (ate === null) return null
  return ate < hoje.toISOString().slice(0, 10) ? ate : null
}

/** Instante a partir do qual as alterações já não valem: o começo do dia seguinte, em Brasília. */
export function corteDaFoto(dia: string): Date {
  const { lt } = limitesDoInstante({ de: null, ate: dia })
  // `lt` sempre vem quando `ate` vem; o fallback só satisfaz o tipo.
  return lt ?? new Date(`${dia}T00:00:00.000Z`)
}

/**
 * A ação como estava antes do `corte`, ou `null` se ainda não existia.
 */
export function reconstruirAcao(acao: AcaoComHistorico, corte: Date): AcaoReconstruida | null {
  if (acao.createdAt.getTime() >= corte.getTime()) return null

  const estado = {
    status: acao.status,
    previstoInicio: acao.previstoInicio,
    previstoTermino: acao.previstoTermino,
    realizadoInicio: acao.realizadoInicio,
    realizadoTermino: acao.realizadoTermino,
    responsavel: acao.responsavel,
  }

  // Do mais recente para o mais antigo: se o mesmo campo mudou duas vezes depois
  // do corte, o que fica é o valor antigo da MAIS ANTIGA delas.
  const posteriores = acao.historico
    .filter((h) => h.alteradoEm.getTime() >= corte.getTime())
    .sort((a, b) => b.alteradoEm.getTime() - a.alteradoEm.getTime())

  for (const h of posteriores) {
    if (h.campo === 'status') {
      if (h.valorAntigo !== null && ehStatus(h.valorAntigo)) estado.status = h.valorAntigo
    } else if (h.campo === 'responsavel') {
      estado.responsavel = h.valorAntigo
    } else if ((CAMPOS_DATA_FOTO as readonly string[]).includes(h.campo)) {
      estado[h.campo as (typeof CAMPOS_DATA_FOTO)[number]] = lerDataHistorico(h.valorAntigo)
    }
  }

  return {
    id: acao.id,
    numero: acao.numero,
    descricao: acao.descricao,
    ...estado,
  }
}

export type FotoDoProjeto = {
  acoes: AcaoReconstruida[]
  /** Ações que só foram criadas depois da data: ficam de fora. */
  criadasDepois: number
  /** A data é anterior ao primeiro registro do sistema: a foto não é fiel. */
  anteriorAoRegistro: boolean
}

export function fotoDoProjeto(
  acoes: readonly AcaoComHistorico[],
  corte: Date,
  inicioDoRegistro: Date | null,
): FotoDoProjeto {
  const reconstruidas: AcaoReconstruida[] = []
  let criadasDepois = 0
  for (const a of acoes) {
    const r = reconstruirAcao(a, corte)
    if (r === null) criadasDepois += 1
    else reconstruidas.push(r)
  }
  return {
    acoes: reconstruidas.sort((a, b) => a.numero - b.numero),
    criadasDepois,
    anteriorAoRegistro: inicioDoRegistro !== null && corte.getTime() <= inicioDoRegistro.getTime(),
  }
}
