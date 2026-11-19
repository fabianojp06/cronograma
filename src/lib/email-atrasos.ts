/**
 * Aviso semanal de ações atrasadas — módulo puro: agrupa por responsável e
 * monta o texto. Quem busca no banco e envia é `avisar-atrasos.ts`.
 *
 * A regra de atraso é a MESMA do painel (`acaoEstaAtrasada`): o e-mail nunca
 * pode citar uma ação que a tela não mostra como atrasada.
 */

import { StatusAcao } from '../generated/prisma/enums'
import { escaparHtml, type MensagemEmail } from './email-responsavel'
import { formatarValorHistorico } from './historico-exibicao'
import { acaoEstaAtrasada } from './projeto-resumo'

export type AcaoParaAviso = {
  id: string
  projetoId: string
  numero: number
  descricao: string
  status: StatusAcao
  previstoTermino: Date | null
  realizadoTermino: Date | null
  projeto: { nome: string; referencia: string | null }
  responsavel: { id: string; nome: string; email: string | null } | null
}

export type ItemAtraso = {
  acaoId: string
  projetoId: string
  projeto: string
  numero: number
  descricao: string
  /** `aaaa-mm-dd`. */
  previstoTermino: string
  diasDeAtraso: number
}

export type AtrasosDeUmResponsavel = {
  nome: string
  email: string
  itens: ItemAtraso[]
}

const DIA_MS = 86_400_000

/**
 * Agrupa as ações atrasadas por responsável. Ficam de fora, sem erro: ação sem
 * responsável (não há a quem avisar) e responsável sem e-mail (o envio falharia
 * por definição). O mais atrasado vem primeiro, que é o que pede ação.
 */
export function agruparAtrasos(
  acoes: readonly AcaoParaAviso[],
  hoje: Date,
): AtrasosDeUmResponsavel[] {
  const porPessoa = new Map<string, AtrasosDeUmResponsavel>()

  for (const acao of acoes) {
    const pessoa = acao.responsavel
    if (!pessoa?.email || !acaoEstaAtrasada(acao, hoje) || !acao.previstoTermino) continue

    const grupo = porPessoa.get(pessoa.id) ?? { nome: pessoa.nome, email: pessoa.email, itens: [] }
    grupo.itens.push({
      acaoId: acao.id,
      projetoId: acao.projetoId,
      projeto: acao.projeto.referencia
        ? `${acao.projeto.referencia} — ${acao.projeto.nome}`
        : acao.projeto.nome,
      numero: acao.numero,
      descricao: acao.descricao,
      previstoTermino: acao.previstoTermino.toISOString().slice(0, 10),
      diasDeAtraso: Math.round((hoje.getTime() - acao.previstoTermino.getTime()) / DIA_MS),
    })
    porPessoa.set(pessoa.id, grupo)
  }

  const grupos = [...porPessoa.values()]
  for (const g of grupos) {
    g.itens.sort((a, b) => b.diasDeAtraso - a.diasDeAtraso || a.projeto.localeCompare(b.projeto))
  }
  return grupos.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

function diasPorExtenso(dias: number): string {
  return dias === 1 ? '1 dia' : `${dias} dias`
}

export function montarAvisoAtrasos(
  grupo: AtrasosDeUmResponsavel,
  urlBase: string | null,
): MensagemEmail {
  const total = grupo.itens.length
  const assunto =
    total === 1
      ? 'Você tem 1 ação atrasada — Cronograma CTCEA'
      : `Você tem ${total} ações atrasadas — Cronograma CTCEA`
  const abertura =
    total === 1
      ? 'Esta ação sob sua responsabilidade passou do prazo previsto e ainda não foi concluída:'
      : `Estas ${total} ações sob sua responsabilidade passaram do prazo previsto e ainda não foram concluídas:`
  const link = (item: ItemAtraso) =>
    urlBase ? `${urlBase}/projetos/${item.projetoId}/acoes/${item.acaoId}/editar` : null

  const linha = (i: ItemAtraso) =>
    `${i.projeto} · Ação ${i.numero}: ${i.descricao} — prazo ${formatarValorHistorico('previstoTermino', i.previstoTermino)}, ${diasPorExtenso(i.diasDeAtraso)} de atraso`

  const texto = [
    `Olá, ${grupo.nome}.`,
    '',
    abertura,
    '',
    ...grupo.itens.flatMap((i) => [`• ${linha(i)}`, ...(link(i) ? [`  ${link(i)}`] : [])]),
    '',
    'Se já concluiu, registre o realizado na ação. Se o prazo mudou, ajuste a data prevista.',
    '',
    'Mensagem automática do Cronograma CTCEA, enviada às segundas-feiras.',
  ].join('\n')

  const e = escaparHtml
  const html = [
    `<p>Olá, ${e(grupo.nome)}.</p>`,
    `<p>${e(abertura)}</p>`,
    '<ul>',
    ...grupo.itens.map((i) => {
      const url = link(i)
      const rotulo = `Ação ${i.numero}: ${e(i.descricao)}`
      return (
        `<li><strong>${e(i.projeto)}</strong><br>` +
        `${url ? `<a href="${e(url)}">${rotulo}</a>` : rotulo}<br>` +
        `prazo ${formatarValorHistorico('previstoTermino', i.previstoTermino)} — ${diasPorExtenso(i.diasDeAtraso)} de atraso</li>`
      )
    }),
    '</ul>',
    '<p>Se já concluiu, registre o realizado na ação. Se o prazo mudou, ajuste a data prevista.</p>',
    '<p style="color:#5B6B76;font-size:12px">Mensagem automática do Cronograma CTCEA, enviada às segundas-feiras.</p>',
  ].join('\n')

  return { assunto, texto, html }
}
