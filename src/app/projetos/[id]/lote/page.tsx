import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AvisoSomenteLeitura } from '@/components/aviso-somente-leitura'
import { FormularioLote } from '@/components/formulario-lote'
import { sessaoPodeEditar } from '@/lib/administracao-servidor'
import { ROTULOS_STATUS, type StatusAcao } from '@/lib/acao-validacao'
import { serializarValor } from '@/lib/acao-historico'
import { formatarValorHistorico } from '@/lib/historico-exibicao'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Editar ações em lote — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

export default async function EdicaoEmLotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const projeto = await prisma.projeto.findFirst({
    where: { id, ativo: true },
    select: {
      id: true,
      nome: true,
      referencia: true,
      acoes: {
        orderBy: { numero: 'asc' },
        select: {
          id: true,
          numero: true,
          descricao: true,
          status: true,
          previstoInicio: true,
          previstoTermino: true,
          responsavel: { select: { nome: true } },
        },
      },
    },
  })
  if (!projeto) notFound()

  const podeEditar = await sessaoPodeEditar()
  const ativos = podeEditar
    ? await prisma.colaborador.findMany({
        where: { ativo: true },
        orderBy: { nome: 'asc' },
        select: { id: true, nome: true },
      })
    : []

  const acoes = projeto.acoes.map((a) => {
    const ini = serializarValor(a.previstoInicio)
    const fim = serializarValor(a.previstoTermino)
    return {
      id: a.id,
      numero: a.numero,
      descricao: a.descricao,
      status: ROTULOS_STATUS[a.status as StatusAcao],
      responsavel: a.responsavel?.nome ?? null,
      previsto:
        ini || fim
          ? `${formatarValorHistorico('previstoInicio', ini)} a ${formatarValorHistorico('previstoTermino', fim)}`
          : 'sem previsto',
    }
  })

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        {projeto.referencia ?? 'Projeto'}
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Editar ações em lote</h1>
      <p className="mt-2 text-sm text-textMuted">
        Projeto{' '}
        <Link className="text-text hover:text-accent" href={`/projetos/${projeto.id}`}>
          <strong>{projeto.nome}</strong>
        </Link>
        . Remarque o previsto ou troque o responsável de várias ações de uma vez. Você vê o
        que muda antes de gravar, e cada ação ganha o seu registro no histórico.
      </p>

      {!podeEditar ? (
        <AvisoSomenteLeitura voltarPara={`/projetos/${projeto.id}`} rotuloVoltar="Voltar para o projeto" />
      ) : acoes.length === 0 ? (
        <p className="mt-8 border-l-2 border-borderSoft pl-4 text-sm text-textMuted">
          Este projeto ainda não tem ações.
        </p>
      ) : (
        <FormularioLote acoes={acoes} projetoId={projeto.id} responsaveis={ativos} />
      )}
    </main>
  )
}
