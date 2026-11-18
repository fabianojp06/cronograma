'use client'

import { useActionState, useState } from 'react'

import {
  alternarAdministrador,
  alternarAtivo,
  salvarColaborador,
  type EstadoAdmin,
} from '@/app/colaboradores/acoes-colaborador'
import { Processando, Spinner } from '@/components/indicador-envio'

export type ColaboradorAdmin = {
  id: string
  nome: string
  area: string | null
  email: string | null
  ativo: boolean
  administrador: boolean
  vinculado: boolean
  cards: number
  wins: number
  /** Projetos que respondem por esta pessoa, por chave de nome. */
  projetos: number
  /** Desses, quantos estão com grafia diferente da do cadastro. */
  divergentes: number
}

const classeCampo =
  'w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm text-text ' +
  'outline-none focus:border-accent focus:ring-1 focus:ring-accent'

export function LinhaColaborador({
  colaborador,
  areasEmUso,
  podeEditar,
}: {
  colaborador: ColaboradorAdmin
  /** Grafias de área já usadas — sugestão, não lista fechada. */
  areasEmUso: readonly string[]
  /** Só administrador edita; os demais veem a lista sem os controles. */
  podeEditar: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [estadoNome, acaoNome, salvando] = useActionState<EstadoAdmin, FormData>(
    salvarColaborador,
    {},
  )
  const [estadoAtivo, acaoAtivo, alternando] = useActionState<EstadoAdmin, FormData>(
    alternarAtivo,
    {},
  )
  const [estadoPapel, acaoPapel, alternandoPapel] = useActionState<EstadoAdmin, FormData>(
    alternarAdministrador,
    {},
  )

  return (
    <li
      className={`border-l-2 bg-surface px-4 py-3 ${colaborador.ativo ? 'border-borderSoft' : 'border-textFaint'}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-64 flex-1">
          {editando ? (
            <form action={acaoNome} className="space-y-2">
              <Processando ativo={salvando} texto="Salvando colaborador…" />
              <input type="hidden" name="colaboradorId" value={colaborador.id} />
              <label className="text-xs text-textMuted" htmlFor={`nome-${colaborador.id}`}>
                Nome
              </label>
              <input
                className={`${classeCampo} mt-1`}
                id={`nome-${colaborador.id}`}
                name="nome"
                defaultValue={colaborador.nome}
                maxLength={120}
                autoFocus
              />
              <div>
                <label
                  className="text-xs text-textMuted"
                  htmlFor={`area-${colaborador.id}`}
                >
                  Área
                </label>
                <input
                  className={`${classeCampo} mt-1`}
                  id={`area-${colaborador.id}`}
                  name="area"
                  defaultValue={colaborador.area ?? ''}
                  list={`areas-${colaborador.id}`}
                  maxLength={120}
                  placeholder="ex.: AGP - Gerenciamento de Programa & Projetos"
                />
                <datalist id={`areas-${colaborador.id}`}>
                  {areasEmUso.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
                {/* Mesmo tom da explicação da caixa abaixo: as duas são texto
                    que precisa ser lido, não legenda de apoio. */}
                <p className="mt-1 text-xs text-textMuted">
                  Padrão ao abrir o card de uma semana nova. Os cards já salvos não
                  mudam. Vazio remove.
                </p>
              </div>

              <div>
                <label
                  className="text-xs text-textMuted"
                  htmlFor={`email-${colaborador.id}`}
                >
                  E-mail
                </label>
                <input
                  className={`${classeCampo} mt-1`}
                  id={`email-${colaborador.id}`}
                  name="email"
                  type="email"
                  defaultValue={colaborador.email ?? ''}
                  maxLength={254}
                  placeholder="nome@ctcea.org.br"
                />
                <p className="mt-1 text-xs text-textMuted">
                  Recebe os avisos de ação sob sua responsabilidade. Vazio remove.
                </p>
              </div>

              {colaborador.projetos > 0 ? (
                <label className="flex items-start gap-2 text-xs text-textMuted">
                  <input
                    type="checkbox"
                    name="propagar"
                    value="sim"
                    defaultChecked
                    className="mt-0.5"
                  />
                  <span>
                    Alinhar também os{' '}
                    <strong className="font-medium text-text">
                      {colaborador.projetos} projeto(s)
                    </strong>{' '}
                    em que esta pessoa é a responsável. Sem isso, o relatório por
                    responsável passa a contar duas pessoas.
                    {colaborador.divergentes > 0 ? (
                      <>
                        {' '}
                        <strong className="font-medium text-warn">
                          {colaborador.divergentes === 1
                            ? '1 já está com grafia diferente'
                            : `${colaborador.divergentes} já estão com grafia diferente`}
                        </strong>{' '}
                        do cadastro — salvar sem mudar o nome já alinha.
                      </>
                    ) : null}
                  </span>
                </label>
              ) : null}
              <div className="flex gap-2">
                <button
                  className="inline-flex items-center gap-2 rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-onAccent disabled:opacity-60"
                  type="submit"
                  disabled={salvando}
                >
                  {salvando ? <Spinner className="size-3" /> : null}
                  {salvando ? 'Salvando…' : 'Salvar'}
                </button>
                <button
                  className="text-xs text-textMuted hover:text-text"
                  type="button"
                  onClick={() => setEditando(false)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          ) : (
            <>
              <p className="font-medium text-text">
                {colaborador.nome}
                {colaborador.ativo ? null : (
                  <span className="ml-2 text-xs font-normal text-textFaint">inativo</span>
                )}
                {colaborador.administrador ? (
                  <span className="ml-2 text-xs font-normal text-accent">administrador</span>
                ) : null}
              </p>
              <p className="mt-0.5 text-xs text-textFaint">
                {colaborador.area ?? 'sem área'} ·{' '}
                {colaborador.email ?? 'sem e-mail'} ·{' '}
                {colaborador.vinculado ? 'conta vinculada' : 'sem conta'} ·{' '}
                {colaborador.cards} card(s), {colaborador.wins} WIN(s)
                {colaborador.projetos > 0
                  ? `, responsável por ${colaborador.projetos} projeto(s)`
                  : ''}
              </p>
            </>
          )}
        </div>

        {podeEditar ? (
        <div className="flex items-center gap-3">
          {editando ? null : (
            <button
              className="text-xs text-textMuted hover:text-accent"
              type="button"
              onClick={() => setEditando(true)}
            >
              Editar
            </button>
          )}
          <form action={acaoAtivo}>
            <Processando ativo={alternando} texto="Atualizando colaborador…" />
            <input type="hidden" name="colaboradorId" value={colaborador.id} />
            {/* A intenção vai no valor do botão: a ação não deduz o que fazer
                negando o estado que lê, senão um clique em "Desativar" pode
                reativar alguém que outra pessoa já desativou. */}
            <button
              className={`inline-flex items-center gap-2 text-xs disabled:opacity-60 ${colaborador.ativo ? 'text-textMuted hover:text-warn' : 'text-accent hover:underline'}`}
              type="submit"
              name="acao"
              value={colaborador.ativo ? 'desativar' : 'reativar'}
              disabled={alternando}
            >
              {alternando ? <Spinner className="size-3" /> : null}
              {colaborador.ativo ? 'Desativar' : 'Reativar'}
            </button>
          </form>
          {colaborador.ativo || colaborador.administrador ? (
            <form action={acaoPapel}>
              <Processando ativo={alternandoPapel} texto="Atualizando administrador…" />
              <input type="hidden" name="colaboradorId" value={colaborador.id} />
              <button
                className="inline-flex items-center gap-2 text-xs text-textMuted hover:text-accent disabled:opacity-60"
                type="submit"
                name="acao"
                value={colaborador.administrador ? 'remover' : 'promover'}
                disabled={alternandoPapel}
              >
                {alternandoPapel ? <Spinner className="size-3" /> : null}
                {colaborador.administrador ? 'Remover administrador' : 'Tornar administrador'}
              </button>
            </form>
          ) : null}
        </div>
        ) : null}
      </div>

      {[estadoNome, estadoAtivo, estadoPapel].map((estado, i) =>
        estado.erroGeral ? (
          <p key={i} className="mt-2 text-xs text-warn">
            {estado.erroGeral}
          </p>
        ) : estado.aviso ? (
          <p key={i} className="mt-2 text-xs text-textMuted">
            {estado.aviso}
          </p>
        ) : null,
      )}
    </li>
  )
}
