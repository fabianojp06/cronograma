'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { MENSAGEM_SOMENTE_LEITURA } from '@/lib/administracao'
import { contaPodeAdministrar, contaPodeEditar } from '@/lib/administracao-servidor'
import { lerDataISO } from '@/lib/acao-validacao'
import {
  construirItensDoModelo,
  instanciarModelo,
  LIMITE_ACOES_MODELO,
  lerDadosDoModelo,
  podeExcluirModelo,
} from '@/lib/modelo-projeto'
import { lerIdProjeto } from '@/lib/projeto-edicao'
import { validarDadosProjeto, type ErrosProjeto } from '@/lib/projeto-validacao'
import { prisma } from '@/lib/prisma'
import { registrarFalha } from '@/lib/registrar-erro'

export type EstadoSalvarModelo = { erro?: string }

/** Guarda o projeto como modelo: classificação + ações com datas relativas. */
export async function salvarComoModelo(
  _anterior: EstadoSalvarModelo,
  formData: FormData,
): Promise<EstadoSalvarModelo> {
  const { userId } = await auth()
  if (!userId) return { erro: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeEditar(userId))) return { erro: MENSAGEM_SOMENTE_LEITURA }

  const projetoId = lerIdProjeto(formData)
  if (!projetoId) return { erro: 'Projeto não identificado. Recarregue a página.' }
  const dados = lerDadosDoModelo(formData)
  if (!dados.ok) return { erro: dados.erro }

  let modeloId: string
  try {
    const projeto = await prisma.projeto.findFirst({
      where: { id: projetoId, ativo: true },
      select: {
        equipe: true,
        natureza: true,
        categoria: true,
        apoio: true,
        setorEnvolvido: true,
        acoes: {
          orderBy: { numero: 'asc' },
          select: { numero: true, descricao: true, previstoInicio: true, previstoTermino: true },
        },
      },
    })
    if (!projeto) return { erro: 'Projeto não encontrado ou excluído.' }
    if (projeto.acoes.length === 0) {
      return { erro: 'Este projeto não tem ações: um modelo sem ações não ajuda em nada.' }
    }
    if (projeto.acoes.length > LIMITE_ACOES_MODELO) {
      return { erro: `O modelo guarda até ${LIMITE_ACOES_MODELO} ações; este projeto tem ${projeto.acoes.length}.` }
    }

    const existente = await prisma.modeloProjeto.findUnique({
      where: { nome: dados.nome },
      select: { id: true },
    })
    if (existente) return { erro: 'Já existe um modelo com esse nome. Escolha outro.' }

    const itens = construirItensDoModelo(projeto.acoes)
    const modelo = await prisma.modeloProjeto.create({
      data: {
        nome: dados.nome,
        descricao: dados.descricao,
        equipe: projeto.equipe,
        natureza: projeto.natureza,
        categoria: projeto.categoria,
        apoio: projeto.apoio,
        setorEnvolvido: projeto.setorEnvolvido,
        criadoPor: userId,
        acoes: { create: itens },
      },
      select: { id: true },
    })
    modeloId = modelo.id
  } catch (erro) {
    await registrarFalha('Falha ao salvar o modelo de projeto', erro)
    return { erro: 'Não foi possível salvar o modelo. Tente novamente.' }
  }

  revalidatePath('/modelos')
  redirect(`/modelos?salvo=${modeloId}`)
}

export type EstadoUsarModelo = {
  erros?: ErrosProjeto & { inicio?: string }
  erroGeral?: string
}

/** Cria o projeto e as ações a partir do modelo, numa transação só. */
export async function criarProjetoDeModelo(
  _anterior: EstadoUsarModelo,
  formData: FormData,
): Promise<EstadoUsarModelo> {
  const { userId } = await auth()
  if (!userId) return { erroGeral: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeEditar(userId))) return { erroGeral: MENSAGEM_SOMENTE_LEITURA }

  const modeloId = String(formData.get('modeloId') ?? '')
  if (!modeloId) return { erroGeral: 'Modelo não identificado. Recarregue a página.' }

  const validacao = validarDadosProjeto(formData)
  const bruto = String(formData.get('inicio') ?? '').trim()
  const inicio = bruto === '' ? undefined : lerDataISO(bruto)
  const erros: EstadoUsarModelo['erros'] = validacao.ok ? {} : { ...validacao.erros }
  if (!inicio) erros.inicio = bruto === '' ? 'Informe a data de início do projeto.' : 'Data inválida.'
  if (Object.keys(erros).length > 0 || !validacao.ok || !inicio) return { erros }

  let projetoId: string
  try {
    const modelo = await prisma.modeloProjeto.findUnique({
      where: { id: modeloId },
      select: {
        acoes: {
          orderBy: { ordem: 'asc' },
          select: { ordem: true, descricao: true, inicioDiasUteis: true, duracaoDiasUteis: true },
        },
      },
    })
    if (!modelo) return { erroGeral: 'Modelo não encontrado. Ele pode ter sido excluído.' }

    const acoes = instanciarModelo(modelo.acoes, inicio)
    const projeto = await prisma.projeto.create({
      data: {
        ...validacao.dados,
        acoes: { create: acoes },
      },
      select: { id: true },
    })
    projetoId = projeto.id
  } catch (erro) {
    await registrarFalha('Falha ao criar projeto a partir do modelo', erro)
    return { erroGeral: 'Não foi possível criar o projeto. Nada foi salvo. Tente novamente.' }
  }

  revalidatePath('/projetos')
  redirect(`/projetos/${projetoId}`)
}

/** Exclui um modelo (os projetos já criados com ele não mudam). */
export async function excluirModelo(formData: FormData): Promise<void> {
  const { userId } = await auth()
  if (!userId) return
  if (!(await contaPodeEditar(userId))) return

  const id = formData.get('modeloId')
  if (typeof id !== 'string' || id === '') return

  try {
    const modelo = await prisma.modeloProjeto.findUnique({
      where: { id },
      select: { id: true, criadoPor: true },
    })
    if (!modelo) return
    const administrador = await contaPodeAdministrar(userId)
    if (!podeExcluirModelo(modelo.criadoPor, userId, administrador)) return
    await prisma.modeloProjeto.delete({ where: { id: modelo.id } })
    revalidatePath('/modelos')
  } catch (erro) {
    await registrarFalha('Falha ao excluir o modelo de projeto', erro)
  }
}
