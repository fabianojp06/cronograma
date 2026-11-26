import { describe, expect, it } from 'vitest'

import { lerArgumentos } from './argumentos-importacao'

const ok = (args: string[]) => {
  const r = lerArgumentos(args)
  if (!r.ok) throw new Error(`esperava sucesso, veio: ${r.erro}`)
  return r.valores
}

describe('lerArgumentos', () => {
  it('lê o arquivo posicional', () => {
    expect(ok(['./card.xlsx']).arquivo).toBe('./card.xlsx')
  })

  /**
   * O defeito que motivou este módulo: `--colaborador` só aceitava `=`,
   * enquanto `--semana` e `--ano` aceitavam espaço. A forma com espaço era
   * descartada em silêncio e a importação criava a pessoa duplicada que a
   * flag existe para evitar, relatando sucesso.
   */
  it.each(['--semana', '--ano', '--colaborador'])(
    '%s aceita as duas formas, com espaço e com igual',
    (sinalizador) => {
      const valor = sinalizador === '--colaborador' ? 'Mariana Santos Garcia' : '39'
      const comEspaco = ok(['./card.xlsx', sinalizador, valor])
      const comIgual = ok(['./card.xlsx', `${sinalizador}=${valor}`])
      expect(comEspaco).toEqual(comIgual)
    },
  )

  it('não confunde o valor com o nome do arquivo', () => {
    const v = ok(['./card.xlsx', '--semana', '39', '--ano', '2026'])
    expect(v).toMatchObject({ arquivo: './card.xlsx', semana: 39, ano: 2026 })
  })

  it('guarda o nome do colaborador com espaços internos', () => {
    expect(ok(['./c.xlsx', '--colaborador', 'Mariana Santos Garcia']).colaborador).toBe(
      'Mariana Santos Garcia',
    )
  })

  it('reconhece --gravar em qualquer posição', () => {
    expect(ok(['--gravar', './c.xlsx']).gravar).toBe(true)
    expect(ok(['./c.xlsx', '--gravar']).gravar).toBe(true)
    expect(ok(['./c.xlsx']).gravar).toBe(false)
  })

  // Sem esta guarda, `--colaborador --gravar` gravaria uma pessoa chamada
  // "--gravar" e ainda deixaria de gravar.
  it('não deixa um sinalizador virar valor de outro', () => {
    const r = lerArgumentos(['./c.xlsx', '--colaborador', '--gravar'])
    expect(r).toMatchObject({ ok: false })
    if (!r.ok) expect(r.erro).toContain('--colaborador precisa de um valor')
  })

  it('recusa valor vazio, nas duas formas', () => {
    expect(lerArgumentos(['./c.xlsx', '--colaborador='])).toMatchObject({ ok: false })
    expect(lerArgumentos(['./c.xlsx', '--colaborador=   '])).toMatchObject({ ok: false })
    expect(lerArgumentos(['./c.xlsx', '--colaborador'])).toMatchObject({ ok: false })
  })

  it('recusa inteiro malformado', () => {
    const r = lerArgumentos(['./c.xlsx', '--semana', 'trinta'])
    expect(r).toMatchObject({ ok: false })
    if (!r.ok) expect(r.erro).toContain('número inteiro')
  })

  // Um `--colaborator` com erro de digitação, ignorado em silêncio, levaria à
  // mesma duplicação que a flag existe para evitar.
  it('recusa sinalizador desconhecido em vez de ignorá-lo', () => {
    const r = lerArgumentos(['./c.xlsx', '--colaborator', 'Fulano'])
    expect(r).toMatchObject({ ok: false })
    if (!r.ok) expect(r.erro).toContain('--colaborator')
  })

  it('recusa dois arquivos', () => {
    expect(lerArgumentos(['./a.xlsx', './b.xlsx'])).toMatchObject({ ok: false })
  })

  it('devolve tudo nulo sem argumentos', () => {
    expect(ok([])).toEqual({
      arquivo: null,
      semana: null,
      ano: null,
      colaborador: null,
      gravar: false,
    })
  })
})
