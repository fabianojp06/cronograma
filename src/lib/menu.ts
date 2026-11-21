/**
 * Menus do sistema, num módulo puro: o cabeçalho, o tour guiado e o teste do
 * manual precisam enxergar as MESMAS listas. Item novo exige entrada no manual
 * e passo no tour (os testes cobram).
 *
 * Dois menus, de propósito: o de TRABALHO é de todos os perfis; a ADMINISTRAÇÃO
 * é uma área à parte, que só o administrador vê. Esconder o item é conforto —
 * quem garante a permissão são as Server Actions e as próprias telas.
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
  { href: '/reuniao', rotulo: 'Reunião' },
  { href: '/modelos', rotulo: 'Modelos' },
] as const

/** Página de entrada da área de administração. */
export const ROTA_ADMINISTRACAO = '/administracao'

/** O que a área de administração oferece (e o que a página dela lista). */
export const MENU_ADMIN = [
  {
    href: '/colaboradores',
    rotulo: 'Colaboradores',
    descricao: 'Perfis, área, e-mail e situação de cada pessoa.',
  },
  {
    href: '/resumo-semanal',
    rotulo: 'Resumo semanal',
    descricao: 'O que foi concluído, o que atrasou e o que vence nos próximos 7 dias, por equipe.',
  },
  {
    href: '/priorizacao/pesos',
    rotulo: 'Pesos da priorização',
    descricao: 'Os pesos dos critérios da matriz Benefício x Esforço.',
  },
  {
    href: '/administracao/sistema',
    rotulo: 'Painel do sistema',
    descricao: 'Banco, erros por origem, aviso semanal e volume de dados.',
  },
  {
    href: '/administracao/erros',
    rotulo: 'Registro de erros',
    descricao: 'Os erros registrados nos últimos 30 dias.',
  },
] as const

/** Identificador do alvo do tour para um item do menu (`data-tour`). */
export function alvoDoMenu(href: string): string {
  return `menu${href === '/' ? '-painel' : href.replaceAll('/', '-')}`
}

/** O item de administração `href` está ativo na página `caminho`? */
export function itemAdminAtivo(href: string, caminho: string): boolean {
  return caminho === href
}
