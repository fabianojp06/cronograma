'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { atualizarRisco, criarRisco, type EstadoRisco } from '@/app/projetos/acoes-risco'
import { Spinner } from '@/components/indicador-envio'
import {
  IMPACTOS_RISCO,
  ROTULO_IMPACTO,
  ROTULO_STATUS_RISCO,
  ROTULO_TIPO,
  STATUS_RISCO,
  TIPOS_RISCO,
} from '@/lib/risco-projeto'

const campo =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent'
const rotulo = 'block text-sm font-medium text-textMuted'

export type ValoresRisco = {
  tipo: string
  titulo: string
  descricao: string
  impacto: string
  status: string
  acaoId: string
  responsavelId: string
  prazo: string
  plano: string
  pedeAjuda: boolean
}

export const RISCO_EM_BRANCO: ValoresRisco = {
  tipo: 'RISCO',
  titulo: '',
  descricao: '',
  impacto: 'MEDIO',
  status: 'ABERTO',
  acaoId: '',
  responsavelId: '',
  prazo: '',
  plano: '',
  pedeAjuda: false,
}

const INICIAL: EstadoRisco = {}

function Erro({ texto }: { texto?: string }) {
  return texto ? <p className="mt-1 text-sm text-warn">{texto}</p> : null
}

/** Formulário de risco/bloqueio (criar e editar). Controlado: o React 19 limpa campos soltos após um erro. */
export function FormularioRisco({
  projetoId,
  inicial,
  riscoId,
  acoes,
  responsaveis,
}: {
  projetoId: string
  inicial: ValoresRisco
  riscoId?: string
  acoes: { id: string; rotulo: string }[]
  responsaveis: { id: string; nome: string }[]
}) {
  const editando = riscoId !== undefined
  const [estado, enviar, pendente] = useActionState(editando ? atualizarRisco : criarRisco, INICIAL)
  const [v, setV] = useState(inicial)
  const mudar =
    (nome: Exclude<keyof ValoresRisco, 'pedeAjuda'>) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setV((x) => ({ ...x, [nome]: e.target.value }))
  const mudarPedeAjuda = (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((x) => ({ ...x, pedeAjuda: e.target.checked }))
  const erros = estado.erros ?? {}

  return (
    <form action={enviar} aria-busy={pendente} className="mt-6 max-w-3xl space-y-5">
      <input name="id" type="hidden" value={projetoId} />
      {riscoId ? <input name="riscoId" type="hidden" value={riscoId} /> : null}

      <fieldset>
        <legend className={rotulo}>Tipo *</legend>
        <div className="mt-1 flex gap-6 text-sm">
          {TIPOS_RISCO.map((t) => (
            <label className="inline-flex items-center gap-2" key={t}>
              <input checked={v.tipo === t} name="tipo" onChange={mudar('tipo')} type="radio" value={t} />
              {ROTULO_TIPO[t]} <span className="text-textFaint">{t === 'RISCO' ? '(pode acontecer)' : '(já está travando)'}</span>
            </label>
          ))}
        </div>
        <Erro texto={erros.tipo} />
      </fieldset>

      <div>
        <label className={rotulo} htmlFor="risco-titulo">Título *</label>
        <input className={campo} id="risco-titulo" maxLength={200} name="titulo" onChange={mudar('titulo')} placeholder="Ex.: Fornecedor pode atrasar a entrega dos servidores" value={v.titulo} />
        <Erro texto={erros.titulo} />
      </div>

      <div>
        <label className={rotulo} htmlFor="risco-descricao">Descrição</label>
        <textarea className={campo} id="risco-descricao" maxLength={2000} name="descricao" onChange={mudar('descricao')} rows={3} value={v.descricao} />
        <Erro texto={erros.descricao} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={rotulo} htmlFor="risco-impacto">Impacto *</label>
          <select className={campo} id="risco-impacto" name="impacto" onChange={mudar('impacto')} value={v.impacto}>
            {IMPACTOS_RISCO.map((i) => (
              <option key={i} value={i}>{ROTULO_IMPACTO[i]}</option>
            ))}
          </select>
          <Erro texto={erros.impacto} />
        </div>
        {editando ? (
          <div>
            <label className={rotulo} htmlFor="risco-status">Status</label>
            <select className={campo} id="risco-status" name="status" onChange={mudar('status')} value={v.status}>
              {STATUS_RISCO.map((s) => (
                <option key={s} value={s}>{ROTULO_STATUS_RISCO[s]}</option>
              ))}
            </select>
            <Erro texto={erros.status} />
          </div>
        ) : null}
        <div>
          <label className={rotulo} htmlFor="risco-prazo">Prazo para tratar</label>
          <input className={campo} id="risco-prazo" name="prazo" onChange={mudar('prazo')} type="date" value={v.prazo} />
          <Erro texto={erros.prazo} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={rotulo} htmlFor="risco-responsavel">Responsável pelo tratamento</label>
          <select className={campo} id="risco-responsavel" name="responsavelId" onChange={mudar('responsavelId')} value={v.responsavelId}>
            <option value="">Sem responsável</option>
            {responsaveis.map((r) => (
              <option key={r.id} value={r.id}>{r.nome}</option>
            ))}
          </select>
          <Erro texto={erros.responsavelId} />
        </div>
        <div>
          <label className={rotulo} htmlFor="risco-acao">Ação afetada</label>
          <select className={campo} id="risco-acao" name="acaoId" onChange={mudar('acaoId')} value={v.acaoId}>
            <option value="">Nenhuma em especial</option>
            {acoes.map((a) => (
              <option key={a.id} value={a.id}>{a.rotulo}</option>
            ))}
          </select>
          <Erro texto={erros.acaoId} />
        </div>
      </div>

      <div>
        <label className={rotulo} htmlFor="risco-plano">Plano de ação (o que será feito)</label>
        <textarea className={campo} id="risco-plano" maxLength={2000} name="plano" onChange={mudar('plano')} rows={3} value={v.plano} />
        <Erro texto={erros.plano} />
      </div>

      <div>
        {/* Caixa desmarcada não envia nada: o campo oculto diz ao servidor que a
            pergunta estava na tela, para desmarcar valer e uma aba antiga não apagar. */}
        <input name="pedeAjudaCampo" type="hidden" value="1" />
        <label className="inline-flex items-center gap-2 text-sm" htmlFor="risco-pede-ajuda">
          <input checked={v.pedeAjuda} id="risco-pede-ajuda" name="pedeAjuda" onChange={mudarPedeAjuda} type="checkbox" />
          Precisa de decisão da diretoria
        </label>
        <p className="mt-1 text-xs text-textFaint">
          Marque quando o tratamento depende de uma decisão que a equipe não pode tomar sozinha.
        </p>
      </div>

      {estado.erroGeral ? (
        <p className="border-l-2 border-warn bg-surface py-2 pl-3 text-sm text-warn" role="alert">{estado.erroGeral}</p>
      ) : null}

      <div className="flex items-center gap-4">
        <button className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-60" disabled={pendente} type="submit">
          {pendente ? <Spinner /> : null}
          {pendente ? 'Salvando…' : editando ? 'Salvar alterações' : 'Registrar'}
        </button>
        <Link className="text-sm text-textMuted hover:text-accent" href={`/projetos/${projetoId}#riscos`}>Cancelar</Link>
      </div>
    </form>
  )
}
