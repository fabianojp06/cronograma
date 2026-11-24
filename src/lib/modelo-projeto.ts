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

import { chaveDoNome } from './colaborador-validacao'
import { deslocarDiasUteis, diasUteisEntre, ehDiaUtil, somarDiasUteis } from './dias-uteis'
import { faseDmaicDoNome } from './dmaic'
import { MAXIMO_MACROETAPAS, TAMANHO_NOME_MACROETAPA } from './macroetapa'

export const LIMITE_ACOES_MODELO = 200
const TAMANHO_MAXIMO_NOME = 120
const TAMANHO_MAXIMO_DESCRICAO = 1000

export type AcaoDeOrigem = {
  numero: number
  descricao: string
  previstoInicio: Date | null
  previstoTermino: Date | null
  /** Nome da macroetapa da ação; ausente/nulo = sem macroetapa. */
  macroetapa?: string | null
}

export type ItemDoModelo = {
  ordem: number
  descricao: string
  inicioDiasUteis: number | null
  duracaoDiasUteis: number | null
  /** Nome da macroetapa em que a ação entra no projeto criado; omitido = nenhuma. */
  macroetapa?: string | null
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
      ...(acao.macroetapa ? { macroetapa: acao.macroetapa } : {}),
    }
  })
}

export type AcaoInstanciada = {
  numero: number
  descricao: string
  previstoInicio: Date | null
  previstoTermino: Date | null
  macroetapa: string | null
}

/**
 * As macroetapas que o modelo cria: nomes distintos (sem acento nem caixa), na ordem
 * em que aparecem, com a descrição quando o nome é uma fase do DMAIC.
 */
export function macroetapasDoModelo(
  itens: readonly { macroetapa?: string | null }[],
): { nome: string; descricao: string | null }[] {
  const vistas = new Set<string>()
  const lista: { nome: string; descricao: string | null }[] = []
  for (const item of itens) {
    const nome = item.macroetapa?.trim()
    if (!nome) continue
    const chave = chaveDoNome(nome)
    if (vistas.has(chave)) continue
    vistas.add(chave)
    lista.push({ nome, descricao: faseDmaicDoNome(nome)?.descricao ?? null })
  }
  return lista
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
        return { numero: indice + 1, descricao: item.descricao, previstoInicio: null, previstoTermino: null, macroetapa: item.macroetapa ?? null }
      }
      const inicio = deslocarDiasUteis(inicioEfetivo, item.inicioDiasUteis)
      const termino =
        item.duracaoDiasUteis === null ? null : somarDiasUteis(inicio, item.duracaoDiasUteis)
      return { numero: indice + 1, descricao: item.descricao, previstoInicio: inicio, previstoTermino: termino, macroetapa: item.macroetapa ?? null }
    })
}

/** "começa no dia útil 6, dura 5 dias úteis", para a tela mostrar o que o modelo guarda. */
export function descreverItem(item: ItemDoModelo): string {
  const macro = item.macroetapa ? `macroetapa ${item.macroetapa}; ` : ''
  return macro + descreverDatas(item)
}

function descreverDatas(item: ItemDoModelo): string {
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

/**
 * Quem edita um modelo: a mesma regra de excluir — quem o criou ou um
 * administrador. Modelo "do sistema" (carregado pelo script) não tem dono: só
 * administrador.
 */
export function podeAlterarModelo(criadoPor: string, usuario: string, administrador: boolean): boolean {
  return podeExcluirModelo(criadoPor, usuario, administrador)
}

export const LIMITE_DIA_MODELO = 1000
const TAMANHO_MAXIMO_ACAO = 500
const TAMANHO_MAXIMO_CAMPO = 500

export const CAMPOS_CLASSIFICACAO_MODELO = [
  'equipe',
  'natureza',
  'categoria',
  'apoio',
  'setorEnvolvido',
] as const

export type ClassificacaoModelo = { [C in (typeof CAMPOS_CLASSIFICACAO_MODELO)[number]]: string | null }

export type ErroLinhaModelo = { linha: number; erro: string }

export type ResultadoItensModelo =
  | { ok: true; itens: ItemDoModelo[] }
  | { ok: false; erros: ErroLinhaModelo[]; erroGeral?: string }

function lerInteiro(bruto: string): number | null | undefined {
  const t = bruto.trim()
  if (t === '') return null
  if (!/^\d+$/.test(t)) return undefined
  return Number(t)
}

/**
 * Lê a lista de ações do formulário do editor de modelos: três campos
 * paralelos repetidos (`acaoDescricao`, `acaoInicio`, `acaoDuracao`). Linha
 * totalmente vazia é ignorada; descrição é obrigatória; início e duração vêm
 * juntos (ou os dois vazios, e a ação fica sem datas). Os números de linha dos
 * erros são os da TELA (1 = primeira linha).
 */
export function lerItensDoFormulario(formData: FormData): ResultadoItensModelo {
  const descricoes = formData.getAll('acaoDescricao').map(String)
  const inicios = formData.getAll('acaoInicio').map(String)
  const duracoes = formData.getAll('acaoDuracao').map(String)
  const macroetapas = formData.getAll('acaoMacroetapa').map(String)

  const erros: ErroLinhaModelo[] = []
  const itens: ItemDoModelo[] = []

  descricoes.forEach((bruta, i) => {
    const descricao = bruta.trim().replace(/\s+/g, ' ')
    const inicioBruto = inicios[i] ?? ''
    const duracaoBruta = duracoes[i] ?? ''
    const linha = i + 1
    if (descricao === '' && inicioBruto.trim() === '' && duracaoBruta.trim() === '') return

    if (descricao === '') {
      erros.push({ linha, erro: 'Descreva a ação.' })
      return
    }
    if (descricao.length > TAMANHO_MAXIMO_ACAO) {
      erros.push({ linha, erro: `A descrição pode ter no máximo ${TAMANHO_MAXIMO_ACAO} caracteres.` })
      return
    }
    const macroetapa = (macroetapas[i] ?? '').trim().replace(/\s+/g, ' ')
    if (macroetapa.length > TAMANHO_NOME_MACROETAPA) {
      erros.push({ linha, erro: `O nome da macroetapa pode ter no máximo ${TAMANHO_NOME_MACROETAPA} caracteres.` })
      return
    }
    const inicio = lerInteiro(inicioBruto)
    const duracao = lerInteiro(duracaoBruta)
    if (inicio === undefined || duracao === undefined) {
      erros.push({ linha, erro: 'Use números inteiros em dias úteis.' })
      return
    }
    if ((inicio === null) !== (duracao === null)) {
      erros.push({ linha, erro: 'Informe o início e a duração, ou deixe os dois em branco.' })
      return
    }
    if (inicio !== null && duracao !== null) {
      if (duracao < 1) {
        erros.push({ linha, erro: 'A duração mínima é 1 dia útil.' })
        return
      }
      if (inicio > LIMITE_DIA_MODELO || duracao > LIMITE_DIA_MODELO) {
        erros.push({ linha, erro: `Use no máximo ${LIMITE_DIA_MODELO} dias úteis.` })
        return
      }
    }
    itens.push({
      ordem: itens.length + 1,
      descricao,
      inicioDiasUteis: inicio,
      duracaoDiasUteis: duracao,
      ...(macroetapa !== '' ? { macroetapa } : {}),
    })
  })

  if (erros.length > 0) return { ok: false, erros }
  if (itens.length === 0) {
    return { ok: false, erros: [], erroGeral: 'Acrescente pelo menos uma ação ao modelo.' }
  }
  if (itens.length > LIMITE_ACOES_MODELO) {
    return { ok: false, erros: [], erroGeral: `O modelo guarda até ${LIMITE_ACOES_MODELO} ações.` }
  }
  if (macroetapasDoModelo(itens).length > MAXIMO_MACROETAPAS) {
    return { ok: false, erros: [], erroGeral: `Um projeto tem no máximo ${MAXIMO_MACROETAPAS} macroetapas: use menos nomes distintos.` }
  }
  return { ok: true, itens }
}

/** Classificação do modelo (campos de texto opcionais, aparados; vazio vira `null`). */
export function lerClassificacaoDoModelo(
  formData: FormData,
): { ok: true; classificacao: ClassificacaoModelo } | { ok: false; erro: string } {
  const classificacao = {} as ClassificacaoModelo
  for (const campo of CAMPOS_CLASSIFICACAO_MODELO) {
    const valor = String(formData.get(campo) ?? '').trim()
    if (valor.length > TAMANHO_MAXIMO_CAMPO) {
      return { ok: false, erro: `Cada campo de classificação pode ter no máximo ${TAMANHO_MAXIMO_CAMPO} caracteres.` }
    }
    classificacao[campo] = valor === '' ? null : valor
  }
  return { ok: true, classificacao }
}

/** Dia útil (a partir do início do projeto) em que a ação termina, para a prévia do editor. */
export function diaDeTerminoDoItem(item: Pick<ItemDoModelo, 'inicioDiasUteis' | 'duracaoDiasUteis'>): number | null {
  if (item.inicioDiasUteis === null || item.duracaoDiasUteis === null) return null
  return item.inicioDiasUteis + item.duracaoDiasUteis - 1
}
