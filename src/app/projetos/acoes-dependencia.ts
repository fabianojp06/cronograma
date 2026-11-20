'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { MENSAGEM_SOMENTE_LEITURA } from '@/lib/administracao'
import { contaPodeEditar } from '@/lib/administracao-servidor'
import { lerIdAcao } from '@/lib/acao-validacao'
import {
  acaoIniciada,
  MENSAGEM_ERRO_DEPENDENCIA,
  predecessorasPendentes,
  validarJustificativa,
  validarMotivoLiberacao,
  validarNovaDependencia,
} from '@/lib/dependencia-acao'
import {
  contaELiderDoProjeto,
  destinatariosDoPedido,
} from '@/lib/dependencia-servidor'
import { prisma } from '@/lib/prisma'
import { registrarFalha } from '@/lib/registrar-erro'

export type EstadoDependencia = { erro?: string; ok?: string }

function atualizar(projetoId: string, acaoId: string) {
  revalidatePath(`/projetos/${projetoId}`)
  revalidatePath(`/projetos/${projetoId}/acoes/${acaoId}/editar`)
  // O sino está no cabeçalho de todas as páginas.
  revalidatePath('/', 'layout')
}

function texto(formData: FormData, campo: string): string {
  const v = formData.get(campo)
  return typeof v === 'string' ? v.trim() : ''
}

/** "B depende de A": `id` é a ação B, `predecessoraId` a ação A (mesmo projeto, sem ciclo). */
export async function adicionarDependencia(
  _anterior: EstadoDependencia,
  formData: FormData,
): Promise<EstadoDependencia> {
  const { userId } = await auth()
  if (!userId) return { erro: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeEditar(userId))) return { erro: MENSAGEM_SOMENTE_LEITURA }

  const acaoId = lerIdAcao(formData)
  const predecessoraId = texto(formData, 'predecessoraId')
  if (!acaoId) return { erro: 'Ação não identificada. Recarregue a página.' }
  if (!predecessoraId) return { erro: 'Escolha a ação que precisa terminar antes.' }

  try {
    const [acao, predecessora] = await Promise.all([
      prisma.acao.findFirst({
        where: { id: acaoId, projeto: { ativo: true } },
        select: { id: true, projetoId: true },
      }),
      prisma.acao.findFirst({
        where: { id: predecessoraId, projeto: { ativo: true } },
        select: { id: true, numero: true, projetoId: true },
      }),
    ])
    if (!acao || !predecessora) return { erro: 'Ação não encontrada ou projeto excluído.' }
    if (acao.projetoId !== predecessora.projetoId) {
      return { erro: 'A dependência vale só entre ações do mesmo projeto.' }
    }

    const existentes = await prisma.dependenciaAcao.findMany({
      where: { acao: { projetoId: acao.projetoId } },
      select: { acaoId: true, predecessoraId: true },
    })
    const erro = validarNovaDependencia({ acaoId, predecessoraId }, existentes)
    if (erro) return { erro: MENSAGEM_ERRO_DEPENDENCIA[erro] }

    await prisma.$transaction([
      prisma.dependenciaAcao.create({
        data: { acaoId, predecessoraId, criadoPor: userId },
      }),
      prisma.historicoAlteracao.create({
        data: {
          acaoId,
          campo: 'dependencia',
          valorAntigo: null,
          valorNovo: `Depende da ação ${predecessora.numero}`,
          alteradoPor: userId,
        },
      }),
    ])
    atualizar(acao.projetoId, acaoId)
    return { ok: `Agora esta ação depende da ação ${predecessora.numero}.` }
  } catch (erro) {
    await registrarFalha('Falha ao adicionar dependência', erro)
    return { erro: 'Não foi possível salvar a dependência. Tente novamente.' }
  }
}

/** Remove o vínculo (`dependenciaId`). */
export async function removerDependencia(formData: FormData): Promise<void> {
  const { userId } = await auth()
  if (!userId) return
  if (!(await contaPodeEditar(userId))) return

  const id = texto(formData, 'dependenciaId')
  if (!id) return

  try {
    const vinculo = await prisma.dependenciaAcao.findUnique({
      where: { id },
      select: {
        acaoId: true,
        predecessora: { select: { numero: true } },
        acao: { select: { projetoId: true, projeto: { select: { ativo: true } } } },
      },
    })
    if (!vinculo || !vinculo.acao.projeto.ativo) return

    await prisma.$transaction([
      prisma.dependenciaAcao.delete({ where: { id } }),
      prisma.historicoAlteracao.create({
        data: {
          acaoId: vinculo.acaoId,
          campo: 'dependencia',
          valorAntigo: `Depende da ação ${vinculo.predecessora.numero}`,
          valorNovo: null,
          alteradoPor: userId,
        },
      }),
    ])
    atualizar(vinculo.acao.projetoId, vinculo.acaoId)
  } catch (erro) {
    await registrarFalha('Falha ao remover dependência', erro)
  }
}

/**
 * Pede para iniciar a ação antes de as predecessoras terminarem. Se quem pede é
 * o líder do projeto (ou administrador), a liberação já nasce APROVADA — com o
 * registro no histórico; senão fica PENDENTE e o líder é avisado no sistema.
 */
export async function pedirLiberacao(
  _anterior: EstadoDependencia,
  formData: FormData,
): Promise<EstadoDependencia> {
  const { userId } = await auth()
  if (!userId) return { erro: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeEditar(userId))) return { erro: MENSAGEM_SOMENTE_LEITURA }

  const acaoId = lerIdAcao(formData)
  if (!acaoId) return { erro: 'Ação não identificada. Recarregue a página.' }
  const motivo = validarMotivoLiberacao(formData.get('motivo'))
  if (!motivo.ok) return { erro: motivo.erro }

  try {
    const acao = await prisma.acao.findFirst({
      where: { id: acaoId, projeto: { ativo: true } },
      select: {
        id: true,
        numero: true,
        projetoId: true,
        status: true,
        realizadoInicio: true,
        realizadoTermino: true,
        projeto: { select: { responsavel: true, liderId: true } },
        dependeDe: { select: { predecessora: { select: { id: true, numero: true, status: true } } } },
        liberacoes: { where: { status: { in: ['PENDENTE', 'APROVADA'] } }, select: { status: true } },
      },
    })
    if (!acao) return { erro: 'Ação não encontrada ou projeto excluído.' }
    if (acaoIniciada(acao)) return { erro: 'Esta ação já foi iniciada.' }
    if (predecessorasPendentes(acao.dependeDe.map((d) => d.predecessora)).length === 0) {
      return { erro: 'Esta ação não está bloqueada: pode ser iniciada normalmente.' }
    }
    if (acao.liberacoes.some((l) => l.status === 'APROVADA')) {
      return { erro: 'Esta ação já está liberada.' }
    }
    if (acao.liberacoes.some((l) => l.status === 'PENDENTE')) {
      return { erro: 'Já existe um pedido de liberação aguardando o líder.' }
    }

    const lider = await contaELiderDoProjeto(userId, acao.projeto)
    const agora = new Date()

    if (lider) {
      await prisma.$transaction([
        prisma.liberacaoAcao.create({
          data: {
            acaoId,
            solicitante: userId,
            motivo: motivo.texto,
            status: 'APROVADA',
            decididoPor: userId,
            decididoEm: agora,
          },
        }),
        prisma.historicoAlteracao.create({
          data: {
            acaoId,
            campo: 'liberacao',
            valorAntigo: null,
            valorNovo: `Liberada pelo líder: ${motivo.texto}`,
            alteradoPor: userId,
          },
        }),
      ])
      atualizar(acao.projetoId, acaoId)
      return { ok: 'Ação liberada. Você já pode iniciá-la.' }
    }

    const [eu, destinos] = await Promise.all([
      prisma.colaborador.findUnique({ where: { clerkUserId: userId }, select: { id: true } }),
      destinatariosDoPedido(acao.projeto),
    ])
    const avisados = destinos.filter((id) => id !== eu?.id)

    await prisma.$transaction(async (tx) => {
      const liberacao = await tx.liberacaoAcao.create({
        data: { acaoId, solicitante: userId, motivo: motivo.texto },
        select: { id: true },
      })
      await tx.historicoAlteracao.create({
        data: {
          acaoId,
          campo: 'liberacao',
          valorAntigo: null,
          valorNovo: `Pedida: ${motivo.texto}`,
          alteradoPor: userId,
        },
      })
      if (avisados.length > 0) {
        await tx.notificacao.createMany({
          data: avisados.map((destinatarioId) => ({
            destinatarioId,
            liberacaoId: liberacao.id,
            motivo: 'LIBERACAO_PEDIDA',
          })),
        })
      }
    })
    atualizar(acao.projetoId, acaoId)
    return {
      ok:
        avisados.length > 0
          ? 'Pedido enviado. O líder do projeto foi avisado no sistema.'
          : 'Pedido registrado, mas não há líder com cadastro para avisar. Fale com ele diretamente.',
    }
  } catch (erro) {
    await registrarFalha('Falha ao pedir liberação de ação', erro)
    return { erro: 'Não foi possível registrar o pedido. Tente novamente.' }
  }
}

/** O líder (ou administrador) aprova ou recusa; `decisao` = `aprovar` | `recusar`. */
export async function decidirLiberacao(
  _anterior: EstadoDependencia,
  formData: FormData,
): Promise<EstadoDependencia> {
  const { userId } = await auth()
  if (!userId) return { erro: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeEditar(userId))) return { erro: MENSAGEM_SOMENTE_LEITURA }

  const id = texto(formData, 'liberacaoId')
  const decisao = texto(formData, 'decisao')
  if (!id || (decisao !== 'aprovar' && decisao !== 'recusar')) {
    return { erro: 'Pedido não identificado. Recarregue a página.' }
  }
  const aprovando = decisao === 'aprovar'
  const justificativa = validarJustificativa(formData.get('justificativa'), aprovando)
  if (!justificativa.ok) return { erro: justificativa.erro }

  try {
    const pedido = await prisma.liberacaoAcao.findUnique({
      where: { id },
      select: {
        id: true,
        motivo: true,
        solicitante: true,
        status: true,
        acaoId: true,
        acao: {
          select: { numero: true, projetoId: true, projeto: { select: { responsavel: true, liderId: true, ativo: true } } },
        },
      },
    })
    if (!pedido || !pedido.acao.projeto.ativo) return { erro: 'Pedido não encontrado.' }
    if (!(await contaELiderDoProjeto(userId, pedido.acao.projeto))) {
      return { erro: 'Só o líder do projeto ou um administrador decide a liberação.' }
    }

    const novoStatus = aprovando ? 'APROVADA' : 'RECUSADA'
    const solicitante = await prisma.colaborador.findFirst({
      where: { clerkUserId: pedido.solicitante, ativo: true },
      select: { id: true },
    })

    const decidido = await prisma.$transaction(async (tx) => {
      // Condicional: dois cliques (ou duas abas) decidem uma vez só.
      const { count } = await tx.liberacaoAcao.updateMany({
        where: { id, status: 'PENDENTE' },
        data: {
          status: novoStatus,
          decididoPor: userId,
          decididoEm: new Date(),
          justificativa: justificativa.texto || null,
        },
      })
      if (count === 0) return false
      await tx.historicoAlteracao.create({
        data: {
          acaoId: pedido.acaoId,
          campo: 'liberacao',
          valorAntigo: `Pedida: ${pedido.motivo}`,
          valorNovo: `${aprovando ? 'Aprovada' : 'Recusada'}${justificativa.texto ? `: ${justificativa.texto}` : ''}`,
          alteradoPor: userId,
        },
      })
      if (solicitante) {
        await tx.notificacao.create({
          data: {
            destinatarioId: solicitante.id,
            liberacaoId: id,
            motivo: aprovando ? 'LIBERACAO_APROVADA' : 'LIBERACAO_RECUSADA',
          },
        })
      }
      return true
    })
    if (!decidido) return { erro: 'Este pedido já foi decidido por outra pessoa.' }

    atualizar(pedido.acao.projetoId, pedido.acaoId)
    return { ok: aprovando ? 'Pedido aprovado.' : 'Pedido recusado.' }
  } catch (erro) {
    await registrarFalha('Falha ao decidir liberação de ação', erro)
    return { erro: 'Não foi possível registrar a decisão. Tente novamente.' }
  }
}
