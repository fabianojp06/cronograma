import { SignOutButton } from '@clerk/nextjs'

import { DOMINIO_PERMITIDO } from '@/lib/dominio-permitido'

export const metadata = { title: 'Acesso restrito — Cronograma CTCEA' }

export default async function AcessoNegadoPage({ searchParams }: { searchParams: Promise<{ motivo?: string }> }) {
  const { motivo } = await searchParams
  const falhaDeVerificacao = motivo === 'verificacao'

  return (
    <main className="mx-auto w-full max-w-xl px-6 py-16">
      <p className="text-sm font-medium text-accent">Cronograma CTCEA</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Acesso restrito</h1>

      {falhaDeVerificacao ? (
        <p className="mt-4 text-sm text-textMuted">
          Não foi possível confirmar o e-mail da sua conta agora. Aguarde um instante e
          tente de novo.
        </p>
      ) : (
        <p className="mt-4 text-sm text-textMuted">
          Este sistema é de uso interno da CTCEA. Só entram contas com e-mail{' '}
          <strong className="font-medium text-text">@{DOMINIO_PERMITIDO}</strong>, e o
          e-mail da conta com que você entrou não é desse domínio.
        </p>
      )}

      <p className="mt-4 text-sm text-textMuted">
        {falhaDeVerificacao
          ? 'Se continuar assim, avise a equipe responsável pelo sistema.'
          : `Saia e entre — ou crie uma conta — com o seu e-mail @${DOMINIO_PERMITIDO}.`}
      </p>

      <div className="mt-6">
        <SignOutButton redirectUrl="/entrar">
          <button
            className="rounded-md bg-accent px-4 py-2 text-sm font-semibold text-onAccent"
            type="button"
          >
            Sair e entrar com outra conta
          </button>
        </SignOutButton>
      </div>
    </main>
  )
}
