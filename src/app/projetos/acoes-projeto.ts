'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { MENSAGEM_SEM_PERMISSAO } from '@/lib/administracao'
import { contaPodeAdministrar } from '@/lib/administracao-servidor'
import { registrarFalha } from '@/lib/registrar-erro'
import { prisma } from '@/lib/prisma'
import {
  confirmacaoValida,
  DADOS_EXCLUSAO_LOGICA,
  PALAVRA_CONFIRMACAO,
} from '@/lib/projeto-exclusao'
import { CAMPOS_PROJETO, camposAlterados, lerIdProjeto } from '@/lib/projeto-edicao'
import { validarDadosProjeto, type ErrosProjeto } from '@/lib/projeto-validacao'

export type EstadoFormularioProjeto = {
  /** Preenchido só no sucesso — a UI confirma a criação sem sair da tela. */
  criado?: { id: string; nome: string }
  /** Preenchido só no sucesso da edição. */
  salvo?: { id: string; nome: string }
  erros?: ErrosProjeto
  /** Erro que não pertence a um campo específico (falha de banco, sessão). */
  erroGeral?: string
}

/**
 * Cria um Projeto a partir do formulário (artboard `E-FormularioProjeto`).
 *
 * Nome é o único campo obrigatório; os demais seguem o SCHEMA.md e ficam nulos
 * quando não preenchidos. A listagem (`/projetos`) é revalidada no sucesso; o
 * redirecionamento para o detalhe entra junto com a tela de detalhe (Bloco 4).
 */
export async function criarProjeto(
  _estadoAnterior: EstadoFormularioProjeto,
  formData: FormData,
): Promise<EstadoFormularioProjeto> {
  const { userId } = await auth()
  if (!userId) {
    return { erroGeral: 'Sessão expirada. Entre novamente para criar o projeto.' }
  }

  const validacao = validarDadosProjeto(formData)
  if (!validacao.ok) return { erros: validacao.erros }

  let id: string
  try {
    const projeto = await prisma.projeto.create({
      data: validacao.dados,
      select: { id: true },
    })
    id = projeto.id
  } catch (erro) {
    await registrarFalha('Falha ao criar projeto', erro)
    return { erroGeral: 'Não foi possível salvar o projeto. Tente novamente.' }
  }

  revalidatePath('/projetos')
  return { criado: { id, nome: validacao.dados.nome } }
}

/** `select` do Prisma com exatamente os campos editáveis do Projeto. */
const SELECAO_CAMPOS = Object.fromEntries(
  CAMPOS_PROJETO.map((campo) => [campo, true]),
) as { [C in (typeof CAMPOS_PROJETO)[number]]: true }

/**
 * Atualiza um Projeto existente (mesmo formulário da criação, com o `id` em
 * campo oculto). Se nenhum campo mudou, não grava nem revalida — devolve o
 * estado de sucesso mesmo assim, para a UI confirmar sem ruído.
 */
export async function atualizarProjeto(
  _estadoAnterior: EstadoFormularioProjeto,
  formData: FormData,
): Promise<EstadoFormularioProjeto> {
  const { userId } = await auth()
  if (!userId) {
    return { erroGeral: 'Sessão expirada. Entre novamente para salvar o projeto.' }
  }

  const id = lerIdProjeto(formData)
  if (!id) return { erroGeral: 'Projeto não identificado. Recarregue a página.' }

  const validacao = validarDadosProjeto(formData)
  if (!validacao.ok) return { erros: validacao.erros }

  try {
    const atual = await prisma.projeto.findFirst({
      where: { id, ativo: true },
      select: SELECAO_CAMPOS,
    })
    if (!atual) {
      return { erroGeral: 'Projeto não encontrado ou excluído.' }
    }

    if (camposAlterados(atual, validacao.dados).length > 0) {
      await prisma.projeto.update({ where: { id }, data: validacao.dados })
      revalidatePath('/projetos')
      revalidatePath(`/projetos/${id}`)
    }
  } catch (erro) {
    await registrarFalha('Falha ao atualizar projeto', erro)
    return { erroGeral: 'Não foi possível salvar o projeto. Tente novamente.' }
  }

  return { salvo: { id, nome: validacao.dados.nome } }
}

export type EstadoExclusaoProjeto = {
  erroGeral?: string
}

/**
 * Exclusão **lógica** de um Projeto: grava `ativo = false` e nunca apaga a
 * linha. As Ações e o `HistoricoAlteracao` do projeto continuam no banco —
 * são a trilha de auditoria exigida pelo CLAUDE.md.
 *
 * Exige a palavra de confirmação digitada pelo usuário (ver
 * `projeto-exclusao.ts`). No sucesso, redireciona para a listagem: a tela de
 * edição deixa de existir para um projeto inativo.
 */
export async function excluirProjeto(
  _estadoAnterior: EstadoExclusaoProjeto,
  formData: FormData,
): Promise<EstadoExclusaoProjeto> {
  const { userId } = await auth()
  if (!userId) {
    return { erroGeral: 'Sessão expirada. Entre novamente para excluir o projeto.' }
  }

  if (!(await contaPodeAdministrar(userId))) return { erroGeral: MENSAGEM_SEM_PERMISSAO }

  const id = lerIdProjeto(formData)
  if (!id) return { erroGeral: 'Projeto não identificado. Recarregue a página.' }

  if (!confirmacaoValida(formData)) {
    return {
      erroGeral: `Digite ${PALAVRA_CONFIRMACAO} para confirmar a exclusão do projeto.`,
    }
  }

  try {
    // `updateMany` com `ativo: true` no filtro: excluir de novo não é erro de
    // banco, é simplesmente nenhuma linha afetada.
    const { count } = await prisma.projeto.updateMany({
      where: { id, ativo: true },
      data: DADOS_EXCLUSAO_LOGICA,
    })
    if (count === 0) {
      return { erroGeral: 'Projeto não encontrado ou já excluído.' }
    }
  } catch (erro) {
    await registrarFalha('Falha ao excluir projeto', erro)
    return { erroGeral: 'Não foi possível excluir o projeto. Tente novamente.' }
  }

  revalidatePath('/projetos')
  revalidatePath(`/projetos/${id}`)
  redirect('/projetos')
}
