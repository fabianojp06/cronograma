/**
 * Regras do monitoramento — módulo puro (sem Prisma, sem Next, sem `process.env`).
 */

const HORA_MS = 60 * 60 * 1000
const DIA_MS = 24 * HORA_MS

// ---------------------------------------------------------------- Saúde

export type SaudeBanco = { ok: true; ms: number } | { ok: false; erro: string }

/** 200 só com o banco respondendo; qualquer outra coisa é 503 (o verificador externo avisa). */
export function statusDaSaude(banco: SaudeBanco): 200 | 503 {
  return banco.ok ? 200 : 503
}

/** O que a rota pública devolve: o mínimo. Nada de variáveis, versões ou mensagens de erro. */
export function corpoDaSaude(banco: SaudeBanco) {
  return banco.ok
    ? { status: 'ok' as const, banco: { ok: true, ms: banco.ms } }
    : { status: 'fora' as const, banco: { ok: false } }
}

// ---------------------------------------------------------------- Alerta de erro

/**
 * Origens que NÃO geram alerta: as do próprio envio de e-mail. Se o Resend está
 * fora, alertar por e-mail falharia, registraria outra falha e tentaria alertar
 * de novo — um laço. Elas continuam no registro; só não disparam aviso.
 */
export const ORIGENS_SEM_ALERTA: readonly string[] = [
  'Resend recusou o e-mail',
  'Falha ao enviar e-mail',
  'Falha ao enviar o alerta de erro',
]

export const JANELA_ALERTA_MS = HORA_MS

/**
 * Alerta no máximo 1 vez por hora por origem: o primeiro erro de uma série avisa,
 * os seguintes (mesma origem, dentro da janela) ficam só no registro. Sem isso, um
 * banco fora do ar mandaria um e-mail por requisição.
 */
export function deveAlertar(origem: string, haRegistroRecenteDaOrigem: boolean): boolean {
  if (ORIGENS_SEM_ALERTA.includes(origem)) return false
  return !haRegistroRecenteDaOrigem
}

/** `EMAIL_ALERTAS` (vírgulas) manda; sem ela, os administradores ativos com e-mail. */
export function destinatariosDeAlerta(
  env: Readonly<Record<string, string | undefined>>,
  emailsDosAdministradores: (string | null)[],
): string[] {
  const explicitos = (env.EMAIL_ALERTAS ?? '')
    .split(',')
    .map((e) => e.trim())
    .filter((e) => e.includes('@'))
  const lista =
    explicitos.length > 0
      ? explicitos
      : emailsDosAdministradores.filter((e): e is string => !!e && e.includes('@'))
  return [...new Set(lista.map((e) => e.toLowerCase()))]
}

export function montarAlertaErro(entrada: {
  origem: string
  mensagem: string
  rota: string | null
  urlBase: string | null
}): { assunto: string; texto: string; html: string } {
  const { origem, mensagem, rota, urlBase } = entrada
  const link = urlBase ? `${urlBase}/administracao/sistema` : null
  const linhas = [
    `Falha em produção: ${origem}`,
    '',
    mensagem,
    ...(rota ? ['', `Rota: ${rota}`] : []),
    '',
    'Novas falhas da mesma origem não geram outro aviso por 1 hora; o registro completo guarda todas.',
    ...(link ? ['', `Painel do sistema: ${link}`] : []),
  ]
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return {
    assunto: `[Cronograma CTCEA] Falha: ${origem}`.slice(0, 150),
    texto: linhas.join('\n'),
    html:
      `<p><strong>Falha em produção:</strong> ${esc(origem)}</p>` +
      `<p>${esc(mensagem)}</p>` +
      (rota ? `<p>Rota: ${esc(rota)}</p>` : '') +
      '<p style="color:#5B6B76">Novas falhas da mesma origem não geram outro aviso por 1 hora; o registro completo guarda todas.</p>' +
      (link ? `<p><a href="${esc(link)}">Abrir o painel do sistema</a></p>` : ''),
  }
}

// ---------------------------------------------------------------- Painel

export type ErroResumivel = { origem: string; criadoEm: Date }

export type LinhaOrigem = {
  origem: string
  ultimas24h: number
  ultimos7d: number
  ultimoEm: Date
}

/** Erros por origem: 24 h, 7 dias e o último momento. Mais ruidosas (24 h) primeiro. */
export function agruparErrosPorOrigem(erros: ErroResumivel[], agora: Date): LinhaOrigem[] {
  const porOrigem = new Map<string, LinhaOrigem>()
  for (const erro of erros) {
    const idade = agora.getTime() - erro.criadoEm.getTime()
    if (idade > 7 * DIA_MS) continue
    const linha = porOrigem.get(erro.origem) ?? {
      origem: erro.origem,
      ultimas24h: 0,
      ultimos7d: 0,
      ultimoEm: erro.criadoEm,
    }
    linha.ultimos7d += 1
    if (idade <= DIA_MS) linha.ultimas24h += 1
    if (erro.criadoEm > linha.ultimoEm) linha.ultimoEm = erro.criadoEm
    porOrigem.set(erro.origem, linha)
  }
  return [...porOrigem.values()].sort(
    (a, b) => b.ultimas24h - a.ultimas24h || b.ultimos7d - a.ultimos7d || a.origem.localeCompare(b.origem),
  )
}

/** Teto de ações a partir do qual o CLAUDE.md manda reabrir o desempenho de /dashboards. */
export const LIMITE_ACOES_DASHBOARDS = 10_000

export type SituacaoVolume = { percentual: number; nivel: 'ok' | 'atencao' | 'acima' }

export function situacaoDoVolume(acoes: number): SituacaoVolume {
  const percentual = Math.round((acoes / LIMITE_ACOES_DASHBOARDS) * 100)
  const nivel = acoes > LIMITE_ACOES_DASHBOARDS ? 'acima' : percentual >= 70 ? 'atencao' : 'ok'
  return { percentual, nivel }
}

export type ItemConfiguracao = {
  id: string
  rotulo: string
  ok: boolean
  /** O efeito de estar assim, em português claro. */
  detalhe: string
}

/** Só diz se cada variável está definida — nunca o valor. */
export function conferirConfiguracao(
  env: Readonly<Record<string, string | undefined>>,
): ItemConfiguracao[] {
  const tem = (nome: string) => !!env[nome]?.trim()
  return [
    {
      id: 'clerk',
      rotulo: 'Login (Clerk)',
      ok: tem('CLERK_SECRET_KEY'),
      detalhe: tem('CLERK_SECRET_KEY')
        ? 'Chave configurada.'
        : 'Sem a chave: ninguém entra e a conferência de domínio nega tudo.',
    },
    {
      id: 'resend',
      rotulo: 'E-mail (Resend)',
      ok: tem('RESEND_API_KEY'),
      detalhe: tem('RESEND_API_KEY')
        ? 'Chave configurada.'
        : 'Sem a chave: avisos de responsável, de atraso e alertas de erro não saem.',
    },
    {
      id: 'remetente',
      rotulo: 'Remetente próprio',
      ok: tem('EMAIL_REMETENTE'),
      detalhe: tem('EMAIL_REMETENTE')
        ? 'Remetente do domínio da CTCEA.'
        : 'Usando o remetente de teste do Resend: só entrega ao dono da conta Resend.',
    },
    {
      id: 'cron',
      rotulo: 'Agendador (CRON_SECRET)',
      ok: tem('CRON_SECRET'),
      detalhe: tem('CRON_SECRET')
        ? 'Segredo configurado.'
        : 'Sem o segredo: o aviso semanal de atraso recusa tudo.',
    },
    {
      id: 'alertas',
      rotulo: 'Destino dos alertas de erro',
      ok: tem('EMAIL_ALERTAS'),
      detalhe: tem('EMAIL_ALERTAS')
        ? 'Lista explícita em EMAIL_ALERTAS.'
        : 'Sem EMAIL_ALERTAS: vão para os administradores ativos que têm e-mail.',
    },
  ]
}

// ---------------------------------------------------------------- Cron

export const RETENCAO_EXECUCOES_DIAS = 90

/** Quanto tempo sem execução do aviso semanal já é suspeito (semanal + folga de 2 dias). */
export const LIMITE_SEM_EXECUCAO_DIAS = 9

export function cronEstaAtrasado(ultimaExecucao: Date | null, agora: Date): boolean {
  if (ultimaExecucao === null) return false // nunca rodou: ainda não dá para dizer que atrasou
  return agora.getTime() - ultimaExecucao.getTime() > LIMITE_SEM_EXECUCAO_DIAS * DIA_MS
}
