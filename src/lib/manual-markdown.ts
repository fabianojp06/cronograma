/**
 * Manual do usuário em Markdown — módulo puro, sem Prisma e sem Next.
 *
 * Gera, a partir das MESMAS fontes da tela `/manual` (`manual-conteudo.ts`,
 * `guia-relatorios.ts`, `dashboard-catalogo.ts`), o texto que vai para a pasta
 * `docs/Manual do Usuário/`. Não grava data de geração: o resultado só muda se o
 * conteúdo mudar, e é isso que `manual-markdown.test.ts` confere.
 */

import { GRUPOS_RELATORIO, ROTULO_GRUPO, type Relatorio } from './dashboard-catalogo'
import type { GuiaRelatorio } from './guia-relatorios'
import {
  GRUPOS_MANUAL,
  ROTULO_PERFIL,
  type SecaoManual,
  type TermoGlossario,
} from './manual'

export type EntradaManualMarkdown = {
  secoes: readonly SecaoManual[]
  glossario: readonly TermoGlossario[]
  relatorios: readonly Relatorio[]
  guia: Record<string, GuiaRelatorio>
}

function dataBr(iso: string): string {
  const [a, m, d] = iso.split('-')
  return `${d}/${m}/${a}`
}

export function manualEmMarkdown({ secoes, glossario, relatorios, guia }: EntradaManualMarkdown): string {
  const l: string[] = []
  l.push('# Manual do Usuário — Sistema Cronograma CTCEA', '')
  l.push(
    '> Este arquivo é **gerado** a partir do manual que está dentro do sistema (`/manual`). ' +
      'Não edite aqui: altere `src/lib/manual-conteudo.ts` e rode `npm run gerar:manual`.',
    '',
  )

  l.push('## Índice', '')
  for (const grupo of GRUPOS_MANUAL) {
    const doGrupo = secoes.filter((s) => s.grupo === grupo)
    if (doGrupo.length === 0) continue
    l.push(`- **${grupo}**`)
    for (const s of doGrupo) l.push(`  - ${s.titulo}`)
  }
  l.push('- **Guia dos relatórios dos Dashboards**')
  l.push('- **Glossário**', '')

  for (const grupo of GRUPOS_MANUAL) {
    const doGrupo = secoes.filter((s) => s.grupo === grupo)
    if (doGrupo.length === 0) continue
    l.push(`## ${grupo}`, '')
    for (const s of doGrupo) {
      l.push(`### ${s.titulo}`, '')
      l.push(`${s.resumo}`, '')
      l.push(`**Quem pode usar:** ${ROTULO_PERFIL[s.perfil]}. **Desde:** ${dataBr(s.desde)}.`, '')
      l.push('**Como fazer**', '')
      s.passos.forEach((p, i) => l.push(`${i + 1}. ${p}`))
      l.push('')
      if (s.dicas && s.dicas.length > 0) {
        l.push('**Dicas e regras**', '')
        for (const d of s.dicas) l.push(`- ${d}`)
        l.push('')
      }
    }
  }

  l.push('## Guia dos relatórios dos Dashboards', '')
  for (const grupo of GRUPOS_RELATORIO) {
    const doGrupo = relatorios.filter((r) => r.grupo === grupo && guia[r.id])
    if (doGrupo.length === 0) continue
    l.push(`### ${ROTULO_GRUPO[grupo]}`, '')
    for (const r of doGrupo) {
      const g = guia[r.id]
      l.push(`#### ${r.titulo}`, '')
      l.push(`**Pergunta que responde:** ${r.pergunta}`, '')
      l.push(`**O que mostra:** ${g.mostra}`, '')
      l.push('**Como ler**', '')
      for (const c of g.comoLer) l.push(`- ${c}`)
      l.push('')
      l.push(`**De onde vem o número:** ${g.deOndeVem}`, '')
      l.push(`**Quando olhar com cuidado:** ${g.alerta}`, '')
    }
  }

  l.push('## Glossário', '')
  for (const t of glossario) l.push(`- **${t.termo}**: ${t.definicao}`)
  l.push('')

  return l.join('\n')
}
