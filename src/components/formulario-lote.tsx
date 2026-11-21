'use client'

import Link from 'next/link'
import { useActionState, useRef, useState } from 'react'

import {
  aplicarLote,
  previaLote,
  type EstadoAplicacao,
  type EstadoPrevia,
} from '@/app/projetos/acoes-lote'
import { Spinner } from '@/components/indicador-envio'
import { LIMITE_LOTE, MAX_DIAS_UTEIS, ROTULO_CAMPO_LOTE, SEM_RESPONSAVEL } from '@/lib/edicao-lote'
import { formatarValorHistorico } from '@/lib/historico-exibicao'
import { MOTIVOS_REPLANEJAMENTO, ROTULO_MOTIVO_REPLANEJAMENTO } from '@/lib/motivo-replanejamento'

export type AcaoParaLote = {
  id: string
  numero: number
  descricao: string
  status: string
  responsavel: string | null
  /** Já formatado (dd/mm/aaaa a dd/mm/aaaa) ou "sem previsto". */
  previsto: string
}

const PREVIA_INICIAL: EstadoPrevia = {}
const APLICACAO_INICIAL: EstadoAplicacao = {}

const campo =
  'mt-1 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-accent focus:ring-1 focus:ring-accent'

export function FormularioLote({
  projetoId,
  acoes,
  responsaveis,
}: {
  projetoId: string
  acoes: AcaoParaLote[]
  responsaveis: { id: string; nome: string }[]
}) {
  const [previa, pedirPrevia, gerando] = useActionState(previaLote, PREVIA_INICIAL)
  const [aplicacao, aplicar, gravando] = useActionState(aplicarLote, APLICACAO_INICIAL)
  const formulario = useRef<HTMLFormElement>(null)
  const [motivo, setMotivo] = useState('')
  const [detalhe, setDetalhe] = useState('')

  function marcarTodas(marcar: boolean) {
    formulario.current
      ?.querySelectorAll<HTMLInputElement>('input[name="ids"]')
      .forEach((caixa) => {
        caixa.checked = marcar
      })
  }

  if (aplicacao.resultado) {
    const r = aplicacao.resultado
    return (
      <div className="mt-8" role="status">
        <p className="border-l-2 border-realizado bg-surface py-3 pl-4 text-sm">
          <strong>{r.gravadas}</strong> {r.gravadas === 1 ? 'ação alterada' : 'ações alteradas'}
          {r.semMudanca > 0 ? `; ${r.semMudanca} sem mudança.` : '.'} O histórico de cada
          uma registra a alteração.
        </p>
        {r.conflitos.length > 0 ? (
          <div className="mt-3 border-l-2 border-warn bg-surface py-3 pl-4 text-sm">
            <p className="font-medium">
              {r.conflitos.length === 1 ? '1 ação foi' : `${r.conflitos.length} ações foram`}{' '}
              alterada(s) por outra pessoa depois da prévia e ficou de fora, sem ser sobrescrita:
            </p>
            <ul className="mt-1 list-disc pl-5 text-textMuted">
              {r.conflitos.map((c) => (
                <li key={c.numero}>
                  Ação {c.numero}: {c.descricao}
                </li>
              ))}
            </ul>
            <p className="mt-1 text-textMuted">Refaça a operação para elas, se ainda valer.</p>
          </div>
        ) : null}
        {r.avisos.map((aviso) => (
          <p className="mt-3 text-sm text-textMuted" key={aviso}>
            {aviso}
          </p>
        ))}
        <p className="mt-4 text-sm">
          <Link className="text-accent hover:underline" href={`/projetos/${r.projetoId}`}>
            Voltar ao projeto
          </Link>
          {' · '}
          <Link className="text-accent hover:underline" href={`/projetos/${r.projetoId}/lote`}>
            Nova operação em lote
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="mt-6">
      <form action={pedirPrevia} aria-busy={gerando} ref={formulario}>
        <input name="id" type="hidden" value={projetoId} />

        <fieldset>
          <legend className="font-display text-base font-bold">1. Marque as ações</legend>
          <p className="mt-1 text-sm text-textMuted">
            Até {LIMITE_LOTE} por operação.{' '}
            <button className="text-accent hover:underline" onClick={() => marcarTodas(true)} type="button">
              Marcar todas
            </button>
            {' · '}
            <button className="text-accent hover:underline" onClick={() => marcarTodas(false)} type="button">
              Desmarcar
            </button>
          </p>
          <div className="mt-3 max-h-96 overflow-auto border border-border">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-tableHeadBg text-left text-xs uppercase tracking-wide text-textMuted">
                <tr>
                  <th className="w-10 px-3 py-2" scope="col"><span className="sr-only">Marcar</span></th>
                  <th className="px-3 py-2 font-semibold" scope="col">Ação</th>
                  <th className="px-3 py-2 font-semibold" scope="col">Responsável</th>
                  <th className="px-3 py-2 font-semibold" scope="col">Previsto</th>
                  <th className="px-3 py-2 font-semibold" scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {acoes.map((a) => (
                  <tr className="border-b border-borderSoft bg-surface" key={a.id}>
                    <td className="px-3 py-2">
                      <input
                        aria-label={`Marcar a ação ${a.numero}`}
                        name="ids"
                        type="checkbox"
                        value={a.id}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <span className="tabular-nums text-textFaint">{a.numero}.</span> {a.descricao}
                    </td>
                    <td className="px-3 py-2 text-textMuted">{a.responsavel ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums text-textMuted">{a.previsto}</td>
                    <td className="px-3 py-2 text-textMuted">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="font-display text-base font-bold">2. O que fazer com elas</legend>
          <div className="mt-3 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-textMuted">Remarcar o previsto</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
                <select aria-label="Sentido" className={campo} defaultValue="adiar" name="sentido">
                  <option value="adiar">Adiar</option>
                  <option value="adiantar">Adiantar</option>
                </select>
                <input
                  aria-label="Dias úteis"
                  className={`${campo} w-24`}
                  inputMode="numeric"
                  max={MAX_DIAS_UTEIS}
                  min={0}
                  name="quantidade"
                  placeholder="0"
                  type="number"
                />
                <span className="text-textMuted">dias úteis</span>
              </div>
              <p className="mt-1 text-xs text-textFaint">
                Início e término previstos andam juntos, sem cair em fim de semana ou feriado
                nacional. Ação concluída ou sem data prevista não é remarcada. Deixe vazio para
                não remarcar.
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-textMuted" htmlFor="lote-responsavel">
                Responsável
              </label>
              <select className={`${campo} block w-full`} defaultValue="" id="lote-responsavel" name="responsavelId">
                <option value="">Não mexer</option>
                <option value={SEM_RESPONSAVEL}>Remover o responsável</option>
                {responsaveis.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.nome}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-textFaint">
                Quem passa a responder recebe um e-mail só, com a lista das ações.
              </p>
            </div>
          </div>
        </fieldset>

        {previa.erro ? (
          <p className="mt-4 text-sm text-warn" role="alert">
            {previa.erro}
          </p>
        ) : null}
        <button
          className="mt-4 inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-60"
          disabled={gerando}
          type="submit"
        >
          {gerando ? <Spinner /> : null}
          {gerando ? 'Montando a prévia…' : 'Ver prévia'}
        </button>
      </form>

      {previa.previa ? (
        <section aria-labelledby="titulo-previa" className="mt-10 border-t border-border pt-6">
          <h2 className="font-display text-base font-bold" id="titulo-previa">
            3. Confira antes de gravar
          </h2>
          <p className="mt-1 text-sm">
            {previa.previa.resumo}: <strong>{previa.previa.quantasMudam}</strong> de{' '}
            {previa.previa.linhas.length} ações mudam.
          </p>
          <ul className="mt-3 space-y-2">
            {previa.previa.linhas.map((l) => (
              <li
                className={`border-l-2 bg-surface px-4 py-2 text-sm ${l.mudancas.length > 0 ? 'border-accent' : 'border-borderSoft text-textMuted'}`}
                key={l.acaoId}
              >
                <p>
                  <span className="tabular-nums text-textFaint">{l.numero}.</span> {l.descricao}
                </p>
                {l.mudancas.map((m) => (
                  <p className="text-textMuted" key={m.campo}>
                    {ROTULO_CAMPO_LOTE[m.campo]}: {formatarValorHistorico(m.campo, m.de)}
                    <span aria-hidden="true"> → </span>
                    <span className="sr-only"> para </span>
                    <span className="text-text">{formatarValorHistorico(m.campo, m.para)}</span>
                  </p>
                ))}
                {l.observacao ? <p className="text-xs text-textFaint">{l.observacao}</p> : null}
              </li>
            ))}
          </ul>

          {/* O que é gravado é exatamente o que foi mostrado: os campos voltam como
              ocultos, e mexer no formulário acima não altera esta confirmação. */}
          <form action={aplicar} aria-busy={gravando} className="mt-4">
            <input name="id" type="hidden" value={previa.previa.projetoId} />
            {previa.previa.campos.ids.map((id) => (
              <input key={id} name="ids" type="hidden" value={id} />
            ))}
            <input name="quantidade" type="hidden" value={previa.previa.campos.quantidade} />
            <input name="sentido" type="hidden" value={previa.previa.campos.sentido} />
            <input name="responsavelId" type="hidden" value={previa.previa.campos.responsavelId} />
            {previa.previa.linhas.map((l) => (
              <input key={l.acaoId} name="versao" type="hidden" value={`${l.acaoId}|${l.versao}`} />
            ))}
            {previa.previa.precisaMotivo ? (
              <div className="mb-4 border-l-2 border-warn bg-surface py-3 pl-4" role="group" aria-labelledby="titulo-motivo-lote">
                <p className="text-sm font-medium" id="titulo-motivo-lote">
                  Por que as datas previstas mudam? Vale para todas as ações acima.
                </p>
                <div className="mt-2 grid max-w-2xl gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-textMuted" htmlFor="lote-motivo">
                      Motivo *
                    </label>
                    <select
                      className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      id="lote-motivo"
                      name="motivoReplanejamento"
                      onChange={(e) => setMotivo(e.target.value)}
                      value={motivo}
                    >
                      <option value="">Escolha…</option>
                      {MOTIVOS_REPLANEJAMENTO.map((m) => (
                        <option key={m} value={m}>
                          {ROTULO_MOTIVO_REPLANEJAMENTO[m]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-textMuted" htmlFor="lote-motivo-detalhe">
                      Detalhe {motivo === 'OUTRO' ? '*' : '(opcional)'}
                    </label>
                    <input
                      className="mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm"
                      id="lote-motivo-detalhe"
                      maxLength={500}
                      name="motivoDetalhe"
                      onChange={(e) => setDetalhe(e.target.value)}
                      value={detalhe}
                    />
                  </div>
                </div>
              </div>
            ) : null}
            {aplicacao.erro ? (
              <p className="mb-3 text-sm text-warn" role="alert">
                {aplicacao.erro}
              </p>
            ) : null}
            <button
              className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-60"
              disabled={gravando}
              type="submit"
            >
              {gravando ? <Spinner /> : null}
              {gravando ? 'Gravando…' : `Confirmar e gravar ${previa.previa.quantasMudam} ação(ões)`}
            </button>
          </form>
        </section>
      ) : null}
    </div>
  )
}
