import {
  contarPorCampo,
  rankingReplanejamentos,
  resumirAuditoria,
  type RegistroHistorico,
} from '@/lib/dashboard-auditoria'
import {
  taxaDeConclusao,
  winsReincidentes,
} from '@/lib/dashboard-wins'
import { semanaDe } from '@/lib/semana-ctcea'
import {
  proximosVencimentos,
  rankingAtrasos,
  resumirAderencia,
  type AcaoComPrazo,
} from '@/lib/dashboard-prazos'
import { apurarPendencias } from '@/lib/dashboard-qualidade'
import { cargaMensal, evolucaoMensal } from '@/lib/dashboard-temporal'
import { inicioDeHojeUTC } from '@/lib/data-hoje'
import { resumirPainel } from '@/lib/painel-consolidado'
import { prisma } from '@/lib/prisma'
import {
  janelaDoPeriodo,
  lerPeriodo,
  limitesDoInstante,
  periodoAtivo,
  recortarPorPeriodo,
  semanaNoPeriodo,
} from '@/lib/filtro-periodo'
import { filtrarPorStatus, lerFiltros, whereProjetoAtivo } from '@/lib/projeto-filtros'
import { montarLinhas } from '@/lib/projetos-listagem'
import type { StatusAcao } from '@/lib/acao-validacao'

/** Tudo o que a tela de dashboards mostra, já agregado. A página só desenha. */
export async function carregarDashboard(parametros: Record<string, string | string[] | undefined>) {
  const filtros = lerFiltros(parametros)
  const periodo = lerPeriodo(parametros)
  const hoje = inicioDeHojeUTC()

  const [projetosBrutos, valores, registrosWin, winsTodos, historico] = await Promise.all([
    prisma.projeto.findMany({
      where: whereProjetoAtivo(filtros),
      orderBy: [{ prioridade: 'asc' }, { nome: 'asc' }],
      select: {
        id: true,
        referencia: true,
        nome: true,
        equipe: true,
        natureza: true,
        categoria: true,
        responsavel: true,
        prioridade: true,
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
          },
        },
      },
    }),
    prisma.projeto.findMany({
      where: { ativo: true },
      select: { equipe: true, categoria: true, responsavel: true },
    }),
    // Auditoria e Card WIN NÃO seguem os filtros da carteira (equipe,
    // responsável, categoria, status): a auditoria pergunta "o que mudou no
    // sistema", e um WIN não tem equipe, natureza nem prioridade — mexer num
    // desses filtros deixaria os números parados, o que leria como bug. Só o
    // PERÍODO vale para eles: a auditoria recorta pela data da alteração (no
    // banco, para o teto de 500 não cortar o intervalo escolhido) e o Card WIN
    // pelas semanas que tocam o período.
    prisma.winSemana.findMany({
      select: {
        status: true,
        desfecho: true,
        card: { select: { ano: true, semana: true } },
      },
    }),
    prisma.win.findMany({
      select: {
        id: true,
        descricao: true,
        aparicoesAnteriores: true,
        promovidoEm: true,
        encerradoEm: true,
        projetoId: true,
        colaborador: { select: { nome: true } },
        registros: { select: { card: { select: { ano: true, semana: true } } } },
      },
    }),
    prisma.historicoAlteracao.findMany({
      where: periodoAtivo(periodo) ? { alteradoEm: limitesDoInstante(periodo) } : undefined,
      orderBy: { alteradoEm: 'desc' },
      take: 500,
      select: {
        id: true,
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
            projeto: { select: { id: true, nome: true } },
          },
        },
      },
    }),
  ])

  const { projetos, semDataPrevista } = recortarPorPeriodo(projetosBrutos, periodo)
  const linhas = filtrarPorStatus(montarLinhas(projetos, hoje), filtros)

  const semanaAtual = semanaDe(hoje)
  const conclusaoSemanal = taxaDeConclusao(
    registrosWin.map((r) => ({
      ano: r.card.ano,
      semana: r.card.semana,
      status: r.status,
      desfecho: r.desfecho,
    })),
    janelaDoPeriodo(periodo, semanaAtual),
    semanaAtual,
  )
  const reincidentes = winsReincidentes(
    winsTodos.map((w) => ({
      winId: w.id,
      descricao: w.descricao,
      colaborador: w.colaborador.nome,
      aparicoesAnteriores: w.aparicoesAnteriores,
      promovidoEm: w.promovidoEm,
      encerradoEm: w.encerradoEm,
      projetoId: w.projetoId,
      aparicoes: w.registros.map((r) => r.card),
    })),
    2,
    periodoAtivo(periodo) ? (semana) => semanaNoPeriodo(semana, periodo) : undefined,
  )
  const resumoPorId = new Map(linhas.map((linha) => [linha.id, linha.resumo]))
  const visiveis = projetos.filter((projeto) => resumoPorId.has(projeto.id))

  const painel = resumirPainel(linhas)

  // Ações achatadas com o projeto junto — base dos relatórios de prazo, tempo
  // e qualidade.
  const acoes: AcaoComPrazo[] = visiveis.flatMap((projeto) =>
    projeto.acoes.map((acao) => ({
      ...acao,
      status: acao.status as StatusAcao,
      projetoId: projeto.id,
      projetoNome: projeto.nome,
      equipe: projeto.equipe,
      responsavel: projeto.responsavel,
    })),
  )

  const agrupaveis = visiveis.map((projeto) => ({
    equipe: projeto.equipe,
    responsavel: projeto.responsavel,
    natureza: projeto.natureza,
    categoria: projeto.categoria,
    prioridade: projeto.prioridade,
    resumo: resumoPorId.get(projeto.id)!,
  }))

  const aderencia = resumirAderencia(acoes)
  const atrasos = rankingAtrasos(acoes, hoje)
  const janelas = proximosVencimentos(acoes, hoje)
  const evolucao = evolucaoMensal(acoes, hoje)
  const carga = cargaMensal(acoes)

  const pendencias = apurarPendencias(
    visiveis.map((projeto) => ({
      id: projeto.id,
      nome: projeto.nome,
      equipe: projeto.equipe,
      responsavel: projeto.responsavel,
      totalAcoes: projeto.acoes.length,
    })),
    acoes,
  )

  const registros: RegistroHistorico[] = historico.map((registro) => ({
    id: registro.id,
    campo: registro.campo,
    valorAntigo: registro.valorAntigo,
    valorNovo: registro.valorNovo,
    alteradoEm: registro.alteradoEm,
    alteradoPor: registro.alteradoPor,
    acaoId: registro.acao.id,
    acaoNumero: registro.acao.numero,
    acaoDescricao: registro.acao.descricao,
    projetoId: registro.acao.projeto.id,
    projetoNome: registro.acao.projeto.nome,
  }))

  const auditoria = resumirAuditoria(registros)
  const porCampo = contarPorCampo(registros)
  const replanejamentos = rankingReplanejamentos(registros)
  return {
    filtros,
    periodo,
    valores,
    semDataPrevista,
    linhas,
    painel,
    agrupaveis,
    aderencia,
    atrasos,
    janelas,
    evolucao,
    carga,
    pendencias,
    conclusaoSemanal,
    reincidentes,
    registros,
    auditoria,
    porCampo,
    replanejamentos,
  }
}
