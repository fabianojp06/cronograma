/**
 * Gancho do Next para erros não tratados (renderização, rotas). Os erros que as
 * Server Actions já capturam e transformam em mensagem passam por
 * `registrarFalha` nos próprios `catch`.
 */
export async function onRequestError(
  erro: unknown,
  requisicao: { path: string; method: string },
  contexto: { routeType: string },
) {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  const { registrarFalha } = await import('@/lib/registrar-erro')
  const digest =
    typeof erro === 'object' && erro !== null && 'digest' in erro
      ? String((erro as { digest: unknown }).digest)
      : null
  await registrarFalha(`Erro em ${requisicao.method} (${contexto.routeType})`, erro, {
    rota: requisicao.path,
    digest,
  })
}
