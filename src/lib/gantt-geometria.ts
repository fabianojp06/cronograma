/**
 * Geometria do Gantt, em pixels — módulo puro.
 *
 * O Gantt deixou de ser um CSS grid de colunas-semana (cuja barra era sempre um
 * número inteiro de semanas e cujo cabeçalho desalinhava das linhas) e passou a
 * ter UMA régua em pixels: a coluna da semana mede `LARGURA_SEMANA_PX`, e tudo —
 * barras, "hoje", marcas de risco e setas de dependência — é posicionado por
 * dia, a partir do início da primeira semana da janela. Como cabeçalho, linhas e
 * setas usam a mesma conta, não há como desalinharem.
 */

import type { Semana } from './gantt'

export const LARGURA_SEMANA_PX = 44
export const LARGURA_ROTULO_PX = 240
export const ALTURA_LINHA_PX = 48
const DIA_MS = 86_400_000
const LARGURA_DIA_PX = LARGURA_SEMANA_PX / 7

/** Largura total da área das semanas. */
export const larguraDaGrade = (semanas: readonly Semana[]) => semanas.length * LARGURA_SEMANA_PX

/** Posição horizontal (px) do INÍCIO do dia `data`, desde o início da primeira semana. */
export function xDaData(data: Date, semanas: readonly Semana[]): number {
  const dias = (Date.UTC(data.getUTCFullYear(), data.getUTCMonth(), data.getUTCDate()) - semanas[0].inicio.getTime()) / DIA_MS
  return dias * LARGURA_DIA_PX
}

export type BarraEmPx = { esquerda: number; largura: number }

/** Largura mínima: uma ação de 1 dia ainda precisa ser vista (e clicada). */
export const LARGURA_MINIMA_PX = 8

/**
 * A barra entre duas datas (fim INCLUSIVE: o término ocupa o dia inteiro), recortada à janela. Com
 * uma ponta só, a barra tem a largura de uma semana a partir dela. `null` se não há data nenhuma ou se a
 * barra cai inteira fora da janela.
 */
export function barraEmPx(
  inicio: Date | null,
  fim: Date | null,
  semanas: readonly Semana[],
): BarraEmPx | null {
  if (semanas.length === 0) return null
  const de = inicio ?? fim
  const ate = fim ?? inicio
  if (de === null || ate === null) return null

  const total = larguraDaGrade(semanas)
  const x0 = xDaData(de, semanas)
  const x1Bruto = inicio !== null && fim !== null ? xDaData(ate, semanas) + LARGURA_DIA_PX : x0 + LARGURA_SEMANA_PX
  const x1 = Math.max(x1Bruto, x0 + LARGURA_DIA_PX)
  if (x1 <= 0 || x0 >= total) return null

  const esquerda = Math.max(0, x0)
  const direita = Math.min(total, x1)
  return { esquerda, largura: Math.max(LARGURA_MINIMA_PX, direita - esquerda) }
}

/** O "hoje" (meio do dia) em px, ou `null` se cai fora da janela. */
export function xDeHoje(hoje: Date, semanas: readonly Semana[]): number | null {
  if (semanas.length === 0) return null
  const x = xDaData(hoje, semanas) + LARGURA_DIA_PX / 2
  return x < 0 || x > larguraDaGrade(semanas) ? null : x
}

/** O losango de uma data (ex.: o prazo de um risco), ou `null` fora da janela. */
export function xDeMarca(data: Date, semanas: readonly Semana[]): number | null {
  if (semanas.length === 0) return null
  const x = xDaData(data, semanas) + LARGURA_DIA_PX / 2
  return x < 0 || x > larguraDaGrade(semanas) ? null : x
}

export type DependenciaDoGantt = { de: string; para: string; bloqueada: boolean }
export type SetaDoGantt = { id: string; d: string; bloqueada: boolean; x2: number; y2: number }

/**
 * Setas "A termina → B começa". Cada seta sai do FIM da barra prevista da
 * predecessora e chega ao INÍCIO da barra prevista da dependente, em linhas
 * retas (horizontal, vertical, horizontal). Só desenha quando as duas barras
 * estão visíveis na janela e na lista de ações mostrada; se a dependente começa
 * antes de a predecessora terminar (o plano contradiz o vínculo), o caminho dá a
 * volta pela fronteira entre as duas linhas para não passar por cima das barras.
 */
export function montarSetas(
  dependencias: readonly DependenciaDoGantt[],
  linhas: readonly { id: string; previsto: BarraEmPx | null }[],
  alturaDaLinha = ALTURA_LINHA_PX,
): SetaDoGantt[] {
  const porId = new Map(linhas.map((l, indice) => [l.id, { indice, previsto: l.previsto }]))
  const setas: SetaDoGantt[] = []

  for (const dep of dependencias) {
    const origem = porId.get(dep.de)
    const destino = porId.get(dep.para)
    if (!origem?.previsto || !destino?.previsto) continue

    const x1 = origem.previsto.esquerda + origem.previsto.largura
    const y1 = origem.indice * alturaDaLinha + alturaDaLinha / 2
    const x2 = destino.previsto.esquerda
    const y2 = destino.indice * alturaDaLinha + alturaDaLinha / 2
    const folga = 8

    let d: string
    if (origem.indice === destino.indice) {
      // Mesma linha (não deveria acontecer entre ações distintas): só uma reta.
      d = `M ${x1} ${y1} H ${x2}`
    } else if (x2 - x1 >= folga * 2) {
      // Caminho de frente: sai, desce (ou sobe) no meio do vão e entra.
      const xv = x1 + (x2 - x1) / 2
      d = `M ${x1} ${y1} H ${xv} V ${y2} H ${x2}`
    } else {
      // A dependente começa antes de a predecessora terminar: contorna pela fronteira das linhas.
      const yMeio = (y1 + y2) / 2
      d = `M ${x1} ${y1} H ${x1 + folga} V ${yMeio} H ${x2 - folga} V ${y2} H ${x2}`
    }
    setas.push({ id: `${dep.de}>${dep.para}`, d, bloqueada: dep.bloqueada, x2, y2 })
  }
  return setas
}

const PERCENTUAL_DO_STATUS: Record<string, number> = { EM_CURSO_25: 25, EM_CURSO_50: 50, EM_CURSO_75: 75 }

/**
 * Barra de PROGRESSO ESTIMADO: para ação em curso (25/50/75%) SEM nenhuma data
 * realizada, preenche esse percentual do previsto. É estimativa, não fato
 * apontado: a data realizada, quando existe, vale mais e esta barra some.
 */
export function barraDeProgresso(
  status: string,
  previsto: BarraEmPx | null,
  temRealizado: boolean,
): BarraEmPx | null {
  const pct = PERCENTUAL_DO_STATUS[status]
  if (!pct || !previsto || temRealizado) return null
  return { esquerda: previsto.esquerda, largura: Math.max(LARGURA_MINIMA_PX, (previsto.largura * pct) / 100) }
}
