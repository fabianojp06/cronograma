/**
 * Relatórios sobre a trilha de auditoria (`HistoricoAlteracao`) — módulo puro.
 *
 * É o relatório que só existe porque o sistema substituiu a planilha: a
 * planilha sobrescrevia a data antiga e o replanejamento ficava invisível.
 * Aqui ele é contável — e "quantas vezes o prazo foi empurrado" costuma ser um
 * indicador de risco melhor do que o atraso atual, que mostra só a foto de hoje.
 */

import { CAMPOS_AUDITADOS, type CampoAuditado } from './acao-historico'

export const ROTULO_CAMPO_AUDITADO: Record<CampoAuditado, string> = {
  status: 'Status',
  previstoInicio: 'Início previsto',
  previstoTermino: 'Término previsto',
  realizadoInicio: 'Início realizado',
  realizadoTermino: 'Término realizado',
}

/** Campos cuja alteração caracteriza replanejamento (mexer no plano, não no fato). */
export const CAMPOS_REPLANEJAMENTO = [
  'previstoInicio',
  'previstoTermino',
] as const satisfies readonly CampoAuditado[]

export type RegistroHistorico = {
  id: string
  campo: string
  valorAntigo: string | null
  valorNovo: string | null
  alteradoEm: Date
  alteradoPor: string | null
  acaoId: string
  acaoNumero: number
  acaoDescricao: string
  projetoId: string
  projetoNome: string
}

export type ContagemCampo = {
  campo: string
  rotulo: string
  quantidade: number
}

function ehCampoAuditado(campo: string): campo is CampoAuditado {
  return (CAMPOS_AUDITADOS as readonly string[]).includes(campo)
}

/** Rótulo em pt-BR; campo desconhecido (schema futuro) cai no próprio nome. */
export function rotularCampo(campo: string): string {
  return ehCampoAuditado(campo) ? ROTULO_CAMPO_AUDITADO[campo] : campo
}

export function contarPorCampo(registros: RegistroHistorico[]): ContagemCampo[] {
  const contagem = new Map<string, number>()
  for (const registro of registros) {
    contagem.set(registro.campo, (contagem.get(registro.campo) ?? 0) + 1)
  }

  return [...contagem.entries()]
    .map(([campo, quantidade]) => ({ campo, rotulo: rotularCampo(campo), quantidade }))
    .sort((a, b) =>
      b.quantidade !== a.quantidade
        ? b.quantidade - a.quantidade
        : a.rotulo.localeCompare(b.rotulo, 'pt-BR'),
    )
}

export type LinhaReplanejamento = {
  acaoId: string
  acaoNumero: number
  acaoDescricao: string
  projetoId: string
  projetoNome: string
  /** Quantas vezes alguma data prevista desta ação foi alterada. */
  vezes: number
  /** Alteração de data prevista mais recente da ação. */
  ultimaEm: Date
  ultimoValorAntigo: string | null
  ultimoValorNovo: string | null
}

/**
 * Ações cujo plano foi mexido, da mais remexida para a menos. Uma ação com 4
 * replanejamentos e nenhum atraso aberto não aparece em nenhum outro relatório
 * — e é exatamente a que merece uma conversa.
 */
export function rankingReplanejamentos(
  registros: RegistroHistorico[],
  limite = 10,
): LinhaReplanejamento[] {
  const doPlano = registros.filter((registro) =>
    (CAMPOS_REPLANEJAMENTO as readonly string[]).includes(registro.campo),
  )

  const porAcao = new Map<string, LinhaReplanejamento>()

  for (const registro of doPlano) {
    const atual = porAcao.get(registro.acaoId)

    if (atual === undefined) {
      porAcao.set(registro.acaoId, {
        acaoId: registro.acaoId,
        acaoNumero: registro.acaoNumero,
        acaoDescricao: registro.acaoDescricao,
        projetoId: registro.projetoId,
        projetoNome: registro.projetoNome,
        vezes: 1,
        ultimaEm: registro.alteradoEm,
        ultimoValorAntigo: registro.valorAntigo,
        ultimoValorNovo: registro.valorNovo,
      })
      continue
    }

    atual.vezes += 1
    if (registro.alteradoEm.getTime() >= atual.ultimaEm.getTime()) {
      atual.ultimaEm = registro.alteradoEm
      atual.ultimoValorAntigo = registro.valorAntigo
      atual.ultimoValorNovo = registro.valorNovo
    }
  }

  return [...porAcao.values()]
    .sort((a, b) =>
      b.vezes !== a.vezes ? b.vezes - a.vezes : b.ultimaEm.getTime() - a.ultimaEm.getTime(),
    )
    .slice(0, limite)
}

export type ResumoAuditoria = {
  totalAlteracoes: number
  totalReplanejamentos: number
  acoesReplanejadas: number
  /** Autores distintos; registros sem autor contam como um único "não identificado". */
  autores: number
}

export function resumirAuditoria(registros: RegistroHistorico[]): ResumoAuditoria {
  const doPlano = registros.filter((r) =>
    (CAMPOS_REPLANEJAMENTO as readonly string[]).includes(r.campo),
  )

  return {
    totalAlteracoes: registros.length,
    totalReplanejamentos: doPlano.length,
    acoesReplanejadas: new Set(doPlano.map((r) => r.acaoId)).size,
    autores: new Set(registros.map((r) => r.alteradoPor ?? '(não identificado)')).size,
  }
}
