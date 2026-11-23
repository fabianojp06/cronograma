import { ROTULO_SINAL, type Farol, type SinalProjeto as Sinal } from '@/lib/farol-projeto'

/**
 * Sinal (farol) do projeto: bolinha + ícone + palavra + desvio. A cor nunca
 * está sozinha: cada estado tem um ícone de forma própria e a palavra escrita.
 * A palavra e o desvio usam a cor de texto normal (4,5:1); só a bolinha e o
 * ícone, que são gráficos (3:1), levam a cor do estado.
 */

const COR: Record<Sinal, string> = {
  ATRASADO: 'text-warn',
  ATENCAO: 'text-atencao',
  EM_DIA: 'text-realizado',
  ADIANTADO: 'text-realizado',
  SEM_DADOS: 'text-textFaint',
}

const FUNDO: Record<Sinal, string> = {
  ATRASADO: 'bg-warn',
  ATENCAO: 'bg-atencao',
  EM_DIA: 'bg-realizado',
  ADIANTADO: 'bg-realizado',
  SEM_DADOS: 'bg-textFaint',
}

/** Círculo, triângulo, check, seta para cima e traço. */
const ICONE: Record<Sinal, string> = {
  ATRASADO: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16z',
  ATENCAO: 'M12 3 22 20H2z',
  EM_DIA: 'M5 12.5 10 17.5 19 7',
  ADIANTADO: 'M12 20V5M5 12l7-7 7 7',
  SEM_DADOS: 'M6 12h12',
}

/** Desvio escrito com menos de verdade; nunca "-0". */
export function escreverDesvio(desvio: number): string {
  const arredondado = Math.round(desvio * 10) / 10
  if (arredondado === 0) return '0 p.p.'
  const texto = Math.abs(arredondado).toString().replace('.', ',')
  return `${arredondado < 0 ? '−' : '+'}${texto} p.p.`
}

export function SinalProjeto({ farol }: { farol: Farol }) {
  const { sinal, desvio } = farol
  const preenchido = sinal === 'ATRASADO' || sinal === 'ATENCAO'
  return (
    <span
      className="inline-flex items-center gap-1.5 font-medium text-text"
      title={farol.motivo}
    >
      <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${FUNDO[sinal]}`} />
      <svg
        aria-hidden="true"
        className={`size-4 shrink-0 ${COR[sinal]}`}
        fill={preenchido ? 'currentColor' : 'none'}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <path d={ICONE[sinal]} />
      </svg>
      <span>
        {ROTULO_SINAL[sinal]}
        {sinal !== 'SEM_DADOS' && desvio !== null ? ` · ${escreverDesvio(desvio)}` : ''}
      </span>
    </span>
  )
}
