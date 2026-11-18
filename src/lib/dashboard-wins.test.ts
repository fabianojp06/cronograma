import { describe, expect, it } from 'vitest'

import {
  janelaDeSemanas,
  taxaDeConclusao,
  winsReincidentes,
  type RegistroSemanal,
  type WinParaRecorrencia,
} from './dashboard-wins'

const S = (semana: number, ano = 2026) => ({ ano, semana })

function reg(
  semana: number,
  status: RegistroSemanal['status'],
  desfecho: RegistroSemanal['desfecho'] = 'NO_CARD',
  ano = 2026,
): RegistroSemanal {
  return { ano, semana, status, desfecho }
}

describe('janelaDeSemanas', () => {
  it('devolve a janela da mais antiga para a mais nova, incluindo a última', () => {
    expect(janelaDeSemanas(S(39), 3)).toEqual([S(37), S(38), S(39)])
  })

  it('atravessa a virada de ano pelo calendário, não pela aritmética', () => {
    // 2026 tem 52 semanas e a semana 1 de 2027 começa em 27/12/2026 —
    // `semana - 1` daria semana 0, que não existe.
    expect(janelaDeSemanas(S(2, 2027), 4)).toEqual([
      S(51, 2026),
      S(52, 2026),
      S(1, 2027),
      S(2, 2027),
    ])
  })

  it('aguenta janela de zero e negativa sem estourar', () => {
    expect(janelaDeSemanas(S(39), 0)).toEqual([])
    expect(janelaDeSemanas(S(39), -3)).toEqual([])
  })
})

describe('taxaDeConclusao', () => {
  const janela = janelaDeSemanas(S(39), 3)

  it('calcula a taxa sobre os WINs que ficaram no card', () => {
    const r = taxaDeConclusao(
      [reg(39, 'FEITO'), reg(39, 'FEITO'), reg(39, 'NAO_FEITO'), reg(39, 'PENDENTE')],
      janela,
      S(39),
    )
    const s39 = r[2]
    expect(s39.total).toBe(4)
    expect(s39.feitos).toBe(2)
    expect(s39.taxa).toBe(0.5)
    expect(s39.motivoSemTaxa).toBeNull()
  })

  it('a janela é densa: semana sem WIN aparece com total zero', () => {
    const r = taxaDeConclusao([reg(39, 'FEITO')], janela, S(39))
    expect(r.map((s) => s.total)).toEqual([0, 0, 1])
    expect(r.map((s) => s.rotulo)).toHaveLength(3)
  })

  it('distingue semana vazia de semana em que ninguém entregou', () => {
    // Zero por cento é "comprometeram e não entregaram"; sem card é "ninguém
    // registrou". Achatar as duas acusaria a equipe de falhar em recesso.
    const r = taxaDeConclusao([reg(39, 'NAO_FEITO')], janela, S(39))
    expect(r[0].taxa).toBeNull()
    expect(r[0].motivoSemTaxa).toBe('SEM_WINS')
    expect(r[2].taxa).toBe(0)
    expect(r[2].motivoSemTaxa).toBeNull()
  })

  it('promovido fica fora do denominador', () => {
    // Promover não é concluir nem falhar. Se entrasse no denominador, a semana
    // em que o funil funcionou apareceria como fracasso.
    const r = taxaDeConclusao(
      [reg(39, 'FEITO'), reg(39, 'PENDENTE', 'PROMOVIDO')],
      janela,
      S(39),
    )
    expect(r[2].total).toBe(2)
    expect(r[2].promovidos).toBe(1)
    expect(r[2].taxa).toBe(1)
  })

  it('NÃO conta o promovido duas vezes', () => {
    // A linha promovida guarda o status que tinha (PENDENTE). Se os baldes de
    // status a incluíssem, a barra empilhada somaria mais que o total.
    const r = taxaDeConclusao([reg(39, 'PENDENTE', 'PROMOVIDO')], janela, S(39))
    const s = r[2]
    expect(s.pendentes).toBe(0)
    expect(s.promovidos).toBe(1)
    expect(s.feitos + s.naoFeitos + s.emAndamento + s.pendentes + s.promovidos).toBe(
      s.total,
    )
  })

  it('semana em que tudo foi promovido não se confunde com recesso', () => {
    const r = taxaDeConclusao([reg(39, 'PENDENTE', 'PROMOVIDO')], janela, S(39))
    expect(r[2].taxa).toBeNull()
    expect(r[2].motivoSemTaxa).toBe('TODOS_PROMOVIDOS')
    expect(r[0].motivoSemTaxa).toBe('SEM_WINS')
  })

  it('encerrado entra nos baldes de status, porque o desfecho gravou um', () => {
    const r = taxaDeConclusao(
      [reg(39, 'FEITO', 'ENCERRADO'), reg(39, 'NAO_FEITO', 'ENCERRADO')],
      janela,
      S(39),
    )
    expect(r[2].feitos).toBe(1)
    expect(r[2].naoFeitos).toBe(1)
    expect(r[2].taxa).toBe(0.5)
  })

  it('marca a semana em curso, que está sempre em aberto', () => {
    const r = taxaDeConclusao([reg(39, 'PENDENTE')], janela, S(39))
    expect(r.map((s) => s.emCurso)).toEqual([false, false, true])
  })
})

describe('winsReincidentes', () => {
  function win(extra: Partial<WinParaRecorrencia> = {}): WinParaRecorrencia {
    return {
      winId: 'w1',
      descricao: 'Relatório mensal',
      colaborador: 'Ana',
      aparicoesAnteriores: 0,
      promovidoEm: null,
      encerradoEm: null,
      projetoId: null,
      aparicoes: [S(38), S(39)],
      ...extra,
    }
  }

  it('soma aparicoesAnteriores', () => {
    // Sem isso, os WINs importados que já vinham se repetindo cairiam abaixo
    // do corte e sumiriam do relatório que existe para achá-los.
    const [r] = winsReincidentes([win({ aparicoesAnteriores: 2, aparicoes: [S(39)] })])
    expect(r.aparicoes).toBe(3)
  })

  it('corta abaixo do mínimo', () => {
    expect(winsReincidentes([win({ aparicoes: [S(39)] })])).toEqual([])
    expect(winsReincidentes([win({ aparicoes: [S(39)] })], 1)).toHaveLength(1)
  })

  it('primeiraSemana é nula quando só há aparições anteriores ao sistema', () => {
    const [r] = winsReincidentes([win({ aparicoesAnteriores: 3, aparicoes: [] })])
    expect(r.primeiraSemana).toBeNull()
    expect(r.ultimaSemana).toBeNull()
    expect(r.aparicoes).toBe(3)
  })

  it('inclui promovidos, marcados pela situação', () => {
    const [r] = winsReincidentes([
      win({ promovidoEm: new Date('2026-09-25'), projetoId: 'p1' }),
    ])
    expect(r.situacao).toBe('PROMOVIDO')
    expect(r.projetoId).toBe('p1')
  })

  it('inclui encerrados', () => {
    const [r] = winsReincidentes([win({ encerradoEm: new Date('2026-09-25') })])
    expect(r.situacao).toBe('ENCERRADO')
  })

  it('ordena por aparições, depois pela mais recente, depois pelo texto', () => {
    const r = winsReincidentes([
      win({ winId: 'b', descricao: 'Beta', aparicoes: [S(37), S(38)] }),
      win({ winId: 'a', descricao: 'Alfa', aparicoes: [S(38), S(39)] }),
      win({ winId: 'c', descricao: 'Gama', aparicoes: [S(37), S(38), S(39)] }),
    ])
    expect(r.map((w) => w.winId)).toEqual(['c', 'a', 'b'])
  })

  it('desempata pelo texto quando aparições e última semana coincidem', () => {
    const r = winsReincidentes([
      win({ winId: 'z', descricao: 'Zebra' }),
      win({ winId: 'a', descricao: 'Abacate' }),
    ])
    expect(r.map((w) => w.descricao)).toEqual(['Abacate', 'Zebra'])
  })

  it('ordena as aparições antes de pegar primeira e última', () => {
    const [r] = winsReincidentes([win({ aparicoes: [S(39), S(37), S(38)] })])
    expect(r.primeiraSemana).toEqual(S(37))
    expect(r.ultimaSemana).toEqual(S(39))
  })
})

describe('winsReincidentes com recorte por semana', () => {
  const win = {
    winId: 'w1',
    descricao: 'Relatório',
    colaborador: 'Ana',
    aparicoesAnteriores: 2,
    promovidoEm: null,
    encerradoEm: null,
    projetoId: null,
    aparicoes: [
      { ano: 2026, semana: 10 },
      { ano: 2026, semana: 11 },
      { ano: 2026, semana: 20 },
    ],
  }

  it('conta só as aparições das semanas aceitas e ignora as anteriores ao sistema', () => {
    const [linha] = winsReincidentes([win], 2, (s) => s.semana <= 11)
    expect(linha.aparicoes).toBe(2)
    expect(linha.ultimaSemana).toEqual({ ano: 2026, semana: 11 })
  })

  it('abaixo do mínimo no período, o WIN sai do relatório', () => {
    expect(winsReincidentes([win], 2, (s) => s.semana === 20)).toEqual([])
  })

  it('a situação continua sendo a do WIN inteiro', () => {
    const inteiro = winsReincidentes([win])[0]
    const [recorte] = winsReincidentes([win], 2, (s) => s.semana <= 11)
    expect(recorte.situacao).toEqual(inteiro.situacao)
  })

  it('sem recorte, soma as anteriores como sempre', () => {
    expect(winsReincidentes([win])[0].aparicoes).toBe(5)
  })
})
