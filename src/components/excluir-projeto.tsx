'use client'

import { useActionState } from 'react'

import { excluirProjeto, type EstadoExclusaoProjeto } from '@/app/projetos/acoes-projeto'
import { PALAVRA_CONFIRMACAO } from '@/lib/projeto-exclusao'

const ESTADO_INICIAL: EstadoExclusaoProjeto = {}

/**
 * Exclusão lógica, em `<details>`: fica recolhida por padrão para não competir
 * com o formulário de edição, e só envia depois que o usuário digita a palavra
 * de confirmação.
 */
export function ExcluirProjeto({ id, nome }: { id: string; nome: string }) {
  const [estado, acao, enviando] = useActionState(excluirProjeto, ESTADO_INICIAL)

  return (
    <details className="mt-12 border-l-2 border-warn bg-surface py-4 pl-4">
      <summary className="cursor-pointer text-sm font-semibold text-warn">
        Excluir projeto
      </summary>
      <p className="mt-3 max-w-2xl text-sm text-textMuted">
        O projeto <strong className="text-text">{nome}</strong> deixa de aparecer nas
        telas do sistema, mas nada é apagado do banco: as ações e o histórico de
        alterações continuam guardados. Digite{' '}
        <strong className="text-text">{PALAVRA_CONFIRMACAO}</strong> para confirmar.
      </p>
      <form action={acao} className="mt-4 flex flex-wrap items-end gap-3">
        <input type="hidden" name="id" value={id} />
        <div>
          <label className="block text-sm font-medium text-textMuted" htmlFor="confirmacao">
            Confirmação
          </label>
          <input
            autoComplete="off"
            className="mt-1 w-48 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-textFaint focus:border-warn focus:ring-1 focus:ring-warn"
            id="confirmacao"
            name="confirmacao"
            placeholder={PALAVRA_CONFIRMACAO}
          />
        </div>
        <button
          className="rounded-md border border-warn px-4 py-2 text-sm font-semibold text-warn disabled:opacity-60"
          disabled={enviando}
          type="submit"
        >
          {enviando ? 'Excluindo...' : 'Excluir projeto'}
        </button>
      </form>
      {estado.erroGeral ? (
        <p className="mt-3 text-sm text-warn">{estado.erroGeral}</p>
      ) : null}
    </details>
  )
}
