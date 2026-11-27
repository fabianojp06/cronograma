'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { MENSAGEM_SEM_PERMISSAO } from '@/lib/administracao'
import { contaPodeAdministrar, contaPodeEditar } from '@/lib/administracao-servidor'
import { registrarFalha } from '@/lib/registrar-erro'
import { prisma } from '@/lib/prisma'
import { MENSAGEM_SOMENTE_LEITURA } from '@/lib/administracao'
import {
  confirmacaoValida,
  dadosDaExclusao,
  dadosDaRestauracao,
  PALAVRA_CONFIRMACAO,
} from '@/lib/projeto-exclusao'
import { CAMPOS_PROJETO, camposAlterados, lerIdProjeto } from '@/lib/projeto-edicao'
import { lerEscolhaLider, resolverLider } from '@/lib/lider-projeto'
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
  if (!(await contaPodeEditar(userId))) return { erroGeral: MENSAGEM_SOMENTE_LEITURA }

  const validacao = validarDadosProjeto(formData, { prioridadeObrigatoria: true })
  if (!validacao.ok) return { erros: validacao.erros }

  let id: string
  try {
    const lider = await resolverLiderDoFormulario(formData, null)
    if (!lider.ok) return { erros: { responsavel: lider.erro } }

    const projeto = await prisma.projeto.create({
      data: lider.alterar
        ? { ...validacao.dados, responsavel: lider.responsavel, liderId: lider.liderId }
        : validacao.dados,
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
const SELECAO_CAMPOS = {
  ...(Object.fromEntries(CAMPOS_PROJETO.map((campo) => [campo, true])) as {
    [C in (typeof CAMPOS_PROJETO)[number]]: true
  }),
  liderId: true,
} as const

/**
 * Lê o líder escolhido na lista e o resolve contra o cadastro. O campo
 * `responsavel` não vem mais do formulário: quando há escolha, o nome é copiado
 * do colaborador (grafia canônica); `ausente`/`manter` não mexem em nada.
 */
async function resolverLiderDoFormulario(formData: FormData, liderIdAtual: string | null) {
  const escolha = lerEscolhaLider(formData)
  const colaborador =
    escolha.tipo === 'colaborador'
      ? await prisma.colaborador.findUnique({
          where: { id: escolha.id },
          select: { id: true, nome: true, ativo: true },
        })
      : null
  return resolverLider(escolha, colaborador, liderIdAtual)
}

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
  if (!(await contaPodeEditar(userId))) return { erroGeral: MENSAGEM_SOMENTE_LEITURA }

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

    const lider = await resolverLiderDoFormulario(formData, atual.liderId)
    if (!lider.ok) return { erros: { responsavel: lider.erro } }

    // O formulário novo não manda o texto do responsável: sem escolha de
    // líder, ele continua o que está gravado (senão "não mexer" viraria apagar).
    const manterTexto = lerEscolhaLider(formData).tipo === 'manter'
    const dados = lider.alterar
      ? { ...validacao.dados, responsavel: lider.responsavel }
      : manterTexto
        ? { ...validacao.dados, responsavel: atual.responsavel }
        : validacao.dados
    const liderMudou = lider.alterar && lider.liderId !== atual.liderId

    if (camposAlterados(atual, dados).length > 0 || liderMudou) {
      await prisma.projeto.update({
        where: { id },
        data: lider.alterar ? { ...dados, liderId: lider.liderId } : dados,
      })
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
      data: dadosDaExclusao(userId),
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

/**
 * Restaura um projeto da lixeira (só administrador). `updateMany` com
 * `ativo: false` no filtro: restaurar de novo, ou um projeto que já voltou, não
 * é erro — é nenhuma linha afetada. As ações, o histórico, os comentários e os
 * riscos nunca saíram do banco, então voltam como estavam.
 */
export async function restaurarProjeto(formData: FormData): Promise<void> {
  const { userId } = await auth()
  if (!userId) return
  if (!(await contaPodeAdministrar(userId))) return

  const id = lerIdProjeto(formData)
  if (!id) return

  let restaurado = false
  try {
    const { count } = await prisma.projeto.updateMany({
      where: { id, ativo: false },
      data: dadosDaRestauracao(userId),
    })
    restaurado = count > 0
  } catch (erro) {
    await registrarFalha('Falha ao restaurar projeto', erro)
    return
  }

  revalidatePath('/administracao/lixeira')
  revalidatePath('/projetos')
  revalidatePath('/')
  redirect(`/administracao/lixeira?${restaurado ? 'restaurado' : 'nada'}=${id}`)
}
