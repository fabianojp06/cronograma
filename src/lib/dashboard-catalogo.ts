/**
 * Catálogo dos relatórios da tela `/dashboards` — módulo puro e única fonte de
 * verdade sobre "quais relatórios existem".
 *
 * Alimenta ao mesmo tempo o índice de navegação da tela e as âncoras de cada
 * seção. Manter os dois derivados daqui evita o problema clássico de um menu
 * apontar para uma seção que foi renomeada ou removida.
 *
 * Cada relatório declara a `pergunta` que responde: o sistema substitui duas
 * planilhas onde essas perguntas eram respondidas "no olho", e registrar a
 * pergunta é o que impede a tela de virar um amontoado de números sem uso.
 */

export const GRUPOS_RELATORIO = [
  'PANORAMA',
  'DISTRIBUICAO',
  'PRAZOS',
  'TEMPO',
  'QUALIDADE',
  'AUDITORIA',
] as const

export type GrupoRelatorio = (typeof GRUPOS_RELATORIO)[number]

export const ROTULO_GRUPO: Record<GrupoRelatorio, string> = {
  PANORAMA: 'Panorama',
  DISTRIBUICAO: 'Distribuição',
  PRAZOS: 'Prazos',
  TEMPO: 'Evolução no tempo',
  QUALIDADE: 'Qualidade do cadastro',
  AUDITORIA: 'Auditoria',
}

export type Relatorio = {
  /** Âncora na URL (`/dashboards#por-equipe`) — não mudar sem motivo: vira link salvo. */
  id: string
  titulo: string
  /** A pergunta de negócio que o relatório responde. */
  pergunta: string
  grupo: GrupoRelatorio
}

export const RELATORIOS: readonly Relatorio[] = [
  {
    id: 'panorama',
    titulo: 'Panorama geral',
    pergunta: 'Como está a carteira de projetos como um todo, hoje?',
    grupo: 'PANORAMA',
  },
  {
    id: 'composicao-status',
    titulo: 'Composição por status',
    pergunta: 'Quantos projetos estão parados, em andamento, atrasados ou concluídos?',
    grupo: 'PANORAMA',
  },
  {
    id: 'por-equipe',
    titulo: 'Por equipe',
    pergunta: 'Qual equipe concentra mais ações e qual acumula mais atraso?',
    grupo: 'DISTRIBUICAO',
  },
  {
    id: 'por-responsavel',
    titulo: 'Por responsável',
    pergunta: 'Como a carga está distribuída entre as pessoas responsáveis?',
    grupo: 'DISTRIBUICAO',
  },
  {
    id: 'por-natureza',
    titulo: 'Por natureza',
    pergunta: 'Quanto do esforço é desenvolvimento, infraestrutura ou iniciativa?',
    grupo: 'DISTRIBUICAO',
  },
  {
    id: 'por-categoria',
    titulo: 'Por categoria',
    pergunta: 'Como os projetos se distribuem entre as categorias do plano de ação?',
    grupo: 'DISTRIBUICAO',
  },
  {
    id: 'por-prioridade',
    titulo: 'Por prioridade',
    pergunta: 'O atraso está concentrado nos projetos de maior prioridade?',
    grupo: 'DISTRIBUICAO',
  },
  {
    id: 'aderencia-prazo',
    titulo: 'Aderência ao prazo',
    pergunta: 'Das ações já concluídas, quantas terminaram dentro do previsto?',
    grupo: 'PRAZOS',
  },
  {
    id: 'ranking-atrasos',
    titulo: 'Maiores atrasos',
    pergunta: 'Quais ações estão paradas há mais tempo depois do prazo?',
    grupo: 'PRAZOS',
  },
  {
    id: 'proximos-vencimentos',
    titulo: 'Próximos vencimentos',
    pergunta: 'O que vence nos próximos 7, 15 e 30 dias?',
    grupo: 'PRAZOS',
  },
  {
    id: 'evolucao-mensal',
    titulo: 'Previsto x Realizado acumulado',
    pergunta: 'O ritmo de entrega está acompanhando o que foi planejado?',
    grupo: 'TEMPO',
  },
  {
    id: 'carga-mensal',
    titulo: 'Carga por mês',
    pergunta: 'Em que meses se concentram os inícios e os términos previstos?',
    grupo: 'TEMPO',
  },
  {
    id: 'higiene-dados',
    titulo: 'Pendências de cadastro',
    pergunta: 'Que registros estão incompletos ou inconsistentes e distorcem os números?',
    grupo: 'QUALIDADE',
  },
  {
    id: 'replanejamentos',
    titulo: 'Replanejamentos',
    pergunta: 'Quais ações tiveram a data prevista empurrada, e quantas vezes?',
    grupo: 'AUDITORIA',
  },
  {
    id: 'alteracoes-recentes',
    titulo: 'Alterações recentes',
    pergunta: 'O que mudou por último, em que campo e por quem?',
    grupo: 'AUDITORIA',
  },
] as const

/** Relatórios de um grupo, na ordem em que aparecem na tela. */
export function relatoriosDoGrupo(grupo: GrupoRelatorio): Relatorio[] {
  return RELATORIOS.filter((relatorio) => relatorio.grupo === grupo)
}

/** Grupos que têm ao menos um relatório — a ordem é a de `GRUPOS_RELATORIO`. */
export function gruposComRelatorios(): GrupoRelatorio[] {
  return GRUPOS_RELATORIO.filter((grupo) => relatoriosDoGrupo(grupo).length > 0)
}
