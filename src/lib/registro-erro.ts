/**
 * Regras do registro de erros — módulo puro.
 *
 * O texto de um erro pode carregar dados (um Prisma com os valores da consulta,
 * o corpo de uma resposta). Por isso tudo é truncado, e só o administrador lê.
 */

export const MAX_MENSAGEM = 500
export const MAX_DETALHE = 4000
export const DIAS_DE_RETENCAO = 30
const MS_POR_DIA = 24 * 60 * 60 * 1000

function cortar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1)}…`
}

/** Mensagem curta e detalhe (pilha) de qualquer coisa que tenha sido lançada. */
export function descreverErro(erro: unknown): { mensagem: string; detalhe: string | null } {
  if (erro instanceof Error) {
    return {
      mensagem: cortar(`${erro.name}: ${erro.message}`, MAX_MENSAGEM),
      detalhe: erro.stack ? cortar(erro.stack, MAX_DETALHE) : null,
    }
  }
  if (typeof erro === 'string') return { mensagem: cortar(erro, MAX_MENSAGEM), detalhe: null }
  let texto: string
  try {
    texto = JSON.stringify(erro) ?? String(erro)
  } catch {
    texto = String(erro)
  }
  return { mensagem: cortar(texto, MAX_MENSAGEM), detalhe: null }
}

/**
 * Só produção grava. Preview e desenvolvimento usam o mesmo banco que
 * produção: gravar de lá misturaria erros de teste com erros de verdade.
 */
export function deveRegistrar(env: Readonly<Record<string, string | undefined>>): boolean {
  return env.VERCEL_ENV === 'production'
}

/** Registros anteriores a isto são apagados. */
export function limiteDeRetencao(agora: Date): Date {
  return new Date(agora.getTime() - DIAS_DE_RETENCAO * MS_POR_DIA)
}
