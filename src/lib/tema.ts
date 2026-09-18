/**
 * Preferência de tema (claro/escuro) — módulo puro, sem React e sem acesso a
 * `window`, para que a regra de resolução fique coberta por teste.
 *
 * São três estados, não dois: além de claro e escuro existe "sistema", que
 * segue a preferência do sistema operacional. É o padrão — abrir o sistema já
 * no tema que a pessoa usa no resto do computador é o comportamento esperado,
 * e só quem quer divergir disso precisa escolher.
 */

export const PREFERENCIAS_TEMA = ['sistema', 'claro', 'escuro'] as const

export type PreferenciaTema = (typeof PREFERENCIAS_TEMA)[number]

/** Tema que de fato vai para a tela — "sistema" já resolvido. */
export type TemaEfetivo = 'claro' | 'escuro'

export const ROTULO_PREFERENCIA: Record<PreferenciaTema, string> = {
  sistema: 'Sistema',
  claro: 'Claro',
  escuro: 'Escuro',
}

/** Chave no `localStorage`. Prefixada para não colidir com nada mais na origem. */
export const CHAVE_TEMA = 'ctcea-tema'

/** Classe que liga os tokens escuros (ver `@custom-variant dark` em globals.css). */
export const CLASSE_ESCURO = 'dark'

export function ehPreferenciaTema(valor: unknown): valor is PreferenciaTema {
  return (
    typeof valor === 'string' &&
    (PREFERENCIAS_TEMA as readonly string[]).includes(valor)
  )
}

/**
 * Lê o que estava guardado. Valor ausente, corrompido ou de uma versão antiga
 * cai em "sistema" — a preferência de tema nunca deve quebrar a página.
 */
export function lerPreferencia(bruto: unknown): PreferenciaTema {
  return ehPreferenciaTema(bruto) ? bruto : 'sistema'
}

export function resolverTema(
  preferencia: PreferenciaTema,
  sistemaPrefereEscuro: boolean,
): TemaEfetivo {
  if (preferencia === 'claro') return 'claro'
  if (preferencia === 'escuro') return 'escuro'
  return sistemaPrefereEscuro ? 'escuro' : 'claro'
}

/**
 * Script injetado no `<head>` e executado **antes da primeira pintura**.
 *
 * Sem ele haveria um flash branco em quem usa tema escuro: o HTML chega do
 * servidor sem a classe (o servidor não tem como saber a preferência, que vive
 * no navegador), e um `useEffect` só rodaria depois da página já ter sido
 * pintada. Por isso é string inline e não um componente.
 *
 * Fica dentro de try/catch porque `localStorage` lança em algumas
 * configurações de privacidade — e nesse caso o certo é cair no tema claro,
 * não derrubar a página.
 */
export const SCRIPT_TEMA = `(function(){try{
var p=localStorage.getItem(${JSON.stringify(CHAVE_TEMA)});
if(p!=="claro"&&p!=="escuro")p="sistema";
var e=p==="escuro"||(p==="sistema"&&window.matchMedia("(prefers-color-scheme: dark)").matches);
document.documentElement.classList.toggle(${JSON.stringify(CLASSE_ESCURO)},e);
document.documentElement.style.colorScheme=e?"dark":"light";
}catch(_){}})();`

/**
 * Aplica o tema ao documento. Além da classe, ajusta `color-scheme`: é o que
 * faz o navegador desenhar barra de rolagem, `select` e campos de data na
 * variante certa — sem isso ficam claros no meio da tela escura.
 */
export function aplicarTema(raiz: ElementoRaiz, tema: TemaEfetivo): void {
  raiz.classList.toggle(CLASSE_ESCURO, tema === 'escuro')
  raiz.style.colorScheme = tema === 'escuro' ? 'dark' : 'light'
}

/** Recorte mínimo de `document.documentElement` — permite testar sem DOM real. */
export type ElementoRaiz = {
  classList: { toggle(classe: string, ligado: boolean): void }
  style: { colorScheme: string }
}

/**
 * Estado do tema serializado como `"<preferencia>|<efetivo>"`.
 *
 * O alternador lê a preferência com `useSyncExternalStore`, e o instantâneo
 * precisa ser um valor primitivo comparável por igualdade — se fosse um objeto,
 * cada leitura criaria uma referência nova e o React re-renderizaria em laço.
 * Guardar o tema efetivo junto da preferência é o que faz a troca de tema do
 * sistema operacional chegar ao componente enquanto a preferência é "sistema":
 * a preferência não muda, mas o efetivo sim, e o instantâneo muda com ele.
 */
export type EstadoTema = { preferencia: PreferenciaTema; efetivo: TemaEfetivo }

export function serializarEstadoTema({ preferencia, efetivo }: EstadoTema): string {
  return `${preferencia}|${efetivo}`
}

export function lerEstadoTema(serializado: string): EstadoTema {
  const [preferencia, efetivo] = serializado.split('|')
  const valida = lerPreferencia(preferencia)
  return {
    preferencia: valida,
    // O efetivo é recalculado a partir da preferência sempre que dá: só
    // "sistema" depende do que veio serializado.
    efetivo:
      valida === 'sistema'
        ? efetivo === 'escuro'
          ? 'escuro'
          : 'claro'
        : valida,
  }
}

/** Instantâneo usado na renderização do servidor, que não conhece o navegador. */
export const ESTADO_TEMA_SERVIDOR = serializarEstadoTema({
  preferencia: 'sistema',
  efetivo: 'claro',
})
