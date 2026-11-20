import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { marcarLida, marcarTodasLidas } from '@/app/notificacoes/acoes-notificacao'
import { rotularAutor } from '@/lib/historico-exibicao'
import {
  ehMotivoLiberacao,
  ROTULO_LIBERACAO_AVISO,
  ROTULO_MOTIVO,
  trechoDoComentario,
  type MotivoNotificacao,
} from '@/lib/notificacao'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Notificações — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

const LIMITE = 50

const momento = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

export default async function NotificacoesPage() {
  const { userId } = await auth()
  const colaborador = userId
    ? await prisma.colaborador.findUnique({
        where: { clerkUserId: userId },
        select: { id: true },
      })
    : null

  if (!colaborador) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="font-display text-2xl font-extrabold">Notificações</h1>
        <p className="mt-4 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
          Sua conta ainda não está ligada a um colaborador, e é por ele que os avisos chegam.{' '}
          <Link className="text-accent hover:underline" href="/minhas-acoes">
            Ligue sua conta em &quot;Minhas ações&quot;
          </Link>
          .
        </p>
      </main>
    )
  }

  const [itens, naoLidas] = await Promise.all([
    prisma.notificacao.findMany({
      where: { destinatarioId: colaborador.id },
      orderBy: { criadoEm: 'desc' },
      take: LIMITE,
      select: {
        id: true,
        motivo: true,
        lida: true,
        criadoEm: true,
        comentario: {
          select: {
            texto: true,
            autor: true,
            acao: {
              select: {
                id: true,
                numero: true,
                descricao: true,
                projeto: { select: { id: true, nome: true, ativo: true } },
              },
            },
          },
        },
        liberacao: {
          select: {
            motivo: true,
            justificativa: true,
            solicitante: true,
            decididoPor: true,
            acao: {
              select: {
                id: true,
                numero: true,
                descricao: true,
                projeto: { select: { id: true, nome: true, ativo: true } },
              },
            },
          },
        },
      },
    }),
    prisma.notificacao.count({ where: { destinatarioId: colaborador.id, lida: false } }),
  ])

  // Quem fez: o autor do comentário, ou — na liberação — quem pediu (pedido)
  // ou quem decidiu (aprovação e recusa).
  const autorDe = (n: (typeof itens)[number]): string | null =>
    n.comentario?.autor ??
    (n.motivo === 'LIBERACAO_PEDIDA' ? n.liberacao?.solicitante : n.liberacao?.decididoPor) ??
    null
  const contas = [...new Set(itens.map(autorDe).filter((c): c is string => c !== null))]
  const autores = await prisma.colaborador.findMany({
    where: { clerkUserId: { in: contas } },
    select: { clerkUserId: true, nome: true },
  })
  const nomePorConta = new Map(autores.map((a) => [a.clerkUserId!, a.nome]))

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">Cronograma CTCEA</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Notificações</h1>
      <p className="mt-2 text-sm text-textMuted">
        Comentários em que você foi marcado ou em ações pelas quais você responde, e pedidos e decisões de liberação de início de ações com dependência.
        Os avisos ficam só aqui, no sistema.
      </p>

      <div className="mt-4 flex items-center gap-4 text-sm">
        <span role="status">
          {naoLidas === 0
            ? 'Tudo lido.'
            : `${naoLidas} ${naoLidas === 1 ? 'não lida' : 'não lidas'}.`}
        </span>
        {naoLidas > 0 ? (
          <form action={marcarTodasLidas}>
            <button className="text-accent hover:underline" type="submit">
              Marcar todas como lidas
            </button>
          </form>
        ) : null}
      </div>

      {itens.length === 0 ? (
        <p className="mt-8 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
          Nenhuma notificação ainda.
        </p>
      ) : (
        <ul className="mt-6 space-y-2">
          {itens.map((n) => {
            const acao = (n.comentario ?? n.liberacao)?.acao
            if (!acao) return null
            const conta = autorDe(n)
            const autor = rotularAutor(conta, nomePorConta)
            const daLiberacao = ehMotivoLiberacao(n.motivo)
            const textoDoAviso = n.comentario
              ? trechoDoComentario(n.comentario.texto)
              : n.liberacao
                ? trechoDoComentario(
                    n.motivo === 'LIBERACAO_PEDIDA'
                      ? n.liberacao.motivo
                      : (n.liberacao.justificativa ?? 'Sem justificativa.'),
                  )
                : ''
            return (
              <li
                className={`border-l-2 bg-surface px-4 py-3 ${n.lida ? 'border-borderSoft' : 'border-accent'}`}
                key={n.id}
              >
                <p className="text-sm">
                  <strong className={n.lida ? 'font-medium' : 'font-bold'}>{autor}</strong>{' '}
                  {daLiberacao
                    ? ROTULO_LIBERACAO_AVISO[n.motivo as keyof typeof ROTULO_LIBERACAO_AVISO]
                    : (ROTULO_MOTIVO[n.motivo as MotivoNotificacao] ?? 'comentou')}{' '}
                  {daLiberacao ? 'a' : 'na'}{' '}
                  {acao.projeto.ativo ? (
                    <Link
                      className="text-text underline hover:text-accent"
                      href={`/projetos/${acao.projeto.id}/acoes/${acao.id}/editar`}
                    >
                      ação {acao.numero}
                    </Link>
                  ) : (
                    <span>ação {acao.numero}</span>
                  )}{' '}
                  de <span className="text-textMuted">{acao.projeto.nome}</span>
                  {!n.lida ? <span className="sr-only"> (não lida)</span> : null}
                </p>
                <p className="mt-1 whitespace-pre-wrap break-words text-sm text-textMuted">
                  “{textoDoAviso}”
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs text-textFaint">
                  <span className="tabular-nums">{momento.format(n.criadoEm)}</span>
                  {!n.lida ? (
                    <form action={marcarLida}>
                      <input name="notificacaoId" type="hidden" value={n.id} />
                      <button className="text-textMuted hover:text-accent" type="submit">
                        Marcar como lida
                      </button>
                    </form>
                  ) : null}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </main>
  )
}
