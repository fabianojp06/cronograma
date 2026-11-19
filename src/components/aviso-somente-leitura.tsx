import Link from 'next/link'

/**
 * No lugar de um formulário, para quem tem o perfil Leitor. A tela esconde o
 * que não funcionaria; quem recusa de verdade é a Server Action.
 */
export function AvisoSomenteLeitura({
  voltarPara,
  rotuloVoltar = 'Voltar',
}: {
  voltarPara?: string
  rotuloVoltar?: string
}) {
  return (
    <div
      className="mt-8 border-l-2 border-previsto bg-surface py-3 pl-4 text-sm text-textMuted"
      role="status"
    >
      <p>
        <strong className="font-medium text-text">Seu perfil é somente leitura.</strong> Você
        pode consultar e exportar, mas não alterar. Para editar, peça a um administrador
        que mude o seu perfil em Colaboradores.
      </p>
      {voltarPara ? (
        <p className="mt-2">
          <Link className="text-accent hover:underline" href={voltarPara}>
            {rotuloVoltar}
          </Link>
        </p>
      ) : null}
    </div>
  )
}
