import Link from 'next/link'

import { BarrasEmpilhadas } from '@/components/barras-empilhadas'
import { BolhasPrioridade } from '@/components/bolhas-prioridade'
import { DashboardSecao, SemDados } from '@/components/dashboard-secao'
import { MapaDeCalor } from '@/components/mapa-de-calor'
import { RitmoDeEntrega } from '@/components/ritmo-de-entrega'
import { SemaforoEquipes } from '@/components/semaforo-equipes'
import type {
  CartaoSemaforo,
  LinhaRiscosPorEquipe,
  MatrizDeCalor,
  PontoPrioridadeAtraso,
  SemanaDoRitmo,
} from '@/lib/dashboard-gestao'
import { rel } from './rel'

const SERIES_DE_IMPACTO = [
  { id: 'ALTO', rotulo: 'Impacto alto', tinta: 45 },
  { id: 'MEDIO', rotulo: 'Impacto médio', tinta: 28 },
  { id: 'BAIXO', rotulo: 'Impacto baixo', tinta: 14 },
] as const

/** A aba Gestão: os cruzamentos para diretoria e gerência. */
export function SecoesGestao({
  semaforo,
  mapaCalor,
  prioridadeAtraso,
  riscosEquipe,
  ritmo,
}: {
  semaforo: CartaoSemaforo[]
  mapaCalor: MatrizDeCalor
  prioridadeAtraso: PontoPrioridadeAtraso[]
  riscosEquipe: LinhaRiscosPorEquipe[]
  ritmo: SemanaDoRitmo[]
}) {
  return (
    <>
      <DashboardSecao relatorio={rel('semaforo-equipes')}>
        {semaforo.length === 0 ? (
          <SemDados>Nenhuma ação nem risco no recorte atual.</SemDados>
        ) : (
          <>
            <p className="mb-3 text-sm text-textMuted">
              <strong className="font-medium text-warn">Crítica</strong>: mais de 20% das ações abertas atrasadas, ou risco de
              impacto alto com prazo vencido.{' '}
              <strong className="font-medium text-atencao">Atenção</strong>: de 5% a 20% de atraso, ou risco de impacto alto
              aberto. <strong className="font-medium text-realizado">Em dia</strong>: abaixo disso.
            </p>
            <SemaforoEquipes cartoes={semaforo} />
          </>
        )}
      </DashboardSecao>

      <DashboardSecao relatorio={rel('mapa-calor-status')}>
        {mapaCalor.linhas.length === 0 ? (
          <SemDados>Nenhum projeto ativo com esses filtros.</SemDados>
        ) : (
          <MapaDeCalor colunasDeAlerta={['ATRASADO']} matriz={mapaCalor} rotuloDasLinhas="Equipe" />
        )}
      </DashboardSecao>

      <DashboardSecao
        acao={
          <Link className="text-sm text-textMuted hover:text-accent" href="/priorizacao">
            Abrir a matriz de priorização
          </Link>
        }
        relatorio={rel('prioridade-x-atraso')}
      >
        {prioridadeAtraso.length === 0 ? (
          <SemDados>
            Nenhum projeto avaliado na matriz de priorização no recorte atual. Avalie os projetos em Priorização para
            cruzar benefício, esforço e atraso.
          </SemDados>
        ) : (
          <BolhasPrioridade pontos={prioridadeAtraso} />
        )}
      </DashboardSecao>

      <DashboardSecao relatorio={rel('riscos-por-equipe')}>
        {riscosEquipe.length === 0 ? (
          <SemDados>Nenhum risco ou bloqueio aberto no recorte atual.</SemDados>
        ) : (
          <BarrasEmpilhadas
            linhas={riscosEquipe.map((l) => ({
              rotulo: l.equipe,
              total: l.total,
              valores: l.porImpacto,
              detalhe: [
                l.bloqueios > 0 ? `${l.bloqueios} ${l.bloqueios === 1 ? 'bloqueio' : 'bloqueios'}` : null,
                l.vencidos > 0 ? `${l.vencidos} com prazo vencido` : null,
              ]
                .filter(Boolean)
                .join(' · '),
            }))}
            series={SERIES_DE_IMPACTO}
            unidade="abertos"
          />
        )}
      </DashboardSecao>

      <DashboardSecao relatorio={rel('ritmo-de-entrega')}>
        <RitmoDeEntrega semanas={ritmo} />
      </DashboardSecao>
    </>
  )
}
