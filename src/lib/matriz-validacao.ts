/**
 * Validação da Matriz de Priorização — módulo puro, sem Prisma e sem Next.
 *
 * Cobre duas entradas distintas: as notas de uma avaliação e os pesos dos
 * critérios. Separado da Server Action pelo mesmo motivo do resto do projeto:
 * a regra fica coberta por teste sem precisar de banco.
 */

import {
  CRITERIOS,
  ESCALA_GUT,
  ESCALA_NOTA,
  FATORES_GUT,
  IDS_CRITERIO,
  ROTULO_GRUPO,
  criteriosDoGrupo,
  ehNotaGutValida,
  ehNotaValida,
  GRUPOS_CRITERIO,
  type CriterioId,
  type FatorGut,
  type GrupoCriterio,
} from './matriz-criterios'
import { PESOS_PADRAO, type Avaliacao, type PesosCriterios } from './matriz-calculo'

export type EntradaFormulario =
  | FormData
  | Record<string, FormDataEntryValue | null | undefined>

function lerCampo(entrada: EntradaFormulario, campo: string): string {
  const bruto =
    typeof (entrada as FormData).get === 'function'
      ? (entrada as FormData).get(campo)
      : (entrada as Record<string, FormDataEntryValue | null | undefined>)[campo]

  return typeof bruto === 'string' ? bruto.trim() : ''
}

const TAMANHO_MAXIMO_OBSERVACAO = 2000

export type DadosAvaliacao = Avaliacao & { observacao: string | null }

export type ErrosAvaliacao = Partial<
  Record<CriterioId | FatorGut | 'observacao' | 'projetoId', string>
>

export type ResultadoAvaliacaoValidada =
  | { ok: true; dados: DadosAvaliacao }
  | { ok: false; erros: ErrosAvaliacao }

const ESCALA_NOTA_TEXTO = ESCALA_NOTA.join(', ')
const ESCALA_GUT_TEXTO = `${ESCALA_GUT[0]} a ${ESCALA_GUT[ESCALA_GUT.length - 1]}`

/**
 * Notas fora da escala são recusadas em vez de arredondadas para o valor mais
 * próximo. Uma nota 7 numa escala 0/3/6/9 quase sempre significa que alguém
 * mexeu no HTML ou que o formulário mudou — engolir isso em silêncio
 * contaminaria a priorização inteira sem deixar rastro.
 */
export function validarAvaliacao(
  entrada: EntradaFormulario,
): ResultadoAvaliacaoValidada {
  const erros: ErrosAvaliacao = {}
  const notas: Record<string, number> = {}

  for (const id of IDS_CRITERIO) {
    const bruto = lerCampo(entrada, id)
    if (bruto === '') {
      erros[id] = 'Escolha uma nota.'
      continue
    }
    const numero = Number(bruto)
    if (!ehNotaValida(numero)) {
      erros[id] = `Nota inválida — use ${ESCALA_NOTA_TEXTO}.`
      continue
    }
    notas[id] = numero
  }

  for (const fator of FATORES_GUT) {
    const bruto = lerCampo(entrada, fator)
    if (bruto === '') {
      erros[fator] = 'Escolha um valor.'
      continue
    }
    const numero = Number(bruto)
    if (!ehNotaGutValida(numero)) {
      erros[fator] = `Valor inválido — use ${ESCALA_GUT_TEXTO}.`
      continue
    }
    notas[fator] = numero
  }

  const observacaoBruta = lerCampo(entrada, 'observacao')
  if (observacaoBruta.length > TAMANHO_MAXIMO_OBSERVACAO) {
    erros.observacao = `Máximo de ${TAMANHO_MAXIMO_OBSERVACAO} caracteres.`
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros }

  return {
    ok: true,
    dados: {
      ...(notas as unknown as Avaliacao),
      observacao: observacaoBruta === '' ? null : observacaoBruta,
    },
  }
}

export type ErrosPesos = Partial<Record<CriterioId | GrupoCriterio, string>>

export type ResultadoPesosValidados =
  | { ok: true; dados: PesosCriterios }
  | { ok: false; erros: ErrosPesos }

export const SOMA_EXIGIDA = 100

export function somaDoGrupo(pesos: PesosCriterios, grupo: GrupoCriterio): number {
  return criteriosDoGrupo(grupo).reduce(
    (soma, criterio) => soma + (pesos[criterio.id] ?? 0),
    0,
  )
}

/**
 * Cada grupo precisa somar exatamente 100 — é a conferência que a planilha faz
 * com um SUM ao lado da linha de pesos. Os dois grupos são independentes:
 * benefício soma 100 entre os seus cinco critérios, esforço idem.
 */
export function validarPesos(entrada: EntradaFormulario): ResultadoPesosValidados {
  const erros: ErrosPesos = {}
  const pesos: Record<string, number> = {}

  for (const criterio of CRITERIOS) {
    const bruto = lerCampo(entrada, criterio.id)
    const numero = Number(bruto)

    if (bruto === '' || !Number.isInteger(numero)) {
      erros[criterio.id] = 'Informe um número inteiro.'
      continue
    }
    if (numero < 0 || numero > SOMA_EXIGIDA) {
      erros[criterio.id] = `Use um valor entre 0 e ${SOMA_EXIGIDA}.`
      continue
    }
    pesos[criterio.id] = numero
  }

  if (Object.keys(erros).length === 0) {
    for (const grupo of GRUPOS_CRITERIO) {
      const soma = somaDoGrupo(pesos as PesosCriterios, grupo)
      if (soma !== SOMA_EXIGIDA) {
        erros[grupo] =
          `Os pesos de ${ROTULO_GRUPO[grupo]} somam ${soma}% — precisam somar ${SOMA_EXIGIDA}%.`
      }
    }
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros }
  return { ok: true, dados: pesos as PesosCriterios }
}

/**
 * Monta os pesos vigentes a partir das linhas de `PesoCriterio`.
 *
 * Critério sem linha usa o peso padrão do catálogo, então a tabela vazia
 * equivale à configuração original da planilha — e um critério novo que apareça
 * no catálogo já nasce com peso, sem precisar de migração de dados.
 */
export function montarPesos(
  linhas: readonly { criterio: string; peso: number }[],
): PesosCriterios {
  const pesos: PesosCriterios = { ...PESOS_PADRAO }
  for (const linha of linhas) {
    if ((IDS_CRITERIO as string[]).includes(linha.criterio)) {
      pesos[linha.criterio as CriterioId] = linha.peso
    }
  }
  return pesos
}

/** `true` quando os pesos vigentes são exatamente os da planilha original. */
export function pesosSaoPadrao(pesos: PesosCriterios): boolean {
  return IDS_CRITERIO.every((id) => pesos[id] === PESOS_PADRAO[id])
}
