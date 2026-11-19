/**
 * Quais projetos são "de" uma pessoa, e por quê — módulo puro.
 *
 * Três vínculos, em qualquer combinação:
 * - responsável pelo PROJETO (`Projeto.responsavel`, texto livre);
 * - responsável por AÇÕES do projeto (`Acao.responsavelId`);
 * - APOIO (`Projeto.apoio`, texto livre, às vezes com várias pessoas).
 *
 * Os dois campos de texto são comparados com `chaveDoNome` (sem acento, caixa
 * nem espaço repetido), a mesma regra do cadastro e do importador: "Fabiano José"
 * no projeto casa com "Fabiano Jose" no cadastro. O que não casar fica de fora,
 * sem erro — é texto livre, e adivinhar por sobrenome em comum juntaria
 * homônimos parciais ("Ana Silva" e "Ana Silva Costa").
 */

import { chaveDoNome } from './colaborador-validacao'
import {
  resumirAcoes,
  type AcaoResumivel,
  type ResumoProjeto,
  acaoEstaAtrasada,
} from './projeto-resumo'

export type Vinculo = 'RESPONSAVEL_PROJETO' | 'RESPONSAVEL_ACOES' | 'APOIO'

export const ROTULO_VINCULO: Record<Vinculo, string> = {
  RESPONSAVEL_PROJETO: 'Responsável pelo projeto',
  RESPONSAVEL_ACOES: 'Responsável por ações',
  APOIO: 'Apoio',
}

export type FiltroMeusProjetos = 'todos' | 'respondo' | 'apoio'

export function lerFiltroMeusProjetos(bruto: string | string[] | undefined): FiltroMeusProjetos {
  const valor = Array.isArray(bruto) ? bruto[0] : bruto
  return valor === 'respondo' || valor === 'apoio' ? valor : 'todos'
}

/**
 * Pessoas citadas num campo de texto livre. Separadores: vírgula, ponto e
 * vírgula, barra, "&" e a palavra "e" entre espaços ("Ana e Bruno").
 */
export function pessoasDoCampo(texto: string | null): string[] {
  if (texto === null) return []
  return texto
    .split(/\s*[,;/&]\s*|\s+e\s+/i)
    .map((parte) => parte.trim())
    .filter((parte) => parte !== '')
}

/**
 * O campo cita a pessoa? Vale o campo INTEIRO (um nome com separador dentro,
 * como "Silva e Souza") ou qualquer pedaço dele.
 */
export function campoCitaPessoa(texto: string | null, nome: string): boolean {
  if (texto === null) return false
  const alvo = chaveDoNome(nome)
  if (chaveDoNome(texto) === alvo) return true
  return pessoasDoCampo(texto).some((parte) => chaveDoNome(parte) === alvo)
}

export type ProjetoParaMeusProjetos = {
  id: string
  referencia: string | null
  nome: string
  equipe: string | null
  responsavel: string | null
  apoio: string | null
  acoes: (AcaoResumivel & { responsavelId: string | null })[]
}

export type ProjetoDaPessoa = {
  id: string
  referencia: string | null
  nome: string
  equipe: string | null
  resumo: ResumoProjeto
  vinculos: Vinculo[]
  minhasAcoes: number
  minhasAtrasadas: number
}

export function montarMeusProjetos(
  projetos: readonly ProjetoParaMeusProjetos[],
  pessoa: { id: string; nome: string },
  hoje: Date,
): ProjetoDaPessoa[] {
  const itens: ProjetoDaPessoa[] = []

  for (const projeto of projetos) {
    const minhas = projeto.acoes.filter((a) => a.responsavelId === pessoa.id)
    const vinculos: Vinculo[] = []
    if (campoCitaPessoa(projeto.responsavel, pessoa.nome)) vinculos.push('RESPONSAVEL_PROJETO')
    if (minhas.length > 0) vinculos.push('RESPONSAVEL_ACOES')
    if (campoCitaPessoa(projeto.apoio, pessoa.nome)) vinculos.push('APOIO')
    if (vinculos.length === 0) continue

    itens.push({
      id: projeto.id,
      referencia: projeto.referencia,
      nome: projeto.nome,
      equipe: projeto.equipe,
      resumo: resumirAcoes(projeto.acoes, hoje),
      vinculos,
      minhasAcoes: minhas.length,
      minhasAtrasadas: minhas.filter((a) => acaoEstaAtrasada(a, hoje)).length,
    })
  }

  // O que pede ação primeiro: atrasos MEUS, depois projeto atrasado, depois o resto.
  return itens.sort(
    (a, b) =>
      b.minhasAtrasadas - a.minhasAtrasadas ||
      Number(b.resumo.status === 'ATRASADO') - Number(a.resumo.status === 'ATRASADO') ||
      a.nome.localeCompare(b.nome, 'pt-BR'),
  )
}

/** "Só os que eu respondo" = responsável pelo projeto ou por ações; "apoio" = só apoio. */
export function filtrarMeusProjetos(
  itens: readonly ProjetoDaPessoa[],
  filtro: FiltroMeusProjetos,
): ProjetoDaPessoa[] {
  if (filtro === 'respondo') {
    return itens.filter((i) => i.vinculos.some((v) => v !== 'APOIO'))
  }
  if (filtro === 'apoio') return itens.filter((i) => i.vinculos.includes('APOIO'))
  return [...itens]
}
