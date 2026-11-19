import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'

import { decidirAcesso } from '@/lib/dominio-permitido'
import { decidirPrimeiroAcesso, destinoDoPrimeiroAcesso } from '@/lib/primeiro-acesso'
import { contaTemColaborador } from '@/lib/verificar-cadastro'
import { ROTAS_PUBLICAS } from '@/lib/rotas-publicas'
import { verificarConta } from '@/lib/verificar-conta'

const rotaPublica = createRouteMatcher([...ROTAS_PUBLICAS])

/**
 * Proxy (antigo `middleware`) — autentica toda requisição que não caia em
 * `ROTAS_PUBLICAS`. `auth.protect()` redireciona o visitante anônimo para
 * `/entrar`.
 *
 * Estar autenticado no Clerk não basta: o e-mail principal e verificado da conta
 * tem de ser do domínio da CTCEA (`dominio-permitido.ts`). Sem isso, qualquer
 * pessoa que criasse uma conta com um e-mail qualquer entraria com o link de um
 * projeto. Quem não passa é levado a `/acesso-negado` (ou recebe 403, se for API).
 *
 * Quem passa mas ainda não é colaborador vai a `/bem-vindo` (`primeiro-acesso.ts`).
 */
export default clerkMiddleware(async (auth, req) => {
  if (rotaPublica(req)) return

  await auth.protect()
  const { userId } = await auth()
  if (!userId) return

  const decisao = decidirAcesso(await verificarConta(userId), req.nextUrl.pathname)
  if (decisao.tipo === 'permitir') {
    // Conta do domínio, mas sem colaborador: cadastra antes de qualquer tela e
    // volta ao endereço pedido (o link do projeto, por exemplo).
    const caminho = req.nextUrl.pathname
    const cadastro = decidirPrimeiroAcesso({
      temColaborador: await contaTemColaborador(userId),
      caminho,
      metodo: req.method,
    })
    if (cadastro === 'exigir') {
      return NextResponse.redirect(
        new URL(destinoDoPrimeiroAcesso(`${caminho}${req.nextUrl.search}`), req.url),
      )
    }
    return
  }

  if (decisao.tipo === 'negar-api') {
    return NextResponse.json({ erro: 'Acesso restrito a contas @ctcea.org.br' }, { status: 403 })
  }
  const destino = new URL('/acesso-negado', req.url)
  destino.searchParams.set('motivo', decisao.motivo)
  return NextResponse.redirect(destino)
})

export const config = {
  matcher: [
    // tudo, exceto internos do Next e arquivos estáticos
    '/((?!_next|[^?]*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|css|js|woff2?)).*)',
    '/(api|trpc)(.*)',
  ],
}
