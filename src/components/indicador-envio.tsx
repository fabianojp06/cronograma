/**
 * Sinais de "estou processando", compartilhados por todos os formulários.
 *
 * O padrão é um só em todo o sistema: ao enviar, o botão fica desabilitado com
 * um spinner, e um aviso no centro da tela diz o que está acontecendo. Sem os
 * dois, o clique parecia não ter feito nada enquanto o servidor respondia.
 */

/** Spinner na cor do texto ao redor — serve em botão cheio e em botão de texto. */
export function Spinner({ className = 'size-4' }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  )
}

/**
 * Aviso no centro da tela, sobre um fundo levemente esmaecido. Vai dentro do
 * `<form>` (ou do componente) que controla `ativo`; a posição é fixa, então não
 * mexe no layout de quem o contém.
 */
export function Processando({ ativo, texto }: { ativo: boolean; texto: string }) {
  if (!ativo) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-bg/60 backdrop-blur-[1px]"
      role="status"
    >
      <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-5 py-4 text-accent shadow-lg">
        <Spinner className="size-6" />
        <span className="text-sm font-medium text-text">{texto}</span>
      </div>
    </div>
  )
}
