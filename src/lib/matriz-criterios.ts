/**
 * Catálogo da Matriz de Priorização (Benefício x Esforço ponderado por GUT) —
 * módulo puro e **fonte única** sobre quais critérios existem, em que escala
 * são pontuados e como os quadrantes são delimitados.
 *
 * Transcreve o modelo da planilha `Matriz de Priorização` da CTCEA. Os `id`
 * de cada critério são exatamente os nomes das colunas de `AvaliacaoProjeto`
 * no Prisma — assim o formulário, o cálculo e a gravação percorrem a mesma
 * lista, em vez de repetirem dez nomes em cada camada.
 */

export const GRUPOS_CRITERIO = ['BENEFICIO', 'ESFORCO'] as const

export type GrupoCriterio = (typeof GRUPOS_CRITERIO)[number]

export const ROTULO_GRUPO: Record<GrupoCriterio, string> = {
  BENEFICIO: 'Benefício',
  ESFORCO: 'Esforço',
}

export type Criterio = {
  id: string
  rotulo: string
  grupo: GrupoCriterio
  /** Peso em pontos percentuais inteiros. Na planilha, 20% para os dez. */
  pesoPadrao: number
  /** O que uma nota alta significa — o sentido muda entre os dois grupos. */
  ajuda: string
}

export const CRITERIOS = [
  {
    id: 'beneficioCompromissos',
    rotulo: 'Atendimento aos Compromissos',
    grupo: 'BENEFICIO',
    pesoPadrao: 20,
    ajuda: 'Quanto o projeto honra compromissos já assumidos pela CTCEA.',
  },
  {
    id: 'beneficioValorTecnologico',
    rotulo: 'Entrega de Valor Tecnológico / P&D',
    grupo: 'BENEFICIO',
    pesoPadrao: 20,
    ajuda: 'Quanto agrega em capacidade técnica, inovação ou pesquisa.',
  },
  {
    id: 'beneficioClima',
    rotulo: 'Clima Organizacional e Retenção',
    grupo: 'BENEFICIO',
    pesoPadrao: 20,
    ajuda: 'Efeito sobre o ambiente de trabalho e a permanência das pessoas.',
  },
  {
    id: 'beneficioGovernanca',
    rotulo: 'Governança e Transparência',
    grupo: 'BENEFICIO',
    pesoPadrao: 20,
    ajuda: 'Ganho em controle, prestação de contas e rastreabilidade.',
  },
  {
    id: 'beneficioEficiencia',
    rotulo: 'Eficiência Operacional (Lean)',
    grupo: 'BENEFICIO',
    pesoPadrao: 20,
    ajuda: 'Redução de desperdício, retrabalho ou tempo de processo.',
  },
  {
    id: 'esforcoOrcamento',
    rotulo: 'Disponibilidade Orçamentária / Verba',
    grupo: 'ESFORCO',
    pesoPadrao: 20,
    ajuda: 'Nota ALTA = verba escassa ou difícil de obter, ou seja, mais esforço.',
  },
  {
    id: 'esforcoDuracao',
    rotulo: 'Duração do projeto',
    grupo: 'ESFORCO',
    pesoPadrao: 20,
    ajuda: 'Nota ALTA = projeto longo.',
  },
  {
    id: 'esforcoCapacidadeEquipe',
    rotulo: 'Capacidade e Carga da Equipe (Equipe Enxuta)',
    grupo: 'ESFORCO',
    pesoPadrao: 20,
    ajuda: 'Nota ALTA = equipe já sobrecarregada ou sem a competência necessária.',
  },
  {
    id: 'esforcoResistencia',
    rotulo: 'Resistência Política',
    grupo: 'ESFORCO',
    pesoPadrao: 20,
    ajuda: 'Nota ALTA = muita resistência esperada de partes interessadas.',
  },
  {
    id: 'esforcoComplexidade',
    rotulo: 'Complexidade Técnica e Dependências',
    grupo: 'ESFORCO',
    pesoPadrao: 20,
    ajuda: 'Nota ALTA = solução complexa ou dependente de terceiros.',
  },
] as const satisfies readonly Criterio[]

/** Item do catálogo com o `id` já estreitado para o literal, não `string`. */
export type CriterioCatalogo = (typeof CRITERIOS)[number]

export type CriterioId = CriterioCatalogo['id']

export const IDS_CRITERIO = CRITERIOS.map((criterio) => criterio.id) as CriterioId[]

export function criteriosDoGrupo(grupo: GrupoCriterio): CriterioCatalogo[] {
  return CRITERIOS.filter((criterio) => criterio.grupo === grupo)
}

export function ehCriterioId(valor: unknown): valor is CriterioId {
  return typeof valor === 'string' && (IDS_CRITERIO as string[]).includes(valor)
}

/**
 * Escala das notas dos critérios — 0/3/6/9, como na planilha.
 *
 * Não é 0 a 10: saltos largos forçam uma escolha entre poucas opções claras e
 * evitam a discussão estéril entre dar 6 ou 7 a um projeto.
 */
export const ESCALA_NOTA = [0, 3, 6, 9] as const

export type Nota = (typeof ESCALA_NOTA)[number]

export const ROTULO_NOTA: Record<Nota, string> = {
  0: 'Nenhum',
  3: 'Baixo',
  6: 'Médio',
  9: 'Alto',
}

export function ehNotaValida(valor: unknown): valor is Nota {
  return typeof valor === 'number' && (ESCALA_NOTA as readonly number[]).includes(valor)
}

/** Fatores do GUT — escala clássica de 1 a 5. */
export const FATORES_GUT = ['gravidade', 'urgencia', 'tendencia'] as const

export type FatorGut = (typeof FATORES_GUT)[number]

export const ESCALA_GUT = [1, 2, 3, 4, 5] as const

export type NotaGut = (typeof ESCALA_GUT)[number]

export const ROTULO_FATOR_GUT: Record<FatorGut, string> = {
  gravidade: 'G — Gravidade',
  urgencia: 'U — Urgência',
  tendencia: 'T — Tendência',
}

/** Rótulos da escala GUT clássica, por fator. */
export const ROTULO_ESCALA_GUT: Record<FatorGut, Record<NotaGut, string>> = {
  gravidade: {
    1: 'Sem gravidade',
    2: 'Pouco grave',
    3: 'Grave',
    4: 'Muito grave',
    5: 'Extremamente grave',
  },
  urgencia: {
    1: 'Pode esperar',
    2: 'Pouco urgente',
    3: 'Urgente',
    4: 'Muito urgente',
    5: 'Ação imediata',
  },
  tendencia: {
    1: 'Não muda',
    2: 'Piora a longo prazo',
    3: 'Piora a médio prazo',
    4: 'Piora a curto prazo',
    5: 'Piora rapidamente',
  },
}

export function ehNotaGutValida(valor: unknown): valor is NotaGut {
  return typeof valor === 'number' && (ESCALA_GUT as readonly number[]).includes(valor)
}

/**
 * Limiares que separam os quadrantes, nos valores da planilha.
 *
 * Não são o meio da escala (que seria 4,5 nos dois eixos): a planilha é mais
 * exigente com esforço do que com benefício, de propósito. Mudar estes dois
 * números reposiciona todos os projetos — é decisão de negócio, não de código.
 */
export const LIMIAR_ESFORCO = 3
export const LIMIAR_BENEFICIO = 4

/** Maior valor possível de benefício ou esforço (todas as notas em 9). */
export const NOTA_MAXIMA = 9

export const QUADRANTES = [
  'QUICK_WINS',
  'ESTRATEGICOS',
  'VIAVEIS',
  'DESCARTAR',
] as const

export type Quadrante = (typeof QUADRANTES)[number]

export type DescricaoQuadrante = {
  quadrante: Quadrante
  numero: number
  rotulo: string
  descricao: string
  /** Como agir com um projeto que cai aqui. */
  recomendacao: string
}

export const DESCRICAO_QUADRANTE: Record<Quadrante, DescricaoQuadrante> = {
  QUICK_WINS: {
    quadrante: 'QUICK_WINS',
    numero: 1,
    rotulo: 'Quick Wins',
    descricao: 'Alto benefício, baixo esforço',
    recomendacao: 'Prioritário — fazer primeiro.',
  },
  ESTRATEGICOS: {
    quadrante: 'ESTRATEGICOS',
    numero: 2,
    rotulo: 'Estratégicos',
    descricao: 'Alto benefício, alto esforço',
    recomendacao: 'Vale a pena, mas exige planejamento e verba.',
  },
  VIAVEIS: {
    quadrante: 'VIAVEIS',
    numero: 3,
    rotulo: 'Viáveis / Baixo Risco',
    descricao: 'Baixo benefício, baixo esforço',
    recomendacao: 'Encaixar nas folgas da equipe.',
  },
  DESCARTAR: {
    quadrante: 'DESCARTAR',
    numero: 4,
    rotulo: 'Descartar / Evitar',
    descricao: 'Baixo benefício, alto esforço',
    recomendacao: 'Questionar antes de investir.',
  },
}
