'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import type { Prisma } from '../../generated/prisma/client'
import { MENSAGEM_SOMENTE_LEITURA } from '@/lib/administracao'
import { contaPodeEditar } from '@/lib/administracao-servidor'
import { fasesDmaicQueFaltam } from '@/lib/dmaic'
import { MAXIMO_MACROETAPAS, podeCriarMais, validarDescricaoMacroetapa, validarNomeMacroetapa } from '@/lib/macroetapa'
import { prisma } from '@/lib/prisma'
import { registrarFalha } from '@/lib/registrar-erro'

export type EstadoMacroetapa = { ok?: boolean; mensagem?: string }

const texto = (f: FormData, campo: string) => {
  const v = f.get(campo)
  return typeof v === 'string' ? v : ''
}
/** `null` quando o formulário não traz o campo (diferente de vazio). */
const textoOuNulo = (f: FormData, campo: string) => {
  const v = f.get(campo)
  return typeof v === 'string' ? v : null
}

/** Sessão + permissão de edição + projeto ativo. Devolve o userId ou o estado de recusa. */
async function autorizar(projetoId: string): Promise<{ userId: string } | { recusa: EstadoMacroetapa }> {
  const { userId } = await auth()
  if (!userId) return { recusa: { ok: false, mensagem: 'Sessão expirada. Entre novamente.' } }
  if (!(await contaPodeEditar(userId))) return { recusa: { ok: false, mensagem: MENSAGEM_SOMENTE_LEITURA } }
  if (projetoId === '') return { recusa: { ok: false, mensagem: 'Projeto não identificado. Recarregue a página.' } }
  const projeto = await prisma.projeto.findFirst({ where: { id: projetoId, ativo: true }, select: { id: true } })
  if (!projeto) return { recusa: { ok: false, mensagem: 'Projeto não encontrado ou excluído.' } }
  return { userId }
}

/** Serializa as mudanças de macroetapa de um mesmo projeto até o fim da transação. */
async function travarProjeto(tx: Prisma.TransactionClient, projetoId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'macroetapa:' + projetoId}))`
}

const JA_EXISTE: EstadoMacroetapa = { ok: false, mensagem: 'Já existe uma macroetapa com esse nome neste projeto.' }
const ehNomeRepetido = (erro: unknown) => (erro as { code?: string } | null)?.code === 'P2002'

const atualizar = (projetoId: string) => revalidatePath(`/projetos/${projetoId}`)
const FALHA: EstadoMacroetapa = { ok: false, mensagem: 'Não foi possível concluir. Tente novamente.' }
const NAO_ENCONTRADA: EstadoMacroetapa = { ok: false, mensagem: 'Macroetapa não encontrada neste projeto.' }

/** Acrescenta uma macroetapa ao fim da lista do projeto. */
export async function criarMacroetapa(_anterior: EstadoMacroetapa, formData: FormData): Promise<EstadoMacroetapa> {
  const projetoId = texto(formData, 'projetoId')
  const acesso = await autorizar(projetoId)
  if ('recusa' in acesso) return acesso.recusa

  try {
    const resultado = await prisma.$transaction(async (tx): Promise<EstadoMacroetapa> => {
      await travarProjeto(tx, projetoId)
      const existentes = await tx.macroetapa.findMany({ where: { projetoId }, select: { id: true, nome: true, ordem: true } })
      if (!podeCriarMais(existentes.length)) {
        return { ok: false, mensagem: 'O projeto já tem o máximo de 12 macroetapas.' }
      }
      const nome = validarNomeMacroetapa(texto(formData, 'nome'), existentes)
      if (!nome.ok) return { ok: false, mensagem: nome.erro }
      const descricao = validarDescricaoMacroetapa(textoOuNulo(formData, 'descricao'))
      if (!descricao.ok) return { ok: false, mensagem: descricao.erro }
      const ordem = existentes.reduce((maior, m) => Math.max(maior, m.ordem), 0) + 1
      await tx.macroetapa.create({ data: { projetoId, nome: nome.nome, ordem, descricao: descricao.descricao ?? null } })
      return { ok: true, mensagem: 'Macroetapa criada.' }
    })
    if (resultado.ok) atualizar(projetoId)
    return resultado
  } catch (erro) {
    if (ehNomeRepetido(erro)) return JA_EXISTE
    await registrarFalha('Falha ao criar macroetapa', erro)
    return FALHA
  }
}

/** Renomeia (`id`) uma macroetapa do projeto. */
export async function renomearMacroetapa(_anterior: EstadoMacroetapa, formData: FormData): Promise<EstadoMacroetapa> {
  const projetoId = texto(formData, 'projetoId')
  const id = texto(formData, 'id')
  const acesso = await autorizar(projetoId)
  if ('recusa' in acesso) return acesso.recusa

  try {
    const resultado = await prisma.$transaction(async (tx): Promise<EstadoMacroetapa> => {
      await travarProjeto(tx, projetoId)
      const existentes = await tx.macroetapa.findMany({ where: { projetoId }, select: { id: true, nome: true } })
      if (!existentes.some((m) => m.id === id)) return NAO_ENCONTRADA
      const nome = validarNomeMacroetapa(texto(formData, 'nome'), existentes, id)
      if (!nome.ok) return { ok: false, mensagem: nome.erro }
      const descricao = validarDescricaoMacroetapa(textoOuNulo(formData, 'descricao'))
      if (!descricao.ok) return { ok: false, mensagem: descricao.erro }
      const { count } = await tx.macroetapa.updateMany({
        where: { id, projetoId },
        data: { nome: nome.nome, descricao: descricao.descricao },
      })
      if (count === 0) return NAO_ENCONTRADA
      return { ok: true, mensagem: 'Macroetapa renomeada.' }
    })
    if (resultado.ok) atualizar(projetoId)
    return resultado
  } catch (erro) {
    if (ehNomeRepetido(erro)) return JA_EXISTE
    await registrarFalha('Falha ao renomear macroetapa', erro)
    return FALHA
  }
}

/**
 * Aplica o modelo DMAIC (opcional): cria, ao fim da lista, as fases que o projeto ainda
 * não tem, com a descrição de cada uma. Não mexe nas macroetapas existentes. Se não
 * couberem todas no limite, não cria nenhuma (um DMAIC pela metade confunde).
 */
export async function aplicarModeloDmaic(_anterior: EstadoMacroetapa, formData: FormData): Promise<EstadoMacroetapa> {
  const projetoId = texto(formData, 'projetoId')
  const acesso = await autorizar(projetoId)
  if ('recusa' in acesso) return acesso.recusa

  try {
    const resultado = await prisma.$transaction(async (tx): Promise<EstadoMacroetapa> => {
      await travarProjeto(tx, projetoId)
      const existentes = await tx.macroetapa.findMany({ where: { projetoId }, select: { nome: true, ordem: true } })
      const faltam = fasesDmaicQueFaltam(existentes)
      if (faltam.length === 0) return { ok: false, mensagem: 'O projeto já tem as cinco fases do DMAIC.' }
      if (existentes.length + faltam.length > MAXIMO_MACROETAPAS) {
        const vagas = MAXIMO_MACROETAPAS - existentes.length
        return {
          ok: false,
          mensagem: `Faltam ${faltam.length} fases do DMAIC e só há ${vagas} ${vagas === 1 ? 'vaga' : 'vagas'} (limite de ${MAXIMO_MACROETAPAS} macroetapas). Exclua alguma macroetapa e tente de novo.`,
        }
      }
      let ordem = existentes.reduce((maior, m) => Math.max(maior, m.ordem), 0)
      for (const f of faltam) {
        ordem += 1
        await tx.macroetapa.create({ data: { projetoId, nome: f.nome, descricao: f.descricao, ordem } })
      }
      return { ok: true, mensagem: `${faltam.length === 5 ? 'Fases do DMAIC criadas' : `${faltam.length} ${faltam.length === 1 ? 'fase criada' : 'fases criadas'}`}.` }
    })
    if (resultado.ok) atualizar(projetoId)
    return resultado
  } catch (erro) {
    if (ehNomeRepetido(erro)) return JA_EXISTE
    await registrarFalha('Falha ao aplicar o modelo DMAIC', erro)
    return FALHA
  }
}

/** Troca a posição com a vizinha (`intencao` = subir | descer). */
export async function reordenarMacroetapa(_anterior: EstadoMacroetapa, formData: FormData): Promise<EstadoMacroetapa> {
  const projetoId = texto(formData, 'projetoId')
  const id = texto(formData, 'id')
  const intencao = texto(formData, 'intencao')
  const acesso = await autorizar(projetoId)
  if ('recusa' in acesso) return acesso.recusa
  if (intencao !== 'subir' && intencao !== 'descer') return { ok: false, mensagem: 'Movimento inválido.' }

  try {
    const trocou = await prisma.$transaction(async (tx) => {
      await travarProjeto(tx, projetoId)
      const lista = await tx.macroetapa.findMany({
        where: { projetoId },
        orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, ordem: true },
      })
      const i = lista.findIndex((m) => m.id === id)
      if (i < 0) return null
      const j = intencao === 'subir' ? i - 1 : i + 1
      if (j < 0 || j >= lista.length) return false
      // Ordens iguais (dados antigos) trocariam por nada: renumera a vizinhança.
      const a = lista[i]
      const b = lista[j]
      const ordemA = a.ordem === b.ordem ? (intencao === 'subir' ? b.ordem : b.ordem + 1) : b.ordem
      const ordemB = a.ordem === b.ordem ? (intencao === 'subir' ? a.ordem + 1 : a.ordem) : a.ordem
      await tx.macroetapa.updateMany({ where: { id: a.id, projetoId }, data: { ordem: ordemA } })
      await tx.macroetapa.updateMany({ where: { id: b.id, projetoId }, data: { ordem: ordemB } })
      return true
    })
    if (trocou === null) return NAO_ENCONTRADA
    if (trocou) atualizar(projetoId)
    return { ok: true, mensagem: trocou ? 'Ordem atualizada.' : 'Já está no limite da lista.' }
  } catch (erro) {
    await registrarFalha('Falha ao reordenar macroetapa', erro)
    return FALHA
  }
}

/** Exclui a macroetapa; as ações ficam sem macroetapa e cada uma ganha uma linha de histórico. */
export async function excluirMacroetapa(_anterior: EstadoMacroetapa, formData: FormData): Promise<EstadoMacroetapa> {
  const projetoId = texto(formData, 'projetoId')
  const id = texto(formData, 'id')
  const acesso = await autorizar(projetoId)
  if ('recusa' in acesso) return acesso.recusa

  try {
    const excluida = await prisma.$transaction(async (tx) => {
      await travarProjeto(tx, projetoId)
      const macro = await tx.macroetapa.findFirst({ where: { id, projetoId }, select: { nome: true } })
      if (!macro) return null
      const acoes = await tx.acao.findMany({ where: { macroetapaId: id, projetoId }, select: { id: true } })
      if (acoes.length > 0) {
        await tx.historicoAlteracao.createMany({
          data: acoes.map((a) => ({
            acaoId: a.id,
            campo: 'macroetapa',
            valorAntigo: macro.nome,
            valorNovo: null,
            alteradoPor: acesso.userId,
          })),
        })
      }
      await tx.macroetapa.deleteMany({ where: { id, projetoId } })
      return acoes.length
    })
    if (excluida === null) return NAO_ENCONTRADA
    atualizar(projetoId)
    return {
      ok: true,
      mensagem: excluida === 0 ? 'Macroetapa excluída.' : `Macroetapa excluída; ${excluida} ${excluida === 1 ? 'ação ficou' : 'ações ficaram'} sem macroetapa.`,
    }
  } catch (erro) {
    await registrarFalha('Falha ao excluir macroetapa', erro)
    return FALHA
  }
}
