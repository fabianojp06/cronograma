/**
 * Trilha de auditoria de uma Ação — módulo puro quanto à regra, com um único
 * ponto de gravação que recebe o cliente Prisma por parâmetro.
 *
 * O CLAUDE.md trata isso como requisito central: **toda** mudança de `status`
 * ou de uma das quatro datas de uma Ação vira uma linha em
 * `HistoricoAlteracao` com valor antigo e novo. Manter a regra aqui (e não
 * dentro da Server Action) permite testar sem banco, injetando um cliente
 * falso em `gravarAcaoComHistorico`.
 */

import { CAMPOS_DATA, type DadosAcao } from './acao-validacao'

/** Campos da Ação cuja alteração precisa ser auditada, na ordem do SCHEMA.md. */
export const CAMPOS_AUDITADOS = ['status', ...CAMPOS_DATA] as const satisfies readonly (keyof DadosAcao)[]

export type CampoAuditado = (typeof CAMPOS_AUDITADOS)[number]

/** Estado auditável de uma Ação: o que o banco tem hoje ou o que o formulário trouxe. */
export type EstadoAuditado = { [C in CampoAuditado]: Date | string | null }

/** Uma linha de `HistoricoAlteracao`, sem os campos gerados pelo banco. */
export type LinhaHistorico = {
  campo: CampoAuditado
  valorAntigo: string | null
  valorNovo: string | null
  alteradoPor: string | null
}

/**
 * Forma de gravação do valor no histórico: datas viram `aaaa-mm-dd` em UTC
 * (mesma convenção de `lerDataISO`), para a coluna de texto do SCHEMA.md ficar
 * comparável e legível no painel de histórico.
 */
export function serializarValor(valor: Date | string | null | undefined): string | null {
  if (valor === null || valor === undefined) return null
  if (valor instanceof Date) return valor.toISOString().slice(0, 10)
  return valor
}

/**
 * Linhas de histórico correspondentes ao que mudou entre o estado atual e o
 * novo. Campo que não mudou não gera linha — o histórico registra alterações,
 * não gravações.
 */
export function alteracoesDeAcao(
  atual: Partial<EstadoAuditado>,
  novos: EstadoAuditado,
  alteradoPor: string | null = null,
): LinhaHistorico[] {
  const linhas: LinhaHistorico[] = []

  for (const campo of CAMPOS_AUDITADOS) {
    const valorAntigo = serializarValor(atual[campo])
    const valorNovo = serializarValor(novos[campo])
    if (valorAntigo === valorNovo) continue
    linhas.push({ campo, valorAntigo, valorNovo, alteradoPor })
  }

  return linhas
}

/**
 * Subconjunto do cliente transacional do Prisma usado na gravação — declarado
 * estruturalmente para o teste poder injetar um falso sem subir banco.
 */
export type ClienteTransacaoAcao = {
  acao: {
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>
  }
  historicoAlteracao: {
    createMany(args: { data: LinhaHistoricoGravada[] }): Promise<unknown>
  }
}

export type ClienteGravacaoAcao = {
  $transaction<T>(fn: (tx: ClienteTransacaoAcao) => Promise<T>): Promise<T>
}

type LinhaHistoricoGravada = LinhaHistorico & { acaoId: string }

export type ResultadoGravacaoAcao = {
  /** Linhas efetivamente gravadas em `HistoricoAlteracao`. */
  alteracoes: LinhaHistorico[]
}

/**
 * Grava a Ação e seu histórico na **mesma transação**: sem isso, uma falha
 * depois do `update` deixaria a alteração sem rastro — exatamente o buraco que
 * a planilha tem hoje e que este sistema existe para fechar.
 *
 * Quando nada auditável mudou, a Ação ainda é atualizada (a descrição pode ter
 * mudado) mas nenhuma linha de histórico é criada.
 */
export async function gravarAcaoComHistorico(
  cliente: ClienteGravacaoAcao,
  entrada: {
    acaoId: string
    atual: Partial<EstadoAuditado>
    dados: DadosAcao & Record<string, unknown>
    alteradoPor?: string | null
  },
): Promise<ResultadoGravacaoAcao> {
  const alteracoes = alteracoesDeAcao(
    entrada.atual,
    entrada.dados,
    entrada.alteradoPor ?? null,
  )

  await cliente.$transaction(async (tx) => {
    await tx.acao.update({ where: { id: entrada.acaoId }, data: entrada.dados })
    if (alteracoes.length > 0) {
      await tx.historicoAlteracao.createMany({
        data: alteracoes.map((linha) => ({ ...linha, acaoId: entrada.acaoId })),
      })
    }
  })

  return { alteracoes }
}
