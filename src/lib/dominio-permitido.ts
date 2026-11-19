/**
 * Quem pode usar o sistema: só contas cujo e-mail PRINCIPAL, e verificado, é do
 * domínio da CTCEA — módulo puro.
 *
 * O Clerk só diz que a pessoa tem uma conta; sem esta regra, qualquer um com um
 * e-mail qualquer cria a conta e, com o link de um projeto, entra. A configuração
 * de "lista de permissão" do próprio Clerk impede a criação; esta regra confere
 * de novo na entrada, porque contas já criadas continuam existindo lá.
 *
 * - **Domínio exato.** `ana@ctcea.org.br` entra; `ana@ctcea.org.br.outro.com`,
 *   `ana@sub.ctcea.org.br` e `ana@meuctcea.org.br` não.
 * - **E-mail principal e verificado.** Um endereço ctcea.org.br adicionado como
 *   secundário, ou ainda não confirmado, não vale: bastaria cadastrá-lo na conta
 *   de qualquer e-mail para passar.
 */

export const DOMINIO_PERMITIDO = 'ctcea.org.br'

export type EmailDaConta = { endereco: string; verificado: boolean }

export function emailNoDominio(endereco: string, dominio: string = DOMINIO_PERMITIDO): boolean {
  const limpo = endereco.trim().toLowerCase()
  const arroba = limpo.indexOf('@')
  // Exatamente uma arroba, parte local não vazia e sem espaço.
  if (arroba <= 0 || arroba !== limpo.lastIndexOf('@') || /\s/.test(limpo)) return false
  return limpo.slice(arroba + 1) === dominio
}

/**
 * Exceções por endereço (`EMAILS_EXCECAO`, separados por vírgula): vazio por
 * padrão. Existem para destravar o acesso de alguém que o domínio não alcança
 * sem mexer no código — é decisão consciente de quem administra a Vercel.
 */
export function lerExcecoes(bruto: string | undefined): string[] {
  return (bruto ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e !== '')
}

export function contaAutorizada(
  principal: EmailDaConta | null,
  excecoes: readonly string[] = [],
): boolean {
  if (principal === null || !principal.verificado) return false
  return emailNoDominio(principal.endereco) || excecoes.includes(principal.endereco.trim().toLowerCase())
}

export type MotivoNegado = 'dominio' | 'verificacao'

export type DecisaoDeAcesso =
  | { tipo: 'permitir' }
  | { tipo: 'negar-pagina'; motivo: MotivoNegado }
  | { tipo: 'negar-api'; motivo: MotivoNegado }

/**
 * O que fazer com uma requisição de conta autenticada. `verificacao` quer dizer
 * que não foi possível conferir o e-mail (Clerk fora do ar): na dúvida, nega —
 * liberar por falha da checagem abriria a porta justamente quando ela quebra.
 */
export function decidirAcesso(
  veredito: 'autorizada' | MotivoNegado,
  caminho: string,
): DecisaoDeAcesso {
  if (veredito === 'autorizada') return { tipo: 'permitir' }
  const api = caminho === '/api' || caminho.startsWith('/api/')
  return { tipo: api ? 'negar-api' : 'negar-pagina', motivo: veredito }
}
