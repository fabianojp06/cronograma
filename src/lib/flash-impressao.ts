/**
 * Escala da impressão do Flash Report (A4 paisagem). A altura do conteúdo depende do projeto
 * (macroetapas, riscos, alertas), então o zoom é estimado por ele: o maior que ainda cabe numa
 * folha, entre `ZOOM_MAXIMO` (legível) e `ZOOM_MINIMO` (abaixo disso a letra some: segue para
 * uma segunda folha, com quebra só entre blocos).
 */

export const ZOOM_MAXIMO = 0.75
export const ZOOM_MINIMO = 0.5
export const SEMANAS_LADO_A_LADO = 20

/** Altura útil da folha em px de CSS (A4 paisagem, margens de 8 mm). */
const ALTURA_UTIL_PX = 730
/** Folga contra a estimativa errar para menos. */
const FOLGA = 1.12

type Medidas = {
  totalSemanas: number
  macroetapas: number
  realizadas: number
  proximas: number
  riscos: number
  alertas: number
  pedidosDeAjuda: number
  avisos: number
}

const linhas = (n: number, vazio = 1) => Math.max(n, vazio)

export function alturaEstimadaPx(m: Medidas): number {
  const cabecalho = 330 + m.avisos * 32
  const gantt = 40 + (m.macroetapas + 2) * 30 + 70
  const curva = 380
  const meio = m.totalSemanas === 0 ? 0 : m.totalSemanas > SEMANAS_LADO_A_LADO ? gantt + curva : Math.max(gantt, curva)
  const bloco = (n: number) => 50 + linhas(n) * 28
  const listas = Math.max(bloco(m.realizadas), bloco(m.riscos)) + Math.max(bloco(m.proximas), bloco(m.alertas))
  const ajuda = m.pedidosDeAjuda > 0 ? 60 + m.pedidosDeAjuda * 30 : 0
  return (cabecalho + meio + listas + ajuda + 30 + 90) * FOLGA
}

export function zoomDeImpressao(m: Medidas): number {
  const z = ALTURA_UTIL_PX / alturaEstimadaPx(m)
  return Math.round(Math.min(ZOOM_MAXIMO, Math.max(ZOOM_MINIMO, z)) * 100) / 100
}
