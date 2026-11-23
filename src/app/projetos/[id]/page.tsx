import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { BuscaAcoes } from '@/components/busca-acoes'
import { Paginacao } from '@/components/paginacao'
import { SeletorFoto } from '@/components/seletor-foto'
import { acaoIniciada, etiquetaDaDependencia } from '@/lib/dependencia-acao'
import { GanttProjeto, type LinhaGantt } from '@/components/gantt-projeto'
import { inicioDeHojeUTC } from '@/lib/data-hoje'
import { corteDaFoto, fotoDoProjeto, lerDataDaFoto } from '@/lib/foto-em-data'
import { formatarDataBR } from '@/lib/formatacao'
import { contaPodeAdministrar, sessaoPodeEditar } from '@/lib/administracao-servidor'
import { AvisoSomenteLeitura } from '@/components/aviso-somente-leitura'
import { SecaoMacroetapas } from '@/components/secao-macroetapas'
import { SecaoRiscos } from '@/components/secao-riscos'
import { riscoAberto } from '@/lib/risco-projeto'
import {
  correspondeABusca,
  lerPagina,
  paginar,
  TAMANHO_PAGINA_ACOES,
} from '@/lib/paginacao'
import { prisma } from '@/lib/prisma'
import {
  ROTULO_STATUS_AGREGADO,
  resumirAcoes,
} from '@/lib/projeto-resumo'
import type { StatusAcao } from '@/lib/acao-validacao'

export const metadata = { title: 'Cronograma do projeto — Cronograma CTCEA' }

export default async function ProjetoPage({
  params,
  searchParams,
}: PageProps<'/projetos/[id]'>) {
  const { id } = await params
  const agora = inicioDeHojeUTC()
  const podeEditar = await sessaoPodeEditar()
  const { userId } = await auth()
  const administrador = userId !== null && (await contaPodeAdministrar(userId))
  const riscosDoProjeto = await prisma.riscoProjeto.findMany({
    where: { projetoId: id },
    select: {
      id: true, acaoId: true, tipo: true, titulo: true, descricao: true, impacto: true, status: true, prazo: true,
      plano: true, pedeAjuda: true, criadoPor: true, criadoEm: true,
      responsavel: { select: { nome: true } },
      acao: { select: { numero: true } },
    },
  })
  const macroetapasBrutas = podeEditar
    ? await prisma.macroetapa.findMany({
        where: { projetoId: id },
        orderBy: [{ ordem: 'asc' }, { createdAt: 'asc' }],
        select: { id: true, nome: true, ordem: true, _count: { select: { acoes: true } } },
      })
    : []
  const macroetapas = macroetapasBrutas.map((m) => ({ id: m.id, nome: m.nome, ordem: m.ordem, acoes: m._count.acoes }))
  // `?em=aaaa-mm-dd`: o projeto como estava no fim daquele dia, reconstruído do histórico.
  const parametros = await searchParams
  const em = lerDataDaFoto(parametros.em, agora)
  const bruta = Array.isArray(parametros.busca) ? parametros.busca[0] : parametros.busca
  const busca = typeof bruta === 'string' && bruta.trim() !== '' ? bruta.trim() : null

  // Projeto excluído logicamente (`ativo = false`) não é visível.
  const projeto = await prisma.projeto.findFirst({
    where: { id, ativo: true },
    select: {
      id: true,
      nome: true,
      referencia: true,
      equipe: true,
      responsavel: true,
      acoes: {
        orderBy: { numero: 'asc' },
        select: {
          id: true,
          numero: true,
          descricao: true,
          status: true,
          previstoInicio: true,
          previstoTermino: true,
          realizadoInicio: true,
          realizadoTermino: true,
          responsavel: { select: { nome: true } },
        },
      },
    },
  })

  if (!projeto) notFound()

  let hoje = agora
  let acoesProjeto: {
    id: string
    numero: number
    descricao: string
    status: StatusAcao
    previstoInicio: Date | null
    previstoTermino: Date | null
    realizadoInicio: Date | null
    realizadoTermino: Date | null
    responsavel: string | null
  }[] = projeto.acoes.map((a) => ({ ...a, responsavel: a.responsavel?.nome ?? null }))
  let criadasDepois = 0
  let anteriorAoRegistro = false

  if (em !== null) {
    const [comHistorico, registro] = await Promise.all([
      prisma.acao.findMany({
        where: { projetoId: projeto.id },
        select: {
          id: true,
          numero: true,
          descricao: true,
          status: true,
          previstoInicio: true,
          previstoTermino: true,
          realizadoInicio: true,
          realizadoTermino: true,
          createdAt: true,
          responsavel: { select: { nome: true } },
          historico: { select: { campo: true, valorAntigo: true, alteradoEm: true } },
        },
      }),
      // Primeiro registro do sistema: antes dele a foto não tem como ser fiel.
      prisma.acao.aggregate({ _min: { createdAt: true } }),
    ])
    const foto = fotoDoProjeto(
      comHistorico.map((a) => ({ ...a, responsavel: a.responsavel?.nome ?? null })),
      corteDaFoto(em),
      registro._min.createdAt,
    )
    acoesProjeto = foto.acoes
    criadasDepois = foto.criadasDepois
    anteriorAoRegistro = foto.anteriorAoRegistro
    // A linha do "hoje" do Gantt passa a marcar o dia da foto, e o atraso é
    // medido contra ele: o que estava atrasado NAQUELE dia.
    hoje = new Date(`${em}T00:00:00.000Z`)
  }

  const resumo = resumirAcoes(acoesProjeto, hoje)
  // O resumo acima conta TODAS as ações; busca e paginação só decidem o que se
  // desenha — senão o percentual concluído mudaria a cada busca.
  const encontradas = acoesProjeto.filter((a) =>
    correspondeABusca(busca, [a.numero, a.descricao, a.responsavel]),
  )
  const pagina = paginar(encontradas, lerPagina(parametros), TAMANHO_PAGINA_ACOES)
  const [vinculos, liberadas] =
    em === null
      ? await Promise.all([
          prisma.dependenciaAcao.findMany({
            where: { acao: { projetoId: projeto.id } },
            select: { acaoId: true, predecessora: { select: { id: true, numero: true, status: true } } },
          }),
          prisma.liberacaoAcao.findMany({
            where: { acao: { projetoId: projeto.id }, status: 'APROVADA' },
            select: { acaoId: true },
          }),
        ])
      : [[], []]
  const liberadasIds = new Set(liberadas.map((l) => l.acaoId))
  const contagemLinks =
    em === null
      ? await prisma.linkAcao.groupBy({ by: ['acaoId'], where: { acao: { projetoId: projeto.id } }, _count: { _all: true } })
      : []
  const linksPorAcao = new Map(contagemLinks.map((c) => [c.acaoId, c._count._all]))
  const acoes: LinhaGantt[] = pagina.itens.map((acao) => ({
    ...acao,
    links: linksPorAcao.get(acao.id) ?? 0,
    dependencia: etiquetaDaDependencia({
      predecessoras: vinculos.filter((v) => v.acaoId === acao.id).map((v) => v.predecessora),
      iniciada: acaoIniciada(acao),
      liberada: liberadasIds.has(acao.id),
    }),
    // Na foto não há link de edição: a ação editada é a de hoje, não a da foto.
    href: em === null ? `/projetos/${projeto.id}/acoes/${acao.id}/editar` : undefined,
    // Os riscos abertos que afetam a ação viram losangos no prazo deles. Na foto não: o risco é de hoje.
    riscos:
      em === null
        ? riscosDoProjeto
            .filter((r) => r.acaoId === acao.id && riscoAberto(r.status) && r.prazo !== null)
            .map((r) => ({ id: r.id, titulo: r.titulo, tipo: r.tipo as 'RISCO' | 'BLOQUEIO', impacto: r.impacto as 'BAIXO' | 'MEDIO' | 'ALTO', prazo: r.prazo }))
        : [],
  }))
  const dependenciasDoGantt = vinculos.map((v) => ({
    de: v.predecessora.id,
    para: v.acaoId,
    bloqueada: acoes.find((a) => a.id === v.acaoId)?.dependencia?.bloqueada ?? false,
  }))
  const ontem = new Date(agora.getTime() - 86_400_000).toISOString().slice(0, 10)

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <p className="text-sm font-medium text-accent">
        {projeto.referencia ?? 'Cronograma'}
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">{projeto.nome}</h1>

      <div className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm text-textMuted">
        {projeto.equipe !== null && <span>Equipe: {projeto.equipe}</span>}
        {projeto.responsavel !== null && <span>Responsável: {projeto.responsavel}</span>}
        <span>
          {resumo.acoesConcluidas} de {resumo.totalAcoes} ações concluídas (
          {resumo.percentualConcluido}%) — {ROTULO_STATUS_AGREGADO[resumo.status]}
        </span>
      </div>

      <p className="mt-4 text-sm">
        <Link className="text-accent hover:underline" href="/projetos">
          Voltar para a listagem
        </Link>
        {' · '}
        <Link className="text-accent hover:underline" href={`/projetos/${projeto.id}/flash-report`}>
          Flash Report
        </Link>
        {podeEditar ? (
          <>
            {' · '}
          <Link
            className="text-accent hover:underline"
            href={`/projetos/${projeto.id}/editar`}
          >
            Editar projeto
          </Link>
          {' · '}
          <Link
            className="text-accent hover:underline"
            href={`/projetos/${projeto.id}/acoes/nova`}
          >
            Nova ação
          </Link>
          {acoesProjeto.length > 1 ? (
            <>
              {' · '}
              <Link
                className="text-accent hover:underline"
                href={`/projetos/${projeto.id}/lote`}
              >
                Editar em lote
              </Link>
            </>
          ) : null}
          {acoesProjeto.length > 0 ? (
            <>
              {' · '}
              <Link
                className="text-accent hover:underline"
                href={`/projetos/${projeto.id}/modelo`}
              >
                Salvar como modelo
              </Link>
            </>
          ) : null}
          </>
        ) : null}
      </p>

      <SeletorFoto rota={`/projetos/${projeto.id}`} em={em} ontem={ontem} />

      {em !== null ? (
        <div className="mt-4 border-l-2 border-previsto bg-surface py-3 pl-4 text-sm text-textMuted" role="status">
          <p>
            <strong className="font-medium text-text">Foto de {formatarDataBR(new Date(`${em}T12:00:00Z`))}</strong>{' '}
            — o projeto como estava no fim desse dia, reconstruído do histórico de
            alterações. Somente leitura.
          </p>
          {anteriorAoRegistro ? (
            <p className="mt-1 text-warn">
              Esta data é anterior ao início do registro no sistema: o que havia antes veio
              da planilha e não há como reconstruí-lo. O que aparece aqui não é confiável.
            </p>
          ) : null}
          {criadasDepois > 0 ? (
            <p className="mt-1">
              {criadasDepois === 1
                ? '1 ação foi criada depois dessa data e não aparece.'
                : `${criadasDepois} ações foram criadas depois dessa data e não aparecem.`}
            </p>
          ) : null}
          <p className="mt-1 text-xs text-textFaint">
            Descrição e número da ação aparecem como estão hoje (o histórico não os
            registra), e alterações feitas fora do sistema não são desfeitas.
          </p>
        </div>
      ) : null}

      {acoesProjeto.length > TAMANHO_PAGINA_ACOES || busca !== null ? (
        <BuscaAcoes busca={busca} em={em} rota={`/projetos/${projeto.id}`} />
      ) : null}
      {busca !== null && encontradas.length === 0 ? (
        <p className="mt-4 text-sm text-textMuted" role="status">
          Nenhuma ação corresponde a “{busca}”.
        </p>
      ) : (
        <GanttProjeto acoes={acoes} hoje={hoje} dependencias={dependenciasDoGantt} />
      )}
      <Paginacao
        nome="ações"
        pagina={pagina}
        parametros={{
          ...(busca !== null ? { busca } : {}),
          ...(em !== null ? { em } : {}),
        }}
        rota={`/projetos/${projeto.id}`}
      />

      {em === null ? (
        <SecaoRiscos
          administrador={administrador}
          hoje={hoje}
          podeEditar={podeEditar}
          projetoId={projeto.id}
          riscos={riscosDoProjeto}
          userId={userId}
        />
      ) : null}
      {em === null ? (
        podeEditar ? (
          <SecaoMacroetapas macroetapas={macroetapas} projetoId={projeto.id} />
        ) : (
          <AvisoSomenteLeitura />
        )
      ) : null}
    </main>
  )
}
