'use client'

import { useEffect, useSyncExternalStore } from 'react'

import {
  CHAVE_TEMA,
  ESTADO_TEMA_SERVIDOR,
  PREFERENCIAS_TEMA,
  ROTULO_PREFERENCIA,
  aplicarTema,
  lerEstadoTema,
  lerPreferencia,
  resolverTema,
  serializarEstadoTema,
  type PreferenciaTema,
} from '@/lib/tema'

const CONSULTA_ESCURO = '(prefers-color-scheme: dark)'

/** Ouvintes locais — acordados quando a troca parte desta própria aba. */
const ouvintes = new Set<() => void>()

function notificar() {
  for (const ouvinte of ouvintes) ouvinte()
}

/**
 * `localStorage` + preferência do sistema formam um store externo ao React.
 * Assinar os dois é o que mantém o alternador correto quando a troca vem de
 * outra aba (evento `storage`) ou do sistema operacional (`matchMedia`).
 */
function assinar(aoMudar: () => void) {
  ouvintes.add(aoMudar)
  window.addEventListener('storage', aoMudar)
  const consulta = window.matchMedia(CONSULTA_ESCURO)
  consulta.addEventListener('change', aoMudar)

  return () => {
    ouvintes.delete(aoMudar)
    window.removeEventListener('storage', aoMudar)
    consulta.removeEventListener('change', aoMudar)
  }
}

function instantaneo(): string {
  let guardado: string | null = null
  try {
    guardado = localStorage.getItem(CHAVE_TEMA)
  } catch {
    // localStorage bloqueado (modo privado, política do navegador): segue com
    // "sistema" em vez de quebrar o cabeçalho.
  }
  const preferencia = lerPreferencia(guardado)
  return serializarEstadoTema({
    preferencia,
    efetivo: resolverTema(preferencia, window.matchMedia(CONSULTA_ESCURO).matches),
  })
}

function instantaneoServidor(): string {
  return ESTADO_TEMA_SERVIDOR
}

/**
 * Alternador de tema (Sistema / Claro / Escuro).
 *
 * O tema já foi aplicado antes da primeira pintura pelo `SCRIPT_TEMA` no
 * `<head>`; este componente existe para **mudar** a preferência e refletir a
 * atual. Durante a hidratação ele mostra "Sistema", porque o HTML do servidor
 * não tem como conhecer a escolha guardada — e se corrige no mesmo instante.
 */
export function AlternadorTema() {
  const serializado = useSyncExternalStore(assinar, instantaneo, instantaneoServidor)
  const { preferencia, efetivo } = lerEstadoTema(serializado)

  // Mantém o documento em dia quando a origem da mudança não foi o clique
  // aqui — outra aba, ou o sistema operacional trocando de tema.
  useEffect(() => {
    aplicarTema(document.documentElement, efetivo)
  }, [efetivo])

  function escolher(nova: PreferenciaTema) {
    try {
      localStorage.setItem(CHAVE_TEMA, nova)
    } catch {
      // Sem persistência, a troca ainda vale para esta sessão.
    }
    aplicarTema(
      document.documentElement,
      resolverTema(nova, window.matchMedia(CONSULTA_ESCURO).matches),
    )
    notificar()
  }

  return (
    <div
      role="radiogroup"
      aria-label="Tema da interface"
      className="flex items-center gap-0.5 rounded-md border border-border p-0.5"
    >
      {PREFERENCIAS_TEMA.map((opcao) => {
        const selecionada = preferencia === opcao
        return (
          <button
            key={opcao}
            type="button"
            role="radio"
            aria-checked={selecionada}
            onClick={() => escolher(opcao)}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              selecionada ? 'bg-accent text-onAccent' : 'text-textMuted hover:text-accent'
            }`}
          >
            {ROTULO_PREFERENCIA[opcao]}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Botão do cabeçalho: um clique alterna entre claro e escuro, a partir do tema
 * que está valendo agora (inclusive quando a preferência é "Sistema"). A escolha
 * fica guardada como preferência explícita; "Sistema" volta pelo menu de ajuda.
 */
export function BotaoTema() {
  const serializado = useSyncExternalStore(assinar, instantaneo, instantaneoServidor)
  const { efetivo } = lerEstadoTema(serializado)
  const escuro = efetivo === 'escuro'

  function alternar() {
    const nova: PreferenciaTema = escuro ? 'claro' : 'escuro'
    try {
      localStorage.setItem(CHAVE_TEMA, nova)
    } catch {
      // Sem persistência, a troca ainda vale para esta sessão.
    }
    aplicarTema(document.documentElement, nova)
    notificar()
  }

  const rotulo = escuro ? 'Mudar para o tema claro' : 'Mudar para o tema escuro'
  return (
    <button
      aria-label={rotulo}
      className="inline-flex size-10 items-center justify-center rounded-md text-textMuted hover:bg-borderSoft hover:text-accent"
      data-tour="tema-botao"
      onClick={alternar}
      title={rotulo}
      type="button"
    >
      {escuro ? (
        <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" strokeLinecap="round" />
        </svg>
      ) : (
        <svg aria-hidden="true" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
          <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </button>
  )
}
