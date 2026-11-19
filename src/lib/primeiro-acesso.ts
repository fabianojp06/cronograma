/**
 * Primeiro acesso — módulo puro.
 *
 * Entrar no sistema (conta do Clerk no domínio da CTCEA) e ser um colaborador
 * cadastrado são duas coisas. Sem o cadastro a pessoa não pode ser responsável
 * por ação, não recebe aviso nem notificação e não vê "Meus projetos". Por isso,
 * quem entra sem cadastro passa por `/bem-vindo` antes de qualquer tela, e
 * volta ao endereço que tentou abrir (`?volta=`).
 *
 * Isto é conforto, não segurança: o acesso já foi decidido pelo domínio
 * (`dominio-permitido.ts`). Na dúvida, deixa passar.
 */

export const ROTA_PRIMEIRO_ACESSO = '/bem-vindo'

/** Rotas que nunca são desviadas: a própria tela, login e cadastro, negação e APIs. */
const ISENTAS = [ROTA_PRIMEIRO_ACESSO, '/entrar', '/cadastrar', '/acesso-negado', '/api']

function ehIsenta(caminho: string): boolean {
  return ISENTAS.some((base) => caminho === base || caminho.startsWith(`${base}/`))
}

export type DecisaoPrimeiroAcesso = 'permitir' | 'exigir'

export function decidirPrimeiroAcesso(entrada: {
  temColaborador: boolean
  caminho: string
  metodo: string
}): DecisaoPrimeiroAcesso {
  if (entrada.temColaborador) return 'permitir'
  // Só navegação: um POST (Server Action) a meio caminho não pode virar redirecionamento.
  if (entrada.metodo !== 'GET' && entrada.metodo !== 'HEAD') return 'permitir'
  return ehIsenta(entrada.caminho) ? 'permitir' : 'exigir'
}

/**
 * Caminho interno para voltar depois do cadastro. Só aceita caminho relativo
 * ("/projetos/1"); qualquer outra coisa — endereço completo, "//host",
 * barra invertida — vira "/", para o parâmetro não servir de redirecionamento
 * aberto.
 */
export function caminhoSeguro(volta: string | null | undefined): string {
  if (typeof volta !== 'string') return '/'
  const v = volta.trim()
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('\\')) return '/'
  if (/[\u0000-\u001f]/.test(v)) return '/'
  // O próprio /bem-vindo não é destino: formaria um laço.
  if (v === ROTA_PRIMEIRO_ACESSO || v.startsWith(`${ROTA_PRIMEIRO_ACESSO}/`) || v.startsWith(`${ROTA_PRIMEIRO_ACESSO}?`)) {
    return '/'
  }
  return v
}

export function destinoDoPrimeiroAcesso(caminhoComConsulta: string): string {
  const volta = caminhoSeguro(caminhoComConsulta)
  return volta === '/'
    ? ROTA_PRIMEIRO_ACESSO
    : `${ROTA_PRIMEIRO_ACESSO}?volta=${encodeURIComponent(volta)}`
}

/**
 * `redirect_url` que o Clerk põe na tela de login. Vale um caminho relativo, ou
 * um endereço completo do PRÓPRIO sistema (`urlBase`), que vira caminho relativo.
 * Qualquer outro destino é descartado (`null`).
 */
export function redirectSeguro(
  valor: string | null | undefined,
  urlBase: string | null,
): string | null {
  if (typeof valor !== 'string' || valor.trim() === '') return null
  const v = valor.trim()
  if (v.startsWith('/')) {
    const caminho = caminhoSeguro(v)
    return caminho === '/' && v !== '/' ? null : caminho
  }
  if (urlBase === null) return null
  try {
    const alvo = new URL(v)
    const base = new URL(urlBase)
    if (alvo.origin !== base.origin) return null
    return caminhoSeguro(`${alvo.pathname}${alvo.search}`)
  } catch {
    return null
  }
}
