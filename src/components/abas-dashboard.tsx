import Link from 'next/link'

import { type AbaDashboard, hrefDaAba, listarAbas } from '@/lib/dashboard-abas'
import { ROTULO_GRUPO } from '@/lib/dashboard-catalogo'

/**
 * Abas da tela de Dashboards: uma por grupo do catálogo, mais "Todas".
 * São links (a aba vive em `?aba=`), então funcionam sem JavaScript, mantêm os
 * filtros e o período, e não entram na impressão.
 */
export function AbasDashboard({
  ativa,
  parametros,
}: {
  ativa: AbaDashboard
  parametros: Record<string, string>
}) {
  return (
    <nav aria-label="Grupos de relatórios" className="mt-8 print:hidden">
      <ul className="flex gap-x-1 overflow-x-auto border-b border-border lg:flex-wrap">
        {listarAbas(ROTULO_GRUPO).map((item) => {
          const atual = item.aba === ativa
          return (
            <li className="shrink-0" key={item.aba}>
              <Link
                aria-current={atual ? 'page' : undefined}
                className={`-mb-px inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm ${
                  atual
                    ? 'border-accent font-semibold text-text'
                    : 'border-transparent text-textMuted hover:text-accent'
                }`}
                href={hrefDaAba(item.aba, parametros)}
                title={item.aba === 'TODAS' ? 'Todos os relatórios numa página só — use para imprimir' : undefined}
              >
                {item.rotulo}
                <span className="text-xs tabular-nums text-textFaint">{item.relatorios}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
