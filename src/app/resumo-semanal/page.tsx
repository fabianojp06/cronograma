import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { NavegacaoAdministracao } from '@/components/navegacao-administracao'
import { contaPodeAdministrar } from '@/lib/administracao-servidor'
import { prisma } from '@/lib/prisma'
import {
  frasePrincipal,
  lerConteudo,
  resumoVazio,
  rotuloDaSemana,
  type BlocoResumo,
  type ConteudoResumo,
  type ItemResumo,
} from '@/lib/resumo-semanal'
import { garantirResumoDaSemana, MOTIVO_RESUMO_SEMANAL } from '@/lib/resumo-servidor'

export const metadata = { title: 'Resumo semanal — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

const momento = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})
const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`

function Itens({ bloco, rotuloData }: { bloco: BlocoResumo; rotuloData: string }) {
  if (bloco.total === 0) return <p className="text-sm text-textFaint">Nenhuma.</p>
  return (
    <>
      <ul className="space-y-1 text-sm">
        {bloco.itens.map((i: ItemResumo) => (
          <li key={i.acaoId}>
            <Link
              className="text-text underline hover:text-accent"
              href={`/projetos/${i.projetoId}/acoes/${i.acaoId}/editar`}
            >
              {i.projetoNome} · ação {i.numero}
            </Link>{' '}
            <span className="text-textMuted">{i.descricao}</span>
            <span className="block text-xs text-textFaint">
              {i.responsavel ?? 'Sem responsável'} · {rotuloData} {dm(i.data)}
              {i.diasAtraso !== undefined ? ` · ${i.diasAtraso} ${i.diasAtraso === 1 ? 'dia' : 'dias'} de atraso` : ''}
            </span>
          </li>
        ))}
      </ul>
      {bloco.total > bloco.itens.length ? (
        <p className="mt-1 text-xs text-textFaint">
          Mostrando {bloco.itens.length} de {bloco.total}. O painel de Dashboards tem a lista completa.
        </p>
      ) : null}
    </>
  )
}

export default async function ResumoSemanalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const { userId } = await auth()
  if (!userId || !(await contaPodeAdministrar(userId))) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="font-display text-2xl font-extrabold">Resumo semanal</h1>
        <p className="mt-4 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
          Só administradores acessam o resumo semanal.
        </p>
      </main>
    )
  }

  const pedida = (await searchParams).semana
  const semanaPedida = typeof pedida === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(pedida) ? pedida : null

  // Sem semana na URL (ou semana que não existe), mostra a mais recente — e a
  // gera se ainda não houver nenhuma, como na entrada do administrador.
  let registro = semanaPedida
    ? await prisma.resumoSemanal.findUnique({ where: { semana: semanaPedida } })
    : null
  if (!registro) {
    await garantirResumoDaSemana()
    registro = await prisma.resumoSemanal.findFirst({ orderBy: { semana: 'desc' } })
  }
  const conteudo: ConteudoResumo | null = registro ? lerConteudo(registro.conteudo) : null

  const semanas = await prisma.resumoSemanal.findMany({
    orderBy: { semana: 'desc' },
    take: 12,
    select: { semana: true },
  })

  // Abrir o resumo é vê-lo: o aviso desta semana deixa de estar pendente.
  if (registro) {
    await prisma.notificacao.updateMany({
      where: {
        resumoId: registro.id,
        motivo: MOTIVO_RESUMO_SEMANAL,
        lida: false,
        destinatario: { clerkUserId: userId },
      },
      data: { lida: true },
    })
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <NavegacaoAdministracao atual="/resumo-semanal" />
      <p className="text-sm font-medium text-accent">Administração</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Resumo semanal</h1>

      {!registro || !conteudo ? (
        <p className="mt-4 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
          Ainda não há resumo semanal.
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm text-textMuted">
            {rotuloDaSemana(conteudo.semana)}. Foto tirada em {momento.format(registro.geradoEm)}: o que foi
            concluído de {dm(conteudo.de)} a {dm(conteudo.referencia)}, o que estava atrasado e o que vence até{' '}
            {dm(conteudo.ate)}.
          </p>
          <p className="mt-3 text-sm font-medium" role="status">
            {frasePrincipal(conteudo)}
          </p>

          {semanas.length > 1 ? (
            <nav aria-label="Semanas anteriores" className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm print:hidden">
              <span className="text-textFaint">Outras semanas:</span>
              {semanas.map((s) =>
                s.semana === conteudo.semana ? null : (
                  <Link className="text-accent hover:underline" href={`/resumo-semanal?semana=${s.semana}`} key={s.semana}>
                    {dm(s.semana).slice(0, 5)}
                  </Link>
                ),
              )}
            </nav>
          ) : null}

          {resumoVazio(conteudo) ? null : (
            <div className="mt-8 space-y-10">
              {conteudo.equipes.map((e) => (
                <section aria-labelledby={`eq-${e.equipe}`} key={e.equipe}>
                  <h2 className="font-display text-lg font-bold" id={`eq-${e.equipe}`}>
                    {e.equipe}{' '}
                    <span className="text-sm font-normal text-textFaint">
                      {e.atrasadas.total} {e.atrasadas.total === 1 ? 'atrasada' : 'atrasadas'} · {e.vencendo.total}{' '}
                      {e.vencendo.total === 1 ? 'vence' : 'vencem'} · {e.concluidas.total}{' '}
                      {e.concluidas.total === 1 ? 'concluída' : 'concluídas'}
                    </span>
                  </h2>
                  <div className="mt-3 grid gap-6 md:grid-cols-3">
                    <div className="border-l-2 border-warn pl-3">
                      <h3 className="mb-2 text-sm font-bold">Atrasadas ({e.atrasadas.total})</h3>
                      <Itens bloco={e.atrasadas} rotuloData="previsto para" />
                    </div>
                    <div className="border-l-2 border-previsto pl-3">
                      <h3 className="mb-2 text-sm font-bold">Vencem em 7 dias ({e.vencendo.total})</h3>
                      <Itens bloco={e.vencendo} rotuloData="vence em" />
                    </div>
                    <div className="border-l-2 border-realizado pl-3">
                      <h3 className="mb-2 text-sm font-bold">Concluídas ({e.concluidas.total})</h3>
                      <Itens bloco={e.concluidas} rotuloData="concluída em" />
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </main>
  )
}
