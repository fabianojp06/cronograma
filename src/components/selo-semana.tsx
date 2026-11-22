import { periodoDaSemana, type SemanaCtcea } from '@/lib/semana-ctcea'

const DIA_MS = 86_400_000

const curto = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`

/**
 * O motivo de identidade do sistema: a semana CTCEA. O NÚMERO da semana em
 * destaque (tabular, grande) e, ao lado, o ano e os dias úteis (segunda a sexta).
 * A semana do calendário da CTCEA vai de domingo a sábado (ver `semana-ctcea.ts`);
 * o selo mostra os dias de trabalho dentro dela.
 */
export function SeloSemana({ ano, semana }: SemanaCtcea) {
  const periodo = periodoDaSemana({ ano, semana })
  const segunda = new Date(periodo.inicio.getTime() + DIA_MS)
  const sexta = new Date(periodo.fim.getTime() - DIA_MS)
  return (
    <div className="flex items-center gap-3 border-l-2 border-accent pl-3" data-selo-semana>
      <span className="font-display text-5xl font-extrabold leading-none tabular-nums text-accent">{semana}</span>
      <span className="flex flex-col text-sm leading-tight">
        <span className="font-semibold text-text">Semana de {ano}</span>
        <span className="tabular-nums text-textMuted">
          seg {curto(segunda)} a sex {curto(sexta)}
        </span>
      </span>
    </div>
  )
}
