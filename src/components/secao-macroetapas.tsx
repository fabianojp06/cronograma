'use client'

import { useActionState, useState } from 'react'

import {
  criarMacroetapa,
  excluirMacroetapa,
  renomearMacroetapa,
  reordenarMacroetapa,
  type EstadoMacroetapa,
} from '@/app/projetos/acoes-macroetapa'
import { Spinner } from '@/components/indicador-envio'
import { MAXIMO_MACROETAPAS, TAMANHO_NOME_MACROETAPA, editorAberto, podeCriarMais } from '@/lib/macroetapa'

export type MacroetapaDaLista = { id: string; nome: string; ordem: number; acoes: number }

const campo =
  'w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent'
const botao =
  'inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-textMuted hover:border-accent hover:text-accent disabled:opacity-60'
const INICIAL: EstadoMacroetapa = {}

function Mensagem({ estado }: { estado: EstadoMacroetapa }) {
  if (!estado.mensagem) return null
  return (
    <p className={`mt-2 text-sm ${estado.ok ? 'text-textMuted' : 'text-warn'}`} role={estado.ok ? 'status' : 'alert'}>
      {estado.mensagem}
    </p>
  )
}

function Linha({ m, numero, projetoId, primeira, ultima }: { m: MacroetapaDaLista; numero: number; projetoId: string; primeira: boolean; ultima: boolean }) {
  const [abertoCom, setAbertoCom] = useState<EstadoMacroetapa | null>(null)
  const [nome, setNome] = useState(m.nome)
  const [estRenomear, renomear, renomeando] = useActionState(renomearMacroetapa, INICIAL)
  const [estOrdem, mover, movendo] = useActionState(reordenarMacroetapa, INICIAL)
  const [estExcluir, excluir, excluindo] = useActionState(excluirMacroetapa, INICIAL)
  const aberto = editorAberto(abertoCom, estRenomear)

  return (
    <li className="border-l-2 border-borderSoft bg-surface px-3 py-2 text-sm">
      {aberto ? (
        <form action={renomear} aria-busy={renomeando} className="flex flex-wrap items-center gap-2">
          <input name="projetoId" type="hidden" value={projetoId} />
          <input name="id" type="hidden" value={m.id} />
          <label className="sr-only" htmlFor={`macro-${m.id}`}>Nome da macroetapa</label>
          <input className={`${campo} max-w-xs`} id={`macro-${m.id}`} maxLength={TAMANHO_NOME_MACROETAPA} name="nome" onChange={(e) => setNome(e.target.value)} value={nome} />
          <button className={botao} disabled={renomeando} type="submit">{renomeando ? <Spinner /> : null}Salvar</button>
          <button className="text-textMuted hover:text-accent" onClick={() => { setNome(m.nome); setAbertoCom(null) }} type="button">Cancelar</button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="min-w-0 break-words">
            <span className="mr-2 tabular-nums text-textFaint">{numero}.</span>
            <span className="font-medium">{m.nome}</span>
            <span className="ml-2 text-xs text-textFaint">{m.acoes} {m.acoes === 1 ? 'ação' : 'ações'}</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <form action={mover} aria-busy={movendo} className="flex gap-1">
              <input name="projetoId" type="hidden" value={projetoId} />
              <input name="id" type="hidden" value={m.id} />
              <button aria-label={`Subir ${m.nome}`} className={botao} disabled={movendo || primeira} name="intencao" type="submit" value="subir">Subir</button>
              <button aria-label={`Descer ${m.nome}`} className={botao} disabled={movendo || ultima} name="intencao" type="submit" value="descer">Descer</button>
            </form>
            <button aria-label={`Renomear ${m.nome}`} className="text-textMuted hover:text-accent" onClick={() => { setNome(m.nome); setAbertoCom(estRenomear) }} type="button">Renomear</button>
            <form
              action={excluir}
              onSubmit={(e) => {
                if (!window.confirm(
                    m.acoes === 0
                      ? `Excluir a macroetapa "${m.nome}"?`
                      : `Excluir a macroetapa "${m.nome}"? ${m.acoes === 1 ? 'A ação vinculada não é apagada' : `As ${m.acoes} ações vinculadas não são apagadas`}: só ficam sem macroetapa.`,
                  )) e.preventDefault()
              }}
            >
              <input name="projetoId" type="hidden" value={projetoId} />
              <input name="id" type="hidden" value={m.id} />
              <button aria-label={`Excluir ${m.nome}`} className="text-warn hover:underline disabled:opacity-60" disabled={excluindo} type="submit">Excluir</button>
            </form>
          </div>
        </div>
      )}
      <Mensagem estado={estRenomear.mensagem ? estRenomear : estOrdem.mensagem ? estOrdem : estExcluir} />
    </li>
  )
}

/** Cadastro das macroetapas do projeto: criar, renomear, reordenar e excluir. */
export function SecaoMacroetapas({ projetoId, macroetapas }: { projetoId: string; macroetapas: MacroetapaDaLista[] }) {
  const [estado, criar, criando] = useActionState(criarMacroetapa, INICIAL)
  const pode = podeCriarMais(macroetapas.length)

  return (
    <section aria-labelledby="titulo-macroetapas" className="mt-12 scroll-mt-6" id="macroetapas">
      <h2 className="font-display text-lg font-bold" id="titulo-macroetapas">
        Macroetapas <span className="text-sm font-normal text-textFaint">({macroetapas.length} de {MAXIMO_MACROETAPAS})</span>
      </h2>
      <p className="mt-1 text-sm text-textMuted">
        Agrupam as ações do projeto em etapas grandes. Excluir uma macroetapa não apaga as ações: elas só ficam sem macroetapa.
      </p>
      {macroetapas.length === 0 ? (
        <p className="mt-3 text-sm text-textMuted">Nenhuma macroetapa cadastrada.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {macroetapas.map((m, i) => (
            <Linha key={m.id} m={m} numero={i + 1} primeira={i === 0} projetoId={projetoId} ultima={i === macroetapas.length - 1} />
          ))}
        </ul>
      )}
      {pode ? (
        <form action={criar} aria-busy={criando} className="mt-4 flex flex-wrap items-center gap-2" key={estado.ok ? 'ok' : 'novo'}>
          <input name="projetoId" type="hidden" value={projetoId} />
          <label className="sr-only" htmlFor="macro-nova">Nome da nova macroetapa</label>
          <input className={`${campo} max-w-xs`} id="macro-nova" maxLength={TAMANHO_NOME_MACROETAPA} name="nome" placeholder="Ex.: Homologação" />
          <button className={botao} disabled={criando} type="submit">{criando ? <Spinner /> : null}Adicionar macroetapa</button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-textMuted">O projeto já tem o máximo de {MAXIMO_MACROETAPAS} macroetapas.</p>
      )}
      <Mensagem estado={estado} />
    </section>
  )
}
