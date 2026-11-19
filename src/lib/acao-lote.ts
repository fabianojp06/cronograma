/**
 * Gravação do lote: todas as ações e todo o histórico em UMA transação. Cada
 * ação é conferida pela versão (`updatedAt`) no próprio `updateMany`: se outra
 * pessoa a salvou depois da prévia, ela é PULADA e devolvida em `conflitos` —
 * nunca sobrescrita. Nada é gravado pela metade: ou a transação inteira passa,
 * ou nenhuma linha muda.
 */

import { alteracoesDeAcao, type EstadoAuditado, type LinhaHistorico } from './acao-historico'
import type { ItemDoPlano } from './edicao-lote'

export type ClienteTransacaoLote = {
  acao: {
    updateMany(args: {
      where: { id: string; updatedAt: Date }
      data: Record<string, unknown>
    }): Promise<{ count: number }>
  }
  historicoAlteracao: {
    createMany(args: { data: (LinhaHistorico & { acaoId: string })[] }): Promise<unknown>
  }
}

export type ClienteLote = {
  $transaction<T>(fn: (tx: ClienteTransacaoLote) => Promise<T>): Promise<T>
}

export type ItemParaGravar = ItemDoPlano & {
  /** Estado auditável de agora, para o "valor antigo" do histórico. */
  atual: Partial<EstadoAuditado>
}

export async function gravarLote(
  cliente: ClienteLote,
  itens: ItemParaGravar[],
  alteradoPor: string | null,
): Promise<{ gravadas: string[]; conflitos: string[] }> {
  return cliente.$transaction(async (tx) => {
    const gravadas: string[] = []
    const conflitos: string[] = []
    const historico: (LinhaHistorico & { acaoId: string })[] = []

    for (const item of itens) {
      if (item.mudancas.length === 0) continue
      const { count } = await tx.acao.updateMany({
        where: { id: item.acaoId, updatedAt: item.versao },
        data: item.dados,
      })
      if (count === 0) {
        conflitos.push(item.acaoId)
        continue
      }
      gravadas.push(item.acaoId)
      for (const linha of alteracoesDeAcao(item.atual, item.novos, alteradoPor)) {
        historico.push({ ...linha, acaoId: item.acaoId })
      }
    }

    if (historico.length > 0) await tx.historicoAlteracao.createMany({ data: historico })
    return { gravadas, conflitos }
  })
}
