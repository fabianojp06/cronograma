/** Formatação do Flash Report: pt-BR, uma casa, menos de verdade, nunca "-0". */

const umaCasa = (n: number) => Math.round(n * 10) / 10 + 0 // "+ 0" troca -0 por 0

/** 68 → "68,0%". */
export function percentualEscrito(n: number): string {
  const r = umaCasa(n)
  return `${r.toFixed(1).replace('.', ',')}%`.replace(/^-/, '−')
}

/** Pontos percentuais com sinal: −4 → "−4,0 p.p.", 0 → "0,0 p.p.". */
export function desvioEscritoFlash(n: number): string {
  const r = umaCasa(n)
  const t = Math.abs(r).toFixed(1).replace('.', ',')
  if (r < 0) return `−${t} p.p.`
  if (r > 0) return `+${t} p.p.`
  return `${t} p.p.`
}
