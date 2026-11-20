'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { registrarFalha } from '@/lib/registrar-erro'
import { bloqueioParaGravar } from '@/lib/dependencia-servidor'
import { prisma } from '@/lib/prisma'
import { contaPodeEditar } from '@/lib/administracao-servidor'
import { MENSAGEM_SOMENTE_LEITURA } from '@/lib/administracao'
import { lerIdProjeto } from '@/lib/projeto-edicao'
import {
  ehColisaoDeNumero,
  lerIdAcao,
  lerResponsavelId,
  proximoNumero,
  TENTATIVAS_NUMERO,
  validarDadosAcao,
  type ErrosAcao,
  type StatusAcao,
} from '@/lib/acao-validacao'
import { validarRealizado, type ErrosRealizado } from '@/lib/acao-realizado'
import {
  avisarResponsavel,
  conferirResponsavel,
  estadoAuditado,
  lerVersao,
  MENSAGEM_CONFLITO_EDICAO,
  MENSAGEM_RESPONSAVEL_INVALIDO,
  SELECAO_AUDITADA,
} from '@/lib/acao-apoio'
import {
  ConflitoDeEdicao,
  gravarAcaoComHistorico,
} from '@/lib/acao-historico'

export type EstadoFormularioAcao = {
  /** Preenchido só no sucesso — a UI confirma sem sair da tela. */
  criada?: { id: string; numero: number; descricao: string }
  /** Preenchido só no sucesso da edição. */
  salva?: { id: string; numero: number; descricao: string; versao?: string }
  erros?: ErrosAcao
  /** Erro que não pertence a um campo específico (falha de banco, sessão). */
  erroGeral?: string
  /** O que aconteceu com o aviso por e-mail ao responsável, quando houve um. */
  aviso?: string
  /** A edição não foi gravada porque outra pessoa alterou a ação antes. */
  conflito?: boolean
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
  if (!(await contaPodeEditar(userId))) return { erroGeral: MENSAGEM_SOMENTE_LEITURA }

  const projetoId = lerIdProjeto(formData)
  if (!projetoId) return { erroGeral: 'Projeto não identificado. Recarregue a página.' }

  const validacao = validarDadosAcao(formData)
  if (!validacao.ok) return { erros: validacao.erros }

  const responsavelId = lerResponsavelId(formData)

  let criada: { id: string; numero: number } | null = null
  let responsavelAviso: { nome: string; email: string | null } | null = null
  let projetoAviso: { id: string; nome: string; referencia: string | null } | null = null
  try {
    const responsavel = await conferirResponsavel(responsavelId)
    if (!responsavel.ok) return { erros: { responsavelId: MENSAGEM_RESPONSAVEL_INVALIDO } }
    if (responsavel.nome) responsavelAviso = { nome: responsavel.nome, email: responsavel.email }

    // Ação só entra em projeto ativo: um projeto excluído logicamente não
    // recebe registros novos.
    const projeto = await prisma.projeto.findFirst({
      where: { id: projetoId, ativo: true },
      select: { id: true, nome: true, referencia: true },
    })
    if (!projeto) return { erroGeral: 'Projeto não encontrado ou excluído.' }
    projetoAviso = projeto

    for (let tentativa = 0; tentativa < TENTATIVAS_NUMERO; tentativa += 1) {
      const ultima = await prisma.acao.findFirst({
        where: { projetoId },
        orderBy: { numero: 'desc' },
        select: { numero: true },
      })
      const numero = proximoNumero(ultima?.numero)

      try {
        const acao = await prisma.acao.create({
          data: { projetoId, numero, ...validacao.dados, responsavelId },
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
    await registrarFalha('Falha ao criar ação', erro)
    return { erroGeral: 'Não foi possível salvar a ação. Tente novamente.' }
  }

  if (!criada) {
    return { erroGeral: 'Não foi possível numerar a ação. Tente novamente.' }
  }

  revalidatePath('/projetos')
  revalidatePath(`/projetos/${projetoId}`)

  const aviso =
    responsavelAviso && projetoAviso
      ? await avisarResponsavel({
          motivo: 'NOVA_ACAO',
          responsavel: responsavelAviso,
          acao: { ...criada, ...validacao.dados },
          projeto: projetoAviso,
        })
      : undefined

  return {
    criada: { ...criada, descricao: validacao.dados.descricao },
    ...(aviso ? { aviso } : {}),
  }
}

/**
 * Atualiza uma Ação existente gravando a trilha de auditoria.
 *
 * Toda mudança de `status`, de uma das quatro datas ou do responsável vira
 * linha em `HistoricoAlteracao` (valor antigo, valor novo, quem alterou,
 * quando), na mesma transação do `update` — requisito central do CLAUDE.md.
 * Quem alterou vem do `userId` do Clerk.
 */
export async function atualizarAcao(
  _estadoAnterior: EstadoFormularioAcao,
  formData: FormData,
): Promise<EstadoFormularioAcao> {
  const { userId } = await auth()
  if (!userId) {
    return { erroGeral: 'Sessão expirada. Entre novamente para salvar a ação.' }
  }
  if (!(await contaPodeEditar(userId))) return { erroGeral: MENSAGEM_SOMENTE_LEITURA }

  const acaoId = lerIdAcao(formData)
  if (!acaoId) return { erroGeral: 'Ação não identificada. Recarregue a página.' }

  const validacao = validarDadosAcao(formData)
  if (!validacao.ok) return { erros: validacao.erros }

  let projetoId: string
  try {
    // Ação de projeto excluído logicamente não é editável.
    const atual = await prisma.acao.findFirst({
      where: { id: acaoId, projeto: { ativo: true } },
      select: {
        ...SELECAO_AUDITADA,
        numero: true,
        projetoId: true,
        projeto: { select: { id: true, nome: true, referencia: true } },
      },
    })
    if (!atual) return { erroGeral: 'Ação não encontrada ou projeto excluído.' }

    projetoId = atual.projetoId

    const bloqueio = await bloqueioParaGravar(acaoId, atual, validacao.dados)
    if (bloqueio) return { erros: { status: bloqueio } }

    const responsavelId = lerResponsavelId(formData)
    const responsavel = await conferirResponsavel(responsavelId, atual.responsavelId)
    if (!responsavel.ok) return { erros: { responsavelId: MENSAGEM_RESPONSAVEL_INVALIDO } }

    // Ausente (`undefined`) fica fora dos dois objetos: o Prisma pula a coluna
    // e o histórico não compara o campo — não mexer não é apagar.
    const gravacao = await gravarAcaoComHistorico(prisma, {
      acaoId,
      versaoEsperada: lerVersao(formData),
      atual: estadoAuditado(atual),
      dados: { ...validacao.dados, responsavelId },
      novos:
        responsavel.nome === undefined
          ? validacao.dados
          : { ...validacao.dados, responsavel: responsavel.nome },
      alteradoPor: userId,
    })

    revalidatePath('/projetos')
    revalidatePath(`/projetos/${projetoId}`)

    // Só avisa quem PASSOU a ser responsável. Salvar de novo com a mesma
    // pessoa, ou tirar o responsável, não manda nada.
    const trocou =
      responsavel.nome && responsavelId && responsavelId !== atual.responsavelId
    const aviso = trocou
      ? await avisarResponsavel({
          motivo: 'ATRIBUIDA',
          responsavel: { nome: responsavel.nome!, email: responsavel.email },
          acao: { id: acaoId, numero: atual.numero, ...validacao.dados },
          projeto: atual.projeto,
        })
      : undefined

    return {
      salva: {
        id: acaoId,
        numero: atual.numero,
        descricao: validacao.dados.descricao,
        ...(gravacao.versao ? { versao: gravacao.versao.toISOString() } : {}),
      },
      ...(aviso ? { aviso } : {}),
    }
  } catch (erro) {
    if (erro instanceof ConflitoDeEdicao) {
      return { erroGeral: MENSAGEM_CONFLITO_EDICAO, conflito: true }
    }
    await registrarFalha('Falha ao atualizar ação', erro)
    return { erroGeral: 'Não foi possível salvar a ação. Tente novamente.' }
  }
}

export type EstadoFormularioRealizado = {
  /** Preenchido só no sucesso — a UI confirma o apontamento sem sair da tela. */
  apontada?: {
    id: string
    numero: number
    status: StatusAcao
    /** Campos que entraram em `HistoricoAlteracao` neste apontamento. */
    camposAlterados: string[]
  }
  erros?: ErrosRealizado
  erroGeral?: string
}

/**
 * Registra as datas **Realizado** de uma Ação — fluxo separado de `atualizarAcao`.
 *
 * O apontamento é a operação do dia a dia de quem executa: manda só as duas
 * datas realizadas, nunca reescreve o Previsto (que é o plano contra o qual o
 * Gantt compara) e nem a descrição. O `status` é derivado do apontamento em
 * `validarRealizado`, em vez de ser digitado de novo.
 *
 * A gravação reaproveita `gravarAcaoComHistorico`, então a trilha de auditoria
 * sai idêntica à do fluxo de edição: uma linha por campo alterado, na mesma
 * transação do `update`.
 */
export async function registrarRealizado(
  _estadoAnterior: EstadoFormularioRealizado,
  formData: FormData,
): Promise<EstadoFormularioRealizado> {
  const { userId } = await auth()
  if (!userId) {
    return { erroGeral: 'Sessão expirada. Entre novamente para registrar o realizado.' }
  }
  if (!(await contaPodeEditar(userId))) return { erroGeral: MENSAGEM_SOMENTE_LEITURA }

  const acaoId = lerIdAcao(formData)
  if (!acaoId) return { erroGeral: 'Ação não identificada. Recarregue a página.' }

  try {
    const atual = await prisma.acao.findFirst({
      where: { id: acaoId, projeto: { ativo: true } },
      select: { ...SELECAO_AUDITADA, numero: true, projetoId: true },
    })
    if (!atual) return { erroGeral: 'Ação não encontrada ou projeto excluído.' }

    const validacao = validarRealizado(formData, atual)
    if (!validacao.ok) return { erros: validacao.erros }

    const bloqueio = await bloqueioParaGravar(acaoId, atual, validacao.dados)
    if (bloqueio) return { erroGeral: bloqueio }

    const { alteracoes } = await gravarAcaoComHistorico(prisma, {
      acaoId,
      atual: estadoAuditado(atual),
      dados: validacao.dados,
      alteradoPor: userId,
    })

    revalidatePath('/projetos')
    revalidatePath(`/projetos/${atual.projetoId}`)
    return {
      apontada: {
        id: acaoId,
        numero: atual.numero,
        status: validacao.dados.status,
        camposAlterados: alteracoes.map((linha) => linha.campo),
      },
    }
  } catch (erro) {
    await registrarFalha('Falha ao registrar realizado da ação', erro)
    return { erroGeral: 'Não foi possível registrar o realizado. Tente novamente.' }
  }
}
