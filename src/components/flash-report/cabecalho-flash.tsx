import { SeloSemana } from '@/components/selo-semana'
import { SinalProjeto } from '@/components/sinal-projeto'
import { desvioEscritoFlash, percentualEscrito } from '@/lib/formato-flash'
import type { FlashReport } from '@/lib/flash-report'
import type { SemanaCtcea } from '@/lib/semana-ctcea'

const DIA_MS = 86_400_000

const data = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`

function Indicador({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div className="border-l-2 border-border pl-3">
      <dt className="text-xs font-semibold text-textMuted">{rotulo}</dt>
      <dd className="mt-0.5 text-sm font-medium tabular-nums text-text">{children}</dd>
    </div>
  )
}

export function CabecalhoFlash({
  nome,
  referencia,
  cliente,
  lider,
  objetivo,
  semana,
  relatorio,
}: {
  nome: string
  referencia: string | null
  cliente: string | null
  lider: string | null
  objetivo: string | null
  semana: SemanaCtcea
  relatorio: FlashReport
}) {
  const { periodo, farol, consolidado, semanaDoProjeto, totalSemanas } = relatorio
  const segunda = new Date(periodo.inicio.getTime() + DIA_MS)
  const sexta = new Date(periodo.fim.getTime() - DIA_MS)
  const posicao =
    totalSemanas > 0
      ? `S${String(semanaDoProjeto).padStart(2, '0')} / ${String(totalSemanas).padStart(2, '0')}`
      : 'Sem janela'

  return (
    <header className="border-b border-border pb-5">
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-accent">
            <span>Flash Report</span>
            {referencia ? <span className="text-textMuted"> · {referencia}</span> : null}
          </p>
          <h1 className="mt-1 font-display text-2xl font-extrabold leading-tight">{nome}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <SeloSemana ano={semana.ano} semana={semana.semana} />
          <div className="border-l-2 border-border pl-3">
            <p className="text-xs font-semibold text-textMuted">Semana do projeto</p>
            <p className="font-display text-xl font-bold tabular-nums" data-testid="posicao-semana">
              {posicao}
            </p>
          </div>
          <div className="border-l-2 border-border pl-3" data-testid="farol">
            <p className="text-xs font-semibold text-textMuted">Farol</p>
            <p className="mt-0.5 text-sm">
              <SinalProjeto farol={farol} />
            </p>
            <p className="mt-0.5 max-w-64 text-xs text-textMuted">{farol.motivo}</p>
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-3 md:grid-cols-3 lg:grid-cols-6 print:grid-cols-6">
        <Indicador rotulo="Cliente do projeto">{cliente ?? 'Não informado'}</Indicador>
        <Indicador rotulo="Líder do projeto">{lider ?? 'Não informado'}</Indicador>
        <Indicador rotulo="Semana (seg a sex)">
          {data(segunda)} a {data(sexta)}
        </Indicador>
        <Indicador rotulo="Previsto acumulado">
          {consolidado ? percentualEscrito(consolidado.previsto) : 'Sem dados'}
        </Indicador>
        <Indicador rotulo="Realizado acumulado">
          {consolidado ? percentualEscrito(consolidado.realizado) : 'Sem dados'}
        </Indicador>
        <Indicador rotulo="Desvio">{consolidado ? desvioEscritoFlash(consolidado.desvio) : 'Sem dados'}</Indicador>
      </dl>

      <div className="mt-4 border-l-2 border-border pl-3">
        <p className="text-xs font-semibold text-textMuted">Objetivo do projeto</p>
        <p className="mt-0.5 text-sm text-text">{objetivo ?? 'Objetivo não informado. Preencha em “Editar projeto”.'}</p>
      </div>
    </header>
  )
}
