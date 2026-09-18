import Link from 'next/link'

import type { ResumoPainel } from '@/lib/painel-consolidado'

/** Indicador marcado por traço lateral colorido — sem card com sombra. */
function Indicador({
  rotulo,
  valor,
  detalhe,
  traco = 'border-accent',
  corValor = 'text-text',
  href,
}: {
  rotulo: string
  valor: string
  detalhe?: string
  traco?: string
  corValor?: string
  /** Quando presente, o indicador vira atalho para a listagem já filtrada. */
  href?: string
}) {
  const conteudo = (
    <>
      <p className="text-xs font-medium uppercase tracking-wide text-textMuted">
        {rotulo}
      </p>
      <p className={`mt-1 font-display text-2xl font-extrabold tabular-nums ${corValor}`}>
        {valor}
      </p>
      {detalhe ? <p className="text-xs text-textFaint">{detalhe}</p> : null}
    </>
  )

  const classe = `block border-l-2 ${traco} bg-surface py-2 pl-4`

  return href ? (
    <Link className={classe} href={href}>
      {conteudo}
    </Link>
  ) : (
    <div className={classe}>{conteudo}</div>
  )
}

export function IndicadoresPainel({ painel }: { painel: ResumoPainel }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Indicador
        rotulo="Projetos ativos"
        valor={String(painel.totalProjetos)}
        detalhe={`${painel.projetosConcluidos} concluído(s)`}
      />
      <Indicador
        rotulo="Ações"
        valor={String(painel.totalAcoes)}
        detalhe={`${painel.acoesConcluidas} concluída(s)`}
        traco="border-previsto"
      />
      <Indicador
        rotulo="Progresso geral"
        valor={`${painel.percentualConcluido}%`}
        detalhe="ações concluídas sobre o total"
        traco="border-realizado"
        corValor="text-realizado"
      />
      <Indicador
        rotulo="Projetos com atraso"
        valor={String(painel.projetosAtrasados)}
        detalhe={`${painel.acoesAtrasadas} ação(ões) atrasada(s)`}
        traco="border-warn"
        corValor={painel.projetosAtrasados > 0 ? 'text-warn' : 'text-text'}
        href="/?status=ATRASADO"
      />
    </div>
  )
}
