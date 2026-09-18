import { StatusAcao } from '../generated/prisma/enums'
import { diasUteisEntre } from './dias-uteis'

/**
 * Conversão de uma planilha PLA-DEP/CRO-DEP para o schema do sistema — módulo
 * puro, pelos mesmos motivos dos demais (`projeto-validacao.ts`): a regra de
 * mapeamento fica coberta por teste sem depender do arquivo .xlsx nem do banco.
 * Quem lê o arquivo e grava é `scripts/importar-pla-dep.ts`.
 *
 * Entrada = a matriz crua de células da aba (o `sheet_to_json(..., {header: 1})`
 * do SheetJS), não o arquivo: assim o teste monta o cenário em memória.
 *
 * Estrutura esperada da planilha (ver "Notas de mapeamento" em SCHEMA.md):
 * - uma linha de cabeçalho, localizada pelos próprios títulos (a planilha tem
 *   linhas de título/logo acima dela, então a posição não é fixa);
 * - cada Ação ocupa **duas** linhas — a do "Previsto" e a do "Realizado",
 *   distinguidas pela coluna `Linha`;
 * - colunas do Projeto (Prioridade, Equipe, Assunto...) vêm preenchidas só na
 *   primeira linha do bloco, porque na planilha as células são mescladas; daí o
 *   preenchimento para baixo (`forward fill`).
 *
 * Nada aqui lança por linha ruim: o que não dá para mapear vira `avisos`, para
 * que a importação de ~centenas de linhas não morra na primeira célula suja e o
 * operador veja o relatório completo de uma vez.
 */

export type Celula = string | number | boolean | Date | null | undefined

/** Rótulos aceitos por coluna, já normalizados (sem acento, minúsculos). */
const COLUNAS = {
  numero: ['n', 'no', 'num', 'numero', 'item'],
  prioridade: ['prioridade'],
  equipe: ['equipe'],
  natureza: ['natureza'],
  nome: ['assunto', 'assunto (projeto / iniciativa)', 'projeto', 'iniciativa'],
  categoria: ['categoria'],
  acao: ['acao', 'acoes', 'atividade'],
  linha: ['linha', 'tipo', 'previsto/realizado', 'cronograma'],
  inicio: ['inicio'],
  termino: ['termino', 'fim'],
  responsavel: ['responsavel'],
  apoio: ['apoio'],
  setorEnvolvido: ['setor envolvido', 'setor'],
  comentario: ['comentario', 'comentarios', 'observacao', 'observacoes'],
  progresso: ['progresso', 'status', '%'],
} as const

export type NomeColuna = keyof typeof COLUNAS

export type AcaoImportada = {
  numero: number
  descricao: string
  status: StatusAcao
  previstoInicio: Date | null
  previstoTermino: Date | null
  realizadoInicio: Date | null
  realizadoTermino: Date | null
  duracaoDiasUteis: number | null
}

export type ProjetoImportado = {
  referencia: string | null
  nome: string
  equipe: string | null
  natureza: string | null
  categoria: string | null
  responsavel: string | null
  apoio: string | null
  setorEnvolvido: string | null
  comentario: string | null
  prioridade: number | null
  acoes: AcaoImportada[]
}

export type ResultadoImportacao = {
  projetos: ProjetoImportado[]
  /** Índice (base 1, como a planilha mostra) da linha de cabeçalho encontrada. */
  linhaCabecalho: number
  /** Linhas de dados efetivamente lidas (exclui cabeçalho e linhas vazias). */
  linhasLidas: number
  /** Linhas ignoradas por estarem vazias ou sem Ação/Projeto identificável. */
  linhasIgnoradas: number
  avisos: string[]
}

/** Minúsculas, sem acento, sem pontuação de borda e sem espaços repetidos. */
export function normalizarRotulo(valor: Celula): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.:°º]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function texto(valor: Celula): string | null {
  if (valor instanceof Date) return null
  const t = String(valor ?? '').trim()
  return t.length > 0 ? t : null
}

/**
 * Localiza a linha de cabeçalho e o índice de cada coluna conhecida.
 * É a primeira linha que contém ao menos uma coluna de Ação e uma de data —
 * o par mínimo sem o qual não há o que importar.
 */
export function mapearColunas(
  matriz: Celula[][],
): { linhaCabecalho: number; colunas: Partial<Record<NomeColuna, number>> } | null {
  for (let i = 0; i < matriz.length; i += 1) {
    const colunas: Partial<Record<NomeColuna, number>> = {}

    matriz[i]?.forEach((celula, indice) => {
      const rotulo = normalizarRotulo(celula)
      if (!rotulo) return
      for (const [nome, aceitos] of Object.entries(COLUNAS) as [
        NomeColuna,
        readonly string[],
      ][]) {
        // Primeira ocorrência vence: a planilha repete "Início"/"Término" na
        // grade semanal à direita, e essas repetições não são a coluna de datas.
        if (colunas[nome] === undefined && aceitos.includes(rotulo)) colunas[nome] = indice
      }
    })

    if (colunas.acao !== undefined && (colunas.inicio !== undefined || colunas.termino !== undefined)) {
      return { linhaCabecalho: i, colunas }
    }
  }

  return null
}

/**
 * Data da célula. Aceita os três formatos que a planilha produz na prática:
 * `Date` (quando o leitor já converteu), serial do Excel (número de dias desde
 * 1899-12-30) e texto `dd/mm/aaaa`. O resultado é sempre meia-noite **UTC**,
 * igual ao restante do sistema (`data-hoje.ts`, `dias-uteis.ts`).
 */
export function converterData(valor: Celula): Date | null {
  if (valor === null || valor === undefined || valor === '') return null

  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) return null
    return new Date(Date.UTC(valor.getFullYear(), valor.getMonth(), valor.getDate()))
  }

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor) || valor <= 0) return null
    const base = Date.UTC(1899, 11, 30)
    return new Date(base + Math.trunc(valor) * 86_400_000)
  }

  const t = String(valor).trim()
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})$/.exec(t)
  if (!m) return null

  const dia = Number(m[1])
  const mes = Number(m[2])
  const ano = Number(m[3]) < 100 ? 2000 + Number(m[3]) : Number(m[3])
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  // Rejeita 31/02 e afins: o construtor "rola" para março em vez de falhar.
  if (data.getUTCMonth() !== mes - 1 || data.getUTCDate() !== dia) return null
  return data
}

/**
 * Coluna Progresso/Status → `StatusAcao`. A planilha usa tanto o percentual
 * (0,25 / 25%) quanto o texto ("Em curso", "Concluído"), então os dois entram.
 * Percentuais intermediários caem para a faixa imediatamente **abaixo** — 60%
 * vira `EM_CURSO_50`, porque o enum não deve arredondar progresso para cima.
 */
export function converterStatus(valor: Celula): StatusAcao {
  if (valor === null || valor === undefined || valor === '') return StatusAcao.NAO_INICIADO

  let percentual: number | null = null

  if (typeof valor === 'number' && Number.isFinite(valor)) {
    percentual = valor <= 1 ? valor * 100 : valor
  } else {
    const t = normalizarRotulo(valor)
    const m = /^(\d+(?:[.,]\d+)?)\s*%?$/.exec(t)
    if (m) {
      const n = Number(m[1].replace(',', '.'))
      percentual = t.endsWith('%') || n > 1 ? n : n * 100
    } else if (t.includes('conclu') || t.includes('finaliz')) {
      return StatusAcao.CONCLUIDO
    } else if (t.includes('nao inici') || t.includes('pendente') || t.includes('a iniciar')) {
      return StatusAcao.NAO_INICIADO
    } else if (t.includes('curso') || t.includes('andamento') || t.includes('progresso')) {
      return StatusAcao.EM_CURSO_50
    } else {
      return StatusAcao.NAO_INICIADO
    }
  }

  if (percentual >= 100) return StatusAcao.CONCLUIDO
  if (percentual >= 75) return StatusAcao.EM_CURSO_75
  if (percentual >= 50) return StatusAcao.EM_CURSO_50
  if (percentual >= 25) return StatusAcao.EM_CURSO_25
  return StatusAcao.NAO_INICIADO
}

function converterInteiro(valor: Celula): number | null {
  if (typeof valor === 'number' && Number.isFinite(valor)) return Math.trunc(valor)
  const t = texto(valor)
  if (!t) return null
  const m = /-?\d+/.exec(t)
  return m ? Number(m[0]) : null
}

/** `true` quando a linha marca as datas Realizado (e não as Previsto). */
function ehLinhaRealizado(valor: Celula): boolean {
  return normalizarRotulo(valor).includes('realizad')
}

/**
 * `true` quando a célula é o marcador "Previsto"/"Realizado". No PLA-DEP real o
 * marcador fica na coluna CATEGORIA (a coluna CRONOGRAMA vem vazia), então
 * esse valor não pode virar `Projeto.categoria`.
 */
function ehMarcadorLinha(valor: Celula): boolean {
  const t = normalizarRotulo(valor)
  return t === 'previsto' || t === 'realizado'
}

type Pendente = {
  projeto: ProjetoImportado
  /** Descrição da ação → ação, para casar a linha Realizado com sua Previsto. */
  porDescricao: Map<string, AcaoImportada>
}

function novaAcao(numero: number, descricao: string): AcaoImportada {
  return {
    numero,
    descricao,
    status: StatusAcao.NAO_INICIADO,
    previstoInicio: null,
    previstoTermino: null,
    realizadoInicio: null,
    realizadoTermino: null,
    duracaoDiasUteis: null,
  }
}

/**
 * Converte a matriz de células da aba PLA-DEP em Projetos com suas Ações.
 *
 * `referenciaPadrao` é usada quando a planilha não traz uma coluna de
 * referência própria (caso do CRO-DEP, que é um projeto único).
 *
 * `projetoInicial` abre o resultado já com um projeto ativo, para a planilha
 * que **não tem** coluna de Assunto porque trata de um projeto só (CRO-DEP):
 * sem ele, toda ação cairia no aviso "antes de qualquer projeto".
 */
export function importarPlanilha(
  matriz: Celula[][],
  opcoes: {
    referenciaPadrao?: string
    projetoInicial?: ProjetoImportado
    /**
     * Prefixo da referência dos projetos criados por item (N°) quando a coluna
     * Assunto está vazia — ex.: "PLA-DEP-2026-001" gera "PLA-DEP-2026-001/7".
     */
    prefixoItem?: string
  } = {},
): ResultadoImportacao {
  const avisos: string[] = []
  const cabecalho = mapearColunas(matriz)

  if (!cabecalho) {
    return {
      projetos: [],
      linhaCabecalho: 0,
      linhasLidas: 0,
      linhasIgnoradas: matriz.length,
      avisos: ['Cabeçalho não encontrado: nenhuma linha tem colunas "Ação" e "Início"/"Término".'],
    }
  }

  const { linhaCabecalho, colunas } = cabecalho
  const em = (linha: Celula[], nome: NomeColuna): Celula => {
    const indice = colunas[nome]
    return indice === undefined ? null : linha[indice]
  }

  const projetos: ProjetoImportado[] = []
  const porChave = new Map<string, Pendente>()
  let atual: Pendente | null = null
  // `true` quando o projeto atual foi aberto por item (N°), não por Assunto.
  let atualPorItem = false

  if (opcoes.projetoInicial) {
    atual = { projeto: opcoes.projetoInicial, porDescricao: new Map() }
    porChave.set(`${opcoes.projetoInicial.referencia ?? ''}|${opcoes.projetoInicial.nome}`, atual)
    projetos.push(opcoes.projetoInicial)
  }
  let linhasLidas = 0
  let linhasIgnoradas = 0

  for (let i = linhaCabecalho + 1; i < matriz.length; i += 1) {
    const linha = matriz[i] ?? []
    const numeroLinha = i + 1 // como a planilha numera

    if (linha.every((c) => texto(c) === null && !(c instanceof Date) && typeof c !== 'number')) {
      linhasIgnoradas += 1
      continue
    }

    const nomeAssunto = texto(em(linha, 'nome'))
    const numeroItem = texto(em(linha, 'numero'))
    const descricaoLinha = texto(em(linha, 'acao'))

    // PLA-DEP real: a coluna Assunto vem vazia e cada N° é um item com uma única
    // ação (par Previsto/Realizado). Sem projeto aberto por Assunto, o item vira
    // o próprio projeto, nomeado pela ação.
    const porItem =
      !nomeAssunto && !opcoes.projetoInicial && (atual === null || atualPorItem) && !!numeroItem && !!descricaoLinha
    const nome = nomeAssunto ?? (porItem ? descricaoLinha : null)
    const referencia = porItem
      ? `${opcoes.prefixoItem ? `${opcoes.prefixoItem}/` : ''}${numeroItem}`
      : (numeroItem ?? opcoes.referenciaPadrao ?? null)
    if (nomeAssunto) atualPorItem = false
    if (porItem) atualPorItem = true

    const categoriaBruta = em(linha, 'categoria')

    // Linha que abre um novo projeto (células mescladas deixam o nome só aqui).
    if (nome) {
      const chave = `${referencia ?? ''}|${nome}`
      const existente = porChave.get(chave)
      if (existente) {
        atual = existente
      } else {
        const projeto: ProjetoImportado = {
          referencia,
          nome,
          equipe: texto(em(linha, 'equipe')),
          natureza: texto(em(linha, 'natureza')),
          categoria: ehMarcadorLinha(categoriaBruta) ? null : texto(categoriaBruta),
          responsavel: texto(em(linha, 'responsavel')),
          apoio: texto(em(linha, 'apoio')),
          setorEnvolvido: texto(em(linha, 'setorEnvolvido')),
          comentario: texto(em(linha, 'comentario')),
          prioridade: converterInteiro(em(linha, 'prioridade')),
          acoes: [],
        }
        atual = { projeto, porDescricao: new Map() }
        porChave.set(chave, atual)
        projetos.push(projeto)
      }
    }

    const descricao = descricaoLinha

    if (!descricao) {
      linhasIgnoradas += 1
      if (!nome) avisos.push(`Linha ${numeroLinha} ignorada: sem Ação e sem Assunto.`)
      continue
    }

    if (!atual) {
      linhasIgnoradas += 1
      avisos.push(`Linha ${numeroLinha} ignorada: ação "${descricao}" antes de qualquer projeto.`)
      continue
    }

    const projeto = atual.projeto
    let acao = atual.porDescricao.get(descricao)
    if (!acao) {
      acao = novaAcao(projeto.acoes.length + 1, descricao)
      atual.porDescricao.set(descricao, acao)
      projeto.acoes.push(acao)
    }

    const inicio = converterData(em(linha, 'inicio'))
    const termino = converterData(em(linha, 'termino'))

    if (
      ehLinhaRealizado(em(linha, 'linha')) ||
      (ehMarcadorLinha(categoriaBruta) && ehLinhaRealizado(categoriaBruta))
    ) {
      acao.realizadoInicio = inicio ?? acao.realizadoInicio
      acao.realizadoTermino = termino ?? acao.realizadoTermino
    } else {
      acao.previstoInicio = inicio ?? acao.previstoInicio
      acao.previstoTermino = termino ?? acao.previstoTermino
    }

    const progresso = em(linha, 'progresso')
    if (texto(progresso) !== null || typeof progresso === 'number') {
      acao.status = converterStatus(progresso)
    }

    if (acao.previstoInicio && acao.previstoTermino) {
      acao.duracaoDiasUteis = diasUteisEntre(acao.previstoInicio, acao.previstoTermino)
    }

    linhasLidas += 1
  }

  for (const projeto of projetos) {
    if (projeto.acoes.length === 0) {
      avisos.push(`Projeto "${projeto.nome}" importado sem nenhuma Ação.`)
    }
  }

  return { projetos, linhaCabecalho: linhaCabecalho + 1, linhasLidas, linhasIgnoradas, avisos }
}

/**
 * Identificação do projeto em uma planilha CRO-DEP: o nome e a referência não
 * estão em coluna nenhuma — ficam nas linhas de título **acima** do cabeçalho
 * ("CRO-DEP-2026-001" e "Projeto: ..."), que é o que esta função varre.
 */
export function extrairIdentificacaoProjeto(
  matriz: Celula[][],
  linhaCabecalho: number,
): { referencia: string | null; nome: string | null } {
  let referencia: string | null = null
  let nome: string | null = null

  for (let i = 0; i < linhaCabecalho; i += 1) {
    const linha = matriz[i] ?? []

    for (let j = 0; j < linha.length; j += 1) {
      const bruto = texto(linha[j])
      if (!bruto) continue

      if (!referencia) {
        const m = /\b([A-Za-z]{2,5}-[A-Za-z]{2,5}-\d{4}-\d{1,4})\b/.exec(bruto)
        if (m) referencia = m[1].toUpperCase()
      }

      // "Projeto: X" na mesma célula, ou o rótulo em uma célula e o valor na
      // seguinte. Aqui o casamento é no texto **cru**: `normalizarRotulo`
      // descarta os dois-pontos, que é justamente o separador procurado.
      const rotulo = normalizarRotulo(bruto)
      const m2 = /^\s*(projeto|assunto|cronograma|t[ií]tulo)\s*[:\-–—]\s*(.+)$/i.exec(bruto)
      if (!nome && m2) {
        nome = m2[2].trim()
        continue
      }
      if (!nome && ['projeto', 'assunto', 'cronograma', 'titulo'].includes(rotulo)) {
        const vizinho = linha.slice(j + 1).map(texto).find((v) => v !== null && v !== undefined)
        if (vizinho) nome = vizinho
      }
    }
  }

  // Sem rótulo explícito, o nome é a primeira linha de título com algum texto
  // que não seja apenas a referência.
  if (!nome) {
    for (let i = 0; i < linhaCabecalho && !nome; i += 1) {
      for (const celula of matriz[i] ?? []) {
        const bruto = texto(celula)
        if (!bruto) continue
        const semReferencia = referencia
          ? bruto.replace(new RegExp(referencia, 'i'), '').replace(/^[\s\-–—:]+|[\s\-–—:]+$/g, '')
          : bruto
        if (semReferencia.length > 0) {
          nome = semReferencia
          break
        }
      }
    }
  }

  return { referencia, nome }
}

/**
 * Converte a matriz de uma planilha CRO-DEP — cronograma detalhado de **um**
 * projeto — em um único `ProjetoImportado`. As colunas de Ação são as mesmas do
 * PLA-DEP (`Ação`, `Linha`, `Início`, `Término`, `Progresso`), então o corpo
 * reaproveita `importarPlanilha`; o que muda é de onde vem o projeto: das
 * linhas de título, e não de uma coluna "Assunto".
 *
 * `nome`/`referencia` informados pelo operador vencem o que estiver na planilha.
 */
export function importarCroDep(
  matriz: Celula[][],
  opcoes: { nome?: string; referencia?: string } = {},
): ResultadoImportacao {
  const cabecalho = mapearColunas(matriz)

  if (!cabecalho) {
    return {
      projetos: [],
      linhaCabecalho: 0,
      linhasLidas: 0,
      linhasIgnoradas: matriz.length,
      avisos: ['Cabeçalho não encontrado: nenhuma linha tem colunas "Ação" e "Início"/"Término".'],
    }
  }

  const identificacao = extrairIdentificacaoProjeto(matriz, cabecalho.linhaCabecalho)
  const avisos: string[] = []

  const nome = opcoes.nome ?? identificacao.nome
  if (!nome) {
    avisos.push(
      'Nome do projeto não encontrado nas linhas de título — informe --nome=... para nomeá-lo.',
    )
  }

  const referencia = opcoes.referencia ?? identificacao.referencia
  if (!referencia) {
    avisos.push(
      'Referência (ex.: CRO-DEP-2026-001) não encontrada — informe --referencia=... ' +
        'para que reimportar substitua o projeto em vez de duplicar.',
    )
  }

  const projetoInicial: ProjetoImportado = {
    referencia,
    nome: nome ?? 'Projeto sem nome (CRO-DEP)',
    equipe: null,
    natureza: null,
    categoria: null,
    responsavel: null,
    apoio: null,
    setorEnvolvido: null,
    comentario: null,
    prioridade: null,
    acoes: [],
  }

  const resultado = importarPlanilha(matriz, { projetoInicial })

  // A planilha de um projeto só não deve produzir outros projetos; se produziu,
  // é sinal de que o arquivo é na verdade um PLA-DEP.
  if (resultado.projetos.length > 1) {
    avisos.push(
      `A planilha gerou ${resultado.projetos.length} projetos — parece um PLA-DEP; ` +
        'use `npm run importar:pla-dep`.',
    )
  }

  // Campos do projeto que no CRO-DEP aparecem repetidos por ação: adota o
  // primeiro valor preenchido, para não deixar o cabeçalho do projeto vazio.
  const primeiraLinha = matriz[cabecalho.linhaCabecalho + 1] ?? []
  const emPrimeira = (coluna: NomeColuna): string | null => {
    const indice = cabecalho.colunas[coluna]
    return indice === undefined ? null : texto(primeiraLinha[indice])
  }
  projetoInicial.equipe ??= emPrimeira('equipe')
  projetoInicial.natureza ??= emPrimeira('natureza')
  projetoInicial.categoria ??= emPrimeira('categoria')
  projetoInicial.responsavel ??= emPrimeira('responsavel')
  projetoInicial.apoio ??= emPrimeira('apoio')
  projetoInicial.setorEnvolvido ??= emPrimeira('setorEnvolvido')
  projetoInicial.prioridade ??= converterInteiro(
    cabecalho.colunas.prioridade === undefined
      ? null
      : primeiraLinha[cabecalho.colunas.prioridade],
  )

  return { ...resultado, avisos: [...avisos, ...resultado.avisos] }
}

/** Totais para o relatório de conferência planilha × banco. */
export function totaisImportacao(resultado: ResultadoImportacao): {
  projetos: number
  acoes: number
} {
  return {
    projetos: resultado.projetos.length,
    acoes: resultado.projetos.reduce((total, p) => total + p.acoes.length, 0),
  }
}
