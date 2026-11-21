import Link from 'next/link'

import { auth } from '@clerk/nextjs/server'

import { contaPodeAdministrar } from '@/lib/administracao-servidor'
import { GRUPOS_RELATORIO, RELATORIOS, ROTULO_GRUPO } from '@/lib/dashboard-catalogo'
import { hrefDaAba, type AbaDashboard } from '@/lib/dashboard-abas'
import { GUIA_RELATORIOS } from '@/lib/guia-relatorios'
import { correspondeABusca } from '@/lib/paginacao'
import { MENU, MENU_ADMIN } from '@/lib/menu'
import {
  ROTULO_PERFIL,
  agruparPorGrupo,
  buscarNoManual,
  novidades,
  secoesParaPerfil,
} from '@/lib/manual'
import { GLOSSARIO, SECOES_MANUAL } from '@/lib/manual-conteudo'

export const metadata = { title: 'Manual — Cronograma CTCEA' }

const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeZone: 'UTC' })
const dataDe = (iso: string) => data.format(new Date(`${iso}T00:00:00Z`))

export default async function ManualPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const parametros = await searchParams
  const bruto = parametros.busca
  const busca = (Array.isArray(bruto) ? bruto[0] : bruto)?.trim() || null

  const { userId } = await auth()
  const administrador = userId !== null && (await contaPodeAdministrar(userId))
  const secoes = secoesParaPerfil(SECOES_MANUAL, administrador)

  const encontradas = buscarNoManual(secoes, busca)
  const grupos = agruparPorGrupo(encontradas)
  const recentes = busca ? [] : novidades(secoes)

  // Guia dos relatórios: um por relatório do catálogo, agrupado como as abas.
  // Com busca, só os que combinam com o texto.
  const guias = GRUPOS_RELATORIO.map((grupo) => ({
    grupo,
    relatorios: RELATORIOS.filter(
      (r) =>
        r.grupo === grupo &&
        GUIA_RELATORIOS[r.id] &&
        correspondeABusca(busca, [
          r.titulo,
          r.pergunta,
          GUIA_RELATORIOS[r.id].mostra,
          ...GUIA_RELATORIOS[r.id].comoLer,
          GUIA_RELATORIOS[r.id].deOndeVem,
          GUIA_RELATORIOS[r.id].alerta,
        ]),
    ),
  })).filter((g) => g.relatorios.length > 0)
  const totalGuias = guias.reduce((s, g) => s + g.relatorios.length, 0)

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-12">
      <p className="text-sm font-medium text-accent">Cronograma CTCEA</p>
      <h1 className="mt-2 font-display text-2xl font-extrabold">Manual do usuário</h1>
      <p className="mt-2 max-w-2xl text-sm text-textMuted">
        Passo a passo de cada tela. Prefere ver na prática? Clique em <strong>Tour</strong> no topo
        da página para um passeio de 1 minuto. Este manual é atualizado a cada funcionalidade nova.
      </p>

      <form action="/manual" className="mt-6 flex max-w-xl gap-2 print:hidden" role="search">
        <label className="sr-only" htmlFor="manual-busca">
          Buscar no manual
        </label>
        <input
          className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text outline-none placeholder:text-textFaint focus:border-accent focus:ring-1 focus:ring-accent"
          defaultValue={busca ?? ''}
          id="manual-busca"
          name="busca"
          placeholder="Ex.: atraso, comentário, liberar, exportar"
          type="search"
        />
        <button
          className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-onAccent"
          type="submit"
        >
          Buscar
        </button>
        {busca ? (
          <Link className="self-center text-sm text-textMuted hover:text-accent" href="/manual">
            Limpar
          </Link>
        ) : null}
      </form>

      {busca ? (
        <p className="mt-4 text-sm text-textMuted" role="status">
          {encontradas.length + totalGuias === 0
            ? `Nada encontrado para "${busca}". Tente outra palavra.`
            : `${encontradas.length} ${encontradas.length === 1 ? 'seção encontrada' : 'seções encontradas'} e ${totalGuias} ${totalGuias === 1 ? 'relatório' : 'relatórios'} no guia, para "${busca}".`}
        </p>
      ) : null}

      {recentes.length > 0 ? (
        <section aria-labelledby="novidades" className="mt-8 border-l-2 border-accent bg-surface py-3 pl-4">
          <h2 className="font-display text-base font-bold" id="novidades">
            Novidades
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {recentes.map((s) => (
              <li key={s.id}>
                <span className="tabular-nums text-textFaint">{dataDe(s.desde)}</span>{' '}
                <a className="text-text underline hover:text-accent" href={`#${s.id}`}>
                  {s.titulo}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {grupos.length > 0 ? (
        <nav aria-label="Índice do manual" className="mt-8 grid gap-6 sm:grid-cols-2 print:hidden">
          {grupos.map(({ grupo, secoes }) => (
            <div key={grupo}>
              <h2 className="text-sm font-bold text-textMuted">{grupo}</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {secoes.map((s) => (
                  <li key={s.id}>
                    <a className="text-text hover:text-accent hover:underline" href={`#${s.id}`}>
                      {s.titulo}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      ) : null}

      {totalGuias > 0 ? (
        <p className="mt-6 text-sm print:hidden">
          <a className="font-medium text-accent hover:underline" href="#guia-relatorios">
            Guia dos relatórios dos Dashboards ({totalGuias})
          </a>
        </p>
      ) : null}

      <div className="mt-12 space-y-12">
        {grupos.flatMap(({ secoes }) => secoes).map((s) => {
          const telas = [...MENU, ...(administrador ? MENU_ADMIN : [])].filter((m) => s.rotas.includes(m.href))
          return (
            <section aria-labelledby={`t-${s.id}`} className="scroll-mt-6" id={s.id} key={s.id}>
              <h2 className="font-display text-lg font-extrabold" id={`t-${s.id}`}>
                {s.titulo}
              </h2>
              <p className="mt-1 text-sm text-textMuted">{s.resumo}</p>
              <p className="mt-1 text-xs text-textFaint">
                {ROTULO_PERFIL[s.perfil]} · no sistema desde {dataDe(s.desde)}
                {telas.length > 0 ? (
                  <>
                    {' · '}
                    {telas.map((t, i) => (
                      <span key={t.href}>
                        {i > 0 ? ', ' : null}
                        <Link className="text-accent hover:underline print:hidden" href={t.href}>
                          Abrir {t.rotulo}
                        </Link>
                      </span>
                    ))}
                  </>
                ) : null}
              </p>

              <h3 className="mt-4 text-sm font-bold">Como fazer</h3>
              <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm">
                {s.passos.map((passo) => (
                  <li key={passo}>{passo}</li>
                ))}
              </ol>

              {s.dicas && s.dicas.length > 0 ? (
                <>
                  <h3 className="mt-4 text-sm font-bold">Bom saber</h3>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-textMuted">
                    {s.dicas.map((dica) => (
                      <li key={dica}>{dica}</li>
                    ))}
                  </ul>
                </>
              ) : null}
            </section>
          )
        })}
      </div>

      {totalGuias > 0 ? (
        <section aria-labelledby="titulo-guia" className="mt-16 scroll-mt-6" id="guia-relatorios">
          <h2 className="font-display text-lg font-extrabold" id="titulo-guia">
            Guia dos relatórios dos Dashboards
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-textMuted">
            Para cada relatório: o que mostra, como ler, de onde vem o número e quando olhar com cuidado. O mesmo
            texto aparece em &quot;Como ler este relatório&quot;, embaixo do título de cada um nos Dashboards.
          </p>
          <div className="mt-8 space-y-10">
            {guias.map(({ grupo, relatorios }) => (
              <div key={grupo}>
                <h3 className="text-sm font-bold text-textMuted">Aba {ROTULO_GRUPO[grupo]}</h3>
                <div className="mt-3 space-y-6">
                  {relatorios.map((r) => {
                    const g = GUIA_RELATORIOS[r.id]
                    return (
                      <article className="scroll-mt-6 border-l-2 border-accent pl-4" id={`guia-${r.id}`} key={r.id}>
                        <h4 className="font-display text-base font-bold">{r.titulo}</h4>
                        <p className="text-sm italic text-textMuted">{r.pergunta}</p>
                        <p className="mt-2 text-sm">{g.mostra}</p>
                        <h5 className="mt-3 text-xs font-bold text-textMuted">Como ler</h5>
                        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-textMuted">
                          {g.comoLer.map((linha) => (
                            <li key={linha}>{linha}</li>
                          ))}
                        </ul>
                        <h5 className="mt-3 text-xs font-bold text-textMuted">De onde vem</h5>
                        <p className="text-sm text-textMuted">{g.deOndeVem}</p>
                        <h5 className="mt-3 text-xs font-bold text-textMuted">Quando olhar com cuidado</h5>
                        <p className="text-sm text-textMuted">{g.alerta}</p>
                        <p className="mt-2 text-xs print:hidden">
                          <Link className="text-accent hover:underline" href={hrefDaAba(grupo as AbaDashboard, {}, r.id)}>
                            Abrir este relatório
                          </Link>
                        </p>
                      </article>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {!busca ? (
        <section aria-labelledby="titulo-glossario" className="mt-16 scroll-mt-6" id="glossario">
          <h2 className="font-display text-lg font-extrabold" id="titulo-glossario">
            Glossário
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            {GLOSSARIO.map((g) => (
              <div key={g.termo}>
                <dt className="inline font-bold">{g.termo}: </dt>
                <dd className="inline text-textMuted">{g.definicao}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </main>
  )
}
