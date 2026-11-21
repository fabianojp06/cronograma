'use client'

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

export type AbaDaAcao = {
  id: string
  rotulo: string
  /** Quantos itens a aba tem (aparece ao lado do rótulo); omitido = sem número. */
  contagem?: number
  conteudo: ReactNode
}

/**
 * Abas do contexto da ação (histórico, comentários, links, dependências, riscos),
 * ao lado do formulário. Padrão WAI-ARIA de abas: setas, Home e End navegam.
 * TODOS os painéis ficam no DOM (o inativo só fica `hidden`): assim o rascunho de
 * um comentário ou de um link não se perde ao trocar de aba.
 */
export function AbasAcao({ abas, inicial }: { abas: AbaDaAcao[]; inicial?: string }) {
  const base = useId()
  const [ativa, setAtiva] = useState(abas.some((a) => a.id === inicial) ? inicial! : abas[0].id)
  const botoes = useRef<Record<string, HTMLButtonElement | null>>({})

  function aoTeclar(e: KeyboardEvent, indice: number) {
    const ultimo = abas.length - 1
    const alvo =
      e.key === 'ArrowRight' ? (indice + 1) % abas.length
      : e.key === 'ArrowLeft' ? (indice - 1 + abas.length) % abas.length
      : e.key === 'Home' ? 0
      : e.key === 'End' ? ultimo
      : null
    if (alvo === null) return
    e.preventDefault()
    setAtiva(abas[alvo].id)
    botoes.current[abas[alvo].id]?.focus()
  }

  return (
    <div>
      <div aria-label="Contexto da ação" className="flex gap-1 overflow-x-auto border-b border-border" role="tablist">
        {abas.map((aba, i) => {
          const selecionada = aba.id === ativa
          return (
            <button
              aria-controls={`${base}-painel-${aba.id}`}
              aria-selected={selecionada}
              className={`-mb-px min-h-10 shrink-0 whitespace-nowrap border-b-2 px-2.5 text-sm ${
                selecionada ? 'border-accent font-semibold text-text' : 'border-transparent text-textMuted hover:text-accent'
              }`}
              id={`${base}-aba-${aba.id}`}
              key={aba.id}
              onClick={() => setAtiva(aba.id)}
              onKeyDown={(e) => aoTeclar(e, i)}
              ref={(el) => {
                botoes.current[aba.id] = el
              }}
              role="tab"
              tabIndex={selecionada ? 0 : -1}
              type="button"
            >
              {aba.rotulo}
              {aba.contagem !== undefined ? (
                <span className="ml-1.5 text-xs font-normal tabular-nums text-textFaint">{aba.contagem}</span>
              ) : null}
            </button>
          )
        })}
      </div>
      {abas.map((aba) => (
        <div
          aria-labelledby={`${base}-aba-${aba.id}`}
          className="pt-1 [&>section]:mt-5"
          hidden={aba.id !== ativa}
          id={`${base}-painel-${aba.id}`}
          key={aba.id}
          role="tabpanel"
        >
          {aba.conteudo}
        </div>
      ))}
    </div>
  )
}
