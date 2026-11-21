'use client'

import { useActionState, useState } from 'react'

import { adicionarLink, atualizarLink, removerLink, type EstadoLink } from '@/app/projetos/acoes-link'
import { Spinner } from '@/components/indicador-envio'
import { origemDoLink, ROTULO_TIPO_LINK, TIPOS_LINK, type TipoLink } from '@/lib/link-acao'

const campo =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent'
const rotulo = 'block text-sm font-medium text-textMuted'
const botao =
  'inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-sm text-textMuted hover:border-accent hover:text-accent disabled:opacity-60'

export type LinkDaAcao = { id: string; titulo: string; url: string; tipo: string }

const INICIAL: EstadoLink = {}

function Erro({ texto }: { texto?: string }) {
  return texto ? <p className="mt-1 text-sm text-warn">{texto}</p> : null
}

/** Os três campos do link. Controlado: o React 19 limpa campos soltos depois de um erro. */
function CamposDoLink({ inicial, erros, prefixo }: { inicial: { titulo: string; url: string; tipo: string }; erros: EstadoLink['erros']; prefixo: string }) {
  const [v, setV] = useState(inicial)
  return (
    <div className="grid gap-3 sm:grid-cols-[1fr_1.4fr_10rem]">
      <div>
        <label className={rotulo} htmlFor={`${prefixo}-titulo`}>Título *</label>
        <input className={campo} id={`${prefixo}-titulo`} maxLength={200} name="titulo" onChange={(e) => setV({ ...v, titulo: e.target.value })} placeholder="Ex.: Ata do kickoff" value={v.titulo} />
        <Erro texto={erros?.titulo} />
      </div>
      <div>
        <label className={rotulo} htmlFor={`${prefixo}-url`}>Endereço (link) *</label>
        <input className={campo} id={`${prefixo}-url`} inputMode="url" name="url" onChange={(e) => setV({ ...v, url: e.target.value })} placeholder="https://..." value={v.url} />
        <Erro texto={erros?.url} />
      </div>
      <div>
        <label className={rotulo} htmlFor={`${prefixo}-tipo`}>Tipo</label>
        <select className={campo} id={`${prefixo}-tipo`} name="tipo" onChange={(e) => setV({ ...v, tipo: e.target.value })} value={v.tipo}>
          {TIPOS_LINK.map((t) => (
            <option key={t} value={t}>{ROTULO_TIPO_LINK[t]}</option>
          ))}
        </select>
        <Erro texto={erros?.tipo} />
      </div>
    </div>
  )
}

function FormularioNovo({ acaoId }: { acaoId: string }) {
  const [estado, enviar, pendente] = useActionState(adicionarLink, INICIAL)
  return (
    // A `key` muda quando o link é salvo: o formulário recomeça vazio.
    <form action={enviar} aria-busy={pendente} className="mt-4" key={estado.feitoEm ?? 'novo'}>
      <input name="id" type="hidden" value={acaoId} />
      <CamposDoLink erros={estado.erros} inicial={{ titulo: '', url: '', tipo: 'DOCUMENTO' }} prefixo="link-novo" />
      {estado.erro ? <p className="mt-2 text-sm text-warn" role="alert">{estado.erro}</p> : null}
      <button className={`${botao} mt-3`} disabled={pendente} type="submit">
        {pendente ? <Spinner /> : null}
        Adicionar link
      </button>
    </form>
  )
}

function LinhaDoLink({ link, podeEditar }: { link: LinkDaAcao; podeEditar: boolean }) {
  const [editando, setEditando] = useState(false)
  const [estado, enviar, pendente] = useActionState(atualizarLink, INICIAL)
  // Salvou: fecha o editor (a lista já vem atualizada do servidor).
  const aberto = editando && estado.feitoEm === undefined

  return (
    <li className="border-l-2 border-borderSoft bg-surface px-3 py-2 text-sm">
      {aberto ? (
        <form action={enviar} aria-busy={pendente}>
          <input name="linkId" type="hidden" value={link.id} />
          <CamposDoLink erros={estado.erros} inicial={link} prefixo={`link-${link.id}`} />
          {estado.erro ? <p className="mt-2 text-sm text-warn" role="alert">{estado.erro}</p> : null}
          <div className="mt-3 flex gap-3">
            <button className={botao} disabled={pendente} type="submit">
              {pendente ? <Spinner /> : null}
              Salvar
            </button>
            <button className="text-sm text-textMuted hover:text-accent" onClick={() => setEditando(false)} type="button">Cancelar</button>
          </div>
        </form>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p>
              <span className="mr-2 rounded border border-border px-1.5 py-0.5 text-xs font-semibold">{ROTULO_TIPO_LINK[link.tipo as TipoLink] ?? link.tipo}</span>
              <a className="break-words font-medium text-text underline hover:text-accent" href={link.url} rel="noopener noreferrer" target="_blank">
                {link.titulo}
                <span className="sr-only"> (abre em outra aba)</span>
              </a>
            </p>
            <p className="mt-0.5 text-xs text-textFaint">{origemDoLink(link.url)}</p>
          </div>
          {podeEditar ? (
            <div className="flex items-center gap-3 text-xs">
              <button className="text-textMuted hover:text-accent" onClick={() => setEditando(true)} type="button">Editar</button>
              <form
                action={removerLink}
                onSubmit={(e) => {
                  if (!window.confirm(`Remover o link "${link.titulo}"? O documento em si não é afetado.`)) e.preventDefault()
                }}
              >
                <input name="linkId" type="hidden" value={link.id} />
                <button aria-label={`Remover o link ${link.titulo}`} className="text-textMuted hover:text-warn" type="submit">Remover</button>
              </form>
            </div>
          ) : null}
        </div>
      )}
    </li>
  )
}

/**
 * Links e anexos de uma ação. Só o endereço: o arquivo fica onde a CTCEA já o
 * guarda, e quem consegue abri-lo é decidido lá (SharePoint, Drive...).
 */
export function LinksAcao({ acaoId, links, podeEditar }: { acaoId: string; links: LinkDaAcao[]; podeEditar: boolean }) {
  if (links.length === 0 && !podeEditar) return null
  return (
    <section aria-labelledby="titulo-links" className="mt-8">
      <h2 className="font-display text-base font-bold" id="titulo-links">
        Links e anexos <span className="text-sm font-normal text-textFaint">({links.length})</span>
      </h2>
      <p className="mt-1 text-xs text-textFaint">
        O sistema guarda só o endereço. Quem consegue abrir o documento é decidido onde ele está (SharePoint, Drive...).
      </p>
      {links.length === 0 ? (
        <p className="mt-3 text-sm text-textMuted">Nenhum link nesta ação.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {links.map((l) => (
            <LinhaDoLink key={l.id} link={l} podeEditar={podeEditar} />
          ))}
        </ul>
      )}
      {podeEditar ? <FormularioNovo acaoId={acaoId} /> : null}
    </section>
  )
}
