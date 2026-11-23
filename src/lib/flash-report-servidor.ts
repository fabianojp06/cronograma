/**
 * Carrega os dados do Flash Report de um projeto e monta o relatório da semana
 * escolhida. A consulta é uma só (projeto + macroetapas + ações com histórico +
 * dependências + riscos abertos); a foto do fim de cada semana sai do histórico
 * lido UMA vez (`fotoDoProjeto`), sem consulta por semana.
 */

import { acaoIniciada, etiquetaDaDependencia } from './dependencia-acao'
import {
  janelaDoProjeto,
  montarFlashReport,
  normalizarSemana,
  type AcaoDoRelatorio,
  type FlashReport,
} from './flash-report'
import { inicioDeHojeUTC } from './data-hoje'
import { corteDaFoto, fotoDoProjeto } from './foto-em-data'
import { prisma } from './prisma'
import { acaoEstaAtrasada } from './projeto-resumo'
import {
  chaveSemana,
  distanciaEmSemanas,
  periodoDaSemana,
  semanaAnterior,
  semanaDe,
  semanaSeguinte,
  type SemanaCtcea,
} from './semana-ctcea'
import type { AcaoParaAvanco } from './avanco-fisico'

export type DadosFlashReport = {
  relatorio: FlashReport
  cabecalho: {
    id: string
    nome: string
    referencia: string | null
    cliente: string | null
    objetivo: string | null
    lider: string | null
  }
  janela: { primeira: SemanaCtcea; ultima: SemanaCtcea } | null
  semana: SemanaCtcea
  /** `null` quando a semana está no limite da janela. */
  semanaAnterior: SemanaCtcea | null
  semanaSeguinte: SemanaCtcea | null
  temMacroetapas: boolean
}

export async function carregarFlashReport(
  projetoId: string,
  semanaParam: string | undefined,
  agora: Date,
): Promise<DadosFlashReport | null> {
  const projeto = await prisma.projeto.findFirst({
    where: { id: projetoId, ativo: true },
    select: {
      id: true,
      nome: true,
      referencia: true,
      cliente: true,
      objetivo: true,
      responsavel: true,
      lider: { select: { nome: true } },
      macroetapas: { orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }], select: { id: true, nome: true, ordem: true } },
      acoes: {
        orderBy: { numero: 'asc' },
        select: {
          id: true,
          numero: true,
          descricao: true,
          status: true,
          previstoInicio: true,
          previstoTermino: true,
          realizadoInicio: true,
          realizadoTermino: true,
          macroetapaId: true,
          createdAt: true,
          responsavel: { select: { nome: true } },
          historico: { select: { campo: true, valorAntigo: true, alteradoEm: true } },
          dependeDe: { select: { predecessora: { select: { id: true, numero: true, status: true } } } },
          liberacoes: { where: { status: 'APROVADA' }, select: { id: true } },
        },
      },
      riscos: {
        where: { status: { in: ['ABERTO', 'EM_TRATAMENTO'] } },
        select: {
          id: true, tipo: true, titulo: true, impacto: true, status: true, prazo: true, plano: true,
          pedeAjuda: true, criadoEm: true,
          responsavel: { select: { nome: true } },
          acao: { select: { numero: true } },
        },
      },
    },
  })
  if (!projeto) return null

  // Mesmo "hoje" da lista, do painel e do Excel (`inicioDeHojeUTC`): o sinal e o farol não divergem.
  const hoje = inicioDeHojeUTC(agora)
  const acoes: AcaoDoRelatorio[] = projeto.acoes.map((a) => ({
    id: a.id,
    numero: a.numero,
    descricao: a.descricao,
    status: a.status,
    previstoInicio: a.previstoInicio,
    previstoTermino: a.previstoTermino,
    realizadoTermino: a.realizadoTermino,
    macroetapaId: a.macroetapaId,
    atrasada: acaoEstaAtrasada(a, hoje),
    bloqueada:
      etiquetaDaDependencia({
        predecessoras: a.dependeDe.map((d) => d.predecessora),
        iniciada: acaoIniciada(a),
        liberada: a.liberacoes.length > 0,
      })?.bloqueada ?? false,
  }))

  const janela = janelaDoProjeto(acoes)
  const semana = normalizarSemana(semanaParam, janela, hoje)
  const semanaAtual = semanaDe(hoje)

  // Foto do sábado de cada semana da janela, da primeira até a escolhida
  // (só as já encerradas: a semana em curso usa o estado atual).
  const acoesNoFimDeCada = new Map<string, readonly (AcaoParaAvanco & { id: string })[]>()
  const avisosExtras: string[] = []
  if (janela) {
    const comHistorico = projeto.acoes.map((a) => ({
      id: a.id,
      numero: a.numero,
      descricao: a.descricao,
      status: a.status,
      previstoInicio: a.previstoInicio,
      previstoTermino: a.previstoTermino,
      realizadoInicio: a.realizadoInicio,
      realizadoTermino: a.realizadoTermino,
      responsavel: a.responsavel?.nome ?? null,
      createdAt: a.createdAt,
      historico: a.historico,
    }))
    const registro = await prisma.acao.aggregate({ _min: { createdAt: true } })
    const inicioDoRegistro = registro._min.createdAt
    let s = janela.primeira
    while (distanciaEmSemanas(s, semana) >= 0) {
      const fim = periodoDaSemana(s).fim
      if (fim.getTime() < hoje.getTime()) {
        const foto = fotoDoProjeto(comHistorico, corteDaFoto(fim.toISOString().slice(0, 10)), inicioDoRegistro)
        acoesNoFimDeCada.set(
          chaveSemana(s),
          foto.acoes.map((f) => ({
            id: f.id,
            status: f.status,
            previstoInicio: f.previstoInicio,
            previstoTermino: f.previstoTermino,
          })),
        )
      }
      s = semanaSeguinte(s)
    }
    if (
      inicioDoRegistro !== null &&
      corteDaFoto(periodoDaSemana(janela.primeira).fim.toISOString().slice(0, 10)).getTime() <=
        inicioDoRegistro.getTime() &&
      distanciaEmSemanas(janela.primeira, semanaAtual) > 0
    ) {
      avisosExtras.push(
        'O projeto começa antes do início do registro no sistema: as semanas antigas vieram da planilha e não são confiáveis.',
      )
    }
  }

  const relatorio = montarFlashReport({
    projeto: {
      nome: projeto.nome,
      cliente: projeto.cliente,
      objetivo: projeto.objetivo,
      lider: projeto.lider?.nome ?? projeto.responsavel,
    },
    macroetapas: projeto.macroetapas,
    acoes,
    acoesNoFimDeCada,
    riscos: projeto.riscos // a consulta já traz só os abertos
      .map((r) => ({
        id: r.id,
        tipo: r.tipo,
        titulo: r.titulo,
        impacto: r.impacto,
        status: r.status,
        prazo: r.prazo,
        plano: r.plano,
        responsavel: r.responsavel?.nome ?? null,
        pedeAjuda: r.pedeAjuda,
        criadoEm: r.criadoEm,
        acaoNumero: r.acao?.numero ?? null,
      })),
    semana,
    hoje,
  })
  relatorio.avisos.push(...avisosExtras)

  const anterior = janela && distanciaEmSemanas(janela.primeira, semana) > 0 ? semanaAnterior(semana) : null
  const seguinte =
    janela && distanciaEmSemanas(semana, janela.ultima) > 0 && distanciaEmSemanas(semana, semanaAtual) > 0
      ? semanaSeguinte(semana)
      : null

  return {
    relatorio,
    cabecalho: {
      id: projeto.id,
      nome: projeto.nome,
      referencia: projeto.referencia,
      cliente: projeto.cliente,
      objetivo: projeto.objetivo,
      lider: projeto.lider?.nome ?? projeto.responsavel,
    },
    janela,
    semana,
    semanaAnterior: anterior,
    semanaSeguinte: seguinte,
    temMacroetapas: projeto.macroetapas.length > 0,
  }
}
