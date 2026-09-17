import { describe, expect, it } from 'vitest'
import {
  CAMPOS_TEXTO_OPCIONAIS,
  validarDadosProjeto,
} from './projeto-validacao'

function comoFormData(registro: Record<string, string>): FormData {
  const form = new FormData()
  for (const [chave, valor] of Object.entries(registro)) form.append(chave, valor)
  return form
}

describe('validarDadosProjeto', () => {
  it('aceita um projeto só com o nome', () => {
    const resultado = validarDadosProjeto({ nome: 'Modernizar rede' })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.nome).toBe('Modernizar rede')
    expect(resultado.dados.prioridade).toBeNull()
    for (const campo of CAMPOS_TEXTO_OPCIONAIS) {
      expect(resultado.dados[campo]).toBeNull()
    }
  })

  it('rejeita nome ausente ou só com espaços', () => {
    for (const nome of ['', '   ']) {
      const resultado = validarDadosProjeto({ nome })
      expect(resultado.ok).toBe(false)
      if (resultado.ok) return
      expect(resultado.erros.nome).toBe('Informe o nome do projeto.')
    }
  })

  it('rejeita nome acima de 200 caracteres', () => {
    const resultado = validarDadosProjeto({ nome: 'a'.repeat(201) })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros.nome).toMatch(/200 caracteres/)
  })

  it('lê FormData e faz trim de todos os campos', () => {
    const resultado = validarDadosProjeto(
      comoFormData({
        nome: '  Portal do servidor  ',
        equipe: ' STI ',
        referencia: ' PLA-DEP-2026-014 ',
      }),
    )
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(resultado.dados.nome).toBe('Portal do servidor')
    expect(resultado.dados.equipe).toBe('STI')
    expect(resultado.dados.referencia).toBe('PLA-DEP-2026-014')
  })

  it('converte prioridade válida para número e rejeita valores inválidos', () => {
    const valido = validarDadosProjeto({ nome: 'X', prioridade: '3' })
    expect(valido.ok && valido.dados.prioridade).toBe(3)

    for (const prioridade of ['0', '-2', '1,5', '2.5', 'alta']) {
      const resultado = validarDadosProjeto({ nome: 'X', prioridade })
      expect(resultado.ok, `prioridade=${prioridade}`).toBe(false)
      if (resultado.ok) return
      expect(resultado.erros.prioridade).toMatch(/inteiro/)
    }
  })

  it('acusa texto opcional longo demais sem invalidar os demais campos', () => {
    const resultado = validarDadosProjeto({
      nome: 'X',
      equipe: 'a'.repeat(501),
      comentario: 'a'.repeat(2000),
    })
    expect(resultado.ok).toBe(false)
    if (resultado.ok) return
    expect(resultado.erros.equipe).toMatch(/500 caracteres/)
    expect(resultado.erros.comentario).toBeUndefined()
  })

  it('ignora campos desconhecidos enviados no formulário', () => {
    const resultado = validarDadosProjeto({ nome: 'X', ativo: 'false', id: 'abc' })
    expect(resultado.ok).toBe(true)
    if (!resultado.ok) return
    expect(Object.keys(resultado.dados).sort()).toEqual(
      ['nome', 'prioridade', ...CAMPOS_TEXTO_OPCIONAIS].sort(),
    )
  })
})
