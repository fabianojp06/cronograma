'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { MENSAGEM_SEM_PERMISSAO } from '@/lib/administracao'
import { contaPodeAdministrar } from '@/lib/administracao-servidor'
import { prisma } from '@/lib/prisma'
import { CRITERIOS } from '@/lib/matriz-criterios'
import {
  validarAvaliacao,
  validarPesos,
  type ErrosAvaliacao,
  type ErrosPesos,
} from '@/lib/matriz-validacao'

export type EstadoFormularioAvaliacao = {
  /** Preenchido só no sucesso — a UI confirma sem sair da tela. */
  salvo?: { projetoId: string }
  erros?: ErrosAvaliacao
  /** Erro que não pertence a um campo (falha de banco, sessão expirada). */
  erroGeral?: string
}

/**
 * Grava a avaliação de um Projeto na Matriz de Priorização.
 *
 * É um `upsert` por `projetoId`: avaliar de novo substitui a avaliação
 * anterior, e não cria uma segunda. A relação é 1:1 justamente porque a
 * pergunta "qual a prioridade deste projeto hoje" tem uma resposta só.
 */
export async function salvarAvaliacao(
  _estadoAnterior: EstadoFormularioAvaliacao,
  formData: FormData,
): Promise<EstadoFormularioAvaliacao> {
  const { userId } = await auth()
  if (!userId) {
    return { erroGeral: 'Sessão expirada. Entre novamente para salvar a avaliação.' }
  }

  const projetoId = formData.get('projetoId')
  if (typeof projetoId !== 'string' || projetoId.trim() === '') {
    return { erroGeral: 'Projeto não identificado. Recarregue a página.' }
  }

  const validacao = validarAvaliacao(formData)
  if (!validacao.ok) return { erros: validacao.erros }

  try {
    // Só projeto ativo pode ser avaliado — um projeto excluído logicamente não
    // disputa prioridade com os demais.
    const projeto = await prisma.projeto.findFirst({
      where: { id: projetoId, ativo: true },
      select: { id: true },
    })
    if (!projeto) return { erroGeral: 'Projeto não encontrado ou excluído.' }

    const dados = { ...validacao.dados, avaliadoPor: userId }

    await prisma.avaliacaoProjeto.upsert({
      where: { projetoId },
      create: { projetoId, ...dados },
      update: dados,
    })
  } catch (erro) {
    console.error('Falha ao salvar avaliação', erro)
    return { erroGeral: 'Não foi possível salvar a avaliação. Tente novamente.' }
  }

  revalidatePath('/priorizacao')
  revalidatePath(`/priorizacao/${projetoId}`)
  return { salvo: { projetoId } }
}

export type EstadoFormularioPesos = {
  salvo?: true
  erros?: ErrosPesos
  erroGeral?: string
}

/**
 * Grava os pesos dos critérios.
 *
 * Os dez são gravados numa transação: pesos pela metade deixariam um grupo sem
 * somar 100 e todo ranking calculado nesse intervalo sairia errado.
 */
export async function salvarPesos(
  _estadoAnterior: EstadoFormularioPesos,
  formData: FormData,
): Promise<EstadoFormularioPesos> {
  const { userId } = await auth()
  if (!userId) {
    return { erroGeral: 'Sessão expirada. Entre novamente para salvar os pesos.' }
  }

  if (!(await contaPodeAdministrar(userId))) return { erroGeral: MENSAGEM_SEM_PERMISSAO }

  const validacao = validarPesos(formData)
  if (!validacao.ok) return { erros: validacao.erros }

  try {
    await prisma.$transaction(
      CRITERIOS.map((criterio) => {
        const peso = validacao.dados[criterio.id]
        return prisma.pesoCriterio.upsert({
          where: { criterio: criterio.id },
          create: { criterio: criterio.id, peso },
          update: { peso },
        })
      }),
    )
  } catch (erro) {
    console.error('Falha ao salvar pesos', erro)
    return { erroGeral: 'Não foi possível salvar os pesos. Tente novamente.' }
  }

  // Os pesos mudam o ranking inteiro, não só uma linha.
  revalidatePath('/priorizacao')
  revalidatePath('/priorizacao/pesos')
  return { salvo: true }
}
