/**
 * Modelos de projeto iniciais — dados puros, carregados por
 * `scripts/carregar-modelos-iniciais.ts`.
 *
 * Rascunhos aprovados pelo administrador a partir de senso comum, NÃO da
 * rotina medida da CTCEA: servem de ponto de partida e podem ser excluídos e
 * recriados. `inicioDiasUteis` conta a partir do início do projeto (dia 0) e
 * `duracaoDiasUteis` conta as duas pontas, como no resto do sistema. Equipe,
 * natureza e categoria ficam em aberto de propósito (quem usa define no projeto).
 */

import { FASES_DMAIC } from './dmaic'
import type { ItemDoModelo } from './modelo-projeto'

export type ModeloInicial = {
  nome: string
  descricao: string
  /** Dias úteis do início da primeira ação ao término da última (conferido em teste). */
  diasUteisTotais: number
  itens: ItemDoModelo[]
}

/** `[descrição, início, duração, macroetapa?]`, numerado na ordem. */
function itens(linhas: readonly (readonly [string, number, number, string?])[]): ItemDoModelo[] {
  return linhas.map(([descricao, inicioDiasUteis, duracaoDiasUteis, macroetapa], i) => ({
    ordem: i + 1,
    descricao,
    inicioDiasUteis,
    duracaoDiasUteis,
    ...(macroetapa ? { macroetapa } : {}),
  }))
}

/** Identifica quem criou os modelos carregados pelo script: só administrador os exclui. */
export const CRIADO_POR_SISTEMA = 'sistema'

export const MODELOS_INICIAIS: readonly ModeloInicial[] = [
  {
    nome: 'Ciclo orçamentário anual',
    descricao:
      'Do levantamento das premissas à divulgação do orçamento aprovado. Rascunho inicial: ajuste os passos e as durações à rotina real.',
    diasUteisTotais: 41,
    itens: itens([
      ['Levantar premissas e diretrizes do exercício', 0, 5],
      ['Coletar demandas e projeções de cada área', 5, 10],
      ['Consolidar a proposta orçamentária', 15, 8],
      ['Revisar com as áreas e ajustar', 23, 5],
      ['Validar com a diretoria', 28, 3],
      ['Aprovação formal na instância competente', 31, 5],
      ['Cadastrar o orçamento aprovado nos sistemas', 36, 3],
      ['Divulgar às áreas e iniciar o acompanhamento', 39, 2],
    ]),
  },
  {
    nome: 'Prestação de contas e relatório anual',
    descricao:
      'Da definição do escopo ao envio e arquivamento da prestação de contas. Rascunho inicial: confira os prazos legais e o parecer aplicável.',
    diasUteisTotais: 46,
    itens: itens([
      ['Definir escopo, prazos legais e responsáveis', 0, 3],
      ['Reunir documentos e evidências financeiras', 3, 12],
      ['Reunir indicadores e resultados das áreas', 3, 12],
      ['Elaborar o relatório de atividades', 15, 10],
      ['Elaborar as demonstrações e o relatório financeiro', 15, 10],
      ['Revisão interna e conferência', 25, 5],
      ['Parecer da auditoria ou do conselho fiscal (se aplicável)', 30, 8],
      ['Ajustes após o parecer', 38, 4],
      ['Aprovação final', 42, 2],
      ['Envio ao órgão, publicação e arquivamento', 44, 2],
    ]),
  },
  {
    nome: 'Projeto de desenvolvimento de sistema',
    descricao:
      'Do levantamento de requisitos ao acompanhamento pós-implantação, em duas entregas. Rascunho inicial: adapte ao ciclo de desenvolvimento da equipe.',
    diasUteisTotais: 74,
    itens: itens([
      ['Levantamento de requisitos', 0, 8],
      ['Validação dos requisitos com o solicitante', 8, 3],
      ['Desenho da solução e da arquitetura', 11, 5],
      ['Planejamento das entregas (backlog)', 11, 3],
      ['Desenvolvimento, 1ª entrega', 16, 15],
      ['Desenvolvimento, 2ª entrega', 31, 15],
      ['Testes e correções', 46, 8],
      ['Homologação com o usuário', 54, 5],
      ['Preparar a implantação e a documentação', 54, 5],
      ['Treinar os usuários', 59, 3],
      ['Implantação (go-live)', 62, 2],
      ['Acompanhamento pós-implantação', 64, 10],
    ]),
  },
  {
    nome: 'Onboarding de colaborador',
    descricao:
      'Da documentação admissional à avaliação de 90 dias. A data de início do projeto é a de admissão. Rascunho inicial: ajuste à rotina da GRH.',
    diasUteisTotais: 65,
    itens: itens([
      ['Providenciar a documentação admissional', 0, 3],
      ['Providenciar equipamentos e acessos (e-mail e sistemas)', 0, 5],
      ['Definir o plano dos primeiros 90 dias e o mentor', 1, 3],
      ['Recepção e apresentação à equipe', 5, 1],
      ['Treinamento institucional (CTCEA, políticas, sistemas)', 5, 4],
      ['Treinamento da função, com o mentor', 9, 10],
      ['Feedback de 30 dias', 21, 1],
      ['Feedback de 60 dias', 42, 1],
      ['Avaliação de experiência de 90 dias', 63, 2],
    ]),
  },
  {
    nome: 'Projeto de melhoria de processo (DMAIC)',
    descricao:
      'As cinco fases do DMAIC (Definir, Medir, Analisar, Melhorar e Controlar), cada uma como macroetapa com as ações típicas. Rascunho inicial: ajuste as ações e as durações ao projeto.',
    diasUteisTotais: 70,
    itens: itens([
      ['Elaborar e aprovar o contrato do projeto (Project Charter)', 0, 5, FASES_DMAIC[0].nome],
      ['Mapear o processo em alto nível (SIPOC)', 3, 3, FASES_DMAIC[0].nome],
      ['Levantar a voz do cliente e definir os CTQs', 3, 4, FASES_DMAIC[0].nome],
      ['Mapear o processo atual', 7, 5, FASES_DMAIC[1].nome],
      ['Validar o sistema de medição e coletar os dados', 12, 8, FASES_DMAIC[1].nome],
      ['Estabelecer a linha de base do indicador', 20, 3, FASES_DMAIC[1].nome],
      ['Levantar as causas potenciais (Ishikawa, 5 Porquês)', 23, 4, FASES_DMAIC[2].nome],
      ['Priorizar as causas por risco (FMEA)', 27, 3, FASES_DMAIC[2].nome],
      ['Validar as causas-raiz com dados', 30, 6, FASES_DMAIC[2].nome],
      ['Gerar e priorizar as soluções', 36, 4, FASES_DMAIC[3].nome],
      ['Elaborar o plano de ação (5W2H)', 40, 3, FASES_DMAIC[3].nome],
      ['Executar o piloto das melhorias', 43, 10, FASES_DMAIC[3].nome],
      ['Comparar o antes e o depois e ampliar a implantação', 53, 6, FASES_DMAIC[3].nome],
      ['Elaborar o plano de controle', 59, 4, FASES_DMAIC[4].nome],
      ['Atualizar os procedimentos (POP) e treinar a operação', 63, 5, FASES_DMAIC[4].nome],
      ['Transferir o processo à operação e encerrar o projeto', 68, 2, FASES_DMAIC[4].nome],
    ]),
  },
]

/** Dias úteis do início da primeira ação ao término da última. */
export function diasUteisDoModelo(modelo: Pick<ModeloInicial, 'itens'>): number {
  return Math.max(...modelo.itens.map((i) => (i.inicioDiasUteis ?? 0) + (i.duracaoDiasUteis ?? 0)))
}
