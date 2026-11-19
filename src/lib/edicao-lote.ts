/**
 * Edição em lote de ações — módulo puro: lê o pedido, planeja o que mudaria em
 * cada ação (a prévia) e monta o texto do aviso por e-mail. Quem toca o banco é
 * `acao-lote.ts` (gravação) e `projetos/acoes-lote.ts` (Server Actions).
 *
 * Duas operações, combináveis: deslocar o PREVISTO em N dias úteis e trocar o
 * responsável. Status e datas realizadas ficam de fora de propósito: concluir
 * várias de uma vez pede as datas realizadas, e o risco de erro em lote é maior.
 */

import { serializarValor, type CampoAuditado } from './acao-historico'
import { deslocarDiasUteis } from './dias-uteis'
import { escaparHtml, type MensagemEmail } from './email-responsavel'
import { formatarValorHistorico } from './historico-exibicao'

/** Teto por operação: a gravação segue rápida e a prévia, legível. */
export const LIMITE_LOTE = 100
export const MAX_DIAS_UTEIS = 250

/** Valor do campo `responsavelId` que significa "remover o responsável". */
export const SEM_RESPONSAVEL = '__nenhum__'

export type PedidoLote = {
  ids: string[]
  /** Dias úteis a somar (negativo = adiantar); 0 = não deslocar. */
  deslocamento: number
  /** `undefined` = não mexer; `null` = remover; texto = id do colaborador. */
  responsavelId: string | null | undefined
}

export type ResultadoPedido =
  | { ok: true; pedido: PedidoLote }
  | { ok: false; erro: string }

export function lerPedidoLote(formData: FormData): ResultadoPedido {
  const ids = [
    ...new Set(
      formData
        .getAll('ids')
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '')
        .map((v) => v.trim()),
    ),
  ]
  if (ids.length === 0) return { ok: false, erro: 'Marque pelo menos uma ação.' }
  if (ids.length > LIMITE_LOTE) {
    return {
      ok: false,
      erro: `São ${ids.length} ações marcadas; o limite é ${LIMITE_LOTE} por operação. Desmarque algumas.`,
    }
  }

  const bruta = String(formData.get('quantidade') ?? '').trim()
  let deslocamento = 0
  if (bruta !== '') {
    const n = Number(bruta)
    if (!Number.isInteger(n) || n < 0 || n > MAX_DIAS_UTEIS) {
      return {
        ok: false,
        erro: `Informe de 0 a ${MAX_DIAS_UTEIS} dias úteis, em número inteiro.`,
      }
    }
    deslocamento = formData.get('sentido') === 'adiantar' ? -n : n
  }

  const resp = formData.get('responsavelId')
  const responsavelId =
    typeof resp !== 'string' || resp.trim() === ''
      ? undefined
      : resp === SEM_RESPONSAVEL
        ? null
        : resp.trim()

  if (deslocamento === 0 && responsavelId === undefined) {
    return { ok: false, erro: 'Escolha o que fazer: deslocar o previsto ou trocar o responsável.' }
  }
  return { ok: true, pedido: { ids, deslocamento, responsavelId } }
}

export type AcaoDoLote = {
  id: string
  numero: number
  descricao: string
  status: string
  previstoInicio: Date | null
  previstoTermino: Date | null
  responsavelId: string | null
  responsavelNome: string | null
  /** `updatedAt`: a gravação confere que a ação ainda está nesta versão. */
  versao: Date
}

export type MudancaPlanejada = {
  campo: Extract<CampoAuditado, 'previstoInicio' | 'previstoTermino' | 'responsavel'>
  de: string | null
  para: string | null
}

export type ItemDoPlano = {
  acaoId: string
  numero: number
  descricao: string
  versao: Date
  mudancas: MudancaPlanejada[]
  /** Por que a ação não muda (ou só muda em parte); `null` se nada a avisar. */
  observacao: string | null
  /** Valores novos, no formato do `update` da Ação e do histórico. */
  dados: { previstoInicio?: Date | null; previstoTermino?: Date | null; responsavelId?: string | null }
  novos: Partial<Record<CampoAuditado, Date | string | null>>
}

/**
 * O que mudaria em cada ação. Regras:
 * - concluída não tem o previsto remarcado (mexeria na aderência de prazo já medida);
 * - sem data prevista, não há o que deslocar;
 * - responsável igual ao atual não gera mudança.
 */
export function planejarLote(
  acoes: AcaoDoLote[],
  pedido: Pick<PedidoLote, 'deslocamento' | 'responsavelId'>,
  nomeDoResponsavel: string | null,
): ItemDoPlano[] {
  return acoes.map((acao) => {
    const mudancas: MudancaPlanejada[] = []
    const dados: ItemDoPlano['dados'] = {}
    const novos: ItemDoPlano['novos'] = {}
    const observacoes: string[] = []

    if (pedido.deslocamento !== 0) {
      if (acao.status === 'CONCLUIDO') {
        observacoes.push('concluída: o previsto não é remarcado')
      } else if (acao.previstoInicio === null && acao.previstoTermino === null) {
        observacoes.push('sem data prevista: nada a deslocar')
      } else {
        for (const campo of ['previstoInicio', 'previstoTermino'] as const) {
          const atual = acao[campo]
          if (atual === null) continue
          const nova = deslocarDiasUteis(atual, pedido.deslocamento)
          dados[campo] = nova
          novos[campo] = nova
          mudancas.push({ campo, de: serializarValor(atual), para: serializarValor(nova) })
        }
      }
    }

    if (pedido.responsavelId !== undefined) {
      if (pedido.responsavelId === acao.responsavelId) {
        observacoes.push('o responsável já é esse')
      } else {
        dados.responsavelId = pedido.responsavelId
        novos.responsavel = nomeDoResponsavel
        mudancas.push({ campo: 'responsavel', de: acao.responsavelNome, para: nomeDoResponsavel })
      }
    }

    return {
      acaoId: acao.id,
      numero: acao.numero,
      descricao: acao.descricao,
      versao: acao.versao,
      mudancas,
      observacao: observacoes.length > 0 ? observacoes.join('; ') : null,
      dados,
      novos,
    }
  })
}

/** Resumo de uma linha da operação, para o topo da prévia. */
export function descreverPedido(
  pedido: Pick<PedidoLote, 'deslocamento' | 'responsavelId'>,
  nomeDoResponsavel: string | null,
): string {
  const partes: string[] = []
  if (pedido.deslocamento !== 0) {
    const n = Math.abs(pedido.deslocamento)
    partes.push(
      `${pedido.deslocamento > 0 ? 'adiar' : 'adiantar'} o previsto em ${n} ${n === 1 ? 'dia útil' : 'dias úteis'}`,
    )
  }
  if (pedido.responsavelId !== undefined) {
    partes.push(
      pedido.responsavelId === null
        ? 'remover o responsável'
        : `passar o responsável para ${nomeDoResponsavel ?? 'a pessoa escolhida'}`,
    )
  }
  const texto = partes.join(' e ')
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

export const ROTULO_CAMPO_LOTE: Record<MudancaPlanejada['campo'], string> = {
  previstoInicio: 'Início previsto',
  previstoTermino: 'Término previsto',
  responsavel: 'Responsável',
}

/** Um e-mail por pessoa, com todas as ações que passaram a ser dela nesta operação. */
export function montarAvisoLote(dados: {
  responsavel: string
  projeto: { nome: string; referencia: string | null }
  acoes: { numero: number; descricao: string; previstoInicio: string | null; previstoTermino: string | null }[]
  link: string | null
}): MensagemEmail {
  const { projeto, acoes } = dados
  const nomeProjeto = projeto.referencia ? `${projeto.referencia} — ${projeto.nome}` : projeto.nome
  const n = acoes.length
  const assunto = `${n} ${n === 1 ? 'ação passou' : 'ações passaram'} para você — ${projeto.nome}`
  const periodo = (a: (typeof acoes)[number]) =>
    a.previstoInicio || a.previstoTermino
      ? ` (previsto ${formatarValorHistorico('previstoInicio', a.previstoInicio)} a ${formatarValorHistorico('previstoTermino', a.previstoTermino)})`
      : ''

  const texto = [
    `Olá, ${dados.responsavel}.`,
    '',
    `${n === 1 ? 'Uma ação passou' : `${n} ações passaram`} a ter você como responsável.`,
    '',
    `Projeto: ${nomeProjeto}`,
    ...acoes.map((a) => `- Ação ${a.numero}: ${a.descricao}${periodo(a)}`),
    ...(dados.link ? ['', `Abrir o projeto: ${dados.link}`] : []),
    '',
    'Mensagem automática do Cronograma CTCEA.',
  ].join('\n')

  const e = escaparHtml
  const html = [
    `<p>Olá, ${e(dados.responsavel)}.</p>`,
    `<p>${n === 1 ? 'Uma ação passou' : `${n} ações passaram`} a ter você como responsável.</p>`,
    `<p><strong>Projeto:</strong> ${e(nomeProjeto)}</p>`,
    '<ul>',
    ...acoes.map((a) => `<li><strong>Ação ${a.numero}:</strong> ${e(a.descricao)}${e(periodo(a))}</li>`),
    '</ul>',
    ...(dados.link ? [`<p><a href="${e(dados.link)}">Abrir o projeto</a></p>`] : []),
    '<p style="color:#5B6B76;font-size:12px">Mensagem automática do Cronograma CTCEA.</p>',
  ].join('\n')

  return { assunto, texto, html }
}
