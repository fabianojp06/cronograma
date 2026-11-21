'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { alvoDoGrupo, grupoAtivo, itemAtivo, PAINEL, type GrupoDoMenu } from '@/lib/menu'

/**
 * Menu do cabeçalho em tela larga: o Painel e os grupos (Trabalho, Pessoas,
 * Análise e, para o administrador, Administração), cada um abrindo uma lista.
 * Padrão de "disclosure": botão com `aria-expanded` e uma lista de links comum
 * (não é `role=menu`, que exigiria navegação por setas). Fecha ao escolher uma
 * tela, com Esc ou ao clicar fora. Abaixo de `lg` quem aparece é o `MenuCelular`.
 */
export function NavegacaoPrincipal({ grupos }: { grupos: readonly GrupoDoMenu[] }) {
  const caminho = usePathname()
  // O grupo aberto vale só para a PÁGINA em que foi aberto: ao navegar, o
  // caminho muda e ele se considera fechado, sem efeito que mexa em estado.
  const [aberto, setAberto] = useState<{ id: string; caminho: string } | null>(null)
  const raiz = useRef<HTMLElement>(null)
  const idAberto = aberto && aberto.caminho === caminho ? aberto.id : null

  useEffect(() => {
    if (!idAberto) return
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
  }, [idAberto])

  const grupoDaPagina = grupoAtivo(caminho, grupos)
  const itemDaPagina = itemAtivo(caminho, grupos)?.href ?? null
  const painelAtivo = caminho === '/'

  return (
    <nav aria-label="Navegação principal" className="hidden items-center gap-1 lg:flex" ref={raiz}>
      <Link
        aria-current={painelAtivo ? 'page' : undefined}
        className={`rounded-md px-3 py-2 text-sm hover:bg-borderSoft ${painelAtivo ? 'font-semibold text-text' : 'text-textMuted hover:text-accent'}`}
        data-tour="menu-painel"
        href={PAINEL.href}
      >
        {PAINEL.rotulo}
      </Link>
      {grupos.map((g) => {
        const abertoAgora = idAberto === g.id
        const dentro = grupoDaPagina === g.id
        return (
          <div className="relative" key={g.id}>
            <button
              aria-controls={`grupo-${g.id}`}
              aria-expanded={abertoAgora}
              className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm hover:bg-borderSoft ${
                dentro ? 'font-semibold text-text' : 'text-textMuted hover:text-accent'
              } ${abertoAgora ? 'bg-borderSoft' : ''}`}
              data-tour={alvoDoGrupo(g.id)}
              onClick={() => setAberto(abertoAgora ? null : { id: g.id, caminho })}
              type="button"
            >
              {g.rotulo}
              <svg aria-hidden="true" className={`size-3 transition-transform ${abertoAgora ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {dentro ? <span aria-hidden="true" className="absolute inset-x-3 -bottom-px h-0.5 bg-accent" /> : null}
            </button>
            {abertoAgora ? (
              <ul
                className="absolute left-0 top-full z-30 mt-1 min-w-52 rounded-md border border-border bg-surface p-1 shadow-lg"
                id={`grupo-${g.id}`}
              >
                {g.itens.map((item) => (
                  <li key={item.href}>
                    <Link
                      aria-current={itemDaPagina === item.href ? 'page' : undefined}
                      className={`flex min-h-10 items-center rounded px-3 text-sm ${
                        itemDaPagina === item.href ? 'bg-accent font-semibold text-onAccent' : 'text-text hover:bg-borderSoft'
                      }`}
                      href={item.href}
                    >
                      {item.rotulo}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        )
      })}
    </nav>
  )
}
