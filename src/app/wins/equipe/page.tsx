import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { inicioDeHojeUTC } from '@/lib/data-hoje'
import { formatarDataBR } from '@/lib/formatacao'
import { prisma } from '@/lib/prisma'
import {
  ehSemanaValida,
  periodoDaSemana,
  rotuloSemana,
  semanaAnterior,
  semanaDe,
  semanaSeguinte,
  type SemanaCtcea,
} from '@/lib/semana-ctcea'
import { montarEquipe, resumoDaEquipe, semWins } from '@/lib/wins-equipe'
import { ROTULO_STATUS_WIN } from '@/lib/win-validacao'
import { ROTULO_SITUACAO } from '@/lib/win-promocao'
import { DesfechoWin } from '@/generated/prisma/enums'

export const metadata = { title: 'Card WIN da equipe — Cronograma CTCEA' }

function semanaDaUrl(
  params: Record<string, string | string[] | undefined>,
  hoje: Date,
): SemanaCtcea {
  const ler = (chave: string) => {
    const bruto = params[chave]
    const valor = Array.isArray(bruto) ? bruto[0] : bruto
    return typeof valor === 'string' ? Number(valor) : Number.NaN
  }
  const candidata = { ano: ler('ano'), semana: ler('semana') }
  return Number.isInteger(candidata.ano) && ehSemanaValida(candidata)
    ? candidata
    : semanaDe(hoje)
}

export default async function EquipePage({ searchParams }: PageProps<'/wins/equipe'>) {
  const { userId } = await auth()
  if (!userId) return null

  const hoje = inicioDeHojeUTC()
  const semana = semanaDaUrl(await searchParams, hoje)
  const periodo = periodoDaSemana(semana)
  const anterior = semanaAnterior(semana)
  const seguinte = semanaSeguinte(semana)

  const [cardsLidos, ativos] = await Promise.all([
    prisma.cardSemanal.findMany({
      // Sem filtro de `ativo` aqui: a tela navega por semanas passadas, e
      // esconder o card de quem saiu reescreveria o que aconteceu então.
      where: { ano: semana.ano, semana: semana.semana },
      orderBy: { colaborador: { nome: 'asc' } },
      select: {
        area: true,
        atividade: true,
        alertaRiscos: true,
        pedidoAjuda: true,
        colaborador: { select: { id: true, nome: true, ativo: true } },
        registros: {
          where: { desfecho: DesfechoWin.NO_CARD },
          orderBy: { ordem: 'asc' },
          select: {
            ordem: true,
            prazo: true,
            status: true,
            win: {
              select: {
                id: true,
                descricao: true,
                suporte: true,
                aparicoesAnteriores: true,
                promovidoEm: true,
                // Sem `encerradoEm`, `situacaoDoWin` trata um WIN já encerrado
                // como ativo e a tela manda promovê-lo.
                encerradoEm: true,
                registros: { select: { card: { select: { ano: true, semana: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.colaborador.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true },
    }),
  ])

  const cards = montarEquipe(cardsLidos, semana)
  const faltando = semWins(ativos, cards)
  const resumo = resumoDaEquipe(cards)
  const link = (alvo: SemanaCtcea) => `/wins/equipe?ano=${alvo.ano}&semana=${alvo.semana}`

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <p className="text-sm font-medium text-accent">Equipe</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">
        Card WIN — {rotuloSemana(semana)}
      </h1>
      <p className="mt-1 text-sm text-textMuted">
        {formatarDataBR(periodo.inicio)} a {formatarDataBR(periodo.fim)} ·
        Compartilhamento dos cards
      </p>

      <nav className="mt-4 flex flex-wrap items-center gap-4 text-sm">
        <Link className="text-textMuted hover:text-accent" href={link(anterior)}>
          ← {rotuloSemana(anterior)}
        </Link>
        <Link className="text-textMuted hover:text-accent" href="/wins/equipe">
          Semana atual
        </Link>
        <Link className="text-textMuted hover:text-accent" href={link(seguinte)}>
          {rotuloSemana(seguinte)} →
        </Link>
        <Link className="text-textMuted hover:text-accent" href="/wins">
          Meu card
        </Link>
      </nav>

      <dl className="mt-8 grid gap-px border-l-2 border-accent bg-border sm:grid-cols-4">
        {[
          { rotulo: 'Pessoas com WIN', valor: resumo.comWins },
          { rotulo: 'WINs na semana', valor: resumo.totalWins },
          { rotulo: 'Concluídos', valor: resumo.concluidos },
          { rotulo: 'A promover', valor: resumo.aPromover, alerta: resumo.aPromover > 0 },
        ].map((ind) => (
          <div key={ind.rotulo} className="bg-surface px-4 py-3">
            <dt className="text-xs text-textMuted">{ind.rotulo}</dt>
            <dd
              className={`font-display text-2xl font-extrabold ${ind.alerta ? 'text-warn' : 'text-text'}`}
            >
              {ind.valor}
            </dd>
          </div>
        ))}
      </dl>

      {faltando.length > 0 ? (
        <section className="mt-8 border-l-2 border-warn bg-surface px-4 py-3">
          <h2 className="text-sm font-semibold text-text">
            Sem WIN nesta semana ({faltando.length})
          </h2>
          <p className="mt-1 text-sm text-textMuted">
            {faltando.map((p) => p.nome).join(', ')}
          </p>
        </section>
      ) : null}

      <section className="mt-8 space-y-4">
        {cards.length === 0 ? (
          <p className="border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
            Nenhum card registrado em {rotuloSemana(semana)}.
          </p>
        ) : (
          cards.map((card) => (
            <article
              key={card.colaborador.id}
              className="border-l-2 border-borderSoft bg-surface p-4"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-display text-base font-extrabold">
                  {card.colaborador.nome}
                  {card.colaborador.ativo ? null : (
                    <span className="ml-2 text-xs font-normal text-textFaint">
                      (não está mais na equipe)
                    </span>
                  )}
                </h2>
                <span className="text-xs text-textFaint">
                  {[card.area, card.atividade].filter(Boolean).join(' · ') || '—'}
                </span>
              </header>

              {card.wins.length === 0 ? (
                <p className="mt-2 text-sm text-textFaint">Sem WIN nesta semana.</p>
              ) : (
                <ul className="mt-3 divide-y divide-borderSoft">
                  {card.wins.map((win) => (
                    <li key={win.winId} className="py-2 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span>
                          <span className="text-textFaint">
                            WIN {String(win.ordem).padStart(2, '0')}
                          </span>{' '}
                          {win.descricao}
                        </span>
                        <span
                          className={`text-xs ${win.deveSerPromovido ? 'font-medium text-warn' : 'text-textFaint'}`}
                        >
                          {ROTULO_SITUACAO[win.situacao]} · {win.aparicoes}ª semana
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-textFaint">
                        {win.suporte ? `Suporte: ${win.suporte} · ` : ''}
                        {win.prazo ? `Prazo: ${formatarDataBR(win.prazo)} · ` : ''}
                        {ROTULO_STATUS_WIN[win.status]}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              {card.alertaRiscos || card.pedidoAjuda ? (
                <dl className="mt-3 space-y-1 border-t border-borderSoft pt-2 text-xs">
                  {card.alertaRiscos ? (
                    <div>
                      <dt className="inline text-textMuted">Alerta de riscos: </dt>
                      <dd className="inline text-text">{card.alertaRiscos}</dd>
                    </div>
                  ) : null}
                  {card.pedidoAjuda ? (
                    <div>
                      <dt className="inline text-textMuted">Pedido de ajuda: </dt>
                      <dd className="inline text-text">{card.pedidoAjuda}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </article>
          ))
        )}
      </section>

      <p className="mt-10 border-t border-border pt-6 text-xs text-textFaint">
        Somente leitura — cada pessoa edita o próprio card em{' '}
        <Link className="underline" href="/wins">
          Meu card
        </Link>
        .
      </p>
    </main>
  )
}
