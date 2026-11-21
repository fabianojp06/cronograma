'use client'

import { useState, useSyncExternalStore } from 'react'

const CONSULTA_TELA_LARGA = '(min-width: 768px)'

function assinar(aoMudar: () => void) {
  const consulta = window.matchMedia(CONSULTA_TELA_LARGA)
  consulta.addEventListener('change', aoMudar)
  return () => consulta.removeEventListener('change', aoMudar)
}

/**
 * Recolhe os filtros no celular: a tela abre com os relatórios à vista, e os
 * filtros ficam atrás de um botão ("Filtros" ou "Filtros (2 ativos)"). Em tela
 * larga (`md` para cima) eles aparecem sempre, sem botão. O servidor renderiza
 * RECOLHIDO e o CSS (`md:block`) mostra em tela larga, então não há "piscada"
 * nem no celular nem no computador.
 */
export function FiltrosRecolhiveis({ ativos, children }: { ativos: number; children: React.ReactNode }) {
  const telaLarga = useSyncExternalStore(
    assinar,
    () => window.matchMedia(CONSULTA_TELA_LARGA).matches,
    () => false,
  )
  const [escolha, setEscolha] = useState<boolean | null>(null)
  // Quem tem filtro ativo vê que há filtro, mas só abre se quiser.
  const aberto = escolha ?? telaLarga

  return (
    <div>
      <button
        aria-controls="filtros-conteudo"
        aria-expanded={aberto}
        className="mt-6 inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium md:hidden"
        onClick={() => setEscolha(!aberto)}
        type="button"
      >
        {aberto ? 'Esconder filtros' : 'Filtros'}
        {ativos > 0 ? <span className="text-xs text-accent">({ativos} {ativos === 1 ? 'ativo' : 'ativos'})</span> : null}
      </button>
      <div className={`${aberto ? 'block' : 'hidden'} md:block`} id="filtros-conteudo">
        {children}
      </div>
    </div>
  )
}
