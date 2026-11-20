/**
 * Manual do usuário — tipos e regras puras. O conteúdo vive em
 * `manual-conteudo.ts`, e `manual.test.ts` impede que uma tela ou item de menu
 * novo fique sem manual (é isso que faz o manual "se atualizar" a cada
 * funcionalidade: esquecer quebra o CI).
 */

import { correspondeABusca } from './paginacao'

export type GrupoManual =
  | 'Começando'
  | 'Projetos e ações'
  | 'Meu trabalho'
  | 'Card WIN'
  | 'Análise'
  | 'Administração'

export const GRUPOS_MANUAL: readonly GrupoManual[] = [
  'Começando',
  'Projetos e ações',
  'Meu trabalho',
  'Card WIN',
  'Análise',
  'Administração',
]

export type PerfilManual = 'todos' | 'editor' | 'administrador'

export const ROTULO_PERFIL: Record<PerfilManual, string> = {
  todos: 'Todos os perfis',
  editor: 'Colaborador e Administrador',
  administrador: 'Só administrador',
}

export type SecaoManual = {
  /** Âncora (`/manual#id`): estável, nunca reaproveitada. */
  id: string
  grupo: GrupoManual
  titulo: string
  /** Uma frase: para que serve. */
  resumo: string
  /** Quem pode usar. */
  perfil: PerfilManual
  /** Rotas (padrão do Next, ex.: `/projetos/[id]`) que esta seção explica. */
  rotas: readonly string[]
  /** Como fazer, em ordem. */
  passos: readonly string[]
  /** Regras e dicas que evitam erro. */
  dicas?: readonly string[]
  /** Data (aaaa-mm-dd) em que a funcionalidade entrou — alimenta "Novidades". */
  desde: string
  /** Outras palavras para a busca. */
  palavras?: readonly string[]
}

export type TermoGlossario = { termo: string; definicao: string }

/** Rotas sem seção própria no manual, com o motivo (o teste exige a justificativa). */
export const ROTAS_SEM_MANUAL: Record<string, string> = {
  '/manual': 'o próprio manual',
}

export function buscarNoManual(
  secoes: readonly SecaoManual[],
  busca: string | null,
): SecaoManual[] {
  return secoes.filter((s) =>
    correspondeABusca(busca, [
      s.titulo,
      s.resumo,
      ...s.passos,
      ...(s.dicas ?? []),
      ...(s.palavras ?? []),
    ]),
  )
}

export function agruparPorGrupo(
  secoes: readonly SecaoManual[],
): { grupo: GrupoManual; secoes: SecaoManual[] }[] {
  return GRUPOS_MANUAL.map((grupo) => ({
    grupo,
    secoes: secoes.filter((s) => s.grupo === grupo),
  })).filter((g) => g.secoes.length > 0)
}

/** As funcionalidades mais recentes primeiro (empate: ordem do manual). */
export function novidades(secoes: readonly SecaoManual[], limite = 6): SecaoManual[] {
  return [...secoes]
    .map((s, i) => ({ s, i }))
    .sort((a, b) => (a.s.desde < b.s.desde ? 1 : a.s.desde > b.s.desde ? -1 : a.i - b.i))
    .slice(0, limite)
    .map(({ s }) => s)
}

/** Rota do Next (`/projetos/[id]`) a partir do caminho do arquivo `page.tsx`. */
export function rotaDoArquivo(caminhoRelativoAApp: string): string {
  const semArquivo = caminhoRelativoAApp.replace(/\\/g, '/').replace(/\/?page\.tsx$/, '')
  return `/${semArquivo}`.replace(/^\/\//, '/')
}

/** O que o perfil vê: quem não administra não vê as seções "só administrador". */
export function secoesParaPerfil(
  secoes: readonly SecaoManual[],
  administrador: boolean,
): SecaoManual[] {
  return secoes.filter((s) => administrador || s.perfil !== 'administrador')
}
