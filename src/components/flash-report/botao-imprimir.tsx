'use client'

import { useTemaClaroNaImpressao } from '@/components/barra-exportacao'

/** Imprimir (ou salvar em PDF) pelo navegador; o tema escuro é desligado durante a impressão. */
export function BotaoImprimir() {
  useTemaClaroNaImpressao()
  return (
    <button
      className="rounded-md border border-border px-3 py-1.5 text-sm text-textMuted hover:border-accent hover:text-accent print:hidden"
      onClick={() => window.print()}
      type="button"
    >
      Imprimir / salvar em PDF
    </button>
  )
}
