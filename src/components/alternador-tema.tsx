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
