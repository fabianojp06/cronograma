import { auth } from '@clerk/nextjs/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AvisoSomenteLeitura } from '@/components/aviso-somente-leitura'
import { contaPodeAdministrar, sessaoPodeEditar } from '@/lib/administracao-servidor'
import { excluirComentario } from '@/app/projetos/acoes-comentario'
import { BotaoDuplicarAcao } from '@/components/botao-duplicar-acao'
import { FormularioComentario } from '@/components/formulario-comentario'
import { FormularioAcao, type ValoresAcao } from '@/components/formulario-acao'
import { serializarValor } from '@/lib/acao-historico'
import { ROTULOS_STATUS, type StatusAcao } from '@/lib/acao-validacao'
import { rotularCampo } from '@/lib/dashboard-auditoria'
import { formatarValorHistorico, rotularAutor } from '@/lib/historico-exibicao'
import { podeApagarComentario } from '@/lib/comentario-validacao'
import { contaELiderDoProjeto } from '@/lib/dependencia-servidor'
import { SecaoDependencias } from '@/components/secao-dependencias'
import { LinksAcao } from '@/components/links-acao'
import { prisma } from '@/lib/prisma'
import { descreverMotivo } from '@/lib/motivo-replanejamento'

export const metadata = { title: 'Editar ação — Cronograma CTCEA' }

const formatoMomento = new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
})

export default async function EditarAcaoPage({
  params,
}: PageProps<'/projetos/[id]/acoes/[acaoId]/editar'>) {
  const { id, acaoId } = await params

  // Mesma regra de `atualizarAcao`: ação de projeto excluído não é editável. O
  // `projetoId` no filtro impede abrir a ação de um projeto pela URL de outro.
  const acao = await prisma.acao.findFirst({
    where: { id: acaoId, projetoId: id, projeto: { ativo: true } },
    select: {
      id: true,
      numero: true,
      descricao: true,
      status: true,
      previstoInicio: true,
      previstoTermino: true,
      realizadoInicio: true,
      realizadoTermino: true,
      responsavelId: true,
      updatedAt: true,
      responsavel: { select: { nome: true, ativo: true, email: true } },
      projeto: { select: { id: true, nome: true, referencia: true, responsavel: true, liderId: true } },
      dependeDe: {
        orderBy: { criadoEm: 'asc' },
        select: {
          id: true,
          predecessora: {
            select: {
              id: true,
              numero: true,
              descricao: true,
              status: true,
              previstoTermino: true,
              realizadoTermino: true,
            },
          },
        },
      },
      liberacoes: {
        orderBy: { criadoEm: 'desc' },
        select: {
          id: true,
          motivo: true,
          status: true,
          justificativa: true,
          solicitante: true,
          criadoEm: true,
        },
      },
      links: {
        orderBy: { criadoEm: 'asc' },
        select: { id: true, titulo: true, url: true, tipo: true },
      },
      riscos: {
        where: { status: { in: ['ABERTO', 'EM_TRATAMENTO'] } },
        orderBy: { criadoEm: 'asc' },
        select: { id: true, tipo: true, titulo: true, impacto: true },
      },
      comentarios: {
        orderBy: { criadoEm: 'desc' },
        select: { id: true, texto: true, autor: true, criadoEm: true },
      },
      historico: {
        orderBy: { alteradoEm: 'desc' },
        select: {
          id: true,
          campo: true,
          valorAntigo: true,
          valorNovo: true,
          alteradoEm: true,
          alteradoPor: true,
          motivo: true,
          motivoDetalhe: true,
        },
      },
    },
  })
  if (!acao) notFound()

  const { userId } = await auth()
  const podeEditar = await sessaoPodeEditar()
  const administrador = userId !== null && (await contaPodeAdministrar(userId))

  const ativos = await prisma.colaborador.findMany({
    where: { ativo: true },
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true, email: true, clerkUserId: true },
  })
  const responsaveis = ativos.map((c) => ({
    id: c.id,
    nome: c.nome,
    temEmail: c.email !== null,
  }))
  // O responsável atual entra na lista mesmo desativado: sem ele, o `select`
  // abriria em "Sem responsável" e salvar outro campo o apagaria em silêncio.
  if (acao.responsavelId && acao.responsavel && !acao.responsavel.ativo) {
    responsaveis.unshift({
      id: acao.responsavelId,
      nome: `${acao.responsavel.nome} (inativo)`,
      temEmail: acao.responsavel.email !== null,
    })
  }

  // O histórico guarda o `userId` do Clerk; o nome vem do colaborador da conta.
  const contas = [
    ...new Set([
      ...acao.historico.map((h) => h.alteradoPor).filter((c): c is string => c !== null),
      ...acao.comentarios.map((c) => c.autor),
      ...acao.liberacoes.map((l) => l.solicitante),
    ]),
  ]
  const autores = await prisma.colaborador.findMany({
    where: { clerkUserId: { in: contas } },
    select: { clerkUserId: true, nome: true },
  })
  const nomePorConta = new Map(autores.map((a) => [a.clerkUserId!, a.nome]))

  const outrasAcoes = await prisma.acao.findMany({
    where: { projetoId: acao.projeto.id, id: { not: acao.id } },
    orderBy: { numero: 'asc' },
    select: { id: true, numero: true, descricao: true },
  })
  const jaDepende = new Set(acao.dependeDe.map((v) => v.predecessora.id))
  const opcoesDependencia = outrasAcoes
    .filter((o) => !jaDepende.has(o.id))
    .map((o) => ({
      id: o.id,
      rotulo: `${o.numero} — ${o.descricao.length > 60 ? `${o.descricao.slice(0, 60)}…` : o.descricao}`,
    }))
  const ehLider =
    userId !== null && (await contaELiderDoProjeto(userId, acao.projeto))

  const valores: ValoresAcao = {
    id: acao.id,
    descricao: acao.descricao,
    status: acao.status as StatusAcao,
    responsavelId: acao.responsavelId,
    versao: acao.updatedAt.toISOString(),
    previstoInicio: serializarValor(acao.previstoInicio),
    previstoTermino: serializarValor(acao.previstoTermino),
    realizadoInicio: serializarValor(acao.realizadoInicio),
    realizadoTermino: serializarValor(acao.realizadoTermino),
  }

  return (
    <main className="mx-auto w-full max-w-6xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">
        {acao.projeto.referencia ?? 'Projeto'}
      </p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">
        Ação <span className="tabular-nums">{acao.numero}</span>
      </h1>
      <p className="mt-2 text-sm text-textMuted">
        Projeto{' '}
        <Link className="text-text hover:text-accent" href={`/projetos/${acao.projeto.id}`}>
          <strong>{acao.projeto.nome}</strong>
        </Link>
        . Toda mudança de status, datas ou responsável fica registrada no histórico.
      </p>

      <div className="grid gap-x-12 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {podeEditar ? (
          <div>
            <FormularioAcao projetoId={acao.projeto.id} responsaveis={responsaveis} acao={valores} />
            <BotaoDuplicarAcao acaoId={acao.id} />
          </div>
        ) : (
          <div>
            <AvisoSomenteLeitura
              voltarPara={`/projetos/${acao.projeto.id}`}
              rotuloVoltar="Voltar para o projeto"
            />
            <dl className="mt-6 space-y-2 text-sm">
              <div>
                <dt className="text-textMuted">Descrição</dt>
                <dd className="text-text">{acao.descricao}</dd>
              </div>
              <div>
                <dt className="text-textMuted">Status</dt>
                <dd className="text-text">{ROTULOS_STATUS[valores.status]}</dd>
              </div>
              <div>
                <dt className="text-textMuted">Responsável</dt>
                <dd className="text-text">{acao.responsavel?.nome ?? 'Sem responsável'}</dd>
              </div>
              <div>
                <dt className="text-textMuted">Previsto</dt>
                <dd className="text-text">
                  {formatarValorHistorico('previstoInicio', valores.previstoInicio)} a{' '}
                  {formatarValorHistorico('previstoTermino', valores.previstoTermino)}
                </dd>
              </div>
              <div>
                <dt className="text-textMuted">Realizado</dt>
                <dd className="text-text">
                  {formatarValorHistorico('realizadoInicio', valores.realizadoInicio)} a{' '}
                  {formatarValorHistorico('realizadoTermino', valores.realizadoTermino)}
                </dd>
              </div>
            </dl>
          </div>
        )}

        <div className="lg:col-start-1">
          <SecaoDependencias
            acao={acao}
            ehLider={ehLider}
            hoje={new Date()}
            nomePorConta={nomePorConta}
            opcoes={opcoesDependencia}
            pedidos={acao.liberacoes}
            podeEditar={podeEditar}
            projetoId={acao.projeto.id}
            vinculos={acao.dependeDe}
          />
        </div>

        <div className="lg:col-start-1">
          <LinksAcao acaoId={acao.id} links={acao.links} podeEditar={podeEditar} />
        </div>

        {acao.riscos.length > 0 ? (
          <section aria-labelledby="titulo-riscos-acao" className="mt-8 lg:col-start-1">
            <h2 className="font-display text-base font-bold" id="titulo-riscos-acao">
              Riscos e bloqueios desta ação{' '}
              <span className="text-sm font-normal text-textFaint">({acao.riscos.length})</span>
            </h2>
            <ul className="mt-3 space-y-2 text-sm">
              {acao.riscos.map((r) => (
                <li className="border-l-2 border-warn bg-surface py-2 pl-3" key={r.id}>
                  <Link className="font-medium text-text underline hover:text-accent" href={`/projetos/${acao.projeto.id}/riscos/${r.id}/editar`}>
                    {r.tipo === 'BLOQUEIO' ? 'Bloqueio' : 'Risco'}: {r.titulo}
                  </Link>{' '}
                  <span className="text-xs text-textFaint">impacto {r.impacto === 'ALTO' ? 'alto' : r.impacto === 'MEDIO' ? 'médio' : 'baixo'}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section aria-labelledby="titulo-comentarios" className="mt-8 lg:col-start-1">
          <h2 className="font-display text-base font-bold" id="titulo-comentarios">
            Comentários{' '}
            <span className="text-sm font-normal text-textFaint">({acao.comentarios.length})</span>
          </h2>
          {podeEditar ? <FormularioComentario
              acaoId={acao.id}
              colaboradores={ativos
                .filter((c) => c.clerkUserId !== userId)
                .map((c) => ({ id: c.id, nome: c.nome }))}
              responsavel={acao.responsavel?.nome ?? null}
            /> : null}
          {acao.comentarios.length === 0 ? (
            <p className="mt-3 text-sm text-textMuted">Nenhum comentário nesta ação.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {acao.comentarios.map((comentario) => (
                <li
                  className="border-l-2 border-accent bg-surface py-2 pl-3 pr-2 text-sm"
                  key={comentario.id}
                >
                  <p className="whitespace-pre-wrap break-words text-text">{comentario.texto}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-textFaint">
                    <span>
                      {formatoMomento.format(comentario.criadoEm)} ·{' '}
                      {rotularAutor(comentario.autor, nomePorConta)}
                    </span>
                    {podeEditar &&
                    userId !== null &&
                    podeApagarComentario(comentario.autor, userId, administrador) ? (
                      <form action={excluirComentario}>
                        <input name="comentarioId" type="hidden" value={comentario.id} />
                        <button className="text-textMuted hover:text-warn" type="submit">
                          Apagar
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside aria-labelledby="titulo-historico" className="mt-8 lg:col-start-2 lg:row-start-1 lg:row-span-2">
          <h2 className="font-display text-base font-bold" id="titulo-historico">
            Histórico de alterações
          </h2>
          {acao.historico.length === 0 ? (
            <p className="mt-3 text-sm text-textMuted">
              Nenhuma alteração desde a criação da ação.
            </p>
          ) : (
            <ol className="mt-3 space-y-3">
              {acao.historico.map((linha) => (
                <li className="border-l-2 border-borderSoft pl-3 text-sm" key={linha.id}>
                  <p className="font-medium text-text">{rotularCampo(linha.campo)}</p>
                  <p className="text-textMuted">
                    {formatarValorHistorico(linha.campo, linha.valorAntigo)}
                    <span aria-hidden="true"> → </span>
                    <span className="sr-only"> para </span>
                    <span className="text-text">
                      {formatarValorHistorico(linha.campo, linha.valorNovo)}
                    </span>
                  </p>
                  {linha.campo === 'previstoInicio' || linha.campo === 'previstoTermino' ? (
                    linha.motivo ? (
                      <p className="mt-0.5 text-xs text-text">Motivo: {descreverMotivo(linha.motivo, linha.motivoDetalhe)}</p>
                    ) : linha.valorAntigo !== null ? (
                      <p className="mt-0.5 text-xs text-textFaint">{descreverMotivo(null, null)}</p>
                    ) : null
                  ) : null}
                  <p className="mt-0.5 text-xs text-textFaint">
                    {formatoMomento.format(linha.alteradoEm)} ·{' '}
                    {rotularAutor(linha.alteradoPor, nomePorConta)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </aside>
      </div>
    </main>
  )
}
