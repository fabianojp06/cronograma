/**
 * Trilha de auditoria de uma Ação — módulo puro quanto à regra, com um único
 * ponto de gravação que recebe o cliente Prisma por parâmetro.
 *
 * O CLAUDE.md trata isso como requisito central: **toda** mudança de `status`,
 * de uma das quatro datas ou do responsável de uma Ação vira uma linha em
 * `HistoricoAlteracao` com valor antigo e novo. Manter a regra aqui (e não
 * dentro da Server Action) permite testar sem banco, injetando um cliente
 * falso em `gravarAcaoComHistorico`.
 */

import { CAMPOS_DATA, type DadosAcao } from './acao-validacao'

/**
 * Campos da Ação cuja alteração precisa ser auditada, na ordem do SCHEMA.md.
 *
 * `responsavel` não é coluna da Ação: o banco guarda `responsavelId`, mas o
 * histórico grava o **nome** da pessoa. Um id no painel de histórico não diz
 * nada a quem lê, e o nome registra quem respondia pela ação naquele momento —
 * se a pessoa for renomeada depois, a linha antiga continua contando o que
 * aconteceu, como o `comentario` da promoção de WIN.
 */
export const CAMPOS_AUDITADOS = [
  'status',
  ...CAMPOS_DATA,
  'responsavel',
] as const satisfies readonly (keyof DadosAcao | 'responsavel')[]

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
 * não gravações. Campo **ausente** em `novos` também não gera linha: fluxos
 * parciais (como o apontamento de Realizado) só mandam os campos que tocam, e
 * ausência não é o mesmo que apagar.
 */
export function alteracoesDeAcao(
  atual: Partial<EstadoAuditado>,
  novos: Partial<EstadoAuditado>,
  alteradoPor: string | null = null,
): LinhaHistorico[] {
  const linhas: LinhaHistorico[] = []

  for (const campo of CAMPOS_AUDITADOS) {
    if (!(campo in novos)) continue
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
    updateMany(args: {
      where: { id: string; updatedAt: Date }
      data: Record<string, unknown>
    }): Promise<{ count: number }>
    findUnique(args: {
      where: { id: string }
      select: { updatedAt: true }
    }): Promise<{ updatedAt: Date } | null>
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
  /**
   * Nova versão (`updatedAt`) da Ação depois da gravação. Só vem quando a
   * gravação foi condicionada a uma `versaoEsperada`; o formulário a usa como
   * a versão da próxima edição, para a pessoa não conflitar com o próprio save.
   */
  versao: Date | null
}

/**
 * Outra pessoa gravou a Ação depois que esta edição começou. Lançada de dentro
 * da transação, então nada é escrito — nem o histórico.
 */
export class ConflitoDeEdicao extends Error {
  constructor() {
    super('A ação foi alterada por outra pessoa depois que a edição começou.')
    this.name = 'ConflitoDeEdicao'
  }
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
    /** O que vai para o `update` da Ação. */
    dados: Record<string, unknown>
    /**
     * O estado novo, para comparar com `atual`. Só difere de `dados` quando
     * um campo auditado não é coluna — o responsável é gravado como
     * `responsavelId` e auditado pelo nome.
     */
    novos?: Partial<EstadoAuditado>
    alteradoPor?: string | null
    /**
     * `updatedAt` que a pessoa viu ao abrir a edição. Com ele, a gravação só
     * acontece se a Ação ainda estiver nessa versão (`ConflitoDeEdicao` se
     * não): sem isso a última pessoa a salvar sobrescreve a outra em silêncio.
     * Ausente = sem conferência (apontamento de realizado, abas antigas).
     */
    versaoEsperada?: Date
  },
): Promise<ResultadoGravacaoAcao> {
  const alteracoes = alteracoesDeAcao(
    entrada.atual,
    entrada.novos ?? (entrada.dados as Partial<EstadoAuditado>),
    entrada.alteradoPor ?? null,
  )

  const versao = await cliente.$transaction(async (tx) => {
    if (entrada.versaoEsperada) {
      // A versão vai no `where`: conferir e gravar são UM comando, sem janela
      // entre ler e escrever para outra pessoa passar.
      const { count } = await tx.acao.updateMany({
        where: { id: entrada.acaoId, updatedAt: entrada.versaoEsperada },
        data: entrada.dados,
      })
      if (count === 0) throw new ConflitoDeEdicao()
    } else {
      await tx.acao.update({ where: { id: entrada.acaoId }, data: entrada.dados })
    }
    if (alteracoes.length > 0) {
      await tx.historicoAlteracao.createMany({
        data: alteracoes.map((linha) => ({ ...linha, acaoId: entrada.acaoId })),
      })
    }
    if (!entrada.versaoEsperada) return null
    const gravada = await tx.acao.findUnique({
      where: { id: entrada.acaoId },
      select: { updatedAt: true },
    })
    return gravada?.updatedAt ?? null
  })

  return { alteracoes, versao }
}
