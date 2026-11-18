'use client'

import Link from 'next/link'
import { useState } from 'react'

/**
 * Janela de confirmação exibida depois que a ação é gravada. Fica fora do
 * `<form>`, que é remontado a cada sucesso (`key`), para que o fechamento
 * sobreviva à remontagem. O fechamento é guardado como "id já dispensado" e
 * não como booleano: uma nova criação tem outro id e reabre a janela sem
 * precisar de efeito para zerar o estado.
 */
export function JanelaSucessoAcao({
  criada,
  projetoId,
}: {
  criada?: { id: string; numero: number; descricao: string }
  projetoId: string
}) {
  const [dispensada, setDispensada] = useState<string | null>(null)
  if (!criada || dispensada === criada.id) return null

  const fechar = () => setDispensada(criada.id)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 px-4"
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') fechar()
      }}
    >
      <div
        aria-labelledby="titulo-sucesso-acao"
        aria-modal="true"
        className="w-full max-w-md border-l-2 border-realizado bg-surface p-6"
        role="dialog"
      >
        <h2 className="font-display text-lg font-bold" id="titulo-sucesso-acao">
          Ação incluída com sucesso
        </h2>
        <p className="mt-2 text-sm text-textMuted">
          Ação <strong className="text-text">{criada.numero}</strong> — {criada.descricao}
        </p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <button
            autoFocus
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent"
            onClick={fechar}
            type="button"
          >
            Cadastrar outra ação
          </button>
          <Link className="text-sm text-textMuted hover:text-text" href={`/projetos/${projetoId}`}>
            Voltar ao projeto
          </Link>
        </div>
      </div>
    </div>
  )
}
