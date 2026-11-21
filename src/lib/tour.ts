/**
 * Tour guiado do cabeçalho — módulo puro (passos e geometria).
 *
 * O tour destaca itens do cabeçalho (presentes em TODAS as telas, então ele
 * funciona de qualquer página) por `data-tour`. Passo cujo alvo não existe na
 * tela (menu escondido, tela estreita) aparece centralizado, sem destaque.
 * Grupo novo no menu (ou o Painel) exige um passo aqui: `tour.test.ts` cobra.
 */

import { alvoDoGrupo, alvoDoMenu } from './menu'

export type PassoTour = {
  alvo: string | null
  titulo: string
  texto: string
  /** Só quem administra vê este passo. */
  somenteAdmin?: boolean
}

export const CHAVE_TOUR_VISTO = 'ctcea-tour-visto'

export const PASSOS_TOUR: readonly PassoTour[] = [
  {
    alvo: null,
    titulo: 'Bem-vindo ao Cronograma CTCEA',
    texto:
      'Este sistema substitui as planilhas de plano de ação e de cronograma. Em um minuto, veja onde fica cada coisa. Você pode sair a qualquer momento com Esc e refazer o tour em "Ajuda e preferências".',
  },
  {
    alvo: alvoDoMenu('/'),
    titulo: 'Painel',
    texto: 'A visão consolidada de todos os projetos: indicadores, atrasos e a lista com filtros e busca.',
  },
  {
    alvo: alvoDoGrupo('trabalho'),
    titulo: 'Trabalho',
    texto:
      'O plano em si. Projetos: a lista, o cronograma (Gantt) de cada um, as ações e o realizado. Priorização: a matriz Benefício × Esforço que recomenda a ordem. Modelos: moldes para criar projetos que se repetem.',
  },
  {
    alvo: alvoDoGrupo('pessoas'),
    titulo: 'Pessoas',
    texto:
      'O que é seu e da equipe. Meus projetos e Minhas ações: o que está sob a sua responsabilidade (a tela do dia a dia). Card WIN: o seu compromisso semanal, de até 3 itens. Equipe: os cards de todos, para a daily.',
  },
  {
    alvo: alvoDoGrupo('analise'),
    titulo: 'Análise',
    texto:
      'Ler e apresentar os números. Dashboards: relatórios por abas, com a aba Gestão para diretoria e gerência. Reunião: telas grandes para projetar na daily, com atrasos, vencimentos, replanejamentos e riscos.',
  },
  {
    alvo: alvoDoGrupo('administracao'),
    titulo: 'Administração',
    texto: 'Área só de quem administra: colaboradores e perfis, pesos da priorização, resumo semanal, lixeira de projetos, painel do sistema e registro de erros.',
    somenteAdmin: true,
  },
  {
    alvo: 'sino',
    titulo: 'Notificações',
    texto: 'O sino avisa quando alguém comenta uma ação sua, marca você, pede ou decide uma liberação de início, ou atribui um risco a você.',
  },
  {
    alvo: 'ajuda',
    titulo: 'Ajuda e preferências',
    texto: 'Aqui ficam o Manual (passo a passo de cada tela e guia dos relatórios), este tour e a escolha do tema claro ou escuro.',
  },
]

/** Os passos do tour para o perfil: quem não administra não vê os de administração. */
export function passosDoTour(administrador: boolean): readonly PassoTour[] {
  return PASSOS_TOUR.filter((p) => administrador || !p.somenteAdmin)
}

export type Retangulo = { top: number; left: number; width: number; height: number }

/**
 * Onde pôr o balão: abaixo do alvo (ou acima, se não couber), alinhado à
 * esquerda do alvo e sempre dentro da tela. Sem alvo, centralizado.
 */
export function posicionarBalao(
  alvo: Retangulo | null,
  tela: { largura: number; altura: number },
  balao: { largura: number; altura: number },
  folga = 12,
): { top: number; left: number } {
  const dentro = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max))
  if (alvo === null) {
    return {
      top: Math.max(folga, (tela.altura - balao.altura) / 2),
      left: Math.max(folga, (tela.largura - balao.largura) / 2),
    }
  }
  const abaixo = alvo.top + alvo.height + folga
  const cabeAbaixo = abaixo + balao.altura <= tela.altura - folga
  const top = cabeAbaixo ? abaixo : Math.max(folga, alvo.top - balao.altura - folga)
  return {
    top,
    left: dentro(alvo.left, folga, Math.max(folga, tela.largura - balao.largura - folga)),
  }
}
