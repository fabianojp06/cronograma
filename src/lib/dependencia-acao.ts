/**
 * Dependência entre ações ("B só começa quando A terminar") — módulo puro.
 *
 * O bloqueio vale só para o INÍCIO REAL: mudar o status para além de "não
 * iniciado" ou apontar datas realizadas. O previsto continua livre, para o
 * planejamento não travar. Quem precisa começar antes pede liberação ao líder
 * do projeto; aprovada, a ação fica liberada (a dependência continua visível).
 */

import { chaveDoNome } from './colaborador-validacao'

export type StatusLiberacao = 'PENDENTE' | 'APROVADA' | 'RECUSADA'

export const ROTULO_LIBERACAO: Record<StatusLiberacao, string> = {
  PENDENTE: 'Pendente',
  APROVADA: 'Aprovada',
  RECUSADA: 'Recusada',
}

export const LIMITE_MOTIVO = 500
export const MINIMO_MOTIVO = 5

export type ParDependencia = { acaoId: string; predecessoraId: string }

export type ErroDependencia = 'MESMA_ACAO' | 'JA_EXISTE' | 'CICLO'

export const MENSAGEM_ERRO_DEPENDENCIA: Record<ErroDependencia, string> = {
  MESMA_ACAO: 'Uma ação não pode depender dela mesma.',
  JA_EXISTE: 'Essa dependência já existe.',
  CICLO: 'Isso criaria um ciclo: a outra ação já depende desta, direta ou indiretamente.',
}

/** `null` se `acaoId` pode passar a depender de `predecessoraId`. */
export function validarNovaDependencia(
  nova: ParDependencia,
  existentes: readonly ParDependencia[],
): ErroDependencia | null {
  if (nova.acaoId === nova.predecessoraId) return 'MESMA_ACAO'
  if (existentes.some((p) => p.acaoId === nova.acaoId && p.predecessoraId === nova.predecessoraId)) {
    return 'JA_EXISTE'
  }
  // Ciclo: a futura predecessora já depende (transitivamente) da ação.
  const dependeDe = new Map<string, string[]>()
  for (const p of existentes) {
    dependeDe.set(p.acaoId, [...(dependeDe.get(p.acaoId) ?? []), p.predecessoraId])
  }
  const visitadas = new Set<string>()
  const pilha = [nova.predecessoraId]
  while (pilha.length > 0) {
    const atual = pilha.pop()!
    if (atual === nova.acaoId) return 'CICLO'
    if (visitadas.has(atual)) continue
    visitadas.add(atual)
    pilha.push(...(dependeDe.get(atual) ?? []))
  }
  return null
}

type EstadoDeInicio = {
  status: string
  realizadoInicio: Date | string | null
  realizadoTermino: Date | string | null
}

/** A ação já saiu de "não iniciada": status avançado ou algum realizado apontado. */
export function acaoIniciada(e: EstadoDeInicio): boolean {
  return e.status !== 'NAO_INICIADO' || e.realizadoInicio !== null || e.realizadoTermino !== null
}

/**
 * A gravação FAZ a ação começar? Só conta a passagem de não iniciada para
 * iniciada: ação já em andamento não é bloqueada (a dependência pode ter sido
 * criada depois), e salvar de novo uma ação não iniciada também não.
 */
export function gravacaoInicia(atual: EstadoDeInicio, novo: EstadoDeInicio): boolean {
  return !acaoIniciada(atual) && acaoIniciada(novo)
}

export type PredecessoraResumo = { id: string; numero: number; status: string }

/** Predecessoras que ainda não terminaram. */
export function predecessorasPendentes<T extends { status: string }>(preds: readonly T[]): T[] {
  return preds.filter((p) => p.status !== 'CONCLUIDO')
}

export function mensagemDeBloqueio(pendentes: readonly { numero: number }[]): string {
  const lista = pendentes.map((p) => `#${p.numero}`).join(', ')
  return pendentes.length === 1
    ? `Esta ação depende da ação ${lista}, que ainda não terminou. Peça a liberação ao líder do projeto para iniciá-la antes.`
    : `Esta ação depende das ações ${lista}, que ainda não terminaram. Peça a liberação ao líder do projeto para iniciá-la antes.`
}

/**
 * Decide se a gravação é recusada. `liberada`: existe pedido APROVADO para a
 * ação. Devolve a mensagem de bloqueio, ou `null` se pode gravar.
 */
export function bloqueioDaGravacao(entrada: {
  inicia: boolean
  predecessoras: readonly PredecessoraResumo[]
  liberada: boolean
}): string | null {
  if (!entrada.inicia || entrada.liberada) return null
  const pendentes = predecessorasPendentes(entrada.predecessoras)
  return pendentes.length === 0 ? null : mensagemDeBloqueio(pendentes)
}

/**
 * Líder do projeto: quem o administrador definiu como `Projeto.responsavel`
 * (texto livre, casado por `chaveDoNome` com o nome do colaborador da conta) ou
 * um administrador. Nome parcial não casa — a mesma regra do resto do sistema.
 */
export function ehLiderDoProjeto(entrada: {
  nomeDoColaborador: string | null
  responsavelDoProjeto: string | null
  administrador: boolean
}): boolean {
  if (entrada.administrador) return true
  const { nomeDoColaborador, responsavelDoProjeto } = entrada
  if (!nomeDoColaborador || !responsavelDoProjeto) return false
  return chaveDoNome(nomeDoColaborador) === chaveDoNome(responsavelDoProjeto)
}

export type ResultadoTexto = { ok: true; texto: string } | { ok: false; erro: string }

/** Motivo do pedido de liberação: obrigatório, 5 a 500 caracteres. */
export function validarMotivoLiberacao(bruto: FormDataEntryValue | null): ResultadoTexto {
  const texto = typeof bruto === 'string' ? bruto.trim() : ''
  if (texto.length < MINIMO_MOTIVO) {
    return { ok: false, erro: `Explique o motivo (pelo menos ${MINIMO_MOTIVO} caracteres).` }
  }
  if (texto.length > LIMITE_MOTIVO) {
    return { ok: false, erro: `O motivo passa de ${LIMITE_MOTIVO} caracteres.` }
  }
  return { ok: true, texto }
}

/** Justificativa da decisão: obrigatória só na recusa; opcional na aprovação. */
export function validarJustificativa(
  bruto: FormDataEntryValue | null,
  aprovando: boolean,
): ResultadoTexto {
  const texto = typeof bruto === 'string' ? bruto.trim() : ''
  if (texto.length > LIMITE_MOTIVO) {
    return { ok: false, erro: `A justificativa passa de ${LIMITE_MOTIVO} caracteres.` }
  }
  if (!aprovando && texto.length < MINIMO_MOTIVO) {
    return { ok: false, erro: 'Para recusar, explique o motivo (pelo menos 5 caracteres).' }
  }
  return { ok: true, texto }
}

export type RiscoDeCascata = 'ATRASADA' | 'SOBREPOE' | null

/**
 * Aviso de que a predecessora ameaça o início desta ação. `ATRASADA`: a
 * predecessora passou do previsto sem terminar. `SOBREPOE`: o plano em si já
 * prevê o término dela depois (ou no mesmo dia) do início desta.
 */
export function riscoDaPredecessora(
  pred: { status: string; previstoTermino: Date | null; realizadoTermino: Date | null },
  inicioPrevistoDaAcao: Date | null,
  hoje: Date,
): RiscoDeCascata {
  if (pred.status === 'CONCLUIDO' || pred.realizadoTermino !== null) return null
  if (pred.previstoTermino === null) return null
  if (pred.previstoTermino.getTime() < hoje.getTime()) return 'ATRASADA'
  if (inicioPrevistoDaAcao && pred.previstoTermino.getTime() >= inicioPrevistoDaAcao.getTime()) {
    return 'SOBREPOE'
  }
  return null
}

export const MENSAGEM_RISCO: Record<Exclude<RiscoDeCascata, null>, string> = {
  ATRASADA: 'atrasada — o início desta ação está em risco',
  SOBREPOE: 'termina depois do início previsto desta ação',
}

export type EtiquetaDependencia = { texto: string; bloqueada: boolean }

/** Selo da linha do projeto: depende de quem, e se está bloqueada ou liberada. */
export function etiquetaDaDependencia(entrada: {
  predecessoras: readonly PredecessoraResumo[]
  iniciada: boolean
  liberada: boolean
}): EtiquetaDependencia | null {
  const { predecessoras, iniciada, liberada } = entrada
  if (predecessoras.length === 0) return null
  const lista = predecessoras.map((p) => `#${p.numero}`).join(', ')
  if (iniciada || predecessorasPendentes(predecessoras).length === 0) {
    return { texto: `depende de ${lista}`, bloqueada: false }
  }
  return liberada
    ? { texto: `depende de ${lista} · liberada pelo líder`, bloqueada: false }
    : { texto: `bloqueada por ${lista}`, bloqueada: true }
}
