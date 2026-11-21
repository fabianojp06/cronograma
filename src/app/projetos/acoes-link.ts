'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { MENSAGEM_SOMENTE_LEITURA } from '@/lib/administracao'
import { contaPodeEditar } from '@/lib/administracao-servidor'
import { lerIdAcao } from '@/lib/acao-validacao'
import { descreverLinkNoHistorico, validarLink, type ErrosLink } from '@/lib/link-acao'
import { prisma } from '@/lib/prisma'
import { registrarFalha } from '@/lib/registrar-erro'

export type EstadoLink = {
  erros?: ErrosLink
  erro?: string
  /** Quando deu certo: serve de `key` para o formulário recomeçar vazio. */
  feitoEm?: number
}

function atualizar(projetoId: string, acaoId: string) {
  revalidatePath(`/projetos/${projetoId}`)
  revalidatePath(`/projetos/${projetoId}/acoes/${acaoId}/editar`)
}

/** Acrescenta um link à ação (`id` = ação). Entra no histórico da ação. */
export async function adicionarLink(_anterior: EstadoLink, formData: FormData): Promise<EstadoLink> {
  const { userId } = await auth()
  if (!userId) return { erro: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeEditar(userId))) return { erro: MENSAGEM_SOMENTE_LEITURA }

  const acaoId = lerIdAcao(formData)
  if (!acaoId) return { erro: 'Ação não identificada. Recarregue a página.' }
  const validacao = validarLink(formData)
  if (!validacao.ok) return { erros: validacao.erros }

  try {
    const acao = await prisma.acao.findFirst({ where: { id: acaoId, projeto: { ativo: true } }, select: { projetoId: true } })
    if (!acao) return { erro: 'Ação não encontrada ou projeto excluído.' }
    await prisma.$transaction([
      prisma.linkAcao.create({ data: { acaoId, ...validacao.dados, criadoPor: userId } }),
      prisma.historicoAlteracao.create({
        data: { acaoId, campo: 'link', valorAntigo: null, valorNovo: descreverLinkNoHistorico(validacao.dados), alteradoPor: userId },
      }),
    ])
    atualizar(acao.projetoId, acaoId)
    return { feitoEm: Date.now() }
  } catch (erro) {
    await registrarFalha('Falha ao adicionar link da ação', erro)
    return { erro: 'Não foi possível salvar o link. Tente novamente.' }
  }
}

/** Edita um link (`linkId`). Só vai ao histórico se algo mudou. */
export async function atualizarLink(_anterior: EstadoLink, formData: FormData): Promise<EstadoLink> {
  const { userId } = await auth()
  if (!userId) return { erro: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeEditar(userId))) return { erro: MENSAGEM_SOMENTE_LEITURA }

  const linkId = String(formData.get('linkId') ?? '')
  if (!linkId) return { erro: 'Link não identificado. Recarregue a página.' }
  const validacao = validarLink(formData)
  if (!validacao.ok) return { erros: validacao.erros }

  try {
    const atual = await prisma.linkAcao.findFirst({
      where: { id: linkId, acao: { projeto: { ativo: true } } },
      select: { id: true, acaoId: true, titulo: true, url: true, tipo: true, acao: { select: { projetoId: true } } },
    })
    if (!atual) return { erro: 'Link não encontrado ou projeto excluído.' }

    const antes = descreverLinkNoHistorico(atual)
    const depois = descreverLinkNoHistorico(validacao.dados)
    const mudou = atual.titulo !== validacao.dados.titulo || atual.url !== validacao.dados.url || atual.tipo !== validacao.dados.tipo
    if (mudou) {
      await prisma.$transaction([
        prisma.linkAcao.update({ where: { id: linkId }, data: validacao.dados }),
        prisma.historicoAlteracao.create({
          data: { acaoId: atual.acaoId, campo: 'link', valorAntigo: antes, valorNovo: depois, alteradoPor: userId },
        }),
      ])
      atualizar(atual.acao.projetoId, atual.acaoId)
    }
    return { feitoEm: Date.now() }
  } catch (erro) {
    await registrarFalha('Falha ao editar link da ação', erro)
    return { erro: 'Não foi possível salvar o link. Tente novamente.' }
  }
}

/** Remove um link (`linkId`) e registra no histórico da ação. */
export async function removerLink(formData: FormData): Promise<void> {
  const { userId } = await auth()
  if (!userId) return
  if (!(await contaPodeEditar(userId))) return

  const linkId = String(formData.get('linkId') ?? '')
  if (!linkId) return

  try {
    const atual = await prisma.linkAcao.findFirst({
      where: { id: linkId, acao: { projeto: { ativo: true } } },
      select: { acaoId: true, titulo: true, url: true, tipo: true, acao: { select: { projetoId: true } } },
    })
    if (!atual) return
    await prisma.$transaction([
      prisma.linkAcao.delete({ where: { id: linkId } }),
      prisma.historicoAlteracao.create({
        data: { acaoId: atual.acaoId, campo: 'link', valorAntigo: descreverLinkNoHistorico(atual), valorNovo: null, alteradoPor: userId },
      }),
    ])
    atualizar(atual.acao.projetoId, atual.acaoId)
  } catch (erro) {
    await registrarFalha('Falha ao remover link da ação', erro)
  }
}
