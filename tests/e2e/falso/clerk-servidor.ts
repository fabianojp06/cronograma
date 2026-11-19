/**
 * Substituto de `@clerk/nextjs/server` SÓ para o teste de navegador.
 *
 * O teste precisa entrar no sistema sem uma conta de verdade no Clerk. Em vez de
 * abrir uma exceção no código de produção, o `next.config.ts` troca o módulo
 * inteiro quando `E2E_AUTH_FALSA=1` — o código de domínio continua chamando
 * `auth()` como sempre, e o que muda é só quem responde.
 *
 * Recusa carregar na Vercel: se alguém ligar a variável por engano num deploy,
 * o build falha em vez de publicar um sistema sem login.
 */
if (process.env.VERCEL) {
  throw new Error('Autenticação falsa de teste carregada na Vercel — remova E2E_AUTH_FALSA.')
}

import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

export const USUARIO_E2E = process.env.E2E_USER_ID ?? 'user_e2e'

/**
 * O teste troca de "pessoa" com o cookie `e2e_user`, sem segundo servidor:
 * `user_intruso` é uma conta com e-mail de fora do domínio.
 */
export const COOKIE_USUARIO = 'e2e_user'

export async function auth() {
  // O `auth()` de verdade lê os cabeçalhos da requisição, e é isso que torna a
  // página dinâmica. Sem esta leitura o Next pré-renderiza no build, com o banco
  // vazio, e serve HTML fixo — o teste passaria a depender do que sobrou do build.
  const cookie = (await cookies()).get(COOKIE_USUARIO)?.value
  return { userId: cookie ?? USUARIO_E2E }
}

export async function currentUser() {
  return null
}

/** Imita o cliente do Clerk: o e-mail principal depende da conta de teste. */
export async function clerkClient() {
  return {
    users: {
      async getUser(id: string) {
        const email =
          id === 'user_intruso'
            ? { id: 'e1', emailAddress: 'intruso@gmail.com' }
            : { id: 'e1', emailAddress: 'teste@ctcea.org.br' }
        return {
          primaryEmailAddressId: 'e1',
          emailAddresses: [{ ...email, verification: { status: 'verified' } }],
        }
      },
    },
  }
}

type Autenticador = (() => Promise<{ userId: string }>) & { protect: () => Promise<void> }

/**
 * O proxy do sistema exporta o resultado desta função. Executa o proxy de
 * verdade (com a checagem de domínio) usando o usuário do cookie de teste.
 */
export function clerkMiddleware(
  tratador: (auth: Autenticador, req: NextRequest) => Promise<Response | undefined | void>,
) {
  return async (req: NextRequest) => {
    const userId = req.cookies.get(COOKIE_USUARIO)?.value ?? USUARIO_E2E
    const autenticador = Object.assign(async () => ({ userId }), {
      protect: async () => {},
    })
    return tratador(autenticador, req)
  }
}

/** Mesma sintaxe de padrão do Clerk: `/rota(.*)`. */
export function createRouteMatcher(padroes: string[]) {
  const regexes = padroes.map((p) => new RegExp(`^${p}$`))
  return (req: NextRequest) => regexes.some((r) => r.test(req.nextUrl.pathname))
}
