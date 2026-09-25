/**
 * A regra das 3 semanas — módulo puro, sem Prisma e sem Next.
 *
 * Transcrita do rodapé de toda aba do Card WIN:
 *
 *   "Caso um mesmo WIN se repetir por 3 semanas, já na terceira semana ele deve
 *    ser cadastrado no Plano de Ação (PLA-DEP-2026-001) para acompanhamento
 *    quinzenal e retirado do Card WIN."
 *
 * É o que liga o Card WIN ao plano de ação que o sistema já tem. Na planilha a
 * regra existe mas ninguém a aplica, porque conferi-la exige comparar abas à
 * mão: no arquivo analisado, "Desenvolvimento do documento de elicitação de
 * requisitos" aparece nas semanas 37, 38 e 39 e continua no card.
 *
 * **Conta-se aparições do WIN, não semanas consecutivas do calendário.** A
 * planilha não tem a semana 34, e quem não preenche o card numa semana não
 * deveria zerar o contador — seria premiar justamente o esquecimento que a
 * regra quer pegar.
 */

export const APARICOES_PARA_PROMOVER = 3

/** Recorte de um WIN necessário para decidir a promoção. */
export type WinContavel = {
  /** Aparições que existiram fora do sistema (semeadas na importação). */
  aparicoesAnteriores: number
  /** Quantas semanas o WIN já apareceu dentro do sistema. */
  registros: number
  promovidoEm: Date | null
  encerradoEm: Date | null
}

export function totalDeAparicoes(win: WinContavel): number {
  return Math.max(0, win.aparicoesAnteriores) + Math.max(0, win.registros)
}

export const SITUACOES_WIN = [
  'NOVO',
  'REPETINDO',
  'DEVE_PROMOVER',
  'PROMOVIDO',
  'ENCERRADO',
] as const

export type SituacaoWin = (typeof SITUACOES_WIN)[number]

export const ROTULO_SITUACAO: Record<SituacaoWin, string> = {
  NOVO: 'Primeira semana',
  REPETINDO: 'Repetindo',
  DEVE_PROMOVER: 'Promover ao plano de ação',
  PROMOVIDO: 'Promovido',
  ENCERRADO: 'Encerrado',
}

export function situacaoDoWin(win: WinContavel): SituacaoWin {
  if (win.promovidoEm !== null) return 'PROMOVIDO'
  if (win.encerradoEm !== null) return 'ENCERRADO'

  const aparicoes = totalDeAparicoes(win)
  if (aparicoes >= APARICOES_PARA_PROMOVER) return 'DEVE_PROMOVER'
  return aparicoes <= 1 ? 'NOVO' : 'REPETINDO'
}

/** `true` quando a regra já foi atingida e o WIN ainda não saiu do card. */
export function deveSerPromovido(win: WinContavel): boolean {
  return situacaoDoWin(win) === 'DEVE_PROMOVER'
}

/** Quantas aparições faltam para a regra disparar; 0 se já disparou. */
export function aparicoesRestantes(win: WinContavel): number {
  return Math.max(0, APARICOES_PARA_PROMOVER - totalDeAparicoes(win))
}

/**
 * Frase pronta para a UI. O alerta precisa dizer o que fazer, não só que algo
 * aconteceu — a regra existe há semanas na planilha e nunca foi seguida.
 */
export function mensagemDaSituacao(win: WinContavel): string {
  const aparicoes = totalDeAparicoes(win)

  switch (situacaoDoWin(win)) {
    case 'PROMOVIDO':
      return 'Já virou item do plano de ação e saiu do card.'
    case 'ENCERRADO':
      return 'Encerrado — não conta mais para a regra das 3 semanas.'
    case 'DEVE_PROMOVER':
      return `Está na ${aparicoes}ª semana. Pela regra, deve virar item do plano de ação e sair do card.`
    case 'REPETINDO': {
      const faltam = aparicoesRestantes(win)
      return `${aparicoes}ª semana seguida. Mais ${faltam} e vira item do plano de ação.`
    }
    default:
      return 'Primeira semana deste WIN.'
  }
}

export const DESTINOS_PROMOCAO = ['PROJETO', 'ACAO'] as const

export type DestinoPromocao = (typeof DESTINOS_PROMOCAO)[number]

export const ROTULO_DESTINO: Record<DestinoPromocao, string> = {
  PROJETO: 'Novo projeto no plano de ação',
  ACAO: 'Nova ação dentro de um projeto existente',
}

export type PedidoPromocao = {
  destino: DestinoPromocao
  /** Obrigatório quando o destino é ACAO — o projeto que receberá a ação. */
  projetoId: string | null
}

export type ErroPromocao = 'DESTINO_INVALIDO' | 'PROJETO_OBRIGATORIO' | 'JA_PROMOVIDO'

export const MENSAGEM_ERRO_PROMOCAO: Record<ErroPromocao, string> = {
  DESTINO_INVALIDO: 'Escolha se o WIN vira um projeto novo ou uma ação.',
  PROJETO_OBRIGATORIO: 'Escolha o projeto que vai receber a ação.',
  JA_PROMOVIDO: 'Este WIN já foi promovido.',
}

/**
 * Valida o pedido de promoção. Não exige que a regra das 3 semanas tenha
 * disparado: promover antes é decisão legítima de quem conduz a reunião, e o
 * contador serve para lembrar, não para impedir.
 */
export function validarPromocao(
  win: Pick<WinContavel, 'promovidoEm'>,
  pedido: PedidoPromocao,
): { ok: true } | { ok: false; erro: ErroPromocao } {
  if (win.promovidoEm !== null) return { ok: false, erro: 'JA_PROMOVIDO' }

  if (!(DESTINOS_PROMOCAO as readonly string[]).includes(pedido.destino)) {
    return { ok: false, erro: 'DESTINO_INVALIDO' }
  }
  if (pedido.destino === 'ACAO' && (pedido.projetoId ?? '') === '') {
    return { ok: false, erro: 'PROJETO_OBRIGATORIO' }
  }
  return { ok: true }
}
