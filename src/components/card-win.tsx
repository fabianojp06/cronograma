'use client'

import { useActionState } from 'react'

import { salvarCard, salvarWin, type EstadoCard, type EstadoWin } from '@/app/wins/acoes-win'
import { ROTULO_STATUS_WIN, ORDENS_VALIDAS } from '@/lib/win-validacao'
import {
  ROTULO_SITUACAO,
  mensagemDaSituacao,
  situacaoDoWin,
  type SituacaoWin,
} from '@/lib/win-promocao'
import { StatusWin } from '@/generated/prisma/enums'

const classeCampo =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text ' +
  'outline-none placeholder:text-textFaint focus:border-accent focus:ring-1 focus:ring-accent'

const TRACO_SITUACAO: Record<SituacaoWin, string> = {
  NOVO: 'border-borderSoft',
  REPETINDO: 'border-previsto',
  DEVE_PROMOVER: 'border-warn',
  PROMOVIDO: 'border-realizado',
  ENCERRADO: 'border-textFaint',
}

export type LinhaWin = {
  registroId: string | null
  winId: string | null
  ordem: number
  descricao: string
  suporte: string | null
  prazoIso: string | null
  status: StatusWin
  aparicoes: number
  aparicoesAnteriores: number
  registros: number
  promovidoEm: string | null
  encerradoEm: string | null
}

function FormularioWin({
  linha,
  semana,
  minimo,
  maximo,
}: {
  linha: LinhaWin
  semana: { ano: number; semana: number }
  minimo: string
  maximo: string
}) {
  const [estado, acao, enviando] = useActionState<EstadoWin, FormData>(salvarWin, {})

  const contavel = {
    aparicoesAnteriores: linha.aparicoesAnteriores,
    registros: linha.registros,
    promovidoEm: linha.promovidoEm === null ? null : new Date(linha.promovidoEm),
    encerradoEm: linha.encerradoEm === null ? null : new Date(linha.encerradoEm),
  }
  const situacao = linha.winId === null ? null : situacaoDoWin(contavel)

  return (
    <form action={acao} className={`border-l-2 ${situacao ? TRACO_SITUACAO[situacao] : 'border-borderSoft'} bg-surface p-4`}>
      <input type="hidden" name="ano" value={semana.ano} />
      <input type="hidden" name="semana" value={semana.semana} />
      <input type="hidden" name="ordem" value={linha.ordem} />
      {linha.registroId ? (
        <input type="hidden" name="registroId" value={linha.registroId} />
      ) : null}
      {linha.registroId === null && linha.winId ? (
        <input type="hidden" name="winId" value={linha.winId} />
      ) : null}

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-textMuted">
          WIN {String(linha.ordem).padStart(2, '0')}
        </span>
        {situacao ? (
          <span
            className={`text-xs ${situacao === 'DEVE_PROMOVER' ? 'font-medium text-warn' : 'text-textFaint'}`}
          >
            {ROTULO_SITUACAO[situacao]} · {mensagemDaSituacao(contavel)}
          </span>
        ) : null}
      </div>

      <label className="sr-only" htmlFor={`descricao-${linha.ordem}`}>
        Descrição do WIN {linha.ordem}
      </label>
      <textarea
        className={classeCampo}
        id={`descricao-${linha.ordem}`}
        name="descricao"
        rows={2}
        defaultValue={linha.descricao}
        placeholder="O que é importante agora?"
      />
      {estado.erros?.descricao ? (
        <p className="mt-1 text-sm text-warn">{estado.erros.descricao}</p>
      ) : null}

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label className="block text-xs text-textMuted" htmlFor={`suporte-${linha.ordem}`}>
            Suporte
          </label>
          <input
            className={classeCampo}
            id={`suporte-${linha.ordem}`}
            name="suporte"
            defaultValue={linha.suporte ?? ''}
            placeholder="Quem apoia"
          />
          {estado.erros?.suporte ? (
            <p className="mt-1 text-sm text-warn">{estado.erros.suporte}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-xs text-textMuted" htmlFor={`prazo-${linha.ordem}`}>
            Prazo
          </label>
          <input
            className={classeCampo}
            id={`prazo-${linha.ordem}`}
            name="prazo"
            type="date"
            min={minimo}
            max={maximo}
            defaultValue={linha.prazoIso ?? ''}
          />
          {estado.erros?.prazo ? (
            <p className="mt-1 text-sm text-warn">{estado.erros.prazo}</p>
          ) : null}
        </div>
        <div>
          <label className="block text-xs text-textMuted" htmlFor={`status-${linha.ordem}`}>
            Status
          </label>
          <select
            className={classeCampo}
            id={`status-${linha.ordem}`}
            name="status"
            defaultValue={linha.status}
          >
            {Object.values(StatusWin).map((status) => (
              <option key={status} value={status}>
                {ROTULO_STATUS_WIN[status]}
              </option>
            ))}
          </select>
        </div>
      </div>

      {estado.erroGeral ? (
        <p className="mt-3 text-sm text-warn">{estado.erroGeral}</p>
      ) : null}
      {estado.salvo ? <p className="mt-3 text-sm text-realizado">Salvo.</p> : null}

      <button
        className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-onAccent disabled:opacity-60"
        type="submit"
        disabled={enviando}
      >
        {enviando ? 'Salvando…' : linha.registroId ? 'Salvar' : 'Adicionar'}
      </button>
    </form>
  )
}

export function CardWin({
  linhas,
  semana,
  periodo,
  cabecalho,
}: {
  linhas: LinhaWin[]
  semana: { ano: number; semana: number }
  periodo: { inicioIso: string; fimIso: string }
  cabecalho: {
    area: string | null
    atividade: string | null
    alertaRiscos: string | null
    pedidoAjuda: string | null
  }
}) {
  const [estado, acao, enviando] = useActionState<EstadoCard, FormData>(salvarCard, {})

  return (
    <div className="space-y-6">
      <form action={acao} className="border-l-2 border-accent bg-surface p-4">
        <input type="hidden" name="ano" value={semana.ano} />
        <input type="hidden" name="semana" value={semana.semana} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-textMuted" htmlFor="area">
              Área
            </label>
            <input className={classeCampo} id="area" name="area" defaultValue={cabecalho.area ?? ''} />
          </div>
          <div>
            <label className="block text-xs text-textMuted" htmlFor="atividade">
              Atividade
            </label>
            <input
              className={classeCampo}
              id="atividade"
              name="atividade"
              defaultValue={cabecalho.atividade ?? ''}
            />
          </div>
          <div>
            <label className="block text-xs text-textMuted" htmlFor="alertaRiscos">
              Alerta de riscos
            </label>
            <textarea
              className={classeCampo}
              id="alertaRiscos"
              name="alertaRiscos"
              rows={2}
              defaultValue={cabecalho.alertaRiscos ?? ''}
            />
          </div>
          <div>
            <label className="block text-xs text-textMuted" htmlFor="pedidoAjuda">
              Pedido de ajuda
            </label>
            <textarea
              className={classeCampo}
              id="pedidoAjuda"
              name="pedidoAjuda"
              rows={2}
              defaultValue={cabecalho.pedidoAjuda ?? ''}
            />
          </div>
        </div>
        {estado.erroGeral ? <p className="mt-3 text-sm text-warn">{estado.erroGeral}</p> : null}
        {estado.salvo ? <p className="mt-3 text-sm text-realizado">Card salvo.</p> : null}
        <button
          className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-onAccent disabled:opacity-60"
          type="submit"
          disabled={enviando}
        >
          {enviando ? 'Salvando…' : 'Salvar cabeçalho'}
        </button>
      </form>

      <div className="space-y-4">
        {ORDENS_VALIDAS.map((ordem) => {
          const linha =
            linhas.find((l) => l.ordem === ordem) ??
            ({
              registroId: null,
              winId: null,
              ordem,
              descricao: '',
              suporte: null,
              prazoIso: null,
              status: StatusWin.PENDENTE,
              aparicoes: 0,
              aparicoesAnteriores: 0,
              registros: 0,
              promovidoEm: null,
              encerradoEm: null,
            } satisfies LinhaWin)

          return (
            <FormularioWin
              key={ordem}
              linha={linha}
              semana={semana}
              minimo={periodo.inicioIso}
              maximo={periodo.fimIso}
            />
          )
        })}
      </div>
    </div>
  )
}
