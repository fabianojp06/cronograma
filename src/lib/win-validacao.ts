/**
 * Validação do Card WIN — módulo puro, sem Prisma e sem Next.
 *
 * O limite de 3 WINs por semana é **rígido**, decisão registrada no
 * PROGRESS.md: "What's Important Now" só funciona se obrigar a escolher. A
 * planilha impõe isso pelo formato (três linhas, nem mais nem menos) e em oito
 * semanas ninguém tentou furar.
 */

import { StatusWin } from '../generated/prisma/enums'
import { periodoDaSemana, type SemanaCtcea } from './semana-ctcea'

export const MAXIMO_WINS_POR_SEMANA = 3

export const ORDENS_VALIDAS = [1, 2, 3] as const

export type OrdemWin = (typeof ORDENS_VALIDAS)[number]

export const ROTULO_STATUS_WIN: Record<StatusWin, string> = {
  PENDENTE: 'Pendente',
  EM_ANDAMENTO: 'Em andamento',
  FEITO: 'Feito',
  NAO_FEITO: 'Não feito',
}

/** Status que a planilha considera entrega concluída. */
export function ehConcluido(status: StatusWin): boolean {
  return status === StatusWin.FEITO
}

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

/**
 * Exportados porque a tela usa os mesmos números no `maxLength` dos campos.
 * O servidor continua sendo a autoridade — `maxLength` é só para o usuário
 * esbarrar no limite enquanto digita, em vez de perder o texto no envio.
 */
export const TAMANHO_MAXIMO_DESCRICAO = 300
export const TAMANHO_MAXIMO_SUPORTE = 120
export const TAMANHO_MAXIMO_TEXTO_LONGO = 2000

export type DadosWin = {
  descricao: string
  suporte: string | null
  prazo: Date | null
  status: StatusWin
}

export type ErrosWin = Partial<Record<keyof DadosWin, string>>

export type ResultadoWin =
  | { ok: true; dados: DadosWin }
  | { ok: false; erros: ErrosWin }

function ehStatusValido(valor: string): valor is StatusWin {
  return Object.values(StatusWin).includes(valor as StatusWin)
}

/**
 * Valida um WIN. O prazo é opcional, mas quando existe precisa cair **dentro
 * da semana do card**: um prazo fora da semana é quase sempre erro de
 * digitação, e na planilha isso já aconteceu — a aba S33 tem WINs da semana
 * 33 com prazo em 14/08, que é semana 34.
 */
export function validarWin(
  entrada: EntradaFormulario,
  semana: SemanaCtcea,
): ResultadoWin {
  const erros: ErrosWin = {}

  const descricao = lerCampo(entrada, 'descricao')
  if (descricao === '') {
    erros.descricao = 'Descreva o WIN.'
  } else if (descricao.length > TAMANHO_MAXIMO_DESCRICAO) {
    erros.descricao = `Máximo de ${TAMANHO_MAXIMO_DESCRICAO} caracteres.`
  }

  const suporte = lerCampo(entrada, 'suporte')
  if (suporte.length > TAMANHO_MAXIMO_SUPORTE) {
    erros.suporte = `Máximo de ${TAMANHO_MAXIMO_SUPORTE} caracteres.`
  }

  const statusBruto = lerCampo(entrada, 'status')
  const status = statusBruto === '' ? StatusWin.PENDENTE : statusBruto
  if (!ehStatusValido(status)) {
    erros.status = 'Status inválido.'
  }

  const prazoBruto = lerCampo(entrada, 'prazo')
  let prazo: Date | null = null
  if (prazoBruto !== '') {
    // `<input type="date">` entrega aaaa-mm-dd; lido como UTC, igual ao resto.
    const data = new Date(`${prazoBruto}T00:00:00.000Z`)
    if (Number.isNaN(data.getTime())) {
      erros.prazo = 'Data inválida.'
    } else {
      const { inicio, fim } = periodoDaSemana(semana)
      if (data.getTime() < inicio.getTime() || data.getTime() > fim.getTime()) {
        erros.prazo = 'O prazo precisa cair dentro da semana do card.'
      } else {
        prazo = data
      }
    }
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros }

  return {
    ok: true,
    dados: {
      descricao,
      suporte: suporte === '' ? null : suporte,
      prazo,
      status: status as StatusWin,
    },
  }
}

export type DadosCard = {
  area: string | null
  atividade: string | null
  alertaRiscos: string | null
  pedidoAjuda: string | null
}

export type ErrosCard = Partial<Record<keyof DadosCard, string>>

export type ResultadoCard =
  | { ok: true; dados: DadosCard }
  | { ok: false; erros: ErrosCard }

export function validarCard(entrada: EntradaFormulario): ResultadoCard {
  const erros: ErrosCard = {}
  const campos: DadosCard = {
    area: null,
    atividade: null,
    alertaRiscos: null,
    pedidoAjuda: null,
  }

  for (const campo of Object.keys(campos) as (keyof DadosCard)[]) {
    const valor = lerCampo(entrada, campo)
    if (valor.length > TAMANHO_MAXIMO_TEXTO_LONGO) {
      erros[campo] = `Máximo de ${TAMANHO_MAXIMO_TEXTO_LONGO} caracteres.`
      continue
    }
    campos[campo] = valor === '' ? null : valor
  }

  if (Object.keys(erros).length > 0) return { ok: false, erros }
  return { ok: true, dados: campos }
}

export type ErroLimite = 'LIMITE_ATINGIDO' | 'ORDEM_INVALIDA' | 'ORDEM_OCUPADA'

export const MENSAGEM_ERRO_LIMITE: Record<ErroLimite, string> = {
  LIMITE_ATINGIDO: `A semana já tem ${MAXIMO_WINS_POR_SEMANA} WINs. Conclua, encerre ou troque um deles.`,
  ORDEM_INVALIDA: `A posição precisa ser de 1 a ${MAXIMO_WINS_POR_SEMANA}.`,
  ORDEM_OCUPADA: 'Já existe um WIN nessa posição da semana.',
}

/**
 * Decide se cabe mais um WIN na semana. O limite é do método, não da tela:
 * por isso vale também na importação e em qualquer caminho de gravação.
 */
export function podeAdicionarWin(
  ordensOcupadas: readonly number[],
  ordemDesejada: number,
): { ok: true } | { ok: false; erro: ErroLimite } {
  if (!(ORDENS_VALIDAS as readonly number[]).includes(ordemDesejada)) {
    return { ok: false, erro: 'ORDEM_INVALIDA' }
  }
  if (ordensOcupadas.length >= MAXIMO_WINS_POR_SEMANA) {
    return { ok: false, erro: 'LIMITE_ATINGIDO' }
  }
  if (ordensOcupadas.includes(ordemDesejada)) {
    return { ok: false, erro: 'ORDEM_OCUPADA' }
  }
  return { ok: true }
}

/** Primeira posição livre da semana, ou `null` quando as três estão ocupadas. */
export function proximaOrdemLivre(ordensOcupadas: readonly number[]): OrdemWin | null {
  return ORDENS_VALIDAS.find((ordem) => !ordensOcupadas.includes(ordem)) ?? null
}
