'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import {
  salvarAvaliacao,
  type EstadoFormularioAvaliacao,
} from '@/app/priorizacao/acoes-matriz'
import {
  ESCALA_GUT,
  ESCALA_NOTA,
  FATORES_GUT,
  ROTULO_ESCALA_GUT,
  ROTULO_FATOR_GUT,
  ROTULO_GRUPO,
  ROTULO_NOTA,
  criteriosDoGrupo,
  type CriterioId,
  type FatorGut,
  type GrupoCriterio,
  type Nota,
  type NotaGut,
} from '@/lib/matriz-criterios'
import type { ErrosAvaliacao } from '@/lib/matriz-validacao'
import { Processando, Spinner } from '@/components/indicador-envio'

const ESTADO_INICIAL: EstadoFormularioAvaliacao = {}

const classeSelect =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text ' +
  'outline-none focus:border-accent focus:ring-1 focus:ring-accent'

function Erro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null
  return <p className="mt-1 text-sm text-warn">{mensagem}</p>
}

/** Valores atuais da avaliação, ou `null` quando o projeto ainda não foi avaliado. */
export type ValoresAvaliacao =
  | ({ [C in CriterioId]: number } & { [F in FatorGut]: number } & {
      observacao: string | null
    })
  | null

function GrupoCriterios({
  grupo,
  valores,
  erros,
}: {
  grupo: GrupoCriterio
  valores: ValoresAvaliacao
  erros?: ErrosAvaliacao
}) {
  return (
    <fieldset className="border-l-2 border-accent pl-4">
      <legend className="text-xs font-semibold text-textMuted">
        {ROTULO_GRUPO[grupo]}
      </legend>
      <div className="mt-3 space-y-4">
        {criteriosDoGrupo(grupo).map((criterio) => (
          <div key={criterio.id}>
            <label className="block text-sm font-medium text-text" htmlFor={criterio.id}>
              {criterio.rotulo}
            </label>
            <p className="text-xs text-textFaint">{criterio.ajuda}</p>
            <select
              className={classeSelect}
              id={criterio.id}
              name={criterio.id}
              defaultValue={String(valores?.[criterio.id] ?? '')}
            >
              <option value="">Selecione…</option>
              {ESCALA_NOTA.map((nota) => (
                <option key={nota} value={nota}>
                  {nota} — {ROTULO_NOTA[nota as Nota]}
                </option>
              ))}
            </select>
            <Erro mensagem={erros?.[criterio.id]} />
          </div>
        ))}
      </div>
    </fieldset>
  )
}

export function FormularioAvaliacao({
  projetoId,
  projetoNome,
  valores,
}: {
  projetoId: string
  projetoNome: string
  valores: ValoresAvaliacao
}) {
  const [estado, acao, enviando] = useActionState(salvarAvaliacao, ESTADO_INICIAL)

  return (
    <form action={acao} className="mt-8 space-y-8">
      <Processando ativo={enviando} texto="Salvando avaliação…" />
      <input type="hidden" name="projetoId" value={projetoId} />

      <div className="grid gap-8 lg:grid-cols-2">
        <GrupoCriterios grupo="BENEFICIO" valores={valores} erros={estado.erros} />
        <GrupoCriterios grupo="ESFORCO" valores={valores} erros={estado.erros} />
      </div>

      <fieldset className="border-l-2 border-warn pl-4">
        <legend className="text-xs font-semibold text-textMuted">
          GUT — Gravidade, Urgência e Tendência
        </legend>
        <p className="mt-1 text-xs text-textFaint">
          Multiplicam-se entre si (G × U × T), então o GUT pesa de forma não-linear:
          5 × 5 × 5 = 125 contra 3 × 3 × 3 = 27.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          {FATORES_GUT.map((fator) => (
            <div key={fator}>
              <label className="block text-sm font-medium text-text" htmlFor={fator}>
                {ROTULO_FATOR_GUT[fator]}
              </label>
              <select
                className={classeSelect}
                id={fator}
                name={fator}
                defaultValue={String(valores?.[fator] ?? '')}
              >
                <option value="">Selecione…</option>
                {ESCALA_GUT.map((nota) => (
                  <option key={nota} value={nota}>
                    {nota} — {ROTULO_ESCALA_GUT[fator][nota as NotaGut]}
                  </option>
                ))}
              </select>
              <Erro mensagem={estado.erros?.[fator]} />
            </div>
          ))}
        </div>
      </fieldset>

      <div>
        <label className="block text-sm font-medium text-textMuted" htmlFor="observacao">
          Observação (opcional)
        </label>
        <p className="text-xs text-textFaint">
          Por que estas notas. É o que explica a avaliação a quem revisar depois.
        </p>
        <textarea
          className={classeSelect}
          id="observacao"
          name="observacao"
          rows={3}
          defaultValue={valores?.observacao ?? ''}
        />
        <Erro mensagem={estado.erros?.observacao} />
      </div>

      {estado.erroGeral ? (
        <p className="border-l-2 border-warn bg-surface py-2 pl-4 text-sm text-warn">
          {estado.erroGeral}
        </p>
      ) : null}

      {estado.salvo ? (
        <p className="border-l-2 border-realizado bg-surface py-2 pl-4 text-sm text-realizado">
          Avaliação de <strong>{projetoNome}</strong> salva. O ranking da matriz já
          reflete as novas notas.
        </p>
      ) : null}

      <div className="flex items-center gap-4">
        <button
          className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-onAccent disabled:opacity-60"
          type="submit"
          disabled={enviando}
        >
          {enviando ? <Spinner /> : null}
          {enviando ? 'Salvando…' : 'Salvar avaliação'}
        </button>
        <Link className="text-sm text-textMuted hover:text-accent" href="/priorizacao">
          Voltar para a matriz
        </Link>
      </div>
    </form>
  )
}
