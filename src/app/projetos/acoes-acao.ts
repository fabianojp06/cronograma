'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { lerIdProjeto } from '@/lib/projeto-edicao'
import {
  lerIdAcao,
  proximoNumero,
  validarDadosAcao,
  type ErrosAcao,
} from '@/lib/acao-validacao'
import { CAMPOS_AUDITADOS, gravarAcaoComHistorico } from '@/lib/acao-historico'

export type EstadoFormularioAcao = {
  /** Preenchido só no sucesso — a UI confirma sem sair da tela. */
  criada?: { id: string; numero: number; descricao: string }
  /** Preenchido só no sucesso da edição. */
  salva?: { id: string; numero: number; descricao: string }
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

/** `select` com o estado auditável da Ação — base do "valor antigo". */
const SELECAO_AUDITADA = Object.fromEntries(
  CAMPOS_AUDITADOS.map((campo) => [campo, true]),
) as { [C in (typeof CAMPOS_AUDITADOS)[number]]: true }

/**
 * Atualiza uma Ação existente gravando a trilha de auditoria.
 *
 * Toda mudança de `status` ou de uma das quatro datas vira linha em
 * `HistoricoAlteracao` (valor antigo, valor novo, quem alterou, quando), na
 * mesma transação do `update` — requisito central do CLAUDE.md. Quem alterou
 * vem do `userId` do Clerk.
 */
export async function atualizarAcao(
  _estadoAnterior: EstadoFormularioAcao,
  formData: FormData,
): Promise<EstadoFormularioAcao> {
  const { userId } = await auth()
  if (!userId) {
    return { erroGeral: 'Sessão expirada. Entre novamente para salvar a ação.' }
  }

  const acaoId = lerIdAcao(formData)
  if (!acaoId) return { erroGeral: 'Ação não identificada. Recarregue a página.' }

  const validacao = validarDadosAcao(formData)
  if (!validacao.ok) return { erros: validacao.erros }

  let projetoId: string
  try {
    // Ação de projeto excluído logicamente não é editável.
    const atual = await prisma.acao.findFirst({
      where: { id: acaoId, projeto: { ativo: true } },
      select: { ...SELECAO_AUDITADA, numero: true, projetoId: true },
    })
    if (!atual) return { erroGeral: 'Ação não encontrada ou projeto excluído.' }

    projetoId = atual.projetoId

    await gravarAcaoComHistorico(prisma, {
      acaoId,
      atual,
      dados: validacao.dados,
      alteradoPor: userId,
    })

    revalidatePath('/projetos')
    revalidatePath(`/projetos/${projetoId}`)
    return {
      salva: { id: acaoId, numero: atual.numero, descricao: validacao.dados.descricao },
    }
  } catch (erro) {
    console.error('Falha ao atualizar ação', erro)
    return { erroGeral: 'Não foi possível salvar a ação. Tente novamente.' }
  }
}
