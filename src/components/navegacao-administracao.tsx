import Link from 'next/link'

import { MENU_ADMIN, ROTA_ADMINISTRACAO, itemAdminAtivo } from '@/lib/menu'

/**
 * Menu da área de administração, no topo das telas dela. Só se renderiza para
 * quem administra (as telas decidem); aqui é só a navegação entre as quatro.
 */
export function NavegacaoAdministracao({ atual }: { atual: string }) {
  return (
    <nav
      aria-label="Administração"
      className="mb-6 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-borderSoft pb-3 text-sm print:hidden"
    >
      <Link
        className={atual === ROTA_ADMINISTRACAO ? 'font-bold text-text' : 'text-textMuted hover:text-accent'}
        href={ROTA_ADMINISTRACAO}
      >
        Administração
      </Link>
      {MENU_ADMIN.map((item) => (
        <Link
          aria-current={itemAdminAtivo(item.href, atual) ? 'page' : undefined}
          className={itemAdminAtivo(item.href, atual) ? 'font-bold text-text' : 'text-textMuted hover:text-accent'}
          href={item.href}
          key={item.href}
        >
          {item.rotulo}
        </Link>
      ))}
    </nav>
  )
}
