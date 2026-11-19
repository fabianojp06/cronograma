'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { registrarFalha } from '@/lib/registrar-erro'

/**
 * Marca como lida(s). Cada pessoa mexe só nas SUAS: o `destinatarioId` vai no
 * `where`, então forjar o id de uma notificação alheia não muda nada. Perfil
 * Leitor também marca: é estado pessoal de leitura, não dado do sistema.
 */
async function marcar(formData: FormData, todas: boolean): Promise<void> {
  const { userId } = await auth()
  if (!userId) return

  try {
    const colaborador = await prisma.colaborador.findUnique({
      where: { clerkUserId: userId },
      select: { id: true },
    })
    if (!colaborador) return

    const id = formData.get('notificacaoId')
    if (!todas && (typeof id !== 'string' || id === '')) return

    await prisma.notificacao.updateMany({
      where: {
        destinatarioId: colaborador.id,
        lida: false,
        ...(todas ? {} : { id: id as string }),
      },
      data: { lida: true },
    })
    // O sino está no cabeçalho de todas as páginas.
    revalidatePath('/', 'layout')
  } catch (erro) {
    await registrarFalha('Falha ao marcar notificação como lida', erro)
  }
}

export async function marcarLida(formData: FormData): Promise<void> {
  await marcar(formData, false)
}

export async function marcarTodasLidas(formData: FormData): Promise<void> {
  await marcar(formData, true)
}
