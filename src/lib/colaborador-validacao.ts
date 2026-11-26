/**
 * Validação do nome com que alguém se cadastra como colaborador.
 *
 * O nome não é rótulo de tela: é ele que vai para `Projeto.responsavel` quando
 * um WIN é promovido, e é por ele que o relatório por responsável agrupa. Duas
 * grafias da mesma pessoa ("Mariana" e "Mariana P.") viram dois responsáveis
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
 * repetido, de modo que "mariana  josé" reconheça o "Mariana José" que o
 * importador já criou, em vez de esbarrar no índice único de `nome` com uma
 * mensagem que não ajuda ninguém.
 */
export function chaveDoNome(nome: string): string {
  return normalizarNome(nome)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

/**
 * Acha, entre os já cadastrados, quem é a mesma pessoa que `nome`.
 *
 * Existe para que **os dois caminhos usem a mesma regra de identidade**: o
 * auto-cadastro da tela e o `scripts/importar-card-win.ts`. Enquanto o script
 * casava por igualdade exata de `nome`, a proteção era unidirecional — a tela
 * reconhecia o que o importador tinha criado, mas não o contrário. Quem se
 * cadastrasse como "Mariana Jose" num banco zerado (sem `Projeto`, logo sem
 * sugestão de grafia) ganhava uma segunda linha quando a planilha com
 * "Mariana José" fosse importada: os cards iam para a linha nova, a conta do
 * Clerk ficava na antiga, e o relatório por responsável contava duas pessoas.
 */
export function encontrarPorNome<T extends { nome: string }>(
  cadastrados: readonly T[],
  nome: string,
): T | undefined {
  const chave = chaveDoNome(nome)
  return cadastrados.find((c) => chaveDoNome(c.nome) === chave)
}
