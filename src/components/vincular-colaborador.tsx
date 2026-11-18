'use client'

import { useActionState } from 'react'

import {
  cadastrarColaborador,
  vincularColaborador,
  type EstadoCadastroColaborador,
  type EstadoVinculo,
} from '@/app/wins/acoes-win'
import { Processando, Spinner } from '@/components/indicador-envio'

export type ColaboradorLivre = { id: string; nome: string }

/**
 * Primeira entrada de um usuário: escolher qual colaborador ele é.
 *
 * O vínculo existe porque o nome do colaborador é o que vai para
 * `Projeto.responsavel` quando um WIN for promovido — sem ele, a promoção não
 * saberia de quem é o item.
 */
const classeCampo =
  'mt-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none ' +
  'placeholder:text-textFaint focus:border-accent focus:ring-1 focus:ring-accent'

/**
 * Cadastro do próprio nome — a saída para quem não está na lista.
 *
 * As sugestões vêm dos `Projeto.responsavel` que já existem, e não são
 * enfeite: é esse mesmo nome que vai para o plano de ação quando um WIN for
 * promovido. Se a pessoa digitar uma grafia diferente da que já usa lá, o
 * relatório por responsável passa a contá-la como duas pessoas, e ninguém
 * percebe.
 */
function CadastrarColaborador({ sugestoes }: { sugestoes: string[] }) {
  const [estado, acao, enviando] = useActionState<EstadoCadastroColaborador, FormData>(
    cadastrarColaborador,
    {},
  )

  return (
    <form action={acao} className="mt-4 flex flex-wrap items-end gap-3">
      <Processando ativo={enviando} texto="Cadastrando colaborador…" />
      <div>
        <label className="block text-xs text-textMuted" htmlFor="nome">
          Seu nome
        </label>
        <input
          className={classeCampo}
          id="nome"
          name="nome"
          list="responsaveis-conhecidos"
          maxLength={120}
          placeholder="Como você assina no plano de ação"
          autoComplete="off"
        />
        {sugestoes.length > 0 ? (
          <datalist id="responsaveis-conhecidos">
            {sugestoes.map((nome) => (
              <option key={nome} value={nome} />
            ))}
          </datalist>
        ) : null}
      </div>
      <button
        className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-onAccent"
        type="submit"
        disabled={enviando}
      >
        {enviando ? <Spinner /> : null}
        Cadastrar e usar o card
      </button>
      {estado.erroGeral ? (
        <p className="w-full text-sm text-warn">{estado.erroGeral}</p>
      ) : null}
      {sugestoes.length > 0 ? (
        <p className="w-full text-xs text-textFaint">
          Use a mesma grafia do plano de ação — o campo sugere os nomes que já
          aparecem lá. Grafias diferentes viram duas pessoas no relatório por
          responsável.
        </p>
      ) : null}
    </form>
  )
}

export function VincularColaborador({
  livres,
  sugestoes,
}: {
  livres: ColaboradorLivre[]
  sugestoes: string[]
}) {
  const [estado, acao, enviando] = useActionState<EstadoVinculo, FormData>(vincularColaborador, {})

  return (
    <div className="mt-8 border-l-2 border-previsto bg-surface p-4">
      <h2 className="font-display text-base font-extrabold">Quem é você?</h2>
      <p className="mt-1 text-sm text-textMuted">
        Sua conta ainda não está vinculada a um colaborador. Escolha seu nome uma
        única vez — é ele que vai para o plano de ação quando um WIN for promovido.
      </p>

      {livres.length === 0 ? (
        <p className="mt-4 text-sm text-textMuted">
          Ninguém cadastrado ainda — cadastre seu nome abaixo.
        </p>
      ) : (
        <form action={acao} className="mt-4 flex flex-wrap items-end gap-3">
          <Processando ativo={enviando} texto="Vinculando colaborador…" />
          <div>
            <label className="block text-xs text-textMuted" htmlFor="colaboradorId">
              Colaborador
            </label>
            <select
              className="mt-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent"
              id="colaboradorId"
              name="colaboradorId"
              defaultValue=""
            >
              <option value="">Selecione…</option>
              {livres.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          </div>
          <button
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-onAccent"
            type="submit"
            disabled={enviando}
          >
            {enviando ? <Spinner /> : null}
            Vincular
          </button>
          {estado.erroGeral ? (
            <p className="w-full text-sm text-warn">{estado.erroGeral}</p>
          ) : null}
        </form>
      )}

      <div className={livres.length === 0 ? '' : 'mt-6 border-t border-borderSoft pt-4'}>
        {livres.length > 0 ? (
          <p className="text-sm text-textMuted">Não achou seu nome na lista?</p>
        ) : null}
        <CadastrarColaborador sugestoes={sugestoes} />
      </div>
    </div>
  )
}
