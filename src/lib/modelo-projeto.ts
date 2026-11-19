/**
 * Modelos de projeto — módulo puro.
 *
 * Um modelo guarda as ações com datas RELATIVAS ao início do projeto, em dias
 * úteis; criar um projeto a partir dele é informar a data de início e deixar o
 * cálculo posicionar cada ação. As duas direções usam as mesmas funções de
 * `dias-uteis.ts`, então "salvar como modelo" e "criar do modelo" no mesmo
 * início devolvem as datas originais (para datas em dia útil).
 *
 * Aproximação, dita na tela: uma data de INÍCIO em sábado, domingo ou feriado
 * volta como o dia útil anterior, porque o deslocamento é contado em dias úteis.
 */

import { deslocarDiasUteis, diasUteisEntre, ehDiaUtil, somarDiasUteis } from './dias-uteis'

export const LIMITE_ACOES_MODELO = 200
const TAMANHO_MAXIMO_NOME = 120
const TAMANHO_MAXIMO_DESCRICAO = 1000

export type AcaoDeOrigem = {
  numero: number
  descricao: string
  previstoInicio: Date | null
  previstoTermino: Date | null
}

export type ItemDoModelo = {
  ordem: number
  descricao: string
  inicioDiasUteis: number | null
  duracaoDiasUteis: number | null
}

/**
 * Dias úteis em (base, data]: o `n` tal que `deslocarDiasUteis(base, n)` cai em
 * `data` quando ela é dia útil. `diasUteisEntre` conta as duas pontas, então se
 * a base for dia útil ela entra na conta e sai; se não for, nada a descontar.
 */
function diasUteisApos(base: Date, data: Date): number {
  if (data.getTime() <= base.getTime()) return 0
  return diasUteisEntre(base, data) - (ehDiaUtil(base) ? 1 : 0)
}

/**
 * Transforma as ações de um projeto nos itens do modelo. A âncora é o MENOR
 * início previsto: a ação mais cedo começa no dia 0. Ação sem datas vira item
 * sem datas (o modelo guarda a descrição e nada mais).
 */
export function construirItensDoModelo(acoes: readonly AcaoDeOrigem[]): ItemDoModelo[] {
  const ordenadas = [...acoes].sort((a, b) => a.numero - b.numero)
  const inicios = ordenadas
    .map((a) => a.previstoInicio)
    .filter((d): d is Date => d !== null)
    .map((d) => d.getTime())
  const base = inicios.length > 0 ? new Date(Math.min(...inicios)) : null

  return ordenadas.map((acao, indice) => {
    const inicio =
      base !== null && acao.previstoInicio !== null
        ? diasUteisApos(base, acao.previstoInicio)
        : null
    const duracao =
      acao.previstoInicio !== null && acao.previstoTermino !== null
        ? Math.max(1, diasUteisEntre(acao.previstoInicio, acao.previstoTermino))
        : null
    return {
      ordem: indice + 1,
      descricao: acao.descricao,
      inicioDiasUteis: inicio,
      duracaoDiasUteis: duracao,
    }
  })
}

export type AcaoInstanciada = {
  numero: number
  descricao: string
  previstoInicio: Date | null
  previstoTermino: Date | null
}

/** A própria data se for dia útil; senão, o próximo dia útil. */
export function primeiroDiaUtilApartirDe(data: Date): Date {
  let cursor = new Date(Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()))
  while (!ehDiaUtil(cursor)) cursor = new Date(cursor.getTime() + 86_400_000)
  return cursor
}

/**
 * As ações do novo projeto, com as datas posicionadas a partir de
 * `inicioDoProjeto`. Início em fim de semana ou feriado vale o próximo dia útil:
 * uma ação que começasse num sábado seria um erro de calendário.
 */
export function instanciarModelo(
  itens: readonly ItemDoModelo[],
  inicioDoProjeto: Date,
): AcaoInstanciada[] {
  const inicioEfetivo = primeiroDiaUtilApartirDe(inicioDoProjeto)
  return [...itens]
    .sort((a, b) => a.ordem - b.ordem)
    .map((item, indice) => {
      if (item.inicioDiasUteis === null) {
        return { numero: indice + 1, descricao: item.descricao, previstoInicio: null, previstoTermino: null }
      }
      const inicio = deslocarDiasUteis(inicioEfetivo, item.inicioDiasUteis)
      const termino =
        item.duracaoDiasUteis === null ? null : somarDiasUteis(inicio, item.duracaoDiasUteis)
      return { numero: indice + 1, descricao: item.descricao, previstoInicio: inicio, previstoTermino: termino }
    })
}

/** "começa no dia útil 6, dura 5 dias úteis", para a tela mostrar o que o modelo guarda. */
export function descreverItem(item: ItemDoModelo): string {
  if (item.inicioDiasUteis === null) return 'sem datas'
  const comeca =
    item.inicioDiasUteis === 0 ? 'começa no dia do início' : `começa ${item.inicioDiasUteis} dia(s) útil(eis) depois do início`
  const dura =
    item.duracaoDiasUteis === null ? '' : `, dura ${item.duracaoDiasUteis} dia(s) útil(eis)`
  return `${comeca}${dura}`
}

export type ResultadoNomeModelo =
  | { ok: true; nome: string; descricao: string | null }
  | { ok: false; erro: string }

export function lerDadosDoModelo(formData: FormData): ResultadoNomeModelo {
  const nome = String(formData.get('nome') ?? '').trim().replace(/\s+/g, ' ')
  const descricao = String(formData.get('descricao') ?? '').trim()
  if (nome === '') return { ok: false, erro: 'Dê um nome ao modelo.' }
  if (nome.length > TAMANHO_MAXIMO_NOME) {
    return { ok: false, erro: `O nome pode ter no máximo ${TAMANHO_MAXIMO_NOME} caracteres.` }
  }
  if (descricao.length > TAMANHO_MAXIMO_DESCRICAO) {
    return { ok: false, erro: `A descrição pode ter no máximo ${TAMANHO_MAXIMO_DESCRICAO} caracteres.` }
  }
  return { ok: true, nome, descricao: descricao === '' ? null : descricao }
}

/** Quem exclui um modelo: quem o salvou, ou um administrador. */
export function podeExcluirModelo(criadoPor: string, usuario: string, administrador: boolean): boolean {
  return administrador || criadoPor === usuario
}
