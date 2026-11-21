/**
 * Motivo do replanejamento — módulo puro.
 *
 * Quando a data PREVISTA (início ou término) de uma ação que já tinha data
 * muda, o sistema pergunta "por quê?": uma escolha numa lista curta e, se
 * quiser, um detalhe. É o que dá sentido ao relatório de replanejamentos —
 * a planilha nunca teve isso. A primeira vez que uma data é preenchida não é
 * replanejamento e não pede nada.
 */

import { serializarValor } from './acao-historico'

export const MOTIVOS_REPLANEJAMENTO = [
  'ESCOPO',
  'DEPENDENCIA_EXTERNA',
  'RECURSOS',
  'PRIORIDADE',
  'ESTIMATIVA',
  'OUTRO',
] as const

export type MotivoReplanejamento = (typeof MOTIVOS_REPLANEJAMENTO)[number]

export const ROTULO_MOTIVO_REPLANEJAMENTO: Record<MotivoReplanejamento, string> = {
  ESCOPO: 'Escopo mudou',
  DEPENDENCIA_EXTERNA: 'Dependência externa (fornecedor, outra área)',
  RECURSOS: 'Falta de pessoas ou de recursos',
  PRIORIDADE: 'Prioridade mudou',
  ESTIMATIVA: 'Estimativa inicial errada',
  OUTRO: 'Outro (explique)',
}

export const SEM_MOTIVO_REGISTRADO = 'Sem motivo registrado'

export const CAMPOS_PREVISTO = ['previstoInicio', 'previstoTermino'] as const

const TAMANHO_DETALHE = 500
const MINIMO_DETALHE_OUTRO = 3

export type MotivoLido = { motivo: MotivoReplanejamento; detalhe: string | null }

/**
 * A gravação MUDA uma data prevista que já existia? Só conta campo presente em
 * `novos` (ausente não é apagar). Preencher uma data que estava vazia não conta;
 * mexer ou limpar uma que existia, sim.
 */
export function replanejaDataExistente(
  atual: Partial<Record<(typeof CAMPOS_PREVISTO)[number], Date | string | null>>,
  novos: Partial<Record<(typeof CAMPOS_PREVISTO)[number], Date | string | null>>,
): boolean {
  return CAMPOS_PREVISTO.some((campo) => {
    if (!(campo in novos)) return false
    const antes = serializarValor(atual[campo])
    return antes !== null && antes !== serializarValor(novos[campo])
  })
}

/** Lê `motivoReplanejamento` e `motivoDetalhe` do formulário. "Outro" exige o detalhe. */
export function lerMotivoReplanejamento(
  formData: FormData,
): { ok: true; motivo: MotivoLido } | { ok: false; erro: string } {
  const bruto = String(formData.get('motivoReplanejamento') ?? '').trim()
  if (!(MOTIVOS_REPLANEJAMENTO as readonly string[]).includes(bruto)) {
    return { ok: false, erro: 'Informe o motivo da mudança de data.' }
  }
  const detalhe = String(formData.get('motivoDetalhe') ?? '').trim().replace(/\s+/g, ' ')
  if (detalhe.length > TAMANHO_DETALHE) {
    return { ok: false, erro: `O detalhe pode ter no máximo ${TAMANHO_DETALHE} caracteres.` }
  }
  if (bruto === 'OUTRO' && detalhe.length < MINIMO_DETALHE_OUTRO) {
    return { ok: false, erro: 'Em "Outro", explique o motivo no detalhe.' }
  }
  return { ok: true, motivo: { motivo: bruto as MotivoReplanejamento, detalhe: detalhe === '' ? null : detalhe } }
}

/** "Dependência externa — fornecedor atrasou", ou "Sem motivo registrado". */
export function descreverMotivo(motivo: string | null | undefined, detalhe: string | null | undefined): string {
  if (!motivo) return SEM_MOTIVO_REGISTRADO
  const nome = (ROTULO_MOTIVO_REPLANEJAMENTO as Record<string, string>)[motivo]?.replace(/ \(.*\)$/, '') ?? motivo
  return detalhe ? `${nome} — ${detalhe}` : nome
}

/** Só o nome curto da categoria (sem o parêntese explicativo), para relatórios. */
export function nomeDoMotivo(motivo: string | null | undefined): string {
  return descreverMotivo(motivo, null)
}
