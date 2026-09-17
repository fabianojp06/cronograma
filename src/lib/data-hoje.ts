/**
 * Início do dia corrente em UTC. As datas de negócio são gravadas à meia-noite
 * UTC (ver `emDias` no seed), então a comparação de atraso precisa da mesma
 * referência para não escorregar um dia por causa do fuso do servidor.
 */
export function inicioDeHojeUTC(agora: Date = new Date()): Date {
  return new Date(
    Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate()),
  )
}
