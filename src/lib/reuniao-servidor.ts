import { prisma } from './prisma'
import {
  JANELA_REPLANEJAMENTO_DIAS,
  agruparReplanejadas,
  filtrarPorEquipe,
  type RegistroDeData,
  type Replanejada,
} from './reuniao'
import { DIA_MS, SEM_EQUIPE, hojeEmBrasilia, type AcaoParaResumo } from './resumo-semanal'
import { lerAcoesParaResumo } from './resumo-servidor'

export type DadosDaReuniao = {
  hoje: Date
  /** Equipes que existem entre os projetos ativos ("Sem equipe" incluída, se houver). */
  equipes: string[]
  acoes: AcaoParaResumo[]
  replanejadas: Replanejada[]
  projetosAtivos: number
}

/**
 * Os dados de AGORA para a apresentação (não uma foto): ações, replanejamentos
 * dos últimos 7 dias e a contagem de projetos, já filtrados pela equipe pedida
 * (`null` = todas).
 */
export async function carregarReuniao(
  equipe: string | null,
  agora: Date = new Date(),
): Promise<DadosDaReuniao> {
  const hoje = hojeEmBrasilia(agora)
  const desde = new Date(agora.getTime() - JANELA_REPLANEJAMENTO_DIAS * DIA_MS)

  const [projetos, acoes, historico] = await Promise.all([
    prisma.projeto.findMany({ where: { ativo: true }, select: { equipe: true } }),
    lerAcoesParaResumo(hoje),
    prisma.historicoAlteracao.findMany({
      where: {
        campo: { in: ['previstoInicio', 'previstoTermino'] },
        alteradoEm: { gte: desde },
        acao: { projeto: { ativo: true } },
      },
      select: {
        campo: true,
        valorAntigo: true,
        valorNovo: true,
        alteradoEm: true,
        alteradoPor: true,
        acao: {
          select: {
            id: true,
            numero: true,
            descricao: true,
            responsavel: { select: { nome: true } },
            projeto: { select: { id: true, nome: true, equipe: true } },
          },
        },
      },
    }),
  ])

  const contas = [...new Set(historico.map((h) => h.alteradoPor).filter((c): c is string => c !== null))]
  const autores = contas.length
    ? await prisma.colaborador.findMany({
        where: { clerkUserId: { in: contas } },
        select: { clerkUserId: true, nome: true },
      })
    : []
  const nomePorConta = new Map(autores.map((a) => [a.clerkUserId!, a.nome]))

  const registros: (RegistroDeData & { equipe: string | null })[] = historico.map((h) => ({
    acaoId: h.acao.id,
    projetoId: h.acao.projeto.id,
    projetoNome: h.acao.projeto.nome,
    equipe: h.acao.projeto.equipe,
    numero: h.acao.numero,
    descricao: h.acao.descricao,
    responsavel: h.acao.responsavel?.nome ?? null,
    campo: h.campo,
    valorAntigo: h.valorAntigo,
    valorNovo: h.valorNovo,
    alteradoEm: h.alteradoEm,
    alteradoPor: h.alteradoPor ? (nomePorConta.get(h.alteradoPor) ?? null) : null,
  }))

  const nomesDeEquipe = projetos.map((p) => p.equipe?.trim() || SEM_EQUIPE)
  const equipes = [...new Set(nomesDeEquipe)].sort((a, b) =>
    a === SEM_EQUIPE ? 1 : b === SEM_EQUIPE ? -1 : a.localeCompare(b, 'pt-BR'),
  )

  return {
    hoje,
    equipes,
    acoes: filtrarPorEquipe(acoes, equipe),
    replanejadas: agruparReplanejadas(filtrarPorEquipe(registros, equipe)),
    projetosAtivos: equipe === null ? projetos.length : nomesDeEquipe.filter((n) => n === equipe).length,
  }
}
