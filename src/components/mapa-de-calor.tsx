import type { MatrizDeCalor } from '@/lib/dashboard-gestao'

/** Tinta máxima: com mais que isso o número perde contraste, nos dois temas. */
const TINTA_MAXIMA = 45

/**
 * Mapa de calor: uma grade de números cuja célula é tingida em proporção ao
 * valor. A intensidade é a MAGNITUDE (uma cor só); o número sempre aparece, então
 * a cor nunca carrega sozinha a informação. `colunasDeAlerta` usa a cor de atraso
 * (as colunas em que mais é pior, como "Atrasado").
 */
export function MapaDeCalor({
  matriz,
  rotuloDasLinhas,
  colunasDeAlerta = [],
  totalDasLinhas = true,
}: {
  matriz: MatrizDeCalor
  rotuloDasLinhas: string
  colunasDeAlerta?: readonly string[]
  totalDasLinhas?: boolean
}) {
  return (
    <div>
    <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] border-collapse text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-textMuted">
            <th className="px-3 py-2 font-semibold" scope="col">{rotuloDasLinhas}</th>
            {matriz.colunas.map((c) => (
              <th className="px-2 py-2 text-center font-semibold" key={c.id} scope="col">{c.rotulo}</th>
            ))}
            {totalDasLinhas ? <th className="px-3 py-2 text-right font-semibold" scope="col">Total</th> : null}
          </tr>
        </thead>
        <tbody>
          {matriz.linhas.map((linha, i) => (
            <tr className="border-t border-borderSoft" key={linha}>
              <th className="px-3 py-2 text-left font-medium" scope="row">{linha}</th>
              {matriz.colunas.map((c, j) => {
                const v = matriz.valores[i][j]
                const tinta = matriz.maximo === 0 ? 0 : Math.round((v / matriz.maximo) * TINTA_MAXIMA)
                const cor = colunasDeAlerta.includes(c.id) ? 'var(--warn)' : 'var(--accent)'
                return (
                  <td
                    className={`px-2 py-2 text-center tabular-nums ${v === 0 ? 'text-textFaint' : 'font-semibold'}`}
                    key={c.id}
                    style={v === 0 ? undefined : { backgroundColor: `color-mix(in srgb, ${cor} ${tinta}%, transparent)` }}
                    title={`${linha} · ${c.rotulo}: ${v}`}
                  >
                    {v === 0 ? '·' : v}
                  </td>
                )
              })}
              {totalDasLinhas ? <td className="px-3 py-2 text-right tabular-nums text-textMuted">{matriz.totaisDasLinhas[i]}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
    <p className="mt-1 text-xs text-textFaint md:hidden">Arraste a tabela para o lado para ver todas as colunas.</p>
    </div>
  )
}
