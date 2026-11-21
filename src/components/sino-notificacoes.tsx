import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { contarNaoLidas } from '@/lib/notificacoes-servidor'

/** Sino do cabeçalho: link para /notificacoes com a contagem de não lidas. */
export async function SinoNotificacoes() {
  const { userId } = await auth()
  const naoLidas = userId ? await contarNaoLidas(userId) : 0
  const texto =
    naoLidas === 0 ? 'Notificações' : `Notificações: ${naoLidas} não ${naoLidas === 1 ? 'lida' : 'lidas'}`
  return (
    <Link
      aria-label={texto}
      className="relative inline-flex items-center text-textMuted hover:text-accent"
      href="/notificacoes"
      title={texto}
    >
      <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
        <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
      </svg>
      {naoLidas > 0 ? (
        <span className="absolute -right-2 -top-2 min-w-4 rounded-full bg-warn px-1 text-center text-xs font-bold leading-4 text-onAccent tabular-nums">
          {naoLidas > 99 ? '99+' : naoLidas}
        </span>
      ) : null}
    </Link>
  )
}
