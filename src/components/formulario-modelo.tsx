'use client'

import { useActionState } from 'react'

import {
  criarProjetoDeModelo,
  salvarComoModelo,
  type EstadoSalvarModelo,
  type EstadoUsarModelo,
} from '@/app/modelos/acoes-modelo'
import { Spinner } from '@/components/indicador-envio'

const campo =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent'
const rotulo = 'block text-sm font-medium text-textMuted'

function Erro({ texto }: { texto?: string }) {
  return texto ? <p className="mt-1 text-sm text-warn">{texto}</p> : null
}

const INICIAL_SALVAR: EstadoSalvarModelo = {}
const INICIAL_USAR: EstadoUsarModelo = {}

export function FormularioSalvarModelo({
  projetoId,
  nomeSugerido,
}: {
  projetoId: string
  nomeSugerido: string
}) {
  const [estado, salvar, pendente] = useActionState(salvarComoModelo, INICIAL_SALVAR)
  return (
    <form action={salvar} aria-busy={pendente} className="mt-6 max-w-xl space-y-4">
      <input name="id" type="hidden" value={projetoId} />
      <div>
        <label className={rotulo} htmlFor="nome-modelo">
          Nome do modelo
        </label>
        <input className={campo} defaultValue={nomeSugerido} id="nome-modelo" maxLength={120} name="nome" required />
      </div>
      <div>
        <label className={rotulo} htmlFor="descricao-modelo">
          Para que serve (opcional)
        </label>
        <textarea className={campo} id="descricao-modelo" maxLength={1000} name="descricao" rows={3} />
      </div>
      {estado.erro ? (
        <p className="text-sm text-warn" role="alert">
          {estado.erro}
        </p>
      ) : null}
      <button
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-60"
        disabled={pendente}
        type="submit"
      >
        {pendente ? <Spinner /> : null}
        {pendente ? 'Salvando…' : 'Salvar como modelo'}
      </button>
    </form>
  )
}

export type ValoresModelo = {
  equipe: string | null
  natureza: string | null
  categoria: string | null
  apoio: string | null
  setorEnvolvido: string | null
}

export function FormularioUsarModelo({
  modeloId,
  valores,
}: {
  modeloId: string
  valores: ValoresModelo
}) {
  const [estado, criar, pendente] = useActionState(criarProjetoDeModelo, INICIAL_USAR)
  const e = estado.erros ?? {}
  const texto = (nome: keyof ValoresModelo | 'referencia' | 'responsavel', rotuloTexto: string, valor?: string | null) => (
    <div>
      <label className={rotulo} htmlFor={`m-${nome}`}>
        {rotuloTexto}
      </label>
      <input className={campo} defaultValue={valor ?? ''} id={`m-${nome}`} maxLength={500} name={nome} />
      <Erro texto={e[nome as keyof typeof e] as string | undefined} />
    </div>
  )
  return (
    <form action={criar} aria-busy={pendente} className="mt-6 max-w-3xl space-y-5">
      <input name="modeloId" type="hidden" value={modeloId} />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={rotulo} htmlFor="m-nome">
            Nome do projeto
          </label>
          <input className={campo} id="m-nome" maxLength={200} name="nome" required />
          <Erro texto={e.nome} />
        </div>
        <div>
          <label className={rotulo} htmlFor="m-inicio">
            Data de início do projeto
          </label>
          <input className={campo} id="m-inicio" name="inicio" required type="date" />
          <Erro texto={e.inicio} />
          <p className="mt-1 text-xs text-textFaint">
            As datas das ações são calculadas a partir dela, em dias úteis. Início em fim de
            semana ou feriado vale o próximo dia útil.
          </p>
        </div>
        {texto('referencia', 'Referência')}
        {texto('equipe', 'Equipe', valores.equipe)}
        {texto('natureza', 'Natureza', valores.natureza)}
        {texto('categoria', 'Categoria', valores.categoria)}
        {texto('responsavel', 'Responsável pelo projeto')}
        {texto('apoio', 'Apoio', valores.apoio)}
        {texto('setorEnvolvido', 'Setor envolvido', valores.setorEnvolvido)}
      </div>
      {estado.erroGeral ? (
        <p className="text-sm text-warn" role="alert">
          {estado.erroGeral}
        </p>
      ) : null}
      <button
        className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-60"
        disabled={pendente}
        type="submit"
      >
        {pendente ? <Spinner /> : null}
        {pendente ? 'Criando…' : 'Criar projeto com as ações do modelo'}
      </button>
    </form>
  )
}
