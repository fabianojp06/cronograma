/**
 * Itens do menu principal. Ficam aqui, num módulo puro, porque o cabeçalho, o
 * tour guiado e o teste do manual precisam enxergar a MESMA lista: item novo no
 * menu exige entrada no manual e passo no tour (os testes cobram).
 */
export const MENU = [
  { href: '/', rotulo: 'Painel' },
  { href: '/projetos', rotulo: 'Projetos' },
  { href: '/dashboards', rotulo: 'Dashboards' },
  { href: '/priorizacao', rotulo: 'Priorização' },
  { href: '/meus-projetos', rotulo: 'Meus projetos' },
  { href: '/minhas-acoes', rotulo: 'Minhas ações' },
  { href: '/wins', rotulo: 'Card WIN' },
  { href: '/wins/equipe', rotulo: 'Equipe' },
  { href: '/colaboradores', rotulo: 'Colaboradores' },
] as const

/** Identificador do alvo do tour para um item do menu (`data-tour`). */
export function alvoDoMenu(href: string): string {
  return `menu${href === '/' ? '-painel' : href.replaceAll('/', '-')}`
}
