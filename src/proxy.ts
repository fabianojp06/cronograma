import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'
import { ROTAS_PUBLICAS } from '@/lib/rotas-publicas'

const rotaPublica = createRouteMatcher([...ROTAS_PUBLICAS])

/**
 * Proxy (antigo `middleware`) — autentica toda requisição que não caia em
 * `ROTAS_PUBLICAS`. `auth.protect()` redireciona o visitante anônimo para
 * `/entrar`.
 */
export default clerkMiddleware(async (auth, req) => {
  if (!rotaPublica(req)) {
    await auth.protect()
  }
})

export const config = {
  matcher: [
    // tudo, exceto internos do Next e arquivos estáticos
    '/((?!_next|[^?]*\\.(?:ico|png|jpg|jpeg|svg|gif|webp|css|js|woff2?)).*)',
    '/(api|trpc)(.*)',
  ],
}
