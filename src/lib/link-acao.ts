/**
 * Links de apoio de uma ação — módulo puro.
 *
 * O sistema guarda só o ENDEREÇO (ata, contrato, planilha de apoio...); o
 * arquivo continua onde a CTCEA já o guarda, e quem consegue abri-lo é decidido
 * LÁ (SharePoint, Drive...). Só `http` e `https`: `javascript:`, `data:`,
 * `file:` e afins são recusados, porque o link vira um `<a href>` clicável.
 */

export const TIPOS_LINK = ['ATA', 'CONTRATO', 'PLANILHA', 'DOCUMENTO', 'OUTRO'] as const
export type TipoLink = (typeof TIPOS_LINK)[number]

export const ROTULO_TIPO_LINK: Record<TipoLink, string> = {
  ATA: 'Ata',
  CONTRATO: 'Contrato',
  PLANILHA: 'Planilha de apoio',
  DOCUMENTO: 'Documento',
  OUTRO: 'Outro',
}

const TAMANHO_TITULO = 200
const TAMANHO_URL = 2000

export type DadosLink = { titulo: string; url: string; tipo: TipoLink }
export type ErrosLink = Partial<Record<keyof DadosLink, string>>
export type ResultadoLink = { ok: true; dados: DadosLink } | { ok: false; erros: ErrosLink }

/** O endereço é http/https, com servidor, sem espaços nem caracteres de controle. */
export function urlValida(bruto: string): boolean {
  if (bruto.length === 0 || bruto.length > TAMANHO_URL) return false
  if (/[\s\u0000-\u001f\u007f]/.test(bruto)) return false
  let url: URL
  try {
    url = new URL(bruto)
  } catch {
    return false
  }
  return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname.length > 0
}

/** De onde é o link, para a tela mostrar antes do clique ("sharepoint.com"). */
export function origemDoLink(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

const texto = (f: FormData, campo: string) => {
  const v = f.get(campo)
  return typeof v === 'string' ? v.trim() : ''
}

/** Valida o formulário (título, endereço e tipo). O endereço é guardado como foi digitado. */
export function validarLink(formData: FormData): ResultadoLink {
  const erros: ErrosLink = {}
  const titulo = texto(formData, 'titulo').replace(/\s+/g, ' ')
  if (titulo === '') erros.titulo = 'Dê um título ao link.'
  else if (titulo.length > TAMANHO_TITULO) erros.titulo = `O título pode ter no máximo ${TAMANHO_TITULO} caracteres.`

  const url = texto(formData, 'url')
  if (url === '') erros.url = 'Informe o endereço do link.'
  else if (!urlValida(url)) erros.url = 'Use um endereço completo, começando com https:// (ou http://).'

  const tipo = texto(formData, 'tipo') || 'DOCUMENTO'
  if (!(TIPOS_LINK as readonly string[]).includes(tipo)) erros.tipo = 'Tipo inválido.'

  if (Object.keys(erros).length > 0) return { ok: false, erros }
  return { ok: true, dados: { titulo, url, tipo: tipo as TipoLink } }
}

/** Texto do histórico: "Ata: Reunião de kickoff (sharepoint.com)". */
export function descreverLinkNoHistorico(l: { titulo: string; url: string; tipo: string }): string {
  const tipo = ROTULO_TIPO_LINK[l.tipo as TipoLink] ?? l.tipo
  const origem = origemDoLink(l.url)
  return `${tipo}: ${l.titulo}${origem ? ` (${origem})` : ''}`
}
