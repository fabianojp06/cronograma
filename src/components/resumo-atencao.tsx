import Link from 'next/link'

import { hrefDaAba, type ItemAtencao } from '@/lib/dashboard-abas'

/**
 * Faixa de números que respondem "o que pede ação?", no topo dos Dashboards.
 * Cada item é um link para a aba e a seção com o detalhe. Traço lateral
 * (padrão do sistema); a cor de atraso só quando o número é um problema.
 */
export function ResumoAtencao({
  itens,
  parametros,
}: {
  itens: ItemAtencao[]
  parametros: Record<string, string>
}) {
  return (
    <section aria-label="O que pede atenção" className="mt-8">
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {itens.map((item) => (
          <li key={item.id}>
            <Link
              className={`block h-full rounded-xl border bg-surface px-4 py-3 hover:bg-bg ${
                item.tom === 'alerta' ? 'border-warn' : 'border-border'
              }`}
              href={hrefDaAba(item.aba, parametros, item.ancora)}
            >
              <span className="block text-xs font-medium text-textMuted">
                {item.rotulo}
              </span>
              <span
                className={`mt-1 block font-display text-2xl font-semibold tabular-nums ${
                  item.tom === 'alerta' ? 'text-warn' : ''
                }`}
              >
                {item.valor}
              </span>
              <span className="block text-xs text-textFaint">{item.detalhe}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
