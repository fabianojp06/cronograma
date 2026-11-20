import Link from 'next/link'

import { removerDependencia } from '@/app/projetos/acoes-dependencia'
import {
  AdicionarDependencia,
  DecidirLiberacao,
  PedirLiberacao,
} from '@/components/dependencias-acao'
import { ROTULOS_STATUS, type StatusAcao } from '@/lib/acao-validacao'
import {
  acaoIniciada,
  MENSAGEM_RISCO,
  predecessorasPendentes,
  riscoDaPredecessora,
  ROTULO_LIBERACAO,
  type StatusLiberacao,
} from '@/lib/dependencia-acao'

export type VinculoDependencia = {
  id: string
  predecessora: {
    id: string
    numero: number
    descricao: string
    status: string
    previstoTermino: Date | null
    realizadoTermino: Date | null
  }
}

export type PedidoLiberacao = {
  id: string
  motivo: string
  status: string
  justificativa: string | null
  solicitante: string
  criadoEm: Date
}

const momento = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

/**
 * Dependências da ação e liberação de início, na tela de edição. Quem só lê vê
 * o estado; quem edita adiciona/remove vínculos e pede liberação; o líder decide.
 */
export function SecaoDependencias({
  projetoId,
  acao,
  vinculos,
  opcoes,
  pedidos,
  nomePorConta,
  podeEditar,
  ehLider,
  hoje,
}: {
  projetoId: string
  acao: {
    id: string
    status: string
    previstoInicio: Date | null
    realizadoInicio: Date | null
    realizadoTermino: Date | null
  }
  vinculos: VinculoDependencia[]
  opcoes: { id: string; rotulo: string }[]
  pedidos: PedidoLiberacao[]
  nomePorConta: ReadonlyMap<string, string>
  podeEditar: boolean
  ehLider: boolean
  hoje: Date
}) {
  const pendentes = predecessorasPendentes(vinculos.map((v) => v.predecessora))
  const iniciada = acaoIniciada(acao)
  const liberada = pedidos.some((p) => p.status === 'APROVADA')
  const pedidoPendente = pedidos.find((p) => p.status === 'PENDENTE')
  const bloqueada = !iniciada && !liberada && pendentes.length > 0

  if (vinculos.length === 0 && !podeEditar) return null

  return (
    <section aria-labelledby="titulo-dependencias" className="mt-8">
      <h2 className="font-display text-base font-bold" id="titulo-dependencias">
        Dependências{' '}
        <span className="text-sm font-normal text-textFaint">({vinculos.length})</span>
      </h2>

      {vinculos.length === 0 ? (
        <p className="mt-3 text-sm text-textMuted">Esta ação não depende de nenhuma outra.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {vinculos.map((v) => {
            const p = v.predecessora
            const risco = riscoDaPredecessora(p, acao.previstoInicio, hoje)
            return (
              <li className="border-l-2 border-borderSoft bg-surface py-2 pl-3 pr-2 text-sm" key={v.id}>
                <p>
                  Depende da{' '}
                  <Link
                    className="font-medium text-text underline hover:text-accent"
                    href={`/projetos/${projetoId}/acoes/${p.id}/editar`}
                  >
                    ação {p.numero}
                  </Link>
                  : <span className="text-textMuted">{p.descricao}</span>
                </p>
                <p className="mt-0.5 text-xs text-textFaint">
                  {ROTULOS_STATUS[p.status as StatusAcao] ?? p.status}
                  {risco ? <span className="text-warn"> · {MENSAGEM_RISCO[risco]}</span> : null}
                </p>
                {podeEditar ? (
                  <form action={removerDependencia} className="mt-1">
                    <input name="dependenciaId" type="hidden" value={v.id} />
                    <button className="text-xs text-textMuted hover:text-warn" type="submit">
                      Remover dependência
                    </button>
                  </form>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      {bloqueada ? (
        <p
          className="mt-3 border-l-2 border-warn bg-surface py-2 pl-3 text-sm"
          role="status"
        >
          <strong>Bloqueada.</strong> Só pode ser iniciada quando{' '}
          {pendentes.map((p) => `a ação ${p.numero}`).join(' e ')} terminar
          {pendentes.length === 1 ? '' : 'em'} — ou com a liberação do líder do projeto.
        </p>
      ) : null}
      {liberada && !iniciada ? (
        <p className="mt-3 border-l-2 border-accent bg-surface py-2 pl-3 text-sm" role="status">
          <strong>Liberada pelo líder.</strong> Pode ser iniciada antes das predecessoras terminarem.
        </p>
      ) : null}

      {podeEditar ? <AdicionarDependencia acaoId={acao.id} opcoes={opcoes} /> : null}

      {podeEditar && bloqueada && !pedidoPendente ? (
        <PedirLiberacao acaoId={acao.id} ehLider={ehLider} />
      ) : null}

      {pedidoPendente ? (
        <div className="mt-3 border-l-2 border-accent bg-surface py-2 pl-3 pr-2 text-sm">
          <p>
            <strong>Pedido de liberação aguardando o líder.</strong>
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-textMuted">
            “{pedidoPendente.motivo}”
          </p>
          <p className="mt-0.5 text-xs text-textFaint">
            {momento.format(pedidoPendente.criadoEm)} ·{' '}
            {nomePorConta.get(pedidoPendente.solicitante) ?? 'Conta sem colaborador vinculado'}
          </p>
          {podeEditar && ehLider ? <DecidirLiberacao liberacaoId={pedidoPendente.id} /> : null}
        </div>
      ) : null}

      {pedidos.filter((p) => p.status !== 'PENDENTE').length > 0 ? (
        <ul className="mt-3 space-y-1 text-xs text-textFaint">
          {pedidos
            .filter((p) => p.status !== 'PENDENTE')
            .map((p) => (
              <li key={p.id}>
                {ROTULO_LIBERACAO[p.status as StatusLiberacao] ?? p.status} ·{' '}
                {momento.format(p.criadoEm)} · “{p.motivo}”
                {p.justificativa ? ` — ${p.justificativa}` : ''}
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  )
}
