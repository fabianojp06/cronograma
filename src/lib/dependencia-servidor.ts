import { chaveDoNome } from '@/lib/colaborador-validacao'
import { situacaoAdmin } from '@/lib/administracao-servidor'
import {
  bloqueioDaGravacao,
  ehLiderDoProjeto,
  gravacaoInicia,
} from '@/lib/dependencia-acao'
import { prisma } from '@/lib/prisma'

type Estado = {
  status: string
  realizadoInicio?: Date | string | null
  realizadoTermino?: Date | string | null
}

/**
 * Recusa (com a mensagem) a gravação que FAZ a ação começar enquanto uma
 * predecessora não terminou e não há liberação aprovada; `null` se pode gravar.
 * Campo ausente em `novo` (`undefined`) vale o que já está gravado.
 */
export async function bloqueioParaGravar(
  acaoId: string,
  atual: Required<Estado>,
  novo: Estado,
): Promise<string | null> {
  const proximo = {
    status: novo.status,
    realizadoInicio: novo.realizadoInicio === undefined ? atual.realizadoInicio : novo.realizadoInicio,
    realizadoTermino:
      novo.realizadoTermino === undefined ? atual.realizadoTermino : novo.realizadoTermino,
  }
  if (!gravacaoInicia(atual, proximo)) return null

  const [vinculos, aprovada] = await Promise.all([
    prisma.dependenciaAcao.findMany({
      where: { acaoId },
      select: { predecessora: { select: { id: true, numero: true, status: true } } },
    }),
    prisma.liberacaoAcao.findFirst({
      where: { acaoId, status: 'APROVADA' },
      select: { id: true },
    }),
  ])
  return bloqueioDaGravacao({
    inicia: true,
    predecessoras: vinculos.map((v) => v.predecessora),
    liberada: aprovada !== null,
  })
}

/** A conta é líder do projeto (responsável casado pelo nome) ou administrador de verdade. */
export async function contaELiderDoProjeto(
  userId: string,
  responsavelDoProjeto: string | null,
): Promise<boolean> {
  const [eu, situacao] = await Promise.all([
    prisma.colaborador.findFirst({
      where: { clerkUserId: userId, ativo: true },
      select: { nome: true },
    }),
    situacaoAdmin(userId),
  ])
  // Só administrador REAL: no estado "ainda não há administrador" todos podem
  // tudo, e isso deixaria qualquer um aprovar o próprio pedido.
  return ehLiderDoProjeto({
    nomeDoColaborador: eu?.nome ?? null,
    responsavelDoProjeto,
    administrador: situacao.eAdministrador,
  })
}

/**
 * Quem recebe o aviso de um pedido de liberação: o colaborador ativo que casa
 * com `Projeto.responsavel` e, não havendo, os administradores ativos.
 */
export async function destinatariosDoPedido(responsavelDoProjeto: string | null): Promise<string[]> {
  const ativos = await prisma.colaborador.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, administrador: true },
  })
  if (responsavelDoProjeto) {
    const chave = chaveDoNome(responsavelDoProjeto)
    const lider = ativos.find((c) => chaveDoNome(c.nome) === chave)
    if (lider) return [lider.id]
  }
  return ativos.filter((c) => c.administrador).map((c) => c.id)
}
