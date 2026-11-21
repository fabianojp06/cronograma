'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { AlternadorTema } from '@/components/alternador-tema'
import { iniciarTour } from '@/components/tour-guiado'

/**
 * "Ajuda e preferências": o que antes ficava solto no cabeçalho (Manual, Tour e
 * o seletor de tema) agora mora num menu só, ao lado do avatar. O avatar
 * continua sendo o do Clerk (conta e sair): o menu dele não é personalizado
 * aqui porque não dá para testar o componente real no ambiente de teste.
 */
export function MenuAjuda({ administrador }: { administrador: boolean }) {
  const caminho = usePathname()
  const [aberto, setAberto] = useState<string | null>(null)
  const raiz = useRef<HTMLDivElement>(null)
  // Aberto só na página em que foi aberto (ver `NavegacaoPrincipal`).
  const visivel = aberto === caminho

  useEffect(() => {
    if (!visivel) return
    const fora = (e: MouseEvent) => {
      if (raiz.current && !raiz.current.contains(e.target as Node)) setAberto(null)
    }
    const tecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(null)
    }
    document.addEventListener('mousedown', fora)
    document.addEventListener('keydown', tecla)
    return () => {
      document.removeEventListener('mousedown', fora)
      document.removeEventListener('keydown', tecla)
    }
  }, [visivel])

  return (
    <div className="relative" ref={raiz}>
      <button
        aria-controls="menu-ajuda"
        aria-expanded={visivel}
        aria-label="Ajuda e preferências"
        className={`inline-flex size-10 items-center justify-center rounded-md text-textMuted hover:bg-borderSoft hover:text-accent ${visivel ? 'bg-borderSoft' : ''}`}
        data-tour="ajuda"
        onClick={() => setAberto(visivel ? null : caminho)}
        title="Ajuda e preferências"
        type="button"
      >
        <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="9" />
          <path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17h.01" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {visivel ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-60 rounded-md border border-border bg-surface p-1 shadow-lg" id="menu-ajuda">
          <Link className="flex min-h-10 items-center rounded px-3 text-sm text-text hover:bg-borderSoft" href="/manual">
            Manual
          </Link>
          <button
            className="flex min-h-10 w-full items-center rounded px-3 text-left text-sm text-text hover:bg-borderSoft"
            onClick={() => {
              setAberto(null)
              iniciarTour(administrador)
            }}
            type="button"
          >
            Fazer o tour
          </button>
          <div className="mt-1 border-t border-borderSoft px-3 py-2" data-tour="tema">
            <p className="mb-1.5 text-xs text-textMuted">Tema</p>
            <AlternadorTema />
          </div>
        </div>
      ) : null}
    </div>
  )
}
