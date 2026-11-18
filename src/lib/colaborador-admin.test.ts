import { describe, expect, it } from 'vitest'

import {
  lerAcaoAtivo,
  podeDesativar,
  projetosADivergir,
  projetosDaPessoa,
  validarArea,
  validarEmail,
  validarRenomear,
} from './colaborador-admin'

const cadastrados = [
  { id: 'a', nome: 'Fabiano José' },
  { id: 'b', nome: 'Márcia Gonçalves' },
]

describe('validarRenomear', () => {
  it('aceita um nome novo e livre', () => {
    expect(validarRenomear(cadastrados, 'a', 'Fabiano J. Pereira')).toEqual({
      ok: true,
      nome: 'Fabiano J. Pereira',
      mudou: true,
    })
  })

  it('permite corrigir acento e caixa do próprio nome', () => {
    // É a correção que esta tela existe para fazer: quem se cadastrou sem
    // acento precisa poder arrumar.
    expect(validarRenomear(cadastrados, 'a', 'fabiano jose')).toEqual({
      ok: true,
      nome: 'fabiano jose',
      mudou: true,
    })
  })

  it('avisa quando o nome não mudou de fato', () => {
    const r = validarRenomear(cadastrados, 'a', '  Fabiano   José ')
    expect(r).toEqual({ ok: true, nome: 'Fabiano José', mudou: false })
  })

  it('recusa nome que colide com outro, mesmo com acento diferente', () => {
    // Igualdade exata deixaria passar "Marcia Goncalves" ao lado de "Márcia
    // Gonçalves" — duas pessoas no relatório por responsável.
    expect(validarRenomear(cadastrados, 'a', 'marcia goncalves')).toEqual({
      ok: false,
      erro: 'NOME_EM_USO',
    })
  })

  it('recusa nome inválido', () => {
    expect(validarRenomear(cadastrados, 'a', '  ')).toEqual({
      ok: false,
      erro: 'NOME_INVALIDO',
    })
    expect(validarRenomear(cadastrados, 'a', '123')).toEqual({
      ok: false,
      erro: 'NOME_INVALIDO',
    })
  })

  it('recusa id que não existe', () => {
    expect(validarRenomear(cadastrados, 'z', 'Qualquer Nome')).toEqual({
      ok: false,
      erro: 'NAO_ENCONTRADO',
    })
  })
})

describe('podeDesativar', () => {
  it('recusa desativar a si mesmo', () => {
    expect(podeDesativar('a', 'a')).toEqual({ ok: false, erro: 'AUTO_DESATIVACAO' })
  })

  it('permite desativar outra pessoa', () => {
    expect(podeDesativar('b', 'a')).toEqual({ ok: true })
  })

  it('permite quando quem pede não está vinculado', () => {
    expect(podeDesativar('a', null)).toEqual({ ok: true })
  })
})

describe('projetosDaPessoa e projetosADivergir', () => {
  const projetos = [
    { id: '1', responsavel: 'Fabiano José' },
    { id: '2', responsavel: 'Fabiano Jose' },
    { id: '3', responsavel: 'fabiano  josé' },
    { id: '4', responsavel: 'Márcia Gonçalves' },
    { id: '5', responsavel: null },
  ]

  it('acha todas as grafias da mesma pessoa', () => {
    // É o ponto da tela: a divergência que ela existe para curar é justamente
    // a que um `where` exato não enxerga.
    expect(projetosDaPessoa(projetos, 'Fabiano José').map((p) => p.id)).toEqual([
      '1',
      '2',
      '3',
    ])
  })

  it('ignora responsável nulo', () => {
    expect(projetosDaPessoa(projetos, 'Ninguém')).toEqual([])
  })

  it('divergir exclui quem já está com a grafia certa', () => {
    expect(projetosADivergir(projetos, 'Fabiano José').map((p) => p.id)).toEqual([
      '2',
      '3',
    ])
  })

  it('não diverge nada quando todos já estão certos', () => {
    expect(projetosADivergir([{ id: '1', responsavel: 'Ana' }], 'Ana')).toEqual([])
  })
})

describe('lerAcaoAtivo', () => {
  it('aceita as duas intenções', () => {
    expect(lerAcaoAtivo('desativar')).toBe('desativar')
    expect(lerAcaoAtivo('reativar')).toBe('reativar')
  })

  it('recusa qualquer outra coisa', () => {
    expect(lerAcaoAtivo('apagar')).toBeNull()
    expect(lerAcaoAtivo('')).toBeNull()
    expect(lerAcaoAtivo(null)).toBeNull()
    expect(lerAcaoAtivo(1)).toBeNull()
  })
})

describe('validarArea', () => {
  it('guarda a área como foi escrita, só normalizando espaço', () => {
    expect(validarArea('  AGP  -  Gerenciamento de Programa ')).toEqual({
      ok: true,
      area: 'AGP - Gerenciamento de Programa',
    })
  })

  it('preserva acento e caixa: a área é rótulo, não chave de identidade', () => {
    expect(validarArea('Gestão de Pessoas')).toEqual({
      ok: true,
      area: 'Gestão de Pessoas',
    })
  })

  // Vazio não é erro: "sem área" é o estado de quem se cadastrou pela tela, e
  // precisa ser possível voltar a ele depois de ter preenchido.
  it('trata vazio e só-espaço como remover a área, não como erro', () => {
    expect(validarArea('')).toEqual({ ok: true, area: null })
    expect(validarArea('   ')).toEqual({ ok: true, area: null })
  })

  /**
   * Ausente não é vazio. `FormData.get` devolve `null` quando o formulário não
   * traz o campo — o caso de uma aba aberta antes desta versão. Se isso fosse
   * lido como "remover", ela apagaria em silêncio a área de quem veio da
   * planilha. `undefined` é o que o Prisma entende como "não mexer".
   */
  it('trata campo ausente como não mexer, e não como remover', () => {
    expect(validarArea(null)).toEqual({ ok: true, area: undefined })
    expect(validarArea(undefined)).toEqual({ ok: true, area: undefined })
    expect(validarArea(42)).toEqual({ ok: true, area: undefined })
  })

  it('recusa acima do limite da coluna', () => {
    expect(validarArea('a'.repeat(120)).ok).toBe(true)
    expect(validarArea('a'.repeat(121))).toEqual({ ok: false, erro: 'AREA_LONGA' })
  })

  // O limite vale sobre o texto JÁ normalizado: senão um campo de espaços
  // repetidos seria recusado por um comprimento que não vai para o banco.
  it('mede o limite depois de normalizar o espaço', () => {
    expect(validarArea(`  ${'a'.repeat(120)}  `).ok).toBe(true)
  })
})

describe('validarEmail', () => {
  it('normaliza espaço e caixa', () => {
    expect(validarEmail('  Fulano.Silva@CTCEA.org.br ')).toEqual({
      ok: true,
      email: 'fulano.silva@ctcea.org.br',
    })
  })

  it('trata vazio e só-espaço como remover o e-mail', () => {
    expect(validarEmail('')).toEqual({ ok: true, email: null })
    expect(validarEmail('   ')).toEqual({ ok: true, email: null })
  })

  // Mesma distinção da área: uma aba aberta antes desta versão não traz o
  // campo, e ler isso como "remover" apagaria o e-mail semeado pelo Clerk.
  it('trata campo ausente como "não mexer", não como remover', () => {
    expect(validarEmail(null)).toEqual({ ok: true, email: undefined })
    expect(validarEmail(undefined)).toEqual({ ok: true, email: undefined })
  })

  it.each([
    'fulano',
    'fulano@',
    '@ctcea.org.br',
    'fulano@ctcea',
    'ful ano@ctcea.org.br',
    'a@b@c.org',
  ])('recusa formato inválido: %s', (email) => {
    expect(validarEmail(email)).toEqual({ ok: false, erro: 'EMAIL_INVALIDO' })
  })

  it('recusa e-mail acima de 254 caracteres', () => {
    const longo = `${'a'.repeat(250)}@x.br`
    expect(validarEmail(longo)).toEqual({ ok: false, erro: 'EMAIL_INVALIDO' })
  })
})
