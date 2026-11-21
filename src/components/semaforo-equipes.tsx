import { ROTULO_SEMAFORO, LIMITE_AMARELO, LIMITE_VERMELHO, type CartaoSemaforo, type CorSemaforo } from '@/lib/dashboard-gestao'

const BORDA: Record<CorSemaforo, string> = {
  VERMELHO: 'border-warn',
  AMARELO: 'border-atencao',
  VERDE: 'border-realizado',
  SEM_DADOS: 'border-borderSoft',
}
const TEXTO: Record<CorSemaforo, string> = {
  VERMELHO: 'text-warn',
  AMARELO: 'text-atencao',
  VERDE: 'text-realizado',
  SEM_DADOS: 'text-textFaint',
}
const PREENCHIMENTO: Record<CorSemaforo, string> = {
  VERMELHO: 'bg-warn',
  AMARELO: 'bg-atencao',
  VERDE: 'bg-realizado',
  SEM_DADOS: 'bg-textFaint',
}

/** O medidor vai de 0 a 40% de atraso; acima disso a barra fica cheia. */
const ESCALA = 0.4
const pos = (v: number) => `${Math.min(v, ESCALA) / ESCALA * 100}%`

/**
 * Um cartão por equipe: a cor do semáforo (SEMPRE com a palavra ao lado: a
 * identidade nunca fica só na cor), o medidor do atraso com os limites de 5% e
 * 20% marcados, os números do cruzamento e o motivo da cor.
 */
export function SemaforoEquipes({ cartoes }: { cartoes: CartaoSemaforo[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {cartoes.map((c) => (
        <li className={`border-l-4 ${BORDA[c.cor]} bg-surface px-4 py-3`} key={c.equipe}>
          <div className="flex items-baseline justify-between gap-3">
            <h4 className="font-display text-base font-extrabold">{c.equipe}</h4>
            <span className={`text-sm font-bold ${TEXTO[c.cor]}`}>{ROTULO_SEMAFORO[c.cor]}</span>
          </div>

          {c.abertas > 0 ? (
            <div className="mt-3">
              <p className="text-xs text-textMuted">
                Ações abertas atrasadas:{' '}
                <strong className="tabular-nums text-text">
                  {c.atrasadas} de {c.abertas} ({Math.round(c.proporcaoAtraso * 100)}%)
                </strong>
              </p>
              <div
                aria-hidden="true"
                className="relative mt-1 h-2 bg-borderSoft"
                title={`Limites: amarelo a partir de ${LIMITE_AMARELO * 100}%, vermelho acima de ${LIMITE_VERMELHO * 100}%`}
              >
                <div className={`h-2 ${PREENCHIMENTO[c.cor]}`} style={{ width: pos(c.proporcaoAtraso) }} />
                <span className="absolute inset-y-0 w-px bg-text/40" style={{ left: pos(LIMITE_AMARELO) }} />
                <span className="absolute inset-y-0 w-px bg-text/40" style={{ left: pos(LIMITE_VERMELHO) }} />
              </div>
              <div aria-hidden="true" className="relative mt-0.5 h-3 text-[10px] text-textFaint">
                <span className="absolute -translate-x-1/2" style={{ left: pos(LIMITE_AMARELO) }}>5%</span>
                <span className="absolute -translate-x-1/2" style={{ left: pos(LIMITE_VERMELHO) }}>20%</span>
              </div>
            </div>
          ) : null}

          <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-textMuted">No prazo</dt>
              <dd className="font-display text-lg font-extrabold tabular-nums">
                {c.aderenciaPercentual === null ? '—' : `${c.aderenciaPercentual}%`}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-textMuted">Riscos</dt>
              <dd className="font-display text-lg font-extrabold tabular-nums">
                {c.riscosAbertos}
                {c.riscosAltosAbertos > 0 ? <span className="ml-1 text-xs font-medium text-warn">({c.riscosAltosAbertos} alto)</span> : null}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] uppercase tracking-wide text-textMuted">Replan. 30d</dt>
              <dd className="font-display text-lg font-extrabold tabular-nums">{c.replanejamentos}</dd>
            </div>
          </dl>

          {c.motivos.length > 0 ? (
            <ul className="mt-2 space-y-0.5 text-xs text-textMuted">
              {c.motivos.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  )
}
