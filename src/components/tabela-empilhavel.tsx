'use client'

import { useEffect, useRef } from 'react'

/**
 * Tabela que vira lista de cartões no celular (CSS em `globals.css`, só na tela
 * estreita; impressão e tela larga ficam como sempre). No cartão, cada valor
 * leva o nome da sua coluna. Os nomes vêm do cabeçalho da própria tabela e são
 * aplicados aqui, para uma tabela nova ou com coluna nova funcionar sem
 * marcar cada célula à mão.
 */
export function TabelaEmpilhavel({ className = '', children }: { className?: string; children: React.ReactNode }) {
  const raiz = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const tabela = raiz.current?.querySelector('table')
    if (!tabela) return
    const rotulos = [...tabela.querySelectorAll('thead th')].map((th) => th.textContent?.trim() ?? '')
    tabela.querySelectorAll('tbody tr').forEach((linha) => {
      linha.querySelectorAll('td').forEach((celula, i) => {
        if (rotulos[i]) celula.setAttribute('data-rotulo', rotulos[i])
      })
    })
  })

  return (
    <div className={`tabela-empilhavel overflow-x-auto ${className}`} ref={raiz}>
      {children}
    </div>
  )
}
