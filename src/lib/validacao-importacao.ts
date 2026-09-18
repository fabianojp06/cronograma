import type { ResultadoImportacao } from './importacao-planilha'

/**
 * Conferência pós-importação: o que a planilha original dizia × o que ficou
 * gravado no banco.
 *
 * Módulo **puro**, pelo mesmo motivo de `importacao-planilha.ts`: a regra de
 * conferência fica coberta por teste sem depender do .xlsx real nem do banco.
 * Quem lê o arquivo e consulta o Prisma é `scripts/validar-importacao.ts`.
 *
 * O que se confere, nesta ordem (da contagem grossa para a linha individual):
 * 1. totais — projetos e ações mapeados na planilha × gravados;
 * 2. cobertura das linhas — toda linha de dados da aba ou virou ação, ou está
 *    explicitamente entre as ignoradas (senão alguma linha sumiu em silêncio);
 * 3. projeto a projeto — faltando no banco, sobrando no banco (importado antes
 *    e não mais presente na planilha) e divergência na contagem de ações;
 * 4. ação a ação, dentro do projeto — número faltando/sobrando e descrição
 *    diferente.
 *
 * Nada aqui lança: cada problema vira uma `Divergencia`, para o operador ver o
 * relatório inteiro de uma vez em vez de corrigir um item por execução.
 */

export type AcaoGravada = {
  numero: number
  descricao: string
}

export type ProjetoGravado = {
  referencia: string | null
  nome: string
  acoes: AcaoGravada[]
}

export type TipoDivergencia =
  | 'TOTAL_PROJETOS'
  | 'TOTAL_ACOES'
  | 'LINHAS_NAO_CONTABILIZADAS'
  | 'PROJETO_FALTANDO'
  | 'PROJETO_EXCEDENTE'
  | 'CONTAGEM_ACOES'
  | 'ACAO_FALTANDO'
  | 'ACAO_EXCEDENTE'
  | 'DESCRICAO_DIVERGENTE'

export type Divergencia = {
  tipo: TipoDivergencia
  /** Projeto a que a divergência se refere (chave: referência ou nome). */
  projeto?: string
  mensagem: string
}

export type RelatorioValidacao = {
  ok: boolean
  planilha: { projetos: number; acoes: number; linhasLidas: number; linhasIgnoradas: number }
  banco: { projetos: number; acoes: number }
  divergencias: Divergencia[]
  /** Texto pronto para colar no Log de decisões do PROGRESS.md. */
  resumo: string
}

/**
 * Chave de casamento entre planilha e banco: a `referencia` quando existe (é o
 * identificador do negócio, ex. `CRO-DEP-2026-001`); senão o nome normalizado,
 * porque o PLA-DEP tem blocos sem referência própria.
 */
export function chaveProjeto(projeto: { referencia: string | null; nome: string }): string {
  const referencia = projeto.referencia?.trim()
  if (referencia) return `ref:${referencia.toLowerCase()}`
  return `nome:${normalizarTexto(projeto.nome)}`
}

/** Minúsculas, sem acento e sem espaços repetidos — só para comparar textos. */
export function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function rotulo(projeto: { referencia: string | null; nome: string }): string {
  return projeto.referencia?.trim() ? `${projeto.referencia} — ${projeto.nome}` : projeto.nome
}

export function validarImportacao(
  planilha: ResultadoImportacao,
  banco: ProjetoGravado[],
  /** Total de linhas da aba original, quando disponível (o script informa). */
  totalLinhasAba?: number,
): RelatorioValidacao {
  const divergencias: Divergencia[] = []

  const acoesPlanilha = planilha.projetos.reduce((total, p) => total + p.acoes.length, 0)
  const acoesBanco = banco.reduce((total, p) => total + p.acoes.length, 0)

  if (planilha.projetos.length !== banco.length) {
    divergencias.push({
      tipo: 'TOTAL_PROJETOS',
      mensagem: `Projetos: ${planilha.projetos.length} na planilha × ${banco.length} no banco.`,
    })
  }

  if (acoesPlanilha !== acoesBanco) {
    divergencias.push({
      tipo: 'TOTAL_ACOES',
      mensagem: `Ações: ${acoesPlanilha} na planilha × ${acoesBanco} no banco.`,
    })
  }

  // Toda linha da aba tem de estar explicada: as de cima do cabeçalho, as
  // lidas e as ignoradas. Se a soma não fecha, alguma linha se perdeu em
  // silêncio — que é justamente o risco da conferência por total agregado.
  if (totalLinhasAba !== undefined) {
    const explicadas = planilha.linhaCabecalho + planilha.linhasLidas + planilha.linhasIgnoradas
    if (explicadas !== totalLinhasAba) {
      divergencias.push({
        tipo: 'LINHAS_NAO_CONTABILIZADAS',
        mensagem:
          `Aba tem ${totalLinhasAba} linhas, mas só ${explicadas} estão explicadas ` +
          `(${planilha.linhaCabecalho} até o cabeçalho + ${planilha.linhasLidas} lidas + ${planilha.linhasIgnoradas} ignoradas).`,
      })
    }
  }

  // Cada ação ocupa no máximo duas linhas de dados (Previsto e Realizado). Mais
  // que isso significa linhas distintas colapsadas na mesma ação — descrições
  // repetidas na planilha, que apagariam datas umas das outras.
  if (planilha.linhasLidas > acoesPlanilha * 2) {
    divergencias.push({
      tipo: 'LINHAS_NAO_CONTABILIZADAS',
      mensagem:
        `${planilha.linhasLidas} linhas de dados para ${acoesPlanilha} ações: ` +
        'mais de duas linhas (Previsto/Realizado) caíram na mesma ação.',
    })
  }

  const porChaveBanco = new Map(banco.map((p) => [chaveProjeto(p), p]))
  const vistos = new Set<string>()

  for (const projeto of planilha.projetos) {
    const chave = chaveProjeto(projeto)
    vistos.add(chave)
    const gravado = porChaveBanco.get(chave)

    if (!gravado) {
      divergencias.push({
        tipo: 'PROJETO_FALTANDO',
        projeto: rotulo(projeto),
        mensagem: `"${rotulo(projeto)}" está na planilha mas não foi encontrado no banco.`,
      })
      continue
    }

    if (projeto.acoes.length !== gravado.acoes.length) {
      divergencias.push({
        tipo: 'CONTAGEM_ACOES',
        projeto: rotulo(projeto),
        mensagem: `"${rotulo(projeto)}": ${projeto.acoes.length} ações na planilha × ${gravado.acoes.length} no banco.`,
      })
    }

    const acoesGravadas = new Map(gravado.acoes.map((a) => [a.numero, a]))

    for (const acao of projeto.acoes) {
      const gravada = acoesGravadas.get(acao.numero)
      if (!gravada) {
        divergencias.push({
          tipo: 'ACAO_FALTANDO',
          projeto: rotulo(projeto),
          mensagem: `"${rotulo(projeto)}" ação ${acao.numero} ("${acao.descricao}") não está no banco.`,
        })
        continue
      }
      if (normalizarTexto(gravada.descricao) !== normalizarTexto(acao.descricao)) {
        divergencias.push({
          tipo: 'DESCRICAO_DIVERGENTE',
          projeto: rotulo(projeto),
          mensagem:
            `"${rotulo(projeto)}" ação ${acao.numero}: planilha "${acao.descricao}" × ` +
            `banco "${gravada.descricao}".`,
        })
      }
    }

    const numerosPlanilha = new Set(projeto.acoes.map((a) => a.numero))
    for (const gravada of gravado.acoes) {
      if (!numerosPlanilha.has(gravada.numero)) {
        divergencias.push({
          tipo: 'ACAO_EXCEDENTE',
          projeto: rotulo(projeto),
          mensagem: `"${rotulo(projeto)}" ação ${gravada.numero} ("${gravada.descricao}") existe no banco mas não na planilha.`,
        })
      }
    }
  }

  for (const gravado of banco) {
    if (!vistos.has(chaveProjeto(gravado))) {
      divergencias.push({
        tipo: 'PROJETO_EXCEDENTE',
        projeto: rotulo(gravado),
        mensagem: `"${rotulo(gravado)}" existe no banco mas não na planilha conferida.`,
      })
    }
  }

  const relatorio: Omit<RelatorioValidacao, 'resumo'> = {
    ok: divergencias.length === 0,
    planilha: {
      projetos: planilha.projetos.length,
      acoes: acoesPlanilha,
      linhasLidas: planilha.linhasLidas,
      linhasIgnoradas: planilha.linhasIgnoradas,
    },
    banco: { projetos: banco.length, acoes: acoesBanco },
    divergencias,
  }

  return { ...relatorio, resumo: formatarResumo(relatorio, planilha.avisos) }
}

/** Relatório em texto — é o que vai para o console e para o Log de decisões. */
export function formatarResumo(
  relatorio: Omit<RelatorioValidacao, 'resumo'>,
  avisos: string[] = [],
): string {
  const linhas = [
    `Projetos: ${relatorio.planilha.projetos} (planilha) × ${relatorio.banco.projetos} (banco)`,
    `Ações: ${relatorio.planilha.acoes} (planilha) × ${relatorio.banco.acoes} (banco)`,
    `Linhas de dados lidas: ${relatorio.planilha.linhasLidas} | ignoradas: ${relatorio.planilha.linhasIgnoradas}`,
  ]

  if (avisos.length > 0) linhas.push(`Avisos de mapeamento: ${avisos.length}`)

  if (relatorio.ok) {
    linhas.push('Conferência OK — nenhuma divergência entre planilha e banco.')
  } else {
    linhas.push(`Divergências (${relatorio.divergencias.length}):`)
    for (const d of relatorio.divergencias) linhas.push(`  ! [${d.tipo}] ${d.mensagem}`)
  }

  return linhas.join('\n')
}
