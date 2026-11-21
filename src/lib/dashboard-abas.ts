/**
 * Abas e resumo de atenção da tela `/dashboards` — módulo puro.
 *
 * A tela tinha 17 relatórios empilhados numa página só, todos com o mesmo peso.
 * Agora cada GRUPO do catálogo é uma aba (`?aba=prazos`), e no topo fica um
 * resumo do que pede ação. A aba vive na URL: continua linkável e funciona sem
 * JavaScript, como o resto da tela. `todas` mostra tudo de uma vez — é o que
 * a impressão (PDF) usa.
 */

import { GRUPOS_RELATORIO, relatoriosDoGrupo, type GrupoRelatorio } from './dashboard-catalogo'

export type AbaDashboard = GrupoRelatorio | 'TODAS'

const SLUG: Record<AbaDashboard, string> = {
  GESTAO: 'gestao',
  PANORAMA: 'panorama',
  DISTRIBUICAO: 'distribuicao',
  PRAZOS: 'prazos',
  TEMPO: 'tempo',
  QUALIDADE: 'qualidade',
  WINS: 'wins',
  AUDITORIA: 'auditoria',
  TODAS: 'todas',
}

export const ABA_PADRAO: AbaDashboard = 'GESTAO'

/** Aba desconhecida ou ausente cai na aba padrão (Gestão): a query string vem do usuário. */
export function lerAba(bruto: string | string[] | undefined): AbaDashboard {
  const valor = Array.isArray(bruto) ? bruto[0] : bruto
  const achada = (Object.keys(SLUG) as AbaDashboard[]).find((aba) => SLUG[aba] === valor)
  return achada ?? ABA_PADRAO
}

export function slugDaAba(aba: AbaDashboard): string {
  return SLUG[aba]
}

/** Uma seção de `grupo` aparece quando a aba é a dele ou é `todas`. */
export function abaMostra(aba: AbaDashboard, grupo: GrupoRelatorio): boolean {
  return aba === 'TODAS' || aba === grupo
}

/** As abas na ordem do catálogo, mais `todas` no fim, com quantos relatórios cada uma tem. */
export function listarAbas(
  rotuloDoGrupo: Record<GrupoRelatorio, string>,
): { aba: AbaDashboard; rotulo: string; relatorios: number }[] {
  const grupos = GRUPOS_RELATORIO.map((grupo) => ({
    aba: grupo as AbaDashboard,
    rotulo: rotuloDoGrupo[grupo],
    relatorios: relatoriosDoGrupo(grupo).length,
  })).filter((item) => item.relatorios > 0)
  const total = grupos.reduce((soma, item) => soma + item.relatorios, 0)
  return [...grupos, { aba: 'TODAS', rotulo: 'Todas', relatorios: total }]
}

/** Endereço de uma aba mantendo os filtros e o período que já estão na tela. */
export function hrefDaAba(
  aba: AbaDashboard,
  parametros: Readonly<Record<string, string>>,
  ancora?: string,
): string {
  const q = new URLSearchParams(parametros)
  q.delete('aba')
  q.delete('pagina')
  if (aba !== ABA_PADRAO) q.set('aba', SLUG[aba])
  const texto = q.toString()
  return `/dashboards${texto === '' ? '' : `?${texto}`}${ancora ? `#${ancora}` : ''}`
}

export type ItemAtencao = {
  id: string
  rotulo: string
  valor: number
  /** O que o número significa, em uma linha. */
  detalhe: string
  /** `alerta` = pede ação agora (cor de atraso); `neutro` = informação. */
  tom: 'alerta' | 'neutro'
  aba: AbaDashboard
  ancora: string
}

/**
 * Os cinco números que respondem "o que pede ação?". Cada um leva à aba e à
 * seção onde está o detalhe. Só entra `alerta` quando o número é maior que zero:
 * zero é boa notícia e não deve ter a cor de atraso.
 */
export function resumoDeAtencao(entrada: {
  acoesAtrasadas: number
  vencendoEm7Dias: number
  projetosSemAcoes: number
  winsParaPromover: number
  replanejamentos: number
}): ItemAtencao[] {
  const alerta = (n: number): 'alerta' | 'neutro' => (n > 0 ? 'alerta' : 'neutro')
  return [
    {
      id: 'atrasadas',
      rotulo: 'Ações atrasadas',
      valor: entrada.acoesAtrasadas,
      detalhe: 'prazo previsto vencido, sem conclusão',
      tom: alerta(entrada.acoesAtrasadas),
      aba: 'PRAZOS',
      ancora: 'ranking-atrasos',
    },
    {
      id: 'vencendo',
      rotulo: 'Vencem em 7 dias',
      valor: entrada.vencendoEm7Dias,
      detalhe: 'ações abertas com prazo na próxima semana',
      tom: 'neutro',
      aba: 'PRAZOS',
      ancora: 'proximos-vencimentos',
    },
    {
      id: 'sem-acoes',
      rotulo: 'Projetos sem ações',
      valor: entrada.projetosSemAcoes,
      detalhe: 'não têm progresso a medir',
      tom: alerta(entrada.projetosSemAcoes),
      aba: 'QUALIDADE',
      ancora: 'higiene-dados',
    },
    {
      id: 'wins',
      rotulo: 'WINs para promover',
      valor: entrada.winsParaPromover,
      detalhe: 'três semanas: devem ir ao plano de ação',
      tom: alerta(entrada.winsParaPromover),
      aba: 'WINS',
      ancora: 'wins-reincidentes',
    },
    {
      id: 'replanejamentos',
      rotulo: 'Replanejamentos',
      valor: entrada.replanejamentos,
      detalhe: 'mudanças de data prevista nas últimas 500 alterações',
      tom: 'neutro',
      aba: 'AUDITORIA',
      ancora: 'replanejamentos',
    },
  ]
}
