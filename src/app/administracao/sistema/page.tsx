import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { contaPodeAdministrar } from '@/lib/administracao-servidor'
import {
  agruparErrosPorOrigem,
  conferirConfiguracao,
  cronEstaAtrasado,
  LIMITE_ACOES_DASHBOARDS,
  situacaoDoVolume,
} from '@/lib/monitoramento'
import { prisma } from '@/lib/prisma'
import { medirBanco } from '@/lib/saude-banco'

export const metadata = { title: 'Painel do sistema — Cronograma CTCEA' }
export const dynamic = 'force-dynamic'

const momento = (data: Date) =>
  data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'short',
  })

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-lg font-bold">{titulo}</h2>
      <div className="mt-3">{children}</div>
    </section>
  )
}

export default async function PainelSistemaPage() {
  const { userId } = await auth()
  if (!userId || !(await contaPodeAdministrar(userId))) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="font-display text-2xl font-extrabold">Painel do sistema</h1>
        <p className="mt-4 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
          Só administradores consultam o painel do sistema.
        </p>
      </main>
    )
  }

  const agora = new Date()
  const [banco, errosRecentes, execucoes, projetos, acoes, colaboradores, comentarios] =
    await Promise.all([
      medirBanco(),
      prisma.registroErro.findMany({
        where: { criadoEm: { gte: new Date(agora.getTime() - 7 * 86_400_000) } },
        select: { origem: true, criadoEm: true },
      }),
      prisma.execucaoCron.findMany({
        where: { nome: 'atrasos' },
        orderBy: { executadoEm: 'desc' },
        take: 5,
      }),
      prisma.projeto.count({ where: { ativo: true } }),
      prisma.acao.count({ where: { projeto: { ativo: true } } }),
      prisma.colaborador.count({ where: { ativo: true } }),
      prisma.comentarioAcao.count(),
    ])

  const porOrigem = agruparErrosPorOrigem(errosRecentes, agora)
  const total24h = porOrigem.reduce((soma, l) => soma + l.ultimas24h, 0)
  const configuracao = conferirConfiguracao(process.env)
  const volume = situacaoDoVolume(acoes)
  const ultimoCron = execucoes[0] ?? null
  const cronAtrasado = cronEstaAtrasado(ultimoCron?.executadoEm ?? null, agora)

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <p className="text-sm font-medium uppercase tracking-wide text-accent">Administração</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Painel do sistema</h1>
      <p className="mt-2 max-w-3xl text-sm text-textMuted">
        Saúde, erros, agendador e volume em um lugar. A verificação de disponibilidade
        externa consulta <code>/api/saude</code>.{' '}
        <Link className="text-accent hover:underline" href="/administracao/erros">
          Registro completo de erros
        </Link>
        {' · '}
        <Link className="text-accent hover:underline" href="/colaboradores">
          Colaboradores
        </Link>
      </p>

      <Bloco titulo="Banco de dados">
        <p
          className={`border-l-2 bg-surface py-3 pl-4 text-sm ${banco.ok ? 'border-realizado' : 'border-warn'}`}
        >
          {banco.ok ? `Respondendo em ${banco.ms} ms.` : 'Não respondeu. O sistema está sem acesso aos dados.'}
        </p>
      </Bloco>

      <Bloco titulo="Erros (últimos 7 dias)">
        <p className="text-sm text-textMuted">
          {total24h === 0 ? 'Nenhum erro nas últimas 24 horas.' : `${total24h} erro(s) nas últimas 24 horas.`}{' '}
          Cada origem avisa por e-mail no máximo uma vez por hora.
        </p>
        {porOrigem.length === 0 ? null : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-xl border-collapse text-sm">
              <thead>
                <tr className="bg-tableHeadBg text-left text-xs uppercase tracking-wide text-textMuted">
                  <th className="px-3 py-2 font-semibold">Origem</th>
                  <th className="px-3 py-2 text-right font-semibold">24 h</th>
                  <th className="px-3 py-2 text-right font-semibold">7 dias</th>
                  <th className="px-3 py-2 font-semibold">Último</th>
                </tr>
              </thead>
              <tbody>
                {porOrigem.map((linha) => (
                  <tr key={linha.origem} className="border-b border-borderSoft bg-surface">
                    <td className={`border-l-2 px-3 py-2.5 ${linha.ultimas24h > 0 ? 'border-warn' : 'border-borderSoft'}`}>
                      {linha.origem}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{linha.ultimas24h}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{linha.ultimos7d}</td>
                    <td className="px-3 py-2.5 tabular-nums text-textMuted">{momento(linha.ultimoEm)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>

      <Bloco titulo="Aviso semanal de atraso (agendador)">
        {ultimoCron === null ? (
          <p className="border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
            Ainda não rodou desde que o registro existe. A próxima execução é na segunda,
            às 11h UTC (8h em Brasília).
          </p>
        ) : (
          <>
            <p
              className={`border-l-2 bg-surface py-3 pl-4 text-sm ${
                !ultimoCron.ok || cronAtrasado ? 'border-warn' : 'border-realizado'
              }`}
            >
              Última execução: {momento(ultimoCron.executadoEm)} —{' '}
              {ultimoCron.ok ? 'concluída' : 'falhou'}.
              {cronAtrasado ? ' Já passou da data esperada: confira o agendador na Vercel.' : ''}
            </p>
            <ul className="mt-3 space-y-1 text-xs text-textMuted">
              {execucoes.map((e) => (
                <li key={e.id} className="break-words">
                  <span className="tabular-nums text-textFaint">{momento(e.executadoEm)}</span>{' '}
                  {e.ok ? '' : '(falha) '}
                  {e.resumo}
                </li>
              ))}
            </ul>
          </>
        )}
      </Bloco>

      <Bloco titulo="Configuração">
        <ul className="space-y-2">
          {configuracao.map((item) => (
            <li
              key={item.id}
              className={`border-l-2 bg-surface px-4 py-2.5 text-sm ${item.ok ? 'border-realizado' : 'border-warn'}`}
            >
              <span className="font-medium">{item.rotulo}</span>
              <span className="text-textMuted"> — {item.detalhe}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-textFaint">
          O painel só diz se a variável está definida, nunca o valor.
        </p>
      </Bloco>

      <Bloco titulo="Volume">
        <dl className="grid gap-4 sm:grid-cols-4">
          {[
            ['Projetos ativos', projetos],
            ['Ações', acoes],
            ['Colaboradores ativos', colaboradores],
            ['Comentários', comentarios],
          ].map(([rotulo, valor]) => (
            <div key={rotulo} className="border-l-2 border-accent bg-surface py-2 pl-4">
              <dt className="text-xs font-medium uppercase tracking-wide text-textMuted">{rotulo}</dt>
              <dd className="mt-1 font-display text-2xl font-extrabold tabular-nums">{valor}</dd>
            </div>
          ))}
        </dl>
        <p
          className={`mt-4 border-l-2 bg-surface py-3 pl-4 text-sm ${volume.nivel === 'ok' ? 'border-realizado' : 'border-warn'}`}
        >
          Ações: {volume.percentual}% do ponto em que <code>/dashboards</code> merece ser
          reavaliado ({LIMITE_ACOES_DASHBOARDS.toLocaleString('pt-BR')}).
          {volume.nivel === 'acima' ? ' Passou: agregar no banco antes de continuar.' : ''}
        </p>
      </Bloco>
    </main>
  )
}
