import { describe, expect, it, vi } from 'vitest'

import {
  CHAVE_TEMA,
  ESTADO_TEMA_SERVIDOR,
  lerEstadoTema,
  serializarEstadoTema,
  CLASSE_ESCURO,
  PREFERENCIAS_TEMA,
  ROTULO_PREFERENCIA,
  SCRIPT_TEMA,
  aplicarTema,
  ehPreferenciaTema,
  lerPreferencia,
  resolverTema,
  type ElementoRaiz,
} from './tema'

describe('ehPreferenciaTema', () => {
  it('aceita as três preferências conhecidas', () => {
    for (const preferencia of PREFERENCIAS_TEMA) {
      expect(ehPreferenciaTema(preferencia)).toBe(true)
    }
  })

  it('rejeita qualquer outra coisa', () => {
    for (const valor of ['dark', 'DARK', '', null, undefined, 3, {}]) {
      expect(ehPreferenciaTema(valor)).toBe(false)
    }
  })
})

describe('lerPreferencia', () => {
  it('devolve a preferência guardada quando é válida', () => {
    expect(lerPreferencia('escuro')).toBe('escuro')
    expect(lerPreferencia('claro')).toBe('claro')
    expect(lerPreferencia('sistema')).toBe('sistema')
  })

  it('cai em "sistema" com valor ausente ou corrompido', () => {
    expect(lerPreferencia(null)).toBe('sistema')
    expect(lerPreferencia(undefined)).toBe('sistema')
    expect(lerPreferencia('lixo-de-versao-antiga')).toBe('sistema')
    expect(lerPreferencia(42)).toBe('sistema')
  })
})

describe('resolverTema', () => {
  it('ignora o sistema quando a escolha é explícita', () => {
    expect(resolverTema('claro', true)).toBe('claro')
    expect(resolverTema('escuro', false)).toBe('escuro')
  })

  it('segue o sistema quando a preferência é "sistema"', () => {
    expect(resolverTema('sistema', true)).toBe('escuro')
    expect(resolverTema('sistema', false)).toBe('claro')
  })
})

describe('aplicarTema', () => {
  function raizFalsa() {
    const toggle = vi.fn()
    const raiz: ElementoRaiz = { classList: { toggle }, style: { colorScheme: '' } }
    return { raiz, toggle }
  }

  it('liga a classe escura e ajusta color-scheme no tema escuro', () => {
    const { raiz, toggle } = raizFalsa()
    aplicarTema(raiz, 'escuro')
    expect(toggle).toHaveBeenCalledWith(CLASSE_ESCURO, true)
    expect(raiz.style.colorScheme).toBe('dark')
  })

  it('desliga a classe escura no tema claro', () => {
    const { raiz, toggle } = raizFalsa()
    aplicarTema(raiz, 'claro')
    expect(toggle).toHaveBeenCalledWith(CLASSE_ESCURO, false)
    expect(raiz.style.colorScheme).toBe('light')
  })
})

describe('SCRIPT_TEMA', () => {
  it('referencia a mesma chave e a mesma classe do módulo', () => {
    expect(SCRIPT_TEMA).toContain(JSON.stringify(CHAVE_TEMA))
    expect(SCRIPT_TEMA).toContain(JSON.stringify(CLASSE_ESCURO))
  })

  it('é resiliente: tem try/catch para localStorage bloqueado', () => {
    expect(SCRIPT_TEMA).toContain('try{')
    expect(SCRIPT_TEMA).toContain('catch')
  })

  it('não contém "</script>", que encerraria a tag ao ser injetado inline', () => {
    expect(SCRIPT_TEMA.toLowerCase()).not.toContain('</script')
  })

  it('aplica a classe escura quando o guardado é "escuro"', () => {
    const { raiz, chamadas } = executarScript('escuro', false)
    expect(chamadas).toEqual([[CLASSE_ESCURO, true]])
    expect(raiz.style.colorScheme).toBe('dark')
  })

  it('segue o sistema quando não há nada guardado', () => {
    expect(executarScript(null, true).chamadas).toEqual([[CLASSE_ESCURO, true]])
    expect(executarScript(null, false).chamadas).toEqual([[CLASSE_ESCURO, false]])
  })

  it('ignora o sistema quando o guardado é "claro"', () => {
    expect(executarScript('claro', true).chamadas).toEqual([[CLASSE_ESCURO, false]])
  })

  it('trata valor corrompido como "sistema"', () => {
    expect(executarScript('lixo', true).chamadas).toEqual([[CLASSE_ESCURO, true]])
  })

  it('não lança quando localStorage está bloqueado', () => {
    expect(() =>
      executarScript(null, false, () => {
        throw new Error('acesso negado')
      }),
    ).not.toThrow()
  })
})

/**
 * Executa o script de pré-pintura num ambiente simulado. É o único jeito de
 * cobrir uma string de JS injetada inline — e ela decide o que a pessoa vê no
 * primeiro frame, então merece teste.
 */
function executarScript(
  guardado: string | null,
  sistemaPrefereEscuro: boolean,
  aoLer?: () => string | null,
) {
  const chamadas: [string, boolean][] = []
  const raiz = {
    classList: {
      toggle: (classe: string, ligado: boolean) => {
        chamadas.push([classe, ligado])
      },
    },
    style: { colorScheme: '' },
  }

  const janela = {
    matchMedia: (consulta: string) => ({
      matches: consulta.includes('dark') && sistemaPrefereEscuro,
    }),
  }
  const armazenamento = {
    getItem: aoLer ?? (() => guardado),
  }

  // `new Function` em vez de `eval` para deixar explícito o escopo injetado.
  new Function('window', 'document', 'localStorage', SCRIPT_TEMA)(
    janela,
    { documentElement: raiz },
    armazenamento,
  )

  return { raiz, chamadas }
}

describe('ROTULO_PREFERENCIA', () => {
  it('tem rótulo em pt-BR para toda preferência', () => {
    for (const preferencia of PREFERENCIAS_TEMA) {
      expect(ROTULO_PREFERENCIA[preferencia].trim()).not.toBe('')
    }
  })
})

describe('serializarEstadoTema / lerEstadoTema', () => {
  it('faz ida e volta das três preferências', () => {
    for (const preferencia of PREFERENCIAS_TEMA) {
      const efetivo = preferencia === 'escuro' ? 'escuro' : 'claro'
      const estado = { preferencia, efetivo } as const
      expect(lerEstadoTema(serializarEstadoTema(estado))).toEqual(estado)
    }
  })

  it('preserva o efetivo quando a preferência é "sistema"', () => {
    expect(lerEstadoTema('sistema|escuro')).toEqual({
      preferencia: 'sistema',
      efetivo: 'escuro',
    })
    expect(lerEstadoTema('sistema|claro')).toEqual({
      preferencia: 'sistema',
      efetivo: 'claro',
    })
  })

  it('recalcula o efetivo a partir da preferência explícita, ignorando o serializado', () => {
    // Um serializado inconsistente (escolha "claro", efetivo "escuro") não
    // pode deixar a tela escura com o botão "Claro" marcado.
    expect(lerEstadoTema('claro|escuro').efetivo).toBe('claro')
    expect(lerEstadoTema('escuro|claro').efetivo).toBe('escuro')
  })

  it('cai em sistema/claro com entrada corrompida ou vazia', () => {
    for (const entrada of ['', 'lixo', 'lixo|lixo', '|']) {
      expect(lerEstadoTema(entrada)).toEqual({ preferencia: 'sistema', efetivo: 'claro' })
    }
  })

  it('o instantâneo do servidor é um valor neutro e estável', () => {
    expect(ESTADO_TEMA_SERVIDOR).toBe('sistema|claro')
    expect(lerEstadoTema(ESTADO_TEMA_SERVIDOR)).toEqual({
      preferencia: 'sistema',
      efetivo: 'claro',
    })
  })

  it('é um primitivo — igualdade por valor, como useSyncExternalStore exige', () => {
    const estado = { preferencia: 'escuro', efetivo: 'escuro' } as const
    expect(serializarEstadoTema(estado)).toBe(serializarEstadoTema(estado))
    expect(typeof serializarEstadoTema(estado)).toBe('string')
  })
})
