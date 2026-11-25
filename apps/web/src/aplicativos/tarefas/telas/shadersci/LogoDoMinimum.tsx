// A logo do minimum (24/11/2026: "Coloca a logo da sci no lugar dessa maletinha"): a palavra numa serifada bem pesada, com o
// i sem ponto, na cor do texto. A mesma na tela inicial e no cabeçalho, no lugar do "Tarefas" (25/11/2026).
export function LogoDoMinimum({ className }: { className?: string }) {
  return <span className={'logo-minimum' + (className ? ' ' + className : '')} role="img" aria-label="minimum">min{'ı'}mum</span>;
}
