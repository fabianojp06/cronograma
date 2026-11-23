import { formatarDataBR } from '@/lib/formatacao'
import type { AlertaRelatorio, FlashReport, ItemAtividade, RiscoDoRelatorio } from '@/lib/flash-report'
import { ROTULO_IMPACTO, ROTULO_TIPO, prazoVencido, type ImpactoRisco, type TipoRisco } from '@/lib/risco-projeto'

const titulo = 'border-b border-border pb-2 font-display text-base font-bold'
const vazio = 'mt-3 text-sm text-textMuted'

export function AvisosFlash({ avisos }: { avisos: string[] }) {
  if (avisos.length === 0) return null
  return (
    <div className="mt-4 border-l-2 border-warn bg-surface py-3 pl-4 pr-3 text-sm" role="status">
      <p className="font-semibold">Leia antes de usar este relatório</p>
      <ul className="mt-1 list-disc space-y-1 pl-5 text-textMuted">
        {avisos.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  )
}

function ListaDeAtividades({
  id,
  rotulo,
  itens,
  total,
  vazioTexto,
  rotuloData,
}: {
  id: string
  rotulo: string
  itens: ItemAtividade[]
  total: number
  vazioTexto: string
  rotuloData: string
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <h2 className={titulo} id={id}>{rotulo}</h2>
      {itens.length === 0 ? (
        <p className={vazio}>{vazioTexto}</p>
      ) : (
        <ul className="mt-2 divide-y divide-borderSoft text-sm">
          {itens.map((i) => (
            <li className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5" key={i.numero}>
              <span className="min-w-0 flex-1"><span className="tabular-nums text-textMuted">#{i.numero}</span> {i.descricao}</span>
              {i.data ? <span className="text-xs tabular-nums text-textMuted">{rotuloData} {formatarDataBR(i.data)}</span> : null}
            </li>
          ))}
        </ul>
      )}
      {total > itens.length ? <p className="mt-1 text-xs text-textMuted">e mais {total - itens.length}</p> : null}
    </section>
  )
}

export function AtividadesRealizadas({ relatorio }: { relatorio: FlashReport }) {
  return (
    <ListaDeAtividades
      id="t-realizadas"
      itens={relatorio.realizadas}
      rotulo="Atividades realizadas na semana"
      rotuloData="concluída em"
      total={relatorio.totalRealizadas}
      vazioTexto="Nenhuma ação foi concluída nesta semana."
    />
  )
}

export function ProximasAtividades({ relatorio }: { relatorio: FlashReport }) {
  return (
    <ListaDeAtividades
      id="t-proximas"
      itens={relatorio.proximas}
      rotulo="Próximas atividades (semana seguinte)"
      rotuloData="termina em"
      total={relatorio.totalProximas}
      vazioTexto="Nenhuma ação em aberto prevista para a semana seguinte."
    />
  )
}

function rotuloImpacto(r: RiscoDoRelatorio): string {
  return ROTULO_IMPACTO[r.impacto as ImpactoRisco] ?? r.impacto
}

export function PrincipaisRiscos({ riscos, hoje }: { riscos: RiscoDoRelatorio[]; hoje: Date }) {
  return (
    <section aria-label="Principais riscos mapeados" className="min-w-0">
      <h2 className={`${titulo} flex items-baseline justify-between gap-3`}>
        <span>Principais riscos mapeados</span>
        <span className="text-xs font-semibold text-textMuted">Impacto</span>
      </h2>
      {riscos.length === 0 ? (
        <p className={vazio}>Nenhum risco ou bloqueio aberto.</p>
      ) : (
        <ul className="mt-2 divide-y divide-borderSoft text-sm">
          {riscos.map((r) => (
            <li className="flex items-baseline justify-between gap-3 py-1.5" key={r.id}>
              <span className="min-w-0 flex-1">
                <span className="text-xs text-textMuted">{ROTULO_TIPO[r.tipo as TipoRisco] ?? r.tipo}: </span>
                {r.titulo}
                {prazoVencido(r, hoje) ? <span className="text-xs text-textMuted"> · prazo vencido</span> : null}
              </span>
              <span className={`shrink-0 border-l-2 pl-2 font-semibold ${r.impacto === 'ALTO' ? 'border-warn' : r.impacto === 'MEDIO' ? 'border-atencao' : 'border-border'}`}>
                {rotuloImpacto(r)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function AlertasEPontos({ alertas }: { alertas: AlertaRelatorio[] }) {
  return (
    <section aria-label="Alertas e pontos de atenção" className="min-w-0">
      <h2 className={titulo}>Alertas e pontos de atenção</h2>
      {alertas.length === 0 ? (
        <p className={vazio}>Nenhum alerta nesta semana.</p>
      ) : (
        <ul className="mt-2 divide-y divide-borderSoft text-sm">
          {alertas.map((a) => (
            <li className="flex items-start gap-2 py-1.5" key={a.texto}>
              <svg aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-warn" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 3 22 20H2z" />
              </svg>
              <span>{a.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export function PedidoDeAjuda({ pedidos }: { pedidos: RiscoDoRelatorio[] }) {
  return (
    <section aria-label="Pedido de ajuda e decisões" className="min-w-0 border-l-2 border-warn pl-4">
      <h2 className={titulo}>Pedido de ajuda e decisões executivas necessárias</h2>
      {pedidos.length === 0 ? (
        <p className={vazio}>Nenhum pedido de ajuda ou decisão pendente com a diretoria.</p>
      ) : (
        <div className="mt-2 text-sm">
          <div className="hidden grid-cols-[1.2fr_2fr_10rem_7rem] gap-3 border-b border-border pb-1 text-xs font-semibold text-textMuted md:grid print:grid">
            <span>Risco / alerta a ser tratado</span>
            <span>Ação</span>
            <span>Responsável</span>
            <span>Prazo</span>
          </div>
          {pedidos.map((p) => (
            <div className="grid gap-x-3 gap-y-1 border-b border-borderSoft py-2 md:grid-cols-[1.2fr_2fr_10rem_7rem] print:grid-cols-[1.2fr_2fr_10rem_7rem]" key={p.id}>
              <p className="font-semibold">{p.titulo}</p>
              <p><span className="text-xs text-textMuted md:hidden print:hidden">Ação: </span>{p.plano ?? 'Plano de ação ainda não registrado.'}</p>
              <p><span className="text-xs text-textMuted md:hidden print:hidden">Responsável: </span>{p.responsavel ?? 'Sem responsável'}</p>
              <p className="tabular-nums"><span className="text-xs text-textMuted md:hidden print:hidden">Prazo: </span>{p.prazo ? formatarDataBR(p.prazo) : 'Sem prazo'}</p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
