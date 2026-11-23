'use client'

import { useEffect } from 'react'

/**
 * Exportar para levar a uma reunião: Excel por download direto da rota, e PDF
 * pela impressão do navegador ("Salvar como PDF"). Imprimir não precisa de
 * biblioteca nem de servidor, e usa a própria tela como relatório.
 *
 * O papel é branco: no tema escuro a impressão sairia com texto claro sobre
 * fundo que a impressora não pinta. Por isso o tema escuro é desligado durante
 * a impressão — também quando ela vem de Ctrl+P, pois escuta os eventos do
 * navegador e não só o clique do botão.
 */
export function useTemaClaroNaImpressao() {
  useEffect(() => {
    const html = document.documentElement
    let eraEscuro = false
    const antes = () => {
      eraEscuro = html.classList.contains('dark')
      html.classList.remove('dark')
    }
    const depois = () => {
      if (eraEscuro) html.classList.add('dark')
    }
    window.addEventListener('beforeprint', antes)
    window.addEventListener('afterprint', depois)
    return () => {
      window.removeEventListener('beforeprint', antes)
      window.removeEventListener('afterprint', depois)
    }
  }, [])
}

/* Downloads de arquivo, não navegação: <Link> tentaria uma transição de página. */
/* eslint-disable @next/next/no-html-link-for-pages */
const classeLink = 'text-accent hover:underline'

export function BarraExportacao({
  /** Query string dos filtros do painel, para o Excel de projetos sair como a tela. */
  consulta = '',
  mostrarExcel = true,
}: {
  consulta?: string
  mostrarExcel?: boolean
}) {
  useTemaClaroNaImpressao()
  const sufixo = consulta ? `?${consulta}` : ''

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm print:hidden">
      <span className="text-textMuted">Exportar:</span>
      {mostrarExcel ? (
        <>
          <a className={classeLink} href={`/api/exportar/projetos${sufixo}`}>
            Projetos (Excel)
          </a>
          <a className={classeLink} href="/api/exportar/acoes">
            Todas as ações (Excel)
          </a>
          <a className={classeLink} href="/api/exportar/atrasadas">
            Ações atrasadas (Excel)
          </a>
        </>
      ) : null}
      <button className={classeLink} type="button" onClick={() => window.print()}>
        Esta tela em PDF
      </button>
    </div>
  )
}
