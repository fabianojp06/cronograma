'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

import { itemAtivo, PAINEL, type GrupoDoMenu } from '@/lib/menu'

/**
 * Menu do cabeçalho em tela estreita (celular e tablet em pé): um botão que
 * abre a lista numa grade de dois itens por linha, com área de toque grande.
 * Fecha ao escolher uma tela e com Esc. Acima de `lg` não aparece: o cabeçalho
 * usa o menu em linha de sempre.
 */
export function MenuCelular({ grupos }: { grupos: readonly GrupoDoMenu[] }) {
  const caminho = usePathname()
  const [aberto, setAberto] = useState(false)
  const ativo = itemAtivo(caminho, grupos)?.href ?? null

  return (
    <div className="lg:hidden">
      <button
        aria-controls="menu-celular"
        aria-expanded={aberto}
        className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-text"
        onClick={() => setAberto((a) => !a)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setAberto(false)
        }}
        type="button"
      >
        <svg aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
          <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
        </svg>
        Menu
      </button>
      {aberto ? (
        <nav
          aria-label="Navegação principal"
          className="absolute inset-x-0 top-full z-30 border-b border-border bg-surface px-4 py-3 shadow-lg print:hidden"
          id="menu-celular"
        >
          <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
            <li>{item(PAINEL, ativo, () => setAberto(false))}</li>
          </ul>
          {grupos.map((g) => (
            <div className="mt-3" key={g.id}>
              <p className="px-3 text-xs font-semibold text-textMuted">{g.rotulo}</p>
              <ul className="mt-1 grid grid-cols-2 gap-1 sm:grid-cols-3">
                {g.itens.map((i) => (
                  <li key={i.href}>{item(i, ativo, () => setAberto(false))}</li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      ) : null}
    </div>
  )
}

function item(i: { href: string; rotulo: string }, ativo: string | null, fechar: () => void) {
  const atual = i.href === ativo
  return (
    <Link
      aria-current={atual ? 'page' : undefined}
      className={`flex min-h-11 items-center rounded-md px-3 text-sm ${
        atual ? 'bg-accent font-semibold text-onAccent' : 'text-text hover:bg-borderSoft'
      }`}
      href={i.href}
      onClick={fechar}
    >
      {i.rotulo}
    </Link>
  )
}
