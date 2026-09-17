/**
 * Registro das datas **Realizado** de uma Ação — fluxo distinto do de datas
 * Previsto, e por isso um módulo próprio.
 *
 * Previsto é planejamento: pode ser remarcado para frente ou para trás
 * livremente. Realizado é apontamento de fato ocorrido — só entra o que já
 * aconteceu, não pode vir do futuro, e término sem início não existe. Como o
 * formulário de apontamento manda só as duas datas, a validação precisa
 * enxergar também o estado atual da Ação no banco (o início pode já estar
 * gravado de um apontamento anterior).
 *
 * Módulo puro: sem Prisma e sem Next, igual a `acao-validacao.ts`.
 */

import { inicioDeHojeUTC } from './data-hoje'
import {
  lerDataISO,
  type CampoData,
  type EntradaAcao,
  type StatusAcao,
} from './acao-validacao'
import type { EstadoAuditado } from './acao-historico'

/** Os dois campos que este fluxo aceita — Previsto não é tocado aqui. */
export const CAMPOS_REALIZADO = ['realizadoInicio', 'realizadoTermino'] as const

export type CampoRealizado = (typeof CAMPOS_REALIZADO)[number]

export type DadosRealizado = { [C in CampoRealizado]: Date | null } & {
  status: StatusAcao
}

export type ErrosRealizado = Partial<Record<CampoRealizado | 'status', string>>

export type ResultadoValidacaoRealizado =
  | { ok: true; dados: DadosRealizado }
  | { ok: false; erros: ErrosRealizado }

function lerCampo(entrada: EntradaAcao, campo: string): string {
  const bruto =
    typeof (entrada as FormData).get === 'function'
      ? (entrada as FormData).get(campo)
      : (entrada as Record<string, FormDataEntryValue | null | undefined>)[campo]

  return typeof bruto === 'string' ? bruto.trim() : ''
}

/** Estado da Ação que o apontamento precisa conhecer para decidir. */
export type EstadoParaRealizado = Pick<EstadoAuditado, 'status'> & {
  [C in CampoData]?: Date | null
}

function comoData(valor: Date | string | null | undefined): Date | null {
  return valor instanceof Date ? valor : null
}

/**
 * Valida um apontamento de Realizado sobre o estado atual da Ação.
 *
 * Regras, nesta ordem:
 * - datas mal formadas são erro de campo (mesma convenção de `lerDataISO`);
 * - data realizada no futuro é recusada — apontamento registra o que já ocorreu;
 * - término sem início (nem no formulário, nem já gravado) é recusado;
 * - término anterior ao início é recusado;
 * - o `status` avança sozinho: término preenchido conclui a Ação; apagar o
 *   término de uma Ação concluída a devolve para `EM_CURSO_75`; início sem
 *   término tira a Ação de `NAO_INICIADO`. O status já informado manualmente
 *   no meio da escala (25/50/75) é preservado.
 */
export function validarRealizado(
  entrada: EntradaAcao,
  atual: EstadoParaRealizado,
  agora: Date = new Date(),
): ResultadoValidacaoRealizado {
  const erros: ErrosRealizado = {}
  const hoje = inicioDeHojeUTC(agora)

  const datas = {} as { [C in CampoRealizado]: Date | null }
  for (const campo of CAMPOS_REALIZADO) {
    const data = lerDataISO(lerCampo(entrada, campo))
    if (data === undefined) {
      erros[campo] = 'Data inválida.'
      datas[campo] = null
    } else if (data && data > hoje) {
      erros[campo] = 'A data realizada não pode estar no futuro.'
      datas[campo] = null
    } else {
      datas[campo] = data
    }
  }

  if (!erros.realizadoInicio && !erros.realizadoTermino) {
    const inicio = datas.realizadoInicio ?? comoData(atual.realizadoInicio)
    if (datas.realizadoTermino && !inicio) {
      erros.realizadoInicio = 'Informe o início realizado antes do término.'
    } else if (datas.realizadoTermino && inicio && datas.realizadoTermino < inicio) {
      erros.realizadoTermino =
        'O término realizado não pode ser anterior ao início realizado.'
    }
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros }

  return {
    ok: true,
    dados: { ...datas, status: statusAposRealizado(atual.status as StatusAcao, datas) },
  }
}

/** Status decorrente do apontamento — ver as regras em `validarRealizado`. */
export function statusAposRealizado(
  statusAtual: StatusAcao,
  datas: { [C in CampoRealizado]: Date | null },
): StatusAcao {
  if (datas.realizadoTermino) return 'CONCLUIDO'
  if (statusAtual === 'CONCLUIDO') return 'EM_CURSO_75'
  if (datas.realizadoInicio && statusAtual === 'NAO_INICIADO') return 'EM_CURSO_25'
  return statusAtual
}
