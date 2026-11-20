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

type ProjetoDoLider = { liderId: string | null; responsavel: string | null }

/** A conta é líder do projeto (lista, ou nome em projeto antigo) ou administrador de verdade. */
export async function contaELiderDoProjeto(
  userId: string,
  projeto: ProjetoDoLider,
): Promise<boolean> {
  const [eu, situacao] = await Promise.all([
    prisma.colaborador.findFirst({
      where: { clerkUserId: userId, ativo: true },
      select: { id: true, nome: true },
    }),
    situacaoAdmin(userId),
  ])
  // Só administrador REAL: no estado "ainda não há administrador" todos podem
  // tudo, e isso deixaria qualquer um aprovar o próprio pedido.
  return ehLiderDoProjeto({
    meuId: eu?.id ?? null,
    nomeDoColaborador: eu?.nome ?? null,
    liderId: projeto.liderId,
    responsavelDoProjeto: projeto.responsavel,
    administrador: situacao.eAdministrador,
  })
}

/**
 * Quem recebe o aviso de um pedido de liberação: o líder escolhido na lista (se
 * ativo) ou, em projeto antigo, o colaborador ativo que casa com
 * `Projeto.responsavel` e, não havendo, os administradores ativos.
 */
export async function destinatariosDoPedido(projeto: ProjetoDoLider): Promise<string[]> {
  const ativos = await prisma.colaborador.findMany({
    where: { ativo: true },
    select: { id: true, nome: true, administrador: true },
  })
  if (projeto.liderId) {
    if (ativos.some((c) => c.id === projeto.liderId)) return [projeto.liderId]
  } else if (projeto.responsavel) {
    const chave = chaveDoNome(projeto.responsavel)
    const lider = ativos.find((c) => chaveDoNome(c.nome) === chave)
    if (lider) return [lider.id]
  }
  return ativos.filter((c) => c.administrador).map((c) => c.id)
}
