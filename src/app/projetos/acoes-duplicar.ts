'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { MENSAGEM_SOMENTE_LEITURA } from '@/lib/administracao'
import { contaPodeEditar } from '@/lib/administracao-servidor'
import { avisarResponsavel } from '@/lib/acao-apoio'
import { ehColisaoDeNumero, lerIdAcao, proximoNumero, TENTATIVAS_NUMERO } from '@/lib/acao-validacao'
import { descricaoDaCopia } from '@/lib/duplicar-acao'
import { prisma } from '@/lib/prisma'
import { registrarFalha } from '@/lib/registrar-erro'

export type EstadoDuplicar = { erro?: string }

/**
 * Cria uma cópia da ação no mesmo projeto: mesma descrição (com "(cópia)"),
 * mesmo previsto e mesmo responsável, mas SEM andamento — status "não iniciado"
 * e sem realizado. Leva à edição da cópia, onde se ajusta o que muda. O aviso
 * ao responsável segue a regra de toda ação nova.
 */
export async function duplicarAcao(
  _anterior: EstadoDuplicar,
  formData: FormData,
): Promise<EstadoDuplicar> {
  const { userId } = await auth()
  if (!userId) return { erro: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeEditar(userId))) return { erro: MENSAGEM_SOMENTE_LEITURA }

  const acaoId = lerIdAcao(formData)
  if (!acaoId) return { erro: 'Ação não identificada. Recarregue a página.' }

  let destino: string | null = null
  let aviso: Parameters<typeof avisarResponsavel>[0] | null = null
  try {
    const original = await prisma.acao.findFirst({
      where: { id: acaoId, projeto: { ativo: true } },
      select: {
        projetoId: true,
        descricao: true,
        previstoInicio: true,
        previstoTermino: true,
        responsavelId: true,
        responsavel: { select: { nome: true, email: true, ativo: true } },
        projeto: { select: { id: true, nome: true, referencia: true } },
      },
    })
    if (!original) return { erro: 'Ação não encontrada ou projeto excluído.' }

    // Responsável desativado não recebe ação nova: a cópia nasce sem responsável.
    const responsavelId = original.responsavel?.ativo ? original.responsavelId : null

    for (let tentativa = 0; tentativa < TENTATIVAS_NUMERO && destino === null; tentativa += 1) {
      const ultima = await prisma.acao.findFirst({
        where: { projetoId: original.projetoId },
        orderBy: { numero: 'desc' },
        select: { numero: true },
      })
      const numero = proximoNumero(ultima?.numero)
      try {
        const copia = await prisma.acao.create({
          data: {
            projetoId: original.projetoId,
            numero,
            descricao: descricaoDaCopia(original.descricao),
            status: 'NAO_INICIADO',
            previstoInicio: original.previstoInicio,
            previstoTermino: original.previstoTermino,
            responsavelId,
          },
          select: { id: true, numero: true, descricao: true },
        })
        destino = `/projetos/${original.projetoId}/acoes/${copia.id}/editar`
        if (responsavelId && original.responsavel) {
          aviso = {
            motivo: 'NOVA_ACAO',
            responsavel: { nome: original.responsavel.nome, email: original.responsavel.email },
            acao: {
              id: copia.id,
              numero: copia.numero,
              descricao: copia.descricao,
              previstoInicio: original.previstoInicio,
              previstoTermino: original.previstoTermino,
            },
            projeto: original.projeto,
          }
        }
      } catch (erro) {
        if (!ehColisaoDeNumero(erro)) throw erro
      }
    }
    if (destino === null) return { erro: 'Não foi possível numerar a cópia. Tente novamente.' }
    if (aviso) await avisarResponsavel(aviso)
    revalidatePath(`/projetos/${original.projetoId}`)
  } catch (erro) {
    await registrarFalha('Falha ao duplicar ação', erro)
    return { erro: 'Não foi possível duplicar a ação. Tente novamente.' }
  }

  redirect(destino)
}
