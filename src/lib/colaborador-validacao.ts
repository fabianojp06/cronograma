/**
 * Validação do nome com que alguém se cadastra como colaborador.
 *
 * O nome não é rótulo de tela: é ele que vai para `Projeto.responsavel` quando
 * um WIN é promovido, e é por ele que o relatório por responsável agrupa. Duas
 * grafias da mesma pessoa ("Fabiano" e "Fabiano P.") viram dois responsáveis
 * distintos no painel, e ninguém percebe — some metade dos projetos de alguém
 * de uma linha do relatório sem nenhum erro aparecer.
 *
 * Por isso a tela sugere os nomes que já existem em `Projeto.responsavel`, e
 * por isso a comparação aqui ignora acento, caixa e espaço repetido.
 */

const TAMANHO_MINIMO = 2
const TAMANHO_MAXIMO = 120

export type ErroNomeColaborador =
  | 'VAZIO'
  | 'CURTO'
  | 'LONGO'
  | 'SEM_LETRA'

export const MENSAGEM_ERRO_NOME: Record<ErroNomeColaborador, string> = {
  VAZIO: 'Digite seu nome.',
  CURTO: `O nome precisa de pelo menos ${TAMANHO_MINIMO} caracteres.`,
  LONGO: `O nome pode ter no máximo ${TAMANHO_MAXIMO} caracteres.`,
  SEM_LETRA: 'O nome precisa ter letras.',
}

/**
 * Normaliza espaços sem mexer em acento nem em caixa: o nome é gravado como a
 * pessoa escreveu, porque é assim que ele aparece no plano de ação.
 */
export function normalizarNome(bruto: string): string {
  return bruto.replace(/\s+/g, ' ').trim()
}

export function validarNomeColaborador(
  bruto: unknown,
): { ok: true; nome: string } | { ok: false; erro: ErroNomeColaborador } {
  if (typeof bruto !== 'string') return { ok: false, erro: 'VAZIO' }

  const nome = normalizarNome(bruto)
  if (nome === '') return { ok: false, erro: 'VAZIO' }
  if (nome.length < TAMANHO_MINIMO) return { ok: false, erro: 'CURTO' }
  if (nome.length > TAMANHO_MAXIMO) return { ok: false, erro: 'LONGO' }
  if (!/\p{L}/u.test(nome)) return { ok: false, erro: 'SEM_LETRA' }

  return { ok: true, nome }
}

/**
 * Chave para reconhecer que dois nomes são a mesma pessoa.
 *
 * Só serve para COMPARAR — nunca para gravar. Ignora acento, caixa e espaço
 * repetido, de modo que "fabiano  josé" reconheça o "Fabiano José" que o
 * importador já criou, em vez de esbarrar no índice único de `nome` com uma
 * mensagem que não ajuda ninguém.
 */
export function chaveDoNome(nome: string): string {
  return normalizarNome(nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
