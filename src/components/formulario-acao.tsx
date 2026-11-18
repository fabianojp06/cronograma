'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import {
  atualizarAcao,
  criarAcao,
  type EstadoFormularioAcao,
} from '@/app/projetos/acoes-acao'
import { JanelaSucessoAcao } from '@/components/janela-sucesso-acao'
import {
  ROTULOS_STATUS,
  STATUS_ACAO,
  type CampoData,
  type ErrosAcao,
  type StatusAcao,
} from '@/lib/acao-validacao'
import { Processando } from '@/components/indicador-envio'

const ESTADO_INICIAL: EstadoFormularioAcao = {}

const classeRotulo = 'block text-sm font-medium text-textMuted'
const classeCampo =
  'mt-1 w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text ' +
  'outline-none placeholder:text-textFaint focus:border-accent focus:ring-1 focus:ring-accent'

function Erro({ mensagem }: { mensagem?: string }) {
  if (!mensagem) return null
  return <p className="mt-1 text-sm text-warn">{mensagem}</p>
}

function CampoData({
  nome,
  rotulo,
  erros,
  valor,
}: {
  nome: CampoData
  rotulo: string
  erros?: ErrosAcao
  /** `aaaa-mm-dd`, ou ausente para começar vazio. */
  valor?: string | null
}) {
  return (
    <div>
      <label className={classeRotulo} htmlFor={nome}>
        {rotulo}
      </label>
      <input
        className={classeCampo}
        id={nome}
        name={nome}
        type="date"
        defaultValue={valor ?? ''}
      />
      <Erro mensagem={erros?.[nome]} />
    </div>
  )
}

/** Colaborador que pode ser escolhido como responsável. */
export type OpcaoResponsavel = { id: string; nome: string; temEmail: boolean }

/** Valores atuais de uma ação, para abrir o formulário em modo de edição. */
export type ValoresAcao = {
  id: string
  descricao: string
  status: StatusAcao
  responsavelId: string | null
  /** `updatedAt` ao abrir a edição — a gravação confere que ainda é essa. */
  versao: string
} & { [C in CampoData]: string | null }

/**
 * Formulário de Ação (artboard `F-FormularioAcao`), para criar ou editar.
 *
 * Sem `acao`, cria: o `numero` não aparece, porque é sequencial e atribuído
 * pela Server Action dentro do projeto, e o sucesso abre a janela de
 * confirmação. Com `acao`, edita: os campos vêm preenchidos e a gravação passa
 * por `atualizarAcao`, que registra o histórico.
 *
 * O modo é fixo por montagem — cada página usa um só — e por isso a escolha da
 * Server Action pode ficar no `useActionState`.
 */
export function FormularioAcao({
  projetoId,
  responsaveis,
  acao: valores,
}: {
  projetoId: string
  /**
   * Quem pode ser escolhido: os colaboradores ativos, em ordem de nome. Na
   * edição, inclui também o responsável atual mesmo que desativado — sem
   * ele na lista, o `select` cairia em "Sem responsável" e salvar outra coisa
   * apagaria o responsável em silêncio.
   */
  responsaveis: readonly OpcaoResponsavel[]
  acao?: ValoresAcao
}) {
  const editando = valores !== undefined
  const [estado, enviar, enviando] = useActionState(
    editando ? atualizarAcao : criarAcao,
    ESTADO_INICIAL,
  )
  const erros = estado.erros

  return (
    <>
      {editando ? null : <JanelaSucessoAcao
          criada={estado.criada}
          projetoId={projetoId}
          aviso={estado.aviso}
        />}
      <form action={enviar} className="mt-8 space-y-6" key={estado.criada?.id}>
        <Processando ativo={enviando} texto="Salvando ação…" />
        <input type="hidden" name="id" value={valores?.id ?? projetoId} />
        {/* Depois de salvar, a versão passa a ser a que a gravação devolveu —
            senão a pessoa conflitaria com o próprio save. */}
        {valores ? (
          <input type="hidden" name="versao" value={estado.salva?.versao ?? valores.versao} />
        ) : null}

        {estado.salva ? (
          <p
            className="border-l-2 border-realizado bg-surface py-2 pl-3 text-sm text-text"
            role="status"
          >
            Alterações salvas.{estado.aviso ? ` ${estado.aviso}` : null}
          </p>
        ) : null}

        {estado.erroGeral ? (
          <p className="border-l-2 border-warn bg-surface py-2 pl-3 text-sm text-warn">
            {estado.erroGeral}
            {estado.conflito && valores ? (
              <>
                {' '}
                <button
                  className="font-medium underline"
                  type="button"
                  onClick={() => window.location.reload()}
                >
                  Recarregar a ação
                </button>
              </>
            ) : null}
          </p>
        ) : null}

        <section className="border-l-2 border-accent pl-4">
          <h2 className="font-display text-base font-bold">Ação</h2>
          <div className="mt-4 space-y-4">
            <div>
              <label className={classeRotulo} htmlFor="descricao">
                Descrição *
              </label>
              <textarea
                className={`${classeCampo} min-h-20`}
                id="descricao"
                name="descricao"
                maxLength={500}
                required
                placeholder="Ex.: Levantar inventário dos switches"
                defaultValue={valores?.descricao ?? ''}
              />
              <Erro mensagem={erros?.descricao} />
            </div>
            <div className="sm:max-w-xs">
              <label className={classeRotulo} htmlFor="status">
                Status
              </label>
              <select
                className={classeCampo}
                id="status"
                name="status"
                defaultValue={valores?.status ?? 'NAO_INICIADO'}
              >
                {STATUS_ACAO.map((status) => (
                  <option key={status} value={status}>
                    {ROTULOS_STATUS[status]}
                  </option>
                ))}
              </select>
              <Erro mensagem={erros?.status} />
            </div>
            <div className="sm:max-w-md">
              <label className={classeRotulo} htmlFor="responsavelId">
                Responsável
              </label>
              <select
                className={classeCampo}
                id="responsavelId"
                name="responsavelId"
                defaultValue={valores?.responsavelId ?? ''}
              >
                <option value="">Sem responsável</option>
                {responsaveis.map((colaborador) => (
                  <option key={colaborador.id} value={colaborador.id}>
                    {colaborador.temEmail ? colaborador.nome : `${colaborador.nome} (sem e-mail)`}
                  </option>
                ))}
              </select>
              {/* O aviso fica junto do campo porque é ele que decide se a pessoa
                  vai ser avisada — "sem e-mail" na opção não diz o que fazer. */}
              <p className="mt-1 text-sm text-textMuted">
                Quem está marcado como sem e-mail não recebe o aviso. O e-mail é
                cadastrado em Colaboradores.
              </p>
              <Erro mensagem={erros?.responsavelId} />
            </div>
          </div>
        </section>

        <section className="border-l-2 border-previsto pl-4">
          <h2 className="font-display text-base font-bold">Previsto</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CampoData
              nome="previstoInicio"
              rotulo="Início previsto"
              erros={erros}
              valor={valores?.previstoInicio}
            />
            <CampoData
              nome="previstoTermino"
              rotulo="Término previsto"
              erros={erros}
              valor={valores?.previstoTermino}
            />
          </div>
        </section>

        <section className="border-l-2 border-realizado pl-4">
          <h2 className="font-display text-base font-bold">Realizado</h2>
          {editando ? null : (
            <p className="mt-1 text-sm text-textMuted">
              Opcional na criação — normalmente preenchido conforme a ação avança.
            </p>
          )}
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <CampoData
              nome="realizadoInicio"
              rotulo="Início realizado"
              erros={erros}
              valor={valores?.realizadoInicio}
            />
            <CampoData
              nome="realizadoTermino"
              rotulo="Término realizado"
              erros={erros}
              valor={valores?.realizadoTermino}
            />
          </div>
        </section>

        <div className="flex items-center gap-3">
          <button
            aria-busy={enviando}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent disabled:opacity-60"
            disabled={enviando}
            type="submit"
          >
            {enviando ? (
              <span
                aria-hidden="true"
                className="size-4 animate-spin rounded-full border-2 border-onAccent/40 border-t-onAccent"
              />
            ) : null}
            {enviando ? 'Salvando…' : editando ? 'Salvar alterações' : 'Salvar ação'}
          </button>
          <Link
            className="text-sm text-textMuted hover:text-text"
            href={editando ? `/projetos/${projetoId}` : '/projetos'}
          >
            {editando ? 'Voltar ao projeto' : 'Cancelar'}
          </Link>
        </div>
      </form>
    </>
  )
}
