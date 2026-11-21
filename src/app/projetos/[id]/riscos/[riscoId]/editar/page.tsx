import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AvisoSomenteLeitura } from '@/components/aviso-somente-leitura'
import { FormularioRisco } from '@/components/formulario-risco'
import { sessaoPodeEditar } from '@/lib/administracao-servidor'
import { rotularAutor } from '@/lib/historico-exibicao'
import { prisma } from '@/lib/prisma'
import { ROTULO_CAMPO_RISCO, valorDoHistoricoRisco } from '@/lib/risco-projeto'

export const metadata = { title: 'Editar risco ou bloqueio — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

const momento = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Sao_Paulo' })

export default async function EditarRiscoPage({ params }: { params: Promise<{ id: string; riscoId: string }> }) {
  const { id, riscoId } = await params
  const risco = await prisma.riscoProjeto.findFirst({
    where: { id: riscoId, projetoId: id, projeto: { ativo: true } },
    select: {
      id: true, tipo: true, titulo: true, descricao: true, impacto: true, status: true, acaoId: true,
      responsavelId: true, prazo: true, plano: true,
      responsavel: { select: { nome: true, ativo: true } },
      projeto: { select: { id: true, nome: true, acoes: { orderBy: { numero: 'asc' }, select: { id: true, numero: true, descricao: true } } } },
      historico: { orderBy: { alteradoEm: 'desc' }, select: { id: true, campo: true, valorAntigo: true, valorNovo: true, alteradoEm: true, alteradoPor: true } },
    },
  })
  if (!risco) notFound()
  const podeEditar = await sessaoPodeEditar()

  const pessoas = await prisma.colaborador.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } })
  // O responsável atual entra na lista mesmo inativo: sem ele, salvar outro campo o apagaria.
  if (risco.responsavelId && risco.responsavel && !risco.responsavel.ativo) {
    pessoas.unshift({ id: risco.responsavelId, nome: `${risco.responsavel.nome} (inativo)` })
  }

  const contas = [...new Set(risco.historico.map((h) => h.alteradoPor).filter((c): c is string => c !== null))]
  const autores = contas.length ? await prisma.colaborador.findMany({ where: { clerkUserId: { in: contas } }, select: { clerkUserId: true, nome: true } }) : []
  const nomePorConta = new Map(autores.map((a) => [a.clerkUserId!, a.nome]))

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium text-accent">Riscos e bloqueios</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Editar risco ou bloqueio</h1>
      <p className="mt-2 text-sm text-textMuted">
        Projeto{' '}
        <Link className="text-text hover:text-accent" href={`/projetos/${risco.projeto.id}`}>
          <strong>{risco.projeto.nome}</strong>
        </Link>
        . Mudanças de tipo, impacto, status, responsável e prazo ficam no histórico abaixo.
      </p>
      {podeEditar ? (
        <FormularioRisco
          acoes={risco.projeto.acoes.map((a) => ({ id: a.id, rotulo: `${a.numero} — ${a.descricao.length > 60 ? `${a.descricao.slice(0, 60)}…` : a.descricao}` }))}
          inicial={{
            tipo: risco.tipo, titulo: risco.titulo, descricao: risco.descricao ?? '', impacto: risco.impacto, status: risco.status,
            acaoId: risco.acaoId ?? '', responsavelId: risco.responsavelId ?? '',
            prazo: risco.prazo ? risco.prazo.toISOString().slice(0, 10) : '', plano: risco.plano ?? '',
          }}
          projetoId={risco.projeto.id}
          responsaveis={pessoas}
          riscoId={risco.id}
        />
      ) : (
        <AvisoSomenteLeitura voltarPara={`/projetos/${risco.projeto.id}`} rotuloVoltar="Voltar para o projeto" />
      )}

      <section aria-labelledby="titulo-historico-risco" className="mt-10 max-w-3xl">
        <h2 className="font-display text-base font-bold" id="titulo-historico-risco">Histórico</h2>
        {risco.historico.length === 0 ? (
          <p className="mt-2 text-sm text-textMuted">Nenhuma mudança desde o registro.</p>
        ) : (
          <ol className="mt-3 space-y-3">
            {risco.historico.map((h) => (
              <li className="border-l-2 border-borderSoft pl-3 text-sm" key={h.id}>
                <p className="font-medium">{ROTULO_CAMPO_RISCO[h.campo] ?? h.campo}</p>
                <p className="text-textMuted">
                  {valorDoHistoricoRisco(h.campo, h.valorAntigo)} <span aria-hidden="true">→</span>
                  <span className="sr-only"> para </span> <span className="text-text">{valorDoHistoricoRisco(h.campo, h.valorNovo)}</span>
                </p>
                <p className="text-xs text-textFaint">{momento.format(h.alteradoEm)} · {rotularAutor(h.alteradoPor, nomePorConta)}</p>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  )
}
