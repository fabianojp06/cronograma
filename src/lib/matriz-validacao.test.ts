import { describe, expect, it } from 'vitest'

import {
  SOMA_EXIGIDA,
  montarPesos,
  pesosSaoPadrao,
  somaDoGrupo,
  validarAvaliacao,
  validarPesos,
} from './matriz-validacao'
import { PESOS_PADRAO, type PesosCriterios } from './matriz-calculo'
import { FATORES_GUT, IDS_CRITERIO } from './matriz-criterios'

/** Formulário válido mínimo — todas as notas preenchidas. */
function formulario(sobrescreve: Record<string, string> = {}) {
  const campos: Record<string, string> = {}
  for (const id of IDS_CRITERIO) campos[id] = '3'
  for (const fator of FATORES_GUT) campos[fator] = '3'
  return { ...campos, ...sobrescreve }
}

function formularioPesos(sobrescreve: Record<string, string> = {}) {
  const campos: Record<string, string> = {}
  for (const id of IDS_CRITERIO) campos[id] = '20'
  return { ...campos, ...sobrescreve }
}

describe('validarAvaliacao', () => {
  it('aceita um formulário completo e devolve as notas', () => {
    const resultado = validarAvaliacao(formulario())
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.beneficioCompromissos).toBe(3)
    expect(resultado.dados.gravidade).toBe(3)
    expect(resultado.dados.observacao).toBeNull()
  })

  it('aceita nota 0, que é válida na escala', () => {
    const resultado = validarAvaliacao(formulario({ beneficioClima: '0' }))
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.dados.beneficioClima).toBe(0)
  })

  it('exige todos os dez critérios', () => {
    const resultado = validarAvaliacao(formulario({ esforcoDuracao: '' }))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(resultado.erros.esforcoDuracao).toBe('Escolha uma nota.')
  })

  it('recusa nota fora da escala em vez de arredondar', () => {
    const resultado = validarAvaliacao(formulario({ beneficioCompromissos: '7' }))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.erros.beneficioCompromissos).toContain('0, 3, 6, 9')
    }
  })

  it('recusa texto e valores negativos', () => {
    for (const valor of ['abc', '-3', '9.5']) {
      const resultado = validarAvaliacao(formulario({ beneficioClima: valor }))
      expect(resultado.ok).toBe(false)
    }
  })

  it('exige os três fatores do GUT na escala 1 a 5', () => {
    expect(validarAvaliacao(formulario({ gravidade: '0' })).ok).toBe(false)
    expect(validarAvaliacao(formulario({ urgencia: '6' })).ok).toBe(false)
    expect(validarAvaliacao(formulario({ tendencia: '5' })).ok).toBe(true)
  })

  it('acumula erros de vários campos de uma vez', () => {
    const resultado = validarAvaliacao(
      formulario({ beneficioClima: '7', gravidade: '', esforcoDuracao: 'x' }),
    )
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) expect(Object.keys(resultado.erros).length).toBe(3)
  })

  it('guarda a observação e recusa texto longo demais', () => {
    const comTexto = validarAvaliacao(formulario({ observacao: '  justificativa  ' }))
    expect(comTexto.ok).toBe(true)
    if (comTexto.ok) expect(comTexto.dados.observacao).toBe('justificativa')

    const longa = validarAvaliacao(formulario({ observacao: 'a'.repeat(2001) }))
    expect(longa.ok).toBe(false)
  })

  it('funciona com FormData, não só com objeto', () => {
    const dados = new FormData()
    for (const [campo, valor] of Object.entries(formulario())) dados.set(campo, valor)
    expect(validarAvaliacao(dados).ok).toBe(true)
  })
})

describe('validarPesos', () => {
  it('aceita os pesos padrão (20% em cada um dos cinco)', () => {
    const resultado = validarPesos(formularioPesos())
    expect(resultado.ok).toBe(true)
    if (resultado.ok) expect(resultado.dados).toEqual(PESOS_PADRAO)
  })

  it('aceita uma distribuição desigual que ainda soma 100 por grupo', () => {
    const resultado = validarPesos(
      formularioPesos({
        beneficioCompromissos: '60',
        beneficioValorTecnologico: '10',
        beneficioClima: '10',
        beneficioGovernanca: '10',
        beneficioEficiencia: '10',
      }),
    )
    expect(resultado.ok).toBe(true)
  })

  it('recusa quando um grupo não soma 100 e diz quanto deu', () => {
    const resultado = validarPesos(formularioPesos({ beneficioClima: '30' }))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.erros.BENEFICIO).toContain('110%')
      // O outro grupo continua válido e não recebe erro.
      expect(resultado.erros.ESFORCO).toBeUndefined()
    }
  })

  it('valida os dois grupos de forma independente', () => {
    const resultado = validarPesos(formularioPesos({ esforcoDuracao: '5' }))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.erros.ESFORCO).toBeDefined()
      expect(resultado.erros.BENEFICIO).toBeUndefined()
    }
  })

  it('recusa peso não inteiro, negativo ou acima de 100', () => {
    for (const valor of ['20.5', '-1', '101', '', 'x']) {
      expect(validarPesos(formularioPesos({ beneficioClima: valor })).ok).toBe(false)
    }
  })

  it('não acusa soma errada quando já há erro de campo', () => {
    // Evita mostrar dois erros para a mesma causa.
    const resultado = validarPesos(formularioPesos({ beneficioClima: 'x' }))
    expect(resultado.ok).toBe(false)
    if (!resultado.ok) {
      expect(resultado.erros.beneficioClima).toBeDefined()
      expect(resultado.erros.BENEFICIO).toBeUndefined()
    }
  })
})

describe('somaDoGrupo', () => {
  it('soma só os critérios do grupo pedido', () => {
    expect(somaDoGrupo(PESOS_PADRAO, 'BENEFICIO')).toBe(SOMA_EXIGIDA)
    expect(somaDoGrupo(PESOS_PADRAO, 'ESFORCO')).toBe(SOMA_EXIGIDA)
  })

  it('trata peso ausente como zero', () => {
    expect(somaDoGrupo({} as PesosCriterios, 'BENEFICIO')).toBe(0)
  })
})

describe('montarPesos', () => {
  it('sem linhas, devolve os pesos padrão da planilha', () => {
    expect(montarPesos([])).toEqual(PESOS_PADRAO)
  })

  it('sobrepõe só os critérios que têm linha', () => {
    const pesos = montarPesos([
      { criterio: 'beneficioCompromissos', peso: 40 },
      { criterio: 'beneficioClima', peso: 10 },
    ])
    expect(pesos.beneficioCompromissos).toBe(40)
    expect(pesos.beneficioClima).toBe(10)
    expect(pesos.beneficioGovernanca).toBe(20)
  })

  it('ignora linha de critério desconhecido, sem quebrar', () => {
    const pesos = montarPesos([{ criterio: 'criterioQueNaoExisteMais', peso: 99 }])
    expect(pesos).toEqual(PESOS_PADRAO)
  })
})

describe('pesosSaoPadrao', () => {
  it('reconhece a configuração original', () => {
    expect(pesosSaoPadrao(PESOS_PADRAO)).toBe(true)
    expect(pesosSaoPadrao(montarPesos([]))).toBe(true)
  })

  it('reconhece qualquer desvio', () => {
    expect(
      pesosSaoPadrao(montarPesos([{ criterio: 'beneficioClima', peso: 21 }])),
    ).toBe(false)
  })
})
