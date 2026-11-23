import Link from 'next/link'

import { desvioEscritoFlash, percentualEscrito } from '@/lib/formato-flash'
import type { CelulaMacro, FlashReport } from '@/lib/flash-report'

const COL = '1.875rem'

const HACHURA =
  'repeating-linear-gradient(45deg, rgb(0 0 0 / 0.35) 0 3px, transparent 3px 6px)'

const CLASSE: Record<Exclude<CelulaMacro, null>, string> = {
  REALIZADO: 'bg-realizado',
  ATENCAO: 'bg-atencao',
  // Neutro e vazado (contorno cheio, sem preenchimento): não é verde, não é o
  // tracejado azul do planejado, e se distingue sem depender de cor.
  DECORRIDO: 'border-2 border-solid border-textFaint bg-transparent',
  PLANEJADO: 'border-2 border-dashed border-previsto bg-previsto/10',
}

const TEXTO: Record<Exclude<CelulaMacro, null>, string> = {
  REALIZADO: 'Realizado',
  ATENCAO: 'Atenção',
  DECORRIDO: 'Decorrido, sem avanço',
  PLANEJADO: 'Planejado',
}

function Celula({ tipo, rotulo }: { tipo: CelulaMacro; rotulo: string }) {
  if (tipo === null) return <span aria-hidden="true" />
  const texto = TEXTO[tipo]
  return (
    <span className="flex h-full items-center justify-center" title={`${rotulo}: ${texto}`}>
      <span
        className={`block h-4 w-full rounded-sm ${CLASSE[tipo]}`}
        style={tipo === 'ATENCAO' ? { backgroundImage: HACHURA } : undefined}
      />
      <span className="sr-only">{texto}</span>
    </span>
  )
}

function Amostra({ tipo }: { tipo: Exclude<CelulaMacro, null> }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block h-3 w-5 rounded-sm align-middle ${CLASSE[tipo]}`}
      style={tipo === 'ATENCAO' ? { backgroundImage: HACHURA } : undefined}
    />
  )
}

export function GanttMacro({
  relatorio,
  projetoId,
  temMacroetapas,
}: {
  relatorio: FlashReport
  projetoId: string
  temMacroetapas: boolean
}) {
  const { macroetapas, totalSemanas, semanaDoProjeto, consolidado } = relatorio
  const colunas = `minmax(8rem,1fr) 4.5rem 4.75rem 5.75rem repeat(${totalSemanas}, ${COL})`
  const largura = `calc(8rem + 15rem + ${totalSemanas} * ${COL})`
  const semanas = Array.from({ length: totalSemanas }, (_, i) => i + 1)
  const faixa = (i: number) => (i === semanaDoProjeto ? 'bg-accent/10' : '')

  return (
    <section aria-labelledby="t-gantt" className="min-w-0">
      <h2 className="border-b border-border pb-2 font-display text-base font-bold" id="t-gantt">
        Cronograma macro e avanço físico (previsto × realizado)
      </h2>
      {macroetapas.length === 0 ? (
        <p className="mt-3 text-sm text-textMuted">Sem ações para mostrar por macroetapa.</p>
      ) : (
        <div className="relative mt-2 overflow-x-auto" data-testid="gantt-macro">
          <div role="table" aria-label="Avanço por macroetapa" style={{ minWidth: largura }}>
            <div className="grid items-end border-b border-border text-xs font-semibold text-textMuted" role="row" style={{ gridTemplateColumns: colunas }}>
              <span className="py-1.5 pr-2" role="columnheader">Macroetapa</span>
              <span className="py-1.5 pr-2 text-right tabular-nums" role="columnheader">Previsto</span>
              <span className="py-1.5 pr-2 text-right tabular-nums" role="columnheader">Realizado</span>
              <span className="py-1.5 pr-3 text-right tabular-nums whitespace-nowrap" role="columnheader">Desvio</span>
              {semanas.map((n) => (
                <span
                  className={`py-1.5 text-center tabular-nums ${faixa(n)} ${n === semanaDoProjeto ? 'text-accent' : ''}`}
                  key={n}
                  role="columnheader"
                  title={n === semanaDoProjeto ? 'Semana escolhida' : undefined}
                >
                  S{String(n).padStart(2, '0')}
                </span>
              ))}
            </div>
            {macroetapas.map((m) => (
              <div className="grid items-center border-b border-borderSoft text-sm" key={m.id} role="row" style={{ gridTemplateColumns: colunas }}>
                <span className="truncate py-2 pr-2 font-medium" role="rowheader" title={m.nome}>{m.nome}</span>
                <span className="pr-2 text-right tabular-nums text-textMuted" role="cell">{m.avanco ? percentualEscrito(m.avanco.previsto) : '—'}</span>
                <span className="pr-2 text-right tabular-nums" role="cell">{m.avanco ? percentualEscrito(m.avanco.realizado) : '—'}</span>
                <span className="pr-3 text-right tabular-nums whitespace-nowrap" role="cell">{m.avanco ? desvioEscritoFlash(m.avanco.desvio) : '—'}</span>
                {semanas.map((n, i) => (
                  <span className={`h-full px-px ${faixa(n)}`} key={n} role="cell">
                    <Celula rotulo={`${m.nome}, S${String(n).padStart(2, '0')}`} tipo={m.celulas[i] ?? null} />
                  </span>
                ))}
              </div>
            ))}
            <div className="grid items-center border-b border-border bg-tableHeadBg text-sm font-semibold" role="row" style={{ gridTemplateColumns: colunas }}>
              <span className="py-2 pr-2" role="rowheader">Total consolidado</span>
              <span className="pr-2 text-right tabular-nums" role="cell">{consolidado ? percentualEscrito(consolidado.previsto) : '—'}</span>
              <span className="pr-2 text-right tabular-nums" role="cell">{consolidado ? percentualEscrito(consolidado.realizado) : '—'}</span>
              <span className="pr-3 text-right tabular-nums whitespace-nowrap" role="cell">{consolidado ? desvioEscritoFlash(consolidado.desvio) : '—'}</span>
              {semanas.map((n) => (
                <span className={`h-full ${faixa(n)}`} key={n} role="cell" />
              ))}
            </div>
          </div>
        </div>
      )}
      <p className="mt-1 text-xs text-textFaint print:hidden">Se faltarem semanas na tela, role a tabela de lado.</p>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-textMuted">
        <span><Amostra tipo="REALIZADO" /> Realizado (houve avanço até o fim da semana)</span>
        <span><Amostra tipo="ATENCAO" /> Atenção (desvio de −3 p.p. ou pior no fim da semana)</span>
        <span><Amostra tipo="DECORRIDO" /> Decorrido, sem avanço (ou semana sem foto do histórico)</span>
        <span><Amostra tipo="PLANEJADO" /> Planejado (semana futura)</span>
        <span className="text-accent">Coluna em destaque: semana escolhida</span>
      </p>
      {!temMacroetapas ? (
        <p className="mt-2 text-sm text-textMuted print:hidden">
          Este projeto não tem macroetapas.{' '}
          <Link className="text-accent hover:underline" href={`/projetos/${projetoId}#macroetapas`}>
            Cadastrar macroetapas
          </Link>
        </p>
      ) : null}
    </section>
  )
}
