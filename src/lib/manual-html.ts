/**
 * HTML do manual para virar PDF — módulo puro, sem Prisma e sem Next.
 *
 * Mesmas fontes da tela `/manual`. Sem data de geração: o HTML só muda se o
 * conteúdo mudar, e é o hash dele que `docs/Manual do Usuário/pdf/manifest.json`
 * guarda para provar que os PDFs estão em dia (o PDF em si não é determinístico).
 */

import type { GuiaRelatorio } from './guia-relatorios'
import { GRUPOS_RELATORIO, ROTULO_GRUPO, type Relatorio } from './dashboard-catalogo'
import { GRUPOS_MANUAL, ROTULO_PERFIL, type SecaoManual, type TermoGlossario } from './manual'

export function escaparHtml(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Nome de arquivo sem acento, caixa nem símbolo: "Painel consolidado" → "painel-consolidado". */
export function slugDoTitulo(titulo: string): string {
  return titulo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function dataBr(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

/** A data mais recente de `desde`: diz até quando o manual foi atualizado. */
export function atualizadoAte(secoes: readonly SecaoManual[]): string {
  return secoes.reduce((max, s) => (s.desde > max ? s.desde : max), '0000-00-00')
}

const ESTILO = `
  @page { size: A4; margin: 20mm 18mm 22mm 18mm; }
  * { box-sizing: border-box; }
  body { font-family: "Public Sans", "Segoe UI", "Helvetica Neue", Arial, sans-serif; font-size: 11pt; line-height: 1.55; color: #16212B; margin: 0; }
  h1, h2, h3, h4 { font-family: "Manrope", "Segoe UI", "Helvetica Neue", Arial, sans-serif; line-height: 1.25; color: #16212B; }
  h2 { font-size: 20pt; margin: 0 0 6mm; padding-bottom: 2mm; border-bottom: 2px solid #0F766E; }
  h3 { font-size: 14pt; margin: 8mm 0 2mm; break-after: avoid; }
  h4 { font-size: 12pt; margin: 6mm 0 1mm; break-after: avoid; }
  p { margin: 0 0 3mm; }
  ol, ul { margin: 0 0 3mm; padding-left: 7mm; }
  li { margin-bottom: 1.5mm; }
  .capa { height: 245mm; display: flex; flex-direction: column; justify-content: center; border-left: 6px solid #0F766E; padding-left: 12mm; break-after: page; }
  .capa h1 { font-size: 30pt; margin: 0 0 4mm; }
  .capa .sub { font-size: 15pt; color: #5B6B76; margin: 0 0 12mm; }
  .capa .meta { font-size: 11pt; color: #5B6B76; margin: 0; }
  .indice { break-after: page; }
  .indice h2 { font-size: 18pt; }
  .indice ul { list-style: none; padding-left: 0; }
  .indice ul ul { padding-left: 6mm; margin-top: 1mm; }
  .indice a { color: #0F766E; text-decoration: none; }
  .grupo { break-before: page; }
  .secao { break-inside: auto; margin-bottom: 4mm; }
  .secao .resumo { color: #5B6B76; }
  .selo { display: inline-block; border: 1px solid #0F766E; color: #0F766E; border-radius: 3px; padding: 0 2mm; font-size: 10pt; margin-right: 2mm; }
  .rotulo { font-weight: 700; margin: 3mm 0 1mm; break-after: avoid; }
  .dicas { border-left: 3px solid #E3E8EC; padding-left: 4mm; }
  .passo-unico { break-inside: avoid; }
`

export function htmlDocumento(titulo: string, corpo: string): string {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escaparHtml(titulo)}</title><style>${ESTILO}</style></head><body>${corpo}</body></html>`
}

export function htmlCapa(titulo: string, subtitulo: string, meta: string): string {
  return `<section class="capa"><h1>${escaparHtml(titulo)}</h1><p class="sub">${escaparHtml(subtitulo)}</p><p class="meta">${escaparHtml(meta)}</p></section>`
}

function htmlLista(tag: 'ol' | 'ul', itens: readonly string[]): string {
  return `<${tag}>${itens.map((i) => `<li>${escaparHtml(i)}</li>`).join('')}</${tag}>`
}

export function htmlSecao(s: SecaoManual, nivel: 'h3' | 'h2' = 'h3'): string {
  const dicas = s.dicas && s.dicas.length > 0
    ? `<div class="dicas"><p class="rotulo">Dicas e regras</p>${htmlLista('ul', s.dicas)}</div>`
    : ''
  return `<article class="secao" id="${escaparHtml(s.id)}"><${nivel}>${escaparHtml(s.titulo)}</${nivel}><p class="resumo">${escaparHtml(s.resumo)}</p><p><span class="selo">${escaparHtml(ROTULO_PERFIL[s.perfil])}</span><span class="selo">Desde ${dataBr(s.desde)}</span></p><p class="rotulo">Como fazer</p>${htmlLista('ol', s.passos)}${dicas}</article>`
}

export type EntradaHtml = {
  secoes: readonly SecaoManual[]
  glossario: readonly TermoGlossario[]
  relatorios: readonly Relatorio[]
  guia: Record<string, GuiaRelatorio>
}

export function htmlGuiaRelatorios(
  relatorios: readonly Relatorio[],
  guia: Record<string, GuiaRelatorio>,
  nivelBase: 'h2' | 'h3' = 'h2',
): string {
  const sub = nivelBase === 'h2' ? 'h3' : 'h4'
  const sub2 = nivelBase === 'h2' ? 'h4' : 'h4'
  const partes: string[] = [`<section class="grupo"><${nivelBase}>Guia dos relatórios dos Dashboards</${nivelBase}>`]
  for (const grupo of GRUPOS_RELATORIO) {
    const doGrupo = relatorios.filter((r) => r.grupo === grupo && guia[r.id])
    if (doGrupo.length === 0) continue
    partes.push(`<${sub}>${escaparHtml(ROTULO_GRUPO[grupo])}</${sub}>`)
    for (const r of doGrupo) {
      const g = guia[r.id]
      partes.push(
        `<article class="secao"><${sub2}>${escaparHtml(r.titulo)}</${sub2}>` +
          `<p><strong>Pergunta que responde:</strong> ${escaparHtml(r.pergunta)}</p>` +
          `<p><strong>O que mostra:</strong> ${escaparHtml(g.mostra)}</p>` +
          `<p class="rotulo">Como ler</p>${htmlLista('ul', g.comoLer)}` +
          `<p><strong>De onde vem o número:</strong> ${escaparHtml(g.deOndeVem)}</p>` +
          `<p><strong>Quando olhar com cuidado:</strong> ${escaparHtml(g.alerta)}</p></article>`,
      )
    }
  }
  partes.push('</section>')
  return partes.join('')
}

export function htmlGlossario(glossario: readonly TermoGlossario[]): string {
  return `<section class="grupo"><h2>Glossário</h2><ul>${glossario
    .map((t) => `<li><strong>${escaparHtml(t.termo)}</strong>: ${escaparHtml(t.definicao)}</li>`)
    .join('')}</ul></section>`
}

/** Manual completo de um perfil: capa, índice, seções por grupo, guia e glossário. */
export function htmlManualDoPerfil(nomePerfil: string, entrada: EntradaHtml): string {
  const { secoes, glossario, relatorios, guia } = entrada
  const indice = GRUPOS_MANUAL.map((g) => {
    const doGrupo = secoes.filter((s) => s.grupo === g)
    if (doGrupo.length === 0) return ''
    return `<li><strong>${escaparHtml(g)}</strong><ul>${doGrupo
      .map((s) => `<li><a href="#${escaparHtml(s.id)}">${escaparHtml(s.titulo)}</a></li>`)
      .join('')}</ul></li>`
  }).join('')
  const grupos = GRUPOS_MANUAL.map((g) => {
    const doGrupo = secoes.filter((s) => s.grupo === g)
    if (doGrupo.length === 0) return ''
    return `<section class="grupo"><h2>${escaparHtml(g)}</h2>${doGrupo.map((s) => htmlSecao(s)).join('')}</section>`
  }).join('')
  const corpo =
    htmlCapa(
      'Manual do Usuário',
      `Sistema Cronograma CTCEA — perfil ${nomePerfil}`,
      `Atualizado até ${dataBr(atualizadoAte(secoes))}`,
    ) +
    `<section class="indice"><h2>Índice</h2><ul>${indice}<li><strong>Guia dos relatórios dos Dashboards</strong></li><li><strong>Glossário</strong></li></ul></section>` +
    grupos +
    htmlGuiaRelatorios(relatorios, guia) +
    htmlGlossario(glossario)
  return htmlDocumento(`Manual do Usuário — ${nomePerfil}`, corpo)
}

/** Manual de UMA funcionalidade: uma página de cabeçalho enxuta e a seção. */
export function htmlManualDaSecao(s: SecaoManual): string {
  const corpo =
    `<p class="resumo">Manual do Usuário — Sistema Cronograma CTCEA — ${escaparHtml(s.grupo)}</p>` +
    htmlSecao(s, 'h2')
  return htmlDocumento(`${s.titulo} — Manual do Usuário`, corpo)
}

export function htmlManualDoGuia(relatorios: readonly Relatorio[], guia: Record<string, GuiaRelatorio>): string {
  const corpo =
    `<p class="resumo">Manual do Usuário — Sistema Cronograma CTCEA — Análise</p>` +
    htmlGuiaRelatorios(relatorios, guia).replace('class="grupo"', 'class="semquebra"')
  return htmlDocumento('Guia dos relatórios dos Dashboards — Manual do Usuário', corpo)
}
