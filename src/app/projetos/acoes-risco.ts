'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { MENSAGEM_SOMENTE_LEITURA } from '@/lib/administracao'
import { contaPodeAdministrar, contaPodeEditar } from '@/lib/administracao-servidor'
import { lerIdProjeto } from '@/lib/projeto-edicao'
import { prisma } from '@/lib/prisma'
import { registrarFalha } from '@/lib/registrar-erro'
import {
  MOTIVO_RISCO_RESPONSAVEL,
  alteracoesDeRisco,
  podeExcluirRisco,
  riscoAberto,
  validarRisco,
  type ErrosRisco,
} from '@/lib/risco-projeto'

export type EstadoRisco = { erros?: ErrosRisco; erroGeral?: string }

function atualizar(projetoId: string) {
  revalidatePath(`/projetos/${projetoId}`)
  revalidatePath('/reuniao')
  // O sino está no cabeçalho de todas as páginas.
  revalidatePath('/', 'layout')
}

/** A ação e o responsável escolhidos precisam existir (a ação, no mesmo projeto). */
async function conferirVinculos(projetoId: string, acaoId: string | null, responsavelId: string | null, responsavelAtualId: string | null) {
  if (acaoId) {
    const acao = await prisma.acao.findFirst({ where: { id: acaoId, projetoId }, select: { id: true } })
    if (!acao) return { acaoId: 'Escolha uma ação deste projeto.' } as ErrosRisco
  }
  if (responsavelId) {
    const pessoa = await prisma.colaborador.findUnique({
      where: { id: responsavelId },
      select: { id: true, ativo: true },
    })
    // O responsável atual pode estar inativo (some da lista, mas não é apagado ao salvar outro campo).
    if (!pessoa || (!pessoa.ativo && responsavelId !== responsavelAtualId)) {
      return { responsavelId: 'Escolha um responsável da lista (a pessoa não está ativa).' } as ErrosRisco
    }
  }
  return null
}

/** Registra um risco ou bloqueio no projeto (`id` = projeto). */
export async function criarRisco(_anterior: EstadoRisco, formData: FormData): Promise<EstadoRisco> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeEditar(userId))) return { erroGeral: MENSAGEM_SOMENTE_LEITURA }

  const projetoId = lerIdProjeto(formData)
  if (!projetoId) return { erroGeral: 'Projeto não identificado. Recarregue a página.' }
  const validacao = validarRisco(formData)
  if (!validacao.ok) return { erros: validacao.erros }
  const d = validacao.dados

  try {
    const projeto = await prisma.projeto.findFirst({ where: { id: projetoId, ativo: true }, select: { id: true } })
    if (!projeto) return { erroGeral: 'Projeto não encontrado ou excluído.' }
    const erroVinculo = await conferirVinculos(projetoId, d.acaoId, d.responsavelId, null)
    if (erroVinculo) return { erros: erroVinculo }

    const eu = await prisma.colaborador.findUnique({ where: { clerkUserId: userId }, select: { id: true } })
    await prisma.$transaction(async (tx) => {
      const risco = await tx.riscoProjeto.create({
        data: {
          projetoId,
          ...d,
          criadoPor: userId,
          resolvidoEm: riscoAberto(d.status) ? null : new Date(),
        },
        select: { id: true },
      })
      if (d.responsavelId && d.responsavelId !== eu?.id) {
        await tx.notificacao.create({
          data: { destinatarioId: d.responsavelId, riscoId: risco.id, motivo: MOTIVO_RISCO_RESPONSAVEL },
        })
      }
    })
  } catch (erro) {
    await registrarFalha('Falha ao registrar risco do projeto', erro)
    return { erroGeral: 'Não foi possível salvar. Tente novamente.' }
  }

  atualizar(projetoId)
  redirect(`/projetos/${projetoId}#riscos`)
}

/** Edita um risco (`riscoId`), registrando no histórico o que mudou. */
export async function atualizarRisco(_anterior: EstadoRisco, formData: FormData): Promise<EstadoRisco> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeEditar(userId))) return { erroGeral: MENSAGEM_SOMENTE_LEITURA }

  const riscoId = String(formData.get('riscoId') ?? '')
  if (!riscoId) return { erroGeral: 'Registro não identificado. Recarregue a página.' }
  const validacao = validarRisco(formData)
  if (!validacao.ok) return { erros: validacao.erros }
  const d = validacao.dados

  let projetoId: string
  try {
    const atual = await prisma.riscoProjeto.findFirst({
      where: { id: riscoId, projeto: { ativo: true } },
      select: {
        projetoId: true,
        tipo: true,
        impacto: true,
        status: true,
        prazo: true,
        responsavelId: true,
        responsavel: { select: { nome: true } },
        resolvidoEm: true,
      },
    })
    if (!atual) return { erroGeral: 'Registro não encontrado ou projeto excluído.' }
    projetoId = atual.projetoId

    const erroVinculo = await conferirVinculos(projetoId, d.acaoId, d.responsavelId, atual.responsavelId)
    if (erroVinculo) return { erros: erroVinculo }

    const novoResponsavel = d.responsavelId
      ? await prisma.colaborador.findUnique({ where: { id: d.responsavelId }, select: { nome: true } })
      : null
    const mudancas = alteracoesDeRisco(
      { tipo: atual.tipo, impacto: atual.impacto, status: atual.status, responsavel: atual.responsavel?.nome ?? null, prazo: atual.prazo },
      { tipo: d.tipo, impacto: d.impacto, status: d.status, responsavel: novoResponsavel?.nome ?? null, prazo: d.prazo },
    )
    const eu = await prisma.colaborador.findUnique({ where: { clerkUserId: userId }, select: { id: true } })

    await prisma.$transaction(async (tx) => {
      await tx.riscoProjeto.update({
        where: { id: riscoId },
        data: {
          ...d,
          resolvidoEm: riscoAberto(d.status) ? null : (atual.resolvidoEm ?? new Date()),
        },
      })
      if (mudancas.length > 0) {
        await tx.riscoHistorico.createMany({
          data: mudancas.map((m) => ({ riscoId, ...m, alteradoPor: userId })),
        })
      }
      if (d.responsavelId && d.responsavelId !== atual.responsavelId && d.responsavelId !== eu?.id) {
        await tx.notificacao.create({
          data: { destinatarioId: d.responsavelId, riscoId, motivo: MOTIVO_RISCO_RESPONSAVEL },
        })
      }
    })
  } catch (erro) {
    await registrarFalha('Falha ao atualizar risco do projeto', erro)
    return { erroGeral: 'Não foi possível salvar. Tente novamente.' }
  }

  atualizar(projetoId)
  redirect(`/projetos/${projetoId}#riscos`)
}

/** Exclui (registro errado): quem registrou ou um administrador. */
export async function excluirRisco(formData: FormData): Promise<void> {
  const { userId } = await auth()
  if (!userId) return
  if (!(await contaPodeEditar(userId))) return
  const id = formData.get('riscoId')
  if (typeof id !== 'string' || id === '') return

  try {
    const risco = await prisma.riscoProjeto.findUnique({ where: { id }, select: { id: true, criadoPor: true, projetoId: true } })
    if (!risco) return
    const administrador = await contaPodeAdministrar(userId)
    if (!podeExcluirRisco(risco.criadoPor, userId, administrador)) return
    await prisma.riscoProjeto.delete({ where: { id: risco.id } })
    atualizar(risco.projetoId)
  } catch (erro) {
    await registrarFalha('Falha ao excluir risco do projeto', erro)
  }
}
