import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { NavegacaoAdministracao } from '@/components/navegacao-administracao'
import { contaPodeAdministrar } from '@/lib/administracao-servidor'
import { MENU_ADMIN, ROTA_ADMINISTRACAO } from '@/lib/menu'

export const metadata = { title: 'Administração — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

export default async function AdministracaoPage() {
  const { userId } = await auth()
  if (!userId || !(await contaPodeAdministrar(userId))) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="font-display text-2xl font-extrabold">Administração</h1>
        <p className="mt-4 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
          Só administradores acessam esta área.
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <NavegacaoAdministracao atual={ROTA_ADMINISTRACAO} />
      <p className="text-sm font-medium uppercase tracking-wide text-accent">Cronograma CTCEA</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Administração</h1>
      <p className="mt-2 max-w-2xl text-sm text-textMuted">
        Ferramentas de quem administra o sistema. Os demais perfis não veem esta área.
      </p>
      <ul className="mt-6 space-y-3">
        {MENU_ADMIN.map((item) => (
          <li className="border-l-2 border-accent bg-surface py-2 pl-4" key={item.href}>
            <Link className="font-medium text-text hover:text-accent hover:underline" href={item.href}>
              {item.rotulo}
            </Link>
            <p className="text-sm text-textMuted">{item.descricao}</p>
          </li>
        ))}
      </ul>
    </main>
  )
}
