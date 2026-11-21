'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { registrarFalha } from '@/lib/registrar-erro'
import { MOTIVO_RESUMO_SEMANAL } from '@/lib/resumo-servidor'

/**
 * "Fechar" do popup: marca como lidos os avisos de resumo semanal DE QUEM
 * clicou (o `destinatario` vai no `where`; forjar nada muda o aviso alheio).
 * Marca todos, não só o da semana: quem pulou semanas não deve ver o popup
 * velho na próxima entrada.
 */
export async function dispensarResumo(): Promise<void> {
  const { userId } = await auth()
  if (!userId) return
  try {
    await prisma.notificacao.updateMany({
      where: {
        motivo: MOTIVO_RESUMO_SEMANAL,
        lida: false,
        destinatario: { clerkUserId: userId },
      },
      data: { lida: true },
    })
    // O popup e o sino estão no layout.
    revalidatePath('/', 'layout')
  } catch (erro) {
    await registrarFalha('Falha ao dispensar o resumo semanal', erro)
  }
}
