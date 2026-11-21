'use server'

import { auth } from '@clerk/nextjs/server'
import { revalidatePath } from 'next/cache'

import { gravarLote } from '@/lib/acao-lote'
import { conferirResponsavel, MENSAGEM_RESPONSAVEL_INVALIDO } from '@/lib/acao-apoio'
import { serializarValor } from '@/lib/acao-historico'
import { MENSAGEM_SOMENTE_LEITURA } from '@/lib/administracao'
import { contaPodeEditar } from '@/lib/administracao-servidor'
import { urlBaseDoSistema } from '@/lib/email-config'
import { mensagemDoAviso } from '@/lib/email-responsavel'
import {
  descreverPedido,
  lerPedidoLote,
  montarAvisoLote,
  planejarLote,
  type AcaoDoLote,
  type ItemDoPlano,
  type PedidoLote,
} from '@/lib/edicao-lote'
import { enviarEmail } from '@/lib/enviar-email'
import { lerMotivoReplanejamento } from '@/lib/motivo-replanejamento'
import { lerIdProjeto } from '@/lib/projeto-edicao'
import { prisma } from '@/lib/prisma'
import { registrarFalha } from '@/lib/registrar-erro'

export type LinhaPrevia = {
  acaoId: string
  numero: number
  descricao: string
  /** `updatedAt` visto na prévia: a gravação só vale se a ação ainda estiver nesta versão. */
  versao: string
  mudancas: ItemDoPlano['mudancas']
  observacao: string | null
}

export type EstadoPrevia = {
  erro?: string
  previa?: {
    projetoId: string
    resumo: string
    linhas: LinhaPrevia[]
    quantasMudam: number
    /** Alguma data prevista vai mudar: a confirmação pede o motivo (um para o lote todo). */
    precisaMotivo: boolean
    /** Os campos do formulário, repetidos tal como foram pré-visualizados. */
    campos: { ids: string[]; quantidade: string; sentido: string; responsavelId: string }
  }
}

export type EstadoAplicacao = {
  erro?: string
  resultado?: {
    projetoId: string
    gravadas: number
    semMudanca: number
    conflitos: { numero: number; descricao: string }[]
    avisos: string[]
  }
}

const SELECAO = {
  id: true,
  numero: true,
  descricao: true,
  status: true,
  previstoInicio: true,
  previstoTermino: true,
  responsavelId: true,
  responsavel: { select: { nome: true } },
  updatedAt: true,
} as const

async function carregar(
  projetoId: string,
  pedido: PedidoLote,
): Promise<
  | { ok: true; acoes: AcaoDoLote[]; nome: string | null; email: string | null; projeto: { nome: string; referencia: string | null } }
  | { ok: false; erro: string }
> {
  const [projeto, linhas] = await Promise.all([
    prisma.projeto.findFirst({
      where: { id: projetoId, ativo: true },
      select: { nome: true, referencia: true },
    }),
    prisma.acao.findMany({
      where: { id: { in: pedido.ids }, projetoId, projeto: { ativo: true } },
      select: SELECAO,
      orderBy: { numero: 'asc' },
    }),
  ])
  if (!projeto) return { ok: false, erro: 'Projeto não encontrado ou excluído.' }
  if (linhas.length !== pedido.ids.length) {
    return {
      ok: false,
      erro: 'Alguma ação marcada não existe mais ou não é deste projeto. Recarregue a página.',
    }
  }

  let nome: string | null = null
  let email: string | null = null
  if (typeof pedido.responsavelId === 'string') {
    const conferido = await conferirResponsavel(pedido.responsavelId, null)
    if (!conferido.ok) return { ok: false, erro: MENSAGEM_RESPONSAVEL_INVALIDO }
    nome = conferido.nome ?? null
    email = conferido.email
  }

  return {
    ok: true,
    nome,
    email,
    projeto,
    acoes: linhas.map((a) => ({
      id: a.id,
      numero: a.numero,
      descricao: a.descricao,
      status: a.status,
      previstoInicio: a.previstoInicio,
      previstoTermino: a.previstoTermino,
      responsavelId: a.responsavelId,
      responsavelNome: a.responsavel?.nome ?? null,
      versao: a.updatedAt,
    })),
  }
}

async function permissao(): Promise<{ userId: string } | { erro: string }> {
  const { userId } = await auth()
  if (!userId) return { erro: 'Sessão expirada. Entre novamente.' }
  if (!(await contaPodeEditar(userId))) return { erro: MENSAGEM_SOMENTE_LEITURA }
  return { userId }
}

/** Passo 1: mostra, ação por ação, o que mudaria. Não grava nada. */
export async function previaLote(
  _anterior: EstadoPrevia,
  formData: FormData,
): Promise<EstadoPrevia> {
  const acesso = await permissao()
  if ('erro' in acesso) return { erro: acesso.erro }

  const projetoId = lerIdProjeto(formData)
  if (!projetoId) return { erro: 'Projeto não identificado. Recarregue a página.' }
  const lido = lerPedidoLote(formData)
  if (!lido.ok) return { erro: lido.erro }

  try {
    const base = await carregar(projetoId, lido.pedido)
    if (!base.ok) return { erro: base.erro }

    const plano = planejarLote(base.acoes, lido.pedido, base.nome)
    const quantasMudam = plano.filter((i) => i.mudancas.length > 0).length
    if (quantasMudam === 0) {
      return { erro: 'Nenhuma das ações marcadas mudaria com esta operação.' }
    }
    return {
      previa: {
        projetoId,
        resumo: descreverPedido(lido.pedido, base.nome),
        quantasMudam,
        precisaMotivo: plano.some((i) => i.mudancas.some((m) => m.campo !== 'responsavel')),
        linhas: plano.map((i) => ({
          acaoId: i.acaoId,
          numero: i.numero,
          descricao: i.descricao,
          versao: i.versao.toISOString(),
          mudancas: i.mudancas,
          observacao: i.observacao,
        })),
        campos: {
          ids: lido.pedido.ids,
          quantidade: String(formData.get('quantidade') ?? ''),
          sentido: String(formData.get('sentido') ?? 'adiar'),
          responsavelId: String(formData.get('responsavelId') ?? ''),
        },
      },
    }
  } catch (erro) {
    await registrarFalha('Falha na prévia da edição em lote', erro)
    return { erro: 'Não foi possível montar a prévia. Tente novamente.' }
  }
}

/** Passo 2: grava o que a prévia mostrou, conferindo a versão de cada ação. */
export async function aplicarLote(
  _anterior: EstadoAplicacao,
  formData: FormData,
): Promise<EstadoAplicacao> {
  const acesso = await permissao()
  if ('erro' in acesso) return { erro: acesso.erro }

  const projetoId = lerIdProjeto(formData)
  if (!projetoId) return { erro: 'Projeto não identificado. Recarregue a página.' }
  const lido = lerPedidoLote(formData)
  if (!lido.ok) return { erro: lido.erro }

  // `id|versão` de cada linha da prévia. Sem versão conhecida, a ação conflita:
  // gravar sem saber o que a pessoa viu seria o que a conferência existe para evitar.
  const versoes = new Map<string, Date>()
  for (const bruto of formData.getAll('versao')) {
    if (typeof bruto !== 'string') continue
    const [id, iso] = bruto.split('|')
    const data = new Date(iso ?? '')
    if (id && !Number.isNaN(data.getTime())) versoes.set(id, data)
  }

  try {
    const base = await carregar(projetoId, lido.pedido)
    if (!base.ok) return { erro: base.erro }

    const plano = planejarLote(base.acoes, lido.pedido, base.nome).map((item) => ({
      ...item,
      versao: versoes.get(item.acaoId) ?? new Date(0),
    }))
    const porId = new Map(base.acoes.map((a) => [a.id, a]))
    const itens = plano.map((item) => {
      const acao = porId.get(item.acaoId)!
      return {
        ...item,
        atual: {
          previstoInicio: acao.previstoInicio,
          previstoTermino: acao.previstoTermino,
          responsavel: acao.responsavelNome,
        },
      }
    })

    // Data prevista que vai mudar (a ação já tinha data): pede o motivo, um só para o lote.
    let motivo: { motivo: string; detalhe: string | null } | undefined
    if (itens.some((i) => i.mudancas.some((m) => m.campo !== 'responsavel'))) {
      const lidoMotivo = lerMotivoReplanejamento(formData)
      if (!lidoMotivo.ok) return { erro: lidoMotivo.erro }
      motivo = lidoMotivo.motivo
    }

    const { gravadas, conflitos } = await gravarLote(prisma, itens, acesso.userId, motivo)

    revalidatePath('/projetos')
    revalidatePath(`/projetos/${projetoId}`)

    // Um e-mail só, com a lista, para quem PASSOU a responder por ações.
    const avisos: string[] = []
    const passaram = itens.filter(
      (i) => gravadas.includes(i.acaoId) && i.mudancas.some((m) => m.campo === 'responsavel'),
    )
    if (typeof lido.pedido.responsavelId === 'string' && base.nome && passaram.length > 0) {
      try {
        const urlBase = urlBaseDoSistema(process.env)
        const destino = { nome: base.nome, email: base.email }
        if (!destino.email) {
          avisos.push(mensagemDoAviso(destino, null))
        } else {
          const mensagem = montarAvisoLote({
            responsavel: base.nome,
            projeto: base.projeto,
            acoes: passaram.map((i) => ({
              numero: i.numero,
              descricao: i.descricao,
              previstoInicio: serializarValor(i.dados.previstoInicio ?? porId.get(i.acaoId)!.previstoInicio),
              previstoTermino: serializarValor(i.dados.previstoTermino ?? porId.get(i.acaoId)!.previstoTermino),
            })),
            link: urlBase ? `${urlBase}/projetos/${projetoId}` : null,
          })
          avisos.push(mensagemDoAviso(destino, await enviarEmail(destino.email, mensagem)))
        }
      } catch (erro) {
        await registrarFalha('Falha ao avisar o responsável do lote', erro)
        avisos.push('Não foi possível enviar o aviso por e-mail. Avise a pessoa por outro meio.')
      }
    }

    return {
      resultado: {
        projetoId,
        gravadas: gravadas.length,
        semMudanca: itens.filter((i) => i.mudancas.length === 0).length,
        conflitos: conflitos.map((id) => {
          const a = porId.get(id)!
          return { numero: a.numero, descricao: a.descricao }
        }),
        avisos,
      },
    }
  } catch (erro) {
    await registrarFalha('Falha na edição em lote', erro)
    return { erro: 'Não foi possível gravar o lote. Nada foi alterado. Tente novamente.' }
  }
}
