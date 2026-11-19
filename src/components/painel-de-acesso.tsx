import Link from 'next/link'

import { urlBaseDoSistema } from '@/lib/email-config'
import { redirectSeguro } from '@/lib/primeiro-acesso'

/**
 * Explicação em volta do login e do cadastro do Clerk: quem chega por um link
 * de projeto precisa saber que o acesso é restrito à CTCEA e que pode criar a
 * conta ali mesmo. O `redirect_url` (para onde voltar) só acompanha a troca
 * entre "entrar" e "criar conta" se for um endereço do próprio sistema.
 */
export function PainelDeAcesso({
  modo,
  redirectUrl,
}: {
  modo: 'entrar' | 'cadastrar'
  redirectUrl?: string
}) {
  const volta = redirectSeguro(redirectUrl, urlBaseDoSistema(process.env))
  const consulta = volta ? `?redirect_url=${encodeURIComponent(volta)}` : ''
  const entrando = modo === 'entrar'

  return (
    <section
      aria-labelledby="titulo-acesso"
      className="w-full max-w-md border-l-2 border-accent bg-surface px-5 py-4"
    >
      <h1 className="font-display text-lg font-extrabold" id="titulo-acesso">
        {entrando ? 'Este conteúdo é restrito à CTCEA' : 'Criar a sua conta'}
      </h1>
      <p className="mt-2 text-sm text-textMuted">
        {entrando ? (
          <>
            Entre com a sua conta <strong className="font-medium text-text">@ctcea.org.br</strong>.
            Ainda não tem conta? Crie uma agora: leva um minuto e você volta direto ao que
            estava abrindo.
          </>
        ) : (
          <>
            Use o seu e-mail <strong className="font-medium text-text">@ctcea.org.br</strong>.
            Contas de outros domínios não têm acesso ao sistema. Depois de criar a conta, você
            confirma o seu nome e segue para o que estava abrindo.
          </>
        )}
      </p>
      <p className="mt-3 text-sm">
        {entrando ? (
          <Link
            className="inline-block rounded-md bg-accent px-3 py-1.5 font-semibold text-onAccent"
            href={`/cadastrar${consulta}`}
          >
            Criar conta
          </Link>
        ) : (
          <>
            Já tem conta?{' '}
            <Link className="text-accent hover:underline" href={`/entrar${consulta}`}>
              Entrar
            </Link>
          </>
        )}
      </p>
    </section>
  )
}
