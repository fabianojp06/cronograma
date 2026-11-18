/**
 * Texto do aviso ao responsável por uma ação — módulo puro, sem Prisma, sem
 * Next e sem rede. Sai em texto e em HTML; o HTML usa só marcação simples,
 * porque cliente de e-mail ignora boa parte do CSS e o Outlook mais ainda.
 */

import { formatarValorHistorico } from './historico-exibicao'

export type MotivoAviso = 'NOVA_ACAO' | 'ATRIBUIDA'

export type DadosAviso = {
  motivo: MotivoAviso
  responsavel: string
  acao: {
    numero: number
    descricao: string
    /** `aaaa-mm-dd`, como no histórico. */
    previstoInicio: string | null
    previstoTermino: string | null
  }
  projeto: { nome: string; referencia: string | null }
  /** Endereço da tela de edição da ação; sem ele, o e-mail sai sem link. */
  link: string | null
}

export type MensagemEmail = { assunto: string; texto: string; html: string }

/** Escapa o que veio do usuário antes de entrar no HTML. */
export function escaparHtml(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

function periodoPrevisto(acao: DadosAviso['acao']): string | null {
  const { previstoInicio: inicio, previstoTermino: termino } = acao
  if (!inicio && !termino) return null
  return `${formatarValorHistorico('previstoInicio', inicio)} a ${formatarValorHistorico('previstoTermino', termino)}`
}

export function montarAvisoResponsavel(dados: DadosAviso): MensagemEmail {
  const { acao, projeto } = dados
  const nomeProjeto = projeto.referencia ? `${projeto.referencia} — ${projeto.nome}` : projeto.nome
  const abertura =
    dados.motivo === 'NOVA_ACAO'
      ? 'Uma nova ação foi cadastrada com você como responsável.'
      : 'Você passou a ser o responsável por esta ação.'
  const periodo = periodoPrevisto(acao)

  const assunto = `Ação ${acao.numero} sob sua responsabilidade — ${projeto.nome}`

  const texto = [
    `Olá, ${dados.responsavel}.`,
    '',
    abertura,
    '',
    `Projeto: ${nomeProjeto}`,
    `Ação ${acao.numero}: ${acao.descricao}`,
    ...(periodo ? [`Previsto: ${periodo}`] : []),
    ...(dados.link ? ['', `Abrir a ação: ${dados.link}`] : []),
    '',
    'Mensagem automática do Cronograma CTCEA.',
  ].join('\n')

  const e = escaparHtml
  const html = [
    `<p>Olá, ${e(dados.responsavel)}.</p>`,
    `<p>${e(abertura)}</p>`,
    '<p>',
    `<strong>Projeto:</strong> ${e(nomeProjeto)}<br>`,
    `<strong>Ação ${acao.numero}:</strong> ${e(acao.descricao)}`,
    ...(periodo ? [`<br><strong>Previsto:</strong> ${e(periodo)}`] : []),
    '</p>',
    ...(dados.link ? [`<p><a href="${e(dados.link)}">Abrir a ação</a></p>`] : []),
    '<p style="color:#5B6B76;font-size:12px">Mensagem automática do Cronograma CTCEA.</p>',
  ].join('\n')

  return { assunto, texto, html }
}

/**
 * O que dizer a quem salvou, depois da tentativa de aviso. A ação já está
 * salva em todos os casos; a frase só conta se o responsável vai saber disso
 * pelo e-mail — sem ela, um aviso que não saiu passaria por enviado.
 */
export function mensagemDoAviso(
  responsavel: { nome: string; email: string | null },
  resultado: { enviado: true } | { enviado: false; motivo: string } | null,
): string {
  if (!responsavel.email || resultado === null) {
    return `${responsavel.nome} não tem e-mail cadastrado — o aviso não foi enviado.`
  }
  if (resultado.enviado) return `Aviso enviado para ${responsavel.email}.`
  switch (resultado.motivo) {
    case 'SEM_CHAVE':
      return 'O envio de e-mail ainda não está configurado — o aviso não foi enviado.'
    case 'FORA_DE_PRODUCAO':
      return 'Fora do ambiente de produção o aviso por e-mail não é enviado.'
    default:
      return `Não foi possível enviar o aviso para ${responsavel.email}. Avise a pessoa por outro meio.`
  }
}
