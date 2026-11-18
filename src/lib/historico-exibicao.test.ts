import { describe, expect, it } from 'vitest'

import { formatarValorHistorico, rotularAutor, VALOR_VAZIO } from './historico-exibicao'

describe('formatarValorHistorico', () => {
  it('mostra vazio como traço', () => {
    expect(formatarValorHistorico('status', null)).toBe(VALOR_VAZIO)
    expect(formatarValorHistorico('responsavel', null)).toBe(VALOR_VAZIO)
  })

  it('traduz o status para o rótulo da tela', () => {
    expect(formatarValorHistorico('status', 'EM_CURSO_50')).toBe('Em curso — 50%')
  })

  it('mantém status desconhecido como foi gravado', () => {
    expect(formatarValorHistorico('status', 'ANTIGO')).toBe('ANTIGO')
  })

  it('mostra as datas em dd/mm/aaaa', () => {
    expect(formatarValorHistorico('previstoTermino', '2026-03-02')).toBe('02/03/2026')
    expect(formatarValorHistorico('realizadoInicio', '2026-12-31')).toBe('31/12/2026')
  })

  // Converter por `Date` no fuso de Brasília mostraria 01/03 para 2026-03-02.
  it('não desloca a data pelo fuso', () => {
    expect(formatarValorHistorico('previstoInicio', '2026-03-01')).toBe('01/03/2026')
  })

  it('mostra o nome do responsável como foi gravado', () => {
    expect(formatarValorHistorico('responsavel', 'Márcia Gonçalves')).toBe('Márcia Gonçalves')
  })
})

describe('rotularAutor', () => {
  const nomes = new Map([['user_1', 'Ana Souza']])

  it('troca a conta do Clerk pelo nome do colaborador', () => {
    expect(rotularAutor('user_1', nomes)).toBe('Ana Souza')
  })

  it('não expõe o id de conta sem colaborador', () => {
    expect(rotularAutor('user_2', nomes)).toBe('Conta sem colaborador vinculado')
  })

  it('alteração sem autor é do sistema', () => {
    expect(rotularAutor(null, nomes)).toBe('Sistema')
  })
})
