/**
 * Menus do sistema, num módulo puro: o cabeçalho, o tour guiado e o teste do
 * manual precisam enxergar as MESMAS listas. Item novo exige entrada no manual
 * e passo no tour (os testes cobram).
 *
 * Dois menus, de propósito: o de TRABALHO é de todos os perfis; a ADMINISTRAÇÃO
 * é uma área à parte, que só o administrador vê. Esconder o item é conforto —
 * quem garante a permissão são as Server Actions e as próprias telas.
 */
export type ItemDeMenu = { href: string; rotulo: string }
export type GrupoDoMenu = { id: string; rotulo: string; itens: readonly ItemDeMenu[] }

/** O Painel é o único item solto: é a casa do sistema. */
export const PAINEL: ItemDeMenu = { href: '/', rotulo: 'Painel' }

/**
 * Os grupos do menu de trabalho. São poucos de propósito (um olhar basta):
 * Trabalho (o plano), Pessoas (o que é meu e da equipe) e Análise (ler e
 * apresentar os números). Item novo entra no grupo em que a pessoa o procuraria.
 */
export const GRUPOS_DO_MENU: readonly GrupoDoMenu[] = [
  {
    id: 'trabalho',
    rotulo: 'Trabalho',
    itens: [
      { href: '/projetos', rotulo: 'Projetos' },
      { href: '/priorizacao', rotulo: 'Priorização' },
      { href: '/modelos', rotulo: 'Modelos' },
    ],
  },
  {
    id: 'pessoas',
    rotulo: 'Pessoas',
    itens: [
      { href: '/meus-projetos', rotulo: 'Meus projetos' },
      { href: '/minhas-acoes', rotulo: 'Minhas ações' },
      { href: '/wins', rotulo: 'Card WIN' },
      { href: '/wins/equipe', rotulo: 'Equipe' },
    ],
  },
  {
    id: 'analise',
    rotulo: 'Análise',
    itens: [
      { href: '/dashboards', rotulo: 'Dashboards' },
      { href: '/reuniao', rotulo: 'Reunião' },
    ],
  },
]

/** Todos os itens do menu de trabalho, em linha (testes, manual e tour partem desta lista). */
export const MENU: readonly ItemDeMenu[] = [PAINEL, ...GRUPOS_DO_MENU.flatMap((g) => g.itens)]

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
    href: '/administracao/lixeira',
    rotulo: 'Lixeira',
    descricao: 'Projetos excluídos, com a opção de restaurar.',
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

/** O grupo de administração do cabeçalho: a visão geral e as ferramentas. Só o administrador vê. */
export const GRUPO_ADMINISTRACAO: GrupoDoMenu = {
  id: 'administracao',
  rotulo: 'Administração',
  itens: [{ href: ROTA_ADMINISTRACAO, rotulo: 'Visão geral' }, ...MENU_ADMIN.map(({ href, rotulo }) => ({ href, rotulo }))],
}

/** Identificador do alvo do tour para o botão de um grupo (`data-tour`). */
export function alvoDoGrupo(id: string): string {
  return `grupo-${id}`
}

/**
 * O item do menu que corresponde à página atual: o de endereço MAIS LONGO que
 * a contém (`/priorizacao/pesos` é da Administração, não da Priorização; `/`
 * só vale na raiz). `null` quando a página não é de nenhum item.
 */
export function itemAtivo(caminho: string, grupos: readonly GrupoDoMenu[]): ItemDeMenu | null {
  const todos = [PAINEL, ...grupos.flatMap((g) => g.itens)]
  const candidatos = todos.filter((i) =>
    i.href === '/' ? caminho === '/' : caminho === i.href || caminho.startsWith(`${i.href}/`),
  )
  return candidatos.sort((a, b) => b.href.length - a.href.length)[0] ?? null
}

/** O grupo que contém a página atual (para destacá-lo no cabeçalho), ou `null`. */
export function grupoAtivo(caminho: string, grupos: readonly GrupoDoMenu[]): string | null {
  const item = itemAtivo(caminho, grupos)
  if (!item) return null
  return grupos.find((g) => g.itens.some((i) => i.href === item.href))?.id ?? null
}
