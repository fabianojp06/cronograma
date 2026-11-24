/**
 * Modelo DMAIC para as macroetapas (Flash Report) — módulo puro.
 * É OPCIONAL: o projeto escolhe aplicá-lo; macroetapa continua sendo um nome livre.
 * As fases são reconhecidas pelo NOME (`chaveDoNome`), então renomear uma fase para
 * outro texto a tira do DMAIC. As descrições resumem os artigos da Nomus e da Sults.
 */

import { chaveDoNome } from '@/lib/colaborador-validacao'

export type FaseDmaic = { sigla: 'D' | 'M' | 'A' | 'I' | 'C'; nome: string; descricao: string }

export const FASES_DMAIC: readonly FaseDmaic[] = [
  {
    sigla: 'D',
    nome: 'D – Definir',
    descricao:
      'Formaliza o problema, o escopo, a equipe, o prazo e o benefício esperado, para o projeto não virar uma investigação genérica. Entrega: contrato do projeto (Project Charter), SIPOC e voz do cliente (CTQ).',
  },
  {
    sigla: 'M',
    nome: 'M – Medir',
    descricao:
      'Mede como o processo está hoje, só com dados relevantes, e fixa a linha de base que permitirá provar o ganho no final. Entrega: mapa do processo, indicadores de base, Pareto e Ishikawa.',
  },
  {
    sigla: 'A',
    nome: 'A – Analisar',
    descricao:
      'Separa hipótese de fato: identifica as causas-raiz e as confirma com dados (gráficos, estatística ou análise de risco), não por consenso da equipe. Entrega: causas-raiz validadas, FMEA e testes de hipótese.',
  },
  {
    sigla: 'I',
    nome: 'I – Melhorar',
    descricao:
      'Prioriza as causas-raiz, implanta o plano de ação com as melhorias e compara o antes e o depois com dados. Costuma ser a fase mais longa. Entrega: plano de ação (5W2H), piloto e mudanças implantadas.',
  },
  {
    sigla: 'C',
    nome: 'C – Controlar',
    descricao:
      'Sustenta o ganho e passa a responsabilidade do processo para a operação: o que monitorar, com que frequência, quem responde e o que fazer se desviar. Entrega: plano de controle e procedimentos (POP) atualizados.',
  },
]

const POR_CHAVE = new Map(FASES_DMAIC.map((f) => [chaveDoNome(f.nome), f]))

/** A fase DMAIC que esse nome representa, ou `null` se for uma macroetapa comum. */
export function faseDmaicDoNome(nome: string): FaseDmaic | null {
  return POR_CHAVE.get(chaveDoNome(nome)) ?? null
}

/** As fases que o projeto ainda não tem, na ordem do DMAIC. */
export function fasesDmaicQueFaltam(existentes: readonly { nome: string }[]): FaseDmaic[] {
  const tem = new Set(existentes.map((e) => chaveDoNome(e.nome)))
  return FASES_DMAIC.filter((f) => !tem.has(chaveDoNome(f.nome)))
}

type LinhaDeFase = { nome: string; avanco: { realizado: number } | null }

/** As linhas que são fases DMAIC e têm ações (avanço calculável), na ordem D-M-A-I-C. */
function fasesMedidas(linhas: readonly LinhaDeFase[]): { fase: FaseDmaic; realizado: number }[] {
  const medidas: { fase: FaseDmaic; realizado: number }[] = []
  for (const l of linhas) {
    const fase = faseDmaicDoNome(l.nome)
    if (fase && l.avanco) medidas.push({ fase, realizado: l.avanco.realizado })
  }
  return medidas.sort((a, b) => FASES_DMAIC.indexOf(a.fase) - FASES_DMAIC.indexOf(b.fase))
}

/**
 * Fase em que o projeto está: a primeira, na ordem do DMAIC, com ações e realizado
 * abaixo de 100%. Com todas em 100%, devolve a última com `concluidas`.
 */
export function faseAtualDmaic(linhas: readonly LinhaDeFase[]): { nome: string; concluidas: boolean } | null {
  const medidas = fasesMedidas(linhas)
  if (medidas.length === 0) return null
  const aberta = medidas.find((m) => m.realizado < 100)
  if (aberta) return { nome: aberta.fase.nome, concluidas: false }
  return { nome: medidas[medidas.length - 1].fase.nome, concluidas: true }
}

/**
 * Fase posterior com avanço enquanto uma anterior (com ações) está em 0%: sinal de
 * solução implantada sem a etapa de trás. Uma frase por fase zerada, citando a
 * primeira posterior que já avançou. Anterior parcial é sobreposição normal.
 */
export function alertasDeFaseForaDeOrdem(linhas: readonly LinhaDeFase[]): string[] {
  const medidas = fasesMedidas(linhas)
  const frases: string[] = []
  medidas.forEach((m, i) => {
    if (m.realizado > 0) return
    const adiante = medidas.slice(i + 1).find((p) => p.realizado > 0)
    if (adiante) frases.push(`${adiante.fase.nome} já tem avanço, mas ${m.fase.nome} ainda está em 0%.`)
  })
  return frases
}
