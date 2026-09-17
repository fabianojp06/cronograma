/**
 * Formata uma data no padrão brasileiro (dd/mm/aaaa).
 */
export function formatarDataBR(data: Date): string {
  const dia = String(data.getDate()).padStart(2, '0')
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  return `${dia}/${mes}/${data.getFullYear()}`
}
