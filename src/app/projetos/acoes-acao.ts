'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { lerIdProjeto } from '@/lib/projeto-edicao'
import {
  proximoNumero,
  validarDadosAcao,
  type ErrosAcao,
} from '@/lib/acao-validacao'

export type EstadoFormularioAcao = {
  /** Preenchido só no sucesso — a UI confirma sem sair da tela. */
  criada?: { id: string; numero: number; descricao: string }
  erros?: ErrosAcao
  /** Erro que não pertence a um campo específico (falha de banco, sessão). */
  erroGeral?: string
}

/** Número máximo de tentativas quando duas criações concorrem pelo mesmo número. */
const TENTATIVAS_NUMERO = 5

function ehColisaoDeNumero(erro: unknown): boolean {
  return (
    typeof erro === 'object' &&
    erro !== null &&
    (erro as { code?: string }).code === 'P2002'
  )
}

/**
 * Cria uma Ação vinculada a um Projeto (artboard `F-FormularioAcao`).
 *
 * O `numero` é sequencial **dentro do projeto**: vem do maior número existente
 * + 1. Como dois usuários podem criar ações ao mesmo tempo, a constraint
 * `@@unique([projetoId, numero])` é a autoridade — na colisão (`P2002`) a
 * gravação é refeita com o número recalculado, em vez de devolver erro.
 */
export async function criarAcao(
  _estadoAnterior: EstadoFormularioAcao,
  formData: FormData,
): Promise<EstadoFormularioAcao> {
  const { userId } = await auth()
  if (!userId) {
    return { erroGeral: 'Sessão expirada. Entre novamente para criar a ação.' }
  }

  const projetoId = lerIdProjeto(formData)
  if (!projetoId) return { erroGeral: 'Projeto não identificado. Recarregue a página.' }

  const validacao = validarDadosAcao(formData)
  if (!validacao.ok) return { erros: validacao.erros }

  let criada: { id: string; numero: number } | null = null
  try {
    // Ação só entra em projeto ativo: um projeto excluído logicamente não
    // recebe registros novos.
    const projeto = await prisma.projeto.findFirst({
      where: { id: projetoId, ativo: true },
      select: { id: true },
    })
    if (!projeto) return { erroGeral: 'Projeto não encontrado ou excluído.' }

    for (let tentativa = 0; tentativa < TENTATIVAS_NUMERO; tentativa += 1) {
      const ultima = await prisma.acao.findFirst({
        where: { projetoId },
        orderBy: { numero: 'desc' },
        select: { numero: true },
      })
      const numero = proximoNumero(ultima?.numero)

      try {
        const acao = await prisma.acao.create({
          data: { projetoId, numero, ...validacao.dados },
          select: { id: true, numero: true },
        })
        criada = acao
        break
      } catch (erro) {
        if (!ehColisaoDeNumero(erro)) throw erro
        // Outra criação levou este número; recalcula e tenta de novo.
      }
    }
  } catch (erro) {
    console.error('Falha ao criar ação', erro)
    return { erroGeral: 'Não foi possível salvar a ação. Tente novamente.' }
  }

  if (!criada) {
    return { erroGeral: 'Não foi possível numerar a ação. Tente novamente.' }
  }

  revalidatePath('/projetos')
  revalidatePath(`/projetos/${projetoId}`)
  return {
    criada: { ...criada, descricao: validacao.dados.descricao },
  }
}
