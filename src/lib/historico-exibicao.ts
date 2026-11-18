/**
 * Exibição de `HistoricoAlteracao` no painel ao lado do formulário de Ação —
 * módulo puro, sem Prisma e sem Next.
 *
 * O histórico guarda texto cru (`serializarValor`): o status como o valor do
 * enum e as datas como `aaaa-mm-dd`. Aqui é só a tradução para quem lê; o que
 * está gravado não muda.
 */

import { CAMPOS_DATA, ROTULOS_STATUS, type StatusAcao } from './acao-validacao'

/** Rótulo de um valor nulo — campo vazio antes ou depois da mudança. */
export const VALOR_VAZIO = '—'

function ehStatus(valor: string): valor is StatusAcao {
  return valor in ROTULOS_STATUS
}

/**
 * Valor de uma linha de histórico pronto para a tela.
 *
 * A data é lida do próprio texto, sem passar por `Date`: `aaaa-mm-dd` é uma
 * data de calendário, e convertê-la para o fuso local de quem lê poderia
 * mostrar o dia anterior.
 */
export function formatarValorHistorico(campo: string, valor: string | null): string {
  if (valor === null) return VALOR_VAZIO

  if (campo === 'status') return ehStatus(valor) ? ROTULOS_STATUS[valor] : valor

  if ((CAMPOS_DATA as readonly string[]).includes(campo)) {
    const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor)
    return partes ? `${partes[3]}/${partes[2]}/${partes[1]}` : valor
  }

  return valor
}

/**
 * Quem alterou, para a tela. O histórico guarda o `userId` do Clerk, que não
 * diz nada a quem lê; o nome vem do colaborador vinculado àquela conta. Conta
 * sem colaborador (alteração feita antes do vínculo) aparece como tal, em vez
 * de expor o id.
 */
export function rotularAutor(
  alteradoPor: string | null,
  nomePorConta: ReadonlyMap<string, string>,
): string {
  if (alteradoPor === null) return 'Sistema'
  return nomePorConta.get(alteradoPor) ?? 'Conta sem colaborador vinculado'
}
