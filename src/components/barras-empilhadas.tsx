export type SerieEmpilhada = {
  id: string
  rotulo: string
  /** 0 a 100: a intensidade da cor de atraso (a pilha é uma rampa de UMA cor). */
  tinta: number
}

export type LinhaEmpilhada = { rotulo: string; total: number; valores: number[]; detalhe?: string }

/**
 * Barras horizontais empilhadas, todas na MESMA escala (a do maior total): a
 * comparação entre linhas é honesta. As séries são uma rampa de intensidade da
 * cor de atraso (mais escuro = pior), a legenda sempre aparece e cada fatia traz
 * o seu número. A tinta nunca passa de 45%: com mais que isso o número perde
 * contraste nos dois temas.
 */
export function BarrasEmpilhadas({
  series,
  linhas,
  unidade,
}: {
  series: readonly SerieEmpilhada[]
  linhas: readonly LinhaEmpilhada[]
  unidade: string
}) {
  const maximo = Math.max(1, ...linhas.map((l) => l.total))
  return (
    <div>
      <ul aria-label="Legenda" className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-textMuted">
        {series.map((s) => (
          <li className="inline-flex items-center gap-1.5" key={s.id}>
            <span
              aria-hidden="true"
              className="inline-block size-3 border border-border"
              style={{ backgroundColor: `color-mix(in srgb, var(--warn) ${s.tinta}%, transparent)` }}
            />
            {s.rotulo}
          </li>
        ))}
      </ul>
      <ul className="mt-3 space-y-3">
        {linhas.map((l) => (
          <li key={l.rotulo}>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="font-medium">{l.rotulo}</span>
              <span className="tabular-nums text-textMuted">
                <strong className="text-text">{l.total}</strong> {unidade}
                {l.detalhe ? ` · ${l.detalhe}` : ''}
              </span>
            </div>
            <div className="mt-1 flex h-7 bg-borderSoft" style={{ width: `${(l.total / maximo) * 100}%`, minWidth: '1.75rem' }}>
              {l.valores.map((v, i) =>
                v === 0 ? null : (
                  <div
                    className="flex items-center justify-center border-r border-surface text-xs font-semibold tabular-nums last:border-r-0"
                    key={series[i].id}
                    style={{
                      flexGrow: v,
                      backgroundColor: `color-mix(in srgb, var(--warn) ${series[i].tinta}%, transparent)`,
                    }}
                    title={`${l.rotulo} · ${series[i].rotulo}: ${v}`}
                  >
                    {v}
                  </div>
                ),
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
