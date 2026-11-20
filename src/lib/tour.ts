/**
 * Tour guiado do cabeçalho — módulo puro (passos e geometria).
 *
 * O tour destaca itens do cabeçalho (presentes em TODAS as telas, então ele
 * funciona de qualquer página) por `data-tour`. Passo cujo alvo não existe na
 * tela (menu escondido, tela estreita) aparece centralizado, sem destaque.
 * Item novo no menu exige um passo aqui: `tour.test.ts` cobra.
 */

import { alvoDoMenu } from './menu'

export type PassoTour = { alvo: string | null; titulo: string; texto: string }

export const CHAVE_TOUR_VISTO = 'ctcea-tour-visto'

export const PASSOS_TOUR: readonly PassoTour[] = [
  {
    alvo: null,
    titulo: 'Bem-vindo ao Cronograma CTCEA',
    texto:
      'Este sistema substitui as planilhas de plano de ação e de cronograma. Em um minuto, veja onde fica cada coisa. Você pode sair a qualquer momento com Esc e refazer o tour pelo botão "Tour".',
  },
  {
    alvo: alvoDoMenu('/'),
    titulo: 'Painel',
    texto: 'A visão consolidada de todos os projetos: indicadores, atrasos e a lista com filtros e busca.',
  },
  {
    alvo: alvoDoMenu('/projetos'),
    titulo: 'Projetos',
    texto: 'A lista de projetos. Daqui você abre um projeto para ver o cronograma (Gantt), criar ações e registrar o realizado.',
  },
  {
    alvo: alvoDoMenu('/dashboards'),
    titulo: 'Dashboards',
    texto: 'Relatórios por abas (prazos, evolução, qualidade dos dados, Card WIN, auditoria), com resumo do que pede atenção.',
  },
  {
    alvo: alvoDoMenu('/priorizacao'),
    titulo: 'Priorização',
    texto: 'A matriz Benefício x Esforço, ponderada por GUT, que recomenda a ordem dos projetos.',
  },
  {
    alvo: alvoDoMenu('/meus-projetos'),
    titulo: 'Meus projetos',
    texto: 'Só os projetos em que você é responsável, tem ações ou dá apoio.',
  },
  {
    alvo: alvoDoMenu('/minhas-acoes'),
    titulo: 'Minhas ações',
    texto: 'As ações pelas quais você responde, separadas em atrasadas, em aberto e concluídas. É a tela do dia a dia.',
  },
  {
    alvo: alvoDoMenu('/wins'),
    titulo: 'Card WIN',
    texto: 'O seu compromisso semanal: até 3 WINs por semana. O que se repete por 3 semanas vira ação no plano.',
  },
  {
    alvo: alvoDoMenu('/wins/equipe'),
    titulo: 'Equipe',
    texto: 'Os cards de toda a equipe na semana, para a daily. Somente leitura.',
  },
  {
    alvo: alvoDoMenu('/colaboradores'),
    titulo: 'Colaboradores',
    texto: 'O cadastro de pessoas, com perfil, área e e-mail. Quem administra gerencia por aqui.',
  },
  {
    alvo: 'sino',
    titulo: 'Notificações',
    texto: 'O sino avisa quando alguém comenta uma ação sua, marca você ou pede/decide uma liberação de início.',
  },
  {
    alvo: 'tema',
    titulo: 'Tema claro ou escuro',
    texto: 'Escolha Sistema, Claro ou Escuro. A escolha fica guardada neste navegador.',
  },
  {
    alvo: 'manual',
    titulo: 'Manual',
    texto: 'Passo a passo de cada tela, com busca e a lista de novidades. Dúvida? Comece por ele.',
  },
]

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
