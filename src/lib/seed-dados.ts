import { StatusAcao } from '../generated/prisma/enums'

/**
 * Dados de exemplo do seed. Ficam numa função pura (sem Prisma, sem banco) para
 * que possam ser verificados por teste unitário — quem grava é `prisma/seed.ts`.
 *
 * As datas Previsto são calculadas em relação a uma data de referência (`hoje`),
 * e não fixas no calendário, para que o seed continue produzindo o cenário
 * desejado — parte das ações no passado, parte no futuro — em qualquer rodada.
 */

export type AcaoSeed = {
  numero: number
  descricao: string
  status: StatusAcao
  previstoInicio: Date
  previstoTermino: Date
  realizadoInicio: Date | null
  realizadoTermino: Date | null
}

export type ProjetoSeed = {
  referencia: string
  nome: string
  equipe: string
  natureza: string
  categoria: string
  responsavel: string
  apoio: string | null
  setorEnvolvido: string | null
  comentario: string | null
  prioridade: number
  acoes: AcaoSeed[]
}

/** Data deslocada por N dias a partir de `base`, normalizada para meia-noite UTC. */
export function emDias(base: Date, dias: number): Date {
  const d = new Date(
    Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()),
  )
  d.setUTCDate(d.getUTCDate() + dias)
  return d
}

/**
 * `offsetInicio`/`offsetTermino` são deslocamentos em dias relativos a `hoje`:
 * negativo = passado, positivo = futuro.
 */
type EsbocoAcao = {
  descricao: string
  status: StatusAcao
  offsetInicio: number
  offsetTermino: number
  /** deslocamentos do Realizado; `null` = ação sem data realizada registrada */
  realizado: [number, number | null] | null
}

const esbocos: { projeto: Omit<ProjetoSeed, 'acoes'>; acoes: EsbocoAcao[] }[] = [
  {
    projeto: {
      referencia: 'CRO-DEP-2026-001',
      nome: 'Implantação do Sistema de Cronograma',
      equipe: 'STI',
      natureza: 'Desenvolvimento',
      categoria: 'Sistemas',
      responsavel: 'Mariana Garcia',
      apoio: 'Equipe STI',
      setorEnvolvido: 'CTCEA — Diretoria',
      comentario: 'Substitui as planilhas PLA-DEP e CRO-DEP.',
      prioridade: 1,
    },
    acoes: [
      {
        descricao: 'Levantar requisitos junto às equipes',
        status: StatusAcao.CONCLUIDO,
        offsetInicio: -60,
        offsetTermino: -45,
        realizado: [-58, -44],
      },
      {
        descricao: 'Modelar o schema de dados',
        status: StatusAcao.CONCLUIDO,
        offsetInicio: -44,
        offsetTermino: -30,
        realizado: [-43, -28],
      },
      {
        // Previsto no passado, sem Realizado e não concluída => atraso.
        descricao: 'Desenvolver CRUD de Projetos e Ações',
        status: StatusAcao.EM_CURSO_50,
        offsetInicio: -29,
        offsetTermino: -5,
        realizado: [-27, null],
      },
      {
        descricao: 'Construir visualização Gantt e dashboard consolidado',
        status: StatusAcao.NAO_INICIADO,
        offsetInicio: 3,
        offsetTermino: 25,
        realizado: null,
      },
      {
        descricao: 'Migrar dados das planilhas existentes',
        status: StatusAcao.NAO_INICIADO,
        offsetInicio: 26,
        offsetTermino: 40,
        realizado: null,
      },
    ],
  },
  {
    projeto: {
      referencia: 'PLA-DEP-2026-014',
      nome: 'Modernização da Infraestrutura de Rede',
      equipe: 'STI',
      natureza: 'Infraestrutura',
      categoria: 'Infraestrutura',
      responsavel: 'Coordenação de TI',
      apoio: 'Fornecedor externo',
      setorEnvolvido: 'Todas as unidades',
      comentario: 'Depende de contratação de fornecedor.',
      prioridade: 2,
    },
    acoes: [
      {
        descricao: 'Inventariar ativos de rede instalados',
        status: StatusAcao.CONCLUIDO,
        offsetInicio: -50,
        offsetTermino: -38,
        realizado: [-50, -36],
      },
      {
        // Atrasada: previsto terminou, nada realizado.
        descricao: 'Elaborar termo de referência da contratação',
        status: StatusAcao.EM_CURSO_25,
        offsetInicio: -37,
        offsetTermino: -10,
        realizado: null,
      },
      {
        descricao: 'Processo de contratação do fornecedor',
        status: StatusAcao.NAO_INICIADO,
        offsetInicio: -2,
        offsetTermino: 20,
        realizado: null,
      },
      {
        descricao: 'Substituir switches das unidades prioritárias',
        status: StatusAcao.NAO_INICIADO,
        offsetInicio: 21,
        offsetTermino: 55,
        realizado: null,
      },
      {
        descricao: 'Homologar e documentar a nova topologia',
        status: StatusAcao.NAO_INICIADO,
        offsetInicio: 56,
        offsetTermino: 70,
        realizado: null,
      },
    ],
  },
  {
    projeto: {
      referencia: 'PLA-DEP-2026-027',
      nome: 'Programa de Capacitação Interna 2026',
      equipe: 'GRH',
      natureza: 'Iniciativa',
      categoria: 'Pessoas',
      responsavel: 'Gerência de RH',
      apoio: 'GIA',
      setorEnvolvido: 'CTCEA — todas as gerências',
      comentario: null,
      prioridade: 3,
    },
    acoes: [
      {
        descricao: 'Mapear necessidades de capacitação por equipe',
        status: StatusAcao.CONCLUIDO,
        offsetInicio: -35,
        offsetTermino: -20,
        realizado: [-34, -21],
      },
      {
        descricao: 'Definir grade de trilhas e instrutores',
        status: StatusAcao.EM_CURSO_75,
        offsetInicio: -19,
        offsetTermino: 5,
        realizado: [-18, null],
      },
      {
        descricao: 'Realizar turmas do primeiro semestre',
        status: StatusAcao.NAO_INICIADO,
        offsetInicio: 6,
        offsetTermino: 45,
        realizado: null,
      },
      {
        descricao: 'Aplicar avaliação de eficácia das turmas',
        status: StatusAcao.NAO_INICIADO,
        offsetInicio: 46,
        offsetTermino: 60,
        realizado: null,
      },
      {
        descricao: 'Consolidar relatório anual de capacitação',
        status: StatusAcao.NAO_INICIADO,
        offsetInicio: 61,
        offsetTermino: 90,
        realizado: null,
      },
    ],
  },
]

export function dadosSeed(hoje: Date): ProjetoSeed[] {
  return esbocos.map(({ projeto, acoes }) => ({
    ...projeto,
    acoes: acoes.map((a, i) => ({
      numero: i + 1,
      descricao: a.descricao,
      status: a.status,
      previstoInicio: emDias(hoje, a.offsetInicio),
      previstoTermino: emDias(hoje, a.offsetTermino),
      realizadoInicio: a.realizado ? emDias(hoje, a.realizado[0]) : null,
      realizadoTermino:
        a.realizado && a.realizado[1] !== null ? emDias(hoje, a.realizado[1]) : null,
    })),
  }))
}
