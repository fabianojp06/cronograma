import type { PontoCarga } from '@/lib/dashboard-temporal'

/**
 * Carga por mês — inícios e términos previstos.
 *
 * São duas medidas da mesma grandeza, então em vez de duas cores numa mesma
 * grade usamos **small multiples**: duas faixas empilhadas, cada uma de uma
 * única cor, com a MESMA escala vertical. Comparar altura entre as faixas
 * continua honesto, e não gastamos uma paleta categórica em algo que não é
 * questão de identidade.
 */
/** Altura útil da faixa, em pixels — base da escala das barras. */
const ALTURA_PLOT = 64

function Faixa({
  titulo,
  valores,
  meses,
  maximo,
}: {
  titulo: string
  valores: number[]
  meses: string[]
  maximo: number
}) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
        {titulo}
      </p>
      <div className="mt-2 flex items-end gap-1">
        {valores.map((valor, i) => (
          <div
            key={meses[i]}
            className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1"
            title={`${meses[i]}: ${valor} ação(ões)`}
          >
            <span className="text-[10px] tabular-nums text-textFaint">
              {valor > 0 ? valor : ''}
            </span>
            {/* Altura em pixels, não em %: a barra é filha de uma coluna de
                altura automática, e aí `height: %` não resolve contra nada. */}
            <div
              className="w-full max-w-8 rounded-t-sm bg-accent"
              style={{ height: `${maximo === 0 ? 0 : (valor / maximo) * ALTURA_PLOT}px` }}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

export function DashboardCarga({ pontos }: { pontos: PontoCarga[] }) {
  const meses = pontos.map((p) => p.rotulo)
  // Escala compartilhada pelas duas faixas — escalas separadas fariam 2 parecer
  // tanto quanto 40.
  const maximo = Math.max(1, ...pontos.flatMap((p) => [p.inicios, p.terminos]))

  return (
    <div className="overflow-x-auto">
      <div className="min-w-2xl space-y-5">
        <Faixa
          titulo="Inícios previstos"
          valores={pontos.map((p) => p.inicios)}
          meses={meses}
          maximo={maximo}
        />
        <Faixa
          titulo="Términos previstos"
          valores={pontos.map((p) => p.terminos)}
          meses={meses}
          maximo={maximo}
        />
        <div className="flex gap-1">
          {meses.map((mes) => (
            <span
              key={mes}
              className="min-w-0 flex-1 text-center text-[10px] text-textFaint"
            >
              {mes}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
