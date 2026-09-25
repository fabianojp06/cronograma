/**
 * Regras de administração de colaboradores — desativar, reativar e renomear.
 *
 * Módulo puro. A parte delicada não é a validação do nome (essa já existe em
 * `colaborador-validacao`), é o que renomear SIGNIFICA: `Colaborador.nome` já
 * foi copiado para `Projeto.responsavel` em toda promoção de WIN. Renomear sem
 * tratar isso parte a pessoa em duas no relatório por responsável — o mesmo
 * defeito que o auto-cadastro veio evitar, chegando pela outra ponta.
 */

import { chaveDoNome, validarNomeColaborador } from './colaborador-validacao'

export type ErroAdmin =
  | 'NOME_INVALIDO'
  | 'NOME_EM_USO'
  | 'NAO_ENCONTRADO'
  | 'AUTO_DESATIVACAO'

export const MENSAGEM_ERRO_ADMIN: Record<ErroAdmin, string> = {
  NOME_INVALIDO: 'Nome inválido.',
  NOME_EM_USO: 'Já existe outro colaborador com esse nome.',
  NAO_ENCONTRADO: 'Colaborador não encontrado.',
  AUTO_DESATIVACAO:
    'Você não pode desativar a si mesmo — perderia o acesso ao próprio card. ' +
    'Peça para outra pessoa fazer isso.',
}

export type Cadastrado = { id: string; nome: string }

/**
 * Decide se um nome novo pode ser gravado para `id`.
 *
 * O conflito é medido por `chaveDoNome` (sem acento, sem caixa), a MESMA regra
 * que o auto-cadastro e o importador usam. Comparar por igualdade exata deixaria
 * criar "Fabiano Jose" ao lado de "Fabiano José" — duas pessoas no relatório,
 * sem erro nenhum aparecer.
 *
 * Trocar só acento ou caixa do próprio nome é permitido: é justamente a
 * correção que esta tela existe para fazer.
 */
export function validarRenomear(
  cadastrados: readonly Cadastrado[],
  id: string,
  nomeBruto: unknown,
): { ok: true; nome: string; mudou: boolean } | { ok: false; erro: ErroAdmin } {
  const validacao = validarNomeColaborador(nomeBruto)
  if (!validacao.ok) return { ok: false, erro: 'NOME_INVALIDO' }

  const atual = cadastrados.find((c) => c.id === id)
  if (!atual) return { ok: false, erro: 'NAO_ENCONTRADO' }

  const chave = chaveDoNome(validacao.nome)
  const conflito = cadastrados.some((c) => c.id !== id && chaveDoNome(c.nome) === chave)
  if (conflito) return { ok: false, erro: 'NOME_EM_USO' }

  return { ok: true, nome: validacao.nome, mudou: validacao.nome !== atual.nome }
}

/**
 * Desativar a si mesmo é sempre recusado.
 *
 * Quem faz isso cai na tela "Quem é você?" sem conseguir escolher a si mesmo —
 * a lista só oferece colaboradores ativos e sem dono — e fica sem acesso ao
 * próprio card até alguém reativá-lo pelo banco. É um pé no próprio pé que não
 * tem por que ser possível.
 */
export function podeDesativar(
  idAlvo: string,
  idDeQuemPede: string | null,
): { ok: true } | { ok: false; erro: ErroAdmin } {
  return idAlvo === idDeQuemPede ? { ok: false, erro: 'AUTO_DESATIVACAO' } : { ok: true }
}
