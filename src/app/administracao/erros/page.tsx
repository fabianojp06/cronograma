import Link from 'next/link'
import { auth } from '@clerk/nextjs/server'

import { NavegacaoAdministracao } from '@/components/navegacao-administracao'
import { contaPodeAdministrar } from '@/lib/administracao-servidor'
import { DIAS_DE_RETENCAO } from '@/lib/registro-erro'
import { prisma } from '@/lib/prisma'

export const metadata = { title: 'Registro de erros — Cronograma CTCEA' }

const LIMITE = 100

const formatarMomento = (data: Date) =>
  data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    dateStyle: 'short',
    timeStyle: 'medium',
  })

export default async function RegistroErrosPage() {
  const { userId } = await auth()
  if (!userId || !(await contaPodeAdministrar(userId))) {
    return (
      <main className="mx-auto w-full max-w-3xl px-6 py-12">
        <h1 className="font-display text-2xl font-extrabold">Registro de erros</h1>
        <p className="mt-4 border-l-2 border-borderSoft bg-surface py-3 pl-4 text-sm text-textMuted">
          Só administradores consultam o registro de erros.
        </p>
      </main>
    )
  }

  const [erros, total] = await Promise.all([
    prisma.registroErro.findMany({ orderBy: { criadoEm: 'desc' }, take: LIMITE }),
    prisma.registroErro.count(),
  ])

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-12">
      <NavegacaoAdministracao atual="/administracao/erros" />
      <p className="text-sm font-medium uppercase tracking-wide text-accent">Administração</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Registro de erros</h1>
      <p className="mt-2 max-w-3xl text-sm text-textMuted">
        Falhas do sistema em produção, guardadas por {DIAS_DE_RETENCAO} dias — o log da
        Vercel guarda só 1 hora. Mostra as {LIMITE} mais recentes
        {total > LIMITE ? ` (de ${total})` : ''}. Os textos podem conter dados da
        operação que falhou; não compartilhe fora da equipe.{' '}
        <Link className="text-accent hover:underline" href="/colaboradores">
          Voltar para Colaboradores
        </Link>
        .
      </p>

      {erros.length === 0 ? (
        <p className="mt-8 border-l-2 border-realizado bg-surface py-3 pl-4 text-sm text-text">
          Nenhum erro registrado.
        </p>
      ) : (
        <ul className="mt-8 space-y-2">
          {erros.map((erro) => (
            <li key={erro.id} className="border-l-2 border-warn bg-surface px-4 py-3">
              <p className="text-sm font-medium text-text">{erro.origem}</p>
              <p className="mt-0.5 break-words text-sm text-textMuted">{erro.mensagem}</p>
              <p className="mt-1 text-xs tabular-nums text-textFaint">
                {formatarMomento(erro.criadoEm)}
                {erro.rota ? ` · ${erro.rota}` : ''}
                {erro.digest ? ` · digest ${erro.digest}` : ''}
              </p>
              {erro.detalhe ? (
                <details className="mt-2">
                  <summary className="cursor-pointer text-xs text-textMuted hover:text-accent">
                    Detalhe
                  </summary>
                  <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-md bg-bg p-3 text-xs text-textMuted">
                    {erro.detalhe}
                  </pre>
                </details>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
