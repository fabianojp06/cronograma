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
  lerClassificacaoDoModelo,
  lerDadosDoModelo,
  lerItensDoFormulario,
  podeAlterarModelo,
  podeExcluirModelo,
  type ClassificacaoModelo,
  type ErroLinhaModelo,
  type ItemDoModelo,
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

export type EstadoEditorModelo = {
  erro?: string
  /** Erros por linha de ação (1 = primeira linha da tela). */
  erros?: ErroLinhaModelo[]
}

/**
 * Lê o que o editor manda (nome, descrição, classificação e as linhas de
 * ação). Devolve o erro já em forma de estado, ou os dados prontos.
 */
type EditorLido =
  | { estado: EstadoEditorModelo }
  | {
      estado?: undefined
      dados: { nome: string; descricao: string | null }
      classificacao: ClassificacaoModelo
      itens: ItemDoModelo[]
    }

function lerEditor(formData: FormData): EditorLido {
  const dados = lerDadosDoModelo(formData)
  if (!dados.ok) return { estado: { erro: dados.erro } }
  const classificacao = lerClassificacaoDoModelo(formData)
  if (!classificacao.ok) return { estado: { erro: classificacao.erro } }
  const itens = lerItensDoFormulario(formData)
  if (!itens.ok) return { estado: { erro: itens.erroGeral, erros: itens.erros } }
  return { dados, classificacao: classificacao.classificacao, itens: itens.itens }
}

/** Cria um modelo do zero, pelo editor (sem partir de um projeto). */
export async function criarModelo(
  _anterior: EstadoEditorModelo,
  formData: FormData,
): Promise<EstadoEditorModelo> {
  const { userId } = await auth()
  if (!userId) return { erro: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeEditar(userId))) return { erro: MENSAGEM_SOMENTE_LEITURA }

  const lido = lerEditor(formData)
  if (lido.estado) return lido.estado

  let modeloId: string
  try {
    const existente = await prisma.modeloProjeto.findUnique({
      where: { nome: lido.dados.nome },
      select: { id: true },
    })
    if (existente) return { erro: 'Já existe um modelo com esse nome. Escolha outro.' }

    const modelo = await prisma.modeloProjeto.create({
      data: {
        nome: lido.dados.nome,
        descricao: lido.dados.descricao,
        ...lido.classificacao,
        criadoPor: userId,
        acoes: { create: lido.itens },
      },
      select: { id: true },
    })
    modeloId = modelo.id
  } catch (erro) {
    await registrarFalha('Falha ao criar o modelo de projeto', erro)
    return { erro: 'Não foi possível salvar o modelo. Tente novamente.' }
  }

  revalidatePath('/modelos')
  redirect(`/modelos?salvo=${modeloId}`)
}

/**
 * Edita um modelo: dados, classificação e a lista de ações, que é SUBSTITUÍDA
 * por inteiro, tudo numa transação. Quem edita é quem criou ou um
 * administrador. A edição é conferida por versão (`updatedAt`): se outra
 * pessoa salvou o modelo depois que esta tela abriu, nada é gravado.
 * Projetos já criados com o modelo não mudam (cópia, não vínculo).
 */
export async function atualizarModelo(
  _anterior: EstadoEditorModelo,
  formData: FormData,
): Promise<EstadoEditorModelo> {
  const { userId } = await auth()
  if (!userId) return { erro: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeEditar(userId))) return { erro: MENSAGEM_SOMENTE_LEITURA }

  const modeloId = String(formData.get('modeloId') ?? '')
  if (!modeloId) return { erro: 'Modelo não identificado. Recarregue a página.' }

  const lido = lerEditor(formData)
  if (lido.estado) return lido.estado

  const versaoBruta = String(formData.get('versao') ?? '')
  const versao = versaoBruta === '' ? null : new Date(versaoBruta)

  try {
    const atual = await prisma.modeloProjeto.findUnique({
      where: { id: modeloId },
      select: { id: true, criadoPor: true },
    })
    if (!atual) return { erro: 'Modelo não encontrado. Ele pode ter sido excluído.' }
    const administrador = await contaPodeAdministrar(userId)
    if (!podeAlterarModelo(atual.criadoPor, userId, administrador)) {
      return { erro: 'Só quem criou o modelo, ou um administrador, pode editá-lo.' }
    }

    const outro = await prisma.modeloProjeto.findUnique({
      where: { nome: lido.dados.nome },
      select: { id: true },
    })
    if (outro && outro.id !== modeloId) return { erro: 'Já existe um modelo com esse nome. Escolha outro.' }

    const gravado = await prisma.$transaction(async (tx) => {
      const { count } = await tx.modeloProjeto.updateMany({
        where: { id: modeloId, ...(versao && !Number.isNaN(versao.getTime()) ? { updatedAt: versao } : {}) },
        data: { nome: lido.dados.nome, descricao: lido.dados.descricao, ...lido.classificacao },
      })
      if (count === 0) return false
      await tx.modeloAcao.deleteMany({ where: { modeloId } })
      await tx.modeloAcao.createMany({ data: lido.itens.map((i) => ({ ...i, modeloId })) })
      return true
    })
    if (!gravado) {
      return { erro: 'O modelo foi alterado por outra pessoa depois que você abriu esta tela. Recarregue e refaça a edição.' }
    }
  } catch (erro) {
    await registrarFalha('Falha ao editar o modelo de projeto', erro)
    return { erro: 'Não foi possível salvar o modelo. Tente novamente.' }
  }

  revalidatePath('/modelos')
  redirect(`/modelos?salvo=${modeloId}`)
}
