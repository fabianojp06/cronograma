'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { MENSAGEM_SOMENTE_LEITURA } from '@/lib/administracao'
import { contaPodeAdministrar, contaPodeEditar } from '@/lib/administracao-servidor'
import { lerIdAcao } from '@/lib/acao-validacao'
import { podeApagarComentario, validarComentario } from '@/lib/comentario-validacao'
import { prisma } from '@/lib/prisma'
import { registrarFalha } from '@/lib/registrar-erro'

export type EstadoComentario = {
  /** Preenchido no sucesso: a tela limpa o campo. */
  enviado?: boolean
  erro?: string
}

/**
 * Acrescenta um comentário a uma Ação. Quem só lê (perfil Leitor) não comenta:
 * comentar é gravar. Ação de projeto excluído não recebe comentário.
 */
export async function comentarAcao(
  _estadoAnterior: EstadoComentario,
  formData: FormData,
): Promise<EstadoComentario> {
  const { userId } = await auth()
  if (!userId) return { erro: 'Sessão expirada. Entre novamente para comentar.' }
  if (!(await contaPodeEditar(userId))) return { erro: MENSAGEM_SOMENTE_LEITURA }

  const acaoId = lerIdAcao(formData)
  if (!acaoId) return { erro: 'Ação não identificada. Recarregue a página.' }

  const validacao = validarComentario(formData.get('texto'))
  if (!validacao.ok) return { erro: validacao.erro }

  try {
    const acao = await prisma.acao.findFirst({
      where: { id: acaoId, projeto: { ativo: true } },
      select: { id: true, projetoId: true },
    })
    if (!acao) return { erro: 'Ação não encontrada ou projeto excluído.' }

    await prisma.comentarioAcao.create({
      data: { acaoId: acao.id, texto: validacao.texto, autor: userId },
    })
    revalidatePath(`/projetos/${acao.projetoId}/acoes/${acao.id}/editar`)
    return { enviado: true }
  } catch (erro) {
    await registrarFalha('Falha ao comentar a ação', erro)
    return { erro: 'Não foi possível salvar o comentário. Tente novamente.' }
  }
}

/** Apaga um comentário: o autor apaga o seu, o administrador apaga qualquer um. */
export async function excluirComentario(formData: FormData): Promise<void> {
  const { userId } = await auth()
  if (!userId) return
  if (!(await contaPodeEditar(userId))) return

  const id = formData.get('comentarioId')
  if (typeof id !== 'string' || id === '') return

  try {
    const comentario = await prisma.comentarioAcao.findUnique({
      where: { id },
      select: { id: true, autor: true, acao: { select: { id: true, projetoId: true } } },
    })
    if (!comentario) return
    const administrador = await contaPodeAdministrar(userId)
    if (!podeApagarComentario(comentario.autor, userId, administrador)) return

    await prisma.comentarioAcao.delete({ where: { id: comentario.id } })
    revalidatePath(
      `/projetos/${comentario.acao.projetoId}/acoes/${comentario.acao.id}/editar`,
    )
  } catch (erro) {
    await registrarFalha('Falha ao apagar o comentário', erro)
  }
}
