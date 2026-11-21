import Link from 'next/link'

import { BotaoExcluirRisco } from '@/components/botao-excluir-risco'
import {
  ROTULO_IMPACTO,
  ROTULO_STATUS_RISCO,
  ROTULO_TIPO,
  ordenarPorAtencao,
  podeExcluirRisco,
  prazoVencido,
  riscoAberto,
  type ImpactoRisco,
  type StatusRisco,
  type TipoRisco,
} from '@/lib/risco-projeto'

export type RiscoDaLista = {
  id: string
  tipo: string
  titulo: string
  descricao: string | null
  impacto: string
  status: string
  prazo: Date | null
  plano: string | null
  criadoPor: string
  criadoEm: Date
  responsavel: { nome: string } | null
  acao: { numero: number } | null
}

const dataBR = (d: Date) => `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`

function Linha({ r, projetoId, podeEditar, userId, administrador, hoje }: {
  r: RiscoDaLista; projetoId: string; podeEditar: boolean; userId: string | null; administrador: boolean; hoje: Date
}) {
  const vencido = prazoVencido(r, hoje)
  return (
    <li className={`border-l-2 bg-surface px-4 py-3 ${r.impacto === 'ALTO' && riscoAberto(r.status) ? 'border-warn' : 'border-borderSoft'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">
            <span className="mr-2 rounded border border-border px-1.5 py-0.5 text-xs font-semibold">{ROTULO_TIPO[r.tipo as TipoRisco] ?? r.tipo}</span>
            {r.titulo}
          </p>
          <p className="mt-1 text-xs text-textMuted">
            Impacto {ROTULO_IMPACTO[r.impacto as ImpactoRisco]?.toLowerCase() ?? r.impacto} · {ROTULO_STATUS_RISCO[r.status as StatusRisco] ?? r.status}
            {r.responsavel ? ` · ${r.responsavel.nome}` : ' · sem responsável'}
            {r.acao ? ` · ação ${r.acao.numero}` : ''}
            {r.prazo ? <span className={vencido ? 'font-medium text-warn' : undefined}> · prazo {dataBR(r.prazo)}{vencido ? ' (vencido)' : ''}</span> : null}
          </p>
          {r.descricao ? <p className="mt-1 whitespace-pre-wrap break-words text-sm text-textMuted">{r.descricao}</p> : null}
          {r.plano ? <p className="mt-1 whitespace-pre-wrap break-words text-sm"><span className="text-textFaint">Plano: </span>{r.plano}</p> : null}
        </div>
        {podeEditar ? (
          <div className="flex items-center gap-3 text-sm">
            <Link className="text-textMuted hover:text-accent" href={`/projetos/${projetoId}/riscos/${r.id}/editar`}>Editar</Link>
            {userId !== null && podeExcluirRisco(r.criadoPor, userId, administrador) ? <BotaoExcluirRisco id={r.id} titulo={r.titulo} /> : null}
          </div>
        ) : null}
      </div>
    </li>
  )
}

/** Riscos e bloqueios do projeto: os abertos por ordem de atenção; os encerrados recolhidos. */
export function SecaoRiscos({ projetoId, riscos, podeEditar, userId, administrador, hoje }: {
  projetoId: string; riscos: RiscoDaLista[]; podeEditar: boolean; userId: string | null; administrador: boolean; hoje: Date
}) {
  const abertos = ordenarPorAtencao(riscos.filter((r) => riscoAberto(r.status)))
  const encerrados = [...riscos.filter((r) => !riscoAberto(r.status))].sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())
  const props = { projetoId, podeEditar, userId, administrador, hoje }

  return (
    <section aria-labelledby="titulo-riscos" className="mt-12 scroll-mt-6" id="riscos">
      <div className="flex flex-wrap items-center gap-4">
        <h2 className="font-display text-lg font-bold" id="titulo-riscos">
          Riscos e bloqueios <span className="text-sm font-normal text-textFaint">({abertos.length} {abertos.length === 1 ? 'aberto' : 'abertos'})</span>
        </h2>
        {podeEditar ? (
          <Link className="text-sm text-accent hover:underline" href={`/projetos/${projetoId}/riscos/novo`}>Registrar risco ou bloqueio</Link>
        ) : null}
      </div>
      {abertos.length === 0 ? (
        <p className="mt-3 text-sm text-textMuted">Nenhum risco ou bloqueio aberto neste projeto.</p>
      ) : (
        <ul className="mt-3 space-y-2">{abertos.map((r) => <Linha key={r.id} r={r} {...props} />)}</ul>
      )}
      {encerrados.length > 0 ? (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-textMuted hover:text-accent">Resolvidos ou ocorridos ({encerrados.length})</summary>
          <ul className="mt-2 space-y-2">{encerrados.map((r) => <Linha key={r.id} r={r} {...props} />)}</ul>
        </details>
      ) : null}
    </section>
  )
}
